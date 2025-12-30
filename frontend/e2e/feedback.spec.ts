import { test, expect } from "@playwright/test"

test.describe("Feedback Rating on Demo Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo")
  })

  test("feedback card is visible with star rating", async ({ page }) => {
    // Find the feedback section
    await expect(page.getByText("How was the quality?")).toBeVisible()

    // Should have 5 star buttons
    const feedbackSection = page.locator("div").filter({ hasText: "How was the quality?" }).first()
    const starButtons = feedbackSection.locator("button").filter({ has: page.locator("svg") })

    // At least 5 buttons should exist (the stars)
    const count = await starButtons.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test("clicking a star updates the rating", async ({ page }) => {
    // Find the feedback card
    const feedbackCard = page.locator("div").filter({ hasText: /^How was the quality/ }).first()

    // Find star buttons within the feedback card (they contain Sparkles SVG)
    const starButtons = feedbackCard.locator("button")

    // Click the 4th star (good rating)
    await starButtons.nth(3).click()

    // The star should be highlighted (background color changes)
    // For rating >= 4, no textarea should appear
    await expect(page.getByPlaceholder(/What went wrong/)).not.toBeVisible()
  })

  test("low rating (1-3 stars) shows feedback textarea", async ({ page }) => {
    // Find the feedback card
    const feedbackCard = page.locator("div").filter({ hasText: /^How was the quality/ }).first()
    const starButtons = feedbackCard.locator("button")

    // Click the 2nd star (low rating)
    await starButtons.nth(1).click()

    // Textarea should appear for feedback
    await expect(page.getByPlaceholder(/What went wrong/)).toBeVisible()

    // Submit button should appear
    await expect(page.getByRole("button", { name: "Submit Feedback" })).toBeVisible()
  })

  test("can type feedback and submit when rating is low", async ({ page }) => {
    // Find the feedback card and click low star
    const feedbackCard = page.locator("div").filter({ hasText: /^How was the quality/ }).first()
    const starButtons = feedbackCard.locator("button")

    // Give a 2-star rating
    await starButtons.nth(1).click()

    // Fill in feedback
    const feedbackInput = page.getByPlaceholder(/What went wrong/)
    await expect(feedbackInput).toBeVisible()
    await feedbackInput.fill("The speaker attribution was incorrect in several places")

    // Submit feedback
    const submitButton = page.getByRole("button", { name: "Submit Feedback" })
    await submitButton.click()

    // Button click should work (no error thrown)
    // In a real app, you'd verify the feedback was sent
  })

  test("high rating (4-5 stars) does not show textarea", async ({ page }) => {
    // Find the feedback card
    const feedbackCard = page.locator("div").filter({ hasText: /^How was the quality/ }).first()
    const starButtons = feedbackCard.locator("button")

    // Click the 5th star (highest rating)
    await starButtons.nth(4).click()

    // Textarea should NOT appear
    await expect(page.getByPlaceholder(/What went wrong/)).not.toBeVisible()
    await expect(page.getByRole("button", { name: "Submit Feedback" })).not.toBeVisible()
  })

  test("changing rating from low to high hides textarea", async ({ page }) => {
    const feedbackCard = page.locator("div").filter({ hasText: /^How was the quality/ }).first()
    const starButtons = feedbackCard.locator("button")

    // First give low rating
    await starButtons.nth(0).click()
    await expect(page.getByPlaceholder(/What went wrong/)).toBeVisible()

    // Now give high rating
    await starButtons.nth(4).click()

    // Textarea should disappear
    await expect(page.getByPlaceholder(/What went wrong/)).not.toBeVisible()
  })
})
