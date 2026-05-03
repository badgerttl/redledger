import { useState, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { isStructuredContent, formatStructuredContent } from '../utils/formatContent';

/** Recursively extract plain text from a React node tree. */
function extractText(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children) return extractText(node.props.children);
  return '';
}

/** Code block wrapper with copy button shown on hover. */
function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractText(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text in the pre element
    }
  };

  return (
    <div className="relative group">
      <pre {...props}>{children}</pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-2xs font-medium text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary hover:border-text-muted"
        title="Copy code"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-green-400" />
            <span className="text-green-400">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

/** Catches react-markdown / GFM render failures so the app does not white-screen. */
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

function buildComponents(onInternalLink) {
  return {
    pre: CodeBlock,
    a: ({ href, children }) => {
      if (
        onInternalLink &&
        href &&
        !href.startsWith('http') &&
        !href.startsWith('#') &&
        !href.startsWith('mailto:') &&
        href.endsWith('.md')
      ) {
        return (
          <span
            role="button"
            tabIndex={0}
            onClick={() => onInternalLink(href)}
            onKeyDown={(e) => e.key === 'Enter' && onInternalLink(href)}
            className="text-blue-400 underline cursor-pointer hover:opacity-75"
          >
            {children}
          </span>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
  };
}

const DEFAULT_COMPONENTS = buildComponents(null);

export default function MarkdownViewer({ content, onInternalLink }) {
  const text = content || '';
  if (isStructuredContent(text)) {
    return (
      <pre className="bg-input p-4 rounded-lg overflow-x-auto text-xs font-mono text-text-secondary whitespace-pre-wrap markdown-body">
        {formatStructuredContent(text)}
      </pre>
    );
  }
  const components = onInternalLink ? buildComponents(onInternalLink) : DEFAULT_COMPONENTS;
  return (
    <div className="markdown-body">
      <MarkdownErrorBoundary content={text}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {text}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
