/**
 * useAudioPlayer - Audio playback hook with segment synchronization
 *
 * Manages audio playback state, provides controls, and detects the active
 * segment based on current playback time with hysteresis to prevent flickering.
 */

import { useRef, useState, useCallback, useEffect } from "react"
import type { SegmentWithTime } from "./types"

/** Default tolerance in milliseconds for segment boundary hysteresis */
const BOUNDARY_TOLERANCE_MS = 100

/** Default playback speeds */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface UseAudioPlayerOptions {
  /** Segments with parsed start/end times */
  segments: SegmentWithTime[]
  /** Initial playback speed (default: 1) */
  initialSpeed?: PlaybackSpeed
  /** Tolerance in ms for segment boundary detection (default: 100ms) */
  boundaryTolerance?: number
  /** Callback when active segment changes */
  onSegmentChange?: (segmentId: string | null, index: number) => void
}

export interface UseAudioPlayerReturn {
  /** Ref to attach to the <audio> element */
  audioRef: React.RefObject<HTMLAudioElement | null>

  // Playback state
  /** Whether audio is currently playing */
  isPlaying: boolean
  /** Current playback position in seconds */
  currentTime: number
  /** Total duration in seconds */
  duration: number
  /** Current playback speed */
  playbackSpeed: PlaybackSpeed

  // Active segment
  /** ID of the currently active segment (based on currentTime) */
  activeSegmentId: string | null
  /** Index of the currently active segment (-1 if none) */
  activeSegmentIndex: number

  // Controls
  /** Start playback */
  play: () => void
  /** Pause playback */
  pause: () => void
  /** Toggle play/pause */
  togglePlayPause: () => void
  /** Seek to a specific time in seconds */
  seek: (timeSeconds: number) => void
  /** Seek to the start of a specific segment */
  seekToSegment: (segmentId: string) => void
  /** Set playback speed */
  setPlaybackSpeed: (speed: PlaybackSpeed) => void

  /**
   * Props to spread onto the <audio> element
   * Includes all necessary event handlers
   */
  audioProps: {
    ref: React.RefObject<HTMLAudioElement | null>
    onTimeUpdate: () => void
    onLoadedMetadata: () => void
    onEnded: () => void
    onPlay: () => void
    onPause: () => void
  }
}

/**
 * Find the active segment at a given time with hysteresis
 * Uses tolerance to prevent flickering at segment boundaries
 */
function findActiveSegmentWithHysteresis(
  segments: SegmentWithTime[],
  timeSeconds: number,
  previousIndex: number,
  toleranceMs: number
): { id: string | null; index: number } {
  const toleranceSec = toleranceMs / 1000

  // If we have a previous segment, check if we're still within it (with tolerance)
  if (previousIndex >= 0 && previousIndex < segments.length) {
    const prev = segments[previousIndex]
    if (
      timeSeconds >= prev.startTime - toleranceSec &&
      timeSeconds <= prev.endTime + toleranceSec
    ) {
      return { id: prev.id, index: previousIndex }
    }
  }

  // Otherwise find the segment containing this time
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (timeSeconds >= segment.startTime && timeSeconds < segment.endTime) {
      return { id: segment.id, index: i }
    }
  }

  // Check if we're past the last segment but within tolerance
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1]
    if (
      timeSeconds >= lastSegment.endTime &&
      timeSeconds <= lastSegment.endTime + toleranceSec
    ) {
      return { id: lastSegment.id, index: segments.length - 1 }
    }
  }

  return { id: null, index: -1 }
}

/**
 * Hook for managing audio playback with segment synchronization
 *
 * @param options - Configuration with segments and callbacks
 * @returns Object with state, controls, and audio element props
 *
 * @example
 * ```tsx
 * const {
 *   isPlaying,
 *   currentTime,
 *   duration,
 *   activeSegmentId,
 *   togglePlayPause,
 *   seek,
 *   audioProps
 * } = useAudioPlayer({ segments })
 *
 * return (
 *   <>
 *     <audio src="/audio.mp3" {...audioProps} />
 *     <button onClick={togglePlayPause}>
 *       {isPlaying ? 'Pause' : 'Play'}
 *     </button>
 *   </>
 * )
 * ```
 */
export function useAudioPlayer(options: UseAudioPlayerOptions): UseAudioPlayerReturn {
  const {
    segments,
    initialSpeed = 1,
    boundaryTolerance = BOUNDARY_TOLERANCE_MS,
    onSegmentChange,
  } = options

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement>(null)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(initialSpeed)

  // Active segment tracking
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)

  // Ref to track previous segment index for hysteresis
  const previousSegmentIndexRef = useRef(-1)

  // Debounce ref for timeupdate
  const lastTimeUpdateRef = useRef(0)
  const TIME_UPDATE_THROTTLE_MS = 50

  /**
   * Update active segment based on current time
   */
  const updateActiveSegment = useCallback(
    (time: number) => {
      const { id, index } = findActiveSegmentWithHysteresis(
        segments,
        time,
        previousSegmentIndexRef.current,
        boundaryTolerance
      )

      if (id !== activeSegmentId || index !== activeSegmentIndex) {
        setActiveSegmentId(id)
        setActiveSegmentIndex(index)
        previousSegmentIndexRef.current = index
        onSegmentChange?.(id, index)
      }
    },
    [segments, boundaryTolerance, activeSegmentId, activeSegmentIndex, onSegmentChange]
  )

  /**
   * Handle timeupdate event from audio element
   * Throttled to prevent excessive updates
   */
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const now = Date.now()
    if (now - lastTimeUpdateRef.current < TIME_UPDATE_THROTTLE_MS) return
    lastTimeUpdateRef.current = now

    setCurrentTime(audio.currentTime)
    updateActiveSegment(audio.currentTime)
  }, [updateActiveSegment])

  /**
   * Handle loadedmetadata event to get duration
   */
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration)
  }, [])

  /**
   * Handle ended event
   */
  const handleEnded = useCallback(() => {
    setIsPlaying(false)
  }, [])

  /**
   * Handle play event
   */
  const handlePlay = useCallback(() => {
    setIsPlaying(true)
  }, [])

  /**
   * Handle pause event
   */
  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  // Controls

  /**
   * Start playback
   */
  const play = useCallback(() => {
    audioRef.current?.play()
  }, [])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  /**
   * Toggle play/pause
   */
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  /**
   * Seek to a specific time
   */
  const seek = useCallback((timeSeconds: number) => {
    const audio = audioRef.current
    if (!audio) return

    const clampedTime = Math.max(0, Math.min(timeSeconds, audio.duration || 0))
    audio.currentTime = clampedTime
    setCurrentTime(clampedTime)
    updateActiveSegment(clampedTime)
  }, [updateActiveSegment])

  /**
   * Seek to the start of a specific segment
   */
  const seekToSegment = useCallback(
    (segmentId: string) => {
      const segment = segments.find((s) => s.id === segmentId)
      if (segment) {
        seek(segment.startTime)
      }
    },
    [segments, seek]
  )

  /**
   * Set playback speed
   */
  const setPlaybackSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeedState(speed)
    const audio = audioRef.current
    if (audio) {
      audio.playbackRate = speed
    }
  }, [])

  /**
   * Sync playback rate when speed changes
   */
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  /**
   * Reset active segment when segments change
   */
  useEffect(() => {
    previousSegmentIndexRef.current = -1
    updateActiveSegment(currentTime)
  }, [segments]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    activeSegmentId,
    activeSegmentIndex,
    play,
    pause,
    togglePlayPause,
    seek,
    seekToSegment,
    setPlaybackSpeed,
    audioProps: {
      ref: audioRef,
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onEnded: handleEnded,
      onPlay: handlePlay,
      onPause: handlePause,
    },
  }
}
