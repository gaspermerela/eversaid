import type { Page } from "@playwright/test"

/**
 * Shared E2E Mock Infrastructure
 *
 * Provides centralized mock data and setup functions for Playwright E2E tests.
 * All API routes are mocked to ensure tests run in isolation without Core API calls.
 */

// ============================================================================
// Mock Data
// ============================================================================

export const mockRateLimits = {
  day: { limit: 20, remaining: 20, reset: Date.now() + 86400000 },
  ip_day: { limit: 100, remaining: 100, reset: Date.now() + 86400000 },
  global_day: { limit: 10000, remaining: 10000, reset: Date.now() + 86400000 },
}

export const mockEmptyEntries = {
  entries: [],
  total: 0,
  limit: 10,
  offset: 0,
}

// Demo entry that appears in user's history (created by PostgreSQL trigger)
export const mockDemoEntryInHistory = {
  id: "demo-en",
  original_filename: "demo-en.mp3",
  entry_type: "audio",
  duration_seconds: 45,
  created_at: new Date().toISOString(),
}

export const mockEntriesWithDemo = {
  entries: [mockDemoEntryInHistory],
  total: 1,
  limit: 10,
  offset: 0,
}

export const mockProfiles = [
  {
    id: "generic-summary",
    label: "Conversation Summary",
    intent: "summarization",
    description: "General summary of the conversation",
    is_default: true,
    outputs: ["summary", "topics", "key_points"],
  },
  {
    id: "action-items",
    label: "Action Items & Decisions",
    intent: "task extraction",
    description: "Extract action items and decisions",
    is_default: false,
    outputs: ["summary", "topics", "key_points"],
  },
  {
    id: "reflection",
    label: "Reflection & Insights",
    intent: "self-discovery",
    description: "Personal reflection and insights",
    is_default: false,
    outputs: ["summary", "topics", "key_points"],
  },
]

export const mockSegments = [
  {
    id: "seg-1",
    speaker: 0, // Speaker indices are 0-based, displays as "Speaker 1"
    start_time: 0,
    end_time: 15,
    raw_text: "So basically I wanted to discuss the quarterly planning.",
    cleaned_text: "I wanted to discuss the quarterly planning.",
  },
  {
    id: "seg-2",
    speaker: 1, // Displays as "Speaker 2"
    start_time: 15,
    end_time: 30,
    raw_text: "Yeah that sounds good lets go through the budget.",
    cleaned_text: "That sounds good. Let's go through the budget.",
  },
]

export const mockEntry = {
  id: "mock-entry-1",
  cleanup_id: "mock-cleanup-1",
  status: "completed",
  duration_seconds: 45,
  speaker_count: 2,
  created_at: new Date().toISOString(),
  segments: mockSegments,
}

// Full demo entry details (returned by /api/entries/demo-en)
// Uses filename pattern "demo-*.mp3" to identify demo entries
export const mockDemoEntry = {
  id: "demo-en",
  original_filename: "demo-en.mp3", // Pattern: demo-{locale}.mp3
  saved_filename: "demo-en.mp3",
  duration_seconds: 45,
  entry_type: "audio",
  uploaded_at: new Date().toISOString(),
  primary_transcription: {
    id: "demo-transcription-en",
    status: "completed" as const,
    transcribed_text: mockSegments.map((s) => s.raw_text).join(" "),
    segments: mockSegments.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      start: s.start_time,
      end: s.end_time,
      text: s.raw_text,
    })),
  },
  // cleanup field matches CleanedEntry interface (not latest_cleaned_entry)
  cleanup: {
    id: "demo-cleanup-en",
    voice_entry_id: "demo-en",
    transcription_id: "demo-transcription-en",
    user_id: "demo-user",
    cleaned_text: mockSegments.map((s) => s.cleaned_text).join(" "),
    status: "completed" as const,
    llm_provider: "mock",
    llm_model: "mock-model",
    is_primary: true,
    created_at: new Date().toISOString(),
    cleanup_data_edited: null,
    cleaned_segments: mockSegments.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      start: s.start_time,
      end: s.end_time,
      text: s.cleaned_text,
    })),
  },
  analyses: [],
}

export const mockAnalysisResult = {
  id: "analysis-123",
  cleaned_entry_id: "mock-cleanup-1",
  user_id: "user-789",
  profile_id: "generic-summary",
  profile_label: "Conversation Summary",
  status: "completed" as const,
  llm_provider: "openai",
  llm_model: "gpt-4",
  created_at: new Date().toISOString(),
  result: {
    summary: "Discussion about quarterly planning and budget allocation for Q1.",
    topics: ["planning", "budget", "timeline"],
    key_points: [
      "Increase Q1 budget by 20%",
      "Launch new feature in March",
      "Review metrics weekly",
    ],
  },
}

// ============================================================================
// Audio Buffer Generation
// ============================================================================

/**
 * Creates a minimal valid WAV file buffer with silence.
 * Eliminates the need for external audio test files.
 */
export function createSilentWavBuffer(durationSeconds: number = 1): Buffer {
  const sampleRate = 44100
  const numChannels = 1
  const bitsPerSample = 16
  const numSamples = Math.floor(sampleRate * durationSeconds)
  const dataSize = numSamples * numChannels * (bitsPerSample / 8)

  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8)

  // fmt subchunk
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28) // ByteRate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32) // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34)

  // data subchunk
  buffer.write("data", 36)
  buffer.writeUInt32LE(dataSize, 40)
  // Data section is already zero-filled (silent)

  return buffer
}

// ============================================================================
// Mock Setup Functions
// ============================================================================

export interface SetupMocksOptions {
  /** Include analysis-related route mocks (default: true) */
  withAnalysis?: boolean
  /** Include feedback route mocks for POST (default: false) */
  withFeedback?: boolean
  /** Custom analysis result to return */
  analysisResult?: typeof mockAnalysisResult
}

/**
 * Setup all API mocks for demo page E2E tests.
 *
 * Call this BEFORE page.goto() to ensure all routes are intercepted.
 *
 * @example
 * ```ts
 * test.beforeEach(async ({ page }) => {
 *   await setupDemoMocks(page)
 *   await page.goto("/en/demo")
 * })
 * ```
 */
export async function setupDemoMocks(
  page: Page,
  options: SetupMocksOptions = {}
): Promise<void> {
  const {
    withAnalysis = true,
    withFeedback = false,
    analysisResult = mockAnalysisResult,
  } = options

  const audioBuffer = createSilentWavBuffer(2) // 2 seconds of silence

  // Mock rate limits
  await page.route("**/api/rate-limits", async (route) => {
    await route.fulfill({ json: mockRateLimits })
  })

  // Mock entries list (includes demo entry from PostgreSQL trigger)
  await page.route("**/api/entries?*", async (route) => {
    await route.fulfill({ json: mockEntriesWithDemo })
  })

  // Mock entry details - handles both demo and regular entries
  await page.route("**/api/entries/*", async (route) => {
    const url = route.request().url()
    // Skip sub-resource requests (handled by other routes)
    if (
      url.includes("/analyses") ||
      url.includes("/audio") ||
      url.includes("/feedback")
    ) {
      return route.continue()
    }
    // Return demo entry for demo-* IDs, regular entry otherwise
    const entryId = url.split("/api/entries/")[1]?.split("/")[0]?.split("?")[0]
    if (entryId?.startsWith("demo-")) {
      await route.fulfill({ json: mockDemoEntry })
    } else {
      await route.fulfill({ json: mockEntry })
    }
  })

  // Mock entry audio endpoint
  await page.route("**/api/entries/*/audio", async (route) => {
    await route.fulfill({
      body: audioBuffer,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.length),
        "Content-Disposition": 'inline; filename="audio.wav"',
      },
    })
  })

  // Mock feedback endpoints
  await page.route("**/api/entries/*/feedback", async (route) => {
    if (route.request().method() === "POST" && withFeedback) {
      const body = route.request().postDataJSON()
      await route.fulfill({
        json: {
          id: "feedback-" + Date.now(),
          entry_id: "mock-entry-1",
          feedback_type: body?.feedback_type ?? "transcription",
          rating: body?.rating ?? 4,
          feedback_text: body?.feedback_text ?? null,
          created_at: new Date().toISOString(),
        },
      })
    } else {
      // GET - return empty array (no existing feedback)
      await route.fulfill({ json: [] })
    }
  })

  if (withAnalysis) {
    // Mock analysis profiles
    await page.route("**/api/analysis-profiles", async (route) => {
      await route.fulfill({ json: { profiles: mockProfiles } })
    })

    // Mock list analyses for cleaned entry
    await page.route("**/api/cleaned-entries/*/analyses", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { analyses: [analysisResult] } })
      } else {
        // POST - trigger new analysis
        await route.fulfill({
          json: {
            id: "analysis-new",
            status: "pending",
            profile_id: "generic-summary",
          },
        })
      }
    })

    // Mock get single analysis (for polling)
    await page.route("**/api/analyses/*", async (route) => {
      await route.fulfill({ json: analysisResult })
    })
  }
}

/**
 * Setup minimal mocks for upload mode tests (no transcript loaded).
 * Simulates a fresh user with empty entry history.
 */
export async function setupUploadModeMocks(page: Page): Promise<void> {
  await page.route("**/api/rate-limits", async (route) => {
    await route.fulfill({ json: mockRateLimits })
  })

  // Empty entries list (simulates fresh user before trigger has run or user deleted entries)
  await page.route("**/api/entries?*", async (route) => {
    await route.fulfill({ json: mockEmptyEntries })
  })

  await page.route("**/api/analysis-profiles", async (route) => {
    await route.fulfill({ json: { profiles: mockProfiles } })
  })
}
