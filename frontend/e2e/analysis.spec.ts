import { test, expect } from "@playwright/test"
import { setupDemoMocks } from "./mocks/setup-mocks"

/**
 * Analysis Section E2E Tests
 *
 * Tests profile selection, analysis display, and error handling.
 * Uses shared mock infrastructure to simulate a complete transcription with analysis.
 */

test.describe("Analysis Section", () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoMocks(page)
    // Use ?entry=demo-en to trigger demo loading via useTranscription.loadEntry
    await page.goto("/en/demo?entry=demo-en")

    // Wait for analysis section to be visible
    await expect(page.getByText("AI Analysis")).toBeVisible({ timeout: 10000 })
  })

  test.describe("Initial State", () => {
    test("shows empty state with Run Analysis button", async ({ page }) => {
      // Empty state message
      await expect(
        page.getByText("No analysis data available yet")
      ).toBeVisible()

      // Run Analysis button
      const runButton = page.getByRole("button", { name: "Run Analysis" })
      await expect(runButton).toBeVisible()
    })
  })

  test.describe("Analysis Flow", () => {
    test("clicking Run Analysis triggers analysis and shows results", async ({
      page,
    }) => {
      // Click Run Analysis button
      const runButton = page.getByRole("button", { name: "Run Analysis" })
      await runButton.click()

      // Wait for analysis results to appear (mocked API returns completed immediately)
      // Summary should be visible
      await expect(
        page.getByText("Discussion about quarterly planning and budget allocation")
      ).toBeVisible({ timeout: 10000 })

      // Topics should be visible as tags
      await expect(
        page.locator(".rounded-full").filter({ hasText: "planning" })
      ).toBeVisible()
      await expect(
        page.locator(".rounded-full").filter({ hasText: "budget" })
      ).toBeVisible()
      await expect(
        page.locator(".rounded-full").filter({ hasText: "timeline" })
      ).toBeVisible()

      // Key points should be visible
      await expect(page.getByText("Increase Q1 budget by 20%")).toBeVisible()
    })

    test("profile dropdown shows after analysis completes", async ({ page }) => {
      // Run analysis first
      const runButton = page.getByRole("button", { name: "Run Analysis" })
      await runButton.click()

      // Wait for results
      await expect(
        page.getByText("Discussion about quarterly planning")
      ).toBeVisible({ timeout: 10000 })

      // Find the dropdown trigger (button with profile name)
      // After analysis, it should show "Conversation Summary" (the default profile)
      const dropdownTrigger = page
        .locator("button")
        .filter({ hasText: "Conversation Summary" })
      await expect(dropdownTrigger).toBeVisible()

      // Click to open dropdown
      await dropdownTrigger.click()

      // All profiles should be visible in dropdown
      await expect(page.getByText("Action Items & Decisions")).toBeVisible()
      await expect(page.getByText("Reflection & Insights")).toBeVisible()
    })

    test("can switch between profiles", async ({ page }) => {
      // Run analysis first
      await page.getByRole("button", { name: "Run Analysis" }).click()

      // Wait for results
      await expect(
        page.getByText("Discussion about quarterly planning")
      ).toBeVisible({ timeout: 10000 })

      // Open dropdown and select different profile
      const dropdownTrigger = page
        .locator("button")
        .filter({ hasText: "Conversation Summary" })
      await dropdownTrigger.click()

      // Select Action Items profile
      await page.getByText("Action Items & Decisions").click()

      // Dropdown should close
      await expect(
        page.locator(".absolute.left-0.top-full")
      ).not.toBeVisible()
    })
  })

  // Note: Error handling tests removed for now as they require complex mock override logic.
  // The error state UI is tested via unit tests in useAnalysis.test.ts
})
