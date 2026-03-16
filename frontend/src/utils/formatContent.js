/**
 * Pretty-print JSON or XML content for display. Returns original string if not valid JSON/XML.
 */

export function isStructuredContent(content) {
  if (content == null || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    (trimmed.startsWith('<') && (/^<\s*[\w:-]/.test(trimmed) || /^<\?/.test(trimmed) || trimmed.startsWith('<!')))
  );
}

export function formatStructuredContent(content) {
  if (content == null || content === '') return '';
  const trimmed = String(content).trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return content;
    }
  }
  if (trimmed.startsWith('<') && (/^<\s*[\w:-]/.test(trimmed) || /^<\?/.test(trimmed) || trimmed.startsWith('<!'))) {
    const formatted = formatXml(trimmed);
    if (formatted != null) return formatted;
  }
  return content;
}

function formatXml(str) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/xml');
    if (doc.querySelector('parsererror')) return null;
    return serializeElement(doc.documentElement, 0);
  } catch {
    return null;
  }
}

function escapeXmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;');
}

function serializeElement(el, indent) {
  const space = '  '.repeat(indent);
  let tag = '<' + el.tagName;
  for (const a of el.attributes) {
    tag += ' ' + a.name + '="' + escapeXmlAttr(a.value) + '"';
  }
  const textParts = [];
  const childParts = [];
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent;
      if (t) textParts.push(t.trim());
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      childParts.push(serializeElement(node, indent + 1));
    }
  }
  const hasChildren = childParts.length > 0;
  const hasText = textParts.length > 0 && textParts.join('').length > 0;
  if (!hasChildren && !hasText) {
    return space + tag + ' />';
  }
  if (hasChildren) {
    return space + tag + '>\n' + childParts.join('\n') + '\n' + space + '</' + el.tagName + '>';
  }
  return space + tag + '>' + textParts.join(' ') + '</' + el.tagName + '>';
}
