import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitBranch,
  GitCommit as GitCommitIcon,
  Plus,
  Minus,
  CheckCircle2,
  FolderGit2,
  AlertTriangle,
  History,
  FileDiff,
  User,
  Clock,
  Hash,
  ChevronLeft,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';
import {
  checkIsGitInitialized,
  getGitStatus,
  initGitRepo,
  stageFiles,
  unstageFiles,
  commitChanges,
  getCurrentBranch,
  getGitLog,
  getCommitFilesChanged,
  getWorkingTreeDiff,
  getCommitFileDiff,
  parseStatusLine,
  revertFile,
  ParsedGitStatusLine,
  GitLogEntry,
  GitFileChange,
  GitChangeStatus,
} from '../lib/systemGit';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string | null;
  authorName: string;
  authorEmail: string;
  onRevertFile?: (filename: string) => void | Promise<void>;
}

type StatusMeta = { label: string; className: string };

const WORKING_STATUS_META: Record<string, StatusMeta> = {
  A: { label: 'A', className: 'text-(--op-success) bg-(--op-success)/10 border-(--op-success)/20' },
  M: { label: 'M', className: 'text-(--op-warning) bg-(--op-warning)/10 border-(--op-warning)/20' },
  D: { label: 'D', className: 'text-(--op-danger) bg-(--op-danger)/10 border-(--op-danger)/20' },
  R: { label: 'R', className: 'text-(--op-accent-alt) bg-(--op-accent-alt)/10 border-(--op-accent-alt)/20' },
  C: { label: 'C', className: 'text-(--op-accent-alt) bg-(--op-accent-alt)/10 border-(--op-accent-alt)/20' },
  U: { label: 'U', className: 'text-(--op-danger) bg-(--op-danger)/10 border-(--op-danger)/20' },
  UNTRACKED: { label: 'U', className: 'text-(--op-text-secondary) bg-(--op-text-secondary)/10 border-(--op-text-secondary)/20' },
  DEFAULT: { label: '?', className: 'text-(--op-text-secondary) bg-(--op-text-secondary)/10 border-(--op-text-secondary)/20' },
};

const COMMIT_STATUS_META: Record<GitChangeStatus, StatusMeta> = {
  added: { label: 'A', className: 'text-(--op-success) bg-(--op-success)/10 border-(--op-success)/20' },
  modified: { label: 'M', className: 'text-(--op-warning) bg-(--op-warning)/10 border-(--op-warning)/20' },
  deleted: { label: 'D', className: 'text-(--op-danger) bg-(--op-danger)/10 border-(--op-danger)/20' },
  renamed: { label: 'R', className: 'text-(--op-accent-alt) bg-(--op-accent-alt)/10 border-(--op-accent-alt)/20' },
  copied: { label: 'C', className: 'text-(--op-accent-alt) bg-(--op-accent-alt)/10 border-(--op-accent-alt)/20' },
  unmerged: { label: 'U', className: 'text-(--op-danger) bg-(--op-danger)/10 border-(--op-danger)/20' },
  unknown: { label: '?', className: 'text-(--op-text-secondary) bg-(--op-text-secondary)/10 border-(--op-text-secondary)/20' },
};

function getWorkingStatusMeta(entry: ParsedGitStatusLine, staged: boolean): StatusMeta {
  if (entry.isUntracked) return WORKING_STATUS_META.UNTRACKED;
  const code = staged ? entry.indexStatus : entry.worktreeStatus;
  return WORKING_STATUS_META[code] || WORKING_STATUS_META.DEFAULT;
}

const DiffLines: React.FC<{ diffText: string }> = ({ diffText }) => {
  const lines = useMemo(() => diffText.split('\n'), [diffText]);

  return (
    <pre className="bg-(--op-bg-canvas) rounded border border-(--op-border) p-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre">
      {lines.map((line, i) => {
        let cls = 'text-(--op-text-secondary)';
        if (line.startsWith('+++') || line.startsWith('---')) cls = 'text-(--op-text-muted)';
        else if (line.startsWith('@@')) cls = 'text-(--op-accent-alt) font-semibold';
        else if (line.startsWith('diff --git') || line.startsWith('index ')) cls = 'text-(--op-text-muted)';
        else if (line.startsWith('+')) cls = 'text-(--op-success) bg-(--op-success)/5';
        else if (line.startsWith('-')) cls = 'text-(--op-danger) bg-(--op-danger)/5';

        return (
          <div key={i} className={`${cls} px-1 -mx-1`}>
            {line.length > 0 ? line : '\u00A0'}
          </div>
        );
      })}
    </pre>
  );
};

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  authorName,
  authorEmail,
  onRevertFile,
}) => {
  const { t } = useTranslation();

  const [isInitialized, setIsInitialized] = useState(false);
  const [branch, setBranch] = useState('main');
  const [statusEntries, setStatusEntries] = useState<ParsedGitStatusLine[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Status tab
  const [selectedEntry, setSelectedEntry] = useState<{ file: string; staged: boolean } | null>(null);
  const [workingDiff, setWorkingDiff] = useState('');
  const [workingDiffLoading, setWorkingDiffLoading] = useState(false);

  // History tab
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitFiles, setCommitFiles] = useState<GitFileChange[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  const [selectedCommitFile, setSelectedCommitFile] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState('');
  const [commitDiffLoading, setCommitDiffLoading] = useState(false);

  const refreshGitState = useCallback(async () => {
    if (!folderPath) return;
    setIsLoading(true);
    const initialized = await checkIsGitInitialized(folderPath);
    setIsInitialized(initialized);

    if (initialized) {
      const [rawStatus, currentBranch] = await Promise.all([
        getGitStatus(folderPath),
        getCurrentBranch(folderPath),
      ]);
      setStatusEntries(rawStatus.map(parseStatusLine));
      setBranch(currentBranch);
    }
    setIsLoading(false);
  }, [folderPath]);

  const fetchLog = useCallback(async () => {
    if (!folderPath) return;
    setLogLoading(true);
    const entries = await getGitLog(folderPath);
    setGitLog(entries);
    setLogLoading(false);
  }, [folderPath]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('status');
      refreshGitState();
    }
  }, [isOpen, refreshGitState]);

  useEffect(() => {
    if (activeTab === 'history' && isInitialized && gitLog.length === 0 && !logLoading) {
      fetchLog();
    }
  }, [activeTab, isInitialized, gitLog.length, logLoading, fetchLog]);

  const stagedEntries = useMemo(() => statusEntries.filter((e) => e.staged), [statusEntries]);
  const unstagedEntries = useMemo(() => statusEntries.filter((e) => !e.staged), [statusEntries]);

  useEffect(() => {
    if (activeTab !== 'status') return;
    const stillValid =
      selectedEntry && statusEntries.some((e) => e.file === selectedEntry.file && e.staged === selectedEntry.staged);
    if (stillValid) return;

    const fallback = stagedEntries[0] || unstagedEntries[0] || null;
    setSelectedEntry(fallback ? { file: fallback.file, staged: fallback.staged } : null);
  }, [statusEntries, activeTab, selectedEntry, stagedEntries, unstagedEntries]);

  const selectedEntryKey = selectedEntry ? `${selectedEntry.staged ? 's' : 'u'}:${selectedEntry.file}` : null;

  useEffect(() => {
    if (!folderPath || !selectedEntry) {
      setWorkingDiff('');
      return;
    }
    let cancelled = false;
    setWorkingDiffLoading(true);
    getWorkingTreeDiff(folderPath, selectedEntry.file, selectedEntry.staged).then((diff) => {
      if (!cancelled) {
        setWorkingDiff(diff);
        setWorkingDiffLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, selectedEntryKey, selectedEntry]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    const stillValid = selectedCommitHash && gitLog.some((c) => c.hash === selectedCommitHash);
    if (stillValid) return;
    setSelectedCommitHash(gitLog[0]?.hash || null);
  }, [gitLog, activeTab, selectedCommitHash]);

  useEffect(() => {
    if (!folderPath || !selectedCommitHash) {
      setCommitFiles([]);
      return;
    }
    let cancelled = false;
    setCommitFilesLoading(true);
    setSelectedCommitFile(null);
    getCommitFilesChanged(folderPath, selectedCommitHash).then((files) => {
      if (!cancelled) {
        setCommitFiles(files);
        setCommitFilesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, selectedCommitHash]);

  useEffect(() => {
    if (!folderPath || !selectedCommitHash || !selectedCommitFile) {
      setCommitDiff('');
      return;
    }
    let cancelled = false;
    setCommitDiffLoading(true);
    getCommitFileDiff(folderPath, selectedCommitHash, selectedCommitFile).then((diff) => {
      if (!cancelled) {
        setCommitDiff(diff);
        setCommitDiffLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, selectedCommitHash, selectedCommitFile]);

  const handleInit = async () => {
    if (!folderPath) return;
    setIsLoading(true);
    try {
      await initGitRepo(folderPath);
      await refreshGitState();
    } catch (err: any) {
      alert(`Git Init failed: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStage = async (file: string) => {
    if (!folderPath) return;
    await stageFiles(folderPath, [file]);
    await refreshGitState();
  };

  const handleUnstage = async (file: string) => {
    if (!folderPath) return;
    await unstageFiles(folderPath, [file]);
    await refreshGitState();
  };

  const handleStageAll = async () => {
    if (!folderPath || unstagedEntries.length === 0) return;
    await stageFiles(folderPath, unstagedEntries.map((e) => e.file));
    await refreshGitState();
  };

  const handleUnstageAll = async () => {
    if (!folderPath || stagedEntries.length === 0) return;
    await unstageFiles(folderPath, stagedEntries.map((e) => e.file));
    await refreshGitState();
  };

  const handleRevert = async (file: string) => {
    if (!folderPath) return;
    const confirmMsg = (t('git.revertConfirm') || 'Are you sure you want to discard changes in "{file}" to HEAD?\nThis action cannot be undone.')
      .replace('{file}', file);
    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await revertFile(folderPath, file);

      if (onRevertFile) {
        await onRevertFile(file);
      }

      await refreshGitState();
    } catch (err: any) {
      const errMsg = (t('git.revertFailed') || 'Failed to revert file: {error}')
      .replace('{error}', err?.message || String(err));
    alert(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!folderPath || !commitMessage.trim() || stagedEntries.length === 0) return;
    setIsCommitting(true);
    try {
      await commitChanges(folderPath, commitMessage.trim(), authorName, authorEmail);
      setCommitMessage('');
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3000);
      await refreshGitState();
      if (gitLog.length > 0) await fetchLog();
    } catch (err: any) {
      alert(`Commit failed: ${err?.message || err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCommitKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  };

  const modalFooter = folderPath && isInitialized ? (
    <div className="w-full flex flex-col gap-1.5">
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleCommitKeyDown}
          placeholder={t('git.commitPlaceholder')}
          className="flex-1 bg-(--op-bg-surface) border border-(--op-border) rounded px-3 py-1.5 text-xs text-white focus:border-(--op-accent) outline-none"
        />
        <button
          onClick={handleCommit}
          disabled={stagedEntries.length === 0 || !commitMessage.trim() || isCommitting}
          className="px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-2 bg-(--op-accent) hover:bg-(--op-accent-strong) text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommitIcon className="w-4 h-4" />}
          {t('git.commitButton')}
        </button>
      </div>
      <div className="flex items-center justify-between text-[10px] text-(--op-text-muted) font-mono px-0.5">
        <span className="truncate max-w-[220px]" title={`${authorName} <${authorEmail}>`}>
          {t('git.author')}: {authorName || 'Translator'}
        </span>
        <span>
          {stagedEntries.length} {t('git.stagedCount')} · Ctrl+Enter
        </span>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('git.title')}
      subtitle={folderPath || t('git.folderNotConnected')}
      icon={<GitBranch className="w-4 h-4" />}
      maxWidth="max-w-6xl"
      footer={modalFooter}
    >
      {!folderPath ? (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-(--op-warning)" />
          <h4 className="text-base font-semibold text-white">{t('git.folderNotConnected')}</h4>
          <p className="text-xs text-(--op-text-secondary)">{t('git.folderNotConnectedDesc')}</p>
        </div>
      ) : !isInitialized ? (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <FolderGit2 className="w-10 h-10 text-(--op-accent)" />
          <h4 className="text-base font-semibold text-white">{t('git.initTitle')}</h4>
          <button
            onClick={handleInit}
            disabled={isLoading}
            className="px-5 py-2 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderGit2 className="w-4 h-4" />}
            {t('git.initRepo')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-[70vh]">
          {/* Toolbar */}
          <div className="px-4 py-2 border-b border-(--op-border) flex items-center justify-between shrink-0">
            <div className="flex bg-(--op-bg-canvas) p-0.5 rounded border border-(--op-border) text-xs">
              <button
                onClick={() => setActiveTab('status')}
                className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'status'
                    ? 'bg-(--op-bg-raised-hover) text-white font-semibold shadow-xs'
                    : 'text-(--op-text-secondary) hover:text-(--op-text-primary)'
                  }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>{t('git.changes')}</span>
                {stagedEntries.length + unstagedEntries.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-(--op-accent) text-white text-[10px] font-mono font-bold">
                    {stagedEntries.length + unstagedEntries.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'history'
                    ? 'bg-(--op-bg-raised-hover) text-white font-semibold shadow-xs'
                    : 'text-(--op-text-secondary) hover:text-(--op-text-primary)'
                  }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  {t('git.history')} {gitLog.length > 0 ? `(${gitLog.length})` : ''}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-(--op-bg-raised) text-(--op-accent-alt) border border-(--op-border) font-mono text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-(--op-accent-alt)" />
                {branch}
              </span>
              <button
                onClick={() => {
                  refreshGitState();
                  if (activeTab === 'history') fetchLog();
                }}
                className="p-1.5 rounded text-(--op-text-muted) hover:text-(--op-text-primary) hover:bg-(--op-bg-raised) transition-colors cursor-pointer"
                title={t('git.refresh')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {activeTab === 'status' ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: staging list */}
              <div className="w-72 border-r border-(--op-border) bg-(--op-bg-inset) flex flex-col shrink-0 overflow-hidden">
                <div className="p-3 border-b border-(--op-border) flex items-center justify-between bg-(--op-bg-surface)">
                  <span className="text-[11px] font-semibold text-(--op-text-secondary) uppercase tracking-wider">
                    {t('git.sourceControl')}
                  </span>
                  <div className="flex items-center gap-1">
                    {unstagedEntries.length > 0 && (
                      <button
                        onClick={handleStageAll}
                        className="px-2 py-0.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-accent-alt) text-[10px] font-medium border border-(--op-border) transition-colors cursor-pointer flex items-center gap-1"
                        title={t('git.stageAll')}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t('git.stageAll')}</span>
                      </button>
                    )}
                    {stagedEntries.length > 0 && (
                      <button
                        onClick={handleUnstageAll}
                        className="px-2 py-0.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) text-[10px] font-medium border border-(--op-border) transition-colors cursor-pointer flex items-center gap-1"
                        title={t('git.unstageAll')}
                      >
                        <Minus className="w-3 h-3" />
                        <span>{t('git.unstageAll')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {successNotice && (
                  <div className="m-2 p-2 rounded bg-(--op-success)/10 border border-(--op-success)/20 text-(--op-success) text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('git.commitSuccess')}</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                  {/* Staged Changes */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-semibold text-(--op-accent-alt)">
                      {t('git.stagedChanges')} ({stagedEntries.length})
                    </div>
                    {stagedEntries.length === 0 ? (
                      <div className="px-2 py-2 text-[11px] text-(--op-text-muted) italic">{t('git.noFilesStaged')}</div>
                    ) : (
                      <div className="space-y-1">
                        {stagedEntries.map((entry) => {
                          const meta = getWorkingStatusMeta(entry, true);
                          const isActive = selectedEntry?.file === entry.file && selectedEntry?.staged;
                          return (
                            <div
                              key={`s:${entry.file}`}
                              onClick={() => setSelectedEntry({ file: entry.file, staged: true })}
                              className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${isActive ? 'bg-(--op-bg-raised) border border-(--op-accent)' : 'hover:bg-(--op-bg-surface) border border-transparent'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`shrink-0 font-mono text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded border ${meta.className}`}>
                                  {meta.label}
                                </span>
                                <span className="font-mono text-white truncate text-[11px]" title={entry.oldFile ? `${entry.oldFile} \u2192 ${entry.file}` : entry.file}>
                                  {entry.oldFile ? `${entry.oldFile} \u2192 ${entry.file}` : entry.file}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevert(entry.file);
                                  }}
                                  className="p-1 rounded text-(--op-text-secondary) hover:text-(--op-danger) hover:bg-(--op-danger)/10 transition-colors cursor-pointer"
                                  title={t('git.revertTooltip')}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnstage(entry.file);
                                  }}
                                  className="p-1 rounded text-(--op-text-secondary) hover:text-white hover:bg-(--op-border) transition-colors cursor-pointer"
                                  title={t('git.unstageFile')}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Unstaged Changes */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-semibold text-(--op-warning)">
                      {t('git.unstagedChanges')} ({unstagedEntries.length})
                    </div>
                    {unstagedEntries.length === 0 ? (
                      <div></div>
                    ) : (
                      <div className="space-y-1">
                        {unstagedEntries.map((entry) => {
                          const meta = getWorkingStatusMeta(entry, false);
                          const isActive = selectedEntry?.file === entry.file && !selectedEntry?.staged;
                          return (
                            <div
                              key={`u:${entry.file}`}
                              onClick={() => setSelectedEntry({ file: entry.file, staged: false })}
                              className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${isActive ? 'bg-(--op-bg-raised) border border-(--op-accent)' : 'hover:bg-(--op-bg-surface) border border-transparent'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`shrink-0 font-mono text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded border ${meta.className}`}>
                                  {meta.label}
                                </span>
                                <span className="font-mono text-(--op-text-secondary) truncate text-[11px]" title={entry.file}>
                                  {entry.file}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevert(entry.file);
                                  }}
                                  className="p-1 rounded text-(--op-text-secondary) hover:text-(--op-danger) hover:bg-(--op-danger)/10 transition-colors cursor-pointer"
                                  title={t('git.revertTooltip')}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStage(entry.file);
                                  }}
                                  className="p-1 rounded text-(--op-success) hover:bg-(--op-success)/10 transition-colors cursor-pointer"
                                  title={t('git.stageFile')}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: diff viewer */}
              <div className="flex-1 flex flex-col bg-(--op-bg-canvas) overflow-hidden">
                <div className="px-4 py-2.5 border-b border-(--op-border) bg-(--op-bg-surface) flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileDiff className="w-4 h-4 text-(--op-accent-alt) shrink-0" />
                    <span className="text-xs font-semibold text-white font-mono truncate">
                      {selectedEntry?.file || t('git.selectFileDiff')}
                    </span>
                  </div>
                  {selectedEntry && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${selectedEntry.staged
                            ? 'bg-(--op-accent-alt)/10 text-(--op-accent-alt) border border-(--op-accent-alt)/20'
                            : 'bg-(--op-warning)/10 text-(--op-warning) border border-(--op-warning)/20'
                          }`}
                      >
                        {selectedEntry.staged ? t('git.stagedBadge') : t('git.workingTreeBadge')}
                      </span>
                      <button
                        onClick={() => handleRevert(selectedEntry.file)}
                        disabled={isLoading}
                        className="px-2 py-0.5 rounded bg-(--op-danger)/10 hover:bg-(--op-danger)/20 text-(--op-danger) border border-(--op-danger)/20 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        title={t('git.revertSelectedTooltip')}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('git.revert')}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {!selectedEntry ? (
                    <div className="h-full flex items-center justify-center text-(--op-text-muted) text-xs">
                      {t('git.selectLeftDiff')}
                    </div>
                  ) : workingDiffLoading ? (
                    <div className="h-full flex items-center justify-center text-(--op-text-muted) text-xs gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.loading')}
                    </div>
                  ) : workingDiff ? (
                    <DiffLines diffText={workingDiff} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-(--op-text-muted) text-xs px-8">
                      <span>{t('git.noDiffHead')}</span>
                      {!selectedEntry.staged && (
                        <span className="text-[11px]">{t('git.matchSnapshot')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Commit History tab */}
              <div className="w-80 border-r border-(--op-border) bg-(--op-bg-inset) flex flex-col shrink-0 overflow-y-auto p-2 space-y-1.5">
                {logLoading ? (
                  <div className="h-full flex items-center justify-center text-(--op-text-muted) text-xs gap-2 py-8">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : gitLog.length === 0 ? (
                  <div className="px-2 py-8 text-center text-[11px] text-(--op-text-muted) italic">{t('git.noCommitsYet')}</div>
                ) : (
                  gitLog.map((commit, idx) => (
                    <div
                      key={commit.hash}
                      onClick={() => setSelectedCommitHash(commit.hash)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all space-y-1.5 ${selectedCommitHash === commit.hash
                          ? 'bg-(--op-bg-raised) border-(--op-accent)'
                          : 'bg-(--op-bg-surface) border-(--op-border) hover:border-(--op-accent)/40'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-(--op-accent-alt) text-[11px] font-bold flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {commit.shortHash}
                          {idx === 0 && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-(--op-accent) text-white text-[9px]">HEAD</span>
                          )}
                        </span>
                        <span className="text-[10px] text-(--op-text-muted)">{new Date(commit.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-white font-medium line-clamp-2 text-xs">{commit.subject}</div>
                      <div className="text-[10px] text-(--op-text-muted) truncate">{commit.authorName}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex-1 flex flex-col bg-(--op-bg-canvas) overflow-hidden">
                {!selectedCommitHash ? (
                  <div className="h-full flex items-center justify-center text-(--op-text-muted) text-xs">
                    {t('git.selectCommitLeft')}
                  </div>
                ) : selectedCommitFile ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-(--op-border) bg-(--op-bg-surface) flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedCommitFile(null)}
                        className="p-1 rounded text-(--op-text-secondary) hover:text-white hover:bg-(--op-bg-raised) cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <FileDiff className="w-4 h-4 text-(--op-accent-alt)" />
                      <span className="text-xs font-semibold text-white font-mono truncate">{selectedCommitFile}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {commitDiffLoading ? (
                        <div className="h-full flex items-center justify-center text-(--op-text-muted) text-xs gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('common.loading')}
                        </div>
                      ) : commitDiff ? (
                        <DiffLines diffText={commitDiff} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-(--op-text-muted) text-xs">
                          {t('git.noWorkingDiff')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {(() => {
                      const commit = gitLog.find((c) => c.hash === selectedCommitHash);
                      if (!commit) return null;
                      return (
                        <div className="p-4 border-b border-(--op-border) bg-(--op-bg-surface) space-y-2 shrink-0">
                          <h4 className="text-sm font-semibold text-white">{commit.subject}</h4>
                          <div className="flex items-center gap-3 text-xs text-(--op-text-secondary) font-mono flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-(--op-accent)" />
                              {commit.authorName} &lt;{commit.authorEmail}&gt;
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-(--op-text-muted)" />
                              {new Date(commit.date).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-(--op-text-muted)">
                            {t('git.fullHash')}: <span className="text-(--op-text-secondary)">{commit.hash}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <div className="text-xs font-semibold text-(--op-text-secondary)">
                        {t('git.changedFilesInCommit')} ({commitFiles.length}):
                      </div>

                      {commitFilesLoading ? (
                        <div className="flex items-center justify-center text-(--op-text-muted) text-xs gap-2 py-8">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : (
                        commitFiles.map((file) => {
                          const meta = COMMIT_STATUS_META[file.status];
                          return (
                            <div
                              key={file.filename}
                              onClick={() => setSelectedCommitFile(file.filename)}
                              className="bg-(--op-bg-surface) border border-(--op-border) hover:border-(--op-accent)/40 p-3 rounded-lg flex items-center justify-between text-xs font-mono cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 font-mono text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded border ${meta.className}`}>
                                  {meta.label}
                                </span>
                                <span className="text-white font-semibold truncate" title={file.oldFilename ? `${file.oldFilename} \u2192 ${file.filename}` : file.filename}>
                                  {file.oldFilename ? `${file.oldFilename} \u2192 ${file.filename}` : file.filename}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] shrink-0">
                                {file.additions > 0 && <span className="text-(--op-success)">+{file.additions}</span>}
                                {file.deletions > 0 && <span className="text-(--op-danger)">-{file.deletions}</span>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};