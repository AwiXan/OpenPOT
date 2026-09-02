import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Workspace, PoEntry } from '../types/gettext';
import { useTranslation } from '../lib/i18n';
import {
  CornerDownLeft,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  FolderTree,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Folder,
  Edit3,
} from 'lucide-react';
import { deriveCategoryPath } from '../lib/categorizer';
import { countNewlines, toDisplayText, toStoredText } from '../lib/newlineDisplay';
import { DropdownMenu } from './ui/DropdownMenu';
import { getPluralRuleForLanguage } from '../lib/pluralEngine';

interface MultiLanguageGridViewProps {
  workspace: Workspace;
  onUpdateTranslation: (poFileId: string, entryId: string, msgstr: string[]) => void;
  showNewlinesVisible?: boolean;
  activeEntryId: string | null;
  hiddenMatrixFiles?: Set<string>;
  onNavigateToEditor: (entryId: string, poFileId: string) => void;
  autoGenerateCategories?: boolean;

}

export const MultiLanguageGridView: React.FC<MultiLanguageGridViewProps> = ({
  workspace,
  onUpdateTranslation,
  showNewlinesVisible: initialShowNewlines = true,
  activeEntryId,
  hiddenMatrixFiles,
  onNavigateToEditor,
  autoGenerateCategories = true,
}) => {
  const { t } = useTranslation();
  const potEntries = workspace.potFile.entries;
  const poFiles = workspace.poFiles;
  const lastFocusedCol = useRef<string | null>(null);

  const [showWhitespaceMarks, setShowWhitespaceMarks] = useState<boolean>(initialShowNewlines);
  const [expandAllRows, setExpandAllRows] = useState<boolean>(false);
  const [groupByCategory, setGroupByCategory] = useState<boolean>(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [jumpCategory, setJumpCategory] = useState('');

  // Store refs to textareas for precise cursor manipulation: key = `${poId}_${entryId}_${idx}`
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const categoryRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const setTextareaRef = (key: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaRefs.current.set(key, el);
    } else {
      textareaRefs.current.delete(key);
    }
  };

  const setCategoryRowRef = (categoryName: string, el: HTMLTableRowElement | null) => {
    if (el) {
      categoryRowRefs.current.set(categoryName, el);
    } else {
      categoryRowRefs.current.delete(categoryName);
    }
  };

  // Group entries by category
  const categorizedGroups = useMemo(() => {
    const map = new Map<string, PoEntry[]>();
    for (const entry of potEntries) {
      const catPath = deriveCategoryPath(entry, autoGenerateCategories);
      const catName = catPath.join(' / ') || 'General';
      if (!map.has(catName)) {
        map.set(catName, []);
      }
      map.get(catName)!.push(entry);
    }

    // Sort categories alphabetically with General at the end if present
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b);
    });
  }, [potEntries]);

  useEffect(() => {
    setShowWhitespaceMarks(initialShowNewlines);
  }, [initialShowNewlines]);

  useEffect(() => {
    if (activeEntryId) {
      if (groupByCategory) {
        const entry = potEntries.find((e) => e.id === activeEntryId);
        if (entry) {
          const catPath = deriveCategoryPath(entry, autoGenerateCategories);
          const catName = catPath.join(' / ') || 'General';
          if (collapsedCategories.has(catName)) {
            setCollapsedCategories((prev) => {
              const next = new Set(prev);
              next.delete(catName);
              return next;
            });
          }
        }
      }

      setTimeout(() => {
        const row = document.getElementById(`matrix-row-${activeEntryId}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (lastFocusedCol.current) {
          const taKey = `${lastFocusedCol.current}_${activeEntryId}_0`;
          const ta = textareaRefs.current.get(taKey);
          if (ta) {
            ta.focus();
            const valLen = ta.value.length;
            ta.setSelectionRange(valLen, valLen);
          }
        }

        if (workspace.activeFileId) {
          const targetColClass = workspace.activeFileId === 'pot' ? 'matrix-col-pot' : `matrix-col-${workspace.activeFileId}`;
          const colCells = document.querySelectorAll(`.${targetColClass}`);

          colCells.forEach((cell) => {
            cell.classList.add('!bg-(--op-accent)/13');
            setTimeout(() => cell.classList.remove('!bg-(--op-accent)/13'), 1000);
          });

          const activeCell = document.getElementById(`matrix-cell-${activeEntryId}-${workspace.activeFileId}`);
          if (activeCell) {
            activeCell.classList.add('!bg-(--op-accent)/25');
            setTimeout(() => activeCell.classList.remove('!bg-(--op-accent)/25'), 1000);
          }
        }
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntryId]);

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };


  const expandAllCategories = () => {
    setCollapsedCategories(new Set());
  };

  const collapseAllCategories = () => {
    setCollapsedCategories(new Set(categorizedGroups.map(([catName]) => catName)));
  };

  const handleScrollToCategory = (catName: string) => {
    // If collapsed, expand it so it's visible
    if (collapsedCategories.has(catName)) {
      setCollapsedCategories((prev) => {
        const next = new Set(prev);
        next.delete(catName);
        return next;
      });
    }

    setTimeout(() => {
      const el = categoryRowRefs.current.get(catName);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };


  const renderEntryRow = (potEntry: PoEntry) => {
    const hasNewlines = countNewlines(potEntry.msgid) > 0;
    const newlineCount = countNewlines(potEntry.msgid);

    return (
      <tr
        id={`matrix-row-${potEntry.id}`}
        key={potEntry.id}
        className="border-b border-(--op-bg-surface) hover:bg-[#5070a320] transition-colors duration-500"
      >
        {/* Source Column */}
        {!hiddenMatrixFiles?.has('pot') && (
          <td id={`matrix-cell-${potEntry.id}-pot`} className="matrix-col-pot p-3 border-r border-(--op-border) bg-(--op-bg-canvas) align-top w-80 transition-colors duration-700">
            <div className="flex items-start justify-between gap-1 mb-1">
              <div className="font-semibold text-(--op-text-primary) select-text break-words whitespace-pre-wrap leading-relaxed">
                {toDisplayText(potEntry.msgid, showWhitespaceMarks)}
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {showWhitespaceMarks && hasNewlines && (
                  <span
                    className="px-1 py-0.2 rounded bg-(--op-accent)/13 text-(--op-accent-alt) border border-(--op-accent)/27 text-[9px] font-mono select-none"
                    title={`${newlineCount} newlines in source key`}
                  >
                    ↵ {newlineCount}\n
                  </span>
                )}
                <button
                  onClick={() => onNavigateToEditor(potEntry.id, 'pot')}
                  className="p-1 rounded bg-(--op-bg-surface) hover:bg-(--op-bg-active) text-(--op-text-muted) hover:text-(--op-accent-alt) border border-(--op-border) transition-colors cursor-pointer"
                  title={t('matrix.toEditor')}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            {potEntry.msgidPlural && (
              <div className="text-[10px] text-(--op-accent) mt-1 whitespace-pre-wrap">
                <span className="font-bold">{t('editor.plural')}:</span> {potEntry.msgidPlural}
              </div>
            )}
            
            {potEntry.comments.length > 0 && (
              <div className="text-[10px] text-(--op-text-muted) font-sans italic mt-1 truncate">
                {potEntry.comments[0]}
              </div>
            )}
          </td>
        )}

        {/* Language Input Columns */}
        {poFiles.filter(po => !hiddenMatrixFiles?.has(po.id)).map((po) => {
          const poEntry = po.entries.find(
            (e) => e.msgid === potEntry.msgid && (e.msgctxt || '') === (potEntry.msgctxt || '')
          ) || po.entries.find((e) => e.id === potEntry.id);

          const expectedForms = potEntry.msgidPlural
            ? getPluralRuleForLanguage(po.language, po.header.pluralForms).nplurals
            : 1;
          const currentMsgstr = Array.from({ length: expectedForms }, (_, index) => poEntry?.msgstr[index] || '');
          const isFuzzy = poEntry?.flags.includes('fuzzy');

          return (
            <td
              key={po.id}
              id={`matrix-cell-${potEntry.id}-${po.id}`}
              className={`matrix-col-${po.id} p-2.5 border-r border-(--op-border) align-top bg-(--op-bg-canvas) transition-colors duration-700`}
            >
              <div className="space-y-1.5">
                {currentMsgstr.map((strVal, idx) => {
                  const refKey = `${po.id}_${potEntry.id}_${idx}`;
                  const valNewlineCount = countNewlines(strVal);

                  return (
                    <div key={idx} className="relative group/cell">
                      <div className="flex items-start gap-1">
                        {currentMsgstr.length > 1 && (
                          <span className="text-[9px] font-mono text-(--op-text-muted) w-5 shrink-0 pt-1">
                            [{idx}]
                          </span>
                        )}

                        <div className="flex-1 relative">
                          <textarea
                            onFocus={() => lastFocusedCol.current = po.id}
                            ref={(el) => setTextareaRef(refKey, el)}
                            rows={expandAllRows ? 3 : 2}
                            value={toDisplayText(strVal, showWhitespaceMarks)}
                            onChange={(e) => {
                              const updated = [...currentMsgstr];
                              updated[idx] = toStoredText(e.target.value);
                              onUpdateTranslation(po.id, potEntry.id, updated);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                (e.target as HTMLElement).blur();
                              }
                            }}
                            placeholder={`${t('matrix.translatePlaceholder')} (${po.language})...`}
                            className={`w-full bg-(--op-bg-surface) border rounded px-2.5 py-1.5 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none resize-y min-h-[44px] leading-relaxed transition-colors ${isFuzzy ? 'border-(--op-warning)' : 'border-(--op-border)'
                              }`}
                          />

                          {showWhitespaceMarks && valNewlineCount > 0 && (
                            <span
                              className="absolute bottom-1 right-2 px-1 py-0.2 rounded bg-(--op-accent)/13 text-(--op-accent-alt) border border-(--op-accent)/20 text-[9px] font-mono select-none pointer-events-none"
                              title={`${valNewlineCount} newlines`}
                            >
                              ↵ {valNewlineCount}\n
                            </span>
                          )}
                        </div>

                        {/* To Editor */}
                        <button
                          onClick={() => onNavigateToEditor(potEntry.id, po.id)}
                          className="p-1 rounded bg-(--op-bg-surface) hover:bg-(--op-bg-active) text-(--op-text-muted) hover:text-(--op-accent-alt) border border-(--op-border) transition-colors cursor-pointer shrink-0 mt-0.5"
                          title={t('matrix.toEditor')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-(--op-bg-canvas) overflow-hidden text-(--op-text-primary)">
      {/* Header Info Bar */}
      <div className="p-3 border-b border-(--op-border) bg-(--op-bg-surface) flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>{t('matrix.title')}</span>
            <span className="px-1.5 py-0.2 rounded bg-(--op-accent)/10 text-(--op-accent-alt) border border-(--op-accent)/20 text-[9px] font-mono lowercase">
              \n multi-row editor
            </span>
          </h2>
          <p className="text-[11px] text-(--op-text-secondary)">
            {t('matrix.subtitle')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Categorize Preference Toggle */}
          <button
            onClick={() => setGroupByCategory(!groupByCategory)}
            className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${groupByCategory
              ? 'bg-(--op-bg-active) text-(--op-accent-alt) border-(--op-accent) font-medium shadow-xs'
              : 'bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border-(--op-border)'
              }`}
            title="Group strings by category in the matrix"
          >
            <FolderTree className="w-3.5 h-3.5 text-(--op-accent-alt)" />
            <span>{t('matrix.groupByCategory')}</span>
          </button>

          {/* Jump to category dropdown and expand/collapse button group if grouped */}
          {groupByCategory && categorizedGroups.length > 1 && (
            <div className="flex items-center gap-1.5">
              {/* Stylized Jump to Category select box */}
              <DropdownMenu value={jumpCategory} onChange={(category) => { setJumpCategory(category); handleScrollToCategory(category); }} placeholder={t('matrix.jumpToCategory')} options={categorizedGroups.map(([catName, entries]) => ({ value: catName, label: `${catName} (${entries.length})` }))} className="min-w-[190px]" />

              {/* Connected Expand All / Collapse All button group */}
              <div className="flex bg-(--op-bg-canvas) p-0.5 rounded border border-(--op-border) items-center">
                <button
                  onClick={expandAllCategories}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1 text-(--op-text-secondary) hover:text-(--op-text-primary) hover:bg-(--op-bg-raised) transition-all cursor-pointer"
                  title={t('matrix.expandAllCats')}
                >
                  <ChevronsDown className="w-3 h-3 text-(--op-accent-alt)" />
                  <span>{t('matrix.expandAllCats')}</span>
                </button>
                <div className="h-3.5 w-[1px] bg-(--op-border) mx-0.5" />
                <button
                  onClick={collapseAllCategories}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1 text-(--op-text-secondary) hover:text-(--op-text-primary) hover:bg-(--op-bg-raised) transition-all cursor-pointer"
                  title={t('matrix.collapseAllCats')}
                >
                  <ChevronsUp className="w-3 h-3 text-(--op-text-secondary)" />
                  <span>{t('matrix.collapseAllCats')}</span>
                </button>
              </div>
            </div>
          )}

          <div className="h-4 w-[1px] bg-(--op-border) mx-0.5 shrink-0" />

          {/* Toggle whitespace badges */}
          <button
            onClick={() => setShowWhitespaceMarks(!showWhitespaceMarks)}
            className={`px-2.5 py-1.5 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${showWhitespaceMarks
              ? 'bg-(--op-bg-active) text-(--op-accent-alt) border-(--op-accent) font-medium shadow-xs'
              : 'bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border-(--op-border)'
              }`}
            title="Toggle visible \n newline markers"
          >
            {showWhitespaceMarks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showWhitespaceMarks ? t('matrix.hideNewlines') : t('matrix.showNewlines')}</span>
          </button>

          {/* Expand all rows toggle */}
          <button
            onClick={() => setExpandAllRows(!expandAllRows)}
            className={`px-2.5 py-1.5 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${expandAllRows
              ? 'bg-(--op-bg-active) text-(--op-success) border-(--op-success) font-medium shadow-xs'
              : 'bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border-(--op-border)'
              }`}
            title="Toggle expanded multiline rows"
          >
            {expandAllRows ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{expandAllRows ? t('matrix.compactRows') : t('matrix.expandRows')}</span>
          </button>

          <div className="text-xs font-mono text-(--op-text-muted) pl-2 border-l border-(--op-border)">
            {potEntries.length} {t('matrix.keysCount')} • {poFiles.length} {t('matrix.targetLangs')}
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-(--op-bg-surface) border-b border-(--op-border) text-[10px] font-bold text-(--op-text-muted) uppercase tracking-wider z-20 shadow-sm">
            <tr>
              {/* Header POT */}
              {!hiddenMatrixFiles?.has('pot') && (
                <th className="matrix-col-pot p-3 w-80 border-r border-(--op-border) bg-(--op-bg-surface) transition-colors duration-700">
                  {t('matrix.sourceCol')} ({workspace.potFile.filename})
                </th>
              )}

              {/* Header PO */}
              {poFiles.filter(po => !hiddenMatrixFiles?.has(po.id)).map((po) => (
                <th
                  key={po.id}
                  className={`matrix-col-${po.id} p-3 min-w-[280px] border-r border-(--op-border) bg-(--op-bg-surface) transition-colors duration-700`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-(--op-accent) font-mono font-bold uppercase">{po.language}</span>
                      <span className="text-(--op-text-primary) font-medium">{po.languageName}</span>
                      {po.entries.some((entry) => entry.msgidPlural) && <span className="px-1 py-0.5 rounded bg-(--op-accent)/10 text-(--op-accent-alt) border border-(--op-accent)/20 text-[9px] font-mono">{t('editor.plural')}</span>}
                    </div>
                    <span className="text-[9px] font-mono text-(--op-text-muted)">
                      {po.entries.filter((e) => e.msgstr.some((s) => s.trim() !== '')).length}/{po.entries.length}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {groupByCategory ? (
              categorizedGroups.map(([catName, entries]) => {
                const isCollapsed = collapsedCategories.has(catName);
                const totalColSpan = 1 + poFiles.length;

                return (
                  <React.Fragment key={catName}>
                    {/* Category Header Row */}
                    <tr
                      ref={(el) => setCategoryRowRef(catName, el)}
                      onClick={() => toggleCategory(catName)}
                      className="bg-[#12151B] border-y border-(--op-border) hover:bg-[#1A1F26] cursor-pointer transition-colors sticky top-[38px] z-10 select-none"
                    >
                      <td colSpan={totalColSpan} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-(--op-text-secondary) hover:text-white">
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-(--op-accent-alt)" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-(--op-accent-alt)" />
                              )}
                            </span>
                            <Folder className="w-3.5 h-3.5 text-(--op-warning)" />
                            <span className="font-semibold text-white font-sans text-xs tracking-wide">
                              {catName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-(--op-bg-raised) text-(--op-accent-alt) border border-(--op-border) text-[10px] font-mono font-bold">
                              {entries.length} {t('matrix.categoryKeys')}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-sans text-(--op-text-muted)">
                            <span>{isCollapsed ? 'Click to expand' : 'Click to collapse'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Group entries if not collapsed */}
                    {!isCollapsed && entries.map((entry) => renderEntryRow(entry))}
                  </React.Fragment>
                );
              })
            ) : (
              potEntries.map((potEntry) => renderEntryRow(potEntry))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

