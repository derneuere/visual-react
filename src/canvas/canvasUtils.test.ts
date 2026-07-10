import { describe, it, expect } from "vitest";
import type { Instance } from "../registry/types";
import {
  isInstanceLike,
  isInstanceArray,
  findInstanceByBridgeId,
  clampRectToViewport,
} from "./canvasUtils";
import { isCanvasBridgeApi, getCanvasBridge } from "./protocol";

const leaf = (id: string, instanceId: string | number): Instance => ({
  id,
  props: { instanceId },
});

describe("isInstanceLike / isInstanceArray", () => {
  it("accepts string and number instanceIds", () => {
    expect(isInstanceLike(leaf("Title", "t-1"))).toBe(true);
    expect(isInstanceLike(leaf("Title", 42))).toBe(true);
  });

  it("rejects non-instances", () => {
    expect(isInstanceLike(null)).toBe(false);
    expect(isInstanceLike("Title")).toBe(false);
    expect(isInstanceLike({ id: "Title" })).toBe(false);
    expect(isInstanceLike({ id: "Title", props: {} })).toBe(false);
    expect(isInstanceLike({ id: 5, props: { instanceId: 1 } })).toBe(false);
  });

  it("isInstanceArray requires a non-empty all-instance array", () => {
    expect(isInstanceArray([])).toBe(false);
    expect(isInstanceArray([leaf("A", 1)])).toBe(true);
    expect(isInstanceArray([leaf("A", 1), "x"])).toBe(false);
    expect(isInstanceArray(["a", "b"])).toBe(false);
    expect(isInstanceArray({ 0: leaf("A", 1) })).toBe(false);
  });
});

describe("findInstanceByBridgeId", () => {
  const tree: Instance[] = [
    {
      id: "Page",
      props: {
        instanceId: 1,
        title: "Home",
        children: [
          {
            id: "Section",
            props: {
              instanceId: "sec-1",
              // Instance children live in an arbitrary prop name — the walk
              // is structural, not registry-driven.
              items: [leaf("Title", 7), leaf("Text", "txt-1")],
              // Non-instance arrays must be skipped, not crashed on.
              tags: ["a", "b"],
            },
          },
          leaf("Footer", 99),
        ],
      },
    },
  ];

  it("finds top-level, nested and specialized-field instances", () => {
    expect(findInstanceByBridgeId(tree, "1")?.id).toBe("Page");
    expect(findInstanceByBridgeId(tree, "sec-1")?.id).toBe("Section");
    expect(findInstanceByBridgeId(tree, "7")?.id).toBe("Title");
    expect(findInstanceByBridgeId(tree, "txt-1")?.id).toBe("Text");
    expect(findInstanceByBridgeId(tree, "99")?.id).toBe("Footer");
  });

  it("matches numeric ids by their string form", () => {
    const found = findInstanceByBridgeId(tree, "7");
    expect(found?.props.instanceId).toBe(7);
  });

  it("returns null for unknown ids", () => {
    expect(findInstanceByBridgeId(tree, "nope")).toBeNull();
    expect(findInstanceByBridgeId([], "1")).toBeNull();
  });
});

describe("clampRectToViewport", () => {
  const viewport = { width: 800, height: 600 };

  it("returns the rect unchanged when fully inside", () => {
    const rect = { top: 10, left: 20, width: 100, height: 50 };
    expect(clampRectToViewport(rect, viewport)).toEqual(rect);
  });

  it("clamps rects that overflow the edges", () => {
    expect(
      clampRectToViewport({ top: -50, left: -10, width: 100, height: 100 }, viewport)
    ).toEqual({ top: 0, left: 0, width: 90, height: 50 });
    expect(
      clampRectToViewport({ top: 550, left: 750, width: 100, height: 100 }, viewport)
    ).toEqual({ top: 550, left: 750, width: 50, height: 50 });
  });

  it("returns null for rects fully outside the viewport", () => {
    expect(
      clampRectToViewport({ top: 600, left: 0, width: 100, height: 100 }, viewport)
    ).toBeNull();
    expect(
      clampRectToViewport({ top: 0, left: -100, width: 100, height: 100 }, viewport)
    ).toBeNull();
    expect(
      clampRectToViewport({ top: -200, left: 0, width: 100, height: 100 }, viewport)
    ).toBeNull();
  });

  it("returns null for zero-area rects", () => {
    expect(
      clampRectToViewport({ top: 10, left: 10, width: 0, height: 50 }, viewport)
    ).toBeNull();
  });
});

describe("protocol guards", () => {
  const makeApi = () => ({
    connect: () => {},
    disconnect: () => {},
    setContent: () => {},
    setPageData: () => {},
    setSelection: () => {},
    setHover: () => {},
    setDropIndicator: () => {},
    setInputEnabled: () => {},
    getRectMap: () => ({ rects: {}, scrollX: 0, scrollY: 0 }),
  });

  it("isCanvasBridgeApi accepts a complete api and rejects partials", () => {
    expect(isCanvasBridgeApi(makeApi())).toBe(true);
    const partial: Record<string, unknown> = { ...makeApi() };
    delete partial.getRectMap;
    expect(isCanvasBridgeApi(partial)).toBe(false);
    expect(isCanvasBridgeApi(null)).toBe(false);
    expect(isCanvasBridgeApi(undefined)).toBe(false);
    expect(isCanvasBridgeApi("bridge")).toBe(false);
  });

  it("getCanvasBridge reads the configured global from a window-like object", () => {
    const api = makeApi();
    const win = { __visualReactCanvasBridge: api } as unknown as Window;
    expect(getCanvasBridge(win)).toBe(api);
    expect(getCanvasBridge(win, "__other")).toBeNull();

    const custom = { __myBridge: api } as unknown as Window;
    expect(getCanvasBridge(custom, "__myBridge")).toBe(api);
  });

  it("getCanvasBridge handles missing windows and malformed globals", () => {
    expect(getCanvasBridge(null)).toBeNull();
    expect(getCanvasBridge(undefined)).toBeNull();
    const bad = { __visualReactCanvasBridge: { connect: 1 } } as unknown as Window;
    expect(getCanvasBridge(bad)).toBeNull();
  });
});
