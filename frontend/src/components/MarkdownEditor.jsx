import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

export default function MarkdownEditor({ value = '', onChange, placeholder, minHeight = '120px', id, className = '' }) {
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: value,
    onUpdate({ editor }) {
      isInternalUpdate.current = true;
      onChange(editor.storage.markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
        style: `min-height: ${minHeight}; padding: 0.75rem;`,
      },
    },
  });

  // Sync external value changes (template load, reset, etc.)
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const current = editor.storage.markdown.getMarkdown();
    if (value !== current) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  return (
    <div className={`tiptap-editor rounded-lg border border-border bg-input text-sm text-text-secondary focus-within:border-accent/50 transition-colors ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}
