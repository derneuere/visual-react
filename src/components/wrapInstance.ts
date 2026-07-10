import { createContext, useContext, type ReactNode } from "react";
import type { Instance } from "../registry/types";

/**
 * Render-path hook: wraps each rendered instance in extra markup (e.g. a
 * `<div data-instance-id>` hit-target for an iframe canvas overlay).
 *
 * When no wrapper is provided (the default), the render path is byte-for-byte
 * identical to a build without this feature — there is zero overhead and the
 * rendered output (incl. SSR HTML) is unchanged.
 */
export type WrapInstance = (instance: Instance, rendered: ReactNode) => ReactNode;

const WrapInstanceContext = createContext<WrapInstance | undefined>(undefined);

/**
 * Provides a {@link WrapInstance} wrapper to every ComponentRenderer beneath
 * it — including renderers nested inside container components (which render
 * their children via Block/ComponentRenderer and cannot forward props).
 */
export const WrapInstanceProvider = WrapInstanceContext.Provider;

/** The wrapper provided by the nearest {@link WrapInstanceProvider}, if any. */
export const useWrapInstance = (): WrapInstance | undefined =>
  useContext(WrapInstanceContext);
