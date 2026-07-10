// Registry — public types and registration API
export type {
  ComponentMetadata,
  FieldType,
  Instance,
  LinkValue,
  ValidationResult,
  ValidationSeverity,
  ValidationFunction,
  PropertyGroup,
  PropertyCondition,
  ComponentRegistryEntry,
  ComponentRegistry,
  EditingExtensionProps,
  EditingExtensionRegistry,
} from './registry/types';
export type { ComponentRegistryContextValue } from './registry/provider';
export { ComponentRegistryProvider } from './registry/provider';
export { useComponentRegistry } from './registry/hooks';

// Editor state — provider, hook, and keyboard shortcuts (headless; the
// Mantine-based editor UI lives in the "@derneuere/visual-react/editor" entry)
export type { EditorContextValue } from './editor/types';
export { EditorProvider } from './editor/provider';
export { useEditor } from './editor/hooks';
export { useEditorKeyboardShortcuts } from './editor/useEditorKeyboardShortcuts';

// Render-path instrumentation — wrap each rendered instance (e.g. tag the
// DOM for an iframe canvas). React-only; consumed by ComponentRenderer in
// the "/editor" entry.
export {
  WrapInstanceProvider,
  useWrapInstance,
  type WrapInstance,
} from './components/wrapInstance';

// Public headless components for building visual pages
export { ComponentLoader } from './components/ComponentLoader';
export { ContentTag } from './components/ContentTag';
export type { ContentTagProps } from './components/ContentTag';

// Storage — interface, adapters, and migration
export type { StorageAdapter, PageData, PageMeta } from './storage/types';
export { StorageAdapterProvider } from './storage/provider';
export type { StorageAdapterProviderProps } from './storage/provider';
export { useStorageAdapter } from './storage/hooks';
export { FetchStorageAdapter } from './storage/FetchStorageAdapter';
export { GitHubStorageAdapter } from './storage/GitHubStorageAdapter';
export { migratePageData } from './storage/migration';

// Auth — context, provider, and hook
export type { AuthContextValue } from './auth/types';
export { AuthProvider } from './auth/Provider';
export { useAuth } from './auth/hooks';

// Static mode
export { StaticModeProvider } from './static/provider';
export { useStaticMode } from './static/hooks';

// Templates — public types and built-ins
export type { PageTemplate } from './templates';
export { builtInTemplates, TEMPLATES_FOLDER } from './templates';

// Utils — pure tree/page helpers and storage configuration
export * from './utils';
