// The canvas iframe route — loaded by the editor's CanvasHost (/editor).
// Bare page: it renders NOTHING until the parent editor pushes content
// through the bridge, and it renders through the same registry/renderer as
// the public pages (StaticModeProvider = no dnd editing controls), so what
// you see in the canvas is exactly the published markup.
import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useComponentRegistry,
  StaticModeProvider,
} from "@derneuere/visual-react";
import { CanvasBridge } from "@derneuere/visual-react/canvas";
import { ComponentRenderer } from "@derneuere/visual-react/editor";

function CanvasFrame() {
  const { hasChildren, getComponentProps } = useComponentRegistry();
  return (
    <CanvasBridge
      isContainer={hasChildren}
      getInstanceLabel={(instance) =>
        getComponentProps(instance.id)?.name ?? instance.id
      }
      renderPage={({ content }) => (
        <StaticModeProvider>
          {/* <main> doubles as the bridge's page-area fallback rect for
              root-level "into" drop indicators (pageAreaSelector default). */}
          <main>
            <ComponentRenderer items={content} notEditable />
          </main>
        </StaticModeProvider>
      )}
    />
  );
}

export const Route = createFileRoute("/canvas-frame")({
  component: CanvasFrame,
});
