import { StreamLanguage, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

/**
 * Minimal gettext (.po/.pot) syntax tokenizer. Highlights translator/extracted
 * comments, the msgid/msgstr/msgctxt keyword family (including msgstr[N]),
 * quoted strings and plural indices - enough to make hand-editing raw catalog
 * text readable without pulling in a full grammar.
 */
const poStreamParser = {
  token(stream: any) {
    if (stream.sol() && stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^(msgid_plural|msgid|msgstr\[\d+\]|msgstr|msgctxt)\b/)) {
      return 'keyword';
    }
    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '\\') { stream.next(); continue; }
        if (ch === '"') break;
      }
      return 'string';
    }
    if (stream.match(/^\d+/)) return 'number';
    if (stream.eatSpace()) return null;
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '#' },
  },
};

export function poLanguage() {
  return StreamLanguage.define(poStreamParser);
}

export const editorHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: 'var(--op-text-muted)', fontStyle: 'italic' },
  { tag: t.keyword, color: 'var(--op-accent-alt)', fontWeight: '600' },
  { tag: t.string, color: 'var(--op-success)' },
  { tag: t.number, color: 'var(--op-warning)' },
  { tag: t.propertyName, color: 'var(--op-accent-alt)' },
  { tag: t.bool, color: 'var(--op-accent-orange)' },
  { tag: t.null, color: 'var(--op-accent-orange)' },
  { tag: t.punctuation, color: 'var(--op-text-secondary)' },
]);

export const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--op-text-primary)',
    backgroundColor: 'transparent',
    height: '100%',
    fontSize: '12px',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    caretColor: 'var(--op-accent-alt)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--op-accent-alt)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--op-accent) 35%, transparent)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--op-bg-active) 45%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in oklab, var(--op-bg-active) 45%, transparent)' },
  '.cm-gutters': {
    backgroundColor: 'var(--op-bg-inset)',
    color: 'var(--op-text-muted)',
    border: 'none',
    borderRight: '1px solid var(--op-border-subtle)',
  },
  '.cm-lineNumbers .cm-gutterElement': { fontSize: '11px' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--op-bg-raised)',
    border: '1px solid var(--op-border)',
    color: 'var(--op-text-secondary)',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--op-accent) 25%, transparent)',
    outline: 'none',
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in oklab, var(--op-warning) 35%, transparent)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in oklab, var(--op-warning) 60%, transparent)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--op-bg-surface)',
    color: 'var(--op-text-primary)',
  },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--op-border)' },
  '.cm-panel input, .cm-panel button': {
    backgroundColor: 'var(--op-bg-raised)',
    color: 'var(--op-text-primary)',
    border: '1px solid var(--op-border)',
    borderRadius: '4px',
  },
  '.cm-panel button:hover': { backgroundColor: 'var(--op-bg-raised-hover)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--op-bg-surface)',
    color: 'var(--op-text-primary)',
    border: '1px solid var(--op-border)',
  },
}, { dark: true });
