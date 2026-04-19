/**
 * Walk a DOM node and reconstruct markdown syntax.
 * Preserves headings, bold, italic, code, lists, blockquotes, links.
 */
export function domNodeToMarkdown(node, inPre = false) {
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
export function markdownFromSelection(sel) {
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

/**
 * Whether every range of the selection lies entirely inside `root`.
 * Works for backwards selection and code blocks.
 */
export function selectionFullyInside(root, sel) {
  if (!root || !sel || sel.rangeCount === 0) return false;
  for (let i = 0; i < sel.rangeCount; i++) {
    let ca = sel.getRangeAt(i).commonAncestorContainer;
    if (ca.nodeType === Node.TEXT_NODE) ca = ca.parentElement;
    if (!ca || !root.contains(ca)) return false;
  }
  return true;
}
