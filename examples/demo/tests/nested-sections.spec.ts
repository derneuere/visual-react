import { test, expect } from "@playwright/test";
import { auth } from "./login-helper";
import { promises as fs } from "fs";
import path from "path";

const PAGES_DIR = path.resolve(process.cwd(), "pages");
const TEST_PAGE_PREFIX = "nested-test";

function testPagePath(name: string) {
  return path.join(PAGES_DIR, `${name}.json`);
}

async function writeTestPage(name: string, data: any) {
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.writeFile(
    testPagePath(name),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

async function readTestPage(name: string) {
  const content = await fs.readFile(testPagePath(name), "utf-8");
  return JSON.parse(content);
}

async function deleteTestPage(name: string) {
  try {
    await fs.unlink(testPagePath(name));
  } catch {
    // ignore
  }
}

/** Build a deeply nested page structure for testing */
function createNestedPageData() {
  return [
    {
      id: "Page",
      props: {
        instanceId: "page-nested-root",
        title: "Nested Sections Test",
        children: [
          {
            id: "Section",
            props: {
              instanceId: "outer-section",
              children: [
                {
                  id: "Title",
                  props: {
                    instanceId: "outer-title",
                    label: "Outer Title",
                    size: 1,
                    alignment: "center",
                  },
                },
                {
                  id: "Section",
                  props: {
                    instanceId: "inner-section",
                    children: [
                      {
                        id: "Title",
                        props: {
                          instanceId: "inner-title",
                          label: "Inner Title",
                          size: 2,
                          alignment: "left",
                        },
                      },
                      {
                        id: "Text",
                        props: {
                          instanceId: "inner-text",
                          content: "Inner text content",
                          alignment: "left",
                        },
                      },
                    ],
                    backgroundColor: "secondary",
                    alignment: "stretch",
                    height: "auto",
                    width: "100%",
                    padding: "2rem",
                  },
                },
              ],
              backgroundColor: "primary",
              alignment: "stretch",
              height: "auto",
              width: "100%",
              padding: "5rem",
            },
          },
        ],
      },
    },
  ];
}

/** 3 levels deep: Page > outer > middle > inner */
function createTripleNestedPageData() {
  return [
    {
      id: "Page",
      props: {
        instanceId: "page-triple",
        title: "Triple Nested Test",
        children: [
          {
            id: "Section",
            props: {
              instanceId: "level-1-section",
              children: [
                {
                  id: "Title",
                  props: {
                    instanceId: "level-1-title",
                    label: "Level 1",
                    size: 1,
                    alignment: "center",
                  },
                },
                {
                  id: "Section",
                  props: {
                    instanceId: "level-2-section",
                    children: [
                      {
                        id: "Title",
                        props: {
                          instanceId: "level-2-title",
                          label: "Level 2",
                          size: 2,
                          alignment: "center",
                        },
                      },
                      {
                        id: "Section",
                        props: {
                          instanceId: "level-3-section",
                          children: [
                            {
                              id: "Title",
                              props: {
                                instanceId: "level-3-title",
                                label: "Level 3",
                                size: 3,
                                alignment: "center",
                              },
                            },
                          ],
                          backgroundColor: "tertiary",
                          alignment: "center",
                          height: "auto",
                          width: "100%",
                        },
                      },
                    ],
                    backgroundColor: "secondary",
                    alignment: "stretch",
                    height: "auto",
                    width: "100%",
                  },
                },
              ],
              backgroundColor: "primary",
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

async function waitForEditor(page) {
  await page.waitForSelector("text=Not Previewing", { timeout: 10000 });
  await page.waitForSelector(".control-panel", { timeout: 10000 });
}

test.describe("Nested Sections - Rendering", () => {
  const pageName = `${TEST_PAGE_PREFIX}-render`;

  test.beforeAll(async () => {
    await writeTestPage(pageName, createNestedPageData());
  });

  test.beforeEach(async ({ page }) => {
    await auth.setupAuthCookie(page);
    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);
  });

  test.afterAll(async () => {
    await deleteTestPage(pageName);
  });

  test("renders both outer and inner sections", async ({ page }) => {
    // Outer section control panel should exist
    const outerItem = page.locator(
      '[data-testid="sortable-item-outer-section"]'
    );
    await expect(outerItem).toBeAttached();

    // Inner section control panel should exist
    const innerItem = page.locator(
      '[data-testid="sortable-item-inner-section"]'
    );
    await expect(innerItem).toBeAttached();
  });

  test("renders components inside nested sections", async ({ page }) => {
    // Outer title should be visible
    await expect(page.locator("text=Outer Title")).toBeVisible();

    // Inner title should be visible
    await expect(page.locator("text=Inner Title")).toBeVisible();

    // Inner text should be visible
    await expect(page.locator("text=Inner text content")).toBeVisible();
  });

  test("each nested component has its own control panel", async ({ page }) => {
    // Count all control panels — should have:
    // outer-section, outer-title, inner-section, inner-title, inner-text = 5
    const controlPanels = page.locator(".control-panel");
    const count = await controlPanels.count();
    expect(count).toBeGreaterThanOrEqual(5);

    // Each should display the component type name
    const labels = await page.locator(".instance-id").allTextContents();
    expect(labels).toContain("Section");
    expect(labels).toContain("Title");
    expect(labels).toContain("Text");
  });
});

test.describe("Nested Sections - Editing", () => {
  let pageName: string;

  test.beforeEach(async ({ page }) => {
    // Fresh page per test so edits don't interfere
    pageName = `${TEST_PAGE_PREFIX}-edit-${Date.now()}`;
    await writeTestPage(pageName, createNestedPageData());
    await auth.setupAuthCookie(page);
    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);
  });

  test.afterEach(async () => {
    await deleteTestPage(pageName);
  });

  test("can select and edit the inner section", async ({ page }) => {
    // Click the edit button on the inner section
    const innerSection = page.locator(
      '[data-testid="sortable-item-inner-section"]'
    );
    const editBtn = innerSection.locator('[data-testid="edit-button"]').first();
    await editBtn.click({ force: true });

    // The editing panel should appear with Section-specific properties
    await page.waitForSelector("text=Edit Component", { timeout: 5000 });

    // Section editable props should be visible (alignment, backgroundColor, etc.)
    await expect(page.locator("text=alignment").first()).toBeVisible();
    await expect(page.locator("text=backgroundColor").first()).toBeVisible();
  });

  test("can edit a component inside the inner section", async ({ page }) => {
    // Click edit on the inner title
    const innerTitle = page.locator(
      '[data-testid="sortable-item-inner-title"]'
    );
    const editBtn = innerTitle.locator('[data-testid="edit-button"]').first();
    await editBtn.click({ force: true });

    // The editing panel should appear
    await page.waitForSelector("text=Edit Component", { timeout: 5000 });

    // Change the label
    const labelInput = page
      .locator('label:has-text("label")')
      .locator("..")
      .locator("input");
    await labelInput.clear();
    await labelInput.fill("Modified Inner Title");

    // The page should show the updated text
    await expect(page.locator("text=Modified Inner Title")).toBeVisible();
  });

  test("saves nested structure changes via Publish", async ({ page }) => {
    // Click edit on inner title
    const innerTitle = page.locator(
      '[data-testid="sortable-item-inner-title"]'
    );
    const editBtn = innerTitle.locator('[data-testid="edit-button"]').first();
    await editBtn.click({ force: true });

    await page.waitForSelector("text=Edit Component", { timeout: 5000 });

    // Change label
    const labelInput = page
      .locator('label:has-text("label")')
      .locator("..")
      .locator("input");
    await labelInput.clear();
    await labelInput.fill("Saved Inner Title");

    // Publish
    const publishBtn = page.locator('button:has-text("Publish")');
    await expect(publishBtn).toBeEnabled({ timeout: 2000 });
    await publishBtn.click();
    await page.waitForTimeout(1000);

    // Verify on disk — navigate the nested structure
    const saved = await readTestPage(pageName);
    const outerSection = saved[0].props.children[0];
    const innerSection = outerSection.props.children[1];
    const innerTitleComp = innerSection.props.children[0];
    expect(innerTitleComp.props.label).toBe("Saved Inner Title");
  });

  test("can switch selection between outer and inner components", async ({
    page,
  }) => {
    // Select the outer title
    const outerTitle = page.locator(
      '[data-testid="sortable-item-outer-title"]'
    );
    await outerTitle
      .locator('[data-testid="edit-button"]')
      .first()
      .click({ force: true });
    await page.waitForSelector("text=Edit Component", { timeout: 5000 });

    // Verify it's the outer title (label should be "Outer Title")
    const labelInput = page
      .locator('label:has-text("label")')
      .locator("..")
      .locator("input");
    await expect(labelInput).toHaveValue("Outer Title");

    // Now select the inner title
    const innerTitle = page.locator(
      '[data-testid="sortable-item-inner-title"]'
    );
    await innerTitle
      .locator('[data-testid="edit-button"]')
      .first()
      .click({ force: true });
    await page.waitForTimeout(300);

    // Verify it switched to inner title
    await expect(labelInput).toHaveValue("Inner Title");
  });
});

test.describe("Nested Sections - Add & Delete", () => {
  let pageName: string;

  test.beforeEach(async ({ page }) => {
    pageName = `${TEST_PAGE_PREFIX}-addel-${Date.now()}`;
    await writeTestPage(pageName, createNestedPageData());
    await auth.setupAuthCookie(page);
    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);
  });

  test.afterEach(async () => {
    await deleteTestPage(pageName);
  });

  test("can delete a component from the inner section", async ({ page }) => {
    // Verify inner text exists
    await expect(page.locator("text=Inner text content")).toBeVisible();

    // Delete the inner text component
    const innerText = page.locator(
      '[data-testid="sortable-item-inner-text"]'
    );
    await innerText
      .locator('[data-testid="delete-button"]')
      .click({ force: true });
    await page.waitForTimeout(500);

    // Inner text should be gone
    await expect(page.locator("text=Inner text content")).not.toBeVisible();

    // Inner title should still be there
    await expect(page.locator("text=Inner Title")).toBeVisible();
  });

  test("can delete the entire inner section", async ({ page }) => {
    // Verify nested content exists
    await expect(page.locator("text=Inner Title")).toBeVisible();

    // Delete the inner section
    const innerSection = page.locator(
      '[data-testid="sortable-item-inner-section"]'
    );
    await innerSection
      .locator('[data-testid="delete-button"]')
      .first()
      .click({ force: true });
    await page.waitForTimeout(500);

    // Inner section and its children should be gone
    await expect(page.locator("text=Inner Title")).not.toBeVisible();
    await expect(page.locator("text=Inner text content")).not.toBeVisible();

    // Outer title should still be there
    await expect(page.locator("text=Outer Title")).toBeVisible();
  });

  test("can add a component inside the inner section", async ({ page }) => {
    // Count components in the inner section before adding
    const innerSection = page.locator(
      '[data-testid="sortable-item-inner-section"]'
    );
    const controlPanelsBefore = await innerSection
      .locator(".control-panel")
      .count();

    // Click the add-below button on the inner text (last child in inner section)
    const innerText = page.locator(
      '[data-testid="sortable-item-inner-text"]'
    );
    await innerText
      .locator('[data-testid="add-below-button"]')
      .click({ force: true });
    await page.waitForTimeout(300);

    // The component explorer modal should appear
    const modal = page.locator('[role="dialog"]');
    await modal.waitFor({ state: "visible", timeout: 3000 });

    // Click on a component (items are divs, not buttons) — use "Text" which is always available
    await modal.locator('div:has-text("Text")').last().click();
    await page.waitForTimeout(500);

    // There should be more components in the inner section now
    const controlPanelsAfter = await innerSection
      .locator(".control-panel")
      .count();
    expect(controlPanelsAfter).toBeGreaterThan(controlPanelsBefore);
  });
});

test.describe("Nested Sections - Triple Nesting (3 levels)", () => {
  const pageName = `${TEST_PAGE_PREFIX}-triple`;

  test.beforeAll(async () => {
    await writeTestPage(pageName, createTripleNestedPageData());
  });

  test.beforeEach(async ({ page }) => {
    await auth.setupAuthCookie(page);
    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);
  });

  test.afterAll(async () => {
    await deleteTestPage(pageName);
  });

  test("renders all three levels of nested sections", async ({ page }) => {
    await expect(page.locator("text=Level 1")).toBeVisible();
    await expect(page.locator("text=Level 2")).toBeVisible();
    await expect(page.locator("text=Level 3")).toBeVisible();
  });

  test("all three section levels have control panels", async ({ page }) => {
    const level1 = page.locator(
      '[data-testid="sortable-item-level-1-section"]'
    );
    const level2 = page.locator(
      '[data-testid="sortable-item-level-2-section"]'
    );
    const level3 = page.locator(
      '[data-testid="sortable-item-level-3-section"]'
    );

    await expect(level1).toBeAttached();
    await expect(level2).toBeAttached();
    await expect(level3).toBeAttached();
  });

  test("can edit the deepest nested component (level 3)", async ({ page }) => {
    // Click edit on the level 3 title
    const level3Title = page.locator(
      '[data-testid="sortable-item-level-3-title"]'
    );
    await level3Title
      .locator('[data-testid="edit-button"]')
      .first()
      .click({ force: true });

    await page.waitForSelector("text=Edit Component", { timeout: 5000 });

    // Verify the label value
    const labelInput = page
      .locator('label:has-text("label")')
      .locator("..")
      .locator("input");
    await expect(labelInput).toHaveValue("Level 3");

    // Change it
    await labelInput.clear();
    await labelInput.fill("Deep Level 3");
    await expect(page.locator("text=Deep Level 3")).toBeVisible();
  });

  test("deleting a mid-level section removes it and its children", async ({
    page,
  }) => {
    // All 3 levels visible
    await expect(page.locator("text=Level 2")).toBeVisible();
    await expect(page.locator("text=Level 3")).toBeVisible();

    // Delete level 2 section — use .first() to get the level-2's own delete button
    // (it renders before nested children in the DOM)
    const level2Section = page.locator(
      '[data-testid="sortable-item-level-2-section"]'
    );
    await level2Section
      .locator('[data-testid="delete-button"]')
      .first()
      .click({ force: true });

    // Wait for the level-2 section to be removed from the DOM
    await expect(
      page.locator('[data-testid="sortable-item-level-2-section"]')
    ).not.toBeAttached({ timeout: 5000 });

    // Level 3 section sortable item should also be gone
    await expect(
      page.locator('[data-testid="sortable-item-level-3-section"]')
    ).not.toBeAttached({ timeout: 5000 });

    // Level 1 should still exist
    await expect(page.locator("text=Level 1")).toBeVisible();
  });
});

test.describe("Nested Sections - Preview Mode", () => {
  const pageName = `${TEST_PAGE_PREFIX}-preview`;

  test.beforeAll(async () => {
    await writeTestPage(pageName, createNestedPageData());
  });

  test.beforeEach(async ({ page }) => {
    await auth.setupAuthCookie(page);
    await page.goto(`/editor/${pageName}`);
    await auth.handleLoginForm(page);
    await waitForEditor(page);
  });

  test.afterAll(async () => {
    await deleteTestPage(pageName);
  });

  test("preview mode hides all control panels including nested ones", async ({
    page,
  }) => {
    // Control panels should be visible in edit mode
    const panelsBefore = await page.locator(".control-panel").count();
    expect(panelsBefore).toBeGreaterThanOrEqual(5);

    // Toggle preview
    await page.locator('label:has-text("Not Previewing")').click();
    await page.waitForTimeout(300);

    // All control panels should be hidden
    const panelsAfter = await page.locator(".control-panel").count();
    expect(panelsAfter).toBe(0);

    // But content should still render
    await expect(page.locator("text=Outer Title")).toBeVisible();
    await expect(page.locator("text=Inner Title")).toBeVisible();
  });
});

test.describe("Nested Sections - Public Route", () => {
  const pageName = `${TEST_PAGE_PREFIX}-public`;

  test.beforeAll(async () => {
    await writeTestPage(pageName, createNestedPageData());
  });

  test.beforeEach(async ({ page }) => {
    await auth.setupAuthCookie(page);
  });

  test.afterAll(async () => {
    await deleteTestPage(pageName);
  });

  test("nested content renders correctly on the public page", async ({
    page,
  }) => {
    await page.goto(`/${pageName}`);
    await auth.handleLoginForm(page);

    await page.waitForSelector("text=Outer Title", { timeout: 10000 });

    const body = await page.textContent("body");
    expect(body).toContain("Outer Title");
    expect(body).toContain("Inner Title");
    expect(body).toContain("Inner text content");
  });
});
