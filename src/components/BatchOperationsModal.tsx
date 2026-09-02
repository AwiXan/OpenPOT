import React, { useState } from 'react';
import { Database, Zap, CheckCircle2 } from 'lucide-react';
import { Workspace } from '../types/gettext';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';

interface BatchOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onBatchApplyTm: (poFileId: string, minSimilarity?: number) => number;
  onClearAllFuzzy: (poFileId: string) => void;
  onMarkUntranslatedFuzzy: (poFileId: string) => void;
  fuzzyThreshold?: number;
}

export const BatchOperationsModal: React.FC<BatchOperationsModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onBatchApplyTm,
  onClearAllFuzzy,
  onMarkUntranslatedFuzzy,
  fuzzyThreshold = 80,
}) => {
  const { t } = useTranslation();
  const [selectedPoId, setSelectedPoId] = useState<string>(workspace.poFiles[0]?.id || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [useExactOnly, setUseExactOnly] = useState(false);

  const selectedPo = workspace.poFiles.find((p) => p.id === selectedPoId) || workspace.poFiles[0];

  const handleApplyTm = () => {
    if (!selectedPo) return;
    const threshold = useExactOnly ? 1.0 : fuzzyThreshold / 100;
    const applied = onBatchApplyTm(selectedPo.id, threshold);
    setSuccessMessage(
      `Successfully applied ${applied} translations from Translation Memory.`
    );
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleClearFuzzy = () => {
    if (!selectedPo) return;
    onClearAllFuzzy(selectedPo.id);
    setSuccessMessage(`Cleared fuzzy flag on all strings in ${selectedPo.languageName}.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleMarkFuzzy = () => {
    if (!selectedPo) return;
    onMarkUntranslatedFuzzy(selectedPo.id);
    setSuccessMessage(`Marked all partially translated strings as fuzzy.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const modalFooter = (
    <div className="w-full flex items-center justify-end">
      <button
        onClick={onClose}
        className="px-4 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border border-(--op-border) cursor-pointer transition-colors"
      >
        {t('common.close')}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('batch.title')}
      subtitle={t('batch.subtitle')}
      icon={<Database className="w-4 h-4" />}
      maxWidth="max-w-lg"
      footer={modalFooter}
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="block text-(--op-text-secondary) mb-1.5 font-medium">{t('batch.selectLang')}</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {workspace.poFiles.map((po) => (
              <button
                key={po.id}
                onClick={() => setSelectedPoId(po.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                  po.id === selectedPo?.id
                    ? 'bg-(--op-accent) text-white shadow-xs'
                    : 'bg-(--op-bg-canvas) text-(--op-text-secondary) hover:bg-(--op-bg-raised) border border-(--op-border)'
                }`}
              >
                <span className="uppercase font-mono mr-1">{po.language}</span>
                <span>{po.languageName}</span>
              </button>
            ))}
          </div>
        </div>

        {successMessage && (
          <div className="p-3 rounded bg-(--op-success)/10 border border-(--op-success)/20 text-(--op-success) flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-(--op-success) shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="bg-(--op-bg-canvas) p-3.5 rounded border border-(--op-border) space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-(--op-text-primary) flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-(--op-warning)" />
              <span>Auto-Fill from Translation Memory</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setUseExactOnly(false)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  !useExactOnly ? 'bg-(--op-accent) text-white font-semibold' : 'text-(--op-text-secondary) bg-(--op-bg-surface)'
                }`}
              >
                {t('batch.fuzzyToggle').replace('{threshold}', fuzzyThreshold.toString())}
              </button>
              <button
                onClick={() => setUseExactOnly(true)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  useExactOnly ? 'bg-(--op-accent) text-white font-semibold' : 'text-(--op-text-secondary) bg-(--op-bg-surface)'
                }`}
              >
                {t('batch.exactToggle')}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-(--op-text-secondary) leading-relaxed">
            {t('batch.tmDesc')
              .replace('{lang}', selectedPo?.languageName || '')
              .replace('{threshold}', useExactOnly ? '100' : fuzzyThreshold.toString())}
          </p>
          <button
            onClick={handleApplyTm}
            className="w-full py-2 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-(--op-accent)/10 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{t('batch.runTm')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-(--op-bg-canvas) p-3 rounded border border-(--op-border) space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-(--op-text-primary)">{t('batch.clearFuzzyTitle')}</div>
              <p className="text-[11px] text-(--op-text-secondary) mt-1">
                {t('batch.clearFuzzyDesc').replace('{lang}', selectedPo?.language || '')}
              </p>
            </div>
            <button
              onClick={handleClearFuzzy}
              className="w-full py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-primary) text-xs font-medium transition-colors border border-(--op-border) cursor-pointer"
            >
              {t('batch.clearFuzzyBtn')}
            </button>
          </div>

          <div className="bg-(--op-bg-canvas) p-3 rounded border border-(--op-border) space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-(--op-text-primary)">{t('batch.reviewTitle')}</div>
              <p className="text-[11px] text-(--op-text-secondary) mt-1">{t('batch.reviewDesc')}</p>
            </div>
            <button
              onClick={handleMarkFuzzy}
              className="w-full py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-primary) text-xs font-medium transition-colors border border-(--op-border) cursor-pointer"
            >
              {t('batch.reviewBtn')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};