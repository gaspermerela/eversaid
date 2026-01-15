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

// =============================================================================
// Stage-Based Progress Types
// =============================================================================

/**
 * Stage identifiers for the processing pipeline
 */
export type StageId = 'upload' | 'transcribe' | 'cleanup' | 'analyze'

/**
 * Status of an individual processing stage
 */
export type StageStatus = 'pending' | 'active' | 'completed' | 'error'

/**
 * Individual processing stage with status and optional time estimate
 */
export interface ProcessingStage {
  id: StageId
  status: StageStatus
  estimatedSeconds?: { min: number; max: number }
}

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
 * Cleanup type options for LLM text cleanup
 */
export type CleanupType = 'verbatim' | 'corrected' | 'corrected-readable' | 'formal'

/**
 * Summary of a cleanup record (for cache indicator)
 */
export interface CleanupSummary {
  id: string
  llm_provider: string
  llm_model: string
  prompt_name: string // cleanup level (e.g., 'corrected', 'formal')
  status: 'pending' | 'processing' | 'completed' | 'failed'
  is_primary: boolean
}

/**
 * Options for uploading and transcribing audio
 */
export interface TranscribeOptions {
  language?: string
  enableDiarization?: boolean
  speakerCount?: number
  enableAnalysis?: boolean
  analysisProfile?: string
  // Cleanup options
  cleanupType?: CleanupType
  llmModel?: string        // LLM model for cleanup
  // Analysis options (separate from cleanup)
  analysisLlmModel?: string // LLM model for analysis (falls back to llmModel if not specified)
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
 * Word-level timing data from transcription API
 */
export interface TranscriptionWord {
  text: string
  start: number  // seconds
  end: number    // seconds
  type: 'word' | 'spacing' | 'audio_event'
  speaker_id?: number | null  // 0-based speaker index from API
}

/**
 * Segment as returned by the API
 */
export interface ApiSegment {
  id: string
  start: number
  end: number
  text: string
  speaker?: number | null  // 0-based speaker index from API
  words?: TranscriptionWord[]
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
  words?: TranscriptionWord[]  // Flat array of all words with timing info
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
  speaker?: number | null  // 0-based speaker index from API
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
  llm_provider: string
  llm_model: string
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
  cleanup_data_edited: CleanedSegment[] | null
  user_edited_at?: string | null
  cleaned_segments?: CleanedSegment[] | null
  segment_validation?: SegmentValidation | null
  spelling_issues?: SpellingIssue[] | null
}

/**
 * Word/segment in the edit request (words-first format)
 * For segment-level editing, use type: "segment_text"
 */
export interface EditWord {
  id: number
  text: string
  start: number
  end: number
  speaker_id: number | null
  type: 'word' | 'segment_text'
}

/**
 * Edit request data structure (TranscriptionData format)
 */
export interface EditedData {
  words: EditWord[]
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
  /** All analyses for this entry - for client-side caching by profile */
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
  llm_provider: string
  llm_model: string
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

// =============================================================================
// Options Endpoint Types
// =============================================================================

/**
 * Information about a single model
 */
export interface ModelInfo {
  id: string
  name: string
  owned_by?: string
  context_window?: number
  size?: string
  speed?: string
  active?: boolean
}

/**
 * Parameter configuration
 */
export interface ParameterConfig {
  type: string
  min?: number
  max?: number
  default?: number | string
  description: string
}

/**
 * Service options for transcription or LLM
 */
export interface ServiceOptions {
  provider: string
  available_providers: string[]
  models: ModelInfo[]
  parameters: Record<string, ParameterConfig>
}

/**
 * Response from GET /api/options
 */
export interface OptionsResponse {
  transcription: ServiceOptions
  llm: ServiceOptions
}
