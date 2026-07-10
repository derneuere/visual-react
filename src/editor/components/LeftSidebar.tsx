// LeftSidebar — Pages (page management, carried over) | Build (component
// palette on top, layer tree below). The palette entries drag onto the
// canvas iframe / layer tree; the tree offers selection, move buttons, a
// context menu and drop targets.
import { useState } from "react";
import { SegmentedControl, Divider } from "@mantine/core";
import Navigation from "./Navigation";
import ComponentTree from "./ComponentTree";
import { ComponentPalette } from "./ComponentPalette";
import { useEditorLabels } from "../labels";

interface LeftSidebarProps {
  onNavigate?: (path: string) => void;
}

function LeftSidebar({ onNavigate }: LeftSidebarProps) {
  const [view, setView] = useState<string>("build");
  const labels = useEditorLabels();

  return (
    <div
      className="vr-chrome"
      style={{
        width: "260px",
        height: "100%",
        borderRight: "1px solid var(--mantine-color-gray-3)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "8px 8px 0" }}>
        <SegmentedControl
          size="xs"
          fullWidth
          value={view}
          onChange={(val) => setView(val)}
          data={[
            { label: labels.buildTab, value: "build" },
            { label: labels.pagesTab, value: "pages" },
          ]}
        />
      </div>
      {view === "pages" ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Navigation onNavigate={onNavigate} />
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Palette (top) — capped height, scrolls independently. */}
          <div style={{ maxHeight: "45%", overflowY: "auto", flexShrink: 0 }}>
            <ComponentPalette />
          </div>
          <Divider />
          {/* Layer tree (bottom) — fills the remaining height. */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "6px 8px 0",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#868e96",
                flexShrink: 0,
              }}
            >
              {labels.layersHeading}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ComponentTree />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeftSidebar;
