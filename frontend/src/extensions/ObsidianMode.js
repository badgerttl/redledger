/**
 * ObsidianMode — Tiptap extension that:
 * 1. Adds an `obsidian-active` CSS class to the block node the cursor is currently in.
 *    CSS `::before` pseudo-elements on that class show the markdown syntax prefix
 *    (e.g. `# ` for h1, `## ` for h2, `> ` for blockquote).
 * 2. Adds keyboard shortcuts so that while the cursor is at the very start of a
 *    heading node, pressing `#` increments the heading level and `Backspace`
 *    decrements it (or converts to a paragraph). Mirrors Obsidian Live Preview.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const obsidianKey = new PluginKey('obsidianMode');

export const ObsidianMode = Extension.create({
  name: 'obsidianMode',

  // ── Keyboard shortcuts for heading level editing ────────────────────────
  addKeyboardShortcuts() {
    return {
      // '#' at position 0 of a heading → increase level
      '#': ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        const parent = $from.parent;
        if (parent.type.name !== 'heading') return false;
        const level = parent.attrs.level;
        if (level >= 6) return false;
        return editor.chain().focus().toggleHeading({ level: level + 1 }).run();
      },

      // Backspace at position 0 of a heading → decrease level or convert to paragraph
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        const parent = $from.parent;
        if (parent.type.name !== 'heading') return false;
        const level = parent.attrs.level;
        if (level <= 1) {
          return editor.chain().focus().setParagraph().run();
        }
        return editor.chain().focus().toggleHeading({ level: level - 1 }).run();
      },
    };
  },

  // ── ProseMirror decoration plugin — active block highlight ──────────────
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: obsidianKey,

        state: {
          init: () => DecorationSet.empty,

          apply(tr, old) {
            // Skip if neither selection nor document changed
            if (!tr.selectionSet && !tr.docChanged) {
              return old.map(tr.mapping, tr.doc);
            }

            const { $from } = tr.selection;
            if ($from.depth < 1) return DecorationSet.empty;

            // Use the top-level block (depth 1) so the decoration lands on
            // heading / paragraph / blockquote / code block, not the doc root.
            const pos = $from.before(1);
            const node = tr.doc.nodeAt(pos);
            if (!node) return DecorationSet.empty;

            return DecorationSet.create(tr.doc, [
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'obsidian-active',
              }),
            ]);
          },
        },

        props: {
          decorations(state) {
            return obsidianKey.getState(state);
          },
        },
      }),
    ];
  },
});
