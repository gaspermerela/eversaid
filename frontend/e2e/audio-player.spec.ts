import { test, expect, Locator } from "@playwright/test"
import { setupDemoMocks } from "./mocks/setup-mocks"

/**
 * Audio Player E2E Tests
 *
 * Uses shared mock infrastructure which provides mock transcription data
 * and a programmatically generated silent audio buffer.
 */

test.describe("Audio Player", () => {
  let audioPlayerBar: Locator

  test.beforeEach(async ({ page }) => {
    // Setup all API mocks before navigation
    await setupDemoMocks(page)
    // Use ?entry=demo-en to trigger demo loading via useTranscription.loadEntry
    await page.goto("/en/demo?entry=demo-en")

    // Wait for the audio player bar to be visible
    audioPlayerBar = page.locator(".bg-gradient-to-br.from-\\[\\#1E293B\\]")
    await expect(audioPlayerBar).toBeVisible({ timeout: 10000 })
  })

  test("displays duration from audio file", async () => {
    // Duration display (right side of player)
    const durationDisplay = audioPlayerBar.locator(
      "span.text-right.min-w-\\[48px\\]"
    )
    await expect(durationDisplay).toBeVisible()

    // Wait for duration to load from audio file (should not stay 0:00)
    // Note: With mocked audio file, browser should be able to read duration
    await expect(durationDisplay).not.toHaveText("0:00", { timeout: 5000 })
  })

  test("play button is clickable", async () => {
    // Find play button (first button in audio player bar)
    const playButton = audioPlayerBar.locator("button").first()
    await expect(playButton).toBeVisible()

    // Click should work without errors
    await playButton.click()

    // Button should still be visible (now showing pause state)
    await expect(playButton).toBeVisible()
  })

  test("progress bar exists and is clickable", async () => {
    // Progress bar should be visible
    const progressBar = audioPlayerBar.locator(".cursor-pointer.group")
    await expect(progressBar).toBeVisible()

    // Should have cursor-pointer class (indicates it's interactive)
    await expect(progressBar).toHaveClass(/cursor-pointer/)
  })

  test("speed control changes playback rate", async ({ page }) => {
    // First expand editor so the speed menu dropdown isn't blocked by the expand overlay
    const expandOverlay = page.getByRole("button", { name: /expand editor/i })
    await expandOverlay.click()
    await page.waitForTimeout(300)

    // Find speed button (shows "1x")
    const speedButton = audioPlayerBar
      .locator("button")
      .filter({ hasText: /^1x$/ })
    await expect(speedButton).toBeVisible()

    // Click to open speed menu
    await speedButton.click()

    // Speed menu should appear - wait for it
    await page.waitForTimeout(200)

    // Select 1.5x speed from the dropdown menu
    const speedOption = page
      .locator("button")
      .filter({ hasText: /^1\.5x$/ })
      .last()
    await expect(speedOption).toBeVisible()
    await speedOption.click()

    // Wait for state update
    await page.waitForTimeout(300)

    // Speed button should now show 1.5x
    await expect(
      audioPlayerBar.locator("button").filter({ hasText: /^1\.5x$/ })
    ).toBeVisible({ timeout: 5000 })
  })

  // Regression tests for audio player visibility bug (fixed in flex layout update)
  test("stays visible when starting playback", async ({ page }) => {
    // Audio player should be visible initially
    await expect(audioPlayerBar).toBeVisible()

    // Click play button WITHOUT clicking any segment first
    const playButton = audioPlayerBar.locator("button").first()
    await playButton.click()

    // Wait for playback to start
    await page.waitForTimeout(1000)

    // Audio player should STILL be visible
    await expect(audioPlayerBar).toBeVisible()
  })

  test("stays visible after clicking segment and playing", async ({ page }) => {
    // First expand to access segments (overlay covers them in collapsed mode)
    const expandOverlay = page.getByRole("button", { name: /expand editor/i })
    await expandOverlay.click()
    await page.waitForTimeout(300)

    // Click segment 2
    const segment2 = page.locator('[data-segment-id="seg-2"]').first()
    await expect(segment2).toBeVisible()
    await segment2.click()

    // Wait for seek to complete
    await page.waitForTimeout(500)

    // Audio player should still be visible after segment click
    await expect(audioPlayerBar).toBeVisible()

    // Click play button
    const playButton = audioPlayerBar.locator("button").first()
    await playButton.click()

    // Wait for playback to start
    await page.waitForTimeout(1000)

    // Audio player should STILL be visible
    await expect(audioPlayerBar).toBeVisible()
  })
})
