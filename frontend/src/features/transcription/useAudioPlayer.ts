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
  /** Audio URL - pass this so the hook can detect when audio source changes */
  audioUrl?: string | null
  /** Initial playback speed (default: 1) */
  initialSpeed?: PlaybackSpeed
  /** Tolerance in ms for segment boundary detection (default: 100ms) */
  boundaryTolerance?: number
  /** Callback when active segment changes */
  onSegmentChange?: (segmentId: string | null, index: number) => void
  /** Fallback duration from API (used when audio element can't determine duration from streaming) */
  fallbackDuration?: number
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
    ref: (node: HTMLAudioElement | null) => void
    onTimeUpdate: () => void
    onLoadedMetadata: () => void
    onLoadedData: () => void
    onDurationChange: () => void
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
    audioUrl,
    initialSpeed = 1,
    boundaryTolerance = BOUNDARY_TOLERANCE_MS,
    onSegmentChange,
    fallbackDuration = 0,
  } = options

  // Audio element ref - we use a mutable ref that we update via callback ref
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  // Throttle ref for segment updates (not time updates)
  const lastSegmentUpdateRef = useRef(0)
  const SEGMENT_UPDATE_THROTTLE_MS = 100

  /**
   * Update active segment based on current time
   * Throttled to prevent excessive segment change callbacks
   */
  const updateActiveSegment = useCallback(
    (time: number) => {
      const now = Date.now()
      // Throttle segment updates, but not time updates
      if (now - lastSegmentUpdateRef.current < SEGMENT_UPDATE_THROTTLE_MS) {
        return
      }

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
        lastSegmentUpdateRef.current = now
        onSegmentChange?.(id, index)
      }
    },
    [segments, boundaryTolerance, activeSegmentId, activeSegmentIndex, onSegmentChange]
  )

  /**
   * Handle timeupdate event from audio element
   * Updates currentTime on every event for smooth UI updates
   */
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    // Always update current time for smooth progress bar
    setCurrentTime(audio.currentTime)

    // Also try to get duration if we don't have it yet
    // This is a fallback for when metadata events fire before React attaches handlers
    if (duration === 0 && isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration)
    }

    // Segment updates are throttled internally
    updateActiveSegment(audio.currentTime)
  }, [updateActiveSegment, duration])

  /**
   * Update duration from audio element
   * Extracted to a separate function so it can be called from multiple places
   */
  const updateDuration = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // Only set duration if it's a valid finite positive number
    if (isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration)
    }
  }, [])

  /**
   * Callback ref that detects when audio element mounts/unmounts
   * Checks for duration immediately in case audio is cached/preloaded
   */
  const audioCallbackRef = useCallback((node: HTMLAudioElement | null) => {
    audioRef.current = node
    if (node) {
      // Check if duration is already available (cached audio, preloaded)
      if (isFinite(node.duration) && node.duration > 0) {
        setDuration(node.duration)
      }
      // Apply current playback speed
      node.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  /**
   * Handle loadedmetadata event to get duration
   */
  const handleLoadedMetadata = useCallback(() => {
    updateDuration()
  }, [updateDuration])

  /**
   * Handle loadeddata event as fallback for duration
   * Some browsers fire this before or instead of loadedmetadata
   */
  const handleLoadedData = useCallback(() => {
    updateDuration()
  }, [updateDuration])

  /**
   * Handle durationchange event as additional safety net
   * Fires when duration changes (including when it becomes available)
   */
  const handleDurationChange = useCallback(() => {
    updateDuration()
  }, [updateDuration])

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

    // Use audio.duration if available, otherwise fallback to API duration
    const effectiveDur = (isFinite(audio.duration) && audio.duration > 0)
      ? audio.duration
      : fallbackDuration

    // Guard against no duration available
    if (effectiveDur <= 0) return

    const clampedTime = Math.max(0, Math.min(timeSeconds, effectiveDur))
    if (!isFinite(clampedTime)) return // Extra safety

    audio.currentTime = clampedTime
    setCurrentTime(clampedTime)
    updateActiveSegment(clampedTime)
  }, [updateActiveSegment, fallbackDuration])

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

  /**
   * When audio URL changes (switching entries), reset state and reload metadata
   * This is critical for when the audio element stays mounted but src changes
   */
  useEffect(() => {
    if (!audioUrl) return

    // Reset playback state for new audio
    setDuration(0)
    setCurrentTime(0)
    setIsPlaying(false)

    // Force reload of audio metadata
    audioRef.current?.load()
  }, [audioUrl])

  // Use fallbackDuration from API when audio element can't determine duration
  // This happens when audio is streamed without Content-Length header
  const effectiveDuration = duration > 0 ? duration : fallbackDuration

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration: effectiveDuration,
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
      ref: audioCallbackRef,
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onLoadedData: handleLoadedData,
      onDurationChange: handleDurationChange,
      onEnded: handleEnded,
      onPlay: handlePlay,
      onPause: handlePause,
    },
  }
}
