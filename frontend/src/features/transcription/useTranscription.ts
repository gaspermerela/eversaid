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
  TranscriptionWord,
  EditWord,
  EditedData,
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
  getDemoEntry,
  getDemoAudioUrl,
} from "./api"
import { addEntryId, cacheEntry } from "@/lib/storage"
import {
  getDemoEdits,
  saveDemoEdit,
  saveDemoEdits,
  clearDemoSegmentEdit,
} from "@/lib/demo-storage"

/**
 * Mock segments data for development and testing
 * Note: speaker is 0-based index (0 = "Speaker 1", 1 = "Speaker 2")
 */
const MOCK_SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    speaker: 0,
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
    speaker: 1,
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
    speaker: 0,
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
    speaker: 1,
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
    speaker: 0,
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
    speaker: 1,
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
    speaker: 0,
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
    speaker: 1,
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
  /** Warning when cleaned_segments is missing but diarization detected multiple speakers */
  cleanedSegmentsWarning: string | null
  /** Dismiss the cleaned segments warning */
  dismissCleanedSegmentsWarning: () => void

  // Segment mutations
  /**
   * Update the cleaned text of a segment
   * @param segmentId - ID of the segment to update
   * @param text - New cleaned text
   */
  updateSegmentCleanedText: (segmentId: string, text: string) => Promise<void>

  /**
   * Update multiple segments at once (for text move feature)
   * @param updates - Map of segmentId to new text
   */
  updateMultipleSegments: (updates: Map<string, string>) => Promise<void>

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
  undoRevert: (segmentId: string, originalCleanedText: string) => Promise<void>

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
   * Load an existing entry by ID.
   *
   * Handles both real entries and demo entries:
   * - Real entries (UUID format): Fetched from /api/entries/{id}
   * - Demo entries ("demo-{locale}"): Fetched from /api/demo/entry
   *
   * Demo entries use the same EntryDetails format as real entries,
   * allowing a unified code path. The difference is in edit storage:
   * - Real entries: Edits saved to Core API
   * - Demo entries: Edits saved to localStorage
   *
   * @param entryId - ID of the entry to load (e.g., "abc-123" or "demo-en")
   */
  loadEntry: (entryId: string) => Promise<void>

  /**
   * Whether current entry is a demo (not stored in Core API).
   * Demo entries have different edit behavior (localStorage instead of API).
   */
  isDemo: boolean

  /**
   * Locale of the current demo entry (null if not a demo).
   * Used for keying localStorage edits.
   */
  demoLocale: string | null

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
 *
 * @param rawSegments - Array of segments from API
 * @param cleanedSegments - Array of cleaned segments
 * @param flatWords - Flat array of all words with timing info (optional)
 */
function transformApiSegments(
  rawSegments: ApiSegment[],
  cleanedSegments: CleanedSegment[],
  flatWords?: TranscriptionWord[]
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

    // Filter words that fall within this segment's time range
    let segmentWords: TranscriptionWord[] | undefined = undefined
    if (flatWords && flatWords.length > 0) {
      segmentWords = flatWords.filter(word =>
        word.start >= rawSeg.start && word.end <= rawSeg.end
      )
    }

    return {
      id: rawSeg.id || `seg-${index}`,
      speaker: rawSeg.speaker ?? 0,
      time: timeStr,
      rawText: rawSeg.text,
      cleanedText: cleanedSeg?.text || rawSeg.text,
      originalRawText: rawSeg.text, // Store immutable original raw text
      words: segmentWords, // Word-level timing for playback highlighting
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
  const [cleanedSegmentsWarning, setCleanedSegmentsWarning] = useState<string | null>(null)

  // Demo entry state
  // Demo entries are NOT stored in Core API - they use static files and localStorage for edits
  const [isDemo, setIsDemo] = useState<boolean>(false)
  const [demoLocale, setDemoLocale] = useState<string | null>(null)
  const [demoAudioUrl, setDemoAudioUrl] = useState<string | null>(null)

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
   * Convert segments to EditWord array for API (words-first format)
   */
  const segmentsToEditWords = useCallback(
    (segs: SegmentWithTime[]): EditWord[] => {
      return segs.map((seg, index) => ({
        id: index,
        text: seg.cleanedText,
        start: seg.startTime,
        end: seg.endTime,
        speaker_id: seg.speaker ?? null,
        type: "segment_text" as const,
      }))
    },
    []
  )

  /**
   * Update the cleaned text of a segment (calls API in non-mock mode)
   * Sends ALL segments to API on every save (words-first format)
   *
   * For demo entries: Saves to localStorage instead of API (instant, no rate limit).
   * @see lib/demo-storage.ts for why demo entries use localStorage
   */
  const updateSegmentCleanedText = useCallback(
    async (segmentId: string, text: string) => {
      // Build updated segments array with the edit applied
      const updatedSegments = segmentsWithTime.map((seg) =>
        seg.id === segmentId ? { ...seg, cleanedText: text } : seg
      )

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

      // Demo entries: Save to localStorage instead of API
      if (isDemo && demoLocale) {
        saveDemoEdit(demoLocale, segmentId, text)
        return
      }

      // Call API in non-mock mode - send ALL segments
      if (!mockMode && cleanupId) {
        try {
          const editedData: EditedData = {
            words: segmentsToEditWords(updatedSegments),
          }
          const { data } = await saveUserEdit(cleanupId, editedData)

          // Reconcile with API response if available
          if (data.cleanup_data_edited) {
            setSegments((prev) =>
              prev.map((seg, index) => {
                const apiSegment = data.cleanup_data_edited?.[index]
                if (apiSegment && apiSegment.text !== null) {
                  return { ...seg, cleanedText: apiSegment.text }
                }
                return seg
              })
            )
          }
        } catch (err) {
          // Log error but don't revert - local state is source of truth for edits
          console.error("Failed to save edit to server:", err)
        }
      }
    },
    [mockMode, cleanupId, segmentsWithTime, segmentsToEditWords, isDemo, demoLocale]
  )

  /**
   * Revert a segment's cleaned text back to raw text
   * Returns the original cleaned text for potential undo
   * Now uses PUT endpoint to save all segments (preserves other edits)
   *
   * For demo entries: Clears the localStorage edit for this segment.
   * The original cleaned text will be restored from static JSON on next load.
   */
  const revertSegmentToRaw = useCallback(
    async (segmentId: string): Promise<string | undefined> => {
      const segment = segmentsWithTime.find((s) => s.id === segmentId)
      if (!segment) return undefined

      const originalCleanedText = segment.cleanedText

      // Build updated segments with this one reverted to raw
      const updatedSegments = segmentsWithTime.map((seg) =>
        seg.id === segmentId ? { ...seg, cleanedText: seg.rawText } : seg
      )

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

      // Demo entries: Clear localStorage edit, save raw text as the new edit
      if (isDemo && demoLocale) {
        // For revert, we save the raw text as the new cleaned text
        // This persists the "reverted" state across page reloads
        saveDemoEdit(demoLocale, segmentId, segment.rawText)
        return originalCleanedText
      }

      // Call API in non-mock mode - save ALL segments
      if (!mockMode && cleanupId) {
        try {
          const editedData: EditedData = {
            words: segmentsToEditWords(updatedSegments),
          }
          await saveUserEdit(cleanupId, editedData)
        } catch (err) {
          console.error("Failed to revert on server:", err)
        }
      }

      return originalCleanedText
    },
    [segmentsWithTime, mockMode, cleanupId, segmentsToEditWords, isDemo, demoLocale]
  )

  /**
   * Undo a revert by restoring the original cleaned text
   * Now also saves to API
   *
   * For demo entries: Saves to localStorage.
   */
  const undoRevert = useCallback(
    async (segmentId: string, originalCleanedText: string) => {
      // Build updated segments with this one restored
      const updatedSegments = segmentsWithTime.map((seg) =>
        seg.id === segmentId ? { ...seg, cleanedText: originalCleanedText } : seg
      )

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

      // Demo entries: Save to localStorage
      if (isDemo && demoLocale) {
        saveDemoEdit(demoLocale, segmentId, originalCleanedText)
        return
      }

      // Call API in non-mock mode - save ALL segments
      if (!mockMode && cleanupId) {
        try {
          const editedData: EditedData = {
            words: segmentsToEditWords(updatedSegments),
          }
          await saveUserEdit(cleanupId, editedData)
        } catch (err) {
          console.error("Failed to save undo on server:", err)
        }
      }
    },
    [segmentsWithTime, mockMode, cleanupId, segmentsToEditWords, isDemo, demoLocale]
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
   * Update multiple segments at once (for text move feature)
   * Accepts a Map of segmentId -> newText and saves all with single API call
   *
   * For demo entries: Saves to localStorage.
   */
  const updateMultipleSegments = useCallback(
    async (updates: Map<string, string>) => {
      // Build updated segments array with all edits applied
      const updatedSegments = segmentsWithTime.map((seg) => {
        const newText = updates.get(seg.id)
        return newText !== undefined ? { ...seg, cleanedText: newText } : seg
      })

      // Update local state immediately for responsiveness
      setSegments((prev) =>
        prev.map((seg) => {
          const newText = updates.get(seg.id)
          return newText !== undefined ? { ...seg, cleanedText: newText } : seg
        })
      )

      // Clear reverted status for all updated segments
      setRevertedSegments((prev) => {
        const newMap = new Map(prev)
        for (const segmentId of updates.keys()) {
          newMap.delete(segmentId)
        }
        return newMap
      })

      // Demo entries: Save all edits to localStorage
      if (isDemo && demoLocale) {
        saveDemoEdits(demoLocale, updates)
        return
      }

      // Call API in non-mock mode - send ALL segments
      if (!mockMode && cleanupId) {
        try {
          const editedData: EditedData = {
            words: segmentsToEditWords(updatedSegments),
          }
          await saveUserEdit(cleanupId, editedData)
        } catch (err) {
          console.error("Failed to save multiple segments to server:", err)
        }
      }
    },
    [mockMode, cleanupId, segmentsWithTime, segmentsToEditWords, isDemo, demoLocale]
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
                // Transform and set segments - prefer user-edited version if available
                const rawSegments = transcriptionStatus.segments || []
                const cleanedSegments = cleanedEntry.cleanup_data_edited || cleanedEntry.cleaned_segments || []
                const flatWords = transcriptionStatus.words || []
                let transformedSegments = transformApiSegments(
                  rawSegments,
                  cleanedSegments,
                  flatWords
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

                // Check for missing cleaned_segments when diarization detected multiple speakers
                // Don't show warning if user has edited data
                const uniqueSpeakers = new Set(rawSegments.map(s => s.speaker ?? 0))
                const hasMultipleSpeakers = uniqueSpeakers.size > 1
                const hasUserEdits = !!cleanedEntry.cleanup_data_edited && cleanedEntry.cleanup_data_edited.length > 0
                const cleanedSegmentsMissing = !cleanedEntry.cleaned_segments || cleanedEntry.cleaned_segments.length === 0

                if (hasMultipleSpeakers && cleanedSegmentsMissing && !hasUserEdits) {
                  setCleanedSegmentsWarning(
                    "Per-segment cleanup unavailable. Showing original text."
                  )
                } else {
                  setCleanedSegmentsWarning(null)
                }

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
   * Load an existing entry by ID.
   *
   * Handles both real entries and demo entries:
   * - Real entries (UUID format): Fetched from /api/entries/{id}
   * - Demo entries ("demo-{locale}"): Fetched from /api/demo/entry
   *
   * Both return the same EntryDetails format, allowing unified transformation.
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

      // Detect demo entry by ID pattern
      const isDemoEntry = entryIdToLoad.startsWith("demo-")
      const locale = isDemoEntry ? entryIdToLoad.replace("demo-", "") : null

      try {
        // Fetch entry - same format for both real and demo
        console.log("[loadEntry] Fetching entry details...", isDemoEntry ? "(demo)" : "(real)")
        const { data: entryDetails } = isDemoEntry
          ? await getDemoEntry(locale!)
          : await getEntry(entryIdToLoad)

        if (!entryDetails) {
          throw new Error("Entry not found")
        }
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

        // Transform segments - prefer user-edited version if available
        const rawSegments = transcription.segments || []
        const cleanedSegments = cleanupData.cleanup_data_edited || cleanupData.cleaned_segments || []
        const flatWords = transcription.words || []
        console.log("[loadEntry] Raw segments count:", rawSegments.length)
        console.log("[loadEntry] Cleaned segments count:", cleanedSegments.length)
        console.log("[loadEntry] Using user-edited data:", !!cleanupData.cleanup_data_edited)
        console.log("[loadEntry] Flat words count:", flatWords.length)
        let transformedSegments = transformApiSegments(
          rawSegments,
          cleanedSegments,
          flatWords
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

        // For demo entries: Merge localStorage edits with static data
        // This ensures edits persist across page reloads
        if (isDemoEntry && locale) {
          const storedEdits = getDemoEdits(locale)
          if (storedEdits && Object.keys(storedEdits.segments).length > 0) {
            console.log("[loadEntry] Merging localStorage edits:", Object.keys(storedEdits.segments).length)
            transformedSegments = transformedSegments.map((seg) => {
              const edit = storedEdits.segments[seg.id]
              if (edit) {
                return { ...seg, cleanedText: edit.cleanedText }
              }
              return seg
            })
          }
        }

        setSegments(transformedSegments)

        // Check for missing cleaned_segments when diarization detected multiple speakers
        // Don't show warning if user has edited data
        const uniqueSpeakers = new Set(rawSegments.map(s => s.speaker ?? 0))
        const hasMultipleSpeakers = uniqueSpeakers.size > 1
        const hasUserEdits = !!cleanupData.cleanup_data_edited && cleanupData.cleanup_data_edited.length > 0
        const originalCleanedMissing = !cleanupData.cleaned_segments || cleanupData.cleaned_segments.length === 0

        if (hasMultipleSpeakers && originalCleanedMissing && !hasUserEdits) {
          setCleanedSegmentsWarning(
            "Per-segment cleanup unavailable. Showing original text."
          )
        } else {
          setCleanedSegmentsWarning(null)
        }

        setEntryId(entryIdToLoad)
        // Demo entries don't have cleanup IDs (edits go to localStorage)
        setCleanupId(isDemoEntry ? null : cleanupData.id)
        // Set all analyses for client-side caching by profile
        const allAnalyses = entryDetails.analyses || []
        setAnalyses(allAnalyses)
        // Set analysis ID from first (latest) analysis if available
        const latestAnalysisId = allAnalyses.length > 0 ? allAnalyses[0].id : null
        setAnalysisId(latestAnalysisId)
        console.log("[loadEntry] Loaded analyses count:", allAnalyses.length, "Latest ID:", latestAnalysisId)
        // Set duration from API response (used as fallback when audio element can't determine duration)
        setDurationSeconds(entryDetails.duration_seconds || 0)

        // Set demo state
        setIsDemo(isDemoEntry)
        setDemoLocale(locale)
        setDemoAudioUrl(isDemoEntry && locale ? getDemoAudioUrl(locale) : null)

        setStatus("complete")
        console.log("[loadEntry] Entry loaded successfully", isDemoEntry ? "(demo)" : "(real)")
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
    setCleanedSegmentsWarning(null)
    // Reset demo state
    setIsDemo(false)
    setDemoLocale(null)
    setDemoAudioUrl(null)
  }, [initialSegments, mockMode])

  /**
   * Dismiss the cleaned segments warning
   */
  const dismissCleanedSegmentsWarning = useCallback(() => {
    setCleanedSegmentsWarning(null)
  }, [])

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
    cleanedSegmentsWarning,
    dismissCleanedSegmentsWarning,
    updateSegmentCleanedText,
    updateMultipleSegments,
    revertSegmentToRaw,
    undoRevert,
    isSegmentReverted,
    uploadAudio,
    loadEntry,
    isDemo,
    demoLocale,
    getSegmentById,
    getSegmentAtTime,
    reset,
    fetchRateLimits,
  }
}

// Re-export types
export type { SegmentWithTime, ProcessingStatus } from "./types"
