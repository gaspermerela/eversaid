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

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Options for uploading and transcribing audio
 */
export interface TranscribeOptions {
  language?: string
  enableDiarization?: boolean
  speakerCount?: number
  enableAnalysis?: boolean
  analysisProfile?: string
}

/**
 * Response from POST /api/transcribe
 */
export interface TranscribeResponse {
  entry_id: string
  transcription_id: string
  cleanup_id: string
  analysis_id?: string
  transcription_status: 'pending' | 'processing' | 'completed' | 'failed'
  cleanup_status: 'pending' | 'processing' | 'completed' | 'failed'
  analysis_status?: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Segment as returned by the API
 */
export interface ApiSegment {
  id: string
  start: number
  end: number
  text: string
  speaker?: string
  speaker_id?: number
}

/**
 * Transcription status response from GET /api/transcriptions/{id}
 */
export interface TranscriptionStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  text?: string
  segments?: ApiSegment[]
  error?: string
}

/**
 * Cleaned segment with spellcheck info
 */
export interface CleanedSegment {
  id: string
  start: number
  end: number
  text: string
  speaker?: string
  speaker_id?: number
  raw_segment_id?: string
  spellcheck_errors?: Array<{
    word: string
    start: number
    end: number
    suggestions: string[]
  }>
}

/**
 * Cleaned entry response from GET /api/cleaned-entries/{id}
 */
export interface CleanedEntry {
  id: string
  entry_id: string
  cleaned_text: string
  user_edited_text: string | null
  segments: CleanedSegment[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Entry summary for list view
 */
export interface EntrySummary {
  id: string
  filename: string
  duration: number
  created_at: string
  transcription_status: 'pending' | 'processing' | 'completed' | 'failed'
  cleanup_status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Paginated entries response from GET /api/entries
 */
export interface PaginatedEntries {
  entries: EntrySummary[]
  total: number
  limit: number
  offset: number
}

/**
 * Full entry details from GET /api/entries/{id}
 */
export interface EntryDetails {
  id: string
  filename: string
  duration: number
  created_at: string
  transcription?: TranscriptionStatus
  cleanup?: CleanedEntry
  analyses?: AnalysisResult[]
}

/**
 * Analysis profile from GET /api/analysis-profiles
 */
export interface AnalysisProfile {
  id: string
  label: string
  intent: string
  description: string
  is_default: boolean
  outputs: string[]
}

/**
 * Analysis job response from POST /api/cleaned-entries/{id}/analyze
 */
export interface AnalysisJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  profile_id: string
}

/**
 * Analysis result from GET /api/analyses/{id}
 */
export interface AnalysisResult {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  profile_id: string
  profile_label?: string
  result?: Record<string, unknown>
  error?: string
}

/**
 * Feedback types
 */
export type FeedbackType = 'transcription' | 'cleanup' | 'analysis'

/**
 * Feedback submission payload
 */
export interface FeedbackPayload {
  feedback_type: FeedbackType
  rating: number
  feedback_text?: string
}

/**
 * Feedback response
 */
export interface Feedback {
  id: string
  entry_id: string
  feedback_type: FeedbackType
  rating: number
  feedback_text?: string
  created_at: string
}

/**
 * Waitlist types
 */
export type WaitlistType = 'api_access' | 'extended_usage'

/**
 * Waitlist submission payload
 */
export interface WaitlistPayload {
  email: string
  use_case?: string
  waitlist_type: WaitlistType
  source_page?: string
}

// =============================================================================
// Rate Limit Types
// =============================================================================

/**
 * Single rate limit tier info
 */
export interface LimitTier {
  limit: number
  remaining: number
  reset: number  // Unix timestamp
}

/**
 * Rate limit info across all tiers
 */
export interface RateLimitInfo {
  day: LimitTier
  ip_day: LimitTier
  global_day: LimitTier
}

/**
 * Rate limit exceeded error response (429)
 */
export interface RateLimitError {
  error: 'rate_limit_exceeded'
  message: string
  limit_type: 'day' | 'ip_day' | 'global_day'
  retry_after: number  // seconds
  limits: RateLimitInfo
}

// =============================================================================
// API Error Types
// =============================================================================

/**
 * Custom API error with additional metadata
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public rateLimitInfo?: RateLimitInfo,
    public rateLimitError?: RateLimitError
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isServerError(): boolean {
    return this.status >= 500
  }
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number
  offset?: number
  entry_type?: string
}
