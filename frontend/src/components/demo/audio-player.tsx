"use client"

import type React from "react"
import { useState } from "react"
import { Play, Pause, Download } from "lucide-react"

export interface AudioPlayerProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackSpeed: number
  showSpeedMenu?: boolean
  onPlayPause: () => void
  onSeek: (time: number) => void
  onSpeedChange: (speed: number) => void
  onToggleSpeedMenu?: () => void
  onDownload: () => void
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function AudioPlayer({
  isPlaying,
  currentTime,
  duration,
  playbackSpeed,
  showSpeedMenu: showSpeedMenuProp,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onToggleSpeedMenu: onToggleSpeedMenuProp,
  onDownload,
}: AudioPlayerProps) {
  const [internalShowSpeedMenu, setInternalShowSpeedMenu] = useState(false)

  const showSpeedMenu = showSpeedMenuProp !== undefined ? showSpeedMenuProp : internalShowSpeedMenu
  const handleToggleSpeedMenu = onToggleSpeedMenuProp ?? (() => setInternalShowSpeedMenu(prev => !prev))

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // This creates a gentle "wave" that moves through the progress bar as audio plays
  const gradientOffset = (currentTime % 8) * 12.5 // Cycles every 8 seconds, moves 0-100%

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't seek if duration is invalid
    if (!isFinite(duration) || duration <= 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * duration
    onSeek(newTime)
  }

  return (
    <div className="bg-gradient-to-br from-[#1E293B] via-[#334155] to-[#1E293B] px-8 py-5 flex items-center gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-b border-white/5 rounded-t-2xl">
      <button
        onClick={onPlayPause}
        className="w-12 h-12 bg-gradient-to-br from-white/12 to-white/5 hover:from-white/18 hover:to-white/8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 backdrop-blur-sm border border-white/10"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-white/90 stroke-white/90 ml-0" />
        ) : (
          <Play className="w-5 h-5 fill-white/90 stroke-white/90 ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex items-center gap-4">
        <span className="text-sm text-white/70 font-semibold tabular-nums tracking-wide drop-shadow-sm min-w-[48px]">
          {formatTime(currentTime)}
        </span>

        <div
          className="flex-1 h-2 bg-white/15 rounded-full relative cursor-pointer group backdrop-blur-sm shadow-inner"
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full relative overflow-hidden transition-[width] duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          >
            {/* Base gradient layer */}
            <div
              className="absolute inset-0 transition-all duration-300"
              style={{
                background: `linear-gradient(90deg, 
                  hsl(210, 70%, 55%) 0%, 
                  hsl(245, 60%, 65%) 50%, 
                  hsl(270, 55%, 60%) 100%)`,
              }}
            />
            {/* Subtle moving highlight layer - creates gentle shimmer effect */}
            <div
              className="absolute inset-0 transition-all duration-500"
              style={{
                background: isPlaying
                  ? `linear-gradient(90deg, 
                      transparent ${Math.max(0, gradientOffset - 30)}%, 
                      rgba(255,255,255,0.15) ${gradientOffset}%, 
                      transparent ${Math.min(100, gradientOffset + 30)}%)`
                  : "transparent",
              }}
            />
            {/* Soft glow at the leading edge */}
            <div
              className="absolute right-0 top-0 bottom-0 w-8 transition-opacity duration-300"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2))",
                opacity: isPlaying ? 1 : 0.5,
              }}
            />
            {/* Progress handle */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white/95 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ring-2 ring-white/15" />
          </div>
        </div>

        <span className="text-sm text-white/70 font-semibold tabular-nums tracking-wide drop-shadow-sm min-w-[48px] text-right">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex gap-3">
        <div className="relative">
          <button
            onClick={handleToggleSpeedMenu}
            className="w-11 h-11 bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/8 rounded-xl flex items-center justify-center transition-all duration-300 text-sm font-bold text-white/85 shadow-md hover:shadow-lg hover:scale-105 backdrop-blur-sm border border-white/10"
          >
            {playbackSpeed}x
          </button>

          {showSpeedMenu && (
            <div className="absolute right-0 top-full mt-3 min-w-[80px] bg-gradient-to-br from-[#334155] to-[#1E293B] border border-white/10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-10 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    onSpeedChange(speed)
                    handleToggleSpeedMenu()
                  }}
                  className={`block w-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap text-left ${
                    playbackSpeed === speed
                      ? "bg-gradient-to-r from-[#60A5FA] to-[#A78BFA] text-white shadow-[0_0_8px_rgba(96,165,250,0.2)]"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onDownload}
          className="w-11 h-11 bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/8 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 backdrop-blur-sm border border-white/10"
        >
          <Download className="w-5 h-5 stroke-white/85" />
        </button>
      </div>
    </div>
  )
}
