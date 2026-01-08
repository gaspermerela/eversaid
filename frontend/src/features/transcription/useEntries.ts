/**
 * useEntries - Hook for managing entry history list
 *
 * Fetches entries from the API and transforms them to UI format.
 */

import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { getEntries, deleteEntry as deleteEntryApi } from "./api"
import type { EntrySummary } from "./types"
import type { HistoryEntry } from "@/components/demo/types"
import { formatDuration } from "@/lib/time-utils"

export interface UseEntriesOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Limit per page (default: 10) */
  limit?: number
  /**
   * Demo entry to prepend to the list.
   *
   * When provided, this entry appears at the top of the history sidebar.
   * It's visually distinguished with isDemo: true and cannot be deleted.
   *
   * @see useDemoEntry for fetching demo data
   */
  demoEntry?: HistoryEntry | null
}

export interface UseEntriesReturn {
  /** Transformed entries for display */
  entries: HistoryEntry[]
  /** Raw API entries */
  rawEntries: EntrySummary[]
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Total count from API */
  total: number
  /** Entry ID currently being deleted */
  deletingId: string | null
  /** Refresh entries from API */
  refresh: () => Promise<void>
  /** Delete an entry by ID. Returns true if deleted, false otherwise. */
  deleteEntry: (entryId: string) => Promise<boolean>
}

/**
 * Derive UI status from API statuses
 */
function deriveEntryStatus(
  transcriptionStatus: string | undefined,
  cleanupStatus: string | undefined
): HistoryEntry["status"] {
  // If either failed, show error
  if (transcriptionStatus === "failed" || cleanupStatus === "failed") {
    return "error"
  }
  // If both completed, show complete
  if (transcriptionStatus === "completed" && cleanupStatus === "completed") {
    return "complete"
  }
  // Otherwise, processing (pending or processing)
  return "processing"
}

/**
 * Transform API EntrySummary to UI HistoryEntry
 */
function transformEntry(entry: EntrySummary): HistoryEntry {
  return {
    id: entry.id,
    filename: entry.original_filename,
    duration: formatDuration(entry.duration_seconds),
    status: deriveEntryStatus(
      entry.primary_transcription?.status,
      entry.latest_cleaned_entry?.status
    ),
    timestamp: entry.uploaded_at,
  }
}

/**
 * Hook for managing entry history list
 *
 * @param options - Configuration options
 * @returns Object with entries, loading state, and refresh function
 *
 * @example
 * ```tsx
 * const { entries, isLoading, refresh } = useEntries()
 *
 * // Entries are auto-fetched on mount
 * // Call refresh() to reload the list
 * ```
 */
export function useEntries(options: UseEntriesOptions = {}): UseEntriesReturn {
  const { autoFetch = true, limit = 10, demoEntry } = options

  const [rawEntries, setRawEntries] = useState<EntrySummary[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data } = await getEntries({ limit })
      setRawEntries(data.entries)
      setTotal(data.total)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load entries"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  const deleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    // Prevent deletion of demo entries
    if (demoEntry && entryId === demoEntry.id) {
      console.warn("Cannot delete demo entry")
      return false
    }

    setDeletingId(entryId)

    // Optimistic update - remove from list immediately
    const previousEntries = rawEntries
    setRawEntries((prev) => prev.filter((e) => e.id !== entryId))
    setTotal((prev) => Math.max(0, prev - 1))

    try {
      await deleteEntryApi(entryId)
      return true
    } catch (err) {
      // Restore on error
      setRawEntries(previousEntries)
      setTotal((prev) => prev + 1)
      const message =
        err instanceof Error ? err.message : "Failed to delete entry"
      toast.error(message)
      return false
    } finally {
      setDeletingId(null)
    }
  }, [rawEntries, demoEntry])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  // Transform entries for UI, prepending demo entry if available
  const entries = [
    // Demo entry always comes first (if available)
    ...(demoEntry ? [demoEntry] : []),
    // Then user's entries
    ...rawEntries.map(transformEntry),
  ]

  return {
    entries,
    rawEntries,
    isLoading,
    error,
    total,
    deletingId,
    refresh,
    deleteEntry,
  }
}
