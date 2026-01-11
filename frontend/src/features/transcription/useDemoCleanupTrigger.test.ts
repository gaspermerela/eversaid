import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDemoCleanupTrigger } from './useDemoCleanupTrigger'
import * as api from './api'
import type { EntrySummary } from './types'

// Mock the API module
vi.mock('./api', () => ({
  triggerCleanup: vi.fn(),
  getCleanedEntry: vi.fn(),
  triggerAnalysis: vi.fn(),
}))

// =============================================================================
// Test Data Fixtures
// =============================================================================

const createEntrySummary = (overrides: Partial<EntrySummary> = {}): EntrySummary => ({
  id: 'entry-123',
  original_filename: 'recording.mp3',
  saved_filename: 'saved-123.mp3',
  entry_type: 'audio',
  duration_seconds: 120,
  uploaded_at: '2024-01-01T00:00:00Z',
  primary_transcription: {
    id: 'transcription-123',
    status: 'completed',
    language_code: 'sl',
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  latest_cleaned_entry: {
    id: 'cleanup-123',
    status: 'completed',
    cleaned_text_preview: 'Cleaned text...',
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
    user_edited_text_preview: null,
  },
  ...overrides,
})

const createDemoEntry = (overrides: Partial<EntrySummary> = {}): EntrySummary =>
  createEntrySummary({
    id: 'demo-entry-123',
    original_filename: 'demo-sl.mp3',
    ...overrides,
  })

const createDemoEntryNeedingCleanup = (): EntrySummary =>
  createDemoEntry({
    latest_cleaned_entry: null, // No cleanup yet
  })

describe('useDemoCleanupTrigger', () => {
  const mockOnRefresh = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('initial state', () => {
    it('initializes with isProcessing false', () => {
      const { result } = renderHook(() =>
        useDemoCleanupTrigger({
          entries: [],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(result.current.isProcessing).toBe(false)
    })

    it('does nothing when entries are loading', () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: true, // Still loading
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })

    it('does nothing when entries array is empty', () => {
      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Demo Entry Detection
  // ===========================================================================

  describe('demo entry detection', () => {
    it('does not trigger cleanup for non-demo entries', () => {
      const regularEntry = createEntrySummary({
        original_filename: 'recording.mp3', // Not demo-*.mp3
        latest_cleaned_entry: null,
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [regularEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })

    it('does not trigger cleanup for demo entry with completed cleanup', () => {
      const completedDemoEntry = createDemoEntry({
        latest_cleaned_entry: {
          id: 'cleanup-123',
          status: 'completed',
          cleaned_text_preview: 'Done',
          error_message: null,
          created_at: '2024-01-01T00:00:00Z',
          user_edited_text_preview: null,
        },
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [completedDemoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })

    it('does not trigger cleanup for demo entry with failed cleanup', () => {
      const failedDemoEntry = createDemoEntry({
        latest_cleaned_entry: {
          id: 'cleanup-123',
          status: 'failed',
          cleaned_text_preview: null,
          error_message: 'Cleanup failed',
          created_at: '2024-01-01T00:00:00Z',
          user_edited_text_preview: null,
        },
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [failedDemoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })

    it('does not trigger cleanup when transcription is not completed', () => {
      const pendingTranscription = createDemoEntry({
        primary_transcription: {
          id: 'transcription-123',
          status: 'processing', // Not completed
          language_code: 'sl',
          error_message: null,
          created_at: '2024-01-01T00:00:00Z',
        },
        latest_cleaned_entry: null,
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [pendingTranscription],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })

    it('triggers cleanup for demo entry with no cleanup', async () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'new-cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'new-cleanup-123',
          voice_entry_id: 'demo-entry-123',
          transcription_id: 'transcription-123',
          user_id: 'user-123',
          cleaned_text: 'Cleaned text',
          status: 'completed',
          model_name: 'gpt-4',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          cleanup_data_edited: null,
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'analysis-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).toHaveBeenCalledWith('transcription-123')
    })

    it('triggers cleanup for demo entry with processing cleanup', async () => {
      const processingDemoEntry = createDemoEntry({
        latest_cleaned_entry: {
          id: 'cleanup-123',
          status: 'processing', // Still processing
          cleaned_text_preview: null,
          error_message: null,
          created_at: '2024-01-01T00:00:00Z',
          user_edited_text_preview: null,
        },
      })

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'processing' },
        rateLimitInfo: null,
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [processingDemoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Polling
  // ===========================================================================

  describe('polling', () => {
    it('polls every 2 seconds until cleanup completes', async () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry)
        .mockResolvedValueOnce({
          data: {
            id: 'cleanup-123',
            voice_entry_id: 'demo-entry-123',
            transcription_id: 'transcription-123',
            user_id: 'user-123',
            cleaned_text: null,
            status: 'processing',
            model_name: 'gpt-4',
            is_primary: true,
            created_at: '2024-01-01T00:00:00Z',
            cleanup_data_edited: null,
          },
          rateLimitInfo: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'cleanup-123',
            voice_entry_id: 'demo-entry-123',
            transcription_id: 'transcription-123',
            user_id: 'user-123',
            cleaned_text: 'Cleaned text',
            status: 'completed',
            model_name: 'gpt-4',
            is_primary: true,
            created_at: '2024-01-01T00:00:00Z',
            cleanup_data_edited: null,
          },
          rateLimitInfo: null,
        })

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'analysis-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Should be processing
      expect(result.current.isProcessing).toBe(true)

      // Flush promises to let triggerCleanup complete and set up polling
      await act(async () => {
        await Promise.resolve()
      })

      // First poll after 2 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(api.getCleanedEntry).toHaveBeenCalledTimes(1)

      // Second poll after another 2 seconds - completes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(api.getCleanedEntry).toHaveBeenCalledTimes(2)

      // Should have triggered analysis
      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', 'generic-summary')

      // Should have called refresh
      expect(mockOnRefresh).toHaveBeenCalled()

      // Should no longer be processing
      expect(result.current.isProcessing).toBe(false)
    })

    it('stops polling on cleanup failure', async () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          voice_entry_id: 'demo-entry-123',
          transcription_id: 'transcription-123',
          user_id: 'user-123',
          cleaned_text: null,
          status: 'failed',
          error_message: 'LLM error',
          model_name: 'gpt-4',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          cleanup_data_edited: null,
        },
        rateLimitInfo: null,
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Flush promises to let triggerCleanup complete
      await act(async () => {
        await Promise.resolve()
      })

      // First poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Should have called refresh (to show error status)
      expect(mockOnRefresh).toHaveBeenCalled()

      // Should NOT trigger analysis
      expect(api.triggerAnalysis).not.toHaveBeenCalled()

      // Clear mocks and advance timers - should not poll again
      vi.clearAllMocks()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(api.getCleanedEntry).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Analysis Triggering
  // ===========================================================================

  describe('analysis triggering', () => {
    it('triggers analysis with generic-summary profile after cleanup completes', async () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          voice_entry_id: 'demo-entry-123',
          transcription_id: 'transcription-123',
          user_id: 'user-123',
          cleaned_text: 'Cleaned text',
          status: 'completed',
          model_name: 'gpt-4',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          cleanup_data_edited: null,
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'analysis-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Flush promises to let triggerCleanup complete
      await act(async () => {
        await Promise.resolve()
      })

      // Poll completes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', 'generic-summary')
    })

    it('continues even if analysis trigger fails', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          voice_entry_id: 'demo-entry-123',
          transcription_id: 'transcription-123',
          user_id: 'user-123',
          cleaned_text: 'Cleaned text',
          status: 'completed',
          model_name: 'gpt-4',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          cleanup_data_edited: null,
        },
        rateLimitInfo: null,
      })

      vi.mocked(api.triggerAnalysis).mockRejectedValue(new Error('Analysis failed'))

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Flush promises to let triggerCleanup complete
      await act(async () => {
        await Promise.resolve()
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Should still call refresh even though analysis failed
      expect(mockOnRefresh).toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalled()

      consoleWarn.mockRestore()
    })
  })

  // ===========================================================================
  // Duplicate Prevention
  // ===========================================================================

  describe('duplicate prevention', () => {
    it('does not re-trigger cleanup for already-triggered entries', async () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          voice_entry_id: 'demo-entry-123',
          transcription_id: 'transcription-123',
          user_id: 'user-123',
          cleaned_text: null,
          status: 'processing',
          model_name: 'gpt-4',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          cleanup_data_edited: null,
        },
        rateLimitInfo: null,
      })

      const { rerender } = renderHook(
        (props) => useDemoCleanupTrigger(props),
        {
          initialProps: {
            entries: [demoEntry],
            isLoading: false,
            onRefresh: mockOnRefresh,
          },
        }
      )

      expect(api.triggerCleanup).toHaveBeenCalledTimes(1)

      // Re-render with same entries (simulating refresh)
      rerender({
        entries: [demoEntry],
        isLoading: false,
        onRefresh: mockOnRefresh,
      })

      // Should NOT trigger again
      expect(api.triggerCleanup).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // Multiple Demo Entries
  // ===========================================================================

  describe('multiple demo entries', () => {
    it('triggers cleanup for multiple demo entries', async () => {
      const demoEntry1 = createDemoEntryNeedingCleanup()
      const demoEntry2: EntrySummary = {
        ...createDemoEntryNeedingCleanup(),
        id: 'demo-entry-456',
        original_filename: 'demo-en.mp3',
        primary_transcription: {
          id: 'transcription-456',
          status: 'completed',
          language_code: 'en',
          error_message: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      }

      vi.mocked(api.triggerCleanup)
        .mockResolvedValueOnce({
          data: { id: 'cleanup-123', status: 'pending' },
          rateLimitInfo: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'cleanup-456', status: 'pending' },
          rateLimitInfo: null,
        })

      const { result } = renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry1, demoEntry2],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      expect(api.triggerCleanup).toHaveBeenCalledTimes(2)
      expect(api.triggerCleanup).toHaveBeenCalledWith('transcription-123')
      expect(api.triggerCleanup).toHaveBeenCalledWith('transcription-456')
      expect(result.current.isProcessing).toBe(true)
    })
  })

  // ===========================================================================
  // Enabled Option
  // ===========================================================================

  describe('enabled option', () => {
    it('does nothing when disabled', () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
          enabled: false,
        })
      )

      expect(api.triggerCleanup).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Cleanup on Unmount
  // ===========================================================================

  describe('cleanup', () => {
    it('clears polling intervals on unmount', async () => {
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockResolvedValue({
        data: {
          id: 'cleanup-123',
          voice_entry_id: 'demo-entry-123',
          transcription_id: 'transcription-123',
          user_id: 'user-123',
          cleaned_text: null,
          status: 'processing',
          model_name: 'gpt-4',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          cleanup_data_edited: null,
        },
        rateLimitInfo: null,
      })

      const { unmount } = renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Flush promises to let triggerCleanup complete
      await act(async () => {
        await Promise.resolve()
      })

      // Start polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(api.getCleanedEntry).toHaveBeenCalledTimes(1)

      // Unmount
      unmount()

      // Clear mocks and advance - should NOT poll
      vi.clearAllMocks()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(api.getCleanedEntry).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('handles triggerCleanup API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Wait for async error handling
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(consoleError).toHaveBeenCalled()
      // Should decrement processing count on error
      expect(result.current.isProcessing).toBe(false)

      consoleError.mockRestore()
    })

    it('handles polling API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const demoEntry = createDemoEntryNeedingCleanup()

      vi.mocked(api.triggerCleanup).mockResolvedValue({
        data: { id: 'cleanup-123', status: 'pending' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getCleanedEntry).mockRejectedValue(new Error('Network error'))

      renderHook(() =>
        useDemoCleanupTrigger({
          entries: [demoEntry],
          isLoading: false,
          onRefresh: mockOnRefresh,
        })
      )

      // Flush promises to let triggerCleanup complete
      await act(async () => {
        await Promise.resolve()
      })

      // Poll fails
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(consoleError).toHaveBeenCalled()

      // Should stop polling after error
      vi.clearAllMocks()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(api.getCleanedEntry).not.toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })
})
