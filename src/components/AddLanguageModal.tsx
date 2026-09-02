import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { getPluralRuleForLanguage } from '../lib/pluralEngine';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';

interface AddLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLanguage: (langCode: string, langName: string, pluralForms: string) => void;
  existingLanguages: string[];
}

const LANGUAGE_PRESETS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt_BR', name: 'Portuguese (Brasil)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'cs', name: 'Czech (Čeština)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'zh_CN', name: 'Chinese Simplified (简体中文)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
];

export const AddLanguageModal: React.FC<AddLanguageModalProps> = ({
  isOpen,
  onClose,
  onAddLanguage,
  existingLanguages,
}) => {
  const [selectedPreset, setSelectedPreset] = useState('it');
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const { t } = useTranslation();

  const activeCode = isCustom ? customCode : selectedPreset;
  const activePreset = LANGUAGE_PRESETS.find((p) => p.code === activeCode);
  const activeName = isCustom ? customName : activePreset?.name || activeCode;

  const pluralRule = getPluralRuleForLanguage(activeCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCode.trim()) return;

    onAddLanguage(activeCode.trim(), activeName.trim(), pluralRule.formula);
    onClose();
  };

  const createButtonText = (t('addLang.createButton') || 'Create {code}.po').replace('{code}', activeCode || 'new');
  const formsCountText = (t('addLang.formsCount') || '{count} forms').replace('{count}', String(pluralRule.nplurals));

  const modalFooter = (
    <div className="w-full flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="px-3.5 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) border border-(--op-border) cursor-pointer transition-colors"
      >
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        form="add-lang-form"
        className="px-4 py-1.5 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white font-semibold shadow-lg shadow-(--op-accent)/20 cursor-pointer transition-all"
      >
        {createButtonText}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('addLang.title') || 'Add Target Language (.po)'}
      icon={<Globe className="w-4 h-4" />}
      maxWidth="max-w-md"
      footer={modalFooter}
    >
      <form id="add-lang-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-(--op-text-primary) font-medium mb-1.5">
            {t('addLang.chooseLanguage') || 'Choose Language:'}
          </label>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-(--op-bg-canvas) rounded border border-(--op-border) custom-scrollbar">
            {LANGUAGE_PRESETS.map((preset) => {
              const isAlreadyAdded = existingLanguages.includes(preset.code);
              const isSelected = !isCustom && selectedPreset === preset.code;

              return (
                <button
                  key={preset.code}
                  type="button"
                  disabled={isAlreadyAdded}
                  onClick={() => {
                    setIsCustom(false);
                    setSelectedPreset(preset.code);
                  }}
                  className={`p-2 rounded text-left transition-all flex items-center justify-between cursor-pointer ${
                    isAlreadyAdded
                      ? 'opacity-40 cursor-not-allowed bg-(--op-bg-surface)/40 text-(--op-text-muted)'
                      : isSelected
                      ? 'bg-(--op-accent) text-white font-medium shadow-xs'
                      : 'text-(--op-text-secondary) hover:bg-(--op-bg-raised) hover:text-(--op-text-primary)'
                  }`}
                >
                  <span className="truncate text-xs">{preset.name}</span>
                  <span className="font-mono text-[10px] uppercase opacity-75">{preset.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom option */}
        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer mb-2 w-max">
            <input
              type="checkbox"
              checked={isCustom}
              onChange={(e) => setIsCustom(e.target.checked)}
              className="rounded bg-(--op-bg-surface) border-(--op-border) text-(--op-accent) focus:ring-0"
            />
            <span className="text-(--op-text-secondary)">
              {t('addLang.customCheckbox') || 'Specify custom ISO language code'}
            </span>
          </label>

          {isCustom && (
            <div className="grid grid-cols-2 gap-2 bg-(--op-bg-canvas) p-2.5 rounded border border-(--op-border)">
              <div>
                <label className="text-[10px] text-(--op-text-muted) block mb-1">
                  {t('addLang.codeLabel') || 'Code (e.g. sv_SE):'}
                </label>
                <input
                  type="text"
                  required={isCustom}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-2 py-1 text-xs text-(--op-text-primary) font-mono focus:border-(--op-accent) outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-(--op-text-muted) block mb-1">
                  {t('addLang.nameLabel') || 'Language Name:'}
                </label>
                <input
                  type="text"
                  required={isCustom}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-2 py-1 text-xs text-(--op-text-primary) focus:border-(--op-accent) outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Plural Rule Preview */}
        <div className="bg-(--op-bg-canvas) p-3 rounded border border-(--op-border) space-y-1 text-(--op-text-secondary)">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-(--op-text-primary)">
              {t('addLang.pluralFormula') || 'Plural Forms Formula:'}
            </span>
            <span className="font-mono text-(--op-accent)">{formsCountText}</span>
          </div>
          <div className="font-mono text-[10px] text-(--op-text-secondary) break-all bg-(--op-bg-surface) p-1.5 rounded border border-(--op-border)">
            {pluralRule.formula}
          </div>
        </div>
      </form>
    </Modal>
  );
};