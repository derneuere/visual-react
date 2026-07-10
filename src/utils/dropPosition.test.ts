import { describe, it, expect } from "vitest";
import { computeDropPosition } from "./dropPosition";

const rect = (top: number, height: number) => ({ top, height });

describe("computeDropPosition", () => {
  describe("forceInto", () => {
    it("always returns 'into', regardless of geometry or target kind", () => {
      expect(
        computeDropPosition({
          pointerY: 0,
          rect: rect(0, 100),
          isContainer: false,
          forceInto: true,
        })
      ).toBe("into");
      expect(
        computeDropPosition({
          pointerY: 99999,
          rect: rect(0, 10),
          isContainer: true,
          fieldName: "children",
          forceInto: true,
        })
      ).toBe("into");
    });
  });

  describe("containers with a specialized (non-children) field", () => {
    it("always returns 'into' anywhere over the target", () => {
      for (const pointerY of [0, 1, 50, 199, 200]) {
        expect(
          computeDropPosition({
            pointerY,
            rect: rect(0, 200),
            isContainer: true,
            fieldName: "left",
          })
        ).toBe("into");
      }
    });
  });

  describe("containers with a 'children' field (edge detection)", () => {
    // height 200 -> edge threshold = min(200 * 0.25, 50) = 50
    it("top edge = above, bottom edge = below, middle = into", () => {
      const input = { rect: rect(0, 200), isContainer: true };
      expect(computeDropPosition({ ...input, pointerY: 0 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 49.9 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 100 })).toBe("into");
      expect(computeDropPosition({ ...input, pointerY: 150.1 })).toBe("below");
      expect(computeDropPosition({ ...input, pointerY: 200 })).toBe("below");
    });

    it("threshold boundaries are exclusive (exactly on the line = into)", () => {
      const input = { rect: rect(0, 200), isContainer: true };
      expect(computeDropPosition({ ...input, pointerY: 50 })).toBe("into");
      expect(computeDropPosition({ ...input, pointerY: 150 })).toBe("into");
    });

    it("caps the edge threshold at 50px for tall containers", () => {
      // height 400 -> 25% would be 100, but the cap keeps it at 50
      const input = { rect: rect(0, 400), isContainer: true };
      expect(computeDropPosition({ ...input, pointerY: 49 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 60 })).toBe("into");
      expect(computeDropPosition({ ...input, pointerY: 340 })).toBe("into");
      expect(computeDropPosition({ ...input, pointerY: 351 })).toBe("below");
    });

    it("handles tiny rects (threshold = 25% of height)", () => {
      // height 8 -> threshold 2
      const input = { rect: rect(100, 8), isContainer: true };
      expect(computeDropPosition({ ...input, pointerY: 101 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 104 })).toBe("into");
      expect(computeDropPosition({ ...input, pointerY: 107 })).toBe("below");
    });

    it("respects a non-zero rect top offset", () => {
      const input = { rect: rect(1000, 200), isContainer: true };
      expect(computeDropPosition({ ...input, pointerY: 1010 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 1100 })).toBe("into");
      expect(computeDropPosition({ ...input, pointerY: 1190 })).toBe("below");
    });

    it("treats a missing/null fieldName as 'children'", () => {
      expect(
        computeDropPosition({
          pointerY: 100,
          rect: rect(0, 200),
          isContainer: true,
          fieldName: null,
        })
      ).toBe("into");
    });
  });

  describe("leaf targets (simple halves)", () => {
    it("top half = above, bottom half (incl. exact middle) = below", () => {
      const input = { rect: rect(0, 100), isContainer: false };
      expect(computeDropPosition({ ...input, pointerY: 0 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 49.9 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 50 })).toBe("below");
      expect(computeDropPosition({ ...input, pointerY: 100 })).toBe("below");
    });

    it("never returns 'into' for leaves, even with a specialized fieldName", () => {
      expect(
        computeDropPosition({
          pointerY: 50,
          rect: rect(0, 100),
          isContainer: false,
          fieldName: "left",
        })
      ).toBe("below");
    });

    it("handles zero-height rects", () => {
      const input = { rect: rect(10, 0), isContainer: false };
      expect(computeDropPosition({ ...input, pointerY: 9 })).toBe("above");
      expect(computeDropPosition({ ...input, pointerY: 10 })).toBe("below");
    });
  });
});
