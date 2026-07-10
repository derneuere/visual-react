/**
 * "@derneuere/visual-react/editor" — the bundled visual editor (Mantine).
 *
 * Since 0.4.0 the editor is CANVAS-ONLY: pages are edited through an iframe
 * canvas (see "@derneuere/visual-react/canvas"), never by rendering editing
 * chrome into the page markup itself. The consumer provides a canvas route
 * mounting CanvasBridge and passes its URL:
 *
 *   <Editor canvasSrc="/canvas-frame" />
 *
 * Everything exported here depends on at least one of the optional peer
 * dependencies (@mantine/*, @tabler/icons-react, @tiptap/*, @dnd-kit/*,
 * @tanstack/react-query, react-error-boundary). Install those before
 * importing from this entry, and import the stylesheet once:
 *
 *   import "@derneuere/visual-react/editor.css";
 *
 * The headless core (state, registry, storage, utils, the headless editor
 * hooks) lives in the root entry "@derneuere/visual-react" and only needs
 * react/react-dom; the dnd hooks live in "./editor/dnd".
 *
 * Removed in 0.4.0 (in-document editing): SortableItem, EditingTab,
 * EditComponentModal, ComponentExplorer, ComponentExplorerModal — see the
 * CHANGELOG's migration table for replacements.
 */

// The full Mantine editor chrome
export { Editor, type EditorProps } from './editor/editor';

// Editor view mode + chrome localization
export type { EditorViewMode } from './editor/types';
export {
  defaultEditorLabels,
  useEditorLabels,
  EditorLabelsProvider,
  type EditorLabels,
} from './editor/labels';

// Editor chrome building blocks (sidebars, modals, page chrome)
export {
  CurrentPage,
  LeftSidebar,
  RightSidebar,
  TopBar,
  type TopBarProps,
  TreeFileHandler,
  CreatePageModal,
  DeletePageConfirmModal,
  SaveAsTemplateModal,
  Breadcrumb,
  ComponentTree,
  ComponentPalette,
  ComponentPickerModal,
  type ComponentPickerModalProps,
  PropertyPanel,
  EditorCanvas,
  type EditorCanvasOptions,
} from './editor/components';

// Render pieces for pages built from container widgets. These are not in
// the core entry because ComponentRenderer pulls in react-error-boundary
// (an optional peer). They render NO editing chrome since 0.4.0 — the same
// markup serves public pages, static exports and the canvas iframe.
export { ComponentRenderer, type ComponentRendererProps } from './components/ComponentRenderer';
// (WrapInstanceProvider / useWrapInstance / the WrapInstance type live in the
// core entry — they are react-only and also serve custom render paths.)
export { Block } from './components/Block';
export { Draggable, type DraggableProps } from './components/Draggable';

// Rich text editing (tiptap + @mantine/tiptap)
export { RichTextEditor } from './components/RichTextEditor';
