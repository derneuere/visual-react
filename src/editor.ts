/**
 * "@derneuere/visual-react/editor" — the visual editing surface.
 *
 * Everything exported here depends on at least one of the optional peer
 * dependencies (@mantine/*, @tabler/icons-react, @tiptap/*, @dnd-kit/*,
 * @tanstack/react-query, react-error-boundary). Install those before
 * importing from this entry, and import the stylesheet once:
 *
 *   import "@derneuere/visual-react/editor.css";
 *
 * The headless core (state, registry, storage, utils) lives in the root
 * entry "@derneuere/visual-react" and only needs react/react-dom.
 */

// The full Mantine editor chrome
export { Editor } from './editor/editor';

// Editor chrome building blocks (sidebars, modals, page chrome)
export {
  ComponentExplorer,
  type ComponentExplorerProps,
  ComponentExplorerModal,
  CurrentPage,
  LeftSidebar,
  RightSidebar,
  TopBar,
  EditingTab,
  TreeFileHandler,
  CreatePageModal,
  DeletePageConfirmModal,
  SaveAsTemplateModal,
  Breadcrumb,
  EditComponentModal,
  ComponentTree,
} from './editor/components';

// Render pieces used inside editable pages. These are not in the core entry
// because they pull in dnd-kit, @tabler/icons-react and react-error-boundary
// (ComponentRenderer renders SortableItem for its editing controls).
export { ComponentRenderer, type ComponentRendererProps } from './components/ComponentRenderer';
// (WrapInstanceProvider / useWrapInstance / the WrapInstance type live in the
// core entry — they are react-only and also serve custom render paths.)
export { Block } from './components/Block';
export { SortableItem, type SortableItemProps } from './components/SortableItem';
export { Draggable, type DraggableProps } from './components/Draggable';

// Rich text editing (tiptap + @mantine/tiptap)
export { RichTextEditor } from './components/RichTextEditor';
