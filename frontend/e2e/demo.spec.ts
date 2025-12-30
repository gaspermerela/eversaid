import { test, expect } from "@playwright/test"

test.describe("Demo Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo")
  })

  test("loads with transcript visible", async ({ page }) => {
    // Page header
    await expect(page.getByRole("heading", { name: "Try eversaid" })).toBeVisible()

    // Audio player - target by the play icon container (button with Play/Pause icon)
    await expect(page.locator("button").filter({ has: page.locator("svg.fill-white") }).first()).toBeVisible()

    // Transcript sections visible
    await expect(page.getByText("Raw Transcription")).toBeVisible()
    await expect(page.getByText("Cleaned Transcript")).toBeVisible()

    // At least one segment visible
    await expect(page.getByText("Speaker 1").first()).toBeVisible()
  })

  test("audio player controls work", async ({ page }) => {
    // Find play button by the gradient background container
    const playButton = page.locator("button").filter({ has: page.locator("svg.fill-white") }).first()

    await expect(playButton).toBeVisible()
    await playButton.click()

    // After click, button should still be there (now showing pause icon)
    await expect(playButton).toBeVisible()
  })

  test("can toggle diff view", async ({ page }) => {
    // Find the diff toggle button by its text
    const diffButton = page.getByRole("button", { name: /diff/i })

    await expect(diffButton).toBeVisible()

    // Check initial state
    await expect(diffButton).toContainText("Diff On")

    // Toggle off
    await diffButton.click()
    await expect(diffButton).toContainText("Diff Off")

    // Toggle back on
    await diffButton.click()
    await expect(diffButton).toContainText("Diff On")
  })

  test("transcript copy buttons work", async ({ page }) => {
    // Copy button should be visible (there are multiple, pick first)
    const copyButton = page.getByRole("button", { name: "Copy" }).first()
    await expect(copyButton).toBeVisible()

    // Click should not throw
    await copyButton.click()
  })

  test("analysis section displays content", async ({ page }) => {
    // Analysis section header
    await expect(page.getByText("AI Analysis")).toBeVisible()

    // Shows "Conversation Summary" by default
    await expect(page.getByText("Conversation Summary")).toBeVisible()

    // Key analysis content should be present
    await expect(page.getByText(/project planning/i)).toBeVisible()
  })

  test("sidebar elements are visible", async ({ page }) => {
    // History card - actual text is "Your Transcriptions"
    await expect(page.getByText("Your Transcriptions")).toBeVisible()

    // Feedback card - actual text is "How was the quality?"
    await expect(page.getByText("How was the quality?")).toBeVisible()

    // Waitlist CTA
    await expect(page.getByText(/waitlist/i).first()).toBeVisible()
  })
})
