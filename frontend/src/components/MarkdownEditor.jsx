import MarkdownViewer from './MarkdownViewer';

export default function MarkdownEditor({ value = '', onChange, placeholder, minHeight = '120px', id, className = '' }) {
  return (
    <div className={className}>
      <textarea
        id={id}
        className="textarea w-full font-mono text-sm"
        style={{ minHeight }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-2 rounded-lg border border-border overflow-hidden">
        <div className="px-2 py-1.5 bg-input/50 border-b border-border text-2xs text-text-muted font-medium">
          Live preview
        </div>
        <div className="p-3 min-h-[80px] text-sm text-text-secondary markdown-body">
          {value ? <MarkdownViewer content={value} /> : <span className="text-text-muted italic">Nothing to preview yet.</span>}
        </div>
      </div>
    </div>
  );
}
