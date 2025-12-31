/**
 * useEntries - Hook for managing entry history list
 *
 * Fetches entries from the API and transforms them to UI format.
 */

import { useState, useCallback, useEffect } from "react"
import { getEntries } from "./api"
import type { EntrySummary } from "./types"
import type { HistoryEntry } from "@/components/demo/types"
import { formatDuration } from "@/lib/time-utils"

export interface UseEntriesOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Limit per page (default: 10) */
  limit?: number
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
  /** Refresh entries from API */
  refresh: () => Promise<void>
}

/**
 * Derive UI status from API statuses
 */
function deriveEntryStatus(
  transcriptionStatus: EntrySummary["transcription_status"],
  cleanupStatus: EntrySummary["cleanup_status"]
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
    filename: entry.filename,
    duration: formatDuration(entry.duration),
    status: deriveEntryStatus(entry.transcription_status, entry.cleanup_status),
    timestamp: entry.created_at,
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
  const { autoFetch = true, limit = 10 } = options

  const [rawEntries, setRawEntries] = useState<EntrySummary[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  // Transform entries for UI
  const entries = rawEntries.map(transformEntry)

  return {
    entries,
    rawEntries,
    isLoading,
    error,
    total,
    refresh,
  }
}
