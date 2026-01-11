/**
 * useDemoCleanupTrigger - Auto-trigger cleanup for demo entries on page load
 *
 * When demo entries are created by the PostgreSQL trigger, they have completed
 * transcription but no cleanup. This hook automatically triggers cleanup and
 * analysis so the sidebar updates from "Processing" → "Complete" without
 * requiring user interaction.
 */

import { useRef, useEffect, useState, useCallback } from "react"
import { triggerCleanup, getCleanedEntry, triggerAnalysis } from "./api"
import type { EntrySummary } from "./types"

const POLL_INTERVAL_MS = 2000

/**
 * Check if an entry is a demo entry that needs cleanup
 */
function needsCleanup(entry: EntrySummary): boolean {
  const isDemoEntry =
    entry.original_filename?.startsWith("demo-") &&
    entry.original_filename?.endsWith(".mp3")

  const hasCompletedTranscription =
    entry.primary_transcription?.status === "completed"

  const hasNoCleanup = !entry.latest_cleaned_entry

  const cleanupNotCompleted =
    entry.latest_cleaned_entry?.status !== "completed" &&
    entry.latest_cleaned_entry?.status !== "failed"

  return (
    isDemoEntry && hasCompletedTranscription && (hasNoCleanup || cleanupNotCompleted)
  )
}

export interface UseDemoCleanupTriggerOptions {
  /** Raw entries from useEntries hook */
  entries: EntrySummary[]
  /** Whether entries are currently loading */
  isLoading: boolean
  /** Callback to refresh entries after cleanup completes */
  onRefresh: () => Promise<void>
  /** Whether to enable auto-trigger (default: true) */
  enabled?: boolean
}

export interface UseDemoCleanupTriggerReturn {
  /** Whether any cleanup is in progress */
  isProcessing: boolean
}

/**
 * Hook that auto-triggers cleanup for demo entries when the page loads.
 *
 * Flow:
 * 1. Filter entries for demo entries needing cleanup
 * 2. Trigger cleanup for each via POST /api/transcriptions/{id}/cleanup
 * 3. Poll for completion via GET /api/cleaned-entries/{id}
 * 4. Trigger analysis after cleanup completes
 * 5. Call onRefresh to update sidebar
 */
export function useDemoCleanupTrigger(
  options: UseDemoCleanupTriggerOptions
): UseDemoCleanupTriggerReturn {
  const { entries, isLoading, onRefresh, enabled = true } = options

  // Track triggered entries to avoid duplicates
  const triggeredRef = useRef<Set<string>>(new Set())

  // Track cleanup ID per entry (needed for polling)
  const cleanupIdsRef = useRef<Map<string, string>>(new Map())

  // Polling intervals ref for cleanup
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Processing state for UI feedback
  const [processingCount, setProcessingCount] = useState(0)

  /**
   * Poll cleanup status and trigger analysis on completion
   */
  const pollCleanupStatus = useCallback(
    (entryId: string, cleanupId: string) => {
      const poll = async () => {
        try {
          const { data: cleanedEntry } = await getCleanedEntry(cleanupId)

          if (cleanedEntry.status === "completed") {
            console.log(
              `[useDemoCleanupTrigger] Cleanup complete for entry ${entryId}, triggering analysis...`
            )

            // Stop polling
            const interval = pollIntervalsRef.current.get(entryId)
            if (interval) {
              clearTimeout(interval)
              pollIntervalsRef.current.delete(entryId)
            }

            // Trigger analysis with default profile
            try {
              const { data: analysisJob } = await triggerAnalysis(
                cleanupId,
                "generic-summary"
              )
              console.log(
                `[useDemoCleanupTrigger] Analysis triggered for entry ${entryId}:`,
                analysisJob.id
              )
            } catch (analysisErr) {
              console.warn(
                `[useDemoCleanupTrigger] Failed to trigger analysis for entry ${entryId}:`,
                analysisErr
              )
              // Continue anyway - user can trigger manually
            }

            // Refresh entries to update sidebar
            setProcessingCount((c) => Math.max(0, c - 1))
            await onRefresh()
          } else if (cleanedEntry.status === "failed") {
            console.error(
              `[useDemoCleanupTrigger] Cleanup failed for entry ${entryId}:`,
              cleanedEntry.error_message
            )

            // Stop polling
            const interval = pollIntervalsRef.current.get(entryId)
            if (interval) {
              clearTimeout(interval)
              pollIntervalsRef.current.delete(entryId)
            }

            setProcessingCount((c) => Math.max(0, c - 1))
            await onRefresh()
          } else {
            // Still processing, continue polling
            pollIntervalsRef.current.set(
              entryId,
              setTimeout(poll, POLL_INTERVAL_MS)
            )
          }
        } catch (err) {
          console.error(
            `[useDemoCleanupTrigger] Error polling cleanup status for entry ${entryId}:`,
            err
          )

          // Stop polling on error
          const interval = pollIntervalsRef.current.get(entryId)
          if (interval) {
            clearTimeout(interval)
            pollIntervalsRef.current.delete(entryId)
          }

          setProcessingCount((c) => Math.max(0, c - 1))
        }
      }

      // Start polling
      pollIntervalsRef.current.set(entryId, setTimeout(poll, POLL_INTERVAL_MS))
    },
    [onRefresh]
  )

  /**
   * Trigger cleanup for a single entry
   */
  const triggerCleanupForEntry = useCallback(
    async (entry: EntrySummary) => {
      const transcriptionId = entry.primary_transcription?.id
      if (!transcriptionId) {
        console.warn(
          `[useDemoCleanupTrigger] No transcription ID for entry ${entry.id}`
        )
        return
      }

      try {
        console.log(
          `[useDemoCleanupTrigger] Triggering cleanup for entry ${entry.id} (transcription ${transcriptionId})`
        )

        const { data: cleanupJob } = await triggerCleanup(transcriptionId)
        console.log(
          `[useDemoCleanupTrigger] Cleanup triggered for entry ${entry.id}:`,
          cleanupJob.id
        )

        // Track cleanup ID
        cleanupIdsRef.current.set(entry.id, cleanupJob.id)

        // Start polling for completion
        pollCleanupStatus(entry.id, cleanupJob.id)
      } catch (err) {
        console.error(
          `[useDemoCleanupTrigger] Failed to trigger cleanup for entry ${entry.id}:`,
          err
        )
        setProcessingCount((c) => Math.max(0, c - 1))
      }
    },
    [pollCleanupStatus]
  )

  /**
   * Effect: Process demo entries when they load
   */
  useEffect(() => {
    if (!enabled || isLoading || entries.length === 0) {
      return
    }

    // Find demo entries that need cleanup and haven't been triggered
    const entriesToProcess = entries.filter(
      (entry) => needsCleanup(entry) && !triggeredRef.current.has(entry.id)
    )

    if (entriesToProcess.length === 0) {
      return
    }

    console.log(
      `[useDemoCleanupTrigger] Found ${entriesToProcess.length} demo entries needing cleanup`
    )

    // Mark as triggered to avoid duplicates
    entriesToProcess.forEach((entry) => {
      triggeredRef.current.add(entry.id)
    })

    // Update processing count
    setProcessingCount((c) => c + entriesToProcess.length)

    // Trigger cleanup for each entry
    entriesToProcess.forEach((entry) => {
      triggerCleanupForEntry(entry)
    })
  }, [enabled, isLoading, entries, triggerCleanupForEntry])

  /**
   * Cleanup polling intervals on unmount
   */
  useEffect(() => {
    return () => {
      pollIntervalsRef.current.forEach((interval) => {
        clearTimeout(interval)
      })
      pollIntervalsRef.current.clear()
    }
  }, [])

  return {
    isProcessing: processingCount > 0,
  }
}
