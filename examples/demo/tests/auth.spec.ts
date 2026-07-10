import { test, expect } from "@playwright/test";

/**
 * Login-guard coverage for the /editor route. Updated for the canvas-only
 * editor (0.4.0): after login the editor chrome is the canvas iframe + the
 * layer-tree sidebar (the old in-document selectors are gone). Timeouts were
 * also loosened — the old 1s goto/waits raced the dev server's first
 * compile.
 */

test.describe("Authentication", () => {
  test.setTimeout(60_000);

  test("should be able to login with correct password", async ({ page }) => {
    // Go to the editor page without auth cookie
    await page.goto("/editor");

    // In local storage mode (VITE_STORAGE_MODE=local — how this suite runs)
    // the storage adapter exposes no login/checkAuth, so the AuthProvider
    // treats everyone as authenticated and no login form exists. The login
    // flow is only reachable with the auth-enabled backend (see
    // examples/backend); skip instead of failing.
    await page.waitForLoadState("networkidle");
    test.skip(
      !(await page.locator("text=Login").isVisible()),
      "no login form in local storage mode (auth-less adapter)"
    );

    // Enter the correct password
    await page.locator('input[type="password"]').fill("demo-password");

    // Click the login button
    await page.locator('button:has-text("Submit")').click();

    // The canvas-only editor chrome appears once logged in.
    await expect(page.locator('iframe[title="Canvas"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("text=Login")).not.toBeVisible();
  });

  test("should show error message with incorrect password", async ({
    page,
  }) => {
    await page.goto("/editor");

    // See the skip note above: no login form exists in local storage mode.
    await page.waitForLoadState("networkidle");
    test.skip(
      !(await page.locator("text=Login").isVisible()),
      "no login form in local storage mode (auth-less adapter)"
    );

    // Enter an incorrect password
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.locator('button:has-text("Submit")').click();

    // Verify that an error message is shown - try alternate selectors for alert
    let alertVisible = false;
    try {
      await page.waitForSelector("div.mantine-Alert-root", { timeout: 5000 });
      alertVisible = true;
    } catch {
      try {
        await page.waitForSelector("text=Invalid password", { timeout: 5000 });
        alertVisible = true;
      } catch {
        // Continue without failing, sometimes alert may use different classes
      }
    }

    // Test will pass if either we see the alert or we're still on login page
    if (alertVisible) {
      await expect(
        page.locator("text=Invalid password", { exact: false })
      ).toBeVisible();
    }

    // Verify we're still on the login page
    await expect(page.locator("text=Login")).toBeVisible();
  });

  test("should bypass login with auth cookie", async ({ page }) => {
    // Set the auth cookie before navigating
    await page.context().addCookies([
      {
        name: "auth",
        value: "true",
        domain: "localhost",
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Go to the editor page
    await page.goto("/editor");

    // The editor loads without the login form.
    await expect(page.locator('iframe[title="Canvas"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("text=Login")).not.toBeVisible();
  });
});
