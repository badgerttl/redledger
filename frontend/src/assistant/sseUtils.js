/**
 * Parse one buffer-chunk of SSE data from /api/assistant/chat.
 * Returns deltas (content tokens), any error string, and the unconsumed remainder.
 */
export function parseSseLines(buffer) {
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
