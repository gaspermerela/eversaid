/**
 * Time parsing utilities for segment timestamps
 */

import type { Segment } from "@/components/demo/types"
import type { SegmentWithTime } from "@/features/transcription/types"

/**
 * Parse a time string like "0:43" or "1:05" into seconds
 * @param timeStr - Time string in format "M:SS" or "MM:SS"
 * @returns Time in seconds
 */
export function parseTimeString(timeStr: string): number {
  const parts = timeStr.trim().split(":")
  if (parts.length !== 2) return 0

  const minutes = parseInt(parts[0], 10) || 0
  const seconds = parseInt(parts[1], 10) || 0

  return minutes * 60 + seconds
}

/**
 * Parse a time range string like "0:00 - 0:18" or "0:43 – 1:05" into start/end seconds
 * Handles both regular hyphen (-) and en-dash (–)
 * @param timeRange - Time range string in format "M:SS - M:SS" or "M:SS – M:SS"
 * @returns Object with startTime and endTime in seconds
 */
export function parseTimeRange(timeRange: string): { startTime: number; endTime: number } {
  // Handle both regular hyphen and en-dash
  const separator = timeRange.includes("–") ? "–" : "-"
  const parts = timeRange.split(separator)

  if (parts.length !== 2) {
    return { startTime: 0, endTime: 0 }
  }

  return {
    startTime: parseTimeString(parts[0]),
    endTime: parseTimeString(parts[1]),
  }
}

/**
 * Format seconds as "M:SS" string
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Format seconds as "M:SS – M:SS" time range string
 * @param startSeconds - Start time in seconds
 * @param endSeconds - End time in seconds
 * @returns Formatted time range string
 */
export function formatTimeRange(startSeconds: number, endSeconds: number): string {
  return `${formatTime(startSeconds)} – ${formatTime(endSeconds)}`
}

/**
 * Add parsed time fields to a segment
 * @param segment - Segment with time string
 * @returns SegmentWithTime with parsed startTime and endTime
 */
export function parseSegmentTimes(segment: Segment): SegmentWithTime {
  const { startTime, endTime } = parseTimeRange(segment.time)
  return {
    ...segment,
    startTime,
    endTime,
  }
}

/**
 * Add parsed time fields to an array of segments
 * @param segments - Array of segments with time strings
 * @returns Array of SegmentWithTime with parsed times
 */
export function parseAllSegmentTimes(segments: Segment[]): SegmentWithTime[] {
  return segments.map(parseSegmentTimes)
}

/**
 * Find the segment that contains a given time
 * @param segments - Array of segments with parsed times
 * @param timeSeconds - Current time in seconds
 * @returns The segment containing the time, or undefined
 */
export function findSegmentAtTime(
  segments: SegmentWithTime[],
  timeSeconds: number
): SegmentWithTime | undefined {
  return segments.find(
    (segment) => timeSeconds >= segment.startTime && timeSeconds < segment.endTime
  )
}

/**
 * Find the index of the segment that contains a given time
 * @param segments - Array of segments with parsed times
 * @param timeSeconds - Current time in seconds
 * @returns Index of the segment, or -1 if not found
 */
export function findSegmentIndexAtTime(
  segments: SegmentWithTime[],
  timeSeconds: number
): number {
  return segments.findIndex(
    (segment) => timeSeconds >= segment.startTime && timeSeconds < segment.endTime
  )
}
