import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTranscription } from './useTranscription'
import type { Segment } from '@/components/demo/types'
import * as api from './api'
import * as storage from '@/lib/storage'
import { ApiError } from './types'

// Mock the API module
vi.mock('./api', () => ({
  uploadAndTranscribe: vi.fn(),
  getTranscriptionStatus: vi.fn(),
  getCleanedEntry: vi.fn(),
  saveUserEdit: vi.fn(),
  revertUserEdit: vi.fn(),
  parseRateLimitHeaders: vi.fn(),
  getRateLimits: vi.fn(),
  getDemoEntry: vi.fn(),
  getDemoAudioUrl: vi.fn(),
  getEntry: vi.fn(),
}))

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  addEntryId: vi.fn(),
  cacheEntry: vi.fn(),
}))

// Test segments for use in tests
const TEST_SEGMENTS: Segment[] = [
  {
    id: 'seg-1',
    speaker: 0,
    time: '0:00 – 0:18',
    rawText: 'Uh so basically what we are trying to do.',
    cleanedText: 'So basically what we are trying to do.',
    originalRawText: 'Uh so basically what we are trying to do.',
  },
  {
    id: 'seg-2',
    speaker: 1,
    time: '0:19 – 0:42',
    rawText: 'Yeah I think we should start with research.',
    cleanedText: 'Yes, I think we should start with research.',
    originalRawText: 'Yeah I think we should start with research.',
  },
]

describe('useTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // Initialization
  // ===========================================================================

  describe('initialization', () => {
    it('initializes with custom segments', () => {
      const customSegments: Segment[] = [
        { id: 'custom-1', speaker: 1, time: '0:00 – 0:10', rawText: 'raw', cleanedText: 'clean', originalRawText: 'raw' },
      ]

      const { result } = renderHook(() =>
        useTranscription({ initialSegments: customSegments })
      )

      expect(result.current.segments).toHaveLength(1)
      expect(result.current.segments[0].id).toBe('custom-1')
    })

    it('initializes empty when no initial segments', () => {
      const { result } = renderHook(() => useTranscription())

      expect(result.current.segments).toHaveLength(0)
      expect(result.current.status).toBe('idle')
    })

    it('segments have parsed time fields', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segment = result.current.segments[0]
      expect(segment.startTime).toBeDefined()
      expect(segment.endTime).toBeDefined()
      expect(typeof segment.startTime).toBe('number')
    })

    it('exposes cleanupId and rateLimits in return value', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      // cleanupId is null initially (set by loadEntry or uploadAudio)
      expect(result.current.cleanupId).toBeNull()
      expect(result.current.rateLimits).toBeNull()
    })
  })

  // ===========================================================================
  // Segment Mutations
  // ===========================================================================

  describe('updateSegmentCleanedText', () => {
    it('updates the cleaned text of a segment', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segmentId = result.current.segments[0].id
      const newText = 'Updated cleaned text'

      await act(async () => {
        await result.current.updateSegmentCleanedText(segmentId, newText)
      })

      const updatedSegment = result.current.segments.find((s) => s.id === segmentId)
      expect(updatedSegment?.cleanedText).toBe(newText)
    })

    it('does not affect other segments', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const originalSecondSegment = result.current.segments[1].cleanedText

      await act(async () => {
        await result.current.updateSegmentCleanedText(result.current.segments[0].id, 'New text')
      })

      expect(result.current.segments[1].cleanedText).toBe(originalSecondSegment)
    })

    it('clears reverted status when text is updated', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segmentId = result.current.segments[0].id

      // First revert
      await act(async () => {
        await result.current.revertSegmentToRaw(segmentId)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(true)

      // Then update
      await act(async () => {
        await result.current.updateSegmentCleanedText(segmentId, 'New text')
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(false)
    })
  })

  describe('revertSegmentToRaw', () => {
    it('sets cleaned text to raw text', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segment = result.current.segments[0]
      const originalRawText = segment.rawText

      await act(async () => {
        await result.current.revertSegmentToRaw(segment.id)
      })

      const updatedSegment = result.current.segments.find((s) => s.id === segment.id)
      expect(updatedSegment?.cleanedText).toBe(originalRawText)
    })

    it('returns the original cleaned text', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segment = result.current.segments[0]
      const originalCleanedText = segment.cleanedText

      let returnedText: string | undefined

      await act(async () => {
        returnedText = await result.current.revertSegmentToRaw(segment.id)
      })

      expect(returnedText).toBe(originalCleanedText)
    })

    it('returns undefined for non-existent segment', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      let returnedText: string | undefined

      await act(async () => {
        returnedText = await result.current.revertSegmentToRaw('non-existent-id')
      })

      expect(returnedText).toBeUndefined()
    })

    it('marks segment as reverted', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segmentId = result.current.segments[0].id

      expect(result.current.isSegmentReverted(segmentId)).toBe(false)

      await act(async () => {
        await result.current.revertSegmentToRaw(segmentId)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(true)
    })
  })

  describe('undoRevert', () => {
    it('restores the original cleaned text', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segment = result.current.segments[0]
      const originalCleanedText = segment.cleanedText

      await act(async () => {
        await result.current.revertSegmentToRaw(segment.id)
      })

      // Now cleaned text is raw text
      expect(result.current.segments[0].cleanedText).toBe(segment.rawText)

      act(() => {
        result.current.undoRevert(segment.id, originalCleanedText)
      })

      // Restored to original cleaned text
      expect(result.current.segments[0].cleanedText).toBe(originalCleanedText)
    })

    it('clears reverted status', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segmentId = result.current.segments[0].id
      const originalCleanedText = result.current.segments[0].cleanedText

      await act(async () => {
        await result.current.revertSegmentToRaw(segmentId)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(true)

      act(() => {
        result.current.undoRevert(segmentId, originalCleanedText)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(false)
    })
  })

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  describe('getSegmentById', () => {
    it('returns segment by ID', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const firstSegment = result.current.segments[0]
      const found = result.current.getSegmentById(firstSegment.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(firstSegment.id)
    })

    it('returns undefined for non-existent ID', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const found = result.current.getSegmentById('non-existent')
      expect(found).toBeUndefined()
    })
  })

  describe('getSegmentAtTime', () => {
    it('returns segment at specified time', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      // First segment starts at 0:00 (0 seconds)
      const segment = result.current.getSegmentAtTime(5)
      expect(segment).toBeDefined()
      expect(segment?.id).toBe(result.current.segments[0].id)
    })

    it('returns undefined for time outside all segments', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const segment = result.current.getSegmentAtTime(10000)
      expect(segment).toBeUndefined()
    })
  })

  describe('reset', () => {
    it('resets to initial state', async () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      const originalFirstCleanedText = result.current.segments[0].cleanedText

      // Make some changes
      await act(async () => {
        await result.current.updateSegmentCleanedText(result.current.segments[0].id, 'Modified')
        await result.current.revertSegmentToRaw(result.current.segments[1].id)
      })

      // Reset
      act(() => {
        result.current.reset()
      })

      // Should be back to original state
      expect(result.current.segments[0].cleanedText).toBe(originalFirstCleanedText)
      expect(result.current.isSegmentReverted(result.current.segments[1].id)).toBe(false)
    })
  })

  describe('state properties', () => {
    it('has correct initial state values', () => {
      const { result } = renderHook(() => useTranscription({ initialSegments: TEST_SEGMENTS }))

      expect(result.current.error).toBeNull()
      expect(result.current.uploadProgress).toBe(0)
    })
  })

  // ===========================================================================
  // API Mode Upload
  // ===========================================================================

  describe('uploadAudio', () => {
    it('uploads and polls for completion', async () => {
      // Mock successful API responses - wrapped in { data, rateLimitInfo } format
      vi.mocked(api.uploadAndTranscribe).mockResolvedValue({
        data: {
          entry_id: 'entry-123',
          transcription_id: 'trans-123',
          cleanup_id: 'cleanup-123',
          transcription_status: 'processing',
          cleanup_status: 'pending',
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.getTranscriptionStatus).mockResolvedValue({
        data: {
          id: 'trans-123',
          status: 'completed',
          text: 'Hello world',
          segments: [
            { id: 'seg-1', start: 0, end: 5, text: 'Hello world', speaker_id: 0 },
          ],
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          voice_entry_id: 'entry-123',
          transcription_id: 'trans-123',
          user_id: 'user-123',
          cleaned_text: 'Hello world.',
          user_edited_text: null,
          status: 'completed',
          llm_provider: 'openai',
          llm_model: 'gpt-4',
          is_primary: true,
          created_at: new Date().toISOString(),
          cleaned_segments: [
            { id: 'clean-1', start: 0, end: 5, text: 'Hello world.', speaker_id: 0 },
          ],
        },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() => useTranscription())

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' })

      await act(async () => {
        await result.current.uploadAudio(file, 1)
      })

      expect(api.uploadAndTranscribe).toHaveBeenCalledWith(file, {
        speakerCount: 1,
        enableDiarization: false,
        enableAnalysis: true,
      })

      expect(result.current.status).toBe('complete')
      expect(result.current.entryId).toBe('entry-123')
      expect(result.current.cleanupId).toBe('cleanup-123')
      expect(result.current.segments).toHaveLength(1)
      expect(result.current.segments[0].rawText).toBe('Hello world')
      expect(result.current.segments[0].cleanedText).toBe('Hello world.')
    })

    it('handles rate limit error', async () => {
      const rateLimitInfo = {
        day: { limit: 20, remaining: 0, reset: Date.now() / 1000 + 86400 },
        ip_day: { limit: 20, remaining: 10, reset: Date.now() / 1000 + 86400 },
        global_day: { limit: 1000, remaining: 500, reset: Date.now() / 1000 + 86400 },
      }

      vi.mocked(api.uploadAndTranscribe).mockRejectedValue(
        new ApiError(429, 'Rate limit exceeded', rateLimitInfo, {
          error: 'rate_limit_exceeded',
          message: 'Daily limit reached',
          limit_type: 'day',
          retry_after: 86400,
          limits: rateLimitInfo,
        })
      )

      const { result } = renderHook(() => useTranscription())

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' })

      await act(async () => {
        await result.current.uploadAudio(file, 1)
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Daily limit reached')
      expect(result.current.rateLimits).toEqual(rateLimitInfo)
    })

    it('handles transcription failure', async () => {
      vi.mocked(api.uploadAndTranscribe).mockResolvedValue({
        data: {
          entry_id: 'entry-123',
          transcription_id: 'trans-123',
          cleanup_id: 'cleanup-123',
          transcription_status: 'processing',
          cleanup_status: 'pending',
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.getTranscriptionStatus).mockResolvedValue({
        data: {
          id: 'trans-123',
          status: 'failed',
          error: 'Audio too short',
        },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() => useTranscription())

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' })

      await act(async () => {
        await result.current.uploadAudio(file, 1)
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Audio too short')
    })

    it('caches entry in localStorage', async () => {
      vi.mocked(api.uploadAndTranscribe).mockResolvedValue({
        data: {
          entry_id: 'entry-123',
          transcription_id: 'trans-123',
          cleanup_id: 'cleanup-123',
          transcription_status: 'processing',
          cleanup_status: 'pending',
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.getTranscriptionStatus).mockResolvedValue({
        data: {
          id: 'trans-123',
          status: 'completed',
          segments: [],
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          entry_id: 'entry-123',
          cleaned_text: '',
          user_edited_text: null,
          status: 'completed',
          segments: [],
        },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() => useTranscription())

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' })

      await act(async () => {
        await result.current.uploadAudio(file, 1)
      })

      expect(storage.addEntryId).toHaveBeenCalledWith('entry-123')
      expect(storage.cacheEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'entry-123',
          filename: 'test.mp3',
        })
      )
    })
  })

  // ===========================================================================
  // Segment Editing with API
  // ===========================================================================

  describe('segment editing with API', () => {
    it('calls saveUserEdit API when updating segment', async () => {
      vi.mocked(api.saveUserEdit).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          entry_id: 'entry-123',
          cleaned_text: 'Updated text',
          user_edited_text: 'Updated text',
          status: 'completed',
          segments: [],
        },
        rateLimitInfo: null,
      })

      const customSegments: Segment[] = [
        { id: 'seg-1', speaker: 1, time: '0:00 – 0:10', rawText: 'raw', cleanedText: 'clean', originalRawText: 'raw' },
      ]

      const { result } = renderHook(() =>
        useTranscription({ initialSegments: customSegments })
      )

      // Setup with upload to get a cleanup ID
      await act(async () => {
        vi.mocked(api.uploadAndTranscribe).mockResolvedValue({
          data: {
            entry_id: 'entry-123',
            transcription_id: 'trans-123',
            cleanup_id: 'cleanup-123',
            transcription_status: 'completed',
            cleanup_status: 'completed',
          },
          rateLimitInfo: null,
        })
        vi.mocked(api.getTranscriptionStatus).mockResolvedValue({
          data: {
            id: 'trans-123',
            status: 'completed',
            segments: [{ id: 'seg-1', start: 0, end: 10, text: 'raw' }],
          },
          rateLimitInfo: null,
        })
        vi.mocked(api.getCleanedEntry).mockResolvedValue({
          data: {
            id: 'cleanup-123',
            entry_id: 'entry-123',
            cleaned_text: 'clean',
            user_edited_text: null,
            status: 'completed',
            segments: [{ id: 'clean-1', start: 0, end: 10, text: 'clean' }],
          },
          rateLimitInfo: null,
        })

        await result.current.uploadAudio(new File(['test'], 'test.mp3'), 1)
      })

      await act(async () => {
        await result.current.updateSegmentCleanedText('seg-1', 'Updated text')
      })

      // API now expects words-first format with EditedData object
      expect(api.saveUserEdit).toHaveBeenCalledWith(
        'cleanup-123',
        expect.objectContaining({
          words: expect.arrayContaining([
            expect.objectContaining({
              text: 'Updated text',
              type: 'segment_text',
            }),
          ]),
        })
      )
    })

    it('calls saveUserEdit API when reverting segment (words-first format)', async () => {
      vi.mocked(api.saveUserEdit).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          entry_id: 'entry-123',
          cleaned_text: 'raw text',
          user_edited_text: null,
          status: 'completed',
          segments: [],
        },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() => useTranscription())

      // Setup with upload
      await act(async () => {
        vi.mocked(api.uploadAndTranscribe).mockResolvedValue({
          data: {
            entry_id: 'entry-123',
            transcription_id: 'trans-123',
            cleanup_id: 'cleanup-123',
            transcription_status: 'completed',
            cleanup_status: 'completed',
          },
          rateLimitInfo: null,
        })
        vi.mocked(api.getTranscriptionStatus).mockResolvedValue({
          data: {
            id: 'trans-123',
            status: 'completed',
            segments: [{ id: 'seg-1', start: 0, end: 10, text: 'raw text' }],
          },
          rateLimitInfo: null,
        })
        vi.mocked(api.getCleanedEntry).mockResolvedValue({
          data: {
            id: 'cleanup-123',
            entry_id: 'entry-123',
            cleaned_text: 'clean text',
            user_edited_text: null,
            status: 'completed',
            segments: [{ id: 'clean-1', start: 0, end: 10, text: 'clean text' }],
          },
          rateLimitInfo: null,
        })

        await result.current.uploadAudio(new File(['test'], 'test.mp3'), 1)
      })

      await act(async () => {
        await result.current.revertSegmentToRaw('seg-1')
      })

      // Revert now uses saveUserEdit with raw text (not revertUserEdit)
      expect(api.saveUserEdit).toHaveBeenCalledWith(
        'cleanup-123',
        expect.objectContaining({
          words: expect.arrayContaining([
            expect.objectContaining({
              text: 'raw text',
              type: 'segment_text',
            }),
          ]),
        })
      )
    })
  })
})
