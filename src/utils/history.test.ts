import { describe, it, expect } from "vitest";
import {
  applyHistoryChange,
  clearHistory,
  createHistory,
  redoHistory,
  undoHistory,
  DEFAULT_HISTORY_LIMIT,
} from "./history";

describe("createHistory", () => {
  it("starts with empty stacks", () => {
    const h = createHistory("a");
    expect(h.present).toBe("a");
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
  });
});

describe("applyHistoryChange", () => {
  it("pushes the previous present onto the undo stack", () => {
    let h = createHistory("a");
    h = applyHistoryChange(h, "b");
    h = applyHistoryChange(h, "c");
    expect(h.present).toBe("c");
    expect(h.past).toEqual(["a", "b"]);
    expect(h.future).toEqual([]);
  });

  it("is a no-op (same reference) for a reference-equal next value", () => {
    const h = applyHistoryChange(createHistory("a"), "b");
    expect(applyHistoryChange(h, h.present)).toBe(h);
  });

  it("clears the redo stack (redo invalidation on new mutation)", () => {
    let h = createHistory("a");
    h = applyHistoryChange(h, "b");
    h = applyHistoryChange(h, "c");
    h = undoHistory(h); // back to "b", future ["c"]
    expect(h.future).toEqual(["c"]);
    h = applyHistoryChange(h, "d");
    expect(h.present).toBe("d");
    expect(h.past).toEqual(["a", "b"]);
    expect(h.future).toEqual([]);
    // "c" is gone for good
    expect(redoHistory(h)).toBe(h);
  });

  it("enforces the depth limit by dropping the oldest snapshots", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 7; i++) {
      h = applyHistoryChange(h, i, { limit: 3 });
    }
    expect(h.present).toBe(7);
    expect(h.past).toEqual([4, 5, 6]);
    // undo bottoms out at the oldest retained snapshot
    h = undoHistory(h);
    h = undoHistory(h);
    h = undoHistory(h);
    expect(h.present).toBe(4);
    expect(undoHistory(h)).toBe(h);
  });

  it("defaults the limit to DEFAULT_HISTORY_LIMIT", () => {
    let h = createHistory(0);
    for (let i = 1; i <= DEFAULT_HISTORY_LIMIT + 25; i++) {
      h = applyHistoryChange(h, i);
    }
    expect(h.past.length).toBe(DEFAULT_HISTORY_LIMIT);
    expect(h.past[0]).toBe(25);
  });

  describe("coalescing", () => {
    it("collapses rapid same-key changes into one undo step", () => {
      let h = createHistory("");
      h = applyHistoryChange(h, "H", { coalesceKey: "k", now: 1000 });
      h = applyHistoryChange(h, "He", { coalesceKey: "k", now: 1200 });
      h = applyHistoryChange(h, "Hey", { coalesceKey: "k", now: 1400 });
      expect(h.present).toBe("Hey");
      expect(h.past).toEqual([""]);
      h = undoHistory(h);
      expect(h.present).toBe("");
    });

    it("starts a new step when the window elapses", () => {
      let h = createHistory("");
      h = applyHistoryChange(h, "a", { coalesceKey: "k", now: 1000 });
      h = applyHistoryChange(h, "ab", { coalesceKey: "k", now: 1501 });
      expect(h.past).toEqual(["", "a"]);
    });

    it("keeps coalescing while every step stays inside the window", () => {
      // The window is measured from the LAST change, not the first — a
      // steady typing burst longer than the window is still one step.
      let h = createHistory("");
      h = applyHistoryChange(h, "a", { coalesceKey: "k", now: 1000 });
      h = applyHistoryChange(h, "ab", { coalesceKey: "k", now: 1400 });
      h = applyHistoryChange(h, "abc", { coalesceKey: "k", now: 1800 });
      expect(h.past).toEqual([""]);
    });

    it("does not coalesce across different keys", () => {
      let h = createHistory("");
      h = applyHistoryChange(h, "a", { coalesceKey: "k1", now: 1000 });
      h = applyHistoryChange(h, "b", { coalesceKey: "k2", now: 1100 });
      expect(h.past).toEqual(["", "a"]);
    });

    it("does not coalesce with keyless changes on either side", () => {
      let h = createHistory("");
      h = applyHistoryChange(h, "a", { coalesceKey: "k", now: 1000 });
      h = applyHistoryChange(h, "b", { now: 1100 });
      h = applyHistoryChange(h, "c", { now: 1200 });
      expect(h.past).toEqual(["", "a", "b"]);
    });

    it("does not coalesce across an undo", () => {
      let h = createHistory("");
      h = applyHistoryChange(h, "a", { coalesceKey: "k", now: 1000 });
      h = undoHistory(h);
      h = applyHistoryChange(h, "b", { coalesceKey: "k", now: 1100 });
      // the undo broke the burst: "b" got its own step on top of ""
      expect(h.present).toBe("b");
      expect(h.past).toEqual([""]);
      expect(h.future).toEqual([]);
    });
  });
});

describe("undoHistory / redoHistory", () => {
  it("round-trips through undo and redo", () => {
    let h = createHistory("a");
    h = applyHistoryChange(h, "b");
    h = applyHistoryChange(h, "c");

    h = undoHistory(h);
    expect(h.present).toBe("b");
    h = undoHistory(h);
    expect(h.present).toBe("a");
    expect(h.future).toEqual(["b", "c"]);

    h = redoHistory(h);
    expect(h.present).toBe("b");
    h = redoHistory(h);
    expect(h.present).toBe("c");
    expect(h.past).toEqual(["a", "b"]);
    expect(h.future).toEqual([]);
  });

  it("undo on an empty past is a no-op (same reference)", () => {
    const h = createHistory("a");
    expect(undoHistory(h)).toBe(h);
  });

  it("redo on an empty future is a no-op (same reference)", () => {
    const h = applyHistoryChange(createHistory("a"), "b");
    expect(redoHistory(h)).toBe(h);
  });
});

describe("clearHistory", () => {
  it("drops both stacks and keeps present", () => {
    let h = createHistory("a");
    h = applyHistoryChange(h, "b");
    h = applyHistoryChange(h, "c");
    h = undoHistory(h);
    const cleared = clearHistory(h);
    expect(cleared.present).toBe("b");
    expect(cleared.past).toEqual([]);
    expect(cleared.future).toEqual([]);
  });

  it("is a no-op (same reference) when already empty", () => {
    const h = createHistory("a");
    expect(clearHistory(h)).toBe(h);
  });
});
