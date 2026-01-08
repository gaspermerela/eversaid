import type { TranscriptionWord } from "@/features/transcription/types"

export interface SpellcheckError {
  word: string
  start: number
  end: number
  suggestions: string[]
}

export interface Segment {
  id: string
  speaker: number
  time: string
  rawText: string
  cleanedText: string
  originalRawText: string // Immutable original raw text for revert functionality
  paragraphs?: string[] // Optional array of paragraphs for cleaned text
  words?: TranscriptionWord[] // Word-level timing for playback highlighting
}

export interface HistoryEntry {
  id: string
  filename: string
  duration: string
  status: "complete" | "processing" | "error"
  timestamp: string // Added timestamp field for history entries
  /**
   * True if this is a pre-loaded demo entry.
   * Demo entries are special: they're served from static files (not Core API),
   * edits are stored in localStorage, and they cannot be deleted.
   */
  isDemo?: boolean
}

export interface SegmentEditState {
  isEditing: boolean
  hasUnsavedEdits: boolean
}

export interface TextMoveSelection {
  text: string
  sourceSegmentId: string
  sourceColumn: "raw" | "cleaned"
  startOffset: number
  endOffset: number
}

export interface TranscriptDisplayOptions {
  showSpeakerLabels: boolean // true for multi-speaker (diarized), false for single speaker
}

export interface ActiveSuggestion {
  segmentId: string
  word: string
  position: { x: number; y: number }
  suggestions: string[]
}
