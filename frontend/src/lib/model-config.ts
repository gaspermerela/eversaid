import type { CleanupType, ModelInfo } from '@/features/transcription/types'

// Default LLM model for each cleanup level
export const CLEANUP_LEVEL_DEFAULT_MODELS: Partial<Record<CleanupType, string>> = {
  'corrected': 'llama-3.3-70b-versatile',
  'corrected-readable': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  // 'formal' and 'verbatim' not included in UI for now
}

// Get default model for a cleanup level
export function getDefaultModelForLevel(level: CleanupType): string | undefined {
  return CLEANUP_LEVEL_DEFAULT_MODELS[level]
}

// Models allowed for cleanup
export const CLEANUP_ALLOWED_MODELS: string[] = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
]

// Models allowed for analysis (separate config)
export const ANALYSIS_ALLOWED_MODELS: string[] = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
]

// Display name overrides (model id -> display name)
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout',
  'openai/gpt-oss-120b': 'GPT OSS 120B',
  'openai/gpt-oss-20b': 'GPT OSS 20B',
}

// Filter and rename models for cleanup
export function getCleanupModels(models: ModelInfo[]): ModelInfo[] {
  return models
    .filter((m) => CLEANUP_ALLOWED_MODELS.includes(m.id))
    .map((m) => ({
      ...m,
      name: MODEL_DISPLAY_NAMES[m.id] ?? m.name,
    }))
}

// Filter and rename models for analysis
export function getAnalysisModels(models: ModelInfo[]): ModelInfo[] {
  return models
    .filter((m) => ANALYSIS_ALLOWED_MODELS.includes(m.id))
    .map((m) => ({
      ...m,
      name: MODEL_DISPLAY_NAMES[m.id] ?? m.name,
    }))
}
