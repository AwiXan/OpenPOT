import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Layers,
  FileQuestion,
  Clock,
  AlertTriangle,
  Hash,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Trash2,
  ChevronsDown,
  ChevronsUp,
  GripHorizontal,
  Plus,
  X,
  Filter,
  CornerDownRight,
} from 'lucide-react';
import { CategoryNode } from '../lib/categorizer';
import { FilterStatus } from '../types/gettext';
import { useTranslation } from '../lib/i18n';

interface SidebarCategoriesProps {
  categoryTree: CategoryNode[];
  selectedCategory: string | null;
  onSelectCategory: (categoryFullPath: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  stats: {
    total: number;
    translated: number;
    untranslated: number;
    fuzzy: number;
    issues: number;
    plurals: number;
  };
  onAddCategory?: (categoryPath: string) => void;
  onCreateKeyInCategory?: (categoryFullPath: string) => void;
  onRenameCategory?: (oldPath: string, newPath: string) => void;
  onDeleteCategory?: (categoryPath: string) => void;
  onReorderCategories?: (sourcePath: string, targetPath: string | null, position: 'before' | 'after' | 'inside') => void;
  onDropEntriesToCategory?: (entryIds: string[], categoryPath: string) => void; 
}

export const SidebarCategories: React.FC<SidebarCategoriesProps> = ({
  categoryTree,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  stats,
  onAddCategory,
  onCreateKeyInCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onDropEntriesToCategory,
}) => {
  const { t } = useTranslation();

  const [statusFiltersHeight, setStatusFiltersHeight] = useState<number>(205);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const statusFiltersRef = useRef<HTMLDivElement>(null);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryPath, setNewCategoryPath] = useState('');
  const [parentPathForNewCategory, setParentPathForNewCategory] = useState<string | null>(null);

  // Drag and drop state
  const [draggedCategoryPath, setDraggedCategoryPath] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    path: string;
    position: 'before' | 'after' | 'inside';
  } | null>(null);
  const [dragOverEntryCategory, setDragOverEntryCategory] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  // Inline rename state
  const [editingCategoryPath, setEditingCategoryPath] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCategoryPath && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCategoryPath]);

  const handleCommitRename = (node: CategoryNode) => {
    const trimmed = editingCategoryName.trim();
    if (trimmed && trimmed !== node.name && onRenameCategory) {
      const pathParts = node.fullPath.split(' / ');
      pathParts[pathParts.length - 1] = trimmed;
      const newFullPath = pathParts.join(' / ');
      onRenameCategory(node.fullPath, newFullPath);
    }
    setEditingCategoryPath(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit) return;
      const filterRect = statusFiltersRef.current?.getBoundingClientRect();
      const sidebarEl = document.getElementById('openpot-sidebar-container');
      if (!filterRect || !sidebarEl) return;

      const sidebarRect = sidebarEl.getBoundingClientRect();
      const scale = (sidebarRect.width / sidebarEl.offsetWidth) || 1;

      const unscaledDeltaY = (e.clientY - filterRect.top) / scale;
      const unscaledMaxHeight = Math.max(90, (sidebarRect.bottom - filterRect.top) / scale - 120);

      const clampedHeight = Math.max(90, Math.min(unscaledMaxHeight, unscaledDeltaY));
      setStatusFiltersHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    if (isDraggingSplit) {
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingSplit]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const set = new Set<string>();
    function addExpanded(nodes: CategoryNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) {
          set.add(node.fullPath);
          addExpanded(node.children);
        }
      }
    }
    addExpanded(categoryTree);
    return set;
  });

  useEffect(() => {
    const validParentPaths = new Set<string>();
    function collectParentPaths(nodes: CategoryNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) {
          validParentPaths.add(n.fullPath);
          collectParentPaths(n.children);
        }
      }
    }
    collectParentPaths(categoryTree);

    setExpandedPaths((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const p of prev) {
        if (validParentPaths.has(p)) {
          next.add(p);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [categoryTree]);

  const toggleExpand = (fullPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  };

  const expandAll = () => {
    const set = new Set<string>();
    function addAll(nodes: CategoryNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) {
          set.add(n.fullPath);
          addAll(n.children);
        }
      }
    }
    addAll(categoryTree);
    setExpandedPaths(set);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  const handleNodeDragOver = (e: React.DragEvent, nodePath: string) => {

    if (e.dataTransfer.types.includes('application/openpot-entries')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverEntryCategory(nodePath);
      return;
    }


    if (!draggedCategoryPath || draggedCategoryPath === nodePath) return;
    if (nodePath.startsWith(draggedCategoryPath + ' / ')) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'inside' = 'inside';
    if (offsetY < height * 0.25) {
      position = 'before';
    } else if (offsetY > height * 0.75) {
      position = 'after';
    }

    setDragOverTarget({ path: nodePath, position });
  };

  const handleNodeDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();

    const rawEntries = e.dataTransfer.getData('application/openpot-entries');
    if (rawEntries && onDropEntriesToCategory) {
      try {
        const ids = JSON.parse(rawEntries);
        if (Array.isArray(ids) && ids.length > 0) {
          onDropEntriesToCategory(ids, targetPath);
        }
      } catch (err) {
        console.error('Failed to parse dropped entry IDs:', err);
      }
      setDragOverEntryCategory(null);
      return;
    }

    if (!draggedCategoryPath || !onReorderCategories || draggedCategoryPath === targetPath || targetPath.startsWith(draggedCategoryPath + ' / ')) {
      setDraggedCategoryPath(null);
      setDragOverTarget(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'inside' = 'inside';
    if (offsetY < height * 0.25) position = 'before';
    else if (offsetY > height * 0.75) position = 'after';

    onReorderCategories(draggedCategoryPath, targetPath, position);

    if (position === 'inside') {
      setExpandedPaths((prev) => new Set([...prev, targetPath]));
    }

    setDraggedCategoryPath(null);
    setDragOverTarget(null);
  };

  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);

    const rawEntries = e.dataTransfer.getData('application/openpot-entries');
    if (rawEntries && onDropEntriesToCategory) {
      try {
        const ids = JSON.parse(rawEntries);
        if (Array.isArray(ids) && ids.length > 0) {
          onDropEntriesToCategory(ids, '');
        }
      } catch {}
      setDragOverEntryCategory(null);
      return;
    }

    if (!draggedCategoryPath || !onReorderCategories) return;
    onReorderCategories(draggedCategoryPath, null, 'inside');
    setDraggedCategoryPath(null);
    setDragOverTarget(null);
  };

  const renderTreeNode = (node: CategoryNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedPaths.has(node.fullPath);
    const isSelected = selectedCategory === node.fullPath;
    const isAncestorOfSelected =
      selectedCategory !== null &&
      selectedCategory !== node.fullPath &&
      selectedCategory.startsWith(node.fullPath + ' / ');

    const isDragging = draggedCategoryPath === node.fullPath;
    const isTarget = dragOverTarget?.path === node.fullPath;
    const isTargetInside = isTarget && dragOverTarget?.position === 'inside';
    const isTargetBefore = isTarget && dragOverTarget?.position === 'before';
    const isTargetAfter = isTarget && dragOverTarget?.position === 'after';
    const isEntryTarget = dragOverEntryCategory === node.fullPath;
    const hasWarnings = (node.untranslatedCount > 0) || (node.issueCount > 0) || (node.fuzzyCount > 0);

    return (
      <div key={node.id} className="flex flex-col select-none relative">
        <div
          draggable={editingCategoryPath !== node.fullPath}
          style={{
            paddingLeft: `${node.level * 16 + 8}px`,
            WebkitUserDrag: 'element',
            userSelect: 'none',
          } as any}
          onDragStart={(e) => {
            e.stopPropagation();
            setDraggedCategoryPath(node.fullPath);
            e.dataTransfer.setData('text/plain', node.fullPath);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {
            setDraggedCategoryPath(null);
            setDragOverTarget(null);
            setDragOverEntryCategory(null);
            setIsDragOverRoot(false);
          }}
          onDragOver={(e) => handleNodeDragOver(e, node.fullPath)}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              if (dragOverTarget?.path === node.fullPath) {
                setDragOverTarget(null);
              }
              if (dragOverEntryCategory === node.fullPath) {
                setDragOverEntryCategory(null);
              }
            }
          }}
          onDrop={(e) => handleNodeDrop(e, node.fullPath)}
          onClick={() => onSelectCategory(isSelected ? null : node.fullPath)}
          className={`group flex items-center justify-between h-7 px-2 rounded-md text-xs cursor-pointer transition-colors relative ${
            isDragging ? 'opacity-30 bg-[#1E293B]' : ''
          } ${
            isEntryTarget
              ? 'bg-[#38BDF830] border-2 border-dashed border-[#38BDF8] text-white shadow-md'
              : isTargetInside
              ? 'bg-[#38BDF820] border border-dashed border-[#38BDF8]'
              : isSelected
              ? 'bg-[#1E293B] text-white font-medium shadow-xs'
              : isAncestorOfSelected
              ? 'bg-[#161F2E]/40 text-[#38BDF8]'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
        >

          {Array.from({ length: node.level }).map((_, idx) => (
            <div
              key={idx}
              className="absolute top-0 bottom-0 w-[1px] bg-[#2D3139]/60 pointer-events-none"
              style={{ left: `${idx * 16 + 15}px` }}
            />
          ))}


          {isTargetBefore && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#38BDF8] z-20 shadow-[0_0_4px_#38BDF8]" />
          )}

          {isTargetAfter && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#38BDF8] z-20 shadow-[0_0_4px_#38BDF8]" />
          )}

          {isSelected && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#38BDF8] rounded-r z-10" />
          )}


          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden pr-1 z-10">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.fullPath, e)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-[#2D3139] text-[#64748B] hover:text-[#E2E8F0] transition-colors shrink-0"
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isExpanded ? 'rotate-90 text-[#38BDF8]' : ''
                  }`}
                />
              </button>
            ) : (
              <span className="w-4 h-4 shrink-0" />
            )}

            {hasChildren && isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 pointer-events-none" />
            ) : (
              <Folder
                className={`w-3.5 h-3.5 shrink-0 transition-colors pointer-events-none ${
                  isSelected || isEntryTarget ? 'text-[#38BDF8]' : 'text-[#64748B] group-hover:text-[#94A3B8]'
                }`}
              />
            )}

            {editingCategoryPath === node.fullPath ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingCategoryName}
                onChange={(e) => setEditingCategoryName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommitRename(node);
                  } else if (e.key === 'Escape') {
                    setEditingCategoryPath(null);
                  }
                }}
                onBlur={() => handleCommitRename(node)}
                className="bg-[#090B0E] border border-[#3B82F6] rounded px-1 text-[11px] font-mono text-[#38BDF8] outline-none max-w-[120px]"
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingCategoryPath(node.fullPath);
                  setEditingCategoryName(node.name);
                }}
                title={`Drag to move • Drop keys here • ${node.fullPath}`}
                className="truncate font-mono text-[11px] tracking-tight shrink-0 max-w-[110px] hover:text-[#38BDF8] transition-colors cursor-grab active:cursor-grabbing"
              >
                {node.name}
              </span>
            )}

            {hasWarnings && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono leading-none bg-gradient-to-r from-[#EF444422] via-[#F9731618] to-transparent border border-white/5 shrink-0 pointer-events-none">
                {node.untranslatedCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[#EF4444] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    <span>{node.untranslatedCount}</span>
                  </span>
                )}
                {node.issueCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[#F97316] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                    <span>{node.issueCount}</span>
                  </span>
                )}
                {node.fuzzyCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[#F59E0B] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                    <span>{node.fuzzyCount}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2 z-10">
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateKeyInCategory?.(node.fullPath);
                }}
                className="p-1 rounded hover:bg-[#2D3748] text-[#64748B] hover:text-[#4ADE80] transition-colors"
                title={`New Key in "${node.name}"`}
              >
                <FilePlus className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setParentPathForNewCategory(node.fullPath);
                  setNewCategoryPath(`${node.fullPath} / `);
                  setIsAddingCategory(true);
                }}
                className="p-1 rounded hover:bg-[#2D3748] text-[#64748B] hover:text-[#38BDF8] transition-colors"
                title={`New Subfolder in "${node.name}"`}
              >
                <FolderPlus className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCategory?.(node.fullPath);
                }}
                className="p-1 rounded hover:bg-rose-950/40 text-[#64748B] hover:text-[#EF4444] transition-colors"
                title={`Delete category "${node.name}"`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                isSelected
                  ? 'bg-[#090B0E] border-[#38BDF833] text-[#38BDF8]'
                  : 'bg-[#090B0E]/60 border-[#2D3139]/40 text-[#64748B]'
              }`}
            >
              {node.totalCount}
            </span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col relative">
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      id="openpot-sidebar-container"
      onDragOver={(e) => {
        if (draggedCategoryPath || e.dataTransfer.types.includes('application/openpot-entries')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
      className="w-full border-r border-[#2D3139] bg-[#16191E] flex flex-col h-full select-none text-[#E2E8F0] overflow-hidden relative"
    >

      <div className="p-2.5 border-b border-[#2D3139] bg-[#16191E] shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B]" />
          <input
            id="input-sidebar-search"
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-6 py-1.5 bg-[#090B0E] border border-[#2D3139] rounded text-xs text-[#E2E8F0] placeholder-[#64748B] outline-none focus:border-[#3B82F6] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-[11px] text-[#64748B] hover:text-[#E2E8F0] font-mono cursor-pointer"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>


      <div
        ref={statusFiltersRef}
        style={{ height: `${statusFiltersHeight}px`, minHeight: '90px' }}
        className="p-2 overflow-y-auto space-y-0.5 bg-[#16191E] shrink-0 custom-scrollbar"
      >
        <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 px-1.5 pt-0.5">
          <span>{t('sidebar.statusFilters')}</span>
          {filterStatus !== 'all' && (
            <button
              onClick={() => onFilterStatusChange('all')}
              className="text-[#38BDF8] hover:text-white transition-colors cursor-pointer text-[10px] font-mono normal-case flex items-center gap-1"
              title="Reset status filter"
            >
              <span>{t('sidebar.clear')}</span>
              <span className="text-xs leading-none">×</span>
            </button>
          )}
        </div>

        {[
          {
            id: 'all' as FilterStatus,
            label: t('sidebar.allStrings'),
            icon: Layers,
            iconColor: 'text-[#3B82F6]',
            count: stats.total,
          },
          {
            id: 'untranslated' as FilterStatus,
            label: t('sidebar.untranslated'),
            icon: FileQuestion,
            iconColor: 'text-[#EF4444]',
            count: stats.untranslated,
            badge: stats.untranslated > 0 ? 'bg-[#EF44441A] text-[#EF4444] border-[#EF444433]' : undefined,
          },
          {
            id: 'fuzzy' as FilterStatus,
            label: t('sidebar.fuzzy'),
            icon: Clock,
            iconColor: 'text-[#F59E0B]',
            count: stats.fuzzy,
            badge: stats.fuzzy > 0 ? 'bg-[#F59E0B1A] text-[#F59E0B] border-[#F59E0B33]' : undefined,
          },
          {
            id: 'issues' as FilterStatus,
            label: t('sidebar.linterIssues'),
            icon: AlertTriangle,
            iconColor: 'text-rose-400',
            count: stats.issues,
            badge: stats.issues > 0 ? 'bg-rose-950/40 text-rose-400 border-rose-800/40' : undefined,
          },
          {
            id: 'plurals' as FilterStatus,
            label: t('sidebar.pluralForms'),
            icon: Hash,
            iconColor: 'text-[#4ADE80]',
            count: stats.plurals,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = filterStatus === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onFilterStatusChange(item.id)}
              className={`w-full flex items-center justify-between h-7 px-2 rounded-md text-xs cursor-pointer transition-colors relative ${
                isActive
                  ? 'bg-[#1E293B] text-white font-medium shadow-xs'
                  : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#38BDF8] rounded-r" />
              )}

              <div className="flex items-center gap-2 min-w-0">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? item.iconColor : 'text-[#64748B]'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded min-w-[22px] text-center border ${
                  item.badge
                    ? item.badge
                    : isActive
                    ? 'bg-[#090B0E] border-[#38BDF833] text-[#38BDF8]'
                    : 'bg-[#090B0E]/60 border-[#2D3139]/40 text-[#64748B]'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        onMouseDown={() => setIsDraggingSplit(true)}
        onDoubleClick={() => setStatusFiltersHeight(205)}
        className={`h-1.5 hover:h-2 bg-[#2D3139] hover:bg-[#3B82F6] cursor-row-resize transition-all z-10 flex items-center justify-center shrink-0 select-none group ${
          isDraggingSplit ? 'bg-[#3B82F6] !h-2 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''
        }`}
        title={t('sidebar.dragResize')}
      >
        <GripHorizontal className="w-4 h-2.5 text-[#64748B] group-hover:text-white opacity-70 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="px-3 pt-2 pb-1 flex items-center justify-between shrink-0 bg-[#16191E]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
            {t('sidebar.nestedCategories')}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-[#090B0E] border border-[#2D3139] text-[#38BDF8] text-[9px] font-mono">
            {categoryTree.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setParentPathForNewCategory(null);
              setNewCategoryPath('');
              setIsAddingCategory((prev) => !prev);
            }}
            className="p-1 rounded text-[#38BDF8] hover:text-white hover:bg-[#3B82F6] transition-colors"
            title={t('category.createCategory')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={expandAll}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#2D3139] transition-colors"
            title={t('sidebar.expandAll')}
          >
            <ChevronsDown className="w-3 h-3" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#2D3139] transition-colors"
            title={t('sidebar.collapseAll')}
          >
            <ChevronsUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isAddingCategory && (
        <div className="px-2.5 py-2 bg-[#090B0E] border-b border-[#2D3139] shrink-0">
          <div className="text-[10px] font-semibold text-[#E2E8F0] mb-1 flex items-center gap-1">
            <FolderPlus className="w-3 h-3 text-[#38BDF8]" />
            <span>
              {parentPathForNewCategory
                ? `${t('category.addSubcategory')}: ${parentPathForNewCategory}`
                : t('category.createTitle')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={newCategoryPath}
              onChange={(e) => setNewCategoryPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryPath.trim()) {
                  if (onAddCategory) onAddCategory(newCategoryPath.trim());
                  setIsAddingCategory(false);
                  setNewCategoryPath('');
                } else if (e.key === 'Escape') {
                  setIsAddingCategory(false);
                  setNewCategoryPath('');
                }
              }}
              placeholder={t('category.categoryPlaceholder')}
              className="flex-1 bg-[#16191E] border border-[#3B82F6] rounded px-2 py-1 text-xs font-mono text-[#38BDF8] placeholder-[#64748B] outline-none"
            />
            <button
              onClick={() => {
                if (newCategoryPath.trim()) {
                  if (onAddCategory) onAddCategory(newCategoryPath.trim());
                  setIsAddingCategory(false);
                  setNewCategoryPath('');
                }
              }}
              className="px-2.5 py-1 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-medium cursor-pointer shrink-0"
            >
              {t('common.save')}
            </button>
            <button
              onClick={() => {
                setIsAddingCategory(false);
                setNewCategoryPath('');
              }}
              className="px-2 py-1 rounded bg-[#1C2128] hover:bg-[#2D3139] text-[#94A3B8] text-[11px] cursor-pointer shrink-0"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          if (draggedCategoryPath || e.dataTransfer.types.includes('application/openpot-entries')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5 custom-scrollbar"
      >
        {categoryTree.map((rootNode) => renderTreeNode(rootNode))}

        {categoryTree.length === 0 && (
          <div className="text-center py-6 text-[#64748B] text-xs">
            {t('sidebar.noMatchingCategories')}
          </div>
        )}

        {((draggedCategoryPath && draggedCategoryPath.includes(' / ')) || dragOverEntryCategory !== null) && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              setIsDragOverRoot(true);
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              setIsDragOverRoot(false);
            }}
            onDrop={handleDropOnRoot}
            className={`mt-2 mx-1 p-2 rounded border border-dashed flex items-center justify-center gap-1.5 text-[11px] font-mono transition-colors cursor-pointer ${
              isDragOverRoot
                ? 'border-[#38BDF8] bg-[#38BDF81A] text-[#38BDF8]'
                : 'border-[#2D3139] text-[#64748B] hover:border-[#38BDF860]'
            }`}
          >
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>Move to Root level</span>
          </div>
        )}
      </div>

      {selectedCategory && (
        <div className="px-2.5 py-1.5 bg-[#090B0E] border-t border-[#2D3139] flex items-center justify-between text-[11px] text-[#38BDF8] font-mono shrink-0 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Filter className="w-3 h-3 text-[#38BDF8] shrink-0" />
            <span className="truncate" title={selectedCategory}>
              {selectedCategory}
            </span>
          </div>
          <button
            onClick={() => onSelectCategory(null)}
            className="p-1 rounded hover:bg-[#1C2128] text-[#64748B] hover:text-[#E2E8F0] transition-colors ml-1 shrink-0 cursor-pointer"
            title="Clear category filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};