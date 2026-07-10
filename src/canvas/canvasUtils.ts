// Pure helpers shared by both sides of the canvas bridge. Kept free of DOM
// and React so they are unit-testable.

import type { Instance } from "../registry/types";
import type { CanvasRect } from "./protocol";

/** Structural check: does this value look like an {@link Instance}? */
export function isInstanceLike(value: unknown): value is Instance {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { id?: unknown; props?: unknown };
  if (typeof v.id !== "string") return false;
  if (typeof v.props !== "object" || v.props === null) return false;
  const instanceId = (v.props as { instanceId?: unknown }).instanceId;
  return typeof instanceId === "string" || typeof instanceId === "number";
}

/** A non-empty array whose every element looks like an {@link Instance}. */
export function isInstanceArray(value: unknown): value is Instance[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every(isInstanceLike)
  );
}

/**
 * Find an instance in a tree by its bridge id (`String(instanceId)`).
 *
 * Registry-free structural walk: any prop value that is an array of
 * Instance-shaped objects is treated as a child list. This matches how
 * visual-react stores container children (componentlist fields hold
 * `Instance[]`) without needing the registry's hasChildren/getChildren —
 * which the iframe side does not always have when content is pushed in.
 */
export function findInstanceByBridgeId(
  content: Instance[],
  bridgeId: string
): Instance | null {
  for (const instance of content) {
    if (String(instance.props.instanceId) === bridgeId) return instance;
    for (const value of Object.values(instance.props)) {
      if (isInstanceArray(value)) {
        const found = findInstanceByBridgeId(value, bridgeId);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Clamp an iframe-viewport-relative rect to the iframe's client box.
 * Returns null when the rect lies fully outside the viewport.
 *
 * Used for virtual dnd droppable proxies: dnd-kit measures
 * getBoundingClientRect (clipping is ignored), so an unclamped off-screen
 * rect would catch pointer hits outside the visible canvas.
 */
export function clampRectToViewport(
  rect: CanvasRect,
  viewport: { width: number; height: number }
): CanvasRect | null {
  const top = Math.max(rect.top, 0);
  const left = Math.max(rect.left, 0);
  const bottom = Math.min(rect.top + rect.height, viewport.height);
  const right = Math.min(rect.left + rect.width, viewport.width);
  if (bottom - top <= 0 || right - left <= 0) return null;
  return { top, left, width: right - left, height: bottom - top };
}
