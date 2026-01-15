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
  CleanedEntry,
  RateLimitInfo,
  AnalysisResult,
  TranscriptionWord,
  EditWord,
  EditedData,
  CleanupType,
} from "./types"
import { ApiError } from "./types"
import { parseAllSegmentTimes, findSegmentAtTime } from "@/lib/time-utils"
import {
  uploadAndTranscribe,
  getTranscriptionStatus,
  getCleanedEntry,
  getEntry,
  saveUserEdit,
  getRateLimits,
  triggerCleanup,
  triggerAnalysis,
} from "./api"
import { addEntryId, cacheEntry } from "@/lib/storage"
import { CLEANUP_ALLOWED_MODELS } from "@/lib/model-config"

// Helper to reconstruct full model ID from provider and model
// API splits "openai/gpt-oss-120b" into llm_provider="openai", llm_model="gpt-oss-120b"
// We need to reconstruct it for dropdown selection
function getFullModelId(llmProvider: string | undefined | null, llmModel: string | undefined | null): string | null {
  if (!llmModel) return null
  // Try provider/model format first (e.g., "openai/gpt-oss-120b")
  if (llmProvider) {
    const withProvider = `${llmProvider}/${llmModel}`
    if (CLEANUP_ALLOWED_MODELS.includes(withProvider)) {
      return withProvider
    }
  }
  // Fall back to just model (e.g., "llama-3.3-70b-versatile")
  return llmModel
}

// Polling interval for transcription status (2 seconds)
const POLL_INTERVAL_MS = 2000

export interface UseTranscriptionOptions {
  /** Initial segments (optional) */
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
  /** Current transcription ID (needed for re-cleanup) */
  transcriptionId: string | null
  /** Current cleanup ID (needed for editing) */
  cleanupId: string | null
  /** Model name used for the current cleanup result */
  cleanupModelName: string | null
  /** Cleanup type of the current cleanup result (e.g., 'corrected', 'corrected-readable') */
  cleanupTypeName: string | null
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
   * All entries are fetched from /api/entries/{id}, including demo entries.
   * Demo entries are identified by filename pattern (demo-*.mp3) for UI display.
   *
   * @param entryId - UUID of the entry to load
   */
  loadEntry: (entryId: string) => Promise<void>

  /**
   * Whether current entry is a demo entry.
   * Demo entries are identified by filename pattern (demo-*.mp3).
   * Used for UI display purposes only (e.g., showing demo badge).
   */
  isDemo: boolean

  /**
   * Locale of the current demo entry (null if not a demo).
   * Extracted from filename pattern (e.g., "demo-sl.mp3" -> "sl").
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

  /**
   * Reprocess cleanup with new model, cleanup type, or temperature.
   * Polls for completion and reloads entry when done.
   */
  reprocessCleanup: (options?: { cleanupType?: CleanupType; llmModel?: string; temperature?: number | null }) => Promise<void>

  /**
   * Load cleanup data directly (for switching to cached cleanup without LLM call)
   */
  loadCleanupData: (cleanup: CleanedEntry) => void
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
 * } = useTranscription()
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
  const { initialSegments } = options

  // Base segments state
  const [segments, setSegments] = useState<Segment[]>(initialSegments || [])

  // Processing state
  const [status, setStatus] = useState<ProcessingStatus>(
    segments.length > 0 ? "complete" : "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null)
  const [cleanupId, setCleanupId] = useState<string | null>(null)
  const [cleanupModelName, setCleanupModelName] = useState<string | null>(null)
  const [cleanupTypeName, setCleanupTypeName] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [rateLimits, setRateLimits] = useState<RateLimitInfo | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number>(0)
  const [cleanedSegmentsWarning, setCleanedSegmentsWarning] = useState<string | null>(null)

  // Demo entry state
  // Demo entries are NOT stored in Core API - they use static files and localStorage for edits
  const [isDemo, setIsDemo] = useState<boolean>(false)
  const [demoLocale, setDemoLocale] = useState<string | null>(null)
  const [_demoAudioUrl, _setDemoAudioUrl] = useState<string | null>(null)

  // Track reverted segments for undo functionality
  const [revertedSegments, setRevertedSegments] = useState<Map<string, string>>(
    new Map()
  )

  // Ref for cleanup on unmount
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Ref to store loadEntry function for circular dependency resolution
  // pollCleanupStatus needs to call loadEntry, but loadEntry calls pollCleanupStatus
  const loadEntryRef = useRef<((entryId: string) => Promise<void>) | null>(null)

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

      // Save edit to API
      if (cleanupId) {
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
    [cleanupId, segmentsWithTime, segmentsToEditWords]
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

      // Save revert to API
      if (cleanupId) {
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
    [segmentsWithTime, cleanupId, segmentsToEditWords]
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

      // Save undo to API
      if (cleanupId) {
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
    [segmentsWithTime, cleanupId, segmentsToEditWords]
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

      // Save all edits to API
      if (cleanupId) {
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
    [cleanupId, segmentsWithTime, segmentsToEditWords]
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
                // Store the model and type used for this cleanup
                setCleanupModelName(getFullModelId(cleanedEntry.llm_provider, cleanedEntry.llm_model))
                setCleanupTypeName(cleanedEntry.cleanup_type || null)

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
   * Poll for cleanup status until complete or failed.
   * Used for entries that have transcription but no cleanup (e.g., demo entries).
   * After cleanup completes, triggers analysis with default profile.
   */
  const pollCleanupStatus = useCallback(
    async (cleanupIdVal: string, entryIdToLoad: string): Promise<void> => {
      const poll = async (): Promise<void> => {
        try {
          const { data: cleanedEntry } = await getCleanedEntry(cleanupIdVal)

          if (cleanedEntry.status === "completed") {
            console.log("[pollCleanupStatus] Cleanup complete, triggering analysis...")

            // Trigger analysis with default profile
            try {
              const { data: analysisJob } = await triggerAnalysis(cleanupIdVal, { profileId: "generic-summary" })
              setAnalysisId(analysisJob.id)
              console.log("[pollCleanupStatus] Analysis triggered:", analysisJob.id)
            } catch (analysisErr) {
              console.warn("[pollCleanupStatus] Failed to trigger analysis:", analysisErr)
              // Continue anyway - user can trigger manually
            }

            // Reload entry to get full data
            // This will work because now cleanup exists, so loadEntry won't re-trigger
            if (loadEntryRef.current) {
              await loadEntryRef.current(entryIdToLoad)
            }
          } else if (cleanedEntry.status === "failed") {
            setError(cleanedEntry.error_message || "Cleanup failed")
            setStatus("error")
          } else {
            // Still processing, continue polling
            pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS)
          }
        } catch (err) {
          console.error("[pollCleanupStatus] Error:", err)
          setError("Failed to check cleanup status")
          setStatus("error")
        }
      }

      pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    },
    []
  )

  /**
   * Reprocess cleanup with new options (model, cleanup type, temperature).
   * Sets status to cleaning, triggers new cleanup, polls for completion, then reloads entry.
   */
  const reprocessCleanup = useCallback(
    async (options: { cleanupType?: CleanupType; llmModel?: string; temperature?: number | null } = {}): Promise<void> => {
      if (!transcriptionId || !entryId) {
        console.warn("[reprocessCleanup] Missing transcriptionId or entryId")
        return
      }

      // Clean up any existing polling
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
        pollingRef.current = null
      }

      setStatus("cleaning")
      setError(null)

      try {
        // Trigger new cleanup
        const { data: cleanupJob } = await triggerCleanup(transcriptionId, options)
        setCleanupId(cleanupJob.id)
        setCleanupModelName(null) // Clear until new cleanup completes
        setCleanupTypeName(null)

        // Poll for completion (this will reload entry when done)
        await new Promise<void>((resolve, reject) => {
          const poll = async () => {
            try {
              const { data: cleanedEntry } = await getCleanedEntry(cleanupJob.id)

              if (cleanedEntry.status === "completed") {
                // Load the new cleanup data directly (NOT loadEntry which loads primary cleanup)
                loadCleanupData(cleanedEntry)
                setStatus("complete")
                resolve()
              } else if (cleanedEntry.status === "failed") {
                setError(cleanedEntry.error_message || "Cleanup failed")
                setStatus("error")
                reject(new Error(cleanedEntry.error_message || "Cleanup failed"))
              } else {
                // Still processing, continue polling
                pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS)
              }
            } catch (err) {
              console.error("[reprocessCleanup] Poll error:", err)
              setError("Failed to check cleanup status")
              setStatus("error")
              reject(err)
            }
          }
          poll()
        })
      } catch (err) {
        console.error("[reprocessCleanup] Error:", err)
        if (err instanceof Error && !error) {
          setError(err.message)
        }
        setStatus("error")
        throw err
      }
    },
    [transcriptionId, entryId, error]
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
    [pollTranscriptionStatus]
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
   * All entries (including demo entries) are fetched from /api/entries/{id}.
   * Demo entries are identified by filename pattern (demo-*.mp3) for UI display only.
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
        // Fetch entry from API
        console.log("[loadEntry] Fetching entry details...")
        const { data: entryDetails } = await getEntry(entryIdToLoad)

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
          setTranscriptionId(transcription.id || null)
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
          console.log("[loadEntry] No cleanup data, triggering cleanup...")
          setEntryId(entryIdToLoad)
          setTranscriptionId(transcription.id || null)
          setStatus("cleaning")

          // Auto-trigger cleanup for entries with completed transcription (e.g., demo entries)
          if (transcription.status === "completed" && transcription.id) {
            try {
              const { data: cleanupJob } = await triggerCleanup(transcription.id)
              setCleanupId(cleanupJob.id)
              console.log("[loadEntry] Cleanup triggered:", cleanupJob.id)
              // Start polling for cleanup completion
              pollCleanupStatus(cleanupJob.id, entryIdToLoad)
            } catch (cleanupErr) {
              console.error("[loadEntry] Failed to trigger cleanup:", cleanupErr)
              setError("Failed to start cleanup process")
              setStatus("error")
            }
          }
          return
        }

        if (cleanupData.status === "processing" || cleanupData.status === "pending") {
          console.log("[loadEntry] Cleanup still processing:", cleanupData.status)
          setEntryId(entryIdToLoad)
          setTranscriptionId(transcription.id || null)
          setCleanupId(cleanupData.id)
          setStatus("cleaning")
          // Start polling for cleanup completion
          pollCleanupStatus(cleanupData.id, entryIdToLoad)
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
        setTranscriptionId(transcription.id || null)
        setCleanupId(cleanupData.id)
        setCleanupModelName(getFullModelId(cleanupData.llm_provider, cleanupData.llm_model))
        setCleanupTypeName(cleanupData.cleanup_type || null)
        // Set all analyses for client-side caching by profile
        const allAnalyses = entryDetails.analyses || []
        setAnalyses(allAnalyses)
        // Set analysis ID from first (latest) analysis if available
        const latestAnalysisId = allAnalyses.length > 0 ? allAnalyses[0].id : null
        setAnalysisId(latestAnalysisId)
        console.log("[loadEntry] Loaded analyses count:", allAnalyses.length, "Latest ID:", latestAnalysisId)
        // Set duration from API response (used as fallback when audio element can't determine duration)
        setDurationSeconds(entryDetails.duration_seconds || 0)

        // Detect demo entry by filename pattern (demo-*.mp3)
        const isDemoEntry = entryDetails.original_filename?.startsWith("demo-") &&
                            entryDetails.original_filename?.endsWith(".mp3")
        setIsDemo(isDemoEntry || false)
        setDemoLocale(isDemoEntry ? entryDetails.original_filename?.replace("demo-", "").replace(".mp3", "") || null : null)
        _setDemoAudioUrl(null)  // Demo audio served via standard /api/entries/{id}/audio endpoint

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
    // Note: pollCleanupStatus is intentionally not in deps - it uses refs to avoid circular dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Update the ref so pollCleanupStatus can call loadEntry without circular dependency issues
  loadEntryRef.current = loadEntry

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    // Clean up polling
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }

    setSegments(initialSegments || [])
    setStatus(initialSegments?.length ? "complete" : "idle")
    setError(null)
    setUploadProgress(0)
    setEntryId(null)
    setTranscriptionId(null)
    setCleanupId(null)
    setCleanupModelName(null)
    setCleanupTypeName(null)
    setAnalysisId(null)
    setAnalyses([])
    setRateLimits(null)
    setDurationSeconds(0)
    setRevertedSegments(new Map())
    setCleanedSegmentsWarning(null)
    // Reset demo state
    setIsDemo(false)
    setDemoLocale(null)
    _setDemoAudioUrl(null)
  }, [initialSegments])

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
    try {
      const limits = await getRateLimits()
      if (limits) {
        setRateLimits(limits)
      }
    } catch (err) {
      // Silently fail - rate limits are not critical
      console.error("Failed to fetch rate limits:", err)
    }
  }, [])

  /**
   * Load cleanup data directly (for switching to cached cleanup without LLM call)
   * Updates segments with the cleanup's cleaned text
   */
  const loadCleanupData = useCallback(
    (cleanup: CleanedEntry) => {
      console.log("[loadCleanupData] Loading cleanup:", cleanup.id)

      // Get cleaned segments (prefer user edits over original cleaned)
      const cleanedSegments = cleanup.cleanup_data_edited || cleanup.cleaned_segments || []

      // Check if we have per-segment cleanup or just full-text cleanup
      if (cleanedSegments.length > 0) {
        // Per-segment cleanup: Update each segment by index
        console.log("[loadCleanupData] Updating segments with per-segment cleanup")
        setSegments((prev) =>
          prev.map((seg, index) => {
            const cleanedSeg = cleanedSegments[index]
            return {
              ...seg,
              cleanedText: cleanedSeg?.text || seg.rawText,
            }
          })
        )
      } else if (cleanup.cleaned_text) {
        // Full-text cleanup only (no per-segment data)
        // Use the full cleaned text for all segments, preserving segment boundaries
        console.log("[loadCleanupData] No per-segment cleanup, using full cleaned text")
        console.log("[loadCleanupData] Warning: Per-segment cleanup unavailable, showing full cleaned text in all segments")

        // For now, just update the first segment with the full text if we only have one segment
        // This matches the fallback behavior in loadEntry
        setSegments((prev) => {
          if (prev.length === 1) {
            return prev.map(seg => ({
              ...seg,
              cleanedText: cleanup.cleaned_text?.trim() || seg.rawText,
            }))
          }
          // Multiple segments but no per-segment cleanup: keep segments as-is (show raw text)
          // This preserves the segment structure while indicating cleanup is unavailable
          console.warn("[loadCleanupData] Multiple segments but no per-segment cleanup available")
          return prev.map(seg => ({
            ...seg,
            cleanedText: seg.rawText,
          }))
        })
      } else {
        // No cleanup data at all: fall back to raw text
        console.warn("[loadCleanupData] No cleanup data available, falling back to raw text")
        setSegments((prev) =>
          prev.map((seg) => ({
            ...seg,
            cleanedText: seg.rawText,
          }))
        )
      }

      // Update cleanup state
      setCleanupId(cleanup.id)
      setCleanupModelName(getFullModelId(cleanup.llm_provider, cleanup.llm_model))
      setCleanupTypeName(cleanup.cleanup_type || null)

      console.log("[loadCleanupData] Cleanup loaded successfully")
    },
    []
  )

  return {
    segments: segmentsWithTime,
    status,
    error,
    uploadProgress,
    entryId,
    transcriptionId,
    cleanupId,
    cleanupModelName,
    cleanupTypeName,
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
    reprocessCleanup,
    loadCleanupData,
  }
}

// Re-export types
export type { SegmentWithTime, ProcessingStatus } from "./types"
