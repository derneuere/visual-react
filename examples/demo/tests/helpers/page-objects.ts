import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

/**
 * Page object model for the Editor page to encapsulate common interactions
 */
export class EditorPage {
  readonly page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  /**
   * Handle login flow
   */
  async login() {
    // Check if login form is present
    const loginForm = this.page.locator('text=Login');
    if (await loginForm.isVisible()) {
      // Enter the password (from Login.tsx)
      await this.page.locator('input[type="password"]').fill('demo-password');
      await this.page.locator('button:has-text("Submit")').click();
      
      // Wait for login to complete
      await this.page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {
        // Continue if there's no navigation but page has changed
      });
    }
  }
  
  /**
   * Navigate to the editor page and handle login
   * @param pageName Optional page name to load a specific page
   */
  async goto(pageName?: string) {
    // Set authentication cookie to bypass login
    await this.page.context().addCookies([
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
    
    // Navigate to specific page if provided, otherwise go to editor home
    const url = pageName ? `/editor/${pageName}` : '/editor';
    await this.page.goto(url, { timeout: 60000 });
    
    // Handle login if cookie didn't work
    await this.login();
    
    try {
      // Wait for editor to load - look for multiple possible elements
      await Promise.race([
        this.page.waitForSelector('div[role="button"]', { state: 'visible', timeout: 10000 }),
        this.page.waitForSelector('.ComponentExplorer', { state: 'visible', timeout: 10000 }),
        this.page.waitForSelector('[data-component]', { state: 'visible', timeout: 10000 })
      ]);
    } catch (error) {
      console.log('Warning: Editor elements not found, page might not be fully loaded');
      // Wait a bit more to allow the page to load
      await this.page.waitForTimeout(2000);
    }
  }
  
  /**
   * Get a draggable component by index
   */
  async getDraggableComponent(index = 0): Promise<Locator> {
    const draggableElements = await this.page.locator('div:has(> span:text("☰"))').all();
    expect(draggableElements.length).toBeGreaterThan(index);
    return draggableElements[index];
  }
  
  /**
   * Get a container component that can have children
   */
  async getContainerComponent(index = 0): Promise<Locator> {
    // Use a more general selector that matches any component, not just Section
    const containers = await this.page.locator('div[data-component]').all();
    expect(containers.length).toBeGreaterThan(index);
    return containers[index];
  }
  
  /**
   * Drag an element to a specific position
   */
  async dragElementTo(element: Locator, targetX: number, targetY: number) {
    await element.hover();
    await this.page.mouse.down();
    await this.page.mouse.move(targetX, targetY);
    // Small pause to allow drop indicators to appear
    await this.page.waitForTimeout(100);
    return { 
      finishDrag: async () => {
        await this.page.mouse.up();
        // Wait for any state updates to complete
        await this.page.waitForTimeout(100);
      },
      cancelDrag: async () => {
        // Press escape to cancel drag operation
        await this.page.keyboard.press('Escape');
      }
    };
  }
  
  /**
   * Drag one element to another position
   */
  async dragElementToAnother(sourceElement: Locator, targetElement: Locator, position: 'above' | 'below' | 'into' = 'below') {
    const targetRect = await targetElement.boundingBox();
    
    const targetX = targetRect.x + targetRect.width / 2;
    let targetY: number;
    
    switch (position) {
      case 'above':
        targetY = targetRect.y + 5; // Near the top
        break;
      case 'below':
        targetY = targetRect.y + targetRect.height - 5; // Near the bottom
        break;
      case 'into':
        targetY = targetRect.y + targetRect.height / 2; // In the middle
        break;
    }
    
    return this.dragElementTo(sourceElement, targetX, targetY);
  }
  
  /**
   * Check if a drop indicator is visible
   */
  async hasDropIndicator(indicatorType: 'above' | 'below' | 'into'): Promise<boolean> {
    return this.page.evaluate((type) => {
      const elements = document.querySelectorAll('*');
      return Array.from(elements).some(el => {
        const style = window.getComputedStyle(el);
        switch (type) {
          case 'above':
            return style.borderTopColor === 'rgb(34, 197, 94)' && 
                   style.borderTopWidth === '3px';
          case 'below':
            return style.borderBottomColor === 'rgb(34, 197, 94)' && 
                   style.borderBottomWidth === '3px';
          case 'into':
            return style.boxShadow.includes('rgb(34, 197, 94)');
        }
      });
    }, indicatorType);
  }
  
  /**
   * Create a new test page with the given name
   */
  async createTestPage(pageName: string, pageTitle: string = 'Test Page') {
    // Navigate to editor
    await this.goto();
    
    // Click the "New Page" button
    await this.page.click('text=New Page');
    
    // Enter page name in the dialog
    await this.page.fill('input[placeholder="Page Name"]', pageName);
    
    // Click "Create" button
    await this.page.click('button:has-text("Create")');
    
    // Wait for the page to load
    await this.page.waitForSelector('div[role="button"]', { state: 'visible' });
    
    // Wait for any API request to complete
    await this.page.waitForTimeout(500);
    
    return pageName;
  }
  
  /**
   * Directly check if a test page exists in the local pages directory
   * Useful for test verification
   */
  static async doesLocalPageExist(pageName: string): Promise<boolean> {
    const pagesDir = path.resolve(process.cwd(), 'pages');
    const pageFilePath = path.join(pagesDir, `${pageName}.json`);
    
    try {
      await fs.access(pageFilePath);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get page content directly from local storage for validation
   */
  static async getLocalPageContent(pageName: string): Promise<any> {
    const pagesDir = path.resolve(process.cwd(), 'pages');
    const pageFilePath = path.join(pagesDir, `${pageName}.json`);
    
    try {
      const content = await fs.readFile(pageFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read page content: ${error.message}`);
    }
  }
}