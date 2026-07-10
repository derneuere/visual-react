import { test, expect, type Page, type Frame } from "@playwright/test";
import { auth } from "./login-helper";
import { promises as fs } from "fs";
import path from "path";

/**
 * E2E for the bundled canvas-only editor (0.4.0) at /editor.
 *
 * Replaces the pre-0.4.0 canvas-editor.spec.ts (the standalone iframe-canvas
 * example route, now consolidated into /editor) AND
 * component-interactions.spec.ts (which drove the removed in-document
 * SortableItem editing chrome — drag handles, hover control panels, add
 * above/below buttons no longer exist).
 *
 * Covers: bridge connect + static render inside the iframe, click-select
 * round-trip (canvas -> property panel), property edits pushing back into
 * the canvas, layer-tree ops (select / move / context-menu delete), the
 * component picker, undo/redo, device view modes, dnd-kit palette drags onto
 * the canvas and the bridge-native move drag (via synthetic pointer events —
 * the bridge listens to plain document-level pointer listeners).
 */

const PAGES_DIR = path.resolve(process.cwd(), "pages");
const PAGE_NAME = "editor-spec-test";

// Deterministic test page: Section containing Title + Text.
async function writeEditorTestPage() {
  const data = [
    {
      id: "Page",
      props: {
        instanceId: "editor-spec-page",
        title: "Editor Spec Page",
        children: [
          {
            id: "Section",
            props: {
              instanceId: "editor-spec-section",
              children: [
                {
                  id: "Title",
                  props: {
                    instanceId: "editor-spec-title",
                    label: "Editor Spec Title",
                    size: 1,
                    alignment: "center",
                  },
                },
                {
                  id: "Text",
                  props: {
                    instanceId: "editor-spec-text",
                    content: "Editor spec text",
                    alignment: "left",
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
  await writeEditorTestPage();
  await auth.setupAuthCookie(page);
  await page.goto(`/editor/${PAGE_NAME}`);
  await auth.handleLoginForm(page);

  // The canvas iframe is the editor's center column.
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
  // Content is pushed after the bridge handshake; wait for the first widget.
  await expect(frame.locator("[data-instance-id]").first()).toBeVisible({
    timeout: 30_000,
  });
  return frame;
}

test.describe("canvas-only editor", () => {
  test.setTimeout(60_000);

  test("renders the page inside the iframe, statically", async ({ page }) => {
    const frame = await openEditor(page);
    await expect(frame.getByText("Editor Spec Title")).toBeVisible();
    // The canvas render is the static one — no editing chrome in the markup.
    await expect(frame.locator(".control-panel")).toHaveCount(0);
    // The parent page renders no in-document editing chrome either.
    await expect(page.locator(".control-panel")).toHaveCount(0);
    // Chrome is present: palette, layer tree, add button.
    await expect(page.getByTestId("palette-Title")).toBeVisible();
    await expect(page.getByTestId("tree-node-editor-spec-title")).toBeVisible();
    await expect(page.getByTestId("tree-add-root")).toBeVisible();
  });

  test("click-select round-trips into the property panel and back", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    // Click the Title widget inside the iframe...
    await frame.locator('[data-instance-id="editor-spec-title"]').click();

    // ...the property panel opens on it...
    await expect(page.getByTestId("property-panel")).toBeVisible();
    await expect(page.getByTestId("property-panel")).toContainText("Title");

    // ...the layer tree highlights it, and the host pushes the selection
    // back down: the bridge overlay draws the selection outline.
    await expect(frame.locator("[data-vr-canvas-selection]")).toBeVisible();

    // Escape inside the iframe is forwarded to the host and clears the
    // selection (key-forwarding path).
    await frame.locator("body").press("Escape");
    await expect(page.getByTestId("property-panel")).toHaveCount(0);
  });

  test("selecting a tree row opens the property panel", async ({ page }) => {
    const frame = await openEditor(page);

    await page.getByTestId("tree-node-editor-spec-text").click();
    await expect(page.getByTestId("property-panel")).toBeVisible();
    // Selection is mirrored into the iframe.
    await expect(frame.locator("[data-vr-canvas-selection]")).toBeVisible();
  });

  test("property edits push into the canvas and participate in undo", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    await frame.locator('[data-instance-id="editor-spec-title"]').click();
    const panel = page.getByTestId("property-panel");
    await expect(panel).toBeVisible();

    const labelInput = panel.getByLabel("label", { exact: true });
    await labelInput.fill("Edited Headline");

    // The edit round-trips into the iframe (rAF-batched content push).
    await expect(frame.getByText("Edited Headline")).toBeVisible({
      timeout: 10_000,
    });

    // Undo (TopBar button) reverts the coalesced text edit.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(frame.getByText("Editor Spec Title")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("tree move buttons reorder siblings in the canvas", async ({ page }) => {
    const frame = await openEditor(page);

    const order = () =>
      frame.evaluate(() => {
        const section = document.querySelector(
          '[data-instance-id="editor-spec-section"]'
        ) as HTMLElement;
        return Array.from(
          section.querySelectorAll<HTMLElement>("[data-instance-id]")
        ).map((el) => el.dataset.widgetId);
      });

    expect(await order()).toEqual(["Title", "Text"]);

    // Row actions reveal on hover; "Move down" on the Title row.
    const titleRow = page.getByTestId("tree-node-editor-spec-title");
    await titleRow.hover();
    await titleRow.getByRole("button", { name: "Move down" }).click();

    await expect.poll(order, { timeout: 10_000 }).toEqual(["Text", "Title"]);

    // Move it back up.
    await titleRow.hover();
    await titleRow.getByRole("button", { name: "Move up" }).click();
    await expect.poll(order, { timeout: 10_000 }).toEqual(["Title", "Text"]);
  });

  test("context-menu delete removes the node; undo restores it", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    await expect(
      frame.locator('[data-instance-id="editor-spec-text"]')
    ).toBeVisible();

    await page
      .getByTestId("tree-node-editor-spec-text")
      .click({ button: "right" });
    const menu = page.getByTestId("tree-context-menu");
    await expect(menu).toBeVisible();
    await menu.getByText("Delete").click();

    await expect(
      frame.locator('[data-instance-id="editor-spec-text"]')
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId("tree-node-editor-spec-text")).toHaveCount(0);

    // Ctrl+Z restores the deleted node (keyboard undo path).
    await page.keyboard.press("Control+z");
    await expect(
      frame.locator('[data-instance-id="editor-spec-text"]')
    ).toBeVisible({ timeout: 10_000 });
  });

  test("component picker inserts into the page", async ({ page }) => {
    const frame = await openEditor(page);
    const textCount = await frame.locator('[data-widget-id="Text"]').count();

    await page.getByTestId("tree-add-root").click();
    await expect(page.getByTestId("picker-search")).toBeVisible();
    // Search narrows the grid; pick the Text component.
    await page.getByTestId("picker-search").fill("Text");
    await page.getByTestId("picker-item-Text").click();

    await expect(frame.locator('[data-widget-id="Text"]')).toHaveCount(
      textCount + 1,
      { timeout: 10_000 }
    );
  });

  test("device view modes hide the sidebars without remounting the iframe", async ({
    page,
  }) => {
    const frame = await openEditor(page);

    // Tag the iframe's window so a remount would be detectable.
    await frame.evaluate(() => {
      (window as any).__vrSpecMarker = "alive";
    });

    await page.getByTestId("viewmode-desktop").click();
    await expect(page.getByTestId("palette-Title")).toHaveCount(0);
    await expect(page.getByTestId("tree-add-root")).toHaveCount(0);
    // Content still renders in the (scaled) device frame.
    await expect(frame.getByText("Editor Spec Title")).toBeVisible();

    await page.getByTestId("viewmode-mobile").click();
    await expect(frame.getByText("Editor Spec Title")).toBeVisible();

    await page.getByTestId("viewmode-edit").click();
    await expect(page.getByTestId("palette-Title")).toBeVisible();

    // Same window object across all mode switches = the iframe never
    // remounted and the bridge connection survived.
    expect(
      await frame.evaluate(() => (window as any).__vrSpecMarker)
    ).toBe("alive");
  });

  test("palette drag drives the drop indicator and inserts on drop", async ({
    page,
  }) => {
    const frame = await openEditor(page);
    const titleCount = await frame.locator('[data-widget-id="Title"]').count();

    const palette = page.getByTestId("palette-Title");
    await palette.scrollIntoViewIfNeeded();
    const paletteBox = await palette.boundingBox();
    const section = frame.locator('[data-widget-id="Section"]').first();
    const sectionBox = await section.boundingBox();
    if (!paletteBox || !sectionBox) throw new Error("missing bounding boxes");

    // dnd-kit PointerSensor (8px activation): press, then move in steps.
    await page.mouse.move(
      paletteBox.x + paletteBox.width / 2,
      paletteBox.y + paletteBox.height / 2
    );
    await page.mouse.down();
    const targetX = sectionBox.x + sectionBox.width / 2;
    const targetY = sectionBox.y + sectionBox.height / 2;
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(
        paletteBox.x + ((targetX - paletteBox.x) * i) / 10,
        paletteBox.y + ((targetY - paletteBox.y) * i) / 10
      );
    }

    // The drop indicator is mirrored into the iframe (Section middle = "into").
    await expect(frame.locator("[data-vr-canvas-drop]")).toBeVisible({
      timeout: 5_000,
    });

    await page.mouse.up();

    // A new Title instance was appended into the Section.
    await expect(frame.locator('[data-widget-id="Title"]')).toHaveCount(
      titleCount + 1,
      { timeout: 10_000 }
    );
  });

  test("bridge-native move-drag reorders siblings", async ({ page }) => {
    const frame = await openEditor(page);

    const order = () =>
      frame.evaluate(() => {
        const section = document.querySelector(
          '[data-instance-id="editor-spec-section"]'
        ) as HTMLElement;
        return Array.from(
          section.querySelectorAll<HTMLElement>("[data-instance-id]")
        ).map((el) => el.dataset.widgetId);
      });

    expect(await order()).toEqual(["Title", "Text"]);

    // Drive the bridge's pointer listeners with synthetic events: drag the
    // Title below the Text sibling. isPrimary must be set explicitly —
    // constructed PointerEvents default to false and the bridge (rightly)
    // ignores non-primary pointers.
    const dropIndicatorSeen = await frame.evaluate(async () => {
      const raf = () =>
        new Promise((r) => requestAnimationFrame(() => r(null)));
      const title = document.querySelector<HTMLElement>(
        '[data-instance-id="editor-spec-title"]'
      )!;
      const text = document.querySelector<HTMLElement>(
        '[data-instance-id="editor-spec-text"]'
      )!;
      const from = title.getBoundingClientRect();
      const to = text.getBoundingClientRect();
      const startX = from.left + from.width / 2;
      const startY = from.top + from.height / 2;
      // Bottom quarter of the Text leaf => position "below".
      const endX = to.left + to.width / 2;
      const endY = to.top + to.height * 0.9;

      const fire = (type: string, target: Element, x: number, y: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: 1,
            pointerId: 1,
            isPrimary: true,
            pointerType: "mouse",
          })
        );

      fire("pointerdown", title, startX, startY);
      // Cross the 8px threshold, then head to the target in steps.
      fire("pointermove", title, startX + 12, startY + 12);
      await raf();
      for (let i = 1; i <= 5; i++) {
        fire(
          "pointermove",
          title,
          startX + ((endX - startX) * i) / 5,
          startY + ((endY - startY) * i) / 5
        );
        await raf();
      }
      const indicator = !!document.querySelector("[data-vr-canvas-drop]");
      fire("pointerup", title, endX, endY);
      return indicator;
    });

    expect(dropIndicatorSeen).toBe(true);

    // The host performed moveInstance and pushed the new order back down.
    await expect.poll(order, { timeout: 10_000 }).toEqual(["Text", "Title"]);
  });
});
