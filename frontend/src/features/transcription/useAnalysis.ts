import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { getAnalysis, getAnalyses, triggerAnalysis, getAnalysisProfiles } from './api'
import type { AnalysisProfile, AnalysisResult } from './types'
import { ApiError } from './types'

/**
 * Parsed analysis data structure
 */
export interface ParsedAnalysisData {
  summary: string
  topics: string[]
  keyPoints: string[]
}

/**
 * Options for the useAnalysis hook
 */
export interface UseAnalysisOptions {
  /** Entry cleanup ID to analyze */
  cleanupId: string | null
  /** Analysis ID from transcribe response - if provided, polls for existing results */
  analysisId?: string | null
  /** Default profile to use for manual re-analysis */
  defaultProfile?: string
}

/**
 * Return type for the useAnalysis hook
 */
export interface UseAnalysisReturn {
  /** Parsed analysis data */
  data: ParsedAnalysisData | null
  /** Whether analysis is loading */
  isLoading: boolean
  /** Whether polling for results */
  isPolling: boolean
  /** Error message if analysis failed */
  error: string | null
  /** Available analysis profiles */
  profiles: AnalysisProfile[]
  /** Whether profiles are loading */
  isLoadingProfiles: boolean
  /** Current analysis job ID */
  analysisId: string | null
  /** Currently selected profile ID */
  currentProfileId: string | null
  /** Label of currently selected profile (for dropdown button text) */
  currentProfileLabel: string | null
  /** Intent of currently selected profile (for subtitle display) */
  currentProfileIntent: string | null
  /** Select a profile - checks cache, then API, then triggers LLM if needed */
  selectProfile: (profileId: string) => Promise<void>
  /** Trigger analysis with a specific profile (always triggers new LLM call) */
  analyze: (profileId?: string) => Promise<void>
  /** Load profiles */
  loadProfiles: () => Promise<void>
  /** Populate cache from initial analyses (called when loading entry) */
  populateCache: (analyses: AnalysisResult[]) => void
  /** Reset analysis state */
  reset: () => void
}

/**
 * Parse raw analysis result into typed structure
 */
function parseAnalysisResult(result: Record<string, unknown> | null | undefined): ParsedAnalysisData | null {
  if (!result) return null

  // The API returns different fields based on profile
  // For generic-summary, we expect: summary, topics, key_points
  const summary = typeof result.summary === 'string' ? result.summary : ''
  const topics = Array.isArray(result.topics)
    ? result.topics.filter((t): t is string => typeof t === 'string')
    : []
  const keyPoints = Array.isArray(result.key_points)
    ? result.key_points.filter((kp): kp is string => typeof kp === 'string')
    : []

  if (!summary && topics.length === 0 && keyPoints.length === 0) {
    return null
  }

  return {
    summary,
    topics,
    keyPoints,
  }
}

/**
 * Hook for managing analysis workflow
 *
 * Features:
 * - Load available analysis profiles
 * - Trigger analysis on cleaned entries
 * - Poll for completion (2s interval)
 * - Parse results into typed structure
 * - Auto-trigger when cleanup completes (optional)
 *
 * @example
 * ```tsx
 * // analysisId comes from the transcribe response - backend already triggered analysis
 * const { data, isLoading, analyze, profiles } = useAnalysis({
 *   cleanupId: transcription.cleanupId,
 *   analysisId: transcription.analysisId,  // Auto-polls for results
 * })
 *
 * return (
 *   <div>
 *     {isLoading && <Spinner />}
 *     {data && <AnalysisSection data={data} profiles={profiles} />}
 *     <button onClick={() => analyze('action-items')}>Re-analyze with different profile</button>
 *   </div>
 * )
 * ```
 */
export function useAnalysis(options: UseAnalysisOptions): UseAnalysisReturn {
  const { cleanupId, analysisId: initialAnalysisId, defaultProfile: defaultProfileOverride } = options

  const [data, setData] = useState<ParsedAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<AnalysisProfile[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  // Default profile ID from API (or override from options)
  const [defaultProfileId, setDefaultProfileId] = useState<string>(defaultProfileOverride ?? 'generic-summary')

  // Cache of analyses by profile_id
  const [analysisCache, setAnalysisCache] = useState<Map<string, AnalysisResult>>(new Map())
  // Currently selected profile ID
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)

  // Computed current profile label for dropdown button text
  const currentProfileLabel = useMemo(() => {
    if (!currentProfileId) return null
    const profile = profiles.find(p => p.id === currentProfileId)
    return profile?.label ?? null
  }, [currentProfileId, profiles])

  // Computed current profile intent for subtitle display
  const currentProfileIntent = useMemo(() => {
    if (!currentProfileId) return null
    const profile = profiles.find(p => p.id === currentProfileId)
    return profile?.intent ?? null
  }, [currentProfileId, profiles])

  // Polling interval ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Clear polling interval
   */
  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  /**
   * Poll for analysis completion
   */
  const pollAnalysis = useCallback(async (id: string) => {
    try {
      const { data: result } = await getAnalysis(id)

      if (result.status === 'completed') {
        clearPolling()
        setIsPolling(false)
        setIsLoading(false)

        // Add to cache by profile_id
        if (result.profile_id) {
          setAnalysisCache(prev => new Map(prev).set(result.profile_id, result))
        }

        const parsed = parseAnalysisResult(result.result)
        if (parsed) {
          setData(parsed)
        } else {
          setError('Analysis completed but returned no usable data')
        }
      } else if (result.status === 'failed') {
        clearPolling()
        setIsPolling(false)
        setIsLoading(false)
        setError(result.error_message || 'Analysis failed')
        toast.error('Analysis failed')
      }
      // If still pending/processing, keep polling
    } catch (err) {
      clearPolling()
      setIsPolling(false)
      setIsLoading(false)

      let errorMessage = 'Failed to fetch analysis results'
      if (err instanceof ApiError) {
        if (err.status === 404) {
          errorMessage = 'Analysis not found'
        } else if (err.message) {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
      toast.error(errorMessage)
    }
  }, [clearPolling])

  /**
   * Start polling for analysis results
   */
  const startPolling = useCallback((id: string) => {
    setIsPolling(true)
    // Poll immediately
    pollAnalysis(id)
    // Then poll every 2 seconds
    pollIntervalRef.current = setInterval(() => pollAnalysis(id), 2000)
  }, [pollAnalysis])

  /**
   * Trigger analysis (always triggers new LLM call)
   */
  const analyze = useCallback(async (profileId?: string) => {
    const profile = profileId ?? defaultProfileId
    if (!cleanupId) {
      setError('No cleanup ID available')
      return
    }

    setIsLoading(true)
    setError(null)
    setCurrentProfileId(profile)

    try {
      const { data: job } = await triggerAnalysis(cleanupId, profile)
      setAnalysisId(job.id)

      // Start polling for results
      startPolling(job.id)
    } catch (err) {
      setIsLoading(false)

      let errorMessage = 'Failed to trigger analysis'
      if (err instanceof ApiError) {
        if (err.status === 404) {
          errorMessage = 'Cleaned entry not found'
        } else if (err.status === 429) {
          errorMessage = 'Too many requests. Please try again later.'
        } else if (err.message) {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
      toast.error(errorMessage)
    }
  }, [cleanupId, defaultProfileId, startPolling])

  /**
   * Initialize from analyses list (called when loading entry)
   * Note: List endpoint doesn't include `result`, so we fetch individually if needed
   * Prioritizes the API default profile, then falls back to first analysis
   */
  const populateCache = useCallback((analyses: AnalysisResult[]) => {
    // Clear cache - list doesn't have results, cache only stores individual fetches
    setAnalysisCache(new Map())

    if (analyses.length === 0) return

    // Prioritize API default profile, fall back to first (most recent) analysis
    const defaultAnalysis = analyses.find(a => a.profile_id === defaultProfileId) || analyses[0]

    setCurrentProfileId(defaultAnalysis.profile_id)
    setAnalysisId(defaultAnalysis.id)

    // If completed, fetch individual analysis to get the result
    if (defaultAnalysis.status === 'completed') {
      setIsLoading(true)
      getAnalysis(defaultAnalysis.id).then(({ data: fullAnalysis }) => {
        // Add to cache
        if (fullAnalysis.profile_id) {
          setAnalysisCache(prev => new Map(prev).set(fullAnalysis.profile_id, fullAnalysis))
        }
        const parsed = parseAnalysisResult(fullAnalysis.result)
        if (parsed) {
          setData(parsed)
          setError(null)
        }
        setIsLoading(false)
      }).catch(err => {
        console.error('Failed to fetch analysis:', err)
        setIsLoading(false)
      })
    } else if (defaultAnalysis.status === 'pending' || defaultAnalysis.status === 'processing') {
      // Still processing - start polling
      startPolling(defaultAnalysis.id)
    }
  }, [defaultProfileId, startPolling])

  /**
   * Select a profile - checks cache, then API, then triggers LLM if needed
   */
  const selectProfile = useCallback(async (profileId: string) => {
    // 1. Check memory cache first (cache has full results from individual fetches)
    const cached = analysisCache.get(profileId)
    if (cached && cached.status === 'completed') {
      setCurrentProfileId(profileId)
      setAnalysisId(cached.id)
      const parsed = parseAnalysisResult(cached.result)
      if (parsed) {
        setData(parsed)
        setError(null)
      }
      return
    }

    // 2. Cache miss - fetch analyses list to check if analysis EXISTS for this profile
    if (cleanupId) {
      setIsLoading(true)
      try {
        const { data: analyses } = await getAnalyses(cleanupId)

        // Check if analysis exists for the requested profile
        const existing = analyses.find(a => a.profile_id === profileId)

        if (existing?.status === 'completed') {
          // Found completed analysis - fetch individual to get full result (no LLM call!)
          setCurrentProfileId(profileId)
          setAnalysisId(existing.id)

          const { data: fullAnalysis } = await getAnalysis(existing.id)

          // Add to cache
          if (fullAnalysis.profile_id) {
            setAnalysisCache(prev => new Map(prev).set(fullAnalysis.profile_id, fullAnalysis))
          }

          const parsed = parseAnalysisResult(fullAnalysis.result)
          if (parsed) {
            setData(parsed)
            setError(null)
          }
          setIsLoading(false)
          return
        }

        if (existing?.status === 'pending' || existing?.status === 'processing') {
          // Analysis in progress - poll it
          setCurrentProfileId(profileId)
          setAnalysisId(existing.id)
          startPolling(existing.id)
          return
        }
      } catch (err) {
        console.error('Failed to fetch analyses:', err)
      }
      setIsLoading(false)
    }

    // 3. Not found in API - trigger new LLM analysis
    setCurrentProfileId(profileId)
    await analyze(profileId)
  }, [analysisCache, cleanupId, analyze, startPolling])

  /**
   * Load available profiles
   */
  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true)
    try {
      const { data: profileList, defaultProfileId: apiDefault } = await getAnalysisProfiles()
      setProfiles(profileList)
      // Use API default unless overridden in options
      if (!defaultProfileOverride) {
        setDefaultProfileId(apiDefault)
      }
    } catch (err) {
      console.error('Failed to load analysis profiles:', err)
      // Don't show error toast for profile loading - not critical
    } finally {
      setIsLoadingProfiles(false)
    }
  }, [defaultProfileOverride])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setData(null)
    setIsLoading(false)
    setIsPolling(false)
    setError(null)
    setAnalysisId(null)
    setAnalysisCache(new Map())
    setCurrentProfileId(null)
    clearPolling()
  }, [clearPolling])

  // Track previous analysisId to detect changes
  const prevAnalysisIdRef = useRef<string | null | undefined>(undefined)

  /**
   * Auto-fetch existing analysis when analysisId is provided or changes
   * (Backend already triggered analysis during transcribe, we just poll for results)
   */
  useEffect(() => {
    // Detect if analysisId changed (including from null to a value or from one value to another)
    const analysisIdChanged = prevAnalysisIdRef.current !== initialAnalysisId
    prevAnalysisIdRef.current = initialAnalysisId

    if (analysisIdChanged) {
      // Reset state when switching to a new analysis
      clearPolling()
      setData(null)
      setError(null)
      setIsPolling(false)

      if (initialAnalysisId) {
        // Start polling for the new analysis
        setAnalysisId(initialAnalysisId)
        setIsLoading(true)
        startPolling(initialAnalysisId)
      } else {
        // No analysis ID - just reset
        setAnalysisId(null)
        setIsLoading(false)
      }
    }
  }, [initialAnalysisId, startPolling, clearPolling])

  /**
   * Cleanup polling on unmount
   */
  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [clearPolling])

  return {
    data,
    isLoading,
    isPolling,
    error,
    profiles,
    isLoadingProfiles,
    analysisId,
    currentProfileId,
    currentProfileLabel,
    currentProfileIntent,
    selectProfile,
    analyze,
    loadProfiles,
    populateCache,
    reset,
  }
}
