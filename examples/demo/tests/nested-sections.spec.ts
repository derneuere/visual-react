import { test, expect, type Page, type Frame } from "@playwright/test";
import { auth } from "./login-helper";
import { promises as fs } from "fs";
import path from "path";

/**
 * Nested-section coverage for the canvas-only editor (0.4.0).
 *
 * Rewritten from the pre-0.4.0 in-document suite: the old spec asserted
 * SortableItem chrome (control panels, edit/delete/add-below buttons) that
 * no longer exists. Nested structures are now verified through the canvas
 * iframe markup (data-instance-id wrappers), edited through the property
 * panel and restructured through the layer tree.
 */

const PAGES_DIR = path.resolve(process.cwd(), "pages");
const PAGE_NAME = "nested-sections-test";

async function writeNestedTestPage() {
  const data = [
    {
      id: "Page",
      props: {
        instanceId: "nested-page",
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
                  },
                },
              ],
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
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.writeFile(
    path.join(PAGES_DIR, `${PAGE_NAME}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

async function openEditor(page: Page): Promise<Frame> {
  await writeNestedTestPage();
  await auth.setupAuthCookie(page);
  await page.goto(`/editor/${PAGE_NAME}`);
  await auth.handleLoginForm(page);

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
  await expect(frame.locator("[data-instance-id]").first()).toBeVisible({
    timeout: 30_000,
  });
  return frame;
}

test.describe("Nested Sections (canvas editor)", () => {
  test.setTimeout(60_000);

  test("renders nested sections and their children in the canvas", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    // Outer section contains the inner section, which contains title + text.
    await expect(
      frame.locator(
        '[data-instance-id="outer-section"] [data-instance-id="inner-section"]'
      )
    ).toBeVisible();
    await expect(
      frame.locator(
        '[data-instance-id="inner-section"] [data-instance-id="inner-title"]'
      )
    ).toBeVisible();
    await expect(frame.getByText("Inner text content")).toBeVisible();

    // The layer tree mirrors the nesting.
    await expect(page.getByTestId("tree-node-outer-section")).toBeVisible();
    await expect(page.getByTestId("tree-node-inner-section")).toBeVisible();
    await expect(page.getByTestId("tree-node-inner-title")).toBeVisible();
  });

  test("selects and edits a component inside the inner section", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    await frame.locator('[data-instance-id="inner-title"]').click();
    const panel = page.getByTestId("property-panel");
    await expect(panel).toBeVisible();

    const labelInput = panel.getByLabel("label", { exact: true });
    await expect(labelInput).toHaveValue("Inner Title");
    await labelInput.fill("Inner Title Edited");

    await expect(frame.getByText("Inner Title Edited")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("saves nested structure changes via Publish", async ({ page }) => {
    const frame = await openEditor(page);

    await frame.locator('[data-instance-id="inner-title"]').click();
    const panel = page.getByTestId("property-panel");
    await panel.getByLabel("label", { exact: true }).fill("Saved Inner Title");

    const publishButton = page.getByRole("button", { name: "Publish" });
    await expect(publishButton).toBeEnabled({ timeout: 5_000 });
    await publishButton.click();
    await page.waitForTimeout(1000);

    const raw = JSON.parse(
      await fs.readFile(path.join(PAGES_DIR, `${PAGE_NAME}.json`), "utf-8")
    );
    // The storage adapter may persist the raw content array or a
    // { meta, content } PageData envelope.
    const content = Array.isArray(raw) ? raw : raw.content;
    const inner =
      content[0].props.children[0].props.children[1].props.children[0];
    expect(inner.props.label).toBe("Saved Inner Title");
  });

  test("switches selection between outer and inner components", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    await frame.locator('[data-instance-id="outer-title"]').click();
    await expect(
      page.getByTestId("property-panel").getByLabel("label", { exact: true })
    ).toHaveValue("Outer Title");

    await frame.locator('[data-instance-id="inner-title"]').click();
    await expect(
      page.getByTestId("property-panel").getByLabel("label", { exact: true })
    ).toHaveValue("Inner Title");
  });

  test("deletes a component from the inner section via the tree", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    const row = page.getByTestId("tree-node-inner-text");
    await row.hover();
    await row.getByRole("button", { name: "Delete" }).click();

    await expect(
      frame.locator('[data-instance-id="inner-text"]')
    ).toHaveCount(0, { timeout: 10_000 });
    // The rest of the inner section is intact.
    await expect(
      frame.locator('[data-instance-id="inner-title"]')
    ).toBeVisible();
  });

  test("deleting the inner section removes it and its children", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    await page
      .getByTestId("tree-node-inner-section")
      .click({ button: "right" });
    const menu = page.getByTestId("tree-context-menu");
    await expect(menu).toBeVisible();
    await menu.getByText("Delete").click();

    await expect(
      frame.locator('[data-instance-id="inner-section"]')
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(
      frame.locator('[data-instance-id="inner-title"]')
    ).toHaveCount(0);
    // The outer section survives.
    await expect(
      frame.locator('[data-instance-id="outer-section"]')
    ).toBeVisible();
  });

  test("inserts a component into the inner section via the context menu", async ({
    page,
  }) => {
    const frame = await openEditor(page);
    const before = await frame
      .locator('[data-instance-id="inner-section"] [data-instance-id]')
      .count();

    await page
      .getByTestId("tree-node-inner-section")
      .click({ button: "right" });
    await page
      .getByTestId("tree-context-menu")
      .getByText("Insert component")
      .click();
    await expect(page.getByTestId("picker-search")).toBeVisible();
    await page.getByTestId("picker-item-Text").click();

    await expect(
      frame.locator('[data-instance-id="inner-section"] [data-instance-id]')
    ).toHaveCount(before + 1, { timeout: 10_000 });
  });

  test("preview mode renders the nested content read-only", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    // Select something so we can verify preview clears the selection UI.
    await frame.locator('[data-instance-id="inner-title"]').click();
    await expect(page.getByTestId("property-panel")).toBeVisible();

    await page.getByTestId("viewmode-desktop").click();
    // Sidebars gone, selection overlay cleared, content still rendered.
    await expect(page.getByTestId("property-panel")).toHaveCount(0);
    await expect(page.getByTestId("tree-add-root")).toHaveCount(0);
    await expect(frame.getByText("Inner Title")).toBeVisible();
    await expect(frame.locator("[data-vr-canvas-selection]")).toHaveCount(0);
  });

  test("nested content renders correctly on the public page", async ({
    page,
  }) => {
    await writeNestedTestPage();
    await auth.setupAuthCookie(page);
    await page.goto(`/${PAGE_NAME}`);

    await page.waitForSelector("text=Outer Title", { timeout: 10_000 });
    const body = await page.textContent("body");
    expect(body).toContain("Outer Title");
    expect(body).toContain("Inner Title");
    expect(body).toContain("Inner text content");
  });
});
