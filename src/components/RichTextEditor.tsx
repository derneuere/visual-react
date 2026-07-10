import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { RichTextEditor as MantineRichTextEditor } from "@mantine/tiptap";

type ToolbarControl =
  | "bold"
  | "italic"
  | "link"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "code"
  | "blockquote"
  | "strikethrough";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  toolbar?: ToolbarControl[];
}

const controlMap: Record<ToolbarControl, React.FC> = {
  bold: MantineRichTextEditor.Bold,
  italic: MantineRichTextEditor.Italic,
  strikethrough: MantineRichTextEditor.Strikethrough,
  code: MantineRichTextEditor.Code,
  heading: MantineRichTextEditor.H2,
  bulletList: MantineRichTextEditor.BulletList,
  orderedList: MantineRichTextEditor.OrderedList,
  blockquote: MantineRichTextEditor.Blockquote,
  link: MantineRichTextEditor.Link,
};

const defaultToolbar: ToolbarControl[] = ["bold", "italic"];

export function RichTextEditor({ value, onChange, toolbar }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    shouldRerenderOnTransaction: true,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const activeToolbar = toolbar || defaultToolbar;

  return (
    <MantineRichTextEditor editor={editor}>
      <MantineRichTextEditor.Toolbar>
        <MantineRichTextEditor.ControlsGroup>
          {activeToolbar.map((control) => {
            const Control = controlMap[control];
            return Control ? <Control key={control} /> : null;
          })}
        </MantineRichTextEditor.ControlsGroup>
      </MantineRichTextEditor.Toolbar>

      <MantineRichTextEditor.Content />
    </MantineRichTextEditor>
  );
}
