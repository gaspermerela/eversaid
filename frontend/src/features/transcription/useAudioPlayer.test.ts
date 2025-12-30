import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioPlayer, PLAYBACK_SPEEDS } from './useAudioPlayer'
import type { SegmentWithTime } from './types'

const mockSegments: SegmentWithTime[] = [
  {
    id: 'seg-1',
    speaker: 1,
    time: '0:00 – 0:18',
    rawText: 'First segment',
    cleanedText: 'First segment',
    startTime: 0,
    endTime: 18,
  },
  {
    id: 'seg-2',
    speaker: 2,
    time: '0:19 – 0:42',
    rawText: 'Second segment',
    cleanedText: 'Second segment',
    startTime: 19,
    endTime: 42,
  },
  {
    id: 'seg-3',
    speaker: 1,
    time: '0:43 – 1:05',
    rawText: 'Third segment',
    cleanedText: 'Third segment',
    startTime: 43,
    endTime: 65,
  },
]

describe('useAudioPlayer', () => {
  describe('initialization', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      expect(result.current.isPlaying).toBe(false)
      expect(result.current.currentTime).toBe(0)
      expect(result.current.duration).toBe(0)
      expect(result.current.playbackSpeed).toBe(1)
      // At time 0, first segment (0:00-0:18) is active
      expect(result.current.activeSegmentId).toBe('seg-1')
      expect(result.current.activeSegmentIndex).toBe(0)
    })

    it('accepts custom initial speed', () => {
      const { result } = renderHook(() =>
        useAudioPlayer({ segments: mockSegments, initialSpeed: 1.5 })
      )

      expect(result.current.playbackSpeed).toBe(1.5)
    })

    it('provides audioRef', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      expect(result.current.audioRef).toBeDefined()
      expect(result.current.audioRef.current).toBeNull() // No audio element mounted
    })
  })

  describe('playback controls', () => {
    it('provides play, pause, togglePlayPause functions', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      expect(typeof result.current.play).toBe('function')
      expect(typeof result.current.pause).toBe('function')
      expect(typeof result.current.togglePlayPause).toBe('function')
    })

    it('provides seek function', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      expect(typeof result.current.seek).toBe('function')
    })

    it('provides seekToSegment function', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      expect(typeof result.current.seekToSegment).toBe('function')
    })
  })

  describe('playback speed', () => {
    it('setPlaybackSpeed updates the speed', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      act(() => {
        result.current.setPlaybackSpeed(1.5)
      })

      expect(result.current.playbackSpeed).toBe(1.5)
    })

    it('PLAYBACK_SPEEDS constant contains expected values', () => {
      expect(PLAYBACK_SPEEDS).toContain(0.5)
      expect(PLAYBACK_SPEEDS).toContain(1)
      expect(PLAYBACK_SPEEDS).toContain(1.5)
      expect(PLAYBACK_SPEEDS).toContain(2)
    })
  })

  describe('audioProps', () => {
    it('provides audioProps for audio element', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: mockSegments }))

      expect(result.current.audioProps).toBeDefined()
      expect(result.current.audioProps.ref).toBeDefined()
      expect(typeof result.current.audioProps.onTimeUpdate).toBe('function')
      expect(typeof result.current.audioProps.onLoadedMetadata).toBe('function')
      expect(typeof result.current.audioProps.onEnded).toBe('function')
      expect(typeof result.current.audioProps.onPlay).toBe('function')
      expect(typeof result.current.audioProps.onPause).toBe('function')
    })
  })

  describe('segment callback', () => {
    it('calls onSegmentChange on mount with initial segment', () => {
      let callCount = 0
      let lastSegmentId: string | null = null
      let lastIndex = -1

      const onSegmentChange = (id: string | null, index: number) => {
        callCount++
        lastSegmentId = id
        lastIndex = index
      }

      renderHook(() =>
        useAudioPlayer({ segments: mockSegments, onSegmentChange })
      )

      // Called on mount since time 0 is in first segment
      expect(callCount).toBe(1)
      expect(lastSegmentId).toBe('seg-1')
      expect(lastIndex).toBe(0)
    })
  })

  describe('segment detection helpers', () => {
    it('handles empty segments array', () => {
      const { result } = renderHook(() => useAudioPlayer({ segments: [] }))

      expect(result.current.activeSegmentId).toBeNull()
      expect(result.current.activeSegmentIndex).toBe(-1)
    })
  })

  describe('refs stability', () => {
    it('audioRef remains stable across renders', () => {
      const { result, rerender } = renderHook(() =>
        useAudioPlayer({ segments: mockSegments })
      )

      const firstRef = result.current.audioRef
      rerender()
      const secondRef = result.current.audioRef

      expect(firstRef).toBe(secondRef)
    })
  })

  describe('custom boundary tolerance', () => {
    it('accepts custom boundaryTolerance', () => {
      // Just verify it doesn't throw
      const { result } = renderHook(() =>
        useAudioPlayer({ segments: mockSegments, boundaryTolerance: 200 })
      )

      expect(result.current).toBeDefined()
    })
  })
})
