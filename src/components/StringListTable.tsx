import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  GripVertical,
} from 'lucide-react';
import { PoEntry, LintIssue } from '../types/gettext';
import { useTranslation } from '../lib/i18n';

interface StringListTableProps {
  entries: PoEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onToggleFuzzy: (id: string, e: React.MouseEvent) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  issuesMap: Map<string, LintIssue[]>;
  isPotTemplate: boolean;
  onRenameEntry?: (entryId: string, newMsgid: string) => void;
}

export const StringListTable: React.FC<StringListTableProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onToggleFuzzy,
  onDeleteEntry,
  issuesMap,
  isPotTemplate,
  onRenameEntry,
}) => {
  const { t } = useTranslation();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastAnchorIdRef = useRef<string | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [tempMsgid, setTempMsgid] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeEntryId) {
      setSelectedIds((prev) => {
        if (prev.has(activeEntryId) && prev.size > 1) return prev;
        return new Set([activeEntryId]);
      });
      if (!lastAnchorIdRef.current) {
        lastAnchorIdRef.current = activeEntryId;
      }
    }
  }, [activeEntryId]);

  useEffect(() => {
    if (editingEntryId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingEntryId]);

  const handleRowClick = (entry: PoEntry, e: React.MouseEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    let nextSelected = new Set<string>(selectedIds);
    let nextActiveId = entry.id;

    if (isShift && lastAnchorIdRef.current) {

      const anchorIndex = entries.findIndex((item) => item.id === lastAnchorIdRef.current);
      const currentIndex = entries.findIndex((item) => item.id === entry.id);

      if (anchorIndex !== -1 && currentIndex !== -1) {
        const [start, end] = [
          Math.min(anchorIndex, currentIndex),
          Math.max(anchorIndex, currentIndex),
        ];
        if (!isCtrlOrCmd) {
          nextSelected.clear();
        }
        for (let i = start; i <= end; i++) {
          nextSelected.add(entries[i].id);
        }
      }
    } else if (isCtrlOrCmd) {

      if (nextSelected.has(entry.id)) {
        if (nextSelected.size > 1) {
          nextSelected.delete(entry.id);
          nextActiveId = Array.from(nextSelected)[0];
        }
      } else {
        nextSelected.add(entry.id);
        nextActiveId = entry.id;
      }
      lastAnchorIdRef.current = entry.id;
    } else {

      nextSelected = new Set([entry.id]);
      lastAnchorIdRef.current = entry.id;
    }

    setSelectedIds(nextSelected);
    onSelectEntry(nextActiveId);
  };

  const handleStartRename = (entry: PoEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEntryId(entry.id);
    setTempMsgid(entry.msgid);
  };

  const handleCommitRename = (entry: PoEntry) => {
    const trimmed = tempMsgid.trim();
    if (trimmed && trimmed !== entry.msgid && onRenameEntry) {
      onRenameEntry(entry.id, trimmed);
    }
    setEditingEntryId(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-(--op-bg-canvas) border-r border-(--op-border) overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-(--op-bg-surface) border-b border-(--op-border) text-[10px] font-bold text-(--op-text-muted) uppercase tracking-wider z-10">
            <tr>
              <th className="px-3 py-2.5 w-6 text-center"></th>
              <th className="px-3 py-2.5">{t('table.sourceMsgid')}</th>
              <th className="px-3 py-2.5 w-28">{t('table.status')}</th>
              <th className="px-3 py-2.5 w-36">{t('table.validation')}</th>
              <th className="px-3 py-2.5 w-14 text-right"></th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {entries.map((entry) => {
              const isActive = entry.id === activeEntryId;
              const isMultiSelected = selectedIds.has(entry.id);
              const isFilled =
                entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim() !== '');
              const isFuzzy = entry.flags.includes('fuzzy');
              const isPlural = Boolean(entry.msgidPlural);
              const issues = issuesMap.get(entry.id) || [];
              const hasError = issues.some((i) => i.type === 'error');
              const hasWarning = issues.some((i) => i.type === 'warning');
              const issueSeverity = hasError ? 'error' : hasWarning ? 'warning' : 'info';
              const IssueIcon = hasError ? AlertCircle : hasWarning ? AlertTriangle : Info;
              const pluralIssues = issues.filter((issue) => issue.field === 'plural');

              let dotColor = 'text-(--op-text-muted)';
              if (isPotTemplate) {
                dotColor = 'text-(--op-accent)';
              } else if (hasError) {
                dotColor = 'text-(--op-danger)';
              } else if (isFuzzy) {
                dotColor = 'text-(--op-warning)';
              } else if (isFilled) {
                dotColor = 'text-(--op-success)';
              }

              return (
                <tr
                  key={entry.id}
                  draggable={editingEntryId !== entry.id}
                  style={{ WebkitUserDrag: editingEntryId === entry.id ? 'none' : 'element' } as any}
                  onDragStart={(e) => {
                    if (editingEntryId === entry.id) {
                      e.preventDefault();
                      return;
                    }
                    let idsToDrag = Array.from(selectedIds);
                    if (!selectedIds.has(entry.id)) {
                      idsToDrag = [entry.id];
                      setSelectedIds(new Set([entry.id]));
                      onSelectEntry(entry.id);
                    }
                    e.dataTransfer.setData('application/openpot-entries', JSON.stringify(idsToDrag));
                    e.dataTransfer.setData('text/plain', idsToDrag.join(','));
                    e.dataTransfer.effectAllowed = 'copyMove';
                  }}
                  onClick={(e) => handleRowClick(entry, e)}
                  className={`group border-b border-(--op-bg-surface) cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-(--op-bg-active) border-l-2 border-(--op-accent)'
                      : isMultiSelected
                      ? 'bg-(--op-bg-active)/60 border-l-2 border-(--op-accent-alt)/38'
                      : 'hover:bg-(--op-bg-active)/25'
                  }`}
                >
                  <td className={`px-3 py-2.5 text-center text-xs ${dotColor}`}>
                    ●
                  </td>

                  {/* Message ID / Content */}
                  <td className="px-3 py-2.5 overflow-hidden max-w-xs">
                    {editingEntryId === entry.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={tempMsgid}
                        onChange={(e) => setTempMsgid(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCommitRename(entry);
                          } else if (e.key === 'Escape') {
                            setEditingEntryId(null);
                          }
                        }}
                        onBlur={() => handleCommitRename(entry)}
                        className="w-full bg-(--op-bg-canvas) border border-(--op-accent) rounded px-1.5 py-0.5 text-xs font-mono text-(--op-accent-alt) outline-none shadow-inner"
                      />
                    ) : (
                      <div
                        className="flex items-center gap-1.5"
                        onDoubleClick={(e) => handleStartRename(entry, e)}
                        title="Double-click to rename key • Drag to move to category"
                      >
                        <span className="font-semibold text-(--op-text-primary) truncate hover:text-(--op-accent-alt) transition-colors">
                          {entry.msgid}
                        </span>
                        {isPlural && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-(--op-accent)/10 text-(--op-accent) font-mono shrink-0">
                            plural
                          </span>
                        )}
                        {entry.msgctxt && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-(--op-bg-raised) text-(--op-text-secondary) font-mono truncate shrink-0 border border-(--op-border)">
                            [{entry.msgctxt}]
                          </span>
                        )}
                      </div>
                    )}

                    {!isPotTemplate && (
                      <div className="text-[11px] text-(--op-text-secondary) font-sans truncate mt-0.5">
                        {isFilled ? entry.msgstr[0] : <span className="text-(--op-text-muted) italic">{t('table.untranslatedBadge')}</span>}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {isPotTemplate ? (
                      <span className="text-(--op-accent) bg-(--op-accent)/10 px-2 py-0.5 rounded text-[10px] font-mono">
                        TEMPLATE
                      </span>
                    ) : !isFilled ? (
                      <span className="text-(--op-text-muted) bg-(--op-text-muted)/10 px-2 py-0.5 rounded text-[10px] font-mono">
                        {t('table.untranslatedBadge')}
                      </span>
                    ) : isFuzzy ? (
                      <span className="text-(--op-warning) bg-(--op-warning)/10 px-2 py-0.5 rounded text-[10px] font-mono">
                        {t('table.fuzzyBadge')}
                      </span>
                    ) : (
                      <span className="text-(--op-success) bg-(--op-success)/10 px-2 py-0.5 rounded text-[10px] font-mono">
                        {t('editor.translated')}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {issues.length > 0 ? (
                      <div
                        className={`flex items-center gap-1.5 rounded px-1.5 py-1 border ${
                          issueSeverity === 'error'
                            ? 'border-(--op-danger)/40 bg-(--op-danger)/10'
                            : issueSeverity === 'warning'
                              ? 'border-(--op-warning)/40 bg-(--op-warning)/10'
                              : 'border-(--op-accent-alt)/40 bg-(--op-accent-alt)/10'
                        }`}
                        title={issues.map((issue) => issue.message).join('\n')}
                      >
                        <IssueIcon className={`w-3.5 h-3.5 shrink-0 ${issueSeverity === 'error' ? 'text-(--op-danger)' : issueSeverity === 'warning' ? 'text-(--op-warning)' : 'text-(--op-accent-alt)'}`} />
                        <span className={`text-[10px] font-semibold ${issueSeverity === 'error' ? 'text-(--op-danger)' : issueSeverity === 'warning' ? 'text-(--op-warning)' : 'text-(--op-accent-alt)'}`}>
                          {issues.length}
                        </span>
                        <span
                          className={`text-[10px] truncate max-w-[100px] ${
                            hasError ? 'text-(--op-danger)' : 'text-(--op-warning)'
                          }`}
                        >
                          {pluralIssues.length > 0 ? `${pluralIssues.length} ${t('table.pluralIssues')}` : t(`table.${issueSeverity}`)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-(--op-success) text-[10px]">{t('table.valid')}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isPotTemplate && (
                        <button
                          onClick={(e) => onToggleFuzzy(entry.id, e)}
                          className={`p-1 rounded hover:bg-(--op-border) ${
                            isFuzzy ? 'text-(--op-warning)' : 'text-(--op-text-muted) hover:text-(--op-text-primary)'
                          }`}
                          title="Toggle fuzzy status"
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => onDeleteEntry(entry.id, e)}
                        className="p-1 rounded hover:bg-rose-950/40 text-(--op-text-muted) hover:text-(--op-danger)"
                        title={t('table.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-(--op-text-muted) font-sans">
                  {t('table.noStrings')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};