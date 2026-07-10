import { Page } from '@playwright/test';

/**
 * Helper functions for handling authentication in tests
 */
export const auth = {
  /**
   * Adds the authentication cookie to bypass login
   */
  setupAuthCookie: async (page: Page) => {
    await page.context().addCookies([
      {
        "name": "auth",
        "value": "true",
        "domain": "localhost",
        "path": "/",
        "expires": -1,
        "httpOnly": false,
        "secure": false,
        "sameSite": "Lax"
      }
    ]);
  },
  
  /**
   * Logs in using the form if present
   */
  handleLoginForm: async (page: Page) => {
    const loginForm = page.locator('text=Login');
    if (await loginForm.isVisible()) {
      // Enter the password
      await page.locator('input[type="password"]').fill('demo-password');
      await page.locator('button:has-text("Submit")').click();
      
      // Wait for navigation or UI update
      await page.waitForTimeout(500);
    }
  },
  
  /**
   * Complete login setup - add cookie and handle login form if needed
   */
  setupAuth: async (page: Page) => {
    await auth.setupAuthCookie(page);
    await auth.handleLoginForm(page);
  }
};