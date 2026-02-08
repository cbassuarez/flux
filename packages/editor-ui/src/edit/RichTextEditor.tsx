import { useEffect, useMemo, useRef, useState } from "react";
import { Node, type Editor as EditorInstance, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Code from "@tiptap/extension-code";
import Link from "@tiptap/extension-link";
import History from "@tiptap/extension-history";
import type { DocumentNode } from "@flux-lang/core";
import { fluxTextToTiptap, type InlineSlotAttrs } from "./richText";
import { Button } from "./components/ui/Button";

type RichTextEditorProps = {
  node: DocumentNode;
  onUpdate: (json: JSONContent) => void;
  onInlineSlotSelect: (id: string | null) => void;
  onReady?: (editor: EditorInstance | null) => void;
  hydrationKey: string;
  allowHydrate: boolean;
  onDirty?: () => void;
  initialText: string;
  highlightQuery?: string;
};

const InlineSlot = Node.create({
  name: "inlineSlot",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: null },
      text: { default: "" },
      reserve: { default: "" },
      fit: { default: "" },
      refresh: { default: "" },
      transition: { default: "" },
      textId: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-inline-slot]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, "data-inline-slot": "true" }, 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineSlotView);
  },
});

function InlineSlotView(props: any) {
  const { node, selected, editor, getPos } = props;
  const attrs = node.attrs as InlineSlotAttrs;
  return (
    <NodeViewWrapper
      as="span"
      className={`inline-slot-pill ${selected ? "is-selected" : ""}`}
      data-inline-slot="true"
      data-inline-slot-id={attrs.id ?? ""}
      contentEditable={false}
      onClick={(event) => {
        event.preventDefault();
        if (typeof getPos === "function") {
          editor.commands.setNodeSelection(getPos());
        }
      }}
    >
      <span className="inline-slot-pill__text">{attrs.text || "slot"}</span>
      {attrs.reserve ? <span className="inline-slot-pill__meta">{attrs.reserve}</span> : null}
    </NodeViewWrapper>
  );
}

export default function RichTextEditor({
  node,
  onUpdate,
  onInlineSlotSelect,
  onReady,
  hydrationKey,
  allowHydrate,
  onDirty,
  initialText,
  highlightQuery,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const isHydrating = useRef(false);

  const content = useMemo(() => fluxTextToTiptap(node), [node]);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Code,
      History,
      Link.configure({ autolink: false, openOnClick: false }),
      InlineSlot,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (isHydrating.current) return;
      onDirty?.();
      onUpdate(editor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    if (!allowHydrate) return;
    isHydrating.current = true;
    editor.commands.setContent(content);
    const timer = window.setTimeout(() => {
      isHydrating.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor, content, allowHydrate, hydrationKey]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getText().trim();
    if (!current && initialText) {
      isHydrating.current = true;
      editor.commands.setContent(content);
      const timer = window.setTimeout(() => {
        isHydrating.current = false;
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [editor, initialText, content, hydrationKey]);

  useEffect(() => {
    if (!editor) return;
    const handleSelection = () => {
      const selection: any = editor.state.selection;
      if (selection?.node?.type?.name === "inlineSlot") {
        onInlineSlotSelect(selection.node.attrs?.id ?? null);
        return;
      }
      onInlineSlotSelect(null);
    };
    editor.on("selectionUpdate", handleSelection);
    return () => {
      editor.off("selectionUpdate", handleSelection);
    };
  }, [editor, onInlineSlotSelect]);

  useEffect(() => {
    if (!editor || !highlightQuery) return;
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n");
    const index = text.toLowerCase().indexOf(highlightQuery.toLowerCase());
    if (index < 0) return;
    const range = resolveTextRange(editor, index, highlightQuery.length);
    if (range) {
      editor.commands.setTextSelection(range);
    }
  }, [editor, highlightQuery]);

  if (!editor) {
    return <div className="editor-loading">Loading text editor…</div>;
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`toolbar-btn ${editor.isActive("code") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          Code
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`toolbar-btn ${editor.isActive("link") ? "is-active" : ""}`}
          onClick={() => {
            const href = editor.getAttributes("link").href ?? "";
            setLinkValue(href);
            setLinkOpen((open) => !open);
          }}
        >
          Link
        </Button>
        {editor.isActive("link") ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="toolbar-btn"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            Unlink
          </Button>
        ) : null}
        {linkOpen ? (
          <div className="toolbar-link">
            <input
              className="toolbar-input"
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              placeholder="https://"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="toolbar-btn"
              onClick={() => {
                if (linkValue.trim()) {
                  editor.chain().focus().extendMarkRange("link").setLink({ href: linkValue.trim() }).run();
                } else {
                  editor.chain().focus().unsetLink().run();
                }
                setLinkOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        ) : null}
      </div>
      <div className="rich-text-surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function resolveTextRange(editor: EditorInstance, startOffset: number, length: number) {
  let from = 0;
  let to = 0;
  let offset = 0;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text ?? "";
    const end = offset + text.length;
    if (startOffset >= offset && startOffset <= end) {
      from = pos + (startOffset - offset);
      to = from + length;
      return false;
    }
    offset = end;
  });

  if (from && to) return { from, to };
  return null;
}
