// API client for transcription endpoints

import type {
  AnalysisJob,
  AnalysisProfile,
  AnalysisResult,
  CleanedEntry,
  CleanupSummary,
  CleanupType,
  EditedData,
  EntryDetails,
  Feedback,
  FeedbackPayload,
  OptionsResponse,
  PaginatedEntries,
  PaginationParams,
  RateLimitError,
  RateLimitInfo,
  TranscribeOptions,
  TranscribeResponse,
  TranscriptionStatus,
  WaitlistPayload,
} from './types'
import { ApiError } from './types'
import { clearSession } from '@/lib/session'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

// =============================================================================
// Rate Limit Header Parsing
// =============================================================================

/**
 * Parse rate limit headers from a Response object
 */
export function parseRateLimitHeaders(response: Response): RateLimitInfo | null {
  const dayLimit = response.headers.get('X-RateLimit-Limit-Day')
  const dayRemaining = response.headers.get('X-RateLimit-Remaining-Day')
  const reset = response.headers.get('X-RateLimit-Reset')

  // If no rate limit headers present, return null
  if (!dayLimit || !dayRemaining || !reset) {
    return null
  }

  const resetTimestamp = parseInt(reset, 10)

  return {
    day: {
      limit: parseInt(dayLimit, 10),
      remaining: parseInt(dayRemaining, 10),
      reset: resetTimestamp,
    },
    // IP and global limits use same day reset (not exposed via headers)
    ip_day: {
      limit: parseInt(dayLimit, 10),
      remaining: parseInt(dayRemaining, 10),
      reset: resetTimestamp,
    },
    global_day: {
      limit: parseInt(dayLimit, 10),
      remaining: parseInt(dayRemaining, 10),
      reset: resetTimestamp,
    },
  }
}

// =============================================================================
// Core Request Helper
// =============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: FormData | Record<string, unknown>
  headers?: Record<string, string>
}

/**
 * Make an API request with error handling and rate limit parsing
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ data: T; rateLimitInfo: RateLimitInfo | null }> {
  const { method = 'GET', body, headers = {} } = options

  const fetchOptions: RequestInit = {
    method,
    credentials: 'include', // Include cookies for session
    headers: {
      ...headers,
    },
  }

  // Handle body - FormData or JSON
  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body
      // Don't set Content-Type for FormData - browser will set it with boundary
    } else {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      }
      fetchOptions.body = JSON.stringify(body)
    }
  }

  const url = `${API_BASE_URL}${endpoint}`

  let response: Response
  try {
    response = await fetch(url, fetchOptions)
  } catch {
    throw new ApiError(0, 'Network error: Unable to connect to server')
  }

  const rateLimitInfo = parseRateLimitHeaders(response)

  if (!response.ok) {
    // Handle rate limit error (429)
    if (response.status === 429) {
      let rateLimitError: RateLimitError | undefined
      try {
        const errorBody = await response.json()
        if (errorBody.error === 'rate_limit_exceeded') {
          rateLimitError = errorBody as RateLimitError
        }
      } catch {
        // If we can't parse the error body, continue without it
      }

      throw new ApiError(
        429,
        rateLimitError?.message || 'Rate limit exceeded',
        rateLimitError?.limits || rateLimitInfo || undefined,
        rateLimitError
      )
    }

    // Handle session expired (401) - retry once after clearing session
    if (response.status === 401) {
      // Clear local session data
      clearSession()

      // Retry the request once - server will create a new session via cookie
      try {
        const retryResponse = await fetch(url, fetchOptions)
        if (retryResponse.ok) {
          const retryRateLimitInfo = parseRateLimitHeaders(retryResponse)
          const contentType = retryResponse.headers.get('Content-Type')
          let retryData: T
          if (contentType?.includes('application/json')) {
            retryData = await retryResponse.json()
          } else {
            retryData = {} as T
          }
          return { data: retryData, rateLimitInfo: retryRateLimitInfo }
        }
      } catch {
        // If retry also fails, throw the original 401 error
      }

      throw new ApiError(401, 'Session expired. Please refresh the page.', rateLimitInfo || undefined)
    }

    // Handle other errors
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorBody = await response.json()
      if (errorBody.detail) {
        errorMessage = typeof errorBody.detail === 'string'
          ? errorBody.detail
          : JSON.stringify(errorBody.detail)
      } else if (errorBody.message) {
        errorMessage = errorBody.message
      }
    } catch {
      // If we can't parse the error body, use the status text
      errorMessage = response.statusText || errorMessage
    }

    throw new ApiError(response.status, errorMessage, rateLimitInfo || undefined)
  }

  // Parse successful response
  let data: T
  const contentType = response.headers.get('Content-Type')
  if (contentType?.includes('application/json')) {
    data = await response.json()
  } else {
    // For non-JSON responses (like audio streaming), return empty object
    data = {} as T
  }

  return { data, rateLimitInfo }
}

// =============================================================================
// Rate Limit Endpoints
// =============================================================================

/**
 * Get current rate limit status without consuming a request.
 * Call this on page load to display current limits.
 */
export async function getRateLimits(): Promise<RateLimitInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rate-limits`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      return null
    }

    return parseRateLimitHeaders(response)
  } catch {
    return null
  }
}

// =============================================================================
// Options Endpoint
// =============================================================================

/**
 * Get available transcription and LLM options (models, parameters)
 */
export async function getOptions(): Promise<{
  data: OptionsResponse
  rateLimitInfo: RateLimitInfo | null
}> {
  return request<OptionsResponse>('/api/options')
}

// =============================================================================
// Transcription Endpoints
// =============================================================================

/**
 * Upload audio file and start transcription + cleanup + analysis
 */
export async function uploadAndTranscribe(
  file: File,
  options: TranscribeOptions = {}
): Promise<{ data: TranscribeResponse; rateLimitInfo: RateLimitInfo | null }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('language', options.language ?? 'sl')
  formData.append('enable_diarization', String(options.enableDiarization ?? true))
  formData.append('speaker_count', String(options.speakerCount ?? 2))
  formData.append('enable_analysis', String(options.enableAnalysis ?? true))
  formData.append('analysis_profile', options.analysisProfile ?? 'generic-summary')

  // Cleanup options
  formData.append('cleanup_type', options.cleanupType ?? 'corrected')
  if (options.llmModel) {
    formData.append('llm_model', options.llmModel)
  }

  // Analysis options (separate from cleanup)
  if (options.analysisLlmModel) {
    formData.append('analysis_llm_model', options.analysisLlmModel)
  }

  return request<TranscribeResponse>('/api/transcribe', {
    method: 'POST',
    body: formData,
  })
}

/**
 * Get transcription status, text, and segments
 */
export async function getTranscriptionStatus(
  transcriptionId: string
): Promise<{ data: TranscriptionStatus; rateLimitInfo: RateLimitInfo | null }> {
  return request<TranscriptionStatus>(`/api/transcriptions/${transcriptionId}`)
}

// =============================================================================
// Entry Endpoints
// =============================================================================

/**
 * List all entries for the current session
 */
export async function getEntries(
  params: PaginationParams = {}
): Promise<{ data: PaginatedEntries; rateLimitInfo: RateLimitInfo | null }> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.append('limit', String(params.limit))
  if (params.offset) searchParams.append('offset', String(params.offset))
  if (params.entry_type) searchParams.append('entry_type', params.entry_type)

  const query = searchParams.toString()
  const endpoint = query ? `/api/entries?${query}` : '/api/entries'

  return request<PaginatedEntries>(endpoint)
}

/**
 * Get entry details with transcription
 */
export async function getEntry(
  entryId: string
): Promise<{ data: EntryDetails; rateLimitInfo: RateLimitInfo | null }> {
  return request<EntryDetails>(`/api/entries/${entryId}`)
}

/**
 * Delete an entry and all associated data
 */
export async function deleteEntry(
  entryId: string
): Promise<{ data: void; rateLimitInfo: RateLimitInfo | null }> {
  return request<void>(`/api/entries/${entryId}`, { method: 'DELETE' })
}

/**
 * Get the audio URL for an entry (for streaming/downloading)
 */
export function getEntryAudioUrl(entryId: string): string {
  return `${API_BASE_URL}/api/entries/${entryId}/audio`
}

/**
 * Get all cleanup records for an entry (for cache indicator)
 */
export async function getCleanedEntries(
  entryId: string
): Promise<{ data: CleanupSummary[]; rateLimitInfo: RateLimitInfo | null }> {
  return request<CleanupSummary[]>(`/api/entries/${entryId}/cleaned`)
}

// =============================================================================
// Cleanup Endpoints
// =============================================================================

/**
 * Get cleaned entry with segments and spellcheck info
 */
export async function getCleanedEntry(
  cleanupId: string
): Promise<{ data: CleanedEntry; rateLimitInfo: RateLimitInfo | null }> {
  return request<CleanedEntry>(`/api/cleaned-entries/${cleanupId}`)
}

/**
 * Options for triggering cleanup
 */
export interface TriggerCleanupOptions {
  cleanupType?: CleanupType
  llmModel?: string
}

/**
 * Trigger cleanup for a completed transcription.
 * Used for entries that have transcription but no cleanup (e.g., demo entries).
 */
export async function triggerCleanup(
  transcriptionId: string,
  options: TriggerCleanupOptions = {}
): Promise<{ data: { id: string; status: string }; rateLimitInfo: RateLimitInfo | null }> {
  const body: Record<string, string> = {}
  if (options.cleanupType) {
    body.cleanup_type = options.cleanupType
  }
  if (options.llmModel) {
    body.llm_model = options.llmModel
  }

  return request<{ id: string; status: string }>(`/api/transcriptions/${transcriptionId}/cleanup`, {
    method: 'POST',
    body: Object.keys(body).length > 0 ? body : undefined,
  })
}

/**
 * Save user edits to cleaned text (words-first format)
 */
export async function saveUserEdit(
  cleanupId: string,
  editedData: EditedData
): Promise<{ data: CleanedEntry; rateLimitInfo: RateLimitInfo | null }> {
  return request<CleanedEntry>(`/api/cleaned-entries/${cleanupId}/user-edit`, {
    method: 'PUT',
    body: { edited_data: editedData },
  })
}

/**
 * Revert to AI-generated cleaned text
 */
export async function revertUserEdit(
  cleanupId: string
): Promise<{ data: CleanedEntry; rateLimitInfo: RateLimitInfo | null }> {
  return request<CleanedEntry>(`/api/cleaned-entries/${cleanupId}/user-edit`, {
    method: 'DELETE',
  })
}

// =============================================================================
// Analysis Endpoints
// =============================================================================

/**
 * List available analysis profiles
 */
export async function getAnalysisProfiles(): Promise<{
  data: AnalysisProfile[]
  defaultProfileId: string
  rateLimitInfo: RateLimitInfo | null
}> {
  const result = await request<{ profiles: AnalysisProfile[] }>('/api/analysis-profiles')
  const profiles = result.data.profiles
  const defaultProfileId = profiles.find(p => p.is_default)?.id ?? 'generic-summary'
  return {
    data: profiles,
    defaultProfileId,
    rateLimitInfo: result.rateLimitInfo,
  }
}

/**
 * Options for triggering analysis
 */
export interface TriggerAnalysisOptions {
  profileId?: string
  llmModel?: string
}

/**
 * Trigger analysis on a cleaned entry
 */
export async function triggerAnalysis(
  cleanupId: string,
  options: TriggerAnalysisOptions = {}
): Promise<{ data: AnalysisJob; rateLimitInfo: RateLimitInfo | null }> {
  const body: Record<string, string> = {
    profile_id: options.profileId ?? 'generic-summary',
  }
  if (options.llmModel) {
    body.llm_model = options.llmModel
  }

  return request<AnalysisJob>(`/api/cleaned-entries/${cleanupId}/analyze`, {
    method: 'POST',
    body,
  })
}

/**
 * Get analysis status and results
 */
export async function getAnalysis(
  analysisId: string
): Promise<{ data: AnalysisResult; rateLimitInfo: RateLimitInfo | null }> {
  return request<AnalysisResult>(`/api/analyses/${analysisId}`)
}

/**
 * List all analyses for a cleaned entry
 */
export async function getAnalyses(
  cleanupId: string
): Promise<{ data: AnalysisResult[]; rateLimitInfo: RateLimitInfo | null }> {
  const result = await request<{ analyses: AnalysisResult[] }>(
    `/api/cleaned-entries/${cleanupId}/analyses`
  )
  return {
    data: result.data.analyses,
    rateLimitInfo: result.rateLimitInfo,
  }
}

// =============================================================================
// Feedback Endpoints
// =============================================================================

/**
 * Submit feedback for an entry
 */
export async function submitFeedback(
  entryId: string,
  payload: FeedbackPayload
): Promise<{ data: Feedback; rateLimitInfo: RateLimitInfo | null }> {
  return request<Feedback>(`/api/entries/${entryId}/feedback`, {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  })
}

/**
 * Get all feedback for an entry
 */
export async function getFeedback(
  entryId: string
): Promise<{ data: Feedback[]; rateLimitInfo: RateLimitInfo | null }> {
  return request<Feedback[]>(`/api/entries/${entryId}/feedback`)
}

// =============================================================================
// Waitlist Endpoints
// =============================================================================

/**
 * Join the waitlist
 */
export async function joinWaitlist(
  payload: WaitlistPayload
): Promise<{ data: { message: string }; rateLimitInfo: RateLimitInfo | null }> {
  return request<{ message: string }>('/api/waitlist', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  })
}

