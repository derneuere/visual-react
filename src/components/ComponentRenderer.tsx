// ComponentRenderer — renders a list of instances through the registry.
//
// This is the STATIC render path shared by public pages, the canvas iframe
// (CanvasBridge) and static exports. Since 0.4.0 it renders no editing
// chrome at all — the in-document SortableItem editing mode was removed;
// editing happens in the canvas-only editor, which renders pages through
// this same component inside the iframe.
import React from "react";
import { useComponentRegistry } from "../registry/hooks";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorInfo } from "react";
import { Instance } from "../registry/types";
import { useWrapInstance, type WrapInstance } from "./wrapInstance";

export interface ComponentRendererProps {
  items: Instance[];
  /**
   * @deprecated No-op since 0.4.0 — the renderer is always non-editing.
   * Kept so existing call sites keep compiling.
   */
  notEditable?: boolean;
  /**
   * Optional hook to wrap each rendered instance (e.g. to tag the DOM with
   * data-instance-id for an iframe canvas). Falls back to the nearest
   * WrapInstanceProvider so it propagates through nested containers.
   * Zero cost and unchanged output when neither is set.
   */
  wrapInstance?: WrapInstance;
}

// Define a type that ensures Component types accept instanceId in their props
type ComponentWithInstanceId = React.ComponentType<any & { instanceId: string | number }>

export const ComponentRenderer: React.FC<ComponentRendererProps> = ({
  items,
  wrapInstance,
}) => {
  const { getComponentById } = useComponentRegistry();
  const contextWrapInstance = useWrapInstance();
  const wrap = wrapInstance ?? contextWrapInstance;

  return items
    .map((instance: Instance) => {
      const componentEntry = getComponentById(instance.id);
      if (!componentEntry) return null;

      const Component = componentEntry.Component as ComponentWithInstanceId;

      const logError = (error: Error, info: ErrorInfo) => {
        console.error(`Error in component ${instance.id}:`, error);
        console.error('Component stack:', info.componentStack ?? 'N/A');
      };

      // Enhanced fallback component for component errors
      const ComponentErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => (
        <div style={{
          padding: '10px',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          background: 'rgba(255,107,107,0.1)',
          margin: '10px 0'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ff6b6b' }}>Component Error: {instance.id}</h4>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{error.message}</p>
          <pre style={{
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '200px',
            background: 'rgba(0,0,0,0.03)',
            padding: '8px',
            borderRadius: '2px'
          }}>
            {error.stack}
          </pre>
          <button
            onClick={resetErrorBoundary}
            style={{
              background: '#228be6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Try Again
          </button>
        </div>
      );

      const rendered = (
        <ErrorBoundary
          key={instance.props.instanceId}
          onError={logError}
          FallbackComponent={ComponentErrorFallback}
          resetKeys={[instance.id, JSON.stringify(instance.props)]}
        >
          {Component && <Component {...instance.props} />}
        </ErrorBoundary>
      );

      // Zero-cost when no wrapper is configured: the exact pre-existing
      // element is returned untouched.
      return wrap ? (
        <React.Fragment key={instance.props.instanceId}>
          {wrap(instance, rendered)}
        </React.Fragment>
      ) : (
        rendered
      );
    })
    .filter(Boolean); // Remove null values
};
