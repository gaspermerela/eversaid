// Shared types for transcription hooks

import type { Segment } from "@/components/demo/types"

/**
 * Extended segment with parsed start/end times in seconds
 */
export interface SegmentWithTime extends Segment {
  startTime: number  // Parsed from "0:00 - 0:18" -> 0
  endTime: number    // Parsed from "0:00 - 0:18" -> 18
}

/**
 * Processing status for transcription workflow
 */
export type ProcessingStatus =
  | "idle"
  | "uploading"
  | "transcribing"
  | "cleaning"
  | "complete"
  | "error"

/**
 * Transcription state managed by useTranscription
 */
export interface TranscriptionState {
  segments: SegmentWithTime[]
  status: ProcessingStatus
  error: string | null
  entryId: string | null
  uploadProgress: number
}

/**
 * Audio player state managed by useAudioPlayer
 */
export interface AudioPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackSpeed: number
  activeSegmentId: string | null
  activeSegmentIndex: number
}

// Re-export base types for convenience
export type { Segment, SpellcheckError, HistoryEntry, SegmentEditState } from "@/components/demo/types"
