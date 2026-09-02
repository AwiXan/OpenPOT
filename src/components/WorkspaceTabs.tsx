import React, { useState, useRef, useEffect } from 'react';
import { Plus, Layers, X } from 'lucide-react';
import { Workspace } from '../types/gettext';

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCloseWorkspace: (id: string, e: React.MouseEvent) => void;
  onNewWorkspace: () => void;
  onReorderWorkspaces: (startIndex: number, endIndex: number) => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
  onNewWorkspace,
  onReorderWorkspaces,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);


  useEffect(() => {
    const handlePointerUp = () => {
      if (draggingId) {
        setDraggingId(null);
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [draggingId]);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {

    if (e.button !== 0) return;
    

    if ((e.target as HTMLElement).closest('button')) return;

    setDraggingId(id);
    document.body.style.cursor = 'grabbing';
    onSelectWorkspace(id);
  };


  const handlePointerEnter = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;

    const startIndex = workspaces.findIndex(w => w.id === draggingId);
    const endIndex = workspaces.findIndex(w => w.id === targetId);

    if (startIndex !== -1 && endIndex !== -1) {
      onReorderWorkspaces(startIndex, endIndex);
    }
  };

  return (
    <div 
      ref={scrollRef}
      className="flex items-center h-9 px-3 gap-1 bg-(--op-bg-canvas) border-b border-(--op-border) overflow-x-auto no-scrollbar relative"
    >
      <div className="flex items-center gap-1 h-full w-max">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isDragging = draggingId === ws.id;
          const poCount = ws.poFiles.length;
          const stringCount = ws.potFile.entries.length;

          return (
  <div
    key={ws.id}
    onPointerDown={(e) => handlePointerDown(ws.id, e)}
    onPointerEnter={() => handlePointerEnter(ws.id)}
    className={`group relative flex items-center gap-2 px-3 h-full text-xs font-medium cursor-pointer transition-colors border-x border-(--op-border) select-none ${
      isActive
        ? 'bg-(--op-bg-surface) border-t-2 border-t-(--op-accent) text-(--op-text-primary) shadow-xs'
        : 'bg-(--op-bg-canvas) text-(--op-text-secondary) hover:bg-(--op-bg-raised) hover:text-(--op-text-primary) border-t-2 border-t-transparent'
    } ${isDragging ? 'opacity-50 !bg-(--op-bg-active)' : ''}`}
  >
    <Layers 
      className={`w-3.5 h-3.5 shrink-0 pointer-events-none transition-colors -translate-y-0.5 ${
        isActive ? 'text-(--op-accent-alt)' : 'text-(--op-text-muted) group-hover:text-(--op-text-secondary)'
      }`} 
    />

    <span className="truncate max-w-[140px] font-mono text-[11px] pointer-events-none">
      {ws.name}
    </span>

    {ws.isModified && (
      <span 
        className="w-1 h-1 rounded-full bg-(--op-accent-alt) shrink-0 pointer-events-none -translate-y-1 -translate-x-1.5" 
        title="Unsaved changes"
      />
    )}

    <div className="flex items-center pointer-events-none">
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--op-bg-canvas) text-(--op-text-muted) font-mono border border-(--op-border)/60 leading-none">
        {poCount}L • {stringCount}S
      </span>
    </div>


    {workspaces.length > 1 && (
      <button
        onClick={(e) => onCloseWorkspace(ws.id, e)}
        onPointerDown={(e) => e.stopPropagation()}
        className="p-1 rounded hover:bg-(--op-border) text-(--op-text-muted) hover:text-(--op-text-primary) transition-all opacity-0 group-hover:opacity-100 cursor-pointer ml-0.5"
        title="Close Workspace"
      >
        <X className="w-3 h-3 pointer-events-none" />
      </button>
    )}
  </div>
);
        })}

        <button
          onClick={onNewWorkspace}
          className="p-1 rounded hover:bg-(--op-bg-raised) text-(--op-text-muted) hover:text-(--op-accent) transition-colors ml-1 cursor-pointer shrink-0"
          title="Create New Workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};