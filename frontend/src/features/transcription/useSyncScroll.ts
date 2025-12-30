/**
 * useSyncScroll - Synchronized scrolling between raw and cleaned transcript panes
 *
 * Provides refs, scroll handlers, and height synchronization for side-by-side
 * transcript comparison. Uses percentage-based sync with scroll loop prevention.
 */

import { useRef, useCallback, useEffect } from "react"
import type { Segment } from "@/components/demo/types"

export interface UseSyncScrollOptions {
  /** Array of segments to sync (used for height matching) */
  segments: Segment[]
  /** Whether sync is enabled */
  enabled?: boolean
}

export interface UseSyncScrollReturn {
  /** Ref to attach to the raw transcript scroll container */
  rawScrollRef: React.RefObject<HTMLDivElement | null>

  /** Ref to attach to the cleaned transcript scroll container */
  cleanedScrollRef: React.RefObject<HTMLDivElement | null>

  /** Scroll handler for the raw transcript pane */
  handleRawScroll: (e: React.UIEvent<HTMLDivElement>) => void

  /** Scroll handler for the cleaned transcript pane */
  handleCleanedScroll: (e: React.UIEvent<HTMLDivElement>) => void

  /** Programmatically scroll to a specific segment by ID */
  scrollToSegment: (segmentId: string) => void

  /** Sync segment heights between panes (call after render/resize) */
  syncSegmentHeights: () => void
}

/**
 * Hook for synchronized scrolling between two transcript panes
 *
 * @param options - Configuration with segments and enabled state
 * @returns Object with refs, handlers, and utilities
 *
 * @example
 * ```tsx
 * const {
 *   rawScrollRef,
 *   cleanedScrollRef,
 *   handleRawScroll,
 *   handleCleanedScroll
 * } = useSyncScroll({ segments })
 *
 * return (
 *   <div className="grid grid-cols-2">
 *     <div ref={rawScrollRef} onScroll={handleRawScroll}>
 *       {// raw segments}
 *     </div>
 *     <div ref={cleanedScrollRef} onScroll={handleCleanedScroll}>
 *       {// cleaned segments}
 *     </div>
 *   </div>
 * )
 * ```
 */
export function useSyncScroll(options: UseSyncScrollOptions): UseSyncScrollReturn {
  const { segments, enabled = true } = options

  // Refs for scroll containers
  const rawScrollRef = useRef<HTMLDivElement>(null)
  const cleanedScrollRef = useRef<HTMLDivElement>(null)

  // Mutex to prevent scroll loops
  const isSyncingScrollRef = useRef(false)

  /**
   * Handle scroll on the raw transcript pane
   * Syncs the cleaned pane to match scroll percentage
   */
  const handleRawScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!enabled || isSyncingScrollRef.current) return

      const rawEl = e.currentTarget
      const cleanedEl = cleanedScrollRef.current
      if (!cleanedEl) return

      // Set mutex to prevent feedback loop
      isSyncingScrollRef.current = true

      // Calculate scroll percentage (avoid division by zero)
      const scrollableHeight = rawEl.scrollHeight - rawEl.clientHeight
      const scrollPercentage = scrollableHeight > 0 ? rawEl.scrollTop / scrollableHeight : 0

      // Apply to cleaned side
      const cleanedScrollable = cleanedEl.scrollHeight - cleanedEl.clientHeight
      cleanedEl.scrollTop = scrollPercentage * cleanedScrollable

      // Release mutex on next frame
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false
      })
    },
    [enabled]
  )

  /**
   * Handle scroll on the cleaned transcript pane
   * Syncs the raw pane to match scroll percentage
   */
  const handleCleanedScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!enabled || isSyncingScrollRef.current) return

      const cleanedEl = e.currentTarget
      const rawEl = rawScrollRef.current
      if (!rawEl) return

      // Set mutex to prevent feedback loop
      isSyncingScrollRef.current = true

      // Calculate scroll percentage (avoid division by zero)
      const scrollableHeight = cleanedEl.scrollHeight - cleanedEl.clientHeight
      const scrollPercentage = scrollableHeight > 0 ? cleanedEl.scrollTop / scrollableHeight : 0

      // Apply to raw side
      const rawScrollable = rawEl.scrollHeight - rawEl.clientHeight
      rawEl.scrollTop = scrollPercentage * rawScrollable

      // Release mutex on next frame
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false
      })
    },
    [enabled]
  )

  /**
   * Programmatically scroll both panes to show a specific segment
   */
  const scrollToSegment = useCallback((segmentId: string) => {
    const rawEl = rawScrollRef.current
    const cleanedEl = cleanedScrollRef.current
    if (!rawEl || !cleanedEl) return

    // Find segment element in raw pane
    const segmentEl = rawEl.querySelector(`[data-segment-id="${segmentId}"]`)
    if (!segmentEl) return

    // Calculate scroll position to center the segment
    const containerRect = rawEl.getBoundingClientRect()
    const segmentRect = segmentEl.getBoundingClientRect()
    const offsetTop = segmentRect.top - containerRect.top + rawEl.scrollTop
    const centerOffset = (containerRect.height - segmentRect.height) / 2
    const targetScroll = Math.max(0, offsetTop - centerOffset)

    // Set mutex to prevent sync during programmatic scroll
    isSyncingScrollRef.current = true

    // Scroll both panes
    rawEl.scrollTop = targetScroll

    // Calculate equivalent position for cleaned pane
    const rawScrollable = rawEl.scrollHeight - rawEl.clientHeight
    const scrollPercentage = rawScrollable > 0 ? targetScroll / rawScrollable : 0
    const cleanedScrollable = cleanedEl.scrollHeight - cleanedEl.clientHeight
    cleanedEl.scrollTop = scrollPercentage * cleanedScrollable

    // Release mutex
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }, [])

  /**
   * Synchronize heights of matching segments between panes
   * This ensures percentage-based scroll sync works correctly
   */
  const syncSegmentHeights = useCallback(() => {
    const rawEl = rawScrollRef.current
    const cleanedEl = cleanedScrollRef.current
    if (!rawEl || !cleanedEl) return

    const rawSegments = rawEl.querySelectorAll("[data-segment-id]")
    const cleanedSegments = cleanedEl.querySelectorAll("[data-segment-id]")

    rawSegments.forEach((rawSegmentEl) => {
      const segmentId = rawSegmentEl.getAttribute("data-segment-id")
      const cleanedSegmentEl = Array.from(cleanedSegments).find(
        (el) => el.getAttribute("data-segment-id") === segmentId
      )

      if (
        cleanedSegmentEl &&
        rawSegmentEl instanceof HTMLElement &&
        cleanedSegmentEl instanceof HTMLElement
      ) {
        // Reset heights first to get natural measurements
        rawSegmentEl.style.minHeight = ""
        cleanedSegmentEl.style.minHeight = ""

        // Get natural heights
        const rawHeight = rawSegmentEl.offsetHeight
        const cleanedHeight = cleanedSegmentEl.offsetHeight

        // Set both to the max height
        const maxHeight = Math.max(rawHeight, cleanedHeight)
        rawSegmentEl.style.minHeight = `${maxHeight}px`
        cleanedSegmentEl.style.minHeight = `${maxHeight}px`
      }
    })
  }, [])

  /**
   * Effect to sync segment heights on mount, segment changes, and window resize
   */
  useEffect(() => {
    // Initial sync
    syncSegmentHeights()

    // Re-sync after a short delay to account for dynamic content
    const timer = setTimeout(syncSegmentHeights, 100)

    // Re-sync on window resize
    const handleResize = () => {
      syncSegmentHeights()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)
    }
  }, [segments, syncSegmentHeights])

  return {
    rawScrollRef,
    cleanedScrollRef,
    handleRawScroll,
    handleCleanedScroll,
    scrollToSegment,
    syncSegmentHeights,
  }
}
