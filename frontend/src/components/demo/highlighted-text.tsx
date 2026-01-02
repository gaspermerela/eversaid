"use client"

import { useMemo } from "react"
import type { TranscriptionWord } from "@/features/transcription/types"
import { cn } from "@/lib/utils"

/** Past word opacity (0-1), configurable via NEXT_PUBLIC_WORD_HIGHLIGHT_PAST_OPACITY env var */
const PAST_WORD_OPACITY =
  Number(process.env.NEXT_PUBLIC_WORD_HIGHLIGHT_PAST_OPACITY ?? 70) / 100

export interface HighlightedTextProps {
  /** Original text (fallback if no words) */
  text: string
  /** Word-level timing data */
  words: TranscriptionWord[]
  /** Index of the currently active word (-1 if none) */
  activeWordIndex: number
  /** Whether audio is currently playing */
  isPlaying: boolean
}

/**
 * Renders text with word-level highlighting during audio playback.
 * Features smooth transitions, soft glow on active word, and dimmed past words.
 * Falls back to plain text if no word data is available.
 */
export function HighlightedText({
  text,
  words,
  activeWordIndex,
  isPlaying,
}: HighlightedTextProps) {
  // Filter to only 'word' type entries
  const wordList = useMemo(
    () => words.filter((w) => w.type === "word"),
    [words]
  )

  // If no words data, render plain text
  if (!wordList.length) {
    return <span>{text}</span>
  }

  return (
    <span>
      {wordList.map((word, index) => {
        const isActive = isPlaying && index === activeWordIndex
        const isPast = isPlaying && index < activeWordIndex

        return (
          <span key={index}>
            <span
              className={cn(
                "inline-block rounded-[3px] px-[2px] -mx-[2px]",
                "motion-safe:transition-all motion-safe:duration-200",
                "motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
                "motion-reduce:transition-none",
                isActive &&
                  "bg-blue-200/80 shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_1px_3px_rgba(59,130,246,0.15)]",
                !isActive && "bg-transparent shadow-none"
              )}
              style={{ opacity: isPast && !isActive ? PAST_WORD_OPACITY : 1 }}
            >
              {word.text}
            </span>
            {/* Add space after word (except last) */}
            {index < wordList.length - 1 && " "}
          </span>
        )
      })}
    </span>
  )
}
