import { test, expect } from "@playwright/test"

test.describe("API Docs Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/api-docs")
  })

  test("displays page header and hero", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "API Documentation" })).toBeVisible()
    await expect(
      page.getByText(/Integrate eversaid's transcription, cleanup, and analysis/)
    ).toBeVisible()
  })

  test("navigation bar has correct links", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Demo" })).toBeVisible()
    await expect(page.getByRole("link", { name: "API Docs" })).toBeVisible()
  })

  test("Home link navigates to landing page", async ({ page }) => {
    await page.getByRole("link", { name: "Home" }).click()
    await expect(page).toHaveURL("/")
  })

  test("Demo link navigates to demo page", async ({ page }) => {
    await page.getByRole("link", { name: "Demo" }).click()
    await expect(page).toHaveURL("/demo")
  })

  test("Join Waitlist button opens API waitlist modal", async ({ page }) => {
    // Use the button in the navigation bar specifically
    const joinButton = page.getByRole("navigation").getByRole("button", { name: "Join Waitlist" })
    await expect(joinButton).toBeVisible()
    await joinButton.click()

    // Modal should open with API-specific content
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("Join API Waitlist")).toBeVisible()
    await expect(page.getByText("Get early access to integrate eversaid")).toBeVisible()
  })

  test("sidebar navigation sections are visible", async ({ page }) => {
    // Check for main navigation sections in sidebar (use complementary role for aside)
    const sidebar = page.getByRole("complementary")
    await expect(sidebar.getByText("Getting Started")).toBeVisible()
    await expect(sidebar.getByText("Quick Start")).toBeVisible()
  })

  test("code blocks are displayed", async ({ page }) => {
    // API docs should have code elements
    const codeBlocks = page.locator("code")

    // At least one code block should exist (Base URL, examples, etc.)
    const count = await codeBlocks.count()
    expect(count).toBeGreaterThan(0)

    // Verify Base URL code block is visible (use exact text to avoid ambiguity)
    await expect(page.getByText("https://api.eversaid.com/api/v1", { exact: true })).toBeVisible()
  })

  test("displays API endpoint documentation", async ({ page }) => {
    // Check for common API documentation elements
    await expect(page.getByText("POST").first()).toBeVisible()

    // Check for endpoint sections
    await expect(page.getByText("Upload").first()).toBeVisible()
  })
})
