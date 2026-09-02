import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { search, openSearchPanel } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { Prec } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';
import {
  Code2,
  Copy,
  Check,
  AlertCircle,
  Save,
  Search as SearchIcon,
} from 'lucide-react';
import { PoHeader, PoEntry, Workspace } from '../types/gettext';
import { serializePoFile, parsePoContent } from '../lib/poParser';
import { JsonFormat, serializeTranslationsCsv, serializeTranslationsJson, parseTranslationsJson } from '../lib/translationFormats';
import { poLanguage, editorTheme, editorHighlightStyle } from '../lib/poCodeMirror';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';
import { DropdownMenu } from './ui/DropdownMenu';

interface RawPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  header: PoHeader;
  entries: PoEntry[];
  isPot?: boolean;
  onSaveRaw: (header: PoHeader, entries: PoEntry[]) => void;
  onApplyJsonTranslations?: (entriesByLanguage: Record<string, PoEntry[]>) => void;
  workspace: Workspace;
  csvPluralSuffix?: string;
}

export const RawPoModal: React.FC<RawPoModalProps> = ({
  isOpen,
  onClose,
  filename,
  header,
  entries,
  isPot = false,
  onSaveRaw,
  onApplyJsonTranslations,
  workspace,
  csvPluralSuffix = '_P%d',
}) => {
  const [format, setFormat] = useState<'po' | 'json' | 'csv'>('po');
  const [jsonFormat, setJsonFormat] = useState<JsonFormat>('key-first');
  const [rawText, setRawText] = useState('');
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const handleSaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (isOpen) {
      setFormat('po');
      setRawText(serializePoFile(header, entries, isPot));
      setParseError(null);
    }
  }, [header, entries, isPot, isOpen]);

  const linesCount = useMemo(() => rawText.split('\n').length, [rawText]);

  const switchFormat = (nextFormat: 'po' | 'json' | 'csv') => {
    setFormat(nextFormat);
    if (nextFormat === 'po') setRawText(serializePoFile(header, entries, isPot));
    if (nextFormat === 'csv') setRawText(serializeTranslationsCsv(workspace, csvPluralSuffix));
    if (nextFormat === 'json') setRawText(serializeTranslationsJson(workspace, csvPluralSuffix, jsonFormat));
    setParseError(null);
  };

  const switchJsonFormat = (nextFormat: JsonFormat) => {
    setJsonFormat(nextFormat);
    setRawText(serializeTranslationsJson(workspace, csvPluralSuffix, nextFormat));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = useCallback(() => {
    if (format === 'po') {
      try {
        const parsed = parsePoContent(rawText);
        onSaveRaw(parsed.header, parsed.entries);
        onClose();
      } catch (err: any) {
        setParseError(err?.message || 'Failed to parse raw PO syntax.');
      }
      return;
    }
    if (format === 'json') {
      try {
        const entriesByLanguage = parseTranslationsJson(rawText, csvPluralSuffix);
        onApplyJsonTranslations?.(entriesByLanguage);
        onClose();
      } catch (err: any) {
        setParseError(err?.message || 'Failed to parse JSON.');
      }
    }
  }, [format, rawText, onSaveRaw, onApplyJsonTranslations, onClose, csvPluralSuffix]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const jsonLinter = useMemo(
    () =>
      linter((view): Diagnostic[] => {
        try {
          JSON.parse(view.state.doc.toString());
          return [];
        } catch (err: any) {
          const msg = String(err?.message || 'Invalid JSON');
          const posMatch = msg.match(/position (\d+)/);
          const pos = posMatch ? Math.min(Number(posMatch[1]), view.state.doc.length) : 0;
          return [{ from: pos, to: Math.min(pos + 1, view.state.doc.length), severity: 'error', message: msg }];
        }
      }),
    []
  );

  const extensions = useMemo(() => {
    const base = [
      Prec.highest(
        keymap.of([
          indentWithTab,
          {
            key: 'Mod-s',
            run: () => {
              handleSaveRef.current();
              return true;
            },
          },
        ])
      ),
      search({ top: true }),
      editorTheme,
      syntaxHighlighting(editorHighlightStyle),
    ];
    if (format === 'po') return [...base, poLanguage()];
    if (format === 'json') return [...base, json(), jsonLinter, lintGutter()];
    return base;
  }, [format, jsonLinter]);

  const basicSetup = useMemo(
    () => ({
      lineNumbers: true,
      foldGutter: format !== 'csv',
      highlightActiveLine: true,
      highlightActiveLineGutter: true,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: format === 'json',
      highlightSelectionMatches: true,
    }),
    [format]
  );

  const modalFooter = (
    <div className="w-full flex items-center justify-between text-xs">
      <div className="flex items-center gap-3 text-(--op-text-muted) font-mono text-[11px]">
        <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        <span>•</span>
        <span>{linesCount} {linesCount === 1 ? 'line' : 'lines'}</span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">UTF-8</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border border-(--op-border) cursor-pointer transition-colors"
        >
          {t('common.cancel')}
        </button>
        {(format === 'po' || format === 'json') && (
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-(--op-accent)/20 cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t('rawPo.save')}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('rawPo.title')}: ${filename}`}
      subtitle={t('rawPo.subtitle').replace('${count}', entries.length.toString())}
      icon={<Code2 className="w-4 h-4" />}
      maxWidth="max-w-5xl"
      footer={modalFooter}
    >
      <div className="space-y-2.5 flex flex-col w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded border border-(--op-border) bg-(--op-bg-canvas) p-0.5">
            {(['po', 'json', 'csv'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchFormat(option)}
                className={`px-2.5 py-1 text-xs rounded cursor-pointer transition-colors ${
                  format === option ? 'bg-(--op-bg-active) text-white font-medium' : 'text-(--op-text-secondary) hover:text-white'
                }`}
              >
                {option === 'po' ? 'PO' : option.toUpperCase()}
              </button>
            ))}
          </div>

          {format === 'json' && (
            <DropdownMenu
              value={jsonFormat}
              onChange={switchJsonFormat}
              options={[
                { value: 'key-first', label: t('transfer.jsonKeyFirst') },
                { value: 'language-first', label: t('transfer.jsonLanguageFirst') },
              ]}
              className="min-w-[170px]"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => editorRef.current?.view && openSearchPanel(editorRef.current.view)}
              className="px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 border transition-colors cursor-pointer bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border-(--op-border)"
              title="Find (Ctrl+F) / Replace"
            >
              <SearchIcon className="w-3.5 h-3.5" />
              <span>{t('sidebar.searchPlaceholder') || 'Find'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-xs text-(--op-text-secondary) hover:text-(--op-text-primary) flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-(--op-success)" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('editor.copied') : t('editor.copy')}</span>
            </button>
          </div>
        </div>

        <div className="relative border border-(--op-border) rounded-lg bg-(--op-bg-canvas) overflow-hidden">
          <CodeMirror
            ref={editorRef}
            value={rawText}
            height="58vh"
            theme="none"
            extensions={extensions}
            editable={format !== 'csv'}
            basicSetup={basicSetup}
            onChange={(value) => {
              if (format === 'csv') return;
              setRawText(value);
              setParseError(null);
            }}
            onUpdate={(viewUpdate) => {
              if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;
              const pos = viewUpdate.state.selection.main.head;
              const line = viewUpdate.state.doc.lineAt(pos);
              const col = pos - line.from + 1;
              setCursorPos((prev) => (prev.line === line.number && prev.col === col ? prev : { line: line.number, col }));
            }}
          />
        </div>

        {parseError && (
          <div className="p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
