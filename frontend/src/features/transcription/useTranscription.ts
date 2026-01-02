/**
 * useTranscription - Transcription state management hook
 *
 * Manages segment data, provides mutation functions (edit/revert),
 * and integrates with the backend API for real transcription.
 */

import { useState, useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import type { Segment } from "@/components/demo/types"
import type {
  SegmentWithTime,
  ProcessingStatus,
  ApiSegment,
  CleanedSegment,
  RateLimitInfo,
  AnalysisResult,
} from "./types"
import { ApiError } from "./types"
import { parseAllSegmentTimes, findSegmentAtTime } from "@/lib/time-utils"
import {
  uploadAndTranscribe,
  getTranscriptionStatus,
  getCleanedEntry,
  getEntry,
  saveUserEdit,
  revertUserEdit,
  getRateLimits,
} from "./api"
import { addEntryId, cacheEntry } from "@/lib/storage"

/**
 * Mock segments data for development and testing
 */
const MOCK_SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    speaker: 1,
    time: "0:00 – 0:18",
    rawText:
      "Uh so basically what we're trying to do here is um figure out the best approach for the the project timeline and um you know make sure everyone's on the same page.",
    cleanedText:
      "So basically what we're trying to do here is figure out the best approach for the project timeline, ensuring everyone's on the same page.",
    originalRawText:
      "Uh so basically what we're trying to do here is um figure out the best approach for the the project timeline and um you know make sure everyone's on the same page.",
  },
  {
    id: "seg-2",
    speaker: 2,
    time: "0:19 – 0:42",
    rawText:
      "Yeah I think we should we should probably start with the the research phase first you know and then move on to to the design work after we have all the the data we need.",
    cleanedText:
      "Yes, I think we should probably start with the research phase first and then move on to the design work after we have all the data we need.",
    originalRawText:
      "Yeah I think we should we should probably start with the the research phase first you know and then move on to to the design work after we have all the the data we need.",
  },
  {
    id: "seg-3",
    speaker: 1,
    time: "0:43 – 1:05",
    rawText:
      "That makes sense um and I was thinking maybe we could also like bring in some external consultants to help with the the technical aspects of the project.",
    cleanedText:
      "That makes sense, and I was thinking maybe we could bring in some external consultants to help with the technical aspects of the project.",
    originalRawText:
      "That makes sense um and I was thinking maybe we could also like bring in some external consultants to help with the the technical aspects of the project.",
  },
  {
    id: "seg-4",
    speaker: 2,
    time: "1:06 – 1:28",
    rawText:
      "Sure that's a good idea I mean we we definitely need some expertise in in the machine learning side of things especially for the the data processing pipeline.",
    cleanedText:
      "Sure, that's a good idea. We definitely need some expertise in the machine learning side of things, especially for the data processing pipeline.",
    originalRawText:
      "Sure that's a good idea I mean we we definitely need some expertise in in the machine learning side of things especially for the the data processing pipeline.",
  },
  {
    id: "seg-5",
    speaker: 1,
    time: "1:29 – 1:55",
    rawText:
      "Right right and um what about the the budget like do we have enough um resources allocated for for bringing in outside help or should we should we look at maybe reallocating from other areas?",
    cleanedText:
      "Right, and what about the budget? Do we have enough resources allocated for bringing in outside help, or should we look at reallocating from other areas?",
    originalRawText:
      "Right right and um what about the the budget like do we have enough um resources allocated for for bringing in outside help or should we should we look at maybe reallocating from other areas?",
  },
  {
    id: "seg-6",
    speaker: 2,
    time: "1:56 – 2:24",
    rawText:
      "Well I I think we have some some flexibility there um the Q3 budget had a a contingency fund set aside so so we could tap into that if if needed you know what I mean.",
    cleanedText:
      "Well, I think we have some flexibility there. The Q3 budget had a contingency fund set aside, so we could tap into that if needed.",
    originalRawText:
      "Well I I think we have some some flexibility there um the Q3 budget had a a contingency fund set aside so so we could tap into that if if needed you know what I mean.",
  },
  {
    id: "seg-7",
    speaker: 1,
    time: "2:25 – 2:58",
    rawText:
      "Perfect that's that's great to hear um so let's let's plan to to have like a follow-up meeting next week to to finalize the the consultant requirements and um get the ball rolling on that.",
    cleanedText:
      "Perfect, that's great to hear. Let's plan to have a follow-up meeting next week to finalize the consultant requirements and get the ball rolling on that.",
    originalRawText:
      "Perfect that's that's great to hear um so let's let's plan to to have like a follow-up meeting next week to to finalize the the consultant requirements and um get the ball rolling on that.",
  },
  {
    id: "seg-8",
    speaker: 2,
    time: "2:59 – 3:28",
    rawText:
      "Sounds good I'll I'll send out a a calendar invite for for Thursday afternoon if if that works for everyone and uh we can we can also invite Sarah from from procurement to to help with the the vendor selection process.",
    cleanedText:
      "Sounds good. I'll send out a calendar invite for Thursday afternoon if that works for everyone. We can also invite Sarah from procurement to help with the vendor selection process.",
    originalRawText:
      "Sounds good I'll I'll send out a a calendar invite for for Thursday afternoon if if that works for everyone and uh we can we can also invite Sarah from from procurement to to help with the the vendor selection process.",
  },
]

// Polling interval for transcription status (2 seconds)
const POLL_INTERVAL_MS = 2000

export interface UseTranscriptionOptions {
  /** Use mock data instead of API (default: false) */
  mockMode?: boolean
  /** Initial segments (optional, overrides mock data) */
  initialSegments?: Segment[]
}

export interface UseTranscriptionReturn {
  // State
  /** Array of segments with parsed start/end times */
  segments: SegmentWithTime[]
  /** Current processing status */
  status: ProcessingStatus
  /** Error message if status is 'error' */
  error: string | null
  /** Upload progress (0-100) */
  uploadProgress: number
  /** Current entry ID */
  entryId: string | null
  /** Current cleanup ID (needed for editing) */
  cleanupId: string | null
  /** Current analysis ID (for polling analysis results) */
  analysisId: string | null
  /** All analyses for this entry (for client-side caching by profile) */
  analyses: AnalysisResult[]
  /** Current rate limit info */
  rateLimits: RateLimitInfo | null
  /** Audio duration in seconds (from API, used as fallback for audio player) */
  durationSeconds: number

  // Segment mutations
  /**
   * Update the cleaned text of a segment
   * @param segmentId - ID of the segment to update
   * @param text - New cleaned text
   */
  updateSegmentCleanedText: (segmentId: string, text: string) => Promise<void>

  /**
   * Revert a segment's cleaned text back to raw text
   * @param segmentId - ID of the segment to revert
   * @returns The original cleaned text (for undo functionality)
   */
  revertSegmentToRaw: (segmentId: string) => Promise<string | undefined>

  /**
   * Undo a revert by restoring the original cleaned text
   * @param segmentId - ID of the segment
   * @param originalCleanedText - The cleaned text to restore
   */
  undoRevert: (segmentId: string, originalCleanedText: string) => void

  /**
   * Check if a segment has been reverted
   * @param segmentId - ID of the segment to check
   */
  isSegmentReverted: (segmentId: string) => boolean

  // Upload
  /**
   * Upload audio and start transcription
   * @param file - Audio file to upload
   * @param speakerCount - Number of speakers
   */
  uploadAudio: (file: File, speakerCount: number) => Promise<void>

  /**
   * Load an existing entry by ID
   * @param entryId - ID of the entry to load
   */
  loadEntry: (entryId: string) => Promise<void>

  // Utilities
  /**
   * Get a segment by ID
   */
  getSegmentById: (id: string) => SegmentWithTime | undefined

  /**
   * Get the segment at a specific time
   */
  getSegmentAtTime: (timeSeconds: number) => SegmentWithTime | undefined

  /**
   * Reset to initial state
   */
  reset: () => void

  /**
   * Fetch current rate limits from API
   * Call on page mount to display initial rate limit info
   */
  fetchRateLimits: () => Promise<void>
}

/**
 * Format seconds to "M:SS" or "H:MM:SS" format
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Transform API segments to frontend Segment format
 */
function transformApiSegments(
  rawSegments: ApiSegment[],
  cleanedSegments: CleanedSegment[]
): Segment[] {
  // Create a map of cleaned segments by their raw_segment_id or index
  const cleanedMap = new Map<string, CleanedSegment>()
  cleanedSegments.forEach((seg, index) => {
    // Use raw_segment_id if available, otherwise use the segment's own id
    const key = seg.raw_segment_id || seg.id || `idx-${index}`
    cleanedMap.set(key, seg)
  })

  return rawSegments.map((rawSeg, index) => {
    // Find matching cleaned segment
    const cleanedSeg =
      cleanedMap.get(rawSeg.id) ||
      cleanedMap.get(`idx-${index}`) ||
      cleanedSegments[index]

    const timeStr = `${formatTime(rawSeg.start)} – ${formatTime(rawSeg.end)}`

    return {
      id: rawSeg.id || `seg-${index}`,
      speaker: rawSeg.speaker_id ?? 0,
      time: timeStr,
      rawText: rawSeg.text,
      cleanedText: cleanedSeg?.text || rawSeg.text,
      originalRawText: rawSeg.text, // Store immutable original raw text
    }
  })
}

/**
 * Hook for managing transcription state
 *
 * @param options - Configuration options
 * @returns Object with state, mutations, and utilities
 *
 * @example
 * ```tsx
 * const {
 *   segments,
 *   status,
 *   updateSegmentCleanedText,
 *   revertSegmentToRaw
 * } = useTranscription({ mockMode: false })
 *
 * // Upload audio
 * await uploadAudio(file, 2)
 *
 * // Update a segment
 * await updateSegmentCleanedText('seg-1', 'Updated text here')
 * ```
 */
export function useTranscription(
  options: UseTranscriptionOptions = {}
): UseTranscriptionReturn {
  const { mockMode = false, initialSegments } = options

  // Base segments state
  const [segments, setSegments] = useState<Segment[]>(
    initialSegments || (mockMode ? MOCK_SEGMENTS : [])
  )

  // Processing state
  const [status, setStatus] = useState<ProcessingStatus>(
    segments.length > 0 ? "complete" : "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [entryId, setEntryId] = useState<string | null>(
    segments.length > 0 ? "mock-entry-1" : null
  )
  const [cleanupId, setCleanupId] = useState<string | null>(
    mockMode ? "mock-cleanup-1" : null
  )
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [rateLimits, setRateLimits] = useState<RateLimitInfo | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number>(0)

  // Track reverted segments for undo functionality
  const [revertedSegments, setRevertedSegments] = useState<Map<string, string>>(
    new Map()
  )

  // Ref for cleanup on unmount
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Parse time strings into start/end times
  const segmentsWithTime = useMemo(
    () => parseAllSegmentTimes(segments),
    [segments]
  )

  /**
   * Update the cleaned text of a segment (calls API in non-mock mode)
   */
  const updateSegmentCleanedText = useCallback(
    async (segmentId: string, text: string) => {
      // Update local state immediately for responsiveness
      setSegments((prev) =>
        prev.map((seg) =>
          seg.id === segmentId ? { ...seg, cleanedText: text } : seg
        )
      )

      // Clear reverted status if text is being edited
      setRevertedSegments((prev) => {
        const newMap = new Map(prev)
        newMap.delete(segmentId)
        return newMap
      })

      // Call API in non-mock mode
      if (!mockMode && cleanupId) {
        try {
          await saveUserEdit(cleanupId, text)
        } catch (err) {
          // Log error but don't revert - local state is source of truth for edits
          console.error("Failed to save edit to server:", err)
        }
      }
    },
    [mockMode, cleanupId]
  )

  /**
   * Revert a segment's cleaned text back to raw text
   * Returns the original cleaned text for potential undo
   */
  const revertSegmentToRaw = useCallback(
    async (segmentId: string): Promise<string | undefined> => {
      const segment = segments.find((s) => s.id === segmentId)
      if (!segment) return undefined

      const originalCleanedText = segment.cleanedText

      // Save original cleaned text for undo
      setRevertedSegments((prev) =>
        new Map(prev).set(segmentId, originalCleanedText)
      )

      // Set cleaned text to raw text
      setSegments((prev) =>
        prev.map((seg) =>
          seg.id === segmentId ? { ...seg, cleanedText: seg.rawText } : seg
        )
      )

      // Call API in non-mock mode
      if (!mockMode && cleanupId) {
        try {
          await revertUserEdit(cleanupId)
        } catch (err) {
          console.error("Failed to revert on server:", err)
        }
      }

      return originalCleanedText
    },
    [segments, mockMode, cleanupId]
  )

  /**
   * Undo a revert by restoring the original cleaned text
   */
  const undoRevert = useCallback(
    (segmentId: string, originalCleanedText: string) => {
      setSegments((prev) =>
        prev.map((seg) =>
          seg.id === segmentId
            ? { ...seg, cleanedText: originalCleanedText }
            : seg
        )
      )
      setRevertedSegments((prev) => {
        const newMap = new Map(prev)
        newMap.delete(segmentId)
        return newMap
      })
    },
    []
  )

  /**
   * Check if a segment has been reverted
   */
  const isSegmentReverted = useCallback(
    (segmentId: string): boolean => {
      return revertedSegments.has(segmentId)
    },
    [revertedSegments]
  )

  /**
   * Poll for transcription status until complete or failed
   */
  const pollTranscriptionStatus = useCallback(
    async (transcriptionId: string, cleanupIdVal: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const { data: transcriptionStatus } =
              await getTranscriptionStatus(transcriptionId)

            if (transcriptionStatus.status === "completed") {
              // Clear polling
              if (pollingRef.current) {
                clearTimeout(pollingRef.current)
                pollingRef.current = null
              }

              setStatus("cleaning")

              // Fetch cleaned entry
              const { data: cleanedEntry } = await getCleanedEntry(cleanupIdVal)

              if (cleanedEntry.status === "completed") {
                // Transform and set segments
                const rawSegments = transcriptionStatus.segments || []
                let transformedSegments = transformApiSegments(
                  rawSegments,
                  cleanedEntry.cleaned_segments || []
                )

                // Fallback: Create single segment from full text when no diarization
                // This happens with providers like Groq that don't support diarization
                if (transformedSegments.length === 0 && transcriptionStatus.transcribed_text) {
                  transformedSegments = [
                    {
                      id: `fallback-${transcriptionId}`,
                      speaker: 0,
                      time: "",
                      rawText: transcriptionStatus.transcribed_text.trim(),
                      cleanedText: cleanedEntry.cleaned_text?.trim() || transcriptionStatus.transcribed_text.trim(),
                      originalRawText: transcriptionStatus.transcribed_text.trim(),
                    },
                  ]
                }

                setSegments(transformedSegments)
                setStatus("complete")
                resolve()
              } else if (cleanedEntry.status === "failed") {
                setError("Cleanup failed")
                setStatus("error")
                reject(new Error("Cleanup failed"))
              } else {
                // Cleanup still processing, continue polling
                pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS)
              }
            } else if (transcriptionStatus.status === "failed") {
              if (pollingRef.current) {
                clearTimeout(pollingRef.current)
                pollingRef.current = null
              }
              setError(transcriptionStatus.error || "Transcription failed")
              setStatus("error")
              reject(new Error(transcriptionStatus.error || "Transcription failed"))
            } else {
              // Still processing, continue polling
              pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS)
            }
          } catch (err) {
            if (pollingRef.current) {
              clearTimeout(pollingRef.current)
              pollingRef.current = null
            }
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error"
            setError(errorMessage)
            setStatus("error")
            reject(err)
          }
        }

        poll()
      })
    },
    []
  )

  /**
   * Upload audio and start transcription
   */
  const uploadAudio = useCallback(
    async (file: File, speakerCount: number): Promise<void> => {
      // Clean up any existing polling
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
        pollingRef.current = null
      }

      if (mockMode) {
        // Mock mode implementation
        setError(null)
        setStatus("uploading")
        setUploadProgress(0)

        // Simulate upload progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          setUploadProgress(i)
        }

        setStatus("transcribing")
        await new Promise((resolve) => setTimeout(resolve, 500))

        setStatus("cleaning")
        await new Promise((resolve) => setTimeout(resolve, 300))

        setSegments(MOCK_SEGMENTS)
        setEntryId(`mock-entry-${Date.now()}`)
        setCleanupId(`mock-cleanup-${Date.now()}`)
        setStatus("complete")
        setUploadProgress(0)

        console.log(
          `[Mock] Uploaded ${file.name} with ${speakerCount} speakers`
        )
        return
      }

      // Real API implementation
      setError(null)
      setStatus("uploading")
      setUploadProgress(0)

      try {
        // Start upload (progress is simulated for now since fetch doesn't support progress)
        setUploadProgress(50)

        const { data: response } = await uploadAndTranscribe(file, {
          speakerCount,
          enableDiarization: speakerCount > 1,
          enableAnalysis: true,
        })

        setUploadProgress(100)
        setEntryId(response.entry_id)
        setCleanupId(response.cleanup_id)
        setAnalysisId(response.analysis_id ?? null)

        // Cache entry in localStorage
        addEntryId(response.entry_id)
        cacheEntry({
          id: response.entry_id,
          filename: file.name,
          duration: 0, // Will be updated when transcription completes
          createdAt: new Date().toISOString(),
          transcriptionStatus: "processing",
          cleanupStatus: "pending",
        })

        setStatus("transcribing")
        setUploadProgress(0)

        // Poll for completion
        await pollTranscriptionStatus(
          response.transcription_id,
          response.cleanup_id
        )
      } catch (err) {
        if (pollingRef.current) {
          clearTimeout(pollingRef.current)
          pollingRef.current = null
        }

        let errorMessage = "Upload failed. Please try again."

        if (err instanceof ApiError) {
          // Update rate limits if available
          if (err.rateLimitInfo) {
            setRateLimits(err.rateLimitInfo)
          }

          if (err.isRateLimited) {
            errorMessage =
              err.rateLimitError?.message || "Rate limit exceeded. Please try again later."
          } else if (err.isNotFound) {
            errorMessage = "Resource not found."
          } else {
            errorMessage = err.message
          }
        } else if (err instanceof Error) {
          errorMessage = err.message
        }

        setError(errorMessage)
        setStatus("error")
        setUploadProgress(0)
        toast.error(errorMessage)
      }
    },
    [mockMode, pollTranscriptionStatus]
  )

  /**
   * Get a segment by ID
   */
  const getSegmentById = useCallback(
    (id: string): SegmentWithTime | undefined => {
      return segmentsWithTime.find((s) => s.id === id)
    },
    [segmentsWithTime]
  )

  /**
   * Get the segment at a specific time
   */
  const getSegmentAtTime = useCallback(
    (timeSeconds: number): SegmentWithTime | undefined => {
      return findSegmentAtTime(segmentsWithTime, timeSeconds)
    },
    [segmentsWithTime]
  )

  /**
   * Load an existing entry by ID
   *
   * The wrapper backend composes a full response including cleanup data,
   * so we don't need to fetch cleanup separately.
   */
  const loadEntry = useCallback(
    async (entryIdToLoad: string): Promise<void> => {
      console.log("[loadEntry] Starting to load entry:", entryIdToLoad)

      // Clean up any existing polling
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
        pollingRef.current = null
      }

      setError(null)
      setStatus("loading")
      setSegments([])
      setRevertedSegments(new Map())

      try {
        // Wrapper backend returns entry + primary_transcription + cleanup (composed)
        console.log("[loadEntry] Fetching entry details...")
        const { data: entryDetails } = await getEntry(entryIdToLoad)
        console.log("[loadEntry] Entry details received:", entryDetails)

        // Check transcription status
        const transcription = entryDetails.primary_transcription
        console.log("[loadEntry] Transcription data:", transcription)
        if (!transcription) {
          console.log("[loadEntry] No transcription data, setting status to transcribing")
          setEntryId(entryIdToLoad)
          setStatus("transcribing")
          return
        }

        if (transcription.status === "processing" || transcription.status === "pending") {
          console.log("[loadEntry] Transcription still processing:", transcription.status)
          setEntryId(entryIdToLoad)
          setStatus("transcribing")
          return
        }

        if (transcription.status === "failed") {
          throw new Error(transcription.error || "Transcription failed")
        }

        // Check cleanup status (cleanup is composed by wrapper backend)
        const cleanupData = entryDetails.cleanup
        console.log("[loadEntry] Cleanup data:", cleanupData)
        if (!cleanupData) {
          console.log("[loadEntry] No cleanup data, setting status to cleaning")
          setEntryId(entryIdToLoad)
          setStatus("cleaning")
          return
        }

        if (cleanupData.status === "processing" || cleanupData.status === "pending") {
          console.log("[loadEntry] Cleanup still processing:", cleanupData.status)
          setEntryId(entryIdToLoad)
          setCleanupId(cleanupData.id)
          setStatus("cleaning")
          return
        }

        if (cleanupData.status === "failed") {
          throw new Error(cleanupData.error_message || "Cleanup failed")
        }

        // Transform segments
        const rawSegments = transcription.segments || []
        const cleanedSegments = cleanupData.cleaned_segments || []
        console.log("[loadEntry] Raw segments count:", rawSegments.length)
        console.log("[loadEntry] Cleaned segments count:", cleanedSegments.length)
        let transformedSegments = transformApiSegments(
          rawSegments,
          cleanedSegments
        )
        console.log("[loadEntry] Transformed segments:", transformedSegments.length)

        // Fallback: Create single segment from full text when no diarization segments exist
        // This happens with providers like Groq that don't support diarization
        if (transformedSegments.length === 0 && transcription.transcribed_text) {
          console.log("[loadEntry] No segments, creating fallback from full text")
          const duration = entryDetails.duration_seconds || 0
          const timeStr = `${formatTime(0)} – ${formatTime(duration)}`
          transformedSegments = [
            {
              id: `fallback-${entryIdToLoad}`,
              speaker: 0,
              time: timeStr,
              rawText: transcription.transcribed_text.trim(),
              cleanedText: cleanupData.cleaned_text?.trim() || transcription.transcribed_text.trim(),
              originalRawText: transcription.transcribed_text.trim(),
            },
          ]
          console.log("[loadEntry] Created fallback segment")
        }

        setSegments(transformedSegments)
        setEntryId(entryIdToLoad)
        setCleanupId(cleanupData.id)
        // Set all analyses for client-side caching by profile
        const allAnalyses = entryDetails.analyses || []
        setAnalyses(allAnalyses)
        // Set analysis ID from first (latest) analysis if available
        const latestAnalysisId = allAnalyses.length > 0 ? allAnalyses[0].id : null
        setAnalysisId(latestAnalysisId)
        console.log("[loadEntry] Loaded analyses count:", allAnalyses.length, "Latest ID:", latestAnalysisId)
        // Set duration from API response (used as fallback when audio element can't determine duration)
        setDurationSeconds(entryDetails.duration_seconds || 0)
        setStatus("complete")
        console.log("[loadEntry] Entry loaded successfully")
      } catch (err) {
        console.error("[loadEntry] Error loading entry:", err)
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load entry"
        setError(errorMessage)
        setStatus("error")
      }
    },
    []
  )

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    // Clean up polling
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }

    setSegments(initialSegments || (mockMode ? MOCK_SEGMENTS : []))
    setStatus(initialSegments?.length || mockMode ? "complete" : "idle")
    setError(null)
    setUploadProgress(0)
    setEntryId(initialSegments?.length || mockMode ? "mock-entry-1" : null)
    setCleanupId(initialSegments?.length || mockMode ? "mock-cleanup-1" : null)
    setAnalysisId(null)
    setAnalyses([])
    setRateLimits(null)
    setDurationSeconds(0)
    setRevertedSegments(new Map())
  }, [initialSegments, mockMode])

  /**
   * Fetch current rate limits from API
   */
  const fetchRateLimits = useCallback(async (): Promise<void> => {
    if (mockMode) return

    try {
      const limits = await getRateLimits()
      if (limits) {
        setRateLimits(limits)
      }
    } catch (err) {
      // Silently fail - rate limits are not critical
      console.error("Failed to fetch rate limits:", err)
    }
  }, [mockMode])

  return {
    segments: segmentsWithTime,
    status,
    error,
    uploadProgress,
    entryId,
    cleanupId,
    analysisId,
    analyses,
    rateLimits,
    durationSeconds,
    updateSegmentCleanedText,
    revertSegmentToRaw,
    undoRevert,
    isSegmentReverted,
    uploadAudio,
    loadEntry,
    getSegmentById,
    getSegmentAtTime,
    reset,
    fetchRateLimits,
  }
}

// Re-export types
export type { SegmentWithTime, ProcessingStatus } from "./types"
