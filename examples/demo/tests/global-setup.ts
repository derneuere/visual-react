import { chromium, FullConfig } from '@playwright/test';
import { auth } from './login-helper';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Ensure the pages directory exists and contains test pages
 */
async function setupPagesDirectory() {
  const pagesDir = path.resolve(process.cwd(), 'pages');
  
  try {
    // Check if pages directory exists
    await fs.access(pagesDir);
  } catch (error) {
    // Create directory if it doesn't exist
    await fs.mkdir(pagesDir, { recursive: true });
    console.log('Created pages directory for tests');
  }

  // Helper function to create a simple test page
  const createTestPage = async (fileName, title) => {
    const pagePath = path.join(pagesDir, fileName);
    
    try {
      await fs.access(pagePath);
      // If file exists, continue
    } catch (error) {
      // Create a sample test page
      const samplePage = [
        {
          "id": "Page",
          "props": {
            "instanceId": 1733646119809,
            "title": title,
            "children": [
              {
                "id": "Section",
                "props": {
                  "title": `${title} Section`,
                  "instanceId": "Section-1733646119809",
                  "children": [
                    {
                      "id": "Title",
                      "props": {
                        "label": title,
                        "size": 1,
                        "alignment": "center",
                        "instanceId": 1735660019896
                      }
                    }
                  ],
                  "backgroundColor": "primary",
                  "alignment": "stretch",
                  "height": "100%",
                  "width": "100%"
                }
              }
            ]
          }
        }
      ];
      
      await fs.writeFile(pagePath, JSON.stringify(samplePage, null, 2), 'utf-8');
      console.log(`Created test page: ${fileName}`);
    }
  };
  
  // Create necessary test pages
  await createTestPage('index.json', 'Home Page');
  await createTestPage('test-page.json', 'Test Page');
  
  // Copy the current page as another test page
  try {
    const indexPagePath = path.join(process.cwd(), 'pages', 'index.json');
    const testPagePath = path.join(pagesDir, 'complex-page.json');
    
    try {
      const content = await fs.readFile(indexPagePath, 'utf-8');
      await fs.writeFile(testPagePath, content, 'utf-8');
      console.log('Copied index page as complex-page.json');
    } catch (error) {
      console.log('Could not copy current page, skipping');
    }
  } catch (error) {
    // Ignore errors, just continue
  }
}

/**
 * Global setup runs once before all tests.
 * We use it to log in once and save authentication state.
 */
async function globalSetup(config: FullConfig) {
  // Setup local pages directory with test content
  await setupPagesDirectory();
  
  // Launch a browser
  const browser = await chromium.launch({ headless: true });
  
  // Create a new browser context
  const context = await browser.newContext();
  
  // Create a new page
  const page = await context.newPage();
  
  // Navigate to login page
  await page.goto('http://localhost:3000/editor');
  
  // Check if the login form is present
  const loginForm = page.locator('text=Login');
  if (await loginForm.isVisible()) {
    // Fill in password
    await page.locator('input[type="password"]').fill('demo-password');
    
    // Click login button
    await page.locator('button:has-text("Submit")').click();
    
    // Wait for the login to complete
    await page.waitForSelector('div[role="button"]', { state: 'visible', timeout: 1000 })
      .catch(() => console.log('Login may have failed or UI changed'));
  }

  // Save the authentication state to use in tests
  await page.context().storageState({ path: './auth-state.json' });
  
  // Close browser
  await browser.close();
}

export default globalSetup;