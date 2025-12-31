import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRateLimits } from './useRateLimits'
import { ApiError } from './types'
import type { RateLimitInfo, RateLimitError } from './types'

// Mock parseRateLimitHeaders
vi.mock('./api', () => ({
  parseRateLimitHeaders: vi.fn(),
}))

import { parseRateLimitHeaders } from './api'

describe('useRateLimits', () => {
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
      const { result } = renderHook(() => useRateLimits())

      expect(result.current.limits).toBeNull()
      expect(result.current.isLimited).toBe(false)
      expect(result.current.limitType).toBeNull()
      expect(result.current.retryAfter).toBeNull()
      expect(result.current.retryAt).toBeNull()
    })
  })

  // ===========================================================================
  // updateFromResponse
  // ===========================================================================

  describe('updateFromResponse', () => {
    it('updates limits from response headers', () => {
      const mockLimits: RateLimitInfo = {
        day: { limit: 20, remaining: 15, reset: 1703548800 },
        ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
        global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
      }

      vi.mocked(parseRateLimitHeaders).mockReturnValue(mockLimits)

      const { result } = renderHook(() => useRateLimits())

      const mockResponse = new Response(null, { status: 200 })

      act(() => {
        result.current.updateFromResponse(mockResponse)
      })

      expect(parseRateLimitHeaders).toHaveBeenCalledWith(mockResponse)
      expect(result.current.limits).toEqual(mockLimits)
      expect(result.current.isLimited).toBe(false)
    })

    it('does not update limits when headers are missing', () => {
      vi.mocked(parseRateLimitHeaders).mockReturnValue(null)

      const { result } = renderHook(() => useRateLimits())

      const mockResponse = new Response(null, { status: 200 })

      act(() => {
        result.current.updateFromResponse(mockResponse)
      })

      expect(result.current.limits).toBeNull()
    })
  })

  // ===========================================================================
  // updateFromError
  // ===========================================================================

  describe('updateFromError', () => {
    it('sets rate limited state from ApiError with rateLimitError', () => {
      const rateLimitError: RateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Daily limit reached',
        limit_type: 'day',
        retry_after: 120,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      }

      const error = new ApiError(
        429,
        'Daily limit reached',
        rateLimitError.limits,
        rateLimitError
      )

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.isLimited).toBe(true)
      expect(result.current.limitType).toBe('day')
      expect(result.current.retryAfter).toBe(120)
      expect(result.current.retryAt).toBeInstanceOf(Date)
      expect(result.current.limits).toEqual(rateLimitError.limits)
    })

    it('sets rate limited state for 429 without detailed error', () => {
      const error = new ApiError(429, 'Rate limit exceeded')

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.isLimited).toBe(true)
      expect(result.current.limitType).toBeNull()
      expect(result.current.retryAfter).toBe(60) // Default
      expect(result.current.retryAt).toBeInstanceOf(Date)
    })

    it('updates limits from rateLimitInfo on non-429 errors', () => {
      const limits: RateLimitInfo = {
        day: { limit: 20, remaining: 10, reset: 1703548800 },
        ip_day: { limit: 20, remaining: 10, reset: 1703548800 },
        global_day: { limit: 1000, remaining: 500, reset: 1703548800 },
      }

      const error = new ApiError(500, 'Server error', limits)

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.limits).toEqual(limits)
      expect(result.current.isLimited).toBe(false)
    })

    it('handles different limit types', () => {
      const limitTypes: Array<'day' | 'ip_day' | 'global_day'> = [
        'day',
        'ip_day',
        'global_day',
      ]

      for (const limitType of limitTypes) {
        const rateLimitError: RateLimitError = {
          error: 'rate_limit_exceeded',
          message: `${limitType} limit reached`,
          limit_type: limitType,
          retry_after: 60,
          limits: {
            day: { limit: 20, remaining: 0, reset: 1703548800 },
            ip_day: { limit: 20, remaining: 0, reset: 1703548800 },
            global_day: { limit: 1000, remaining: 0, reset: 1703548800 },
          },
        }

        const error = new ApiError(429, `${limitType} limit reached`, undefined, rateLimitError)

        const { result } = renderHook(() => useRateLimits())

        act(() => {
          result.current.updateFromError(error)
        })

        expect(result.current.limitType).toBe(limitType)
      }
    })
  })

  // ===========================================================================
  // Countdown Timer
  // ===========================================================================

  describe('countdown timer', () => {
    it('counts down retryAfter every second', () => {
      const rateLimitError: RateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Limit reached',
        limit_type: 'day',
        retry_after: 5,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      }

      const error = new ApiError(429, 'Limit reached', undefined, rateLimitError)

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.retryAfter).toBe(5)

      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.retryAfter).toBe(4)

      // Advance 2 more seconds
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.retryAfter).toBe(2)
    })

    it('clears rate limited state when countdown reaches zero', () => {
      const rateLimitError: RateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Limit reached',
        limit_type: 'day',
        retry_after: 3,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      }

      const error = new ApiError(429, 'Limit reached', undefined, rateLimitError)

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.isLimited).toBe(true)

      // Advance past the countdown
      act(() => {
        vi.advanceTimersByTime(4000)
      })

      expect(result.current.isLimited).toBe(false)
      expect(result.current.limitType).toBeNull()
      expect(result.current.retryAfter).toBeNull()
      expect(result.current.retryAt).toBeNull()
    })
  })

  // ===========================================================================
  // Clear
  // ===========================================================================

  describe('clear', () => {
    it('clears all rate limit state', () => {
      const rateLimitError: RateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Limit reached',
        limit_type: 'day',
        retry_after: 300,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 0, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      }

      const error = new ApiError(429, 'Limit reached', undefined, rateLimitError)

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.isLimited).toBe(true)

      act(() => {
        result.current.clear()
      })

      expect(result.current.limits).toBeNull()
      expect(result.current.isLimited).toBe(false)
      expect(result.current.limitType).toBeNull()
      expect(result.current.retryAfter).toBeNull()
      expect(result.current.retryAt).toBeNull()
    })

    it('stops the countdown timer when cleared', () => {
      const rateLimitError: RateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Limit reached',
        limit_type: 'day',
        retry_after: 60,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      }

      const error = new ApiError(429, 'Limit reached', undefined, rateLimitError)

      const { result } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      expect(result.current.retryAfter).toBe(60)

      // Advance a bit
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.retryAfter).toBe(55)

      // Clear
      act(() => {
        result.current.clear()
      })

      expect(result.current.retryAfter).toBeNull()

      // Advance more - should not change anything
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.retryAfter).toBeNull()
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles multiple consecutive rate limit errors', () => {
      const { result } = renderHook(() => useRateLimits())

      // First error
      const error1 = new ApiError(429, 'Limit 1', undefined, {
        error: 'rate_limit_exceeded',
        message: 'Day limit',
        limit_type: 'day',
        retry_after: 30,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      })

      act(() => {
        result.current.updateFromError(error1)
      })

      expect(result.current.retryAfter).toBe(30)
      expect(result.current.limitType).toBe('day')

      // Advance a bit
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.retryAfter).toBe(20)

      // Second error with different values
      const error2 = new ApiError(429, 'Limit 2', undefined, {
        error: 'rate_limit_exceeded',
        message: 'IP day limit',
        limit_type: 'ip_day',
        retry_after: 120,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 0, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      })

      act(() => {
        result.current.updateFromError(error2)
      })

      // Should be updated with new values
      expect(result.current.retryAfter).toBe(120)
      expect(result.current.limitType).toBe('ip_day')
    })

    it('handles unmount during countdown', () => {
      const rateLimitError: RateLimitError = {
        error: 'rate_limit_exceeded',
        message: 'Limit reached',
        limit_type: 'day',
        retry_after: 60,
        limits: {
          day: { limit: 20, remaining: 0, reset: 1703548800 },
          ip_day: { limit: 20, remaining: 15, reset: 1703548800 },
          global_day: { limit: 1000, remaining: 900, reset: 1703548800 },
        },
      }

      const error = new ApiError(429, 'Limit reached', undefined, rateLimitError)

      const { result, unmount } = renderHook(() => useRateLimits())

      act(() => {
        result.current.updateFromError(error)
      })

      // Unmount - should not throw
      expect(() => unmount()).not.toThrow()

      // Advancing timers should not cause issues
      act(() => {
        vi.advanceTimersByTime(10000)
      })
    })
  })
})
