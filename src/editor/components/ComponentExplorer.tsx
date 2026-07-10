import React from "react";
import { useComponentRegistry } from "../../registry/hooks";
import { Draggable } from "../../components/Draggable";

export interface ComponentExplorerProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ComponentExplorer: React.FC<ComponentExplorerProps> = ({ 
  className, 
  style 
}) => {
  const { getAllRegisteredComponents, getComponentById } = useComponentRegistry();
  const components = getAllRegisteredComponents();

  return (
    <div className={className} style={style}>
      <h3>Available Components</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {components.map((id) => {
          const component = getComponentById(id);
          return (
            <div key={id}>
              <Draggable id={id} add={true}>
                {component?.metadata.name || id}
              </Draggable>
            </div>
          );
        })}
      </div>
    </div>
  );
};