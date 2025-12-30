import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSyncScroll } from './useSyncScroll'
import type { Segment } from '@/components/demo/types'

const mockSegments: Segment[] = [
  { id: 'seg-1', speaker: 1, time: '0:00 – 0:18', rawText: 'raw1', cleanedText: 'clean1' },
  { id: 'seg-2', speaker: 2, time: '0:19 – 0:42', rawText: 'raw2', cleanedText: 'clean2' },
]

describe('useSyncScroll', () => {
  describe('initialization', () => {
    it('returns refs for both scroll containers', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: mockSegments }))

      expect(result.current.rawScrollRef).toBeDefined()
      expect(result.current.cleanedScrollRef).toBeDefined()
      expect(result.current.rawScrollRef.current).toBeNull()
      expect(result.current.cleanedScrollRef.current).toBeNull()
    })

    it('returns scroll handlers', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: mockSegments }))

      expect(typeof result.current.handleRawScroll).toBe('function')
      expect(typeof result.current.handleCleanedScroll).toBe('function')
    })

    it('returns utility functions', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: mockSegments }))

      expect(typeof result.current.scrollToSegment).toBe('function')
      expect(typeof result.current.syncSegmentHeights).toBe('function')
    })
  })

  describe('enabled state', () => {
    it('defaults to enabled', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: mockSegments }))

      // Handlers should exist and be callable (though they won't sync without DOM)
      expect(result.current.handleRawScroll).toBeDefined()
      expect(result.current.handleCleanedScroll).toBeDefined()
    })

    it('accepts enabled: false', () => {
      // Just verify it doesn't throw
      const { result } = renderHook(() =>
        useSyncScroll({ segments: mockSegments, enabled: false })
      )

      expect(result.current).toBeDefined()
    })
  })

  describe('refs stability', () => {
    it('refs remain stable across renders', () => {
      const { result, rerender } = renderHook(() =>
        useSyncScroll({ segments: mockSegments })
      )

      const firstRawRef = result.current.rawScrollRef
      const firstCleanedRef = result.current.cleanedScrollRef

      rerender()

      expect(result.current.rawScrollRef).toBe(firstRawRef)
      expect(result.current.cleanedScrollRef).toBe(firstCleanedRef)
    })
  })

  describe('handler stability', () => {
    it('handlers remain stable when segments unchanged', () => {
      const { result, rerender } = renderHook(() =>
        useSyncScroll({ segments: mockSegments })
      )

      const firstRawHandler = result.current.handleRawScroll
      const firstCleanedHandler = result.current.handleCleanedScroll

      rerender()

      expect(result.current.handleRawScroll).toBe(firstRawHandler)
      expect(result.current.handleCleanedScroll).toBe(firstCleanedHandler)
    })
  })

  describe('empty segments', () => {
    it('handles empty segments array', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: [] }))

      expect(result.current.rawScrollRef).toBeDefined()
      expect(result.current.cleanedScrollRef).toBeDefined()
    })
  })

  describe('scrollToSegment', () => {
    it('is callable without DOM elements', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: mockSegments }))

      // Should not throw even without actual DOM elements
      expect(() => {
        result.current.scrollToSegment('seg-1')
      }).not.toThrow()
    })
  })

  describe('syncSegmentHeights', () => {
    it('is callable without DOM elements', () => {
      const { result } = renderHook(() => useSyncScroll({ segments: mockSegments }))

      // Should not throw even without actual DOM elements
      expect(() => {
        result.current.syncSegmentHeights()
      }).not.toThrow()
    })
  })
})
