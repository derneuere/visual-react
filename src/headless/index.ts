// Headless editor building blocks (react-only; the dnd-kit-dependent hooks
// live in the "./editor/dnd" entry — see ../editor-dnd.ts).
export {
  useInstanceFields,
  type EditableInstanceField,
} from "./useInstanceFields";
export {
  computeInstanceFields,
  fieldTypeName,
  isPropertyVisible,
  type FieldTypeName,
  type InstanceField,
} from "./instanceFields";
export { useInstancePath } from "./useInstancePath";
export {
  useEditorHistory,
  type UseEditorHistoryResult,
} from "./useEditorHistory";
export {
  createPageRoot,
  unwrapPageRoot,
  isPageRoot,
  pageRootMetadata,
  PAGE_ROOT_COMPONENT_ID,
  PAGE_ROOT_INSTANCE_ID,
} from "./pageRoot";
