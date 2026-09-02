import React, { useState } from 'react';
import { Binary, ShieldCheck, Download, FolderSync } from 'lucide-react';
import { Workspace, PoFileRecord } from '../types/gettext';
import { compileMoBinary } from '../lib/moCompiler';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';

interface MoCompilerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  hasConnectedFolder?: boolean;
  onExportMo: (po: PoFileRecord, useConnectedFolder?: boolean) => Promise<void>;
}

export const MoCompilerModal: React.FC<MoCompilerModalProps> = ({
  isOpen,
  onClose,
  workspace,
  hasConnectedFolder = false,
  onExportMo,
}) => {
  const { t } = useTranslation();
  const [selectedPoId, setSelectedPoId] = useState<string>(
    workspace.poFiles[0]?.id || ''
  );

  const selectedPo = workspace.poFiles.find((p) => p.id === selectedPoId) || workspace.poFiles[0];

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
      <button
        onClick={onClose}
        className="px-3.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border border-(--op-border) cursor-pointer transition-colors"
      >
        {t('common.close')}
      </button>
      {selectedPo && <button
        onClick={() => onExportMo(selectedPo)}
        className="px-4 py-1.5 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-(--op-accent)/20 cursor-pointer transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t('moCompiler.export')}</span>
      </button>}
      {selectedPo && hasConnectedFolder && <button
        onClick={() => onExportMo(selectedPo, true)}
        className="px-3 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-white border border-(--op-border) flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <FolderSync className="w-3.5 h-3.5 text-(--op-success)" />
        <span>{t('moCompiler.exportToFolder')}</span>
      </button>}

    </div>
  );

  const binaryData = selectedPo ? compileMoBinary(selectedPo.header, selectedPo.entries) : new Uint8Array();

  const hexPreview: string[] = [];
  for (let i = 0; i < Math.min(binaryData.length, 96); i += 16) {
    const chunk = Array.from(binaryData.slice(i, i + 16));
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = chunk
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    const offset = i.toString(16).padStart(4, '0');
    hexPreview.push(`${offset}  ${hex.padEnd(48, ' ')}  |${ascii}|`);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('moCompiler.title')}
      subtitle={t('moCompiler.subtitle')}
      icon={<Binary className="w-4 h-4" />}
      maxWidth="max-w-2xl"
      footer={modalFooter}
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {workspace.poFiles.map((po) => {
            const isSel = po.id === selectedPo?.id;
            const bin = compileMoBinary(po.header, po.entries);

            return (
              <button
                key={po.id}
                onClick={() => setSelectedPoId(po.id)}
                className={`px-3 py-2 rounded text-left transition-all border flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSel
                    ? 'bg-(--op-bg-active) border-(--op-accent) text-white shadow-xs'
                    : 'bg-(--op-bg-canvas) border-(--op-border) text-(--op-text-secondary) hover:bg-(--op-bg-raised)'
                }`}
              >
                <span className="font-mono uppercase font-bold text-(--op-accent)">{po.language}</span>
                <span className="text-[11px] font-sans">{po.languageName}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-(--op-bg-canvas) font-mono text-(--op-text-muted) border border-(--op-border)">
                  {bin.length} B
                </span>
              </button>
            );
          })}
        </div>

        {selectedPo && (
          <div className="bg-(--op-bg-canvas) rounded-lg p-4 border border-(--op-border) space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-sm">
                  {selectedPo.filename.replace(/\.po$/, '.mo')}
                </div>
                <div className="text-[11px] text-(--op-text-secondary) font-mono">
                  Target: {selectedPo.languageName} ({selectedPo.language})
                </div>
              </div>

            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-(--op-border) text-(--op-text-primary)">
              <div className="bg-(--op-bg-surface) p-2.5 rounded border border-(--op-border)">
                <div className="text-[10px] text-(--op-text-muted) uppercase font-mono">{t('moCompiler.magic')}</div>
                <div className="font-mono text-(--op-success) font-bold">0x950412de (OK)</div>
              </div>

              <div className="bg-(--op-bg-surface) p-2.5 rounded border border-(--op-border)">
                <div className="text-[10px] text-(--op-text-muted) uppercase font-mono">{t('moCompiler.size')}</div>
                <div className="font-mono text-(--op-text-primary) font-bold">{binaryData.length} bytes</div>
              </div>

              <div className="bg-(--op-bg-surface) p-2.5 rounded border border-(--op-border)">
                <div className="text-[10px] text-(--op-text-muted) uppercase font-mono">{t('moCompiler.strings')}</div>
                <div className="font-mono text-(--op-text-primary) font-bold">
                  {selectedPo.entries.length + 1} pairs
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-(--op-text-muted)">
                {t('moCompiler.inspector')}
              </div>
              <pre className="bg-(--op-bg-surface) p-2.5 rounded text-[10px] font-mono text-(--op-text-secondary) overflow-x-auto leading-relaxed border border-(--op-border) select-text">
                {hexPreview.join('\n')}
              </pre>
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-(--op-bg-raised) border border-(--op-border) text-[11px] text-(--op-text-secondary) flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-(--op-accent) shrink-0 mt-0.5" />
          <div>{t('moCompiler.notice')}</div>
        </div>
      </div>
    </Modal>
  );
};