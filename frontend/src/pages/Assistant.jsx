import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import clsx from 'clsx';
import api from '../api/client';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Trash2, RefreshCw, Settings, Square, StickyNote } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import AssistantAddNoteToAssetModal from '../components/AssistantAddNoteToAssetModal';
import ContextUsageDonut from '../components/ContextUsageDonut';
import {
  estimateChatTokens,
  getEffectiveAssistantContextLimit,
  pruneMessagesToFit,
} from '../assistant/contextUsage';
import { parseSseLines } from '../assistant/sseUtils';
import { ASSISTANT_MODEL_STORAGE_KEY } from '../assistant/storageKeys';
import { loadAssistantMessages, saveAssistantMessages } from '../assistant/messagesStorage';
import { useEngagement } from '../context/EngagementContext';
import { useSettings } from '../context/SettingsContext';

function ThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" role="status" aria-label="Thinking">
      <span className="assistant-thinking-dot" />
      <span className="assistant-thinking-dot" />
      <span className="assistant-thinking-dot" />
    </span>
  );
}

/**
 * Walk a DOM node and reconstruct markdown syntax.
 * Preserves headings, bold, italic, code, lists, blockquotes, links.
 */
function domNodeToMarkdown(node, inPre = false) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName.toLowerCase();
  const kids = (pre) => [...node.childNodes].map((c) => domNodeToMarkdown(c, pre ?? inPre)).join('');
  switch (tag) {
    case 'h1': return `# ${kids()}\n\n`;
    case 'h2': return `## ${kids()}\n\n`;
    case 'h3': return `### ${kids()}\n\n`;
    case 'h4': return `#### ${kids()}\n\n`;
    case 'h5': return `##### ${kids()}\n\n`;
    case 'h6': return `###### ${kids()}\n\n`;
    case 'strong': case 'b': return `**${kids()}**`;
    case 'em': case 'i': return `*${kids()}*`;
    case 'code': return inPre ? kids(true) : `\`${kids()}\``;
    case 'pre': {
      const codeEl = node.querySelector('code');
      const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] ?? '';
      const code = (codeEl ?? node).textContent ?? '';
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }
    case 'ul': return `${kids()}\n`;
    case 'ol': return `${kids()}\n`;
    case 'li': return `- ${kids()}\n`;
    case 'p': return `${kids()}\n\n`;
    case 'br': return '\n';
    case 'a': return `[${kids()}](${node.getAttribute('href') ?? ''})`;
    case 'blockquote': return kids().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
    default: return kids();
  }
}

/**
 * Extract markdown (not plain text) from the current selection.
 * Clones the selected DOM fragment and reconstructs markdown syntax,
 * so **bold**, `code`, headings etc. survive the round-trip.
 */
function markdownFromSelection(sel) {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
  const parts = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    const frag = sel.getRangeAt(i).cloneContents();
    const wrap = document.createElement('div');
    wrap.appendChild(frag);
    parts.push(domNodeToMarkdown(wrap));
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Whether every range of the selection lies entirely inside `root` (works for backwards selection & code blocks). */
function selectionFullyInside(root, sel) {
  if (!root || !sel || sel.rangeCount === 0) return false;
  for (let i = 0; i < sel.rangeCount; i++) {
    let ca = sel.getRangeAt(i).commonAncestorContainer;
    if (ca.nodeType === Node.TEXT_NODE) ca = ca.parentElement;
    if (!ca || !root.contains(ca)) return false;
  }
  return true;
}

/** Pixels from bottom of the chat panel to count as “at bottom” for follow-stream behavior. */
const CHAT_BOTTOM_THRESHOLD_PX = 80;

function isChatNearBottom(el) {
  if (!el) return true;
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - scrollTop - clientHeight <= CHAT_BOTTOM_THRESHOLD_PX;
}

export default function Assistant() {
  const { id: engagementId } = useParams();
  const { current, selectEngagement } = useEngagement();
  const { settings } = useSettings();

  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => localStorage.getItem(ASSISTANT_MODEL_STORAGE_KEY) || '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const scrollContainerRef = useRef(null);
  const chatAbortRef = useRef(null);
  const persistEngagementRef = useRef(null);
  /** When true, new tokens scroll the panel to the bottom; user scrolling up clears until they return to the bottom. */
  const stickToBottomRef = useRef(true);
  const [noteSelectionUi, setNoteSelectionUi] = useState(null);
  const [noteModal, setNoteModal] = useState({ open: false, body: '' });

  /** Instant jump to bottom — no smooth scroll (avoids animating when re-opening Assistant). */
  const scrollChatToBottom = () => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const syncStickToBottomFromScroll = useCallback(() => {
    stickToBottomRef.current = isChatNearBottom(scrollContainerRef.current);
  }, []);

  useEffect(() => {
    if (!engagementId) return;
    selectEngagement(engagementId);
  }, [engagementId, selectEngagement]);

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
    };
  }, []);

  useLayoutEffect(() => {
    if (!engagementId) {
      setMessages([]);
      return;
    }
    stickToBottomRef.current = true;
    setMessages(loadAssistantMessages(engagementId));
  }, [engagementId]);

  useEffect(() => {
    if (!engagementId) return;
    const switched = persistEngagementRef.current !== engagementId;
    persistEngagementRef.current = engagementId;
    if (switched) return;
    saveAssistantMessages(engagementId, messages);
  }, [messages, engagementId]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const { data } = await api.get('/assistant/models');
      const list = data?.data ?? [];
      setModels(list);
      const ids = list.map((m) => m.id).filter(Boolean);
      setModel((prev) => {
        if (prev && ids.includes(prev)) return prev;
        const first = ids[0] || '';
        if (first) localStorage.setItem(ASSISTANT_MODEL_STORAGE_KEY, first);
        return first;
      });
    } catch {
      setModels([]);
      toast.error('Could not load models (is LLM_PROXY_URL set and the local server up?)');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollChatToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (!engagementId) return;

    const handleMouseUp = (e) => {
      if (
        e.target?.closest?.('textarea') ||
        e.target?.closest?.('select') ||
        e.target?.closest?.('input') ||
        e.target?.closest?.('[data-assistant-note-popover]')
      ) {
        return;
      }
      const root = scrollContainerRef.current;
      if (!root) return;

      requestAnimationFrame(() => {
        const sel = document.getSelection();
        if (!sel || sel.rangeCount === 0) {
          setNoteSelectionUi(null);
          return;
        }
        if (!selectionFullyInside(root, sel)) {
          setNoteSelectionUi(null);
          return;
        }
        const text = markdownFromSelection(sel);
        if (!text.trim()) {
          setNoteSelectionUi(null);
          return;
        }
        let range;
        try {
          range = sel.getRangeAt(0);
        } catch {
          setNoteSelectionUi(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const left = Math.min(window.innerWidth - 100, Math.max(100, centerX));
        const top = Math.min(window.innerHeight - 52, rect.bottom + 8);
        setNoteSelectionUi({ text: text.replace(/\r\n/g, '\n'), left, top });
      });
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [engagementId]);

  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setNoteSelectionUi(null);
        return;
      }
      const root = scrollContainerRef.current;
      if (!root || !selectionFullyInside(root, sel)) {
        setNoteSelectionUi(null);
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const persistModel = (id) => {
    setModel(id);
    if (id) localStorage.setItem(ASSISTANT_MODEL_STORAGE_KEY, id);
  };

  const clearChat = () => {
    if (!engagementId) return;
    chatAbortRef.current?.abort();
    stickToBottomRef.current = true;
    setMessages([]);
    setLoading(false);
    saveAssistantMessages(engagementId, []);
    toast.success('Chat cleared');
  };

  const stopGeneration = useCallback(() => {
    chatAbortRef.current?.abort();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || !model || loading || !engagementId) return;

    stickToBottomRef.current = true;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    let assistantContent = '';

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const systemText = settings.assistant_system_prompt?.trim() || '';
    const contextLimit = getEffectiveAssistantContextLimit(selectedModelMeta);
    const { pruned, trimmed } = pruneMessagesToFit(nextMessages, systemText, contextLimit);
    if (trimmed) toast('Context trimmed — oldest messages removed to fit token budget', { icon: '✂️' });
    const apiMessages = [];
    if (systemText) {
      apiMessages.push({ role: 'system', content: systemText });
    }
    apiMessages.push(...pruned.map(({ role, content }) => ({ role, content })));

    const ac = new AbortController();
    chatAbortRef.current = ac;

    const decoder = new TextDecoder();
    let carry = '';

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          stream: true,
        }),
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
            if (last >= 0 && copy[last].role === 'assistant') {
              copy[last] = { ...copy[last], content: assistantContent };
            }
            return copy;
          });
        }
      }

      const { deltas: tailDeltas, hadError: tailErr } = parseSseLines(carry + '\n');
      if (tailErr) throw new Error(tailErr);
      if (tailDeltas.length) {
        assistantContent += tailDeltas.join('');
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (last >= 0 && copy[last].role === 'assistant') {
            copy[last] = { ...copy[last], content: assistantContent };
          }
          return copy;
        });
      }
    } catch (e) {
      const aborted =
        (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError');
      if (aborted) {
        const { deltas: tailDeltas } = parseSseLines(carry + '\n');
        if (tailDeltas.length) assistantContent += tailDeltas.join('');
        setMessages((prev) => {
          if (!prev.length || prev[prev.length - 1]?.role !== 'assistant') return prev;
          const copy = [...prev];
          const last = copy.length - 1;
          copy[last] = { ...copy[last], content: assistantContent };
          return copy;
        });
      } else {
        const raw = e instanceof Error ? e.message : String(e);
        const msg = raw || 'Request failed';
        toast.error(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg);
        setMessages((prev) => {
          const p = [...prev];
          if (p.length && p[p.length - 1]?.role === 'assistant') p.pop();
          if (p.length && p[p.length - 1]?.role === 'user') p.pop();
          return p;
        });
      }
    } finally {
      chatAbortRef.current = null;
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!engagementId) {
    return (
      <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col lg:h-[calc(100dvh-4rem)]">
        <div className="page-header shrink-0">
          <h1 className="page-title flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent" />
            Assistant
          </h1>
        </div>
        <div className="card flex min-h-0 flex-1 items-center justify-center py-10 text-center text-sm text-text-muted">
          Open the Assistant from an engagement in the sidebar (each engagement has its own chat history).
        </div>
      </div>
    );
  }

  const engagementLabel =
    String(current?.id) === String(engagementId) && current?.name ? current.name : null;

  const llmConnected = !modelsLoading && models.length > 0;

  const contextUsedEstimate = useMemo(
    () => estimateChatTokens(messages, settings.assistant_system_prompt || ''),
    [messages, settings.assistant_system_prompt],
  );
  const selectedModelMeta = useMemo(() => models.find((m) => m.id === model), [models, model]);
  const contextLimitTokens = getEffectiveAssistantContextLimit(selectedModelMeta, settings.assistant_context_limit);
  const contextLimitHint = (() => {
    const override = parseInt(settings.assistant_context_limit || '', 10);
    if (Number.isFinite(override) && override >= 1024) return 'Manual budget (Settings)';
    if (
      typeof selectedModelMeta?.context_length === 'number' &&
      Number.isFinite(selectedModelMeta.context_length) &&
      selectedModelMeta.context_length >= 1024
    ) {
      return 'Reported by local LM';
    }
    return 'Default budget';
  })();

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="page-header shrink-0">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent" />
            Assistant
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {llmConnected ? (
              engagementLabel ? (
                <>
                  Chat for <span className="font-medium text-text-secondary">{engagementLabel}</span> is saved in
                  this browser only.
                </>
              ) : (
                <>{"This engagement's chat is saved in this browser only."}</>
              )
            ) : engagementLabel ? (
              <>
                Chat for <span className="font-medium text-text-secondary">{engagementLabel}</span> is saved in
                this browser only. Could not reach a local model — set{' '}
                <span className="font-mono text-2xs">LLM_PROXY_URL</span> on the server (e.g.{' '}
                <span className="font-mono text-2xs">http://127.0.0.1:11434</span> for{' '}
                <span className="font-mono text-2xs">Ollama</span>,{' '}
                <span className="font-mono text-2xs">http://127.0.0.1:1234</span> for{' '}
                <span className="font-mono text-2xs">LM Studio</span>). In Docker use{' '}
                <span className="font-mono text-2xs">http://host.docker.internal:11434</span>. OpenAI-compatible{' '}
                <span className="font-mono text-2xs">/v1</span> API.
              </>
            ) : (
              <>
                Chat is saved per engagement in this browser. Could not reach a local model — set{' '}
                <span className="font-mono text-2xs">LLM_PROXY_URL</span> on the server (e.g.{' '}
                <span className="font-mono text-2xs">http://127.0.0.1:11434</span> for{' '}
                <span className="font-mono text-2xs">Ollama</span>,{' '}
                <span className="font-mono text-2xs">http://127.0.0.1:1234</span> for{' '}
                <span className="font-mono text-2xs">LM Studio</span>). In Docker use{' '}
                <span className="font-mono text-2xs">http://host.docker.internal:11434</span>. OpenAI-compatible{' '}
                <span className="font-mono text-2xs">/v1</span> API.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NavLink
            to="/settings"
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Appearance & system instructions"
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
          <button type="button" onClick={loadModels} className="btn-secondary flex items-center gap-2 text-sm" disabled={modelsLoading}>
            <RefreshCw className={`h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`} />
            Refresh models
          </button>
          <button type="button" onClick={clearChat} className="btn-ghost flex items-center gap-2 text-sm text-text-muted">
            <Trash2 className="h-4 w-4" />
            Clear chat
          </button>
        </div>
      </div>

      <div className="card mb-4 flex shrink-0 flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="label">Model</label>
          <select
            className="input"
            value={model}
            onChange={(e) => persistModel(e.target.value)}
            disabled={modelsLoading || models.length === 0}
          >
            {models.length === 0 ? (
              <option value="">No models — check LLM_PROXY_URL</option>
            ) : (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={syncStickToBottomFromScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1"
        >
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              Start the conversation below. Messages are sent only to your local runtime.
            </p>
          )}
          {messages.map((m, i) => {
            const streamingHere = loading && i === messages.length - 1 && m.role === 'assistant';
            return (
              <div
                key={i}
                className={`rounded-xl border px-3 py-2.5 text-sm transition-shadow duration-300 ${
                  m.role === 'user'
                    ? 'ml-8 border-accent/30 bg-accent/5 text-text-primary'
                    : clsx(
                        'mr-8 border-border bg-input/50 text-text-secondary',
                        streamingHere &&
                          !m.content &&
                          'shadow-[0_0_0_1px_rgb(var(--color-accent)/0.35)] ring-1 ring-accent/20',
                      )
                }`}
              >
                <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-text-muted">{m.role}</div>
                <div className="text-sm leading-relaxed [&_.markdown-body]:text-sm [&_.markdown-body]:leading-relaxed [&_.markdown-body_h1]:!text-base [&_.markdown-body_h2]:!text-sm [&_.markdown-body_h3]:!text-sm [&_.markdown-body_pre]:!text-xs">
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

        <div className="mt-4 shrink-0 border-t border-border pt-4">
          <label className="label">Message</label>
          <textarea
            className="textarea min-h-[88px]"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading || !model}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ContextUsageDonut
              used={contextUsedEstimate}
              limit={contextLimitTokens}
              limitHint={contextLimitHint}
              variant="toolbar"
            />
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              {loading && (
                <button type="button" onClick={stopGeneration} className="btn-secondary flex items-center gap-2">
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop
                </button>
              )}
              <button type="button" onClick={send} className="btn-primary flex items-center gap-2" disabled={loading || !model || !input.trim()}>
                <Send className="h-4 w-4" />
                {loading ? 'Thinking…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {noteSelectionUi && (
        <div
          data-assistant-note-popover
          className="fixed z-[70] -translate-x-1/2 rounded-xl border border-border bg-card px-2 py-1.5 shadow-card"
          style={{ left: noteSelectionUi.left, top: noteSelectionUi.top }}
        >
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs font-medium"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setNoteModal({ open: true, body: noteSelectionUi.text });
              setNoteSelectionUi(null);
            }}
          >
            <StickyNote className="h-3.5 w-3.5 shrink-0" />
            Add to asset note
          </button>
        </div>
      )}

      <AssistantAddNoteToAssetModal
        open={noteModal.open}
        engagementId={engagementId}
        initialBody={noteModal.body}
        onClose={() => setNoteModal({ open: false, body: '' })}
      />
    </div>
  );
}
