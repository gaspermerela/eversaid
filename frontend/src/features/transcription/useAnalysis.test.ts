import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysis } from './useAnalysis'
import * as api from './api'
import { ApiError } from './types'
import type { AnalysisProfile, AnalysisResult } from './types'
import { toast } from 'sonner'

// Mock the API module
vi.mock('./api', () => ({
  getAnalysisProfiles: vi.fn(),
  triggerAnalysis: vi.fn(),
  getAnalysis: vi.fn(),
  getAnalyses: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// =============================================================================
// Test Data Fixtures
// =============================================================================

const mockProfiles: AnalysisProfile[] = [
  {
    id: 'generic-summary',
    label: 'Conversation Summary',
    intent: 'summarization',
    description: 'Summarizes the conversation',
    is_default: true,
    outputs: ['summary', 'topics', 'key_points'],
  },
  {
    id: 'action-items',
    label: 'Action Items & Decisions',
    intent: 'task_extraction',
    description: 'Extracts action items',
    is_default: false,
    outputs: ['summary', 'action_items', 'decisions'],
  },
  {
    id: 'reflection',
    label: 'Reflection & Insights',
    intent: 'self_discovery',
    description: 'Provides reflection prompts',
    is_default: false,
    outputs: ['summary', 'themes', 'reflection_prompts'],
  },
]

const mockAnalysisResult: AnalysisResult = {
  id: 'analysis-123',
  cleaned_entry_id: 'cleanup-123',
  user_id: 'user-123',
  profile_id: 'generic-summary',
  profile_label: 'Conversation Summary',
  result: {
    summary: 'This is a test summary.',
    topics: ['topic1', 'topic2'],
    key_points: ['point1', 'point2'],
  },
  status: 'completed',
  llm_provider: 'openai',
  llm_model: 'gpt-4',
  created_at: '2024-01-01T00:00:00Z',
}

const mockPendingAnalysis: AnalysisResult = {
  ...mockAnalysisResult,
  id: 'analysis-pending',
  status: 'pending',
  result: null,
}

const mockFailedAnalysis: AnalysisResult = {
  ...mockAnalysisResult,
  id: 'analysis-failed',
  status: 'failed',
  result: null,
  error_message: 'LLM processing failed',
}

describe('useAnalysis', () => {
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
    it('initializes with default values', () => {
      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      expect(result.current.data).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isPolling).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.profiles).toEqual([])
      expect(result.current.isLoadingProfiles).toBe(false)
      expect(result.current.analysisId).toBeNull()
      expect(result.current.currentProfileId).toBeNull()
      expect(result.current.currentProfileLabel).toBeNull()
      expect(result.current.currentProfileIntent).toBeNull()
    })

    it('initializes with null cleanupId', () => {
      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: null })
      )

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  // ===========================================================================
  // Computed Properties
  // ===========================================================================

  describe('computed properties', () => {
    it('computes currentProfileLabel from profiles', async () => {
      vi.mocked(api.getAnalysisProfiles).mockResolvedValue({
        data: mockProfiles,
        defaultProfileId: 'generic-summary',
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      // Load profiles first
      await act(async () => {
        await result.current.loadProfiles()
      })

      // Initially no profile selected
      expect(result.current.currentProfileLabel).toBeNull()

      // After selecting a profile via populateCache
      act(() => {
        result.current.populateCache([mockAnalysisResult])
      })

      // Wait for async fetch
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(result.current.currentProfileId).toBe('generic-summary')
      expect(result.current.currentProfileLabel).toBe('Conversation Summary')
      expect(result.current.currentProfileIntent).toBe('summarization')
    })

    it('returns null for label/intent when profile not found', async () => {
      vi.mocked(api.getAnalysisProfiles).mockResolvedValue({
        data: mockProfiles,
        defaultProfileId: 'generic-summary',
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.loadProfiles()
      })

      // Profile not in the list
      expect(result.current.currentProfileLabel).toBeNull()
      expect(result.current.currentProfileIntent).toBeNull()
    })
  })

  // ===========================================================================
  // loadProfiles
  // ===========================================================================

  describe('loadProfiles', () => {
    it('loads profiles from API successfully', async () => {
      vi.mocked(api.getAnalysisProfiles).mockResolvedValue({
        data: mockProfiles,
        defaultProfileId: 'generic-summary',
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      expect(result.current.isLoadingProfiles).toBe(false)

      await act(async () => {
        await result.current.loadProfiles()
      })

      expect(result.current.profiles).toEqual(mockProfiles)
      expect(result.current.isLoadingProfiles).toBe(false)
      expect(api.getAnalysisProfiles).toHaveBeenCalledTimes(1)
    })

    it('sets isLoadingProfiles during load', async () => {
      let resolvePromise: (value: unknown) => void
      vi.mocked(api.getAnalysisProfiles).mockImplementation(
        () => new Promise((resolve) => {
          resolvePromise = () => resolve({
            data: mockProfiles,
            defaultProfileId: 'generic-summary',
            rateLimitInfo: null,
          })
        })
      )

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      act(() => {
        result.current.loadProfiles()
      })

      expect(result.current.isLoadingProfiles).toBe(true)

      await act(async () => {
        resolvePromise!(null)
      })

      expect(result.current.isLoadingProfiles).toBe(false)
    })

    it('sets defaultProfileId from API response', async () => {
      vi.mocked(api.getAnalysisProfiles).mockResolvedValue({
        data: mockProfiles,
        defaultProfileId: 'action-items', // Different from fallback
        rateLimitInfo: null,
      })

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'action-items' },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.loadProfiles()
      })

      // Now trigger analyze without profileId - should use API default
      await act(async () => {
        await result.current.analyze()
      })

      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', { profileId: 'action-items', llmModel: undefined })
    })

    it('respects defaultProfile override from options', async () => {
      vi.mocked(api.getAnalysisProfiles).mockResolvedValue({
        data: mockProfiles,
        defaultProfileId: 'generic-summary',
        rateLimitInfo: null,
      })

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'reflection' },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123', defaultProfile: 'reflection' })
      )

      await act(async () => {
        await result.current.loadProfiles()
      })

      // Override should be used, not API default
      await act(async () => {
        await result.current.analyze()
      })

      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', { profileId: 'reflection', llmModel: undefined })
    })

    it('handles API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(api.getAnalysisProfiles).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.loadProfiles()
      })

      expect(result.current.profiles).toEqual([])
      expect(result.current.isLoadingProfiles).toBe(false)
      expect(consoleError).toHaveBeenCalled()
      // Should NOT show toast for profile loading failure
      expect(toast.error).not.toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  // ===========================================================================
  // analyze
  // ===========================================================================

  describe('analyze', () => {
    it('triggers analysis with specified profileId', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'action-items' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze('action-items')
      })

      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', { profileId: 'action-items', llmModel: undefined })
      expect(result.current.currentProfileId).toBe('action-items')
    })

    it('uses default profileId when none specified', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', { profileId: 'generic-summary', llmModel: undefined })
    })

    it('sets isLoading during analysis trigger', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockPendingAnalysis,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      // Still loading because polling started and analysis is pending
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isPolling).toBe(true)
    })

    it('sets error when cleanupId is null', async () => {
      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: null })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.error).toBe('No cleanup ID available')
      expect(api.triggerAnalysis).not.toHaveBeenCalled()
    })

    it('handles 404 error', async () => {
      vi.mocked(api.triggerAnalysis).mockRejectedValue(
        new ApiError(404, 'Not found')
      )

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.error).toBe('Cleaned entry not found')
      expect(result.current.isLoading).toBe(false)
      expect(toast.error).toHaveBeenCalledWith('Cleaned entry not found')
    })

    it('handles 429 rate limit error', async () => {
      vi.mocked(api.triggerAnalysis).mockRejectedValue(
        new ApiError(429, 'Rate limited')
      )

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.error).toBe('Too many requests. Please try again later.')
      expect(toast.error).toHaveBeenCalledWith('Too many requests. Please try again later.')
    })

    it('handles generic API error', async () => {
      vi.mocked(api.triggerAnalysis).mockRejectedValue(
        new ApiError(500, 'Server exploded')
      )

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.error).toBe('Server exploded')
      expect(toast.error).toHaveBeenCalledWith('Server exploded')
    })

    it('clears previous error on new analysis', async () => {
      vi.mocked(api.triggerAnalysis)
        .mockRejectedValueOnce(new ApiError(500, 'First error'))
        .mockResolvedValueOnce({
          data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
          rateLimitInfo: null,
        })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      // First attempt fails
      await act(async () => {
        await result.current.analyze()
      })
      expect(result.current.error).toBe('First error')

      // Second attempt should clear error
      await act(async () => {
        await result.current.analyze()
      })
      expect(result.current.error).toBeNull()
    })
  })

  // ===========================================================================
  // Polling
  // ===========================================================================

  describe('polling', () => {
    it('polls every 2 seconds until completed', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis)
        .mockResolvedValueOnce({ data: mockPendingAnalysis, rateLimitInfo: null })
        .mockResolvedValueOnce({ data: { ...mockPendingAnalysis, status: 'processing' }, rateLimitInfo: null })
        .mockResolvedValueOnce({ data: mockAnalysisResult, rateLimitInfo: null })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.isPolling).toBe(true)

      // First poll (immediate)
      expect(api.getAnalysis).toHaveBeenCalledTimes(1)

      // Advance 2 seconds
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(api.getAnalysis).toHaveBeenCalledTimes(2)

      // Advance another 2 seconds - should complete
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(api.getAnalysis).toHaveBeenCalledTimes(3)

      expect(result.current.isPolling).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toEqual({
        summary: 'This is a test summary.',
        topics: ['topic1', 'topic2'],
        keyPoints: ['point1', 'point2'],
      })
    })

    it('stops polling on failure status', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockFailedAnalysis,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.isPolling).toBe(false)
      expect(result.current.error).toBe('LLM processing failed')
      expect(toast.error).toHaveBeenCalledWith('Analysis failed')
    })

    it('handles polling API error', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockRejectedValue(
        new ApiError(404, 'Analysis not found')
      )

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.isPolling).toBe(false)
      expect(result.current.error).toBe('Analysis not found')
      expect(toast.error).toHaveBeenCalledWith('Analysis not found')
    })

    it('caches completed analysis by profile_id', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      // Should be cached - second call to selectProfile should use cache
      vi.mocked(api.getAnalyses).mockResolvedValue({
        data: [],
        rateLimitInfo: null,
      })

      await act(async () => {
        await result.current.selectProfile('generic-summary')
      })

      // getAnalyses should NOT be called because cache was hit
      expect(api.getAnalyses).not.toHaveBeenCalled()
    })

    it('sets error when completed but no usable data', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: {
          ...mockAnalysisResult,
          result: {}, // Empty result
        },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.error).toBe('Analysis completed but returned no usable data')
    })
  })

  // ===========================================================================
  // selectProfile - 3-tier logic
  // ===========================================================================

  describe('selectProfile', () => {
    it('returns from cache immediately without API call', async () => {
      // First, populate cache via analyze
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      // Analyze to populate cache
      await act(async () => {
        await result.current.analyze('generic-summary')
      })

      vi.clearAllMocks()

      // Now select same profile - should use cache
      await act(async () => {
        await result.current.selectProfile('generic-summary')
      })

      expect(api.getAnalyses).not.toHaveBeenCalled()
      expect(api.getAnalysis).not.toHaveBeenCalled()
      expect(api.triggerAnalysis).not.toHaveBeenCalled()
      expect(result.current.data).not.toBeNull()
    })

    it('fetches from API when cache miss but analysis exists', async () => {
      vi.mocked(api.getAnalyses).mockResolvedValue({
        data: [mockAnalysisResult],
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.selectProfile('generic-summary')
      })

      expect(api.getAnalyses).toHaveBeenCalledWith('cleanup-123')
      expect(api.getAnalysis).toHaveBeenCalledWith('analysis-123')
      expect(api.triggerAnalysis).not.toHaveBeenCalled()
      expect(result.current.data).not.toBeNull()
    })

    it('starts polling when existing analysis is still processing', async () => {
      const processingAnalysis = { ...mockAnalysisResult, status: 'processing' as const, result: null }

      vi.mocked(api.getAnalyses).mockResolvedValue({
        data: [processingAnalysis],
        rateLimitInfo: null,
      })

      // First poll returns processing, second returns completed
      vi.mocked(api.getAnalysis)
        .mockResolvedValueOnce({ data: processingAnalysis, rateLimitInfo: null })
        .mockResolvedValueOnce({ data: mockAnalysisResult, rateLimitInfo: null })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.selectProfile('generic-summary')
      })

      // Should be polling since analysis is processing
      expect(result.current.isPolling).toBe(true)
      expect(api.triggerAnalysis).not.toHaveBeenCalled()

      // Complete the polling
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.isPolling).toBe(false)
      expect(result.current.data).not.toBeNull()
    })

    it('triggers new LLM analysis when profile not found', async () => {
      vi.mocked(api.getAnalyses).mockResolvedValue({
        data: [], // No existing analyses
        rateLimitInfo: null,
      })

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-new', status: 'pending', profile_id: 'action-items' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: { ...mockAnalysisResult, profile_id: 'action-items' },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.selectProfile('action-items')
      })

      expect(api.getAnalyses).toHaveBeenCalled()
      expect(api.triggerAnalysis).toHaveBeenCalledWith('cleanup-123', { profileId: 'action-items', llmModel: undefined })
    })

    it('handles getAnalyses error gracefully and triggers new analysis', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(api.getAnalyses).mockRejectedValue(new Error('Network error'))

      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-new', status: 'pending', profile_id: 'action-items' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: { ...mockAnalysisResult, profile_id: 'action-items' },
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.selectProfile('action-items')
      })

      expect(consoleError).toHaveBeenCalled()
      expect(api.triggerAnalysis).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  // ===========================================================================
  // populateCache
  // ===========================================================================

  describe('populateCache', () => {
    it('prioritizes defaultProfileId from analyses', async () => {
      const actionItemsAnalysis = { ...mockAnalysisResult, id: 'analysis-action', profile_id: 'action-items' }
      const genericAnalysis = { ...mockAnalysisResult, id: 'analysis-generic', profile_id: 'generic-summary' }

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: genericAnalysis,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      // Pass action-items first, but generic-summary is default
      act(() => {
        result.current.populateCache([actionItemsAnalysis, genericAnalysis])
      })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(result.current.currentProfileId).toBe('generic-summary')
      expect(api.getAnalysis).toHaveBeenCalledWith('analysis-generic')
    })

    it('falls back to first analysis when default not found', async () => {
      const actionItemsAnalysis = { ...mockAnalysisResult, id: 'analysis-action', profile_id: 'action-items' }

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: actionItemsAnalysis,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      act(() => {
        result.current.populateCache([actionItemsAnalysis])
      })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(result.current.currentProfileId).toBe('action-items')
    })

    it('fetches individual analysis to get result data', async () => {
      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      act(() => {
        result.current.populateCache([{ ...mockAnalysisResult, result: undefined }])
      })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(api.getAnalysis).toHaveBeenCalledWith('analysis-123')
      expect(result.current.data).not.toBeNull()
    })

    it('starts polling for pending/processing analysis', () => {
      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      act(() => {
        result.current.populateCache([mockPendingAnalysis])
      })

      expect(result.current.isPolling).toBe(true)
    })

    it('does nothing for empty analyses array', () => {
      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      act(() => {
        result.current.populateCache([])
      })

      expect(result.current.currentProfileId).toBeNull()
      expect(api.getAnalysis).not.toHaveBeenCalled()
    })

    it('handles fetch error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(api.getAnalysis).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      act(() => {
        result.current.populateCache([mockAnalysisResult])
      })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(consoleError).toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)

      consoleError.mockRestore()
    })
  })

  // ===========================================================================
  // reset
  // ===========================================================================

  describe('reset', () => {
    it('clears all state', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      // Set up some state
      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.data).not.toBeNull()
      expect(result.current.currentProfileId).not.toBeNull()

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.data).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isPolling).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.analysisId).toBeNull()
      expect(result.current.currentProfileId).toBeNull()
    })

    it('stops polling on reset', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockPendingAnalysis,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.isPolling).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.isPolling).toBe(false)

      // Advance timers - should not poll anymore
      vi.clearAllMocks()
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(api.getAnalysis).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Auto-polling on analysisId change
  // ===========================================================================

  describe('auto-polling on analysisId change', () => {
    it('starts polling when initialAnalysisId is provided', async () => {
      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123', analysisId: 'analysis-123' })
      )

      // Should start polling immediately
      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(api.getAnalysis).toHaveBeenCalledWith('analysis-123')
    })

    it('restarts polling when analysisId changes', async () => {
      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockAnalysisResult,
        rateLimitInfo: null,
      })

      const { result, rerender } = renderHook(
        (props) => useAnalysis(props),
        { initialProps: { cleanupId: 'cleanup-123', analysisId: 'analysis-1' } }
      )

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(api.getAnalysis).toHaveBeenCalledWith('analysis-1')

      vi.clearAllMocks()

      // Change analysisId
      rerender({ cleanupId: 'cleanup-123', analysisId: 'analysis-2' })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(api.getAnalysis).toHaveBeenCalledWith('analysis-2')
    })
  })

  // ===========================================================================
  // Cleanup on unmount
  // ===========================================================================

  describe('cleanup', () => {
    it('clears polling interval on unmount', async () => {
      vi.mocked(api.triggerAnalysis).mockResolvedValue({
        data: { id: 'job-123', status: 'pending', profile_id: 'generic-summary' },
        rateLimitInfo: null,
      })

      vi.mocked(api.getAnalysis).mockResolvedValue({
        data: mockPendingAnalysis,
        rateLimitInfo: null,
      })

      const { result, unmount } = renderHook(() =>
        useAnalysis({ cleanupId: 'cleanup-123' })
      )

      await act(async () => {
        await result.current.analyze()
      })

      expect(result.current.isPolling).toBe(true)

      // Unmount
      unmount()

      // Advance timers - should not throw or call API
      vi.clearAllMocks()
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(api.getAnalysis).not.toHaveBeenCalled()
    })
  })
})
