import type { CleanupType } from '@/features/transcription/types'

// Cleanup levels shown in the UI (order matters for dropdown)
export const CLEANUP_LEVELS: CleanupType[] = [
  'corrected',
  'corrected-readable',
  // 'corrected-readable-v2',
  // 'corrected-readable-v3',
  // 'verbatim' and 'formal' not included in UI for now
]

// Default cleanup level for new entries
export const DEFAULT_CLEANUP_LEVEL: CleanupType = 'corrected-readable'

// Default LLM model for each cleanup level
export const CLEANUP_LEVEL_DEFAULT_MODELS: Partial<Record<CleanupType, string>> = {
  'corrected': 'llama-3.3-70b-versatile',
  'corrected-readable': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  'corrected-readable-v2': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  'corrected-readable-v3': 'meta-llama/llama-4-maverick-17b-128e-instruct',
}

// Get default model for a cleanup level
export function getDefaultModelForLevel(level: CleanupType): string | undefined {
  return CLEANUP_LEVEL_DEFAULT_MODELS[level]
}

// Temperature options for cleanup (null = API default, which is typically 0)
export const CLEANUP_TEMPERATURES: (number | null)[] = [
  null, 0, 0.05, 0.1, 0.3, 0.5, 0.8, 1.0
]

// Default temperature (null = not specified, API decides)
export const DEFAULT_CLEANUP_TEMPERATURE: number | null = null
