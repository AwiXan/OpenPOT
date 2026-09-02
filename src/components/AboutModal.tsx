import React from 'react';
import {
  MessageCircleWarning,
  FileSpreadsheet,
  FileJson,
  GitBranch,
  FolderSync,
  FolderTree,
  Hash,
  Binary,
  Heart,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
        className="px-3 py-1.5 rounded-lg bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span>{t('settings.title')}</span>
      </button>

      <button
        type="button"
        onClick={onClose}
        className="px-4 py-1.5 rounded-lg bg-(--op-accent) hover:bg-(--op-accent-strong) text-white text-xs font-semibold shadow-md shadow-(--op-accent)/10 transition-all cursor-pointer"
      >
        {t('common.close')}
      </button>
    </div>
  );

  const modalTitle = (
    <div className="flex items-center gap-2">
      <span>OpenPOT</span>
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--op-accent)/13 text-(--op-accent-alt) border border-(--op-accent)/27 font-mono font-bold leading-none">
        v1.4
      </span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle as any}
      subtitle={t('about.subtitle')}
      icon={
        <img 
          src="/icons/128x128.png" 
          alt="OpenPOT App Icon" 
          className="w-12 h-12 rounded object-contain"
        />
      }
      maxWidth="max-w-xl"
      footer={modalFooter}
    >
      <div className="p-2 space-y-5 text-xs">
        {/* Vibecoded Notice Callout */}
        <div className="bg-gradient-to-r from-[#f63b3b15] via-[#3b1e1e] to-[#f63b3b08] border border-[#f63b3b33] rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#f63b3b22] text-[#f83838] shrink-0 mt-0.5">
              <MessageCircleWarning className="w-4 h-4" />
            </div>
            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{t('about.vibecodedTitle')}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  {t('about.aiCraft')}
                </span>
              </div>
              <p className="text-(--op-text-secondary) text-xs leading-relaxed italic">
                "{t('about.vibecodedNote')}"
              </p>
            </div>
          </div>
        </div>

        {/* Key Capabilities */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5 uppercase text-[10px] text-(--op-text-muted)">
            <ShieldCheck className="w-3.5 h-3.5 text-(--op-accent-alt)" />
            <span>{t('about.coreFeatures')}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <FolderTree className="w-4 h-4 text-(--op-accent-alt) shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureCategoryTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featureCategoryDesc')}
                </p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <Binary className="w-4 h-4 text-(--op-accent-alt) shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureMoTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featureMoDesc')}
                </p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-(--op-success) shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureMatrixTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featureMatrixDesc')}
                </p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <FileJson className="w-4 h-4 text-(--op-warning) shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureFormatsTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">{t('about.featureFormatsDesc')}</p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <GitBranch className="w-4 h-4 text-(--op-warning) shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureGitTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featureGitDesc')}
                </p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <MessageCircleWarning className="w-4 h-4 text-[#EC4899] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureTmTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featureTmDesc')}
                </p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <FolderSync className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featureFolderTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featureFolderDesc')}
                </p>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-3 rounded-lg border border-(--op-border) flex items-start gap-2.5">
              <Hash className="w-4 h-4 text-[#06B6D4] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white text-xs">{t('about.featurePluralTitle')}</div>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('about.featurePluralDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specs Footer */}
        <div className="p-3 bg-(--op-bg-canvas) rounded-lg border border-(--op-border) flex items-center justify-between text-[11px] text-(--op-text-muted)">
          <div className="flex items-center gap-1.5">
            <span>{t('about.engineName')}</span>
            <span>•</span>
            <span className="font-mono text-(--op-text-secondary)">v1.4</span>
          </div>
          <div className="flex items-center gap-1 text-(--op-accent-alt)">
            <Heart className="w-3 h-3 fill-current text-rose-400" />
            <span>{t('about.footerTagline')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};