import { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isStructuredContent, formatStructuredContent } from '../utils/formatContent';

/** Catches react-markdown / GFM render failures (e.g. odd edge-case markdown) so the app does not white-screen. */
class MarkdownErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.content !== this.props.content) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      const text = this.props.content || '';
      return (
        <pre className="rounded-xl border border-border bg-input p-3 text-sm whitespace-pre-wrap break-words text-text-secondary">
          {text}
        </pre>
      );
    }
    return this.props.children;
  }
}

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
      <MarkdownErrorBoundary content={text}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
