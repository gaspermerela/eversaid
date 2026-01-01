import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { getAnalysis, triggerAnalysis, getAnalysisProfiles } from './api'
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
  /** Trigger analysis with a specific profile */
  analyze: (profileId?: string) => Promise<void>
  /** Load profiles */
  loadProfiles: () => Promise<void>
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
  const { cleanupId, analysisId: initialAnalysisId, defaultProfile = 'generic-summary' } = options

  const [data, setData] = useState<ParsedAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<AnalysisProfile[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)

  // Polling interval ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasAutoTriggeredRef = useRef(false)

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
   * Trigger analysis
   */
  const analyze = useCallback(async (profileId: string = defaultProfile) => {
    if (!cleanupId) {
      setError('No cleanup ID available')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data: job } = await triggerAnalysis(cleanupId, profileId)
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
  }, [cleanupId, defaultProfile, startPolling])

  /**
   * Load available profiles
   */
  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true)
    try {
      const { data: profileList } = await getAnalysisProfiles()
      setProfiles(profileList)
    } catch (err) {
      console.error('Failed to load analysis profiles:', err)
      // Don't show error toast for profile loading - not critical
    } finally {
      setIsLoadingProfiles(false)
    }
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setData(null)
    setIsLoading(false)
    setIsPolling(false)
    setError(null)
    setAnalysisId(null)
    clearPolling()
    hasAutoTriggeredRef.current = false
  }, [clearPolling])

  /**
   * Auto-fetch existing analysis when analysisId is provided
   * (Backend already triggered analysis during transcribe, we just poll for results)
   */
  useEffect(() => {
    if (initialAnalysisId && !hasAutoTriggeredRef.current && !isLoading && !data) {
      hasAutoTriggeredRef.current = true
      setAnalysisId(initialAnalysisId)
      setIsLoading(true)
      startPolling(initialAnalysisId)
    }
  }, [initialAnalysisId, isLoading, data, startPolling])

  /**
   * Cleanup polling on unmount
   */
  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [clearPolling])

  /**
   * Reset when cleanup ID or analysis ID changes
   */
  useEffect(() => {
    if (cleanupId !== null || initialAnalysisId !== null) {
      reset()
    }
  }, [cleanupId, initialAnalysisId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading,
    isPolling,
    error,
    profiles,
    isLoadingProfiles,
    analysisId,
    analyze,
    loadProfiles,
    reset,
  }
}
