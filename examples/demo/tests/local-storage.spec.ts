import { test, expect } from "@playwright/test";
import { auth } from "./login-helper";
import { promises as fs } from "fs";
import path from "path";

const PAGES_DIR = path.resolve(process.cwd(), "pages");
const TEST_PAGE_PREFIX = "storage-test";

function testPagePath(name: string) {
  return path.join(PAGES_DIR, `${name}.json`);
}

async function writeTestPage(name: string, data: any) {
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.writeFile(testPagePath(name), JSON.stringify(data, null, 2), "utf-8");
}

async function readTestPage(name: string) {
  const content = await fs.readFile(testPagePath(name), "utf-8");
  return JSON.parse(content);
}

async function deleteTestPage(name: string) {
  try {
    await fs.unlink(testPagePath(name));
  } catch {
    // ignore if not found
  }
}

function createPageData(title: string, children: any[] = []) {
  const ts = Date.now();
  return [
    {
      id: "Page",
      props: {
        instanceId: `page-${ts}`,
        title,
        children: [
          {
            id: "Section",
            props: {
              instanceId: `section-${ts}`,
              children,
              backgroundColor: "white",
              alignment: "stretch",
              height: "auto",
              width: "100%",
            },
          },
        ],
      },
    },
  ];
}

/** Wait for the editor to be fully loaded and interactive */
async function waitForEditor(page) {
  // The control panel labels (e.g. "Section ☰ ✏️ 🗑️") are always visible
  await page.waitForSelector('text=Not Previewing', { timeout: 10000 });
  await page.waitForSelector('.control-panel', { timeout: 10000 });
}

test.describe("Local Storage - Pages", () => {
  test.beforeEach(async ({ page }) => {
    await auth.setupAuthCookie(page);
  });

  test.afterAll(async () => {
    const entries = await fs.readdir(PAGES_DIR).catch(() => []);
    for (const entry of entries) {
      if (entry.startsWith(TEST_PAGE_PREFIX)) {
        await deleteTestPage(entry.replace(".json", ""));
      }
    }
  });

  test("loads an existing page in the editor", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-load`;
    await writeTestPage(
      pageName,
      createPageData("Load Test Page", [
        {
          id: "Title",
          props: {
            instanceId: `title-load-${Date.now()}`,
            label: "Load Test",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // The Title component text should be visible
    await expect(page.locator('text=Load Test')).toBeVisible();
  });

  test("saves page changes via the Publish button", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-save`;
    const originalData = createPageData("Save Test Page", [
      {
        id: "Title",
        props: {
          instanceId: `title-save`,
          label: "Original Title",
          size: 1,
          alignment: "center",
        },
      },
    ]);
    await writeTestPage(pageName, originalData);

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // Click the edit button (pencil) on the Title component to select it
    const editButton = page.locator('[data-testid="edit-button"]').first();
    await editButton.click({ force: true });

    // Wait for the editing panel to appear
    await page.waitForSelector('text=Edit Component', { timeout: 5000 });

    // Find the label input by its label text and change it
    const labelInput = page.locator('label:has-text("label")').locator('..').locator('input');
    await labelInput.clear();
    await labelInput.fill("Updated Title");

    // Click Publish — the button should now be enabled since we changed content
    const publishButton = page.locator('button:has-text("Publish")');
    await expect(publishButton).toBeEnabled({ timeout: 2000 });
    await publishButton.click();

    // Wait for save to complete
    await page.waitForTimeout(1000);

    // Verify the file was updated on disk
    const savedData = await readTestPage(pageName);
    expect(savedData).toBeTruthy();
    expect(Array.isArray(savedData)).toBe(true);
    // Verify the label was actually saved
    const titleComponent = savedData[0].props.children[0].props.children[0];
    expect(titleComponent.props.label).toBe("Updated Title");
  });

  test("lists pages in the navigation sidebar", async ({ page }) => {
    const page1Name = `${TEST_PAGE_PREFIX}-list-a`;
    const page2Name = `${TEST_PAGE_PREFIX}-list-b`;
    await writeTestPage(page1Name, createPageData("List Page A"));
    await writeTestPage(page2Name, createPageData("List Page B"));

    await page.goto(`/editor/${page1Name}`);
    await auth.handleLoginForm(page);

    // Wait for navigation to load
    await page.waitForSelector('text=Pages', { timeout: 10000 });

    // Both pages should appear in the navigation
    const navContent = await page.locator('text=Pages').locator('..').locator('..').textContent();
    expect(navContent).toContain(page1Name);
    expect(navContent).toContain(page2Name);
  });

  test("navigates between pages", async ({ page }) => {
    const page1Name = `${TEST_PAGE_PREFIX}-nav-a`;
    const page2Name = `${TEST_PAGE_PREFIX}-nav-b`;
    await writeTestPage(
      page1Name,
      createPageData("Nav Page A", [
        {
          id: "Title",
          props: {
            instanceId: `title-nav-a`,
            label: "Page A Title",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );
    await writeTestPage(
      page2Name,
      createPageData("Nav Page B", [
        {
          id: "Title",
          props: {
            instanceId: `title-nav-b`,
            label: "Page B Title",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );

    await page.goto(`/editor/${page1Name}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // Click on page B in the navigation
    const pageBLink = page.locator(`a[href="/editor/${page2Name}"]`).or(
      page.locator(`button:has-text("${page2Name}")`)
    );
    await pageBLink.click();

    // Wait for page B to load
    await page.waitForURL(`**/editor/${page2Name}`, { timeout: 5000 });
    expect(page.url()).toContain(page2Name);
  });

  test("renders a page with components on the public route", async ({
    page,
  }) => {
    const pageName = `${TEST_PAGE_PREFIX}-public`;
    await writeTestPage(
      pageName,
      createPageData("Public Page", [
        {
          id: "Title",
          props: {
            instanceId: `title-public`,
            label: "Hello World",
            size: 1,
            alignment: "center",
          },
        },
        {
          id: "Text",
          props: {
            instanceId: `text-public`,
            content: "This is a test paragraph.",
            alignment: "left",
          },
        },
      ])
    );

    await page.goto(`/${pageName}`);
    await auth.handleLoginForm(page);

    // Wait for content to render
    await page.waitForSelector('text=Hello World', { timeout: 10000 });

    const body = await page.textContent("body");
    expect(body).toContain("Hello World");
    expect(body).toContain("This is a test paragraph.");
  });

  test("adds a component via the component explorer", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-add-component`;
    await writeTestPage(
      pageName,
      createPageData("Add Component Test", [
        {
          id: "Title",
          props: {
            instanceId: `title-add-${Date.now()}`,
            label: "Existing Title",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // Count components before adding
    const countBefore = await page.locator('.control-panel').count();

    // Click the + button below a component to open the component explorer
    const addButton = page.locator('[data-testid="add-below-button"]').first();
    await addButton.click({ force: true });

    // Wait for the component explorer modal
    await page.waitForTimeout(500);

    // Look for a component to add (e.g., Text)
    const textOption = page.locator('button:has-text("Text")').first();
    if (await textOption.isVisible()) {
      await textOption.click();
      await page.waitForTimeout(500);

      // Verify a new component was added
      const countAfter = await page.locator('.control-panel').count();
      expect(countAfter).toBeGreaterThan(countBefore);
    }
  });

  test("deletes a component", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-delete`;
    await writeTestPage(
      pageName,
      createPageData("Delete Test", [
        {
          id: "Title",
          props: {
            instanceId: `title-delete-1`,
            label: "To Be Deleted",
            size: 1,
            alignment: "center",
          },
        },
        {
          id: "Text",
          props: {
            instanceId: `text-delete-1`,
            content: "Should Remain",
            alignment: "left",
          },
        },
      ])
    );

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // Count control panels before delete (each component has one)
    const countBefore = await page.locator('.control-panel').count();
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // Click the delete button on the first child component (force to bypass overlay)
    const deleteButton = page.locator('[data-testid="delete-button"]').first();
    await deleteButton.click({ force: true });
    await page.waitForTimeout(500);

    // Count after delete
    const countAfter = await page.locator('.control-panel').count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("toggles preview mode", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-preview`;
    await writeTestPage(
      pageName,
      createPageData("Preview Test", [
        {
          id: "Title",
          props: {
            instanceId: `title-preview`,
            label: "Preview Me",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // The preview toggle should exist
    const previewToggle = page.locator('label:has-text("Previewing")').or(
      page.locator('label:has-text("Not Previewing")')
    );
    await expect(previewToggle).toBeVisible();

    // Toggle preview on
    await previewToggle.click();
    await page.waitForTimeout(300);

    // In preview mode, control panels should not be visible
    const controlPanels = await page.locator('.control-panel').count();
    expect(controlPanels).toBe(0);

    // Toggle preview off
    await previewToggle.click();
    await page.waitForTimeout(300);

    // Control panels should reappear
    const controlPanelsAfter = await page.locator('.control-panel').count();
    expect(controlPanelsAfter).toBeGreaterThan(0);
  });

  test("page rename updates the file on disk", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-rename-src`;
    const newName = `${TEST_PAGE_PREFIX}-rename-dest`;
    await deleteTestPage(newName);
    await writeTestPage(
      pageName,
      createPageData("Rename Test", [
        {
          id: "Title",
          props: {
            instanceId: `title-rename`,
            label: "Rename Page",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // Open page settings tab
    const settingsTab = page.locator('button:has-text("Page Settings")');
    await settingsTab.click();
    await page.waitForTimeout(300);

    // Find the rename input
    const renameInput = page.locator('input[placeholder="Enter new page name"]');
    if (await renameInput.isVisible()) {
      await renameInput.fill(newName);

      // Click the rename action icon
      const renameButton = renameInput.locator('..').locator('button').first();
      await renameButton.click({ force: true });
      await page.waitForTimeout(1000);

      // Verify old file is gone and new file exists
      const oldExists = await fs
        .access(testPagePath(pageName))
        .then(() => true)
        .catch(() => false);
      const newExists = await fs
        .access(testPagePath(newName))
        .then(() => true)
        .catch(() => false);

      expect(newExists).toBe(true);
      expect(oldExists).toBe(false);
    }

    // Cleanup
    await deleteTestPage(newName);
  });
});

test.describe("Local Storage - API Routes", () => {
  test.afterAll(async () => {
    const entries = await fs.readdir(PAGES_DIR).catch(() => []);
    for (const entry of entries) {
      if (entry.startsWith(TEST_PAGE_PREFIX)) {
        await deleteTestPage(entry.replace(".json", ""));
      }
    }
  });

  test("GET /api/pages/list returns JSON file list", async ({ request }) => {
    const pageName = `${TEST_PAGE_PREFIX}-api-list`;
    await writeTestPage(pageName, createPageData("API List Test"));

    const response = await request.get("/api/pages/list");
    expect(response.ok()).toBe(true);

    const pages: string[] = await response.json();
    expect(Array.isArray(pages)).toBe(true);
    expect(pages).toContain(`${pageName}.json`);
  });

  test("GET /api/pages/load loads a page", async ({ request }) => {
    const pageName = `${TEST_PAGE_PREFIX}-api-load`;
    const data = createPageData("API Load Test");
    await writeTestPage(pageName, data);

    const response = await request.get(`/api/pages/load/${pageName}`);
    expect(response.ok()).toBe(true);

    const loaded = await response.json();
    expect(loaded[0].id).toBe("Page");
    expect(loaded[0].props.title).toBe("API Load Test");
  });

  test("GET /api/pages/load returns 404 for missing page", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/pages/load/nonexistent-page-xyz"
    );
    expect(response.status()).toBe(404);
  });

  test("POST /api/pages/save creates a new page", async ({ request }) => {
    const pageName = `${TEST_PAGE_PREFIX}-api-save`;
    await deleteTestPage(pageName);

    const pageData = createPageData("API Save Test");
    const response = await request.post(`/api/pages/save/${pageName}`, {
      data: { pageData },
    });
    expect(response.ok()).toBe(true);

    const saved = await readTestPage(pageName);
    expect(saved[0].props.title).toBe("API Save Test");
  });

  test("POST /api/pages/save overwrites an existing page", async ({
    request,
  }) => {
    const pageName = `${TEST_PAGE_PREFIX}-api-overwrite`;
    await writeTestPage(pageName, createPageData("Version 1"));

    const newData = createPageData("Version 2");
    const response = await request.post(`/api/pages/save/${pageName}`, {
      data: { pageData: newData },
    });
    expect(response.ok()).toBe(true);

    const saved = await readTestPage(pageName);
    expect(saved[0].props.title).toBe("Version 2");
  });

  test("POST /api/pages/rename renames a page", async ({ request }) => {
    const oldName = `${TEST_PAGE_PREFIX}-api-rename-old`;
    const newName = `${TEST_PAGE_PREFIX}-api-rename-new`;
    await deleteTestPage(newName);
    await writeTestPage(oldName, createPageData("Rename Me"));

    const response = await request.post(`/api/pages/rename/${oldName}`, {
      data: { newFilePath: newName },
    });
    expect(response.ok()).toBe(true);

    const oldExists = await fs
      .access(testPagePath(oldName))
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(testPagePath(newName))
      .then(() => true)
      .catch(() => false);

    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);

    const content = await readTestPage(newName);
    expect(content[0].props.title).toBe("Rename Me");
  });

  test("GET /api/assets lists asset files", async ({ request }) => {
    const response = await request.get("/api/assets");
    expect(response.ok()).toBe(true);

    const assets: string[] = await response.json();
    expect(Array.isArray(assets)).toBe(true);
    for (const asset of assets) {
      expect(asset.startsWith("assets/")).toBe(true);
    }
  });
});
