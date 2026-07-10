import { useState } from "react";
import { SegmentedControl } from "@mantine/core";
import Navigation from "./Navigation";
import ComponentTree from "./ComponentTree";

interface LeftSidebarProps {
  onNavigate?: (path: string) => void;
}

function LeftSidebar({ onNavigate }: LeftSidebarProps) {
  const [view, setView] = useState<string>("pages");

  return (
    <div
      className="vr-chrome"
      style={{
        width: "220px",
        height: "100%",
        borderRight: "1px solid var(--mantine-color-gray-3)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "8px 8px 0" }}>
        <SegmentedControl
          size="xs"
          fullWidth
          value={view}
          onChange={(val) => setView(val)}
          data={[
            { label: "Pages", value: "pages" },
            { label: "Layers", value: "layers" },
          ]}
        />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {view === "pages" ? (
          <Navigation onNavigate={onNavigate} />
        ) : (
          <ComponentTree />
        )}
      </div>
    </div>
  );
}

export default LeftSidebar;
