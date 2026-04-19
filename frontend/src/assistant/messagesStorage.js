/** Per-engagement assistant transcript (browser localStorage). */
export function assistantMessagesStorageKey(engagementId) {
  return `redledger-assistant-messages-v1:${engagementId}`;
}

export function loadAssistantMessages(engagementId) {
  if (engagementId == null || engagementId === '') return [];
  try {
    const raw = localStorage.getItem(assistantMessagesStorageKey(engagementId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    );
  } catch {
    return [];
  }
}

export function saveAssistantMessages(engagementId, messages) {
  if (engagementId == null || engagementId === '') return;
  localStorage.setItem(assistantMessagesStorageKey(engagementId), JSON.stringify(messages));
}
