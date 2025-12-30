import { test, expect } from "@playwright/test"

test.describe("Waitlist Flow - Regular (Extended Usage)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("complete waitlist signup flow from landing page", async ({ page }) => {
    // Scroll to and click the waitlist link
    await page.getByText("Ready to try smarter transcription?").scrollIntoViewIfNeeded()
    await page.locator("button").filter({ hasText: "Join the waitlist →" }).click()

    // Modal opens
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(page.getByRole("heading", { name: "Join the Waitlist" })).toBeVisible()

    // Fill the form
    await page.getByLabel(/Email Address/).fill("test@example.com")
    await page.getByLabel(/How will you use eversaid/).fill("Meeting transcription for my team")

    // Optional: How did you hear about us
    await page.getByLabel(/How did you hear about us/).fill("Twitter")

    // Submit - use the button inside the dialog form
    await page.getByRole("dialog").getByRole("button", { name: "Join Waitlist" }).click()

    // Success state
    await expect(page.getByText("You're on the list!")).toBeVisible()
    await expect(page.getByText(/We'll email you when your spot is ready/)).toBeVisible()

    // Referral section visible - use exact match for header
    await expect(page.getByText("Earn Free Credits", { exact: true })).toBeVisible()
    await expect(page.getByText(/Share your referral link/)).toBeVisible()

    // Referral link input contains the generated link
    const referralInput = page.getByRole("dialog").locator("input[readonly]")
    await expect(referralInput).toBeVisible()
    const referralValue = await referralInput.inputValue()
    expect(referralValue).toContain("https://eversaid.com?ref=")
  })

  test("can copy referral link after signup", async ({ page }) => {
    // Open waitlist modal
    await page.getByText("Ready to try smarter transcription?").scrollIntoViewIfNeeded()
    await page.locator("button").filter({ hasText: "Join the waitlist →" }).click()

    // Fill required fields and submit
    await page.getByLabel(/Email Address/).fill("copy-test@example.com")
    await page.getByLabel(/How will you use eversaid/).fill("Testing copy functionality")
    await page.getByRole("dialog").getByRole("button", { name: "Join Waitlist" }).click()

    // Wait for success state
    await expect(page.getByText("You're on the list!")).toBeVisible()

    // Click copy link button - button has aria-label for accessibility
    const copyButton = page.getByRole("dialog").getByRole("button", { name: /Copy referral link/i })
    await expect(copyButton).toBeVisible()
    await copyButton.click()

    // Should show "Copied!" feedback
    await expect(page.getByText("Copied!")).toBeVisible()
  })

  test("can close modal with Done button after signup", async ({ page }) => {
    // Open waitlist modal
    await page.getByText("Ready to try smarter transcription?").scrollIntoViewIfNeeded()
    await page.locator("button").filter({ hasText: "Join the waitlist →" }).click()

    // Fill and submit
    await page.getByLabel(/Email Address/).fill("close-test@example.com")
    await page.getByLabel(/How will you use eversaid/).fill("Testing close")
    await page.getByRole("dialog").getByRole("button", { name: "Join Waitlist" }).click()

    // Wait for success
    await expect(page.getByText("You're on the list!")).toBeVisible()

    // Click Done
    await page.getByRole("button", { name: "Done" }).click()

    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("can close modal with X button", async ({ page }) => {
    // Open waitlist modal
    await page.getByText("Ready to try smarter transcription?").scrollIntoViewIfNeeded()
    await page.locator("button").filter({ hasText: "Join the waitlist →" }).click()

    await expect(page.getByRole("dialog")).toBeVisible()

    // Click X button
    await page.getByRole("button", { name: "Close dialog" }).click()

    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("form validates required fields", async ({ page }) => {
    // Open waitlist modal
    await page.getByText("Ready to try smarter transcription?").scrollIntoViewIfNeeded()
    await page.locator("button").filter({ hasText: "Join the waitlist →" }).click()

    await expect(page.getByRole("dialog")).toBeVisible()

    // Try to submit without filling required fields
    await page.getByRole("dialog").getByRole("button", { name: "Join Waitlist" }).click()

    // Form should not submit (modal still visible with form)
    await expect(page.getByLabel(/Email Address/)).toBeVisible()
    await expect(page.getByText("You're on the list!")).not.toBeVisible()
  })
})

test.describe("Waitlist Flow - API Access", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/api-docs")
  })

  test("complete API waitlist signup flow", async ({ page }) => {
    // Click Join Waitlist button in nav
    await page.getByRole("navigation").getByRole("button", { name: "Join Waitlist" }).click()

    // Modal opens with API-specific content
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(page.getByText("Join API Waitlist")).toBeVisible()

    // Fill the form - API version has different labels
    await page.getByLabel(/Email Address/).fill("api-test@example.com")
    await page.getByLabel(/What will you build/).fill("Voice journal mobile app")

    // API-specific: Expected monthly volume dropdown
    await page.getByLabel(/Expected monthly volume/).selectOption("100-500")

    // Optional source field
    await page.getByLabel(/How did you hear about us/).fill("Search")

    // Submit - use the button inside the dialog
    await dialog.getByRole("button", { name: "Join Waitlist" }).click()

    // Success state
    await expect(page.getByText("You're on the list!")).toBeVisible()

    // Referral section
    await expect(page.getByText("Earn Free Credits")).toBeVisible()
  })

  test("API waitlist shows volume dropdown", async ({ page }) => {
    await page.getByRole("navigation").getByRole("button", { name: "Join Waitlist" }).click()

    await expect(page.getByRole("dialog")).toBeVisible()

    // Volume dropdown should be visible (API-specific field)
    const volumeSelect = page.getByLabel(/Expected monthly volume/)
    await expect(volumeSelect).toBeVisible()

    // Check options exist - use combobox role for select element
    const options = page.getByRole("dialog").locator("select option")
    await expect(options.filter({ hasText: "0-100 hours" })).toBeAttached()
    await expect(options.filter({ hasText: "2,000+ hours" })).toBeAttached()
  })
})
