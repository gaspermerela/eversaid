'use client'

import { X, Mic, Square, RotateCcw, Check, Play, Pause } from 'lucide-react'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'

export interface RecordingModalProps {
  isOpen: boolean
  isRecording: boolean
  duration: number
  audioBlob: Blob | null
  error: string | null
  onStartRecording: () => void
  onStopRecording: () => void
  onConfirm: () => void
  onReRecord: () => void
  onClose: () => void
}

/**
 * Format seconds into MM:SS format
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Simple audio preview player with styling matching main AudioPlayer
 */
function PreviewPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }, [isPlaying])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * audioDuration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }, [audioDuration])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setAudioDuration(audio.duration)

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [])

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0

  return (
    <div className="bg-gradient-to-br from-[#1E293B] via-[#334155] to-[#1E293B] rounded-xl px-4 py-3 flex items-center gap-4 shadow-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />

      <button
        onClick={handlePlayPause}
        className="w-10 h-10 bg-gradient-to-br from-white/12 to-white/5 hover:from-white/18 hover:to-white/8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 backdrop-blur-sm border border-white/10 flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-white/90 stroke-white/90" />
        ) : (
          <Play className="w-4 h-4 fill-white/90 stroke-white/90 ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-white/70 font-semibold tabular-nums min-w-[36px]">
          {formatDuration(currentTime)}
        </span>

        <div
          className="flex-1 h-2 bg-white/15 rounded-full relative cursor-pointer group backdrop-blur-sm"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full relative overflow-hidden transition-[width] duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg,
                  hsl(210, 70%, 55%) 0%,
                  hsl(245, 60%, 65%) 50%,
                  hsl(270, 55%, 60%) 100%)`,
              }}
            />
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/20" />
          </div>
          <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white/95 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        <span className="text-xs text-white/70 font-semibold tabular-nums min-w-[36px] text-right">
          {formatDuration(audioDuration)}
        </span>
      </div>
    </div>
  )
}

/**
 * Modal for recording audio with preview functionality.
 * States: Idle → Recording → Preview (with audio player)
 */
export function RecordingModal({
  isOpen,
  isRecording,
  duration,
  audioBlob,
  error,
  onStartRecording,
  onStopRecording,
  onConfirm,
  onReRecord,
  onClose,
}: RecordingModalProps) {
  const t = useTranslations('demo.recording')
  const tCommon = useTranslations('common')

  // Create blob URL synchronously during render using useMemo
  // This is valid because URL.createObjectURL is a pure function (same blob = same behavior)
  // We track created URLs for cleanup in a separate effect
  const audioUrl = useMemo(() => {
    if (!audioBlob) return null
    return URL.createObjectURL(audioBlob)
  }, [audioBlob])

  // Cleanup effect - revoke URLs when they change or on unmount
  // This is the proper pattern: useMemo creates, useEffect cleans up
  useEffect(() => {
    // Return cleanup function that revokes the current URL
    const urlToRevoke = audioUrl
    return () => {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke)
      }
    }
  }, [audioUrl])

  if (!isOpen) {
    return null
  }

  // Determine current state
  const hasRecording = audioBlob !== null && !isRecording
  const isIdle = !isRecording && !hasRecording && !error

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recording-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[2000] bg-[rgba(15,23,42,0.7)] backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300"
    >
      <div className="bg-white rounded-3xl w-full max-w-[400px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.2)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-[linear-gradient(135deg,#0F172A_0%,#1E3A5F_100%)] px-6 pt-8 pb-7 text-center relative">
          <button
            onClick={onClose}
            aria-label={tCommon('close')}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
          >
            <X className="w-[18px] h-[18px] stroke-white/70" strokeWidth={2} />
          </button>

          <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-5 ${
            isRecording
              ? 'bg-[linear-gradient(135deg,rgba(239,68,68,0.3)_0%,rgba(220,38,38,0.3)_100%)] animate-pulse'
              : 'bg-[linear-gradient(135deg,rgba(232,93,4,0.2)_0%,rgba(232,93,4,0.3)_100%)]'
          }`}>
            <Mic className={`w-8 h-8 ${isRecording ? 'stroke-red-400' : 'stroke-[#E85D04]'}`} strokeWidth={2} />
          </div>

          <h2 id="recording-modal-title" className="text-2xl font-extrabold text-white mb-2">
            {t('title')}
          </h2>
          <p className="text-[15px] text-white/70 leading-relaxed">
            {isRecording ? t('recording') : hasRecording ? t('previewSubtitle') : t('subtitle')}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pt-7 pb-8">
          {/* Error State */}
          {error && (
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-red-700 text-sm font-medium">{getErrorMessage(error, t)}</p>
              </div>
              <button
                onClick={onStartRecording}
                className="w-full mt-4 py-3.5 bg-[#E85D04] hover:bg-[#D35400] text-white text-base font-bold rounded-xl transition-all"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}

          {/* Idle State - Start Recording Button */}
          {isIdle && !error && (
            <div className="text-center">
              <button
                onClick={onStartRecording}
                className="w-full py-4 bg-[#E85D04] hover:bg-[#D35400] hover:shadow-[0_8px_24px_rgba(232,93,4,0.4)] hover:-translate-y-0.5 text-white text-base font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(232,93,4,0.3)] flex items-center justify-center gap-3"
              >
                <Mic className="w-5 h-5" strokeWidth={2} />
                {t('startRecording')}
              </button>
              <p className="mt-4 text-sm text-gray-500">{t('hint')}</p>
            </div>
          )}

          {/* Recording State */}
          {isRecording && (
            <div className="text-center">
              {/* Duration Display */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-600 font-medium">{t('recording')}</span>
                </div>
                <div className="text-5xl font-mono font-bold text-gray-900 tracking-wider">
                  {formatDuration(duration)}
                </div>
              </div>

              {/* Stop Button */}
              <button
                onClick={onStopRecording}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white text-base font-bold rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <Square className="w-5 h-5 fill-current" strokeWidth={2} />
                {t('stopRecording')}
              </button>
            </div>
          )}

          {/* Preview State */}
          {hasRecording && !error && (
            <div className="text-center">
              {/* Audio Player */}
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-3">{t('preview')}</div>
                {audioUrl && <PreviewPlayer audioUrl={audioUrl} />}
                <div className="mt-3 text-sm text-gray-400">
                  {t('duration', { time: formatDuration(duration) })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={onConfirm}
                  className="w-full py-3.5 bg-[#E85D04] hover:bg-[#D35400] hover:shadow-[0_8px_24px_rgba(232,93,4,0.4)] hover:-translate-y-0.5 text-white text-base font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(232,93,4,0.3)] flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" strokeWidth={2} />
                  {t('useRecording')}
                </button>
                <button
                  onClick={onReRecord}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" strokeWidth={2} />
                  {t('reRecord')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Get localized error message based on error string from useVoiceRecorder
 */
function getErrorMessage(error: string, t: ReturnType<typeof useTranslations>): string {
  if (error.includes('permission denied') || error.includes('Permission denied')) {
    return t('errors.permissionDenied')
  }
  if (error.includes('No microphone') || error.includes('not found')) {
    return t('errors.notFound')
  }
  if (error.includes('not supported')) {
    return t('errors.notSupported')
  }
  if (error.includes('in use') || error.includes('already in use')) {
    return t('errors.inUse')
  }
  return t('errors.generic')
}
