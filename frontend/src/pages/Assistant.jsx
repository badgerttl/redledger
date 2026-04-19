import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import clsx from 'clsx';
import api from '../api/client';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Trash2, RefreshCw, Settings, Square } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import { ASSISTANT_MODEL_STORAGE_KEY, ASSISTANT_SYSTEM_STORAGE_KEY } from '../assistant/storageKeys';
import { loadAssistantMessages, saveAssistantMessages } from '../assistant/messagesStorage';
import { useEngagement } from '../context/EngagementContext';

function ThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" role="status" aria-label="Thinking">
      <span className="assistant-thinking-dot" />
      <span className="assistant-thinking-dot" />
      <span className="assistant-thinking-dot" />
    </span>
  );
}

function parseSseLines(buffer) {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const deltas = [];
  let hadError = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') continue;
    try {
      const j = JSON.parse(data);
      if (j.error?.message) {
        hadError = j.error.message;
        continue;
      }
      const c = j.choices?.[0]?.delta?.content;
      if (typeof c === 'string' && c.length) deltas.push(c);
    } catch {
      /* ignore partial JSON */
    }
  }
  return { rest, deltas, hadError };
}

export default function Assistant() {
  const { id: engagementId } = useParams();
  const { current, selectEngagement } = useEngagement();

  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => localStorage.getItem(ASSISTANT_MODEL_STORAGE_KEY) || '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const bottomRef = useRef(null);
  const chatAbortRef = useRef(null);
  const persistEngagementRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const persistModel = (id) => {
    setModel(id);
    if (id) localStorage.setItem(ASSISTANT_MODEL_STORAGE_KEY, id);
  };

  const clearChat = () => {
    if (!engagementId) return;
    chatAbortRef.current?.abort();
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

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    let assistantContent = '';

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const systemText = localStorage.getItem(ASSISTANT_SYSTEM_STORAGE_KEY)?.trim() || '';
    const apiMessages = [];
    if (systemText) {
      apiMessages.push({ role: 'system', content: systemText });
    }
    apiMessages.push(...nextMessages.map(({ role, content }) => ({ role, content })));

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
      <div>
        <div className="page-header">
          <h1 className="page-title flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent" />
            Assistant
          </h1>
        </div>
        <div className="card py-10 text-center text-sm text-text-muted">
          Open the Assistant from an engagement in the sidebar (each engagement has its own chat history).
        </div>
      </div>
    );
  }

  const engagementLabel =
    String(current?.id) === String(engagementId) && current?.name ? current.name : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent" />
            Assistant
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {engagementLabel ? (
              <>
                Chat for <span className="font-medium text-text-secondary">{engagementLabel}</span> is saved in
                this browser only. Model calls go to your local{' '}
                <span className="font-mono text-2xs">Ollama</span> /{' '}
                <span className="font-mono text-2xs">LM Studio</span> via{' '}
                <span className="font-mono text-2xs">LLM_PROXY_URL</span>.
              </>
            ) : (
              <>
                Chat is saved per engagement in this browser. Local model via{' '}
                <span className="font-mono text-2xs">LLM_PROXY_URL</span>.
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

      <div className="card mb-4 flex flex-wrap items-end gap-3">
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

      <div className="card flex min-h-[420px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-1" style={{ maxHeight: 'min(55vh, 520px)' }}>
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
          <div ref={bottomRef} />
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <label className="label">Message</label>
          <textarea
            className="textarea min-h-[88px]"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading || !model}
          />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
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
  );
}
