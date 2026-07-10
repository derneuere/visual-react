// Block — the container-children render slot used inside container widgets
// (Sections, columns, ...): `<Block parentId={instanceId} items={children} />`.
//
// Since 0.4.0 this is a pure static renderer everywhere: the public pages,
// static exports AND the editor canvas iframe all render the same markup
// (the iframe's editing affordances are drawn by CanvasBridge's overlay, not
// by the page markup). The old dnd droppable behavior of the in-document
// editing mode was removed; `parentId` and `itemsField` are kept in the
// props so existing widget code keeps compiling (and to leave room for
// future canvas metadata).
import { ComponentRenderer } from "./ComponentRenderer";
import { Instance } from "../registry/types";

interface BlockProps {
  items: Instance[];
  /** The container instance's own instanceId (unused since 0.4.0). */
  parentId?: string | number;
  /** The child field this block renders (unused since 0.4.0). */
  itemsField?: string;
  style?: any;
}

export const Block = ({ items, style }: BlockProps) => {
  return (
    <div style={{ minHeight: 50, ...style }}>
      <ComponentRenderer items={items} />
    </div>
  );
};

export default Block;
