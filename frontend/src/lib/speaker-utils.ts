/**
 * Speaker utility functions for diarization display
 */

/**
 * Maximum speakers supported in demo (enforced in UI)
 */
export const MAX_SPEAKERS = 5

/**
 * Speaker colors - 5 distinct colors for max 5 speakers (0-indexed)
 */
export const SPEAKER_COLORS = {
  border: [
    'border-blue-500',    // Speaker 0 (displays as "Speaker 1")
    'border-green-500',   // Speaker 1 (displays as "Speaker 2")
    'border-purple-500',  // Speaker 2 (displays as "Speaker 3")
    'border-amber-500',   // Speaker 3 (displays as "Speaker 4")
    'border-rose-500',    // Speaker 4 (displays as "Speaker 5")
  ],
  text: [
    'text-blue-600',      // Speaker 0
    'text-green-600',     // Speaker 1
    'text-purple-600',    // Speaker 2
    'text-amber-600',     // Speaker 3
    'text-rose-600',      // Speaker 4
  ],
} as const

/**
 * Get speaker border color class by 0-based index
 */
export function getSpeakerBorderColor(speaker: number): string {
  return SPEAKER_COLORS.border[Math.min(speaker, MAX_SPEAKERS - 1)]
}

/**
 * Get speaker text color class by 0-based index
 */
export function getSpeakerTextColor(speaker: number): string {
  return SPEAKER_COLORS.text[Math.min(speaker, MAX_SPEAKERS - 1)]
}
