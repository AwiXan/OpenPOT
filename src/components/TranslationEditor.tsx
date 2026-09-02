import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  ArrowRight,
  ArrowLeft,
  Copy,
  Clock,
  AlertCircle,
  HelpCircle,
  Save,
  Check,
  Undo2,
  Redo2,
  CornerDownLeft,
  Eye,
  EyeOff,
  Folder,
  Tag,
  Edit3,
  FileSpreadsheet,
} from 'lucide-react';
import { PoEntry, PluralRuleInfo, LintIssue, TmSuggestion } from '../types/gettext';
import { extractVariables, lintEntry } from '../lib/linter';
import { evaluatePluralIndex } from '../lib/pluralEngine';
import { deriveCategory } from '../lib/categorizer';
import { useTranslation } from '../lib/i18n';
import { countNewlines, toDisplayText, toStoredText } from '../lib/newlineDisplay';

interface TranslationEditorProps {
  entry: PoEntry | null;
  language: string;
  languageName: string;
  pluralRule: PluralRuleInfo;
  onUpdateEntry: (updatedEntry: PoEntry) => void;
  onSyncPotEntry: (updatedPotEntry: PoEntry) => void;
  onNextEntry: () => void;
  onPrevEntry: () => void;
  onNavigateToMatrix: () => void;
  tmSuggestions: TmSuggestion[];
  isPotTemplate: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  fuzzyThreshold?: number;
  autoMarkFuzzyUnder100?: boolean;
  onUpdateCategory?: (entryId: string, newCategory: string) => void;
  availableCategories?: string[];
  onNavigateToEditor: (entryId: string, poFileId: string) => void;
  showNewlinesVisible?: boolean;
  autoGenerateCategories?: boolean;
}

export const TranslationEditor: React.FC<TranslationEditorProps> = ({
  entry,
  language,
  languageName,
  pluralRule,
  onUpdateEntry,
  onSyncPotEntry,
  onNextEntry,
  onPrevEntry,
  tmSuggestions,
  isPotTemplate,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  fuzzyThreshold = 80,
  autoMarkFuzzyUnder100 = true,
  onUpdateCategory,
  availableCategories = [],
  onNavigateToMatrix,
  showNewlinesVisible = true,
  autoGenerateCategories = true,
}) => {
  const { t } = useTranslation();

  // Local state for editing fields
  const [localMsgid, setLocalMsgid] = useState('');
  const [localMsgidPlural, setLocalMsgidPlural] = useState('');
  const [localMsgctxt, setLocalMsgctxt] = useState('');
  const [localComments, setLocalComments] = useState('');
  const [localMsgstr, setLocalMsgstr] = useState<string[]>([]);
  const [localCategory, setLocalCategory] = useState('');
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [activePluralTab, setActivePluralTab] = useState(0);
  const [testNumber, setTestNumber] = useState<number>(1);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Newline convenience tools state
  const [showWhitespaceMarks, setShowWhitespaceMarks] = useState<boolean>(showNewlinesVisible);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setShowWhitespaceMarks(showNewlinesVisible);
  }, [showNewlinesVisible]);

  // Sync state when entry changes
  useEffect(() => {
    if (!entry) return;
    setLocalMsgid(entry.msgid);
    setLocalMsgidPlural(entry.msgidPlural || '');
    setLocalMsgctxt(entry.msgctxt || '');
    setLocalComments(entry.comments.join('\n'));
    setLocalCategory(entry.category || deriveCategory(entry, autoGenerateCategories));
    setIsEditingCategory(false);

    const requiredForms = entry.msgidPlural ? pluralRule.nplurals : 1;
    const current = [...entry.msgstr];
    while (current.length < requiredForms) {
      current.push('');
    }
    setLocalMsgstr(current);
    setActivePluralTab(0);
  }, [
    entry?.id,
    entry?.msgid,
    entry?.msgidPlural,
    pluralRule.nplurals,
    entry?.category,
    entry?.flags,
    autoGenerateCategories
  ]);

  // Keep external translation updates in sync without sending the user back to plural form 0.
  useEffect(() => {
    if (!entry) return;
    const requiredForms = entry.msgidPlural ? pluralRule.nplurals : 1;
    const current = [...entry.msgstr];
    while (current.length < requiredForms) current.push('');
    setLocalMsgstr(current);
    setActivePluralTab((currentTab) => Math.min(currentTab, Math.max(0, requiredForms - 1)));
  }, [entry?.msgstr, entry?.msgidPlural, pluralRule.nplurals]);

  useEffect(() => {
    if (entry) {
      const timer = setTimeout(() => {
        if (activeTextareaRef.current) {
          activeTextareaRef.current.focus();
          const valLen = activeTextareaRef.current.value.length;
          activeTextareaRef.current.setSelectionRange(valLen, valLen);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [entry?.id, activePluralTab]);

  if (!entry) {
    return (
      <div className="w-full h-full bg-(--op-bg-surface) flex items-center justify-center text-(--op-text-muted) text-xs">
        {t('table.noStrings')}
      </div>
    );
  }

  // Extract placeholders / tokens
  const formatTokens = extractVariables(entry.msgid);
  if (entry.msgidPlural) {
    formatTokens.push(...extractVariables(entry.msgidPlural));
  }
  const uniqueTokens: string[] = Array.from(new Set(formatTokens));

  // Run linter on current state
  const currentIssues: LintIssue[] = !isPotTemplate
    ? lintEntry(
      {
        ...entry,
        msgstr: localMsgstr,
      },
      entry.msgidPlural ? pluralRule.nplurals : 1
    )
    : [];

  const handleMsgstrChange = (index: number, val: string) => {
    const updated = [...localMsgstr];
    updated[index] = val;
    setLocalMsgstr(updated);
    onUpdateEntry({
      ...entry,
      msgstr: updated,
    });
  };

  // Helper to insert \n at the current cursor position in active textarea
  const handleInsertNewline = (index: number) => {
    const textarea = activeTextareaRef.current;
    const currentVal = localMsgstr[index] || '';

    if (textarea) {
      const start = textarea.selectionStart ?? currentVal.length;
      const end = textarea.selectionEnd ?? currentVal.length;
      const inserted = showWhitespaceMarks ? '\\n' : '\n';
      const displayValue = toDisplayText(currentVal, showWhitespaceMarks);
      const newDisplayValue = displayValue.substring(0, start) + inserted + displayValue.substring(end);
      handleMsgstrChange(index, toStoredText(newDisplayValue));

      // Restore cursor right after \n
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start + inserted.length, start + inserted.length);
        }
      }, 0);
    } else {
      handleMsgstrChange(index, toStoredText(toDisplayText(currentVal, showWhitespaceMarks) + (showWhitespaceMarks ? '\\n' : '\n')));
    }
  };

  const handleApplyTm = (suggested: string, similarity: number) => {
    const updated = [...localMsgstr];
    updated[activePluralTab] = toStoredText(suggested);
    setLocalMsgstr(updated);

    let nextFlags = [...entry.flags];
    if (similarity < 100 && autoMarkFuzzyUnder100) {
      if (!nextFlags.includes('fuzzy')) nextFlags.push('fuzzy');
    } else if (similarity === 100) {
      nextFlags = nextFlags.filter((f) => f !== 'fuzzy');
    }

    onUpdateEntry({
      ...entry,
      msgstr: updated,
      flags: nextFlags,
    });
  };

  const handleInsertToken = (token: string) => {
    const current = localMsgstr[activePluralTab] || '';
    const updated = [...localMsgstr];
    updated[activePluralTab] = toStoredText(current + token);
    setLocalMsgstr(updated);
    onUpdateEntry({
      ...entry,
      msgstr: updated,
    });
    setCopiedVar(token);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleToggleFuzzy = () => {
    const hasFuzzy = entry.flags.includes('fuzzy');
    const nextFlags = hasFuzzy
      ? entry.flags.filter((f) => f !== 'fuzzy')
      : [...entry.flags, 'fuzzy'];
    onUpdateEntry({
      ...entry,
      flags: nextFlags,
    });
  };

  const handleSavePotTemplateChanges = () => {
    const updatedPotEntry: PoEntry = {
      ...entry,
      msgid: toStoredText(localMsgid),
      msgidPlural: localMsgidPlural.trim() ? toStoredText(localMsgidPlural) : undefined,
      msgctxt: localMsgctxt.trim() ? localMsgctxt : undefined,
      comments: localComments.split('\n').filter((l) => l.trim() !== ''),
    };
    onSyncPotEntry(updatedPotEntry);
  };

  const evaluatedPluralIndex = evaluatePluralIndex(testNumber, pluralRule);

  // Check newline counts for warning indicator
  const sourceNewlineCount = countNewlines(entry.msgid);
  const currentTranslation = localMsgstr[activePluralTab] || '';
  const targetNewlineCount = countNewlines(currentTranslation);
  const hasNewlineMismatch = sourceNewlineCount > 0 && sourceNewlineCount !== targetNewlineCount;

  return (
    <div className="w-full flex flex-col bg-(--op-bg-surface) h-full overflow-hidden text-(--op-text-primary) select-none">
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 border-b border-(--op-border) flex items-center justify-between bg-(--op-bg-raised)">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-(--op-accent) font-bold">✎</span>
          <span className="font-mono text-xs font-semibold text-(--op-text-primary) truncate">
            {entry.msgid}
          </span>
          <button
            onClick={handleToggleFuzzy}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${entry.flags.includes('fuzzy')
              ? 'bg-(--op-warning)/10 text-(--op-warning) border-(--op-warning)/20 hover:bg-(--op-warning)/20'
              : 'bg-(--op-bg-surface) text-(--op-text-muted) border-(--op-border) hover:text-(--op-text-secondary)'
              }`}
            title="Click to toggle fuzzy translation status"
          >
            {entry.flags.includes('fuzzy') ? t('editor.fuzzy') : t('editor.translated')}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">

          <div className="text-[10px] text-(--op-text-muted) font-mono">
            <span>{entry.references[0] || 'inline'}</span>
          </div>
        </div>
      </div>

      {/* Category & Context Metadata Strip */}
      <div className="px-4 py-1.5 bg-[#121418] border-b border-(--op-border) flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-(--op-text-muted) flex items-center gap-1">
            <Folder className="w-3 h-3 text-(--op-warning)" />
            {t('category.category')}:
          </span>
          {isEditingCategory ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                list="category-suggestions"
                value={localCategory}
                onChange={(e) => setLocalCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (onUpdateCategory) onUpdateCategory(entry.id, localCategory);
                    setIsEditingCategory(false);
                  } else if (e.key === 'Escape') {
                    setLocalCategory(entry.category || deriveCategory(entry));
                    setIsEditingCategory(false);
                  }
                }}
                autoFocus
                placeholder="e.g. UI / Dialogs or Inventory"
                className="bg-(--op-bg-raised) border border-(--op-accent) rounded px-2 py-0.5 text-xs font-mono text-(--op-accent-alt) focus:outline-none"
              />
              <datalist id="category-suggestions">
                {availableCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button
                onClick={() => {
                  if (onUpdateCategory) onUpdateCategory(entry.id, localCategory);
                  setIsEditingCategory(false);
                }}
                className="px-2 py-0.5 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white text-[10px] font-medium cursor-pointer"
              >
                {t('common.save')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-(--op-bg-raised) text-(--op-accent-alt) border border-(--op-border) font-mono text-[11px]">
                {localCategory || 'General'}
              </span>
              <button
                onClick={() => setIsEditingCategory(true)}
                className="text-[10px] text-(--op-text-muted) hover:text-(--op-text-primary) p-1 rounded hover:bg-(--op-bg-active) cursor-pointer transition-colors"
                title="Change or set custom category path"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {entry.msgctxt && (
          <div className="flex items-center gap-1 text-[10px] text-(--op-text-secondary) font-mono">
            <Tag className="w-2.5 h-2.5 text-(--op-accent-alt)" />
            <span>ctxt: {entry.msgctxt}</span>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Source Text / POT Template Section */}
        <div className="bg-(--op-bg-canvas) rounded border border-(--op-border) p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-(--op-accent) uppercase tracking-wider flex items-center gap-1.5">
              <span>{t('editor.sourceHeader')}</span>
              {sourceNewlineCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-(--op-accent)/10 text-(--op-accent-alt) border border-(--op-accent)/20 text-[9px] font-mono lowercase">
                  ↵ {sourceNewlineCount} \n
                </span>
              )}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(entry.msgid);
                setCopiedVar('msgid');
                setTimeout(() => setCopiedVar(null), 1200);
              }}
              className="text-[10px] text-(--op-text-muted) hover:text-(--op-text-primary) flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedVar === 'msgid' ? <Check className="w-3 h-3 text-(--op-success)" /> : <Copy className="w-3 h-3" />}
              <span>{copiedVar === 'msgid' ? t('editor.copied') : t('editor.copySource')}</span>
            </button>
          </div>

          {isPotTemplate ? (
            /* Inline POT Master Editor */
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] text-(--op-text-muted) uppercase block mb-1">msgid (Key/Source):</label>
                <textarea
                  value={toDisplayText(localMsgid, showWhitespaceMarks)}
                  onChange={(e) => setLocalMsgid(toStoredText(e.target.value))}
                  className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded p-2 text-xs font-mono text-(--op-text-primary) focus:border-(--op-accent) outline-none resize-none h-16"
                />
              </div>

              <div>
                <label className="text-[10px] text-(--op-text-muted) uppercase block mb-1">msgid_plural (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. %d items in your cart"
                  value={toDisplayText(localMsgidPlural, showWhitespaceMarks)}
                  onChange={(e) => setLocalMsgidPlural(toStoredText(e.target.value))}
                  className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-mono text-(--op-text-primary) focus:border-(--op-accent) outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-(--op-text-muted) uppercase block mb-1">msgctxt (Context):</label>
                  <input
                    type="text"
                    placeholder="e.g. Menu | Button"
                    value={localMsgctxt}
                    onChange={(e) => setLocalMsgctxt(e.target.value)}
                    className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-mono text-(--op-text-primary) focus:border-(--op-accent) outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-(--op-text-muted) uppercase block mb-1">Developer Notes:</label>
                  <input
                    type="text"
                    placeholder="Notes for translators"
                    value={localComments}
                    onChange={(e) => setLocalComments(e.target.value)}
                    className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-sans text-(--op-text-primary) focus:border-(--op-accent) outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSavePotTemplateChanges}
                className="w-full py-1.5 bg-(--op-accent) hover:bg-(--op-accent-strong) text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-(--op-accent)/10 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('editor.savePot')}</span>
              </button>
              {localMsgidPlural.trim() && (
                <div className="bg-(--op-bg-surface) border border-(--op-border) rounded p-2.5 space-y-1.5">
                  <div className="text-[10px] text-(--op-accent) uppercase font-bold">{t('editor.pluralPreview')}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: pluralRule.nplurals }).map((_, formIndex) => (
                      <div key={formIndex} className="rounded border border-(--op-border) bg-(--op-bg-canvas) px-2 py-1.5 font-mono text-[10px] text-(--op-text-secondary)">
                        <span className="text-(--op-accent-alt)">msgstr[{formIndex}]</span>
                        <span className="block mt-0.5">{pluralRule.names[formIndex] || `Form ${formIndex}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Standard Read-Only Source View */
            <div className="space-y-2 text-xs">
              <div className="bg-(--op-bg-surface) p-2.5 rounded border border-(--op-border) font-mono text-(--op-text-primary) select-text whitespace-pre-wrap leading-relaxed">
                {toDisplayText(entry.msgid, showWhitespaceMarks)}
              </div>

              {entry.msgidPlural && (
                <div className="bg-(--op-bg-surface) p-2 rounded border border-(--op-border) text-xs font-mono select-text whitespace-pre-wrap">
                  <span className="text-[10px] text-(--op-accent) uppercase font-bold mr-2">Plural:</span>
                  <span className="text-(--op-text-secondary)">{toDisplayText(entry.msgidPlural, showWhitespaceMarks)}</span>
                </div>
              )}

              {entry.comments.length > 0 && (
                <div className="text-[11px] text-(--op-text-secondary) italic flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3 text-(--op-accent) shrink-0" />
                  <span>{entry.comments.join(' ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Variable / Token Pills */}
          {uniqueTokens.length > 0 && (
            <div className="pt-2 border-t border-(--op-border) flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-(--op-text-muted) uppercase">{t('editor.insertToken')}</span>
              {uniqueTokens.map((token, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInsertToken(token)}
                  className="px-2 py-0.5 rounded bg-(--op-bg-surface) hover:bg-(--op-bg-raised-hover) border border-(--op-border) text-[11px] font-mono text-(--op-accent) hover:text-white transition-colors cursor-pointer"
                >
                  {token}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Translation Target Section (Hidden if viewing POT template) */}
        {!isPotTemplate && (
          <div className="space-y-3">
            {/* Header with language, \n helpers, and fuzzy toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-(--op-success) uppercase tracking-wider">
                  {languageName} ({language})
                </span>
                {entry.msgidPlural && (
                  <span className="text-[10px] font-mono text-(--op-text-muted)">
                    {pluralRule.nplurals} {t('editor.pluralForms')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* To Matrix */}
                <button
                  onClick={onNavigateToMatrix}
                  className="text-[10px] font-mono text-(--op-accent-alt) hover:text-white px-2 py-1 rounded bg-(--op-bg-canvas) hover:bg-(--op-bg-active) border border-(--op-border) transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title={t('editor.toMatrix')}
                >
                  <FileSpreadsheet className="w-3 h-3 text-(--op-accent-alt)" />
                  <span>{t('editor.toMatrix')}</span>
                </button>

                {/* Toggle \n visualization */}
                <button
                  onClick={() => setShowWhitespaceMarks(!showWhitespaceMarks)}
                  className={`p-1 rounded text-xs border transition-colors cursor-pointer ${showWhitespaceMarks
                    ? 'bg-(--op-bg-active) text-(--op-accent-alt) border-(--op-accent)'
                    : 'bg-(--op-bg-canvas) text-(--op-text-muted) border-(--op-border)'
                    }`}
                  title={showWhitespaceMarks ? 'Hide visible \\n markers' : 'Show visible \\n markers'}
                >
                  {showWhitespaceMarks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>

                <button
                  onClick={() => {
                    const updated = [...localMsgstr];
                    updated[activePluralTab] = toStoredText(entry.msgid);
                    setLocalMsgstr(updated);
                    onUpdateEntry({ ...entry, msgstr: updated });
                  }}
                  className="text-[10px] text-(--op-text-secondary) hover:text-(--op-text-primary) px-2 py-1 rounded bg-(--op-bg-canvas) border border-(--op-border) transition-colors cursor-pointer"
                >
                  {t('editor.copySource')}
                </button>

                <button
                  onClick={handleToggleFuzzy}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${entry.flags.includes('fuzzy')
                    ? 'bg-(--op-warning)/10 border border-(--op-warning) text-(--op-warning)'
                    : 'bg-(--op-bg-canvas) border border-(--op-border) text-(--op-text-muted) hover:text-(--op-text-primary)'
                    }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{t('editor.fuzzy')}</span>
                </button>
              </div>
            </div>

            {/* Plural Form Tabs */}
            {entry.msgidPlural ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1 border-b border-(--op-border) pb-1 overflow-x-auto">
                  {Array.from({ length: pluralRule.nplurals }).map((_, formIndex) => {
                    const formName = pluralRule.names[formIndex] || `Form ${formIndex}`;
                    const isTabActive = activePluralTab === formIndex;
                    const isFilled =
                      localMsgstr[formIndex] && localMsgstr[formIndex].trim() !== '';

                    return (
                      <button
                        key={formIndex}
                        onClick={() => setActivePluralTab(formIndex)}
                        className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${isTabActive
                          ? 'bg-(--op-bg-active) border-t-2 border-(--op-accent) text-(--op-text-primary) font-semibold'
                          : 'text-(--op-text-secondary) hover:bg-(--op-bg-raised)'
                          }`}
                      >
                        <span className="font-mono text-[10px]">msgstr[{formIndex}]</span>
                        <span className="text-[10px] text-(--op-text-muted)">({formName})</span>
                        {isFilled && <span className="w-1.5 h-1.5 rounded-full bg-(--op-success)" />}
                      </button>
                    );
                  })}
                </div>

                {/* Plural Interactive Test Counter */}
                <div className="bg-(--op-bg-canvas) p-2.5 rounded border border-(--op-border) flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-(--op-text-muted) uppercase">{t('editor.testPlural')}</span>
                    <input
                      type="number"
                      min={0}
                      value={testNumber}
                      onChange={(e) => setTestNumber(parseInt(e.target.value) || 0)}
                      className="w-16 bg-(--op-bg-surface) border border-(--op-border) rounded px-2 py-0.5 text-xs font-mono text-center text-(--op-text-primary)"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-(--op-text-muted)">{t('editor.activeForm')}</span>
                    <div className="font-mono font-bold text-(--op-accent) min-w-0">
                      <div>
                        msgstr[{evaluatedPluralIndex}] ({pluralRule.names[evaluatedPluralIndex] || 'default'})
                      </div>
                      <div className="mt-0.5 max-w-[280px] truncate text-(--op-text-primary) font-normal" title={localMsgstr[evaluatedPluralIndex] || t('editor.emptyTranslation')}>
                        {localMsgstr[evaluatedPluralIndex] || t('editor.emptyTranslation')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Textarea for active plural form */}
                <div className="relative">
                  <textarea
                    ref={activeTextareaRef}
                    value={toDisplayText(localMsgstr[activePluralTab] || '', showWhitespaceMarks)}
                    onChange={(e) => handleMsgstrChange(activePluralTab, toStoredText(e.target.value))}
                    placeholder={`Translation for ${pluralRule.names[activePluralTab] || `Form ${activePluralTab}`} (msgstr[${activePluralTab}])...`}
                    className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded p-3 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none resize-none h-24 leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              /* Singular Textarea */
              <div className="relative">
                <textarea
                  ref={activeTextareaRef}
                  value={toDisplayText(localMsgstr[0] || '', showWhitespaceMarks)}
                  onChange={(e) => handleMsgstrChange(0, toStoredText(e.target.value))}
                  placeholder={t('editor.placeholder')}
                  className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded p-3 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none resize-none h-28 leading-relaxed"
                />
              </div>
            )}

            {/* Newline mismatch alert */}
            {hasNewlineMismatch && (
              <div className="p-2 rounded bg-(--op-accent)/8 border border-(--op-accent)/27 text-[11px] text-(--op-accent-alt) flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>
                    Source contains {sourceNewlineCount} newline (\n), but translation has {targetNewlineCount}.
                  </span>
                </div>
                <button
                  onClick={() => handleInsertNewline(activePluralTab)}
                  className="px-2 py-0.5 rounded bg-(--op-accent) text-white text-[10px] font-semibold hover:bg-(--op-accent-strong) cursor-pointer"
                >
                  Append \n
                </button>
              </div>
            )}

            {/* Linter Warning Notices */}
            {currentIssues.length > 0 && (
              <div className="space-y-1.5">
                {currentIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded text-xs flex items-center gap-2 ${issue.type === 'error'
                      ? 'bg-rose-950/40 border border-rose-800 text-rose-300'
                      : 'bg-amber-950/40 border border-amber-800 text-amber-300'
                      }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Translation Memory Suggestions */}
            {tmSuggestions.length > 0 && (
              <div className="bg-(--op-bg-canvas) rounded border border-(--op-border) p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-(--op-warning) uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-(--op-warning)" />
                    <span>{t('editor.tmSuggestions')}</span>
                    <span className="px-1.5 py-0.2 rounded bg-(--op-warning)/10 text-(--op-warning) font-mono text-[9px] border border-(--op-warning)/20">
                      ≥ {fuzzyThreshold}% match
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {tmSuggestions.slice(0, 3).map((match, idx) => (
                    <div
                      key={idx}
                      className="bg-(--op-bg-surface) p-2 rounded border border-(--op-border) flex items-center justify-between text-xs"
                    >
                      <div className="overflow-hidden mr-2">
                        <div className="font-mono text-(--op-text-primary) truncate">{match.suggestedMsgstr}</div>
                        <div className="text-[10px] text-(--op-text-muted) flex items-center gap-2">
                          <span className={`font-semibold ${match.similarity === 100 ? 'text-(--op-success)' : 'text-(--op-accent-alt)'}`}>
                            {t('editor.tmMatch')}: {match.similarity}%
                          </span>
                          <span>•</span>
                          <span className="truncate">{match.originWorkspace || 'Workspace TM'}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleApplyTm(match.suggestedMsgstr, match.similarity)}
                        className="px-2.5 py-1 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white text-xs font-medium shrink-0 cursor-pointer shadow-xs"
                      >
                        {t('editor.apply')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="h-10 border-t border-(--op-border) px-4 flex items-center justify-between bg-(--op-bg-canvas) text-xs">
        <div className="flex items-center gap-3 text-[10px] text-(--op-text-muted)">
          <span>{t('editor.ctrlEnterHint')}</span>
          <span>•</span>
          <span>{t('editor.ctrlArrowHint')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrevEntry}
            className="px-2.5 py-1 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1 border border-(--op-border) cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>{t('editor.prev')}</span>
          </button>

          <button
            onClick={onNextEntry}
            className="px-3.5 py-1 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-(--op-accent)/20 cursor-pointer"
          >
            <span>{t('editor.next')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
