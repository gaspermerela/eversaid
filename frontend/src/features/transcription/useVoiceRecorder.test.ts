import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceRecorder } from './useVoiceRecorder'

// Mock MediaRecorder
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions
  ) {}

  start() {
    this.state = 'recording'
    // Simulate data available after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['audio data'], { type: 'audio/webm' }) })
      }
    }, 10)
  }

  stop() {
    this.state = 'inactive'
    if (this.onstop) {
      this.onstop()
    }
  }

  static isTypeSupported(mimeType: string): boolean {
    return mimeType === 'audio/webm' || mimeType === 'audio/webm;codecs=opus'
  }
}

// Mock MediaStream
class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]

  getTracks() {
    return this.tracks
  }
}

class MockMediaStreamTrack {
  stop = vi.fn()
}

describe('useVoiceRecorder', () => {
  let originalMediaRecorder: typeof MediaRecorder
  let originalMediaDevices: MediaDevices | undefined
  let mockGetUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()

    // Store originals
    originalMediaRecorder = globalThis.MediaRecorder
    originalMediaDevices = navigator.mediaDevices

    // Setup mocks
    mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream())

    // Mock MediaRecorder
    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder

    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()

    // Restore originals
    globalThis.MediaRecorder = originalMediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    })
  })

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('initial state', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useVoiceRecorder())

      expect(result.current.isRecording).toBe(false)
      expect(result.current.duration).toBe(0)
      expect(result.current.audioBlob).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('provides all expected methods', () => {
      const { result } = renderHook(() => useVoiceRecorder())

      expect(typeof result.current.startRecording).toBe('function')
      expect(typeof result.current.stopRecording).toBe('function')
      expect(typeof result.current.resetRecording).toBe('function')
    })
  })

  // ===========================================================================
  // Browser Support
  // ===========================================================================

  describe('browser support', () => {
    it('sets error when mediaDevices is not supported', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Audio recording is not supported in this browser')
      expect(result.current.isRecording).toBe(false)
    })

    it('sets error when getUserMedia is not supported', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Audio recording is not supported in this browser')
      expect(result.current.isRecording).toBe(false)
    })
  })

  // ===========================================================================
  // Permission Handling
  // ===========================================================================

  describe('permission handling', () => {
    it('requests microphone permission on start', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    })

    it('handles permission denied error', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'
      mockGetUserMedia.mockRejectedValueOnce(permissionError)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Microphone permission denied')
      expect(result.current.isRecording).toBe(false)
    })

    it('handles legacy PermissionDeniedError', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.name = 'PermissionDeniedError'
      mockGetUserMedia.mockRejectedValueOnce(permissionError)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Microphone permission denied')
    })

    it('handles no microphone found error', async () => {
      const notFoundError = new Error('No microphone')
      notFoundError.name = 'NotFoundError'
      mockGetUserMedia.mockRejectedValueOnce(notFoundError)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('No microphone found')
    })

    it('handles microphone in use error', async () => {
      const inUseError = new Error('Microphone busy')
      inUseError.name = 'NotReadableError'
      mockGetUserMedia.mockRejectedValueOnce(inUseError)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Microphone is already in use')
    })

    it('handles generic errors', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Unknown error'))

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Failed to start recording')
    })

    it('handles non-Error throws', async () => {
      mockGetUserMedia.mockRejectedValueOnce('string error')

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Failed to start recording')
    })
  })

  // ===========================================================================
  // Recording Flow
  // ===========================================================================

  describe('recording flow', () => {
    it('sets isRecording to true when recording starts', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)
    })

    it('clears previous error when starting new recording', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'
      mockGetUserMedia.mockRejectedValueOnce(permissionError)

      const { result } = renderHook(() => useVoiceRecorder())

      // First attempt fails
      await act(async () => {
        await result.current.startRecording()
      })
      expect(result.current.error).toBe('Microphone permission denied')

      // Reset mock for successful attempt
      mockGetUserMedia.mockResolvedValueOnce(new MockMediaStream())

      // Second attempt should clear error
      await act(async () => {
        await result.current.startRecording()
      })
      expect(result.current.error).toBeNull()
    })

    it('creates audioBlob when recording stops', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      // Wait for ondataavailable to fire
      await act(async () => {
        vi.advanceTimersByTime(50)
      })

      await act(async () => {
        result.current.stopRecording()
      })

      expect(result.current.audioBlob).toBeInstanceOf(Blob)
      expect(result.current.isRecording).toBe(false)
    })

    it('sets isRecording to false when recording stops', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)

      await act(async () => {
        result.current.stopRecording()
      })

      expect(result.current.isRecording).toBe(false)
    })

    it('stops media stream tracks when recording stops', async () => {
      const mockStream = new MockMediaStream()
      const mockTrack = mockStream.getTracks()[0]
      mockGetUserMedia.mockResolvedValueOnce(mockStream)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        result.current.stopRecording()
      })

      expect(mockTrack.stop).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Duration Tracking
  // ===========================================================================

  describe('duration tracking', () => {
    it('increments duration every second while recording', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.duration).toBe(0)

      // Advance 1 second
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current.duration).toBe(1)

      // Advance another second
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current.duration).toBe(2)

      // Advance 3 more seconds
      await act(async () => {
        vi.advanceTimersByTime(3000)
      })
      expect(result.current.duration).toBe(5)
    })

    it('stops incrementing duration when recording stops', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        vi.advanceTimersByTime(3000)
      })
      expect(result.current.duration).toBe(3)

      await act(async () => {
        result.current.stopRecording()
      })

      // Duration should not increase after stopping
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.duration).toBe(3)
    })

    it('resets duration when starting new recording', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      // First recording
      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
      expect(result.current.duration).toBe(5)

      await act(async () => {
        result.current.stopRecording()
      })

      // Start new recording
      mockGetUserMedia.mockResolvedValueOnce(new MockMediaStream())
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.duration).toBe(0)
    })
  })

  // ===========================================================================
  // Reset
  // ===========================================================================

  describe('reset', () => {
    it('resets all state to initial values', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      // Start and stop recording
      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        vi.advanceTimersByTime(3000)
      })

      await act(async () => {
        result.current.stopRecording()
      })

      expect(result.current.audioBlob).not.toBeNull()
      expect(result.current.duration).toBe(3)

      // Reset
      await act(async () => {
        result.current.resetRecording()
      })

      expect(result.current.isRecording).toBe(false)
      expect(result.current.duration).toBe(0)
      expect(result.current.audioBlob).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('stops ongoing recording when reset is called', async () => {
      const mockStream = new MockMediaStream()
      const mockTrack = mockStream.getTracks()[0]
      mockGetUserMedia.mockResolvedValueOnce(mockStream)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)

      await act(async () => {
        result.current.resetRecording()
      })

      expect(result.current.isRecording).toBe(false)
      expect(mockTrack.stop).toHaveBeenCalled()
    })

    it('clears error when reset is called', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'
      mockGetUserMedia.mockRejectedValueOnce(permissionError)

      const { result } = renderHook(() => useVoiceRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBe('Microphone permission denied')

      await act(async () => {
        result.current.resetRecording()
      })

      expect(result.current.error).toBeNull()
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('does nothing when stopRecording called without active recording', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      // Should not throw
      await act(async () => {
        result.current.stopRecording()
      })

      expect(result.current.isRecording).toBe(false)
      expect(result.current.audioBlob).toBeNull()
    })

    it('clears previous audioBlob when starting new recording', async () => {
      const { result } = renderHook(() => useVoiceRecorder())

      // First recording
      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        vi.advanceTimersByTime(50)
        result.current.stopRecording()
      })

      const firstBlob = result.current.audioBlob
      expect(firstBlob).not.toBeNull()

      // Start new recording
      mockGetUserMedia.mockResolvedValueOnce(new MockMediaStream())
      await act(async () => {
        await result.current.startRecording()
      })

      // audioBlob should be cleared
      expect(result.current.audioBlob).toBeNull()
    })
  })
})
