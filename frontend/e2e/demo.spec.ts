import { test, expect } from "@playwright/test"
import { setupDemoMocks, setupUploadModeMocks } from "./mocks/setup-mocks"

test.describe("Demo Page", () => {
  test.beforeEach(async ({ page }) => {
    // Setup all API mocks before navigation
    // Demo entries are now regular entries created by PostgreSQL trigger
    // They're identified by filename pattern "demo-*.mp3"
    await setupDemoMocks(page)
    // Use ?entry=demo-en to load the demo entry via standard /api/entries/{id}
    await page.goto("/en/demo?entry=demo-en")
  })

  test("loads with transcript visible", async ({ page }) => {
    // Audio player - target by the play icon container (button with Play/Pause icon)
    await expect(
      page
        .locator("button")
        .filter({ has: page.locator("svg[class*='fill-white']") })
        .first()
    ).toBeVisible()

    // Transcript sections visible
    await expect(page.getByText("Raw Transcription")).toBeVisible()
    await expect(page.getByText("AI Cleaned")).toBeVisible()

    // At least one segment visible
    await expect(page.getByText("Speaker 1").first()).toBeVisible()
  })

  test("audio player controls work", async ({ page }) => {
    // Find play button by the gradient background container
    const playButton = page
      .locator("button")
      .filter({ has: page.locator("svg[class*='fill-white']") })
      .first()

    await expect(playButton).toBeVisible()
    await playButton.click()

    // After click, button should still be there (now showing pause icon)
    await expect(playButton).toBeVisible()
  })

  test("can toggle diff view", async ({ page }) => {
    // First expand the editor by clicking the overlay (required since fullscreen mode was added)
    const expandOverlay = page.getByRole("button", { name: /expand editor/i })
    await expect(expandOverlay).toBeVisible()
    await expandOverlay.click()

    // Wait for editor to expand
    await page.waitForTimeout(300)

    // Find the diff toggle button by its aria-label (button with Eye icon)
    const diffButton = page.getByRole("button", { name: /hide changes/i })

    await expect(diffButton).toBeVisible()

    // Check initial state - button should be pressed (diff is on)
    await expect(diffButton).toHaveAttribute("aria-pressed", "true")

    // Toggle off
    await diffButton.click()

    // After toggle, button label changes to "Show changes" and aria-pressed is false
    const diffButtonOff = page.getByRole("button", { name: /show changes/i })
    await expect(diffButtonOff).toHaveAttribute("aria-pressed", "false")

    // Toggle back on
    await diffButtonOff.click()
    await expect(diffButton).toHaveAttribute("aria-pressed", "true")
  })

  test("transcript copy buttons work", async ({ page }) => {
    // First expand the editor by clicking the overlay (required since fullscreen mode was added)
    const expandOverlay = page.getByRole("button", { name: /expand editor/i })
    await expect(expandOverlay).toBeVisible()
    await expandOverlay.click()

    // Wait for editor to expand
    await page.waitForTimeout(300)

    // Copy button should be visible (there are multiple, pick first)
    const copyButton = page.getByRole("button", { name: "Copy" }).first()
    await expect(copyButton).toBeVisible()

    // Click should not throw
    await copyButton.click()
  })

  test("analysis section displays content", async ({ page }) => {
    // Analysis section header
    await expect(page.getByText("AI Analysis")).toBeVisible()

    // The section should be visible, either showing loading, empty state, or content
  })

  test("sidebar elements are visible in transcript mode", async ({ page }) => {
    // In transcript mode, FeedbackCard is visible (not EntryHistoryCard)
    // Feedback card - actual text is "How was the quality?"
    await expect(page.getByText("How was the quality?")).toBeVisible()

    // Waitlist CTA (appears in various places)
    await expect(page.getByText(/waitlist/i).first()).toBeVisible()
  })
})

test.describe("Demo Page - Upload Mode", () => {
  test("sidebar elements are visible in upload mode", async ({ page }) => {
    // Setup mocks for upload mode (empty entry history)
    // Simulates fresh user before demo entry is created by trigger
    await setupUploadModeMocks(page)
    await page.goto("/en/demo")

    // History card - visible in upload mode
    await expect(page.getByText("Your Transcriptions")).toBeVisible()
  })
})
