/**
 * Demo Entry localStorage Storage Utilities
 *
 * ## Why localStorage for Demo Edits?
 *
 * Demo entries are special: they're pre-computed and served from static files,
 * NOT stored in Core API like regular entries. This creates a challenge for edits:
 *
 * **Option A: "Adopt" via Core API**
 * - Would re-transcribe the audio (30-60 second wait)
 * - Consumes user's rate limit quota for a demo
 * - Complex: creates new entry, maintains dual state
 *
 * **Option B: localStorage (chosen)**
 * - Instant saves (no API call)
 * - No rate limit consumption
 * - Persists as long as browser session (like the anonymous session)
 * - Simple implementation (frontend-only)
 *
 * ## Trade-offs
 *
 * - Edits are lost if user clears browser data
 * - Not synced across devices (but neither is the anonymous session)
 * - No undo history beyond session (acceptable for demo exploration)
 *
 * ## Data Format
 *
 * ```json
 * {
 *   "segments": {
 *     "seg-1": { "cleanedText": "Edited text here" },
 *     "seg-3": { "cleanedText": "Another edit" }
 *   }
 * }
 * ```
 *
 * Only stores the delta (changed segments), not the full state.
 * Original text is always available from the static JSON.
 *
 * @see useDemoEntry - Hook that fetches demo data
 * @see useTranscription.loadDemoEntry - Merges localStorage edits with static data
 */

/**
 * Storage key prefix for demo edits.
 * Format: eversaid_demo_edits_{locale}
 */
const DEMO_EDITS_KEY_PREFIX = "eversaid_demo_edits_"

/**
 * Stored edit data for a single segment
 */
export interface DemoSegmentEdit {
  /** The user's edited cleaned text */
  cleanedText: string
  /** When the edit was made (ISO string) */
  editedAt: string
}

/**
 * Full localStorage structure for demo edits
 */
export interface DemoEditsData {
  /** Map of segment ID to edit data */
  segments: Record<string, DemoSegmentEdit>
  /** Schema version for future migrations */
  version: 1
}

/**
 * Get the localStorage key for a given locale
 */
function getStorageKey(locale: string): string {
  return `${DEMO_EDITS_KEY_PREFIX}${locale}`
}

/**
 * Get all demo edits for a locale.
 *
 * @param locale - The locale ('en' or 'sl')
 * @returns The stored edits, or null if none exist
 *
 * @example
 * ```ts
 * const edits = getDemoEdits('en')
 * if (edits) {
 *   // Merge with static demo data
 *   segments.forEach(seg => {
 *     if (edits.segments[seg.id]) {
 *       seg.cleanedText = edits.segments[seg.id].cleanedText
 *     }
 *   })
 * }
 * ```
 */
export function getDemoEdits(locale: string): DemoEditsData | null {
  if (typeof window === "undefined") return null

  try {
    const key = getStorageKey(locale)
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const data = JSON.parse(stored) as DemoEditsData
    // Validate version for future migrations
    if (data.version !== 1) {
      console.warn("Unknown demo edits version, clearing:", data.version)
      localStorage.removeItem(key)
      return null
    }

    return data
  } catch (err) {
    console.error("Failed to read demo edits from localStorage:", err)
    return null
  }
}

/**
 * Save a demo segment edit to localStorage.
 *
 * Only stores the changed text, not the full segment data.
 * Preserves other edits in the same locale.
 *
 * @param locale - The locale ('en' or 'sl')
 * @param segmentId - The segment ID
 * @param cleanedText - The new cleaned text
 *
 * @example
 * ```ts
 * saveDemoEdit('en', 'seg-1', 'Updated text here')
 * ```
 */
export function saveDemoEdit(
  locale: string,
  segmentId: string,
  cleanedText: string
): void {
  if (typeof window === "undefined") return

  try {
    const key = getStorageKey(locale)
    const existing = getDemoEdits(locale) || {
      segments: {},
      version: 1 as const,
    }

    // Update or add the segment edit
    existing.segments[segmentId] = {
      cleanedText,
      editedAt: new Date().toISOString(),
    }

    localStorage.setItem(key, JSON.stringify(existing))
  } catch (err) {
    console.error("Failed to save demo edit to localStorage:", err)
  }
}

/**
 * Save multiple demo segment edits at once.
 *
 * More efficient than calling saveDemoEdit multiple times
 * when updating several segments (e.g., text move operation).
 *
 * @param locale - The locale ('en' or 'sl')
 * @param edits - Map of segment ID to new cleaned text
 *
 * @example
 * ```ts
 * saveDemoEdits('en', new Map([
 *   ['seg-1', 'Text removed from here'],
 *   ['seg-2', 'Text moved to here'],
 * ]))
 * ```
 */
export function saveDemoEdits(
  locale: string,
  edits: Map<string, string>
): void {
  if (typeof window === "undefined") return

  try {
    const key = getStorageKey(locale)
    const existing = getDemoEdits(locale) || {
      segments: {},
      version: 1 as const,
    }

    const now = new Date().toISOString()
    for (const [segmentId, cleanedText] of edits.entries()) {
      existing.segments[segmentId] = {
        cleanedText,
        editedAt: now,
      }
    }

    localStorage.setItem(key, JSON.stringify(existing))
  } catch (err) {
    console.error("Failed to save demo edits to localStorage:", err)
  }
}

/**
 * Clear a specific segment's edit (revert to original).
 *
 * Use this when user reverts a segment back to raw text.
 * The original cleaned text will be restored from static JSON on next load.
 *
 * @param locale - The locale ('en' or 'sl')
 * @param segmentId - The segment ID to clear
 *
 * @example
 * ```ts
 * // User clicks "Revert" on a segment
 * clearDemoSegmentEdit('en', 'seg-1')
 * ```
 */
export function clearDemoSegmentEdit(locale: string, segmentId: string): void {
  if (typeof window === "undefined") return

  try {
    const key = getStorageKey(locale)
    const existing = getDemoEdits(locale)
    if (!existing) return

    delete existing.segments[segmentId]

    // If no more edits, remove the entire key
    if (Object.keys(existing.segments).length === 0) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(existing))
    }
  } catch (err) {
    console.error("Failed to clear demo segment edit:", err)
  }
}

/**
 * Clear all demo edits for a locale.
 *
 * Resets the demo entry to its original state from static JSON.
 *
 * @param locale - The locale ('en' or 'sl')
 *
 * @example
 * ```ts
 * // User clicks "Reset Demo"
 * clearAllDemoEdits('en')
 * ```
 */
export function clearAllDemoEdits(locale: string): void {
  if (typeof window === "undefined") return

  try {
    const key = getStorageKey(locale)
    localStorage.removeItem(key)
  } catch (err) {
    console.error("Failed to clear all demo edits:", err)
  }
}

/**
 * Check if a demo entry has any user edits.
 *
 * @param locale - The locale ('en' or 'sl')
 * @returns True if there are stored edits
 */
export function hasDemoEdits(locale: string): boolean {
  const edits = getDemoEdits(locale)
  return edits !== null && Object.keys(edits.segments).length > 0
}

/**
 * Get the count of edited segments for a locale.
 *
 * @param locale - The locale ('en' or 'sl')
 * @returns Number of segments with user edits
 */
export function getDemoEditCount(locale: string): number {
  const edits = getDemoEdits(locale)
  return edits ? Object.keys(edits.segments).length : 0
}
