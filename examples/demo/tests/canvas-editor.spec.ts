import { test, expect, type Page, type Frame } from "@playwright/test";

/**
 * E2E for the iframe-canvas editor example (/canvas-editor) built on
 * "@derneuere/visual-react/canvas" + "/canvas/dnd".
 *
 * Covers: bridge connect + content render inside the iframe, click-select
 * round-trip, dnd-kit palette drag driving the in-iframe drop indicator and
 * inserting on drop, and the bridge-native move-drag via synthetic pointer
 * events (the bridge listens to plain document-level pointer listeners).
 */

test.describe("iframe canvas editor", () => {
  test.setTimeout(60_000);

  async function openCanvasEditor(page: Page): Promise<Frame> {
    await page.goto("/canvas-editor/index");
    await expect(page.locator('iframe[title="Canvas"]')).toBeVisible({
      timeout: 30_000,
    });
    // The host shows "connected" once the bridge handshake completed.
    await expect(page.getByTestId("canvas-connection")).toHaveText(
      "connected",
      { timeout: 45_000 }
    );
    const frame = page
      .frames()
      .find((f) => f.url().includes("/canvas-frame"));
    if (!frame) throw new Error("canvas iframe frame not found");
    // Content is pushed after connect; wait for the first widget wrapper.
    await expect(
      frame.locator("[data-instance-id]").first()
    ).toBeVisible({ timeout: 30_000 });
    return frame;
  }

  test("renders the pushed page inside the iframe", async ({ page }) => {
    const frame = await openCanvasEditor(page);
    await expect(frame.getByText("Welcome to Visual React")).toBeVisible();
    // The canvas render is the static one — no editor control panels inside.
    await expect(frame.locator(".control-panel")).toHaveCount(0);
  });

  test("click-select round-trips to the host and back", async ({ page }) => {
    const frame = await openCanvasEditor(page);

    // Click the Title widget inside the iframe...
    await frame.locator('[data-widget-id="Title"]').first().click();

    // ...the host selection panel shows it...
    await expect(page.getByTestId("canvas-selected-label")).toHaveText("Title");

    // ...and the host pushes the selection back down: the bridge overlay
    // draws the selection outline in the iframe.
    await expect(
      frame.locator("[data-vr-canvas-selection]")
    ).toBeVisible();

    // Escape inside the iframe is forwarded to the host and clears the
    // selection (key-forwarding path).
    await frame.locator("body").press("Escape");
    await expect(page.getByTestId("canvas-selected-label")).toContainText(
      "Nothing selected"
    );
  });

  test("palette drag drives the drop indicator and inserts on drop", async ({
    page,
  }) => {
    const frame = await openCanvasEditor(page);
    const titleCount = await frame
      .locator('[data-widget-id="Title"]')
      .count();

    const palette = page.getByTestId("canvas-palette-Title").locator("div");
    // page.mouse does not auto-scroll; bring the palette item into view.
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
    const frame = await openCanvasEditor(page);

    const order = () =>
      frame.evaluate(() => {
        const section = document.querySelector(
          '[data-widget-id="Section"]'
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
      const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const title = document.querySelector<HTMLElement>(
        '[data-instance-id][data-widget-id="Title"]'
      )!;
      const text = document.querySelector<HTMLElement>(
        '[data-instance-id][data-widget-id="Text"]'
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
    await expect
      .poll(order, { timeout: 10_000 })
      .toEqual(["Text", "Title"]);
  });
});
