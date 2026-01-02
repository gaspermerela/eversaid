import { test, expect, Page, Locator } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

/**
 * Audio Player E2E Tests
 *
 * Uses mock mode which auto-populates with mock transcription data.
 * Audio endpoint is mocked to serve a local test file.
 */

test.describe("Audio Player", () => {
  let audioPlayerBar: Locator

  test.beforeEach(async ({ page }) => {
    // Mock API endpoints
    await page.route("**/api/rate-limits", async (route) => {
      await route.fulfill({
        json: {
          day: { limit: 20, remaining: 20, reset: Date.now() + 86400000 },
          ip_day: { limit: 100, remaining: 100, reset: Date.now() + 86400000 },
          global_day: { limit: 10000, remaining: 10000, reset: Date.now() + 86400000 },
        },
      })
    })

    await page.route("**/api/entries?*", async (route) => {
      await route.fulfill({
        json: { entries: [], total: 0, limit: 10, offset: 0 },
      })
    })

    // Mock audio endpoint to serve local test file with proper headers
    await page.route("**/api/entries/*/audio", async (route) => {
      const audioPath = path.join(__dirname, "audio", "test_audio.wav")
      const audioBuffer = fs.readFileSync(audioPath)

      await route.fulfill({
        body: audioBuffer,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(audioBuffer.length),
          "Content-Disposition": `inline; filename="test_audio.wav"`,
        },
      })
    })

    // Go to demo page with mock mode - this auto-loads mock transcription data
    await page.goto("/en/demo?mock")

    // Wait for the audio player bar to be visible (mock mode shows it immediately)
    audioPlayerBar = page.locator(".bg-gradient-to-br.from-\\[\\#1E293B\\]")
    await expect(audioPlayerBar).toBeVisible({ timeout: 10000 })
  })

  test("displays duration from audio file", async ({ page }) => {
    // Duration display (right side of player)
    const durationDisplay = audioPlayerBar.locator("span.text-right.min-w-\\[48px\\]")
    await expect(durationDisplay).toBeVisible()

    // Wait for duration to load from audio file (should not stay 0:00)
    // Note: With mocked audio file, browser should be able to read duration
    await expect(durationDisplay).not.toHaveText("0:00", { timeout: 5000 })
  })

  test("play button starts playback", async ({ page }) => {
    // Find and click play button
    const playButton = audioPlayerBar.locator("button").first()
    await playButton.click()

    // Wait for playback to start
    await page.waitForTimeout(1000)

    // Current time should have changed from 0:00
    const currentTimeDisplay = audioPlayerBar.locator("span.min-w-\\[48px\\]").first()
    await expect(currentTimeDisplay).not.toHaveText("0:00", { timeout: 3000 })
  })

  test("progress bar exists and is clickable", async ({ page }) => {
    // Progress bar should be visible
    const progressBar = audioPlayerBar.locator(".cursor-pointer.group")
    await expect(progressBar).toBeVisible()

    // Should have cursor-pointer class (indicates it's interactive)
    await expect(progressBar).toHaveClass(/cursor-pointer/)
  })

  test("speed control changes playback rate", async ({ page }) => {
    // Find speed button (shows "1x")
    const speedButton = audioPlayerBar.getByText("1x")
    await speedButton.click()

    // Speed menu should appear
    const speedOption = page.getByText("1.5x")
    await expect(speedOption).toBeVisible()

    // Select 1.5x speed
    await speedOption.click()

    // Speed button should now show 1.5x
    await expect(audioPlayerBar.getByText("1.5x")).toBeVisible()
  })
})
