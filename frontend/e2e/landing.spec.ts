import { test, expect } from "@playwright/test"

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en")
  })

  test("displays hero section with main CTA", async ({ page }) => {
    // Main headline
    await expect(page.getByText("Smart transcription.")).toBeVisible()
    await expect(page.getByText("AI listens. You decide.")).toBeVisible()

    // Subheadline
    await expect(page.getByText(/AI-powered cleanup you can review/)).toBeVisible()

    // Try Free Demo button
    const demoButton = page.getByRole("link", { name: "Try Free Demo" }).first()
    await expect(demoButton).toBeVisible()
  })

  test("Try Free Demo button navigates to demo page", async ({ page }) => {
    const demoButton = page.getByRole("link", { name: "Try Free Demo" }).first()
    await demoButton.click()

    await expect(page).toHaveURL("/en/demo")
    await expect(page.getByRole("heading", { name: "Try eversaid" })).toBeVisible()
  })

  test("navigation links are visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Features" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Use Cases" })).toBeVisible()
    await expect(page.getByRole("link", { name: "How It Works" })).toBeVisible()
    // API Docs is shown as "Coming soon" tooltip, not a clickable link
    await expect(page.getByText("API Docs")).toBeVisible()
  })

  test("displays feature sections", async ({ page }) => {
    // See the Difference section - use exact match
    await expect(page.getByText("See the Difference", { exact: true })).toBeVisible()
    await expect(page.getByText("Every edit visible. Every word verifiable.")).toBeVisible()

    // Features section
    await expect(page.getByText("Why Choose eversaid?")).toBeVisible()

    // Use Cases section
    await expect(page.getByText("Who It's For")).toBeVisible()

    // How It Works section - use heading role to be specific
    await expect(page.getByRole("heading", { name: "How It Works" })).toBeVisible()
  })

  test("displays AI insights section", async ({ page }) => {
    await expect(page.getByText("AI-Powered Insights")).toBeVisible()
    await expect(page.getByText("Conversation Summary")).toBeVisible()
    await expect(page.getByText("Action Items & Decisions")).toBeVisible()
    await expect(page.getByText("Reflection & Insights")).toBeVisible()
  })

  test("footer contains expected links", async ({ page }) => {
    await expect(page.getByText(/© \d{4} EverSaid/)).toBeVisible()
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Terms" })).toBeVisible()
    await expect(page.getByRole("link", { name: "hello@eversaid.ai" })).toBeVisible()
  })

  test("Join waitlist link opens waitlist modal", async ({ page }) => {
    // Scroll to the CTA section at the bottom
    const ctaSection = page.getByText("Ready to try smarter transcription?")
    await ctaSection.scrollIntoViewIfNeeded()

    // Click the "Join the waitlist →" link within the CTA section
    // The link is a button with arrow at the end
    const waitlistLink = page.locator("button").filter({ hasText: "Join the waitlist →" })
    await waitlistLink.click()

    // Modal should open
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Join the Waitlist" })).toBeVisible()
    await expect(page.getByLabel(/Email Address/)).toBeVisible()
  })
})
