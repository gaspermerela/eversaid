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
  | "loading"
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
 *
 * Note: The polling endpoint returns `text` while composed entry details returns `transcribed_text`
 */
export interface TranscriptionStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  text?: string
  transcribed_text?: string  // Used in composed entry details response
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
 * Segment validation metadata for multi-speaker cleanup
 */
export interface SegmentValidation {
  expected_count: number
  parsed_count: number
  failed_segments: number[]
  overall_status: 'success' | 'partial' | 'failed'
}

/**
 * Spelling issue from spellcheck
 */
export interface SpellingIssue {
  word: string
  start: number
  end: number
  suggestions: string[]
}

/**
 * Cleaned entry response from GET /api/cleaned-entries/{id}
 * Matches CleanedEntryDetail from core backend
 */
export interface CleanedEntry {
  id: string
  voice_entry_id: string
  transcription_id: string
  user_id: string
  cleaned_text: string | null
  llm_raw_response?: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  model_name: string
  temperature?: number | null
  top_p?: number | null
  error_message?: string | null
  is_primary: boolean
  processing_time_seconds?: number | null
  created_at: string
  processing_started_at?: string | null
  processing_completed_at?: string | null
  prompt_template_id?: number | null
  prompt_name?: string | null
  prompt_description?: string | null
  user_edited_text: string | null
  user_edited_at?: string | null
  cleaned_segments?: CleanedSegment[] | null
  segment_validation?: SegmentValidation | null
  spelling_issues?: SpellingIssue[] | null
}

/**
 * Transcription summary in entry list
 */
export interface TranscriptionSummary {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  language_code: string
  error_message: string | null
  created_at: string
}

/**
 * Cleaned entry summary in entry list
 */
export interface CleanedEntrySummary {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  cleaned_text_preview: string | null
  error_message: string | null
  created_at: string
  user_edited_text_preview: string | null
}

/**
 * Entry summary for list view (matches actual API response)
 */
export interface EntrySummary {
  id: string
  original_filename: string
  saved_filename: string
  entry_type: string
  duration_seconds: number
  uploaded_at: string
  primary_transcription: TranscriptionSummary | null
  latest_cleaned_entry: CleanedEntrySummary | null
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
 *
 * Note: The wrapper backend composes this response by fetching from multiple
 * core API endpoints. This is a WORKAROUND for a core API design gap where
 * GET /entries/{id} doesn't return cleanup data.
 *
 * TODO: Fix core API to return cleanup data directly, then simplify wrapper.
 */
export interface EntryDetails {
  id: string
  original_filename: string
  saved_filename: string
  duration_seconds: number
  entry_type: string
  uploaded_at: string
  primary_transcription?: TranscriptionStatus
  /** Cleanup data - composed by wrapper backend (may be null if not yet available) */
  cleanup?: CleanedEntry | null
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
 * Matches AnalysisDetail from core backend
 */
export interface AnalysisResult {
  id: string
  cleaned_entry_id: string
  user_id: string
  profile_id: string
  profile_label?: string
  result?: Record<string, unknown> | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  model_name: string
  temperature?: number | null
  top_p?: number | null
  error_message?: string | null
  llm_raw_response?: string | null
  processing_time_seconds?: number | null
  created_at: string
  processing_started_at?: string | null
  processing_completed_at?: string | null
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
