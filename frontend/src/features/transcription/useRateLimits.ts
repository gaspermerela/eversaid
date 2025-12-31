import { useState, useCallback, useEffect, useRef } from 'react'
import { parseRateLimitHeaders } from './api'
import type { RateLimitInfo, RateLimitError } from './types'
import { ApiError } from './types'

/**
 * Limit type identifier
 */
export type LimitType = 'hour' | 'day' | 'ip_day' | 'global_day'

/**
 * Return type for the useRateLimits hook
 */
export interface UseRateLimitsReturn {
  /** Current rate limit info from API responses */
  limits: RateLimitInfo | null
  /** Whether the user is currently rate limited */
  isLimited: boolean
  /** Which limit type was exceeded (if rate limited) */
  limitType: LimitType | null
  /** Seconds until rate limit resets (countdown) */
  retryAfter: number | null
  /** Timestamp when rate limit resets */
  retryAt: Date | null
  /** Update rate limit state from a successful API response */
  updateFromResponse: (response: Response) => void
  /** Update rate limit state from an ApiError (typically 429) */
  updateFromError: (error: ApiError) => void
  /** Clear all rate limit state */
  clear: () => void
}

/**
 * Hook for tracking API rate limits
 *
 * Parses rate limit headers from API responses and tracks
 * when the user is rate limited with countdown timer.
 *
 * @example
 * ```tsx
 * const { limits, isLimited, retryAfter, updateFromResponse } = useRateLimits()
 *
 * const handleUpload = async () => {
 *   try {
 *     const response = await fetch('/api/transcribe', { ... })
 *     updateFromResponse(response)
 *   } catch (error) {
 *     if (error instanceof ApiError) {
 *       updateFromError(error)
 *     }
 *   }
 * }
 *
 * if (isLimited) {
 *   return <div>Rate limited. Try again in {retryAfter} seconds.</div>
 * }
 * ```
 */
export function useRateLimits(): UseRateLimitsReturn {
  const [limits, setLimits] = useState<RateLimitInfo | null>(null)
  const [isLimited, setIsLimited] = useState(false)
  const [limitType, setLimitType] = useState<LimitType | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [retryAt, setRetryAt] = useState<Date | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Start countdown timer when rate limited
  useEffect(() => {
    if (!isLimited || retryAfter === null || retryAfter <= 0) {
      return
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Start countdown
    timerRef.current = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev === null || prev <= 1) {
          // Timer complete - clear rate limited state
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setIsLimited(false)
          setLimitType(null)
          setRetryAt(null)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isLimited, retryAfter])

  const updateFromResponse = useCallback((response: Response) => {
    const rateLimitInfo = parseRateLimitHeaders(response)
    if (rateLimitInfo) {
      setLimits(rateLimitInfo)
    }
  }, [])

  const updateFromError = useCallback((error: ApiError) => {
    // Update limits if available
    if (error.rateLimitInfo) {
      setLimits(error.rateLimitInfo)
    }

    // Handle rate limit error
    if (error.isRateLimited && error.rateLimitError) {
      const { limit_type, retry_after, limits: errorLimits } = error.rateLimitError

      setIsLimited(true)
      setLimitType(limit_type)
      setRetryAfter(retry_after)
      setRetryAt(new Date(Date.now() + retry_after * 1000))

      if (errorLimits) {
        setLimits(errorLimits)
      }
    } else if (error.isRateLimited) {
      // 429 without detailed error body - use a default retry
      setIsLimited(true)
      setLimitType(null)
      // Default to 60 seconds if no retry_after provided
      const defaultRetry = 60
      setRetryAfter(defaultRetry)
      setRetryAt(new Date(Date.now() + defaultRetry * 1000))
    }
  }, [])

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setLimits(null)
    setIsLimited(false)
    setLimitType(null)
    setRetryAfter(null)
    setRetryAt(null)
  }, [])

  return {
    limits,
    isLimited,
    limitType,
    retryAfter,
    retryAt,
    updateFromResponse,
    updateFromError,
    clear,
  }
}
