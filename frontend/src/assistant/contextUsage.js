import {
  ASSISTANT_CONTEXT_LIMIT_KEY,
  ASSISTANT_SYSTEM_STORAGE_KEY,
  DEFAULT_ASSISTANT_CONTEXT_TOKENS,
} from './storageKeys';

/** Rough token estimate (~4 chars per token) for budgeting / UI only. */
export function estimateTokensFromText(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.max(0, Math.ceil(text.length / 4));
}

export function buildChatEstimatePayload(messages, systemPrompt) {
  const sys = (systemPrompt ?? '').trim();
  let raw = '';
  if (sys) raw += `system:\n${sys}\n\n`;
  for (const m of messages) {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      raw += `${m.role}:\n${m.content}\n\n`;
    }
  }
  return raw;
}

export function estimateChatTokens(messages, systemPrompt) {
  return estimateTokensFromText(buildChatEstimatePayload(messages, systemPrompt));
}

export function getAssistantContextLimitTokens() {
  try {
    const raw = localStorage.getItem(ASSISTANT_CONTEXT_LIMIT_KEY);
    if (raw == null || raw === '') return DEFAULT_ASSISTANT_CONTEXT_TOKENS;
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 1024 && n <= 2_000_000) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_ASSISTANT_CONTEXT_TOKENS;
}

/** Saved Settings value only; `null` if the user has not set a manual budget. */
export function getAssistantContextLimitOverrideOrNull() {
  try {
    const raw = localStorage.getItem(ASSISTANT_CONTEXT_LIMIT_KEY);
    if (raw == null || raw === '') return null;
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 1024 && n <= 2_000_000) return n;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Usage ring limit: manual Settings override (if set) else `context_length` from
 * `/assistant/models` (Ollama / LM Studio) else default.
 * @param { { context_length?: number } | null | undefined } modelMeta
 */
export function getEffectiveAssistantContextLimit(modelMeta) {
  const manual = getAssistantContextLimitOverrideOrNull();
  if (manual != null) return manual;
  const p = modelMeta?.context_length;
  if (typeof p === 'number' && Number.isFinite(p) && p >= 1024 && p <= 2_000_000) return p;
  return DEFAULT_ASSISTANT_CONTEXT_TOKENS;
}

export function readSystemPromptForEstimate() {
  try {
    return localStorage.getItem(ASSISTANT_SYSTEM_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Remove oldest messages until the estimated token count fits under `limit`.
 * Always keeps at least the last message (the new user turn).
 * Returns { pruned: Message[], trimmed: boolean }
 */
export function pruneMessagesToFit(messages, systemPrompt, limit) {
  if (estimateChatTokens(messages, systemPrompt) <= limit) {
    return { pruned: messages, trimmed: false };
  }
  let pruned = [...messages];
  while (pruned.length > 1 && estimateChatTokens(pruned, systemPrompt) > limit) {
    pruned.shift();
  }
  return { pruned, trimmed: true };
}
