import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseRateLimitHeaders,
  uploadAndTranscribe,
  getTranscriptionStatus,
  getEntries,
  getEntry,
  deleteEntry,
  getEntryAudioUrl,
  getCleanedEntry,
  saveUserEdit,
  revertUserEdit,
  getAnalysisProfiles,
  triggerAnalysis,
  getAnalysis,
  submitFeedback,
  getFeedback,
  joinWaitlist,
  API_BASE_URL,
} from './api'
import { ApiError } from './types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // Rate Limit Header Parsing
  // ==========================================================================

  describe('parseRateLimitHeaders', () => {
    it('parses all rate limit headers correctly', () => {
      const headers = new Headers({
        'X-RateLimit-Limit-Day': '20',
        'X-RateLimit-Remaining-Day': '15',
        'X-RateLimit-Reset': '1703548800',
      })
      const response = new Response(null, { headers })

      const result = parseRateLimitHeaders(response)

      expect(result).not.toBeNull()
      expect(result!.day.limit).toBe(20)
      expect(result!.day.remaining).toBe(15)
      expect(result!.day.reset).toBe(1703548800)
    })

    it('returns null when headers are missing', () => {
      const response = new Response(null)

      const result = parseRateLimitHeaders(response)

      expect(result).toBeNull()
    })

    it('returns null when some headers are missing', () => {
      const headers = new Headers({
        'X-RateLimit-Limit-Day': '20',
        // Missing other headers
      })
      const response = new Response(null, { headers })

      const result = parseRateLimitHeaders(response)

      expect(result).toBeNull()
    })
  })

  // ==========================================================================
  // Transcription Endpoints
  // ==========================================================================

  describe('uploadAndTranscribe', () => {
    it('sends file and options correctly', async () => {
      const mockResponse = {
        entry_id: 'entry-123',
        transcription_id: 'trans-123',
        cleanup_id: 'cleanup-123',
        transcription_status: 'processing',
        cleanup_status: 'pending',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' })
      const result = await uploadAndTranscribe(file, {
        language: 'en',
        speakerCount: 3,
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/transcribe`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      )

      // Verify FormData was sent
      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].body).toBeInstanceOf(FormData)

      expect(result.data).toEqual(mockResponse)
    })

    it('uses default options when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ entry_id: 'test' }),
      })

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' })
      await uploadAndTranscribe(file)

      const callArgs = mockFetch.mock.calls[0]
      const formData = callArgs[1].body as FormData
      expect(formData.get('language')).toBe('sl')
      expect(formData.get('enable_diarization')).toBe('true')
      expect(formData.get('speaker_count')).toBe('2')
    })
  })

  describe('getTranscriptionStatus', () => {
    it('fetches transcription status', async () => {
      const mockResponse = {
        id: 'trans-123',
        status: 'completed',
        text: 'Transcribed text',
        segments: [{ id: 'seg-1', start: 0, end: 10, text: 'Hello' }],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getTranscriptionStatus('trans-123')

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/transcriptions/trans-123`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      )
      expect(result.data).toEqual(mockResponse)
    })
  })

  // ==========================================================================
  // Entry Endpoints
  // ==========================================================================

  describe('getEntries', () => {
    it('fetches entries without params', async () => {
      const mockResponse = {
        entries: [],
        total: 0,
        limit: 20,
        offset: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      await getEntries()

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/entries`,
        expect.any(Object)
      )
    })

    it('includes pagination params in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ entries: [] }),
      })

      await getEntries({ limit: 10, offset: 5 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=5'),
        expect.any(Object)
      )
    })
  })

  describe('getEntry', () => {
    it('fetches single entry by ID', async () => {
      const mockResponse = {
        id: 'entry-123',
        filename: 'test.mp3',
        duration: 60,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getEntry('entry-123')

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/entries/entry-123`,
        expect.any(Object)
      )
      expect(result.data.id).toBe('entry-123')
    })
  })

  describe('deleteEntry', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({}),
      })

      await deleteEntry('entry-123')

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/entries/entry-123`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('getEntryAudioUrl', () => {
    it('returns correct audio URL', () => {
      const url = getEntryAudioUrl('entry-123')
      expect(url).toBe(`${API_BASE_URL}/api/entries/entry-123/audio`)
    })
  })

  // ==========================================================================
  // Cleanup Endpoints
  // ==========================================================================

  describe('getCleanedEntry', () => {
    it('fetches cleaned entry', async () => {
      const mockResponse = {
        id: 'cleanup-123',
        entry_id: 'entry-123',
        cleaned_text: 'Cleaned text',
        segments: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getCleanedEntry('cleanup-123')

      expect(result.data.id).toBe('cleanup-123')
    })
  })

  describe('saveUserEdit', () => {
    it('sends PUT request with edited text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ id: 'cleanup-123' }),
      })

      await saveUserEdit('cleanup-123', 'Edited text')

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/cleaned-entries/cleanup-123/user-edit`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ edited_text: 'Edited text' }),
        })
      )
    })
  })

  describe('revertUserEdit', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ id: 'cleanup-123' }),
      })

      await revertUserEdit('cleanup-123')

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/cleaned-entries/cleanup-123/user-edit`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  // ==========================================================================
  // Analysis Endpoints
  // ==========================================================================

  describe('getAnalysisProfiles', () => {
    it('fetches and unwraps profiles array', async () => {
      const mockResponse = {
        profiles: [
          { id: 'profile-1', label: 'Summary', is_default: true },
          { id: 'profile-2', label: 'Action Items', is_default: false },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getAnalysisProfiles()

      expect(result.data).toHaveLength(2)
      expect(result.data[0].id).toBe('profile-1')
    })
  })

  describe('triggerAnalysis', () => {
    it('sends POST request with profile ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ id: 'analysis-123', status: 'processing' }),
      })

      await triggerAnalysis('cleanup-123', 'action-items')

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/cleaned-entries/cleanup-123/analyze`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ profile_id: 'action-items' }),
        })
      )
    })

    it('uses default profile when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ id: 'analysis-123' }),
      })

      await triggerAnalysis('cleanup-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ profile_id: 'generic-conversation-summary' }),
        })
      )
    })
  })

  describe('getAnalysis', () => {
    it('fetches analysis result', async () => {
      const mockResponse = {
        id: 'analysis-123',
        status: 'completed',
        result: { summary: 'Test summary' },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getAnalysis('analysis-123')

      expect(result.data.status).toBe('completed')
    })
  })

  // ==========================================================================
  // Feedback Endpoints
  // ==========================================================================

  describe('submitFeedback', () => {
    it('sends POST request with feedback payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ id: 'feedback-123' }),
      })

      await submitFeedback('entry-123', {
        feedback_type: 'transcription',
        rating: 4,
        feedback_text: 'Good quality',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/entries/entry-123/feedback`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            feedback_type: 'transcription',
            rating: 4,
            feedback_text: 'Good quality',
          }),
        })
      )
    })
  })

  describe('getFeedback', () => {
    it('fetches feedback for entry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve([{ id: 'fb-1' }, { id: 'fb-2' }]),
      })

      const result = await getFeedback('entry-123')

      expect(result.data).toHaveLength(2)
    })
  })

  // ==========================================================================
  // Waitlist Endpoints
  // ==========================================================================

  describe('joinWaitlist', () => {
    it('sends POST request with waitlist payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Thank you for joining!' }),
      })

      await joinWaitlist({
        email: 'test@example.com',
        waitlist_type: 'api_access',
        use_case: 'Testing',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/waitlist`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            waitlist_type: 'api_access',
            use_case: 'Testing',
          }),
        })
      )
    })
  })

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('throws ApiError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      try {
        await getEntry('entry-123')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(0)
        expect((error as ApiError).message).toContain('Network error')
      }
    })

    it('throws ApiError with status 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Entry not found' }),
      })

      try {
        await getEntry('non-existent')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).isNotFound).toBe(true)
        expect((error as ApiError).message).toBe('Entry not found')
      }
    })

    it('throws ApiError with rate limit info on 429', async () => {
      const rateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Daily limit reached',
        limit_type: 'day',
        retry_after: 1800,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 500, reset: 1703548800 },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-RateLimit-Limit-Day': '20',
          'X-RateLimit-Remaining-Day': '0',
          'X-RateLimit-Reset': '1703548800',
        }),
        json: () => Promise.resolve(rateLimitError),
      })

      try {
        await uploadAndTranscribe(new File([''], 'test.mp3'))
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(429)
        expect((error as ApiError).isRateLimited).toBe(true)
        expect((error as ApiError).rateLimitError).toBeDefined()
        expect((error as ApiError).rateLimitError?.retry_after).toBe(1800)
        expect((error as ApiError).rateLimitError?.limit_type).toBe('day')
      }
    })

    it('throws ApiError on server error (500)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Server error' }),
      })

      try {
        await getEntry('entry-123')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
        expect((error as ApiError).isServerError).toBe(true)
      }
    })

    it('handles non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/html' }),
        json: () => Promise.reject(new Error('Not JSON')),
      })

      try {
        await getEntry('entry-123')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(503)
      }
    })
  })

  // ==========================================================================
  // Rate Limit Info in Responses
  // ==========================================================================

  describe('rate limit info in responses', () => {
    it('includes rate limit info in successful responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-RateLimit-Limit-Day': '20',
          'X-RateLimit-Remaining-Day': '19',
          'X-RateLimit-Reset': '1703548800',
        }),
        json: () => Promise.resolve({ id: 'entry-123' }),
      })

      const result = await getEntry('entry-123')

      expect(result.rateLimitInfo).not.toBeNull()
      expect(result.rateLimitInfo?.day.remaining).toBe(19)
    })

    it('returns null rate limit info when headers missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.resolve({ id: 'entry-123' }),
      })

      const result = await getEntry('entry-123')

      expect(result.rateLimitInfo).toBeNull()
    })
  })
})
