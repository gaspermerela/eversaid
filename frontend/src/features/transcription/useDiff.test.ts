import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDiff } from './useDiff'
import type { Segment } from '@/components/demo/types'

const mockSegments: Segment[] = [
  {
    id: 'seg-1',
    speaker: 1,
    time: '0:00 – 0:18',
    rawText: 'Um hello world',
    cleanedText: 'Hello world',
  },
  {
    id: 'seg-2',
    speaker: 2,
    time: '0:19 – 0:42',
    rawText: 'So basically uh we need',
    cleanedText: 'So basically we need',
  },
]

describe('useDiff', () => {
  it('returns segmentDiffs Map with entries for each segment', () => {
    const { result } = renderHook(() => useDiff(mockSegments))

    expect(result.current.segmentDiffs).toBeInstanceOf(Map)
    expect(result.current.segmentDiffs.size).toBe(2)
    expect(result.current.segmentDiffs.has('seg-1')).toBe(true)
    expect(result.current.segmentDiffs.has('seg-2')).toBe(true)
  })

  it('returns empty Map when disabled', () => {
    const { result } = renderHook(() => useDiff(mockSegments, { enabled: false }))

    expect(result.current.segmentDiffs.size).toBe(0)
    expect(result.current.isEnabled).toBe(false)
  })

  it('computes correct diff tokens for segments', () => {
    const { result } = renderHook(() => useDiff(mockSegments))

    const diff1 = result.current.segmentDiffs.get('seg-1')
    expect(diff1).toBeDefined()
    expect(diff1!.length).toBeGreaterThan(0)

    // Check that "Um" was detected as deleted
    const deletedTokens = diff1!.filter((t) => t.type === 'deleted')
    expect(deletedTokens.some((t) => t.text.toLowerCase().includes('um'))).toBe(true)
  })

  it('computeSegmentDiff works independently', () => {
    const { result } = renderHook(() => useDiff([]))

    const diff = result.current.computeSegmentDiff('um hello', 'hello')
    expect(diff.length).toBeGreaterThan(0)
    expect(diff.some((t) => t.type === 'deleted')).toBe(true)
  })

  it('computeSegmentDiff returns empty array when disabled', () => {
    const { result } = renderHook(() => useDiff([], { enabled: false }))

    const diff = result.current.computeSegmentDiff('um hello', 'hello')
    expect(diff).toEqual([])
  })

  it('memoizes results when segments unchanged', () => {
    const { result, rerender } = renderHook(() => useDiff(mockSegments))

    const firstMap = result.current.segmentDiffs
    rerender()
    const secondMap = result.current.segmentDiffs

    // Same reference means memoization is working
    expect(firstMap).toBe(secondMap)
  })

  it('recomputes when segments change', () => {
    const { result, rerender } = renderHook(
      ({ segments }) => useDiff(segments),
      { initialProps: { segments: mockSegments } }
    )

    const firstMap = result.current.segmentDiffs

    const newSegments = [
      ...mockSegments,
      {
        id: 'seg-3',
        speaker: 1,
        time: '0:43 – 1:05',
        rawText: 'New segment',
        cleanedText: 'New segment',
      },
    ]

    rerender({ segments: newSegments })
    const secondMap = result.current.segmentDiffs

    expect(firstMap).not.toBe(secondMap)
    expect(secondMap.size).toBe(3)
  })

  it('handles empty segments array', () => {
    const { result } = renderHook(() => useDiff([]))

    expect(result.current.segmentDiffs.size).toBe(0)
    expect(result.current.isEnabled).toBe(true)
  })
})
