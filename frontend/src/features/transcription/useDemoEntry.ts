/**
 * useDemoEntry - Hook for fetching and managing demo entry data
 *
 * This hook handles fetching the pre-loaded demo entry from the backend
 * based on the current locale. Demo entries are served from static files
 * and provide a sample transcription for users to explore without uploading.
 *
 * ## Why This Hook Exists
 *
 * The demo page needs to show a pre-analyzed transcription so users can
 * immediately see what the app does. However, we don't want to:
 * - Re-transcribe audio every time (expensive, slow)
 * - Store demo data in Core API (not per-user data)
 * - Commit large audio files to git
 *
 * Instead, demo data is:
 * - Pre-computed and stored as JSON + audio files
 * - Mounted in the backend at runtime (not committed)
 * - Served via dedicated /api/demo endpoints
 *
 * @see /backend/app/routes/demo.py - Backend endpoints
 * @see /lib/demo-storage.ts - localStorage utilities for demo edits
 */

import { useState, useEffect, useCallback } from "react"
import { getDemoEntry, getDemoAudioUrl } from "./api"
import type { DemoEntryData } from "./types"
import type { HistoryEntry } from "@/components/demo/types"
import { formatDuration } from "@/lib/time-utils"

export interface UseDemoEntryOptions {
  /** Locale to fetch demo for ('en' or 'sl') */
  locale: string
  /** Whether to fetch demo data (default: true) */
  enabled?: boolean
}

export interface UseDemoEntryReturn {
  /** Demo entry data from backend, null if not available */
  demoData: DemoEntryData | null
  /** Audio URL for the demo entry */
  audioUrl: string | null
  /** Demo entry formatted for history sidebar */
  historyEntry: HistoryEntry | null
  /** Whether demo data is loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Refresh demo data from backend */
  refresh: () => Promise<void>
}

/**
 * Generate a stable demo entry ID based on locale.
 *
 * We use a predictable ID format so that:
 * - localStorage edits can be keyed by this ID
 * - URL navigation (?entry=demo-en) works consistently
 * - The demo entry is easily identifiable in code
 */
export function getDemoEntryId(locale: string): string {
  return `demo-${locale}`
}

/**
 * Hook for fetching and managing demo entry data.
 *
 * @param options - Configuration options
 * @returns Demo data, history entry, and loading state
 *
 * @example
 * ```tsx
 * const { demoData, historyEntry, isLoading } = useDemoEntry({
 *   locale: 'en',
 * })
 *
 * // historyEntry can be prepended to the entries list
 * // demoData can be passed to useTranscription.loadDemoEntry()
 * ```
 */
export function useDemoEntry(options: UseDemoEntryOptions): UseDemoEntryReturn {
  const { locale, enabled = true } = options

  const [demoData, setDemoData] = useState<DemoEntryData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const { data } = await getDemoEntry(locale)
      setDemoData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load demo"
      setError(message)
      // Don't show toast - demo being unavailable is not a user error
      console.warn("Demo entry not available:", message)
    } finally {
      setIsLoading(false)
    }
  }, [locale, enabled])

  // Fetch on mount and when locale changes
  useEffect(() => {
    refresh()
  }, [refresh])

  // Audio URL (only if data is available)
  const audioUrl = demoData ? getDemoAudioUrl(locale) : null

  // Transform to HistoryEntry format for sidebar
  const historyEntry: HistoryEntry | null = demoData
    ? {
        id: getDemoEntryId(locale),
        filename: demoData.filename,
        duration: formatDuration(demoData.durationSeconds),
        status: "complete",
        timestamp: new Date().toISOString(), // Demo is always "now"
        isDemo: true,
      }
    : null

  return {
    demoData,
    audioUrl,
    historyEntry,
    isLoading,
    error,
    refresh,
  }
}
