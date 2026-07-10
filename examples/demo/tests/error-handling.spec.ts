import { test, expect } from "@playwright/test";
import { auth } from "./login-helper";

test.describe("Error Handling", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    // Setup authentication
    await auth.setupAuthCookie(page);

    // Navigate to the editor page (canvas-only editor since 0.4.0)
    await page.goto("/editor");
    await auth.handleLoginForm(page);
    await expect(page.locator('iframe[title="Canvas"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  test("should show error boundary for component errors", async ({ page }) => {
    // This test simulates a component error by injecting a script that breaks a component

    // To-Do: Implement adding a new component, that is broken and then register it, and then add it to the page
    test.skip(true, "This test is not yet implemented");

    // Try to interact with the page to trigger error boundaries
    await page.mouse.click(100, 100);

    // Check for error boundary fallback UI or error stack - using a more general selector
    // The actual error message might be different in the implementation
    const errorBoundary = page.locator("text=Error");

    await expect(errorBoundary).toBeVisible({ timeout: 5000 });
  });

  test("should show enhanced error page for navigation errors", async ({
    page,
  }) => {
    // Navigate to a non-existent route to trigger 404
    await page.goto("/this-path-does-not-exist");

    // Verify some error message is shown - we don't know the exact format
    // but it likely contains either 404 or "Page Not Found"
    await expect(page.locator('h1:has-text("404")').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
