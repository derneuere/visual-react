// Editor types
import { ReactNode } from 'react';
import { Instance } from '../registry/types';

/**
 * Canvas view mode of the bundled editor: structural editing, or a
 * device-true preview (Desktop | Mobile) rendered by the same canvas iframe.
 */
export type EditorViewMode = 'edit' | 'desktop' | 'mobile';

// Context value type
export interface EditorContextValue {
  selectedInstanceId: number | string | null;
  setSelectedInstanceId: React.Dispatch<
    React.SetStateAction<number | string | null>
  >;
  draggedInstanceId: number | string | null;
  setDraggedInstanceId: React.Dispatch<
    React.SetStateAction<number | string | null>
  >;
  dropTarget: {
    id: number | string | null;
    fieldName: string | null;
    position?: 'above' | 'below' | 'into'; // Indicates where the item will be placed
  } | null;
  setDropTarget: React.Dispatch<
    React.SetStateAction<{
      id: number | string | null;
      fieldName: string | null;
      position?: 'above' | 'below' | 'into';
    } | null>
  >;
  isPreview: boolean;
  setIsPreview: React.Dispatch<React.SetStateAction<boolean>>;
  isModalOpen: boolean;
  setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAbove: boolean;
  setIsAbove: React.Dispatch<React.SetStateAction<boolean>>;
  clipboard: Instance | null;
  setClipboard: React.Dispatch<React.SetStateAction<Instance | null>>;
  editModalOpen: boolean;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pageSettingsOpen: boolean;
  setPageSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// Provider props type
export interface EditorProviderProps {
  children: ReactNode;
}