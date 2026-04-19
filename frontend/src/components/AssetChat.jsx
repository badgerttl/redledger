import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Bot, Send, Trash2, Square, StickyNote } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';
import { parseSseLines } from '../assistant/sseUtils';
import { markdownFromSelection, selectionFullyInside } from '../assistant/selectionUtils';
import { ASSISTANT_MODEL_STORAGE_KEY } from '../assistant/storageKeys';

const BOTTOM_THRESHOLD_PX = 80;

function ThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" role="status" aria-label="Thinking">
      <span className="assistant-thinking-dot" />
      <span className="assistant-thinking-dot" />
      <span className="assistant-thinking-dot" />
    </span>
  );
}

function buildSystemPrompt(asset, findings, credentials, notes) {
  const lines = [
    'You are an expert penetration tester assistant embedded in a pentest management tool.',
    'You have been provided the following information about a specific target asset from an active engagement.',
    'Use this context to recommend specific attack vectors, enumeration steps, and testing strategies.',
    'Be technical, specific, and actionable. Reference the known ports, credentials, and prior findings when relevant.',
    '',
    '## Asset Information',
    `- Name: ${asset.name}`,
    `- Type: ${asset.asset_type === 'host' ? 'Host' : 'Web Page'}`,
    `- Target: ${asset.target || 'N/A'}`,
    `- OS: ${asset.os || 'Unknown'}`,
    `- Ports / Services: ${asset.ports_summary || 'None detected'}`,
    `- Tags: ${asset.tags?.map((t) => t.name).join(', ') || 'None'}`,
    '',
    `## Linked Findings (${findings.length})`,
  ];

  if (findings.length === 0) {
    lines.push('- None');
  } else {
    findings.forEach((f) => lines.push(`- [${f.severity}] ${f.title} — ${f.status}`));
  }

  lines.push('', `## Known Credentials (${credentials.length})`);
  if (credentials.length === 0) {
    lines.push('- None');
  } else {
    credentials.forEach((c) =>
      lines.push(`- Username: ${c.username || 'N/A'} | Type: ${c.secret_type} | Access: ${c.access_level || 'N/A'} | Source: ${c.source || 'N/A'}`)
    );
  }

  lines.push('', '## Existing Tester Notes');
  if (notes.length === 0) {
    lines.push('None');
  } else {
    notes.forEach((n) => lines.push(n.body, '', '---', ''));
  }

  return lines.join('\n');
}

/**
 * Embedded LLM chat panel for an asset page.
 *
 * Props:
 *   assetId         — number | string
 *   asset           — asset object (name, asset_type, target, os, ports_summary, tags)
 *   linkedFindings  — array of finding objects
 *   linkedCredentials — array of credential objects
 *   notes           — array of note objects
 *   onNoteAdded     — callback after saving selection as note (triggers parent reload)
 */
export default function AssetChat({ assetId, asset, linkedFindings, linkedCredentials, notes, onNoteAdded }) {
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => localStorage.getItem(ASSISTANT_MODEL_STORAGE_KEY) || '');
  const [modelsLoading, setModelsLoading] = useState(true);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const abortRef = useRef(null);

  const [selectionUi, setSelectionUi] = useState(null);

  // ── Autoscroll ────────────────────────────────────────────────────────────
  const syncStick = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
  }, []);

  useLayoutEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // ── Load chat history from DB when asset changes ─────────────────────────
  useEffect(() => {
    stickRef.current = true;
    setMessages([]);
    api.get(`/chat/asset/${assetId}`)
      .then(({ data }) => setMessages(data))
      .catch(() => {});
  }, [assetId]);

  // ── Load models ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api
      .get('/assistant/models')
      .then(({ data }) => {
        if (cancelled) return;
        const list = data?.data ?? [];
        setModels(list);
        const ids = list.map((m) => m.id).filter(Boolean);
        setModel((prev) => {
          if (prev && ids.includes(prev)) return prev;
          const first = ids[0] || '';
          if (first) localStorage.setItem(ASSISTANT_MODEL_STORAGE_KEY, first);
          return first;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load models — check LLM_PROXY_URL');
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Selection → save as note popover ─────────────────────────────────────
  useEffect(() => {
    const handleMouseUp = (e) => {
      if (
        e.target?.closest?.('textarea') ||
        e.target?.closest?.('input') ||
        e.target?.closest?.('[data-asset-chat-popover]')
      ) return;
      const root = scrollRef.current;
      if (!root) return;
      requestAnimationFrame(() => {
        const sel = document.getSelection();
        if (!sel || sel.rangeCount === 0) { setSelectionUi(null); return; }
        if (!selectionFullyInside(root, sel)) { setSelectionUi(null); return; }
        const text = markdownFromSelection(sel);
        if (!text.trim()) { setSelectionUi(null); return; }
        let range;
        try { range = sel.getRangeAt(0); } catch { setSelectionUi(null); return; }
        const rect = range.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const left = Math.min(window.innerWidth - 100, Math.max(100, centerX));
        const top = Math.min(window.innerHeight - 52, rect.bottom + 8);
        setSelectionUi({ text: text.replace(/\r\n/g, '\n'), left, top });
      });
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setSelectionUi(null); return; }
      if (!selectionFullyInside(scrollRef.current, sel)) setSelectionUi(null);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const saveSelectionAsNote = async () => {
    if (!selectionUi?.text) return;
    const body = selectionUi.text;
    setSelectionUi(null);
    try {
      await api.post(`/assets/${assetId}/notes`, { body });
      toast.success('Saved as note');
      onNoteAdded?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save note');
    }
  };

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clearChat = async () => {
    abortRef.current?.abort();
    stickRef.current = true;
    setMessages([]);
    setLoading(false);
    try { await api.delete(`/chat/asset/${assetId}`); } catch { /* ignore */ }
    toast.success('Chat cleared');
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || !model || loading) return;

    stickRef.current = true;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const systemText = buildSystemPrompt(asset, linkedFindings, linkedCredentials, notes);
    const apiMessages = [
      { role: 'system', content: systemText },
      ...nextMessages.map(({ role, content }) => ({ role, content })),
    ];

    const ac = new AbortController();
    abortRef.current = ac;
    const decoder = new TextDecoder();
    let carry = '';
    let assistantContent = '';
    let shouldSave = true;

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: apiMessages, stream: true }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const { rest, deltas, hadError } = parseSseLines(carry);
        carry = rest;
        if (hadError) throw new Error(hadError);
        if (deltas.length) {
          assistantContent += deltas.join('');
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy.length - 1;
            if (last >= 0 && copy[last].role === 'assistant') copy[last] = { ...copy[last], content: assistantContent };
            return copy;
          });
        }
      }

      const { deltas: tail, hadError: tailErr } = parseSseLines(carry + '\n');
      if (tailErr) throw new Error(tailErr);
      if (tail.length) {
        assistantContent += tail.join('');
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (last >= 0 && copy[last].role === 'assistant') copy[last] = { ...copy[last], content: assistantContent };
          return copy;
        });
      }
    } catch (e) {
      const aborted =
        (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
        e?.name === 'AbortError';
      if (aborted) {
        const { deltas: tail } = parseSseLines(carry + '\n');
        if (tail.length) assistantContent += tail.join('');
        setMessages((prev) => {
          if (!prev.length || prev[prev.length - 1]?.role !== 'assistant') return prev;
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantContent };
          return copy;
        });
      } else {
        shouldSave = false;
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg);
        setMessages((prev) => {
          const p = [...prev];
          if (p.length && p[p.length - 1]?.role === 'assistant') p.pop();
          if (p.length && p[p.length - 1]?.role === 'user') p.pop();
          return p;
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }

    if (shouldSave && assistantContent) {
      try {
        await api.post(`/chat/asset/${assetId}`, [
          { role: 'user', content: text },
          { role: 'assistant', content: assistantContent },
        ]);
      } catch { /* non-critical — chat still visible in UI */ }
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const persistModel = (id) => {
    setModel(id);
    if (id) localStorage.setItem(ASSISTANT_MODEL_STORAGE_KEY, id);
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium flex items-center gap-2">
          <Bot className="w-4 h-4" /> Asset Assistant
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="input text-xs py-1"
            value={model}
            onChange={(e) => persistModel(e.target.value)}
            disabled={modelsLoading || models.length === 0}
          >
            {models.length === 0 ? (
              <option value="">No models — check LLM_PROXY_URL</option>
            ) : (
              models.map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={clearChat}
            className="btn-ghost flex items-center gap-1.5 text-xs text-text-muted"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Chat panel */}
      <div className="card flex flex-col" style={{ height: '480px' }}>
        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={syncStick}
          className="flex-1 min-h-0 overflow-y-auto space-y-3 p-1"
        >
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              Ask about attack vectors, enumeration steps, or testing ideas for this asset.
              <br />
              <span className="text-2xs">Messages sent only to your local LLM — select text to save as a note.</span>
            </p>
          )}
          {messages.map((m, i) => {
            const streamingHere = loading && i === messages.length - 1 && m.role === 'assistant';
            return (
              <div
                key={i}
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'ml-8 border-accent/30 bg-accent/5 text-text-primary'
                    : 'mr-8 border-border bg-input/50 text-text-secondary'
                }`}
              >
                <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-text-muted">
                  {m.role}
                </div>
                <div className="text-sm leading-relaxed [&_.markdown-body]:text-sm [&_.markdown-body]:leading-relaxed [&_.markdown-body_pre]:!text-xs">
                  {m.content ? (
                    <MarkdownViewer content={m.content} />
                  ) : streamingHere ? (
                    <ThinkingIndicator />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="border-t border-border pt-3 mt-3 shrink-0">
          <textarea
            className="textarea min-h-[72px] text-sm"
            placeholder="Ask a follow-up or request specific enumeration ideas… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading || !model}
          />
          <div className="mt-2 flex justify-end gap-2">
            {loading && (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Stop
              </button>
            )}
            <button
              type="button"
              onClick={send}
              className="btn-primary flex items-center gap-2 text-sm"
              disabled={loading || !model || !input.trim()}
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Thinking…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Selection → save as note popover */}
      {selectionUi && (
        <div
          data-asset-chat-popover
          className="fixed z-[70] -translate-x-1/2 rounded-xl border border-border bg-card px-2 py-1.5 shadow-card"
          style={{ left: selectionUi.left, top: selectionUi.top }}
        >
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs font-medium"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              saveSelectionAsNote();
            }}
          >
            <StickyNote className="h-3.5 w-3.5 shrink-0" />
            Save as note
          </button>
        </div>
      )}
    </div>
  );
}
