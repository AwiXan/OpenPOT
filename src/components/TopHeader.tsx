import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  Download,
  FileCode,
  FileStack,
  Layers,
  FileSpreadsheet,
  Binary,
  Code2,
  Undo2,
  Redo2,
  GitBranch,
  Settings,
  FolderSync,
  RefreshCw,
  Unlink,
  Check,
  HelpCircle,
  Clock,
  Upload,
} from 'lucide-react';
import { Workspace, LocalDirectoryState } from '../types/gettext';
import { useTranslation, SUPPORTED_UI_LANGUAGES, UiLanguage } from '../lib/i18n';

interface TopHeaderProps {
  currentWorkspace: Workspace;
  onOpenNewKeyModal: () => void;
  onOpenAddLanguageModal: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onOpenRawPoModal: () => void;
  onOpenMoCompilerModal: () => void;
  onOpenBatchModal: () => void;
  onOpenGitModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAboutModal: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenLocalFolder: () => void;
  localDirState: LocalDirectoryState;
  onSyncLocalFolder: () => void;
  onDisconnectLocalFolder: () => void;
  viewMode: 'editor' | 'matrix';
  setViewMode: (mode: 'editor' | 'matrix') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  fuzzyThreshold: number;
  gitModifiedCount: number;
  recentFolders: string[];
  onOpenRecent: (path: string) => void;
}

type MenuKey = 'file' | 'edit' | 'view' | 'tools' | 'language' | 'help' | null;

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentWorkspace,
  onOpenNewKeyModal,
  onOpenAddLanguageModal,
  onOpenRawPoModal,
  onOpenMoCompilerModal,
  onOpenBatchModal,
  onOpenGitModal,
  onOpenSettingsModal,
  onOpenAboutModal,
  onImportFile,
  onOpenImportModal,
  onOpenExportModal,
  onOpenLocalFolder,
  localDirState,
  onSyncLocalFolder,
  onDisconnectLocalFolder,
  viewMode,
  setViewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  fuzzyThreshold,
  gitModifiedCount,
  recentFolders,
  onOpenRecent,
}) => {
  const { language: currentUiLang, setLanguage: setUiLanguage, t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolbarScrollRef = useRef<HTMLDivElement>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll bounds for quick actions toolbar
  const checkToolbarScroll = () => {
    const el = toolbarScrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkToolbarScroll();
    const el = toolbarScrollRef.current;
    if (!el) return;

    // Support mousewheel horizontal scrolling
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        el.scrollLeft += delta;
        checkToolbarScroll();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('scroll', checkToolbarScroll, { passive: true });
    window.addEventListener('resize', checkToolbarScroll);

    // Initial re-check after slight layout settle
    const timer = setTimeout(checkToolbarScroll, 100);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('scroll', checkToolbarScroll);
      window.removeEventListener('resize', checkToolbarScroll);
    };
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLangInfo =
    SUPPORTED_UI_LANGUAGES.find((l) => l.code === currentUiLang) || SUPPORTED_UI_LANGUAGES[0];

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onSyncLocalFolder();
    setTimeout(() => setIsSyncing(false), 500);
  };

  const handleMenuToggle = (menu: MenuKey) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuHover = (menu: MenuKey) => {
    if (activeMenu !== null) {
      setActiveMenu(menu);
    }
  };

  return (
    <header className="bg-(--op-bg-surface) border-b border-(--op-border) text-(--op-text-primary) select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onImportFile}
        accept=".po,.pot"
        multiple
        className="hidden"
      />

      {/* Top Application Window Bar & Native Desktop Menu */}
      <div
        ref={menuBarRef}
        className="h-9 px-3 flex items-center justify-between border-b border-(--op-border) text-xs bg-(--op-bg-canvas) relative z-40"
      >
        <div className="flex items-center space-x-2.5">

          {/* Desktop Menu Bar (File, Edit, View, Tools, Language, Help) */}
          <nav className="flex items-center space-x-0.5 text-xs text-(--op-text-secondary)">
            {/* FILE MENU */}
            <div className="relative">
              <button
                id="menu-file-btn"
                onClick={() => handleMenuToggle('file')}
                onMouseEnter={() => handleMenuHover('file')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'file'
                    ? 'bg-(--op-bg-raised-hover) text-white font-medium'
                    : 'hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                }`}
              >
                {t('menu.file')}
              </button>

              {activeMenu === 'file' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-(--op-bg-surface) border border-(--op-border) rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      onOpenLocalFolder();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FolderSync className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('menu.openFolder')}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-(--op-accent)" />
                      <span>{t('menu.openFiles')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">.po / .pot</span>
                  </button>
                  {recentFolders && recentFolders.length > 0 && (
                    <>
                      <div className="border-t border-(--op-border) my-1" />
                      <div className="px-3 py-1 text-[10px] font-bold text-(--op-text-muted) uppercase tracking-wider">
                        {t('menu.recents')}
                      </div>
                      {recentFolders.slice(0, 4).map((path) => {
                        const folderName = path.split(/[\\/]/).pop();
                        return (
                          <button
                            key={path}
                            onClick={() => {
                              onOpenRecent(path);
                              setActiveMenu(null);
                            }}
                            className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-secondary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Clock className="w-3.5 h-3.5 text-(--op-text-muted) group-hover:text-(--op-accent-alt) shrink-0" />
                              <span className="truncate text-[11px] text-(--op-text-primary) group-hover:text-(--op-accent-alt)">
                                {folderName}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono opacity-50 truncate max-w-[80px] ml-2">
                              {path}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  <div className="border-t border-(--op-border) my-1" />

                  <button
                    onClick={() => {
                      onOpenNewKeyModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-(--op-success)" />
                      <span>{t('menu.newKey')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">Ctrl+N</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenAddLanguageModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-(--op-success)" />
                      <span>{t('menu.addLanguage')}</span>
                    </div>
                  </button>

                  <div className="border-t border-(--op-border) my-1" />

                  <button
                    onClick={() => {
                      if (localDirState.isConnected) {
                        handleManualSync();
                      } else {
                        onOpenLocalFolder();
                      }
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('menu.saveSync')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">Ctrl+S</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenMoCompilerModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('menu.compileMo')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">.mo</span>
                  </button>

                  <div className="border-t border-(--op-border) my-1" />
                  
                  <button
                    onClick={() => {
                      onOpenImportModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-(--op-success-strong)" />
                      <span>{t('header.import')}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenExportModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-(--op-accent)" />
                      <span>{t('header.export')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">{t('menu.exportFormats')}</span>
                  </button>

                  {localDirState.isConnected && (
                    <>
                      <div className="border-t border-(--op-border) my-1" />
                      <button
                        onClick={() => {
                          onDisconnectLocalFolder();
                          setActiveMenu(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Unlink className="w-4 h-4 text-rose-400" />
                          <span>{t('menu.disconnectFolder')}</span>
                        </div>
                        <span className="text-[10px] font-mono truncate max-w-[80px]">
                          {localDirState.dirName}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* EDIT MENU */}
            <div className="relative">
              <button
                id="menu-edit-btn"
                onClick={() => handleMenuToggle('edit')}
                onMouseEnter={() => handleMenuHover('edit')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'edit'
                    ? 'bg-(--op-bg-raised-hover) text-white font-medium'
                    : 'hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                }`}
              >
                {t('menu.edit')}
              </button>

              {activeMenu === 'edit' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-(--op-bg-surface) border border-(--op-border) rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      if (canUndo) onUndo();
                      setActiveMenu(null);
                    }}
                    disabled={!canUndo}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      canUndo
                        ? 'text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt)'
                        : 'text-(--op-text-muted) opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Undo2 className="w-4 h-4" />
                      <span>{t('header.undo')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">Ctrl+Z</span>
                  </button>

                  <button
                    onClick={() => {
                      if (canRedo) onRedo();
                      setActiveMenu(null);
                    }}
                    disabled={!canRedo}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      canRedo
                        ? 'text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt)'
                        : 'text-(--op-text-muted) opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Redo2 className="w-4 h-4" />
                      <span>{t('header.redo')}</span>
                    </div>
                    <span className="text-[10px] text-(--op-text-muted) font-mono">Ctrl+Y</span>
                  </button>

                  <div className="border-t border-(--op-border) my-1" />

                  <button
                    onClick={() => {
                      onOpenBatchModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileStack className="w-4 h-4 text-(--op-warning)" />
                      <span>{t('menu.batchTm')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* VIEW MENU */}
            <div className="relative">
              <button
                id="menu-view-btn"
                onClick={() => handleMenuToggle('view')}
                onMouseEnter={() => handleMenuHover('view')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'view'
                    ? 'bg-(--op-bg-raised-hover) text-white font-medium'
                    : 'hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                }`}
              >
                {t('menu.view')}
              </button>

              {activeMenu === 'view' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-(--op-bg-surface) border border-(--op-border) rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      setViewMode('editor');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('menu.viewEditor')}</span>
                    </div>
                    {viewMode === 'editor' && <Check className="w-3.5 h-3.5 text-(--op-accent-alt)" />}
                  </button>

                  <button
                    onClick={() => {
                      setViewMode('matrix');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('menu.viewMatrix')}</span>
                    </div>
                    {viewMode === 'matrix' && <Check className="w-3.5 h-3.5 text-(--op-accent-alt)" />}
                  </button>

                  <div className="border-t border-(--op-border) my-1" />

                  <button
                    onClick={() => {
                      onOpenRawPoModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-(--op-text-secondary)" />
                      <span>{t('menu.viewRaw')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* TOOLS MENU */}
            <div className="relative">
              <button
                id="menu-tools-btn"
                onClick={() => handleMenuToggle('tools')}
                onMouseEnter={() => handleMenuHover('tools')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'tools'
                    ? 'bg-(--op-bg-raised-hover) text-white font-medium'
                    : 'hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                }`}
              >
                {t('menu.tools')}
              </button>

              {activeMenu === 'tools' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-(--op-bg-surface) border border-(--op-border) rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      onOpenMoCompilerModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('header.compileMo')}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenGitModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('header.git')}</span>
                    </div>
                    {gitModifiedCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-(--op-accent) text-white text-[9px] font-mono font-bold">
                        {gitModifiedCount}
                      </span>
                    )}
                  </button>

                  <div className="border-t border-(--op-border) my-1" />

                  <button
                    onClick={() => {
                      onOpenSettingsModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-(--op-text-secondary)" />
                      <span>{t('menu.preferences')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* LANGUAGE MENU (App UI Languages) */}
            <div className="relative">
              <button
                id="menu-language-btn"
                onClick={() => handleMenuToggle('language')}
                onMouseEnter={() => handleMenuHover('language')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                  activeMenu === 'language'
                    ? 'bg-(--op-bg-raised-hover) text-white font-medium'
                    : 'hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                }`}
              >
                <span>{t('menu.language')}</span>
                <span className="text-[10px] text-(--op-accent-alt) uppercase font-mono font-bold ml-0.5">
                  ({activeLangInfo.code})
                </span>
              </button>

              {activeMenu === 'language' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-(--op-bg-surface) border border-(--op-border) rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <div className="px-3 py-1 text-[10px] font-bold text-(--op-text-muted) uppercase tracking-wider border-b border-(--op-border)">
                    {t('settings.languageTab')}
                  </div>
                  {SUPPORTED_UI_LANGUAGES.map((lang) => {
                    const isCurrent = currentUiLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setUiLanguage(lang.code as UiLanguage);
                          setActiveMenu(null);
                        }}
                        className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-(--op-bg-active) text-(--op-accent-alt) font-semibold'
                            : 'text-(--op-text-secondary) hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.nativeName}</span>
                        </div>
                        {isCurrent ? (
                          <Check className="w-3.5 h-3.5 text-(--op-accent-alt)" />
                        ) : (
                          <span className="font-mono text-[10px] text-(--op-text-muted) uppercase">
                            {lang.code}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* HELP MENU */}
            <div className="relative">
              <button
                id="menu-help-btn"
                onClick={() => handleMenuToggle('help')}
                onMouseEnter={() => handleMenuHover('help')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'help'
                    ? 'bg-(--op-bg-raised-hover) text-white font-medium'
                    : 'hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                }`}
              >
                {t('menu.help')}
              </button>

              {activeMenu === 'help' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-(--op-bg-surface) border border-(--op-border) rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      onOpenAboutModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-(--op-text-primary) hover:bg-(--op-bg-active) hover:text-(--op-accent-alt) transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-(--op-accent-alt)" />
                      <span>{t('menu.about')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Status Indicator, Local Folder Sync, Git & TM Badges */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Local Folder Connected Status Badge */}
          {localDirState.isConnected ? (
            <div className="flex items-center gap-1.5 bg-(--op-success)/10 border border-(--op-success)/27 px-2 py-0.5 rounded text-[11px] font-mono text-(--op-success)">
              <FolderSync className="w-3 h-3 animate-pulse" />
              <span className="font-semibold max-w-[120px] truncate" title={localDirState.dirName}>
                {localDirState.dirName}
              </span>
              <span className="text-[9px] text-(--op-text-secondary)">
                {localDirState.autoCompileMo ? '(Auto .MO)' : '(Disk Sync)'}
              </span>
              <button
                onClick={handleManualSync}
                className="hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                title="Force Sync & Compile .MO to Disk"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onDisconnectLocalFolder}
                className="hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                title="Disconnect local folder"
              >
                <Unlink className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLocalFolder}
              className="flex items-center gap-1.5 text-[11px] font-mono bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border border-(--op-border) px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Open a local directory containing .pot and .po files for direct disk editing and automatic .mo generation"
            >
              <FolderSync className="w-3 h-3 text-(--op-accent-alt)" />
              <span>{t('menu.openFolder')}</span>
            </button>
          )}

          {/* Git Quick Status Badge */}
          <button
            id="btn-git-header"
            onClick={onOpenGitModal}
            className="flex items-center gap-1.5 text-[11px] font-mono bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) border border-(--op-border) px-2 py-0.5 rounded transition-colors cursor-pointer text-(--op-accent-alt)"
            title="Open Git Source Control & Commit History"
          >
            <GitBranch className="w-3 h-3 text-(--op-accent-alt)" />
            <span>{currentWorkspace.git?.branch || 'main'}</span>
            {gitModifiedCount > 0 && (
              <span className="px-1 py-0.2 rounded bg-(--op-accent) text-white text-[9px] font-bold">
                {gitModifiedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tool Bar (Pinned Ends + Scrollable Middle Track) */}
      <div className="relative flex items-center h-11 px-3 bg-(--op-bg-surface) border-t border-[#23272F]">
        {/* Left Pinned Items: History & New Key */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          {/* Undo / Redo */}
          <div className="flex items-center bg-(--op-bg-canvas) p-0.5 rounded border border-(--op-border)">
            <button
              id="btn-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                canUndo
                  ? 'text-(--op-text-primary) hover:bg-(--op-bg-raised) hover:text-(--op-accent-alt)'
                  : 'text-(--op-text-muted) opacity-40 cursor-not-allowed'
              }`}
              title={t('header.undo')}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-redo"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                canRedo
                  ? 'text-(--op-text-primary) hover:bg-(--op-bg-raised) hover:text-(--op-accent-alt)'
                  : 'text-(--op-text-muted) opacity-40 cursor-not-allowed'
              }`}
              title={t('header.redo')}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Key */}
          <button
            id="btn-add-key"
            onClick={onOpenNewKeyModal}
            className="bg-(--op-accent) hover:bg-(--op-accent-strong) text-white px-2.5 sm:px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-(--op-accent)/10 cursor-pointer"
            title="Add new msgid key to .pot and sync all .po files"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('header.addKey')}</span>
          </button>
        </div>

        <div className="h-5 w-[1px] bg-(--op-border) mx-1 shrink-0" />

        {/* Middle Scrollable Section with End Gradients */}
        <div className="relative flex-1 flex items-center min-w-0 overflow-hidden h-full">
          {/* Left fading edge gradient */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-(--op-bg-surface) to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Scrollable buttons track (scrollable by drag or mousewheel) */}
          <div
            ref={toolbarScrollRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1.5 py-1"
          >
            {/* File Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-open-folder"
                onClick={onOpenLocalFolder}
                className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
                title="Open local directory with .pot/.po files for live disk sync and automatic .mo compilation"
              >
                <FolderSync className="w-3.5 h-3.5 text-(--op-accent-alt)" />
                <span>{t('header.openFolder')}</span>
              </button>

              <button
                id="btn-import-file"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
                title="Import single or multiple .po / .pot files"
              >
                <FolderOpen className="w-3.5 h-3.5 text-(--op-accent)" />
                <span>{t('header.open')}</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-(--op-border) mx-0.5 shrink-0" />

            {/* Tools & Operations */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-batch-tm"
                onClick={onOpenBatchModal}
                className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
                title="Batch operations & Translation Memory fill"
              >
                <FileStack className="w-3.5 h-3.5 text-(--op-warning)" />
                <span>{t('header.batchTm')}</span>
              </button>

              <button
                id="btn-mo-compiler"
                onClick={onOpenMoCompilerModal}
                className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
                title="Compile GNU gettext .MO binary files"
              >
                <Binary className="w-3.5 h-3.5 text-(--op-accent-alt)" />
                <span>{t('header.compileMo')}</span>
              </button>

              <button
                id="btn-import"
                onClick={onOpenImportModal}
                className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
                title="Import translations"
              >
                <Upload className="w-3.5 h-3.5 text-(--op-success-strong)" />
                <span className="hidden sm:inline">{t('header.import')}</span>
              </button>

              <button
                id="btn-export"
                onClick={onOpenExportModal}
                className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
                title="Export translations"
              >
                <Download className="w-3.5 h-3.5 text-(--op-accent)" />
                <span>{t('header.export')}</span>
              </button>

              <button
                id="btn-view-raw-po"
                onClick={onOpenRawPoModal}
                className="px-2 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs border border-(--op-border) transition-colors cursor-pointer"
                title="Inspect & Edit Raw PO/POT source"
              >
                <Code2 className="w-3.5 h-3.5 text-(--op-text-secondary)" />
              </button>

            </div>
          </div>

          {/* Right fading edge gradient */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-(--op-bg-surface) to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {/* Right Pinned Items: Settings & View Mode Switcher */}
        <div className="flex items-center gap-2 pl-2 border-l border-(--op-border) shrink-0">
          {/* Settings Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettingsModal}
            className="px-2.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer shrink-0"
            title="Preferences, Modular Settings, and TM"
          >
            <Settings className="w-3.5 h-3.5 text-(--op-text-secondary)" />
            <span className="hidden sm:inline">{t('header.settings')}</span>
          </button>

          <div className="flex bg-(--op-bg-canvas) p-0.5 rounded border border-(--op-border) shrink-0">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'editor'
                  ? 'bg-(--op-bg-raised-hover) text-white font-medium shadow-xs'
                  : 'text-(--op-text-secondary) hover:text-(--op-text-primary)'
              }`}
              title="Standard Single Language Editor"
            >
              <FileCode className="w-3 h-3" />
              <span>{t('header.editor')}</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'matrix'
                  ? 'bg-(--op-bg-raised-hover) text-white font-medium shadow-xs'
                  : 'text-(--op-text-secondary) hover:text-(--op-text-primary)'
              }`}
              title="Multi-Language Matrix (Side-by-side editing)"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>{t('header.matrix')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input for single or multiple .po / .pot files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".po,.pot"
        onChange={onImportFile}
        className="hidden"
      />
    </header>
  );
};
