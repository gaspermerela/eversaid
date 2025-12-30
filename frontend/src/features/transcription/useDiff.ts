/**
 * useDiff - Memoized diff computation hook
 *
 * Wraps the existing LCS-based diff implementation from lib/diff-utils.ts
 * Provides batch computation for all segments and individual segment diff calculation
 */

import { useMemo, useCallback } from "react"
import { computeDiff, groupDiffTokens, type DiffToken } from "@/lib/diff-utils"
import type { Segment } from "@/components/demo/types"

export interface UseDiffOptions {
  /** Whether diff computation is enabled (corresponds to showDiff toggle) */
  enabled?: boolean
}

export interface UseDiffReturn {
  /**
   * Compute diff for a single segment (raw vs cleaned text)
   * Useful for on-demand computation when editing
   */
  computeSegmentDiff: (rawText: string, cleanedText: string) => DiffToken[]

  /**
   * Pre-computed diffs for all segments, keyed by segment ID
   * Automatically memoized based on segments array
   */
  segmentDiffs: Map<string, DiffToken[]>

  /**
   * Check if diff is enabled
   */
  isEnabled: boolean
}

/**
 * Hook for computing diffs between raw and cleaned segment text
 *
 * @param segments - Array of segments with rawText and cleanedText
 * @param options - Configuration options
 * @returns Object with diff computation utilities
 *
 * @example
 * ```tsx
 * const { segmentDiffs, computeSegmentDiff } = useDiff(segments, { enabled: showDiff })
 *
 * // Get pre-computed diff for a segment
 * const diff = segmentDiffs.get(segmentId)
 *
 * // Compute diff on-demand (e.g., during editing)
 * const liveEdit = computeSegmentDiff(rawText, editedText)
 * ```
 */
export function useDiff(
  segments: Segment[],
  options: UseDiffOptions = {}
): UseDiffReturn {
  const { enabled = true } = options

  /**
   * Compute diff for individual segment pair
   * Memoized function that can be called on-demand
   */
  const computeSegmentDiff = useCallback(
    (rawText: string, cleanedText: string): DiffToken[] => {
      if (!enabled) return []
      const tokens = computeDiff(rawText, cleanedText)
      return groupDiffTokens(tokens)
    },
    [enabled]
  )

  /**
   * Batch compute diffs for all segments
   * Memoized based on segments array and enabled state
   */
  const segmentDiffs = useMemo(() => {
    const diffs = new Map<string, DiffToken[]>()

    if (!enabled) {
      return diffs
    }

    for (const segment of segments) {
      const tokens = computeDiff(segment.rawText, segment.cleanedText)
      diffs.set(segment.id, groupDiffTokens(tokens))
    }

    return diffs
  }, [segments, enabled])

  return {
    computeSegmentDiff,
    segmentDiffs,
    isEnabled: enabled,
  }
}

// Re-export DiffToken type for convenience
export type { DiffToken } from "@/lib/diff-utils"
