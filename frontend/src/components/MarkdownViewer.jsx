import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isStructuredContent, formatStructuredContent } from '../utils/formatContent';

export default function MarkdownViewer({ content }) {
  const text = content || '';
  if (isStructuredContent(text)) {
    return (
      <pre className="bg-input p-4 rounded-lg overflow-x-auto text-xs font-mono text-text-secondary whitespace-pre-wrap markdown-body">
        {formatStructuredContent(text)}
      </pre>
    );
  }
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
