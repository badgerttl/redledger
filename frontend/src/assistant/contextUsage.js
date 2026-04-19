import { DEFAULT_ASSISTANT_CONTEXT_TOKENS } from './storageKeys';

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

/**
 * Usage ring limit: manual context_limit setting (if valid) else `context_length` from
 * `/assistant/models` (Ollama / LM Studio) else default.
 *
 * @param { { context_length?: number } | null | undefined } modelMeta
 * @param { string | null | undefined } contextLimitStr  — raw string value from DB settings
 */
export function getEffectiveAssistantContextLimit(modelMeta, contextLimitStr) {
  if (contextLimitStr != null && contextLimitStr !== '') {
    const n = parseInt(String(contextLimitStr), 10);
    if (Number.isFinite(n) && n >= 1024 && n <= 2_000_000) return n;
  }
  const p = modelMeta?.context_length;
  if (typeof p === 'number' && Number.isFinite(p) && p >= 1024 && p <= 2_000_000) return p;
  return DEFAULT_ASSISTANT_CONTEXT_TOKENS;
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
