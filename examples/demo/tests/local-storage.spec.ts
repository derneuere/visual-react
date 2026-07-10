import { test, expect, type Page, type Frame } from "@playwright/test";
import { auth } from "./login-helper";
import { promises as fs } from "fs";
import path from "path";

/**
 * Local file storage coverage: pages load/save/rename through the editor UI
 * and the /api/pages + /api/assets routes directly.
 *
 * Editor-side flows updated for the canvas-only editor (0.4.0): content is
 * asserted through the canvas iframe, edits go through the property panel,
 * structure changes through the layer tree / component picker, and preview
 * is the Desktop/Mobile view-mode switch (the in-document "Previewing"
 * toggle and SortableItem chrome no longer exist).
 */

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

/** Saved files may be the raw content array or a { meta, content } envelope. */
function pageContent(saved: any) {
  return Array.isArray(saved) ? saved : saved.content;
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

/** Wait for the canvas editor to be loaded and return the canvas frame. */
async function waitForEditor(page: Page): Promise<Frame> {
  await expect(page.locator('iframe[title="Canvas"]')).toBeVisible({
    timeout: 30_000,
  });
  // The frame registers once the iframe's src actually loads — poll for it.
  let frame: Frame | undefined;
  await expect
    .poll(
      () => {
        frame = page.frames().find((f) => f.url().includes("/canvas-frame"));
        return frame != null;
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  if (!frame) throw new Error("canvas iframe frame not found");
  // Attached (not visible): pages whose only section is empty render a
  // zero-height wrapper — the content push having arrived is what matters.
  await expect(frame.locator("[data-instance-id]").first()).toBeAttached({
    timeout: 30_000,
  });
  return frame;
}

test.describe("Local Storage - Pages", () => {
  test.setTimeout(60_000);

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
    const frame = await waitForEditor(page);

    // The Title component renders inside the canvas iframe.
    await expect(frame.getByText("Load Test")).toBeVisible();
  });

  test("saves page changes via the Publish button", async ({ page }) => {
    const pageName = `${TEST_PAGE_PREFIX}-save`;
    await writeTestPage(
      pageName,
      createPageData("Save Test Page", [
        {
          id: "Title",
          props: {
            instanceId: `title-save`,
            label: "Original Title",
            size: 1,
            alignment: "center",
          },
        },
      ])
    );

    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    const frame = await waitForEditor(page);

    // Select the Title in the canvas and change its label in the panel.
    await frame.locator('[data-instance-id="title-save"]').click();
    const panel = page.getByTestId("property-panel");
    await expect(panel).toBeVisible();
    await panel.getByLabel("label", { exact: true }).fill("Updated Title");

    // Click Publish — enabled since we changed content.
    const publishButton = page.getByRole("button", { name: "Publish" });
    await expect(publishButton).toBeEnabled({ timeout: 5_000 });
    await publishButton.click();
    await page.waitForTimeout(1000);

    // Verify the file was updated on disk.
    const content = pageContent(await readTestPage(pageName));
    const titleComponent = content[0].props.children[0].props.children[0];
    expect(titleComponent.props.label).toBe("Updated Title");
  });

  test("lists pages in the navigation sidebar", async ({ page }) => {
    const page1Name = `${TEST_PAGE_PREFIX}-list-a`;
    const page2Name = `${TEST_PAGE_PREFIX}-list-b`;
    await writeTestPage(page1Name, createPageData("List Page A"));
    await writeTestPage(page2Name, createPageData("List Page B"));

    await page.goto(`/editor/${page1Name}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);

    // Page management lives in the "Pages" tab of the left sidebar.
    await page.locator(".mantine-SegmentedControl-label", { hasText: "Pages" }).click();

    await expect(page.getByText(page1Name)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(page2Name)).toBeVisible();
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

    // Switch to the Pages tab and click page B.
    await page.locator(".mantine-SegmentedControl-label", { hasText: "Pages" }).click();
    await page.getByText(page2Name).first().click();

    await page.waitForURL(`**/editor/${page2Name}`, { timeout: 10_000 });
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
    await page.waitForSelector("text=Hello World", { timeout: 10_000 });

    const body = await page.textContent("body");
    expect(body).toContain("Hello World");
    expect(body).toContain("This is a test paragraph.");
  });

  test("adds a component via the component picker", async ({ page }) => {
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
    const frame = await waitForEditor(page);

    const countBefore = await frame.locator("[data-instance-id]").count();

    // "+ Add" in the layer tree opens the searchable picker.
    await page.getByTestId("tree-add-root").click();
    await expect(page.getByTestId("picker-search")).toBeVisible();
    await page.getByTestId("picker-item-Text").click();

    // A new component was appended to the page root.
    await expect(frame.locator("[data-instance-id]")).toHaveCount(
      countBefore + 1,
      { timeout: 10_000 }
    );
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
    const frame = await waitForEditor(page);

    await expect(
      frame.locator('[data-instance-id="title-delete-1"]')
    ).toBeVisible();

    // Delete via the layer-tree row action.
    const row = page.getByTestId("tree-node-title-delete-1");
    await row.hover();
    await row.getByRole("button", { name: "Delete" }).click();

    await expect(
      frame.locator('[data-instance-id="title-delete-1"]')
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(
      frame.locator('[data-instance-id="text-delete-1"]')
    ).toBeVisible();
  });

  test("toggles preview mode via the view-mode switch", async ({ page }) => {
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
    const frame = await waitForEditor(page);

    // Desktop preview: sidebars disappear, content stays.
    await page.getByTestId("viewmode-desktop").click();
    await expect(page.getByTestId("tree-add-root")).toHaveCount(0);
    await expect(frame.getByText("Preview Me")).toBeVisible();

    // Back to edit: chrome reappears.
    await page.getByTestId("viewmode-edit").click();
    await expect(page.getByTestId("tree-add-root")).toBeVisible();
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

    // Page settings live behind the Pages tab (Navigation) and open in the
    // right sidebar.
    await page.locator(".mantine-SegmentedControl-label", { hasText: "Pages" }).click();
    await page.locator('[title="Page Settings"]').first().click();
    await page.waitForTimeout(300);

    const renameInput = page.locator('input[placeholder="Enter new page name"]');
    if (await renameInput.isVisible()) {
      await renameInput.fill(newName);

      // Click the rename action icon
      const renameButton = renameInput.locator("..").locator("button").first();
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
