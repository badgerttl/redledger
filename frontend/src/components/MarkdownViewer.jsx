import { useState, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import { Copy, Check } from 'lucide-react';
import { isStructuredContent, formatStructuredContent } from '../utils/formatContent';

import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';

const LANGUAGE_LABELS = {
  bash: 'Bash',
  shell: 'Shell',
  sh: 'Shell',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  python: 'Python',
  py: 'Python',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  xml: 'XML',
  markup: 'Markup',
  text: 'Text',
  plaintext: 'Text',
};

const LANGUAGE_ALIASES = {
  ps1: 'powershell',
  shell: 'bash',
  sh: 'bash',
  xml: 'markup',
};

function normalizeLanguage(language) {
  const normalized = (language || '').toLowerCase();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

function slugifyHeading(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Recursively extract plain text from a React node tree. */
function extractText(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children) return extractText(node.props.children);
  return '';
}

function getCodeLanguage(children) {
  const child = Array.isArray(children) ? children[0] : children;
  const className = child?.props?.className || '';
  const match = className.match(/language-([\w-]+)/);
  return match?.[1] || '';
}

/** Code block wrapper with copy button shown on hover. */
function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const language = getCodeLanguage(children);
  const label = LANGUAGE_LABELS[language] || language;

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
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        {label && (
          <span className="rounded-md border border-border bg-card px-2 py-1 text-2xs font-medium uppercase tracking-wide text-text-muted">
            {label}
          </span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          data-guide-search-ignore
          className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-2xs font-medium text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary hover:border-text-muted"
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
    </div>
  );
}

function Code({ inline, className, children, ...props }) {
  const match = /language-([\w-]+)/.exec(className || '');
  const rawLanguage = match?.[1] || '';
  const language = normalizeLanguage(rawLanguage);
  const code = String(children).replace(/\n$/, '');

  if (!inline && rawLanguage) {
    const grammar = Prism.languages[language];
    if (!grammar) {
      return <code className={className} {...props}>{children}</code>;
    }

    try {
      const highlighted = Prism.highlight(code, grammar, language);
      return (
        <code
          className={`language-${rawLanguage}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
          {...props}
        />
      );
    } catch {
      return <code className={className} {...props}>{children}</code>;
    }
  }

  return <code className={className} {...props}>{children}</code>;
}

function headingId(children) {
  return slugifyHeading(extractText(children));
}

const headingClassName = 'scroll-mt-24';

function H1({ children, ...props }) {
  return <h1 id={headingId(children)} className={headingClassName} {...props}>{children}</h1>;
}

function H2({ children, ...props }) {
  return <h2 id={headingId(children)} className={headingClassName} {...props}>{children}</h2>;
}

function H3({ children, ...props }) {
  return <h3 id={headingId(children)} className={headingClassName} {...props}>{children}</h3>;
}

function H4({ children, ...props }) {
  return <h4 id={headingId(children)} className={headingClassName} {...props}>{children}</h4>;
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
    code: Code,
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
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
