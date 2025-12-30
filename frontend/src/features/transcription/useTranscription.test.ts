import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTranscription } from './useTranscription'
import type { Segment } from '@/components/demo/types'

describe('useTranscription', () => {
  describe('initialization', () => {
    it('initializes with mock segments by default', () => {
      const { result } = renderHook(() => useTranscription())

      expect(result.current.segments.length).toBeGreaterThan(0)
      expect(result.current.status).toBe('complete')
      expect(result.current.entryId).toBeTruthy()
    })

    it('initializes with custom segments', () => {
      const customSegments: Segment[] = [
        { id: 'custom-1', speaker: 1, time: '0:00 – 0:10', rawText: 'raw', cleanedText: 'clean' },
      ]

      const { result } = renderHook(() =>
        useTranscription({ initialSegments: customSegments })
      )

      expect(result.current.segments).toHaveLength(1)
      expect(result.current.segments[0].id).toBe('custom-1')
    })

    it('initializes empty when mockMode is false and no initial segments', () => {
      const { result } = renderHook(() =>
        useTranscription({ mockMode: false })
      )

      expect(result.current.segments).toHaveLength(0)
      expect(result.current.status).toBe('idle')
    })

    it('segments have parsed time fields', () => {
      const { result } = renderHook(() => useTranscription())

      const segment = result.current.segments[0]
      expect(segment.startTime).toBeDefined()
      expect(segment.endTime).toBeDefined()
      expect(typeof segment.startTime).toBe('number')
    })
  })

  describe('updateSegmentCleanedText', () => {
    it('updates the cleaned text of a segment', () => {
      const { result } = renderHook(() => useTranscription())

      const segmentId = result.current.segments[0].id
      const newText = 'Updated cleaned text'

      act(() => {
        result.current.updateSegmentCleanedText(segmentId, newText)
      })

      const updatedSegment = result.current.segments.find((s) => s.id === segmentId)
      expect(updatedSegment?.cleanedText).toBe(newText)
    })

    it('does not affect other segments', () => {
      const { result } = renderHook(() => useTranscription())

      const originalSecondSegment = result.current.segments[1].cleanedText

      act(() => {
        result.current.updateSegmentCleanedText(result.current.segments[0].id, 'New text')
      })

      expect(result.current.segments[1].cleanedText).toBe(originalSecondSegment)
    })
  })

  describe('revertSegmentToRaw', () => {
    it('sets cleaned text to raw text', () => {
      const { result } = renderHook(() => useTranscription())

      const segment = result.current.segments[0]
      const originalRawText = segment.rawText

      act(() => {
        result.current.revertSegmentToRaw(segment.id)
      })

      const updatedSegment = result.current.segments.find((s) => s.id === segment.id)
      expect(updatedSegment?.cleanedText).toBe(originalRawText)
    })

    it('returns the original cleaned text', () => {
      const { result } = renderHook(() => useTranscription())

      const segment = result.current.segments[0]
      const originalCleanedText = segment.cleanedText

      let returnedText: string | undefined

      act(() => {
        returnedText = result.current.revertSegmentToRaw(segment.id)
      })

      expect(returnedText).toBe(originalCleanedText)
    })

    it('returns undefined for non-existent segment', () => {
      const { result } = renderHook(() => useTranscription())

      let returnedText: string | undefined

      act(() => {
        returnedText = result.current.revertSegmentToRaw('non-existent-id')
      })

      expect(returnedText).toBeUndefined()
    })

    it('marks segment as reverted', () => {
      const { result } = renderHook(() => useTranscription())

      const segmentId = result.current.segments[0].id

      expect(result.current.isSegmentReverted(segmentId)).toBe(false)

      act(() => {
        result.current.revertSegmentToRaw(segmentId)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(true)
    })
  })

  describe('undoRevert', () => {
    it('restores the original cleaned text', () => {
      const { result } = renderHook(() => useTranscription())

      const segment = result.current.segments[0]
      const originalCleanedText = segment.cleanedText

      act(() => {
        result.current.revertSegmentToRaw(segment.id)
      })

      // Now cleaned text is raw text
      expect(result.current.segments[0].cleanedText).toBe(segment.rawText)

      act(() => {
        result.current.undoRevert(segment.id, originalCleanedText)
      })

      // Restored to original cleaned text
      expect(result.current.segments[0].cleanedText).toBe(originalCleanedText)
    })

    it('clears reverted status', () => {
      const { result } = renderHook(() => useTranscription())

      const segmentId = result.current.segments[0].id
      const originalCleanedText = result.current.segments[0].cleanedText

      act(() => {
        result.current.revertSegmentToRaw(segmentId)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(true)

      act(() => {
        result.current.undoRevert(segmentId, originalCleanedText)
      })

      expect(result.current.isSegmentReverted(segmentId)).toBe(false)
    })
  })

  describe('getSegmentById', () => {
    it('returns segment by ID', () => {
      const { result } = renderHook(() => useTranscription())

      const firstSegment = result.current.segments[0]
      const found = result.current.getSegmentById(firstSegment.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(firstSegment.id)
    })

    it('returns undefined for non-existent ID', () => {
      const { result } = renderHook(() => useTranscription())

      const found = result.current.getSegmentById('non-existent')
      expect(found).toBeUndefined()
    })
  })

  describe('getSegmentAtTime', () => {
    it('returns segment at specified time', () => {
      const { result } = renderHook(() => useTranscription())

      // First segment starts at 0:00
      const segment = result.current.getSegmentAtTime(5)
      expect(segment).toBeDefined()
      expect(segment?.id).toBe(result.current.segments[0].id)
    })

    it('returns undefined for time outside all segments', () => {
      const { result } = renderHook(() => useTranscription())

      const segment = result.current.getSegmentAtTime(10000)
      expect(segment).toBeUndefined()
    })
  })

  describe('reset', () => {
    it('resets to initial state', () => {
      const { result } = renderHook(() => useTranscription())

      const originalFirstCleanedText = result.current.segments[0].cleanedText

      // Make some changes
      act(() => {
        result.current.updateSegmentCleanedText(result.current.segments[0].id, 'Modified')
        result.current.revertSegmentToRaw(result.current.segments[1].id)
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
      const { result } = renderHook(() => useTranscription())

      expect(result.current.error).toBeNull()
      expect(result.current.uploadProgress).toBe(0)
    })
  })
})
