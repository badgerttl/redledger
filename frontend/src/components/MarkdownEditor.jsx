/**
 * Markdown source editor — plain textarea that stores raw markdown.
 * The user sees and edits the markdown syntax directly (like Obsidian source mode).
 * Rendering happens in MarkdownViewer once saved.
 */
export default function MarkdownEditor({ value = '', onChange, placeholder, minHeight = '120px', id, className = '' }) {
  return (
    <textarea
      id={id}
      className={`textarea font-mono text-sm leading-relaxed ${className}`}
      style={{ minHeight }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Write markdown here…\n# Heading\n**bold**  *italic*  `code`\n[link](https://…)'}
      spellCheck={false}
    />
  );
}
