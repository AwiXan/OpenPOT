import React, { useState, useEffect } from 'react';
import {
  Sliders,
  RotateCcw,
  Check,
  Zap,
  Globe,
  GitBranch,
  ShieldCheck,
  FileCode,
  FolderSync,
  ArrowBigDown,
  Layers,
  CornerDownLeft,
  FileJson,
  FileText,
  Eye,
  Palette
} from 'lucide-react';
import { AppSettings, AppTheme, PoNamingScheme } from '../types/gettext';
import { useTranslation, SUPPORTED_UI_LANGUAGES, UiLanguage } from '../lib/i18n';
import { Modal } from './ui/Modal';
import { SettingToggleRow } from './ui/SettingToggleRow';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  domainName?: string;
  onRenameDomain?: (newDomain: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  domainName = 'messages',
  onRenameDomain,
}) => {
  const { t, currentUiLang, setUiLanguage } = useTranslation();
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    csvPluralSuffix: '_P%d',
    ...settings,
  });
  const [localDomain, setLocalDomain] = useState<string>(domainName);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'language' | 'modular' | 'tm' | 'newlines' | 'git' | 'editor' | 'appearance'>('modular');

  const handleSave = () => {
    onSaveSettings(localSettings);
    if (onRenameDomain && localDomain.trim() && localDomain !== domainName) {
      onRenameDomain(localDomain.trim());
    }
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 600);
  };

  useEffect(() => {
    if (isOpen) {
      setLocalSettings({
        csvPluralSuffix: '_P%d',
        ...settings,
      });
      setLocalDomain(domainName);
    }
  }, [isOpen, settings, domainName]);

  const handleResetDefaults = () => {
    const defaults: AppSettings = {
      fuzzyMatchingThreshold: 80,
      autoMarkFuzzyUnder100: true,
      authorName: 'Translator',
      authorEmail: 'translator@example.com',
      autoSaveInterval: 0,
      poNamingScheme: 'domain_lang',
      autoCompileMoOnSave: true,
      autoNewlineOnEnter: true,
      showNewlinesVisible: true,
      autoCompileCsvOnSave: false,
      autoCompileJsonOnSave: false,
      csvPluralSuffix: '_P%d',
      autoGenerateCategories: true,
      theme: 'obsidian',
      themeSaturation: 0.5,
    };
    setLocalSettings(defaults);
  };

  const thresholdPresets = [60, 70, 75, 80, 85, 90, 95];

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
      <button
        type="button"
        onClick={handleResetDefaults}
        className="px-3 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs flex items-center gap-1.5 border border-(--op-border) transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{t('settings.resetDefaults')}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-(--op-bg-raised) hover:bg-(--op-bg-raised-hover) text-(--op-text-secondary) hover:text-(--op-text-primary) text-xs border border-(--op-border) transition-colors cursor-pointer"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-(--op-accent)/10 transition-all cursor-pointer"
        >
          {savedFeedback ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>{t('settings.saved')}</span>
            </>
          ) : (
            <span>{t('settings.save')}</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      icon={<Sliders className="w-4 h-4" />}
      maxWidth="max-w-2xl"
      footer={modalFooter}
    >
      {/* Tab Navigation (Inside body to scroll with content if needed) */}
      <div className="flex border-b border-(--op-border) mb-5 overflow-x-auto custom-scrollbar pb-px">
        {[
          { id: 'modular', icon: Layers, label: t('settings.modularTab') },
          { id: 'appearance', icon: Palette, label: t('settings.appearanceTab') },
          { id: 'newlines', icon: CornerDownLeft, label: t('settings.newlinesTab') },
          { id: 'language', icon: Globe, label: t('settings.languageTab') },
          { id: 'tm', icon: Zap, label: t('settings.tmTab') },
          { id: 'git', icon: GitBranch, label: t('settings.gitTab') },
          { id: 'editor', icon: Sliders, label: t('settings.shortcutsTab') },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${isActive
                ? 'border-(--op-accent) text-(--op-accent)'
                : 'border-transparent text-(--op-text-secondary) hover:text-(--op-text-primary)'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-5 text-xs">
        {activeTab === 'modular' && (
          <div className="space-y-4">
            <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
              <div>
                <label className="text-white font-semibold flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-(--op-accent-alt)" />
                  <span>{t('settings.domainTitle')}</span>
                </label>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">{t('settings.domainDesc')}</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="text"
                  value={localDomain}
                  onChange={(e) => setLocalDomain(e.target.value)}
                  placeholder="e.g. ecommerce, gamemode_survival"
                  className="flex-1 bg-(--op-bg-surface) border border-(--op-border) rounded px-3 py-1.5 text-xs text-white placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none font-mono"
                />
                <span className="text-[11px] text-(--op-text-muted) font-mono shrink-0">
                  Template: {localDomain || 'messages'}.pot
                </span>
              </div>
            </div>

            <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
              <label className="text-white font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-(--op-accent)" />
                <span>{t('settings.namingSchemeTitle')}</span>
              </label>
              <p className="text-[11px] text-(--op-text-muted)">{t('settings.namingSchemeDesc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'domain_lang' as PoNamingScheme, title: 'domain_lang.po', example: `${localDomain || 'ecommerce'}_en.po`, badge: 'Modular / Games' },
                  { id: 'lang' as PoNamingScheme, title: 'lang.po', example: 'en.po', badge: 'Flat Standard' },
                  { id: 'locale_path' as PoNamingScheme, title: 'locale/domain.po', example: `en/${localDomain || 'ecommerce'}.po`, badge: 'GNU Hierarchy' },
                ].map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => setLocalSettings({ ...localSettings, poNamingScheme: scheme.id })}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${localSettings.poNamingScheme === scheme.id
                      ? 'bg-(--op-bg-active) border-(--op-accent) text-white shadow-xs'
                      : 'bg-(--op-bg-surface) border-(--op-border) text-(--op-text-secondary) hover:bg-(--op-bg-raised)'
                      }`}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-mono font-bold text-xs">{scheme.title}</span>
                      {localSettings.poNamingScheme === scheme.id && <Check className="w-3.5 h-3.5 text-(--op-accent)" />}
                    </div>
                    <div className="text-[10px] text-(--op-accent-alt) font-mono">{scheme.example}</div>
                    <div className="text-[9px] text-(--op-text-muted) mt-1">{scheme.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SettingToggleRow
                icon={<FolderSync className="w-4 h-4 text-(--op-success)" />}
                title={t('settings.autoMoTitle')}
                description={t('settings.autoMoDesc')}
                checked={localSettings.autoCompileMoOnSave}
                onChange={(checked) => setLocalSettings({ ...localSettings, autoCompileMoOnSave: checked })}
              />

              <SettingToggleRow
                icon={<FolderSync className="w-4 h-4 text-(--op-accent-alt)" />}
                title={t('settings.autoCategoriesTitle')}
                description={t('settings.autoCategoriesDesc')}
                checked={localSettings.autoGenerateCategories ?? true}
                onChange={(checked) => setLocalSettings({ ...localSettings, autoGenerateCategories: checked })}
              />

              <SettingToggleRow
                icon={<FileJson className="w-4 h-4 text-(--op-warning)" />}
                title={t('settings.autoJsonTitle')}
                description={t('settings.autoJsonDesc')}
                checked={localSettings.autoCompileJsonOnSave ?? false}
                onChange={(checked) => setLocalSettings({ ...localSettings, autoCompileJsonOnSave: checked })}
              />

              <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) flex flex-col gap-3 transition-colors hover:border-(--op-accent)/27">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-white font-semibold flex items-center gap-1.5 cursor-pointer" onClick={() => setLocalSettings({ ...localSettings, autoCompileCsvOnSave: !localSettings.autoCompileCsvOnSave })}>
                      <FileText className="w-4 h-4 text-(--op-success-strong)" />
                      <span>{t('settings.autoCsvTitle')}</span>
                    </label>
                    <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                      {t('settings.autoCsvDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={localSettings.autoCompileCsvOnSave}
                    onClick={() => setLocalSettings({ ...localSettings, autoCompileCsvOnSave: !localSettings.autoCompileCsvOnSave })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                      localSettings.autoCompileCsvOnSave ? 'bg-(--op-accent)' : 'bg-(--op-border)'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${localSettings.autoCompileCsvOnSave ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                  </button>
                </div>
                
                {localSettings.autoCompileCsvOnSave && (
                  <div className="pt-3 border-t border-(--op-bg-raised) flex items-center gap-3">
                    <label className="text-(--op-text-secondary) text-[11px] font-medium shrink-0">{t('settings.pluralSuffixRule')}</label>
                    <input
                      type="text"
                      value={localSettings.csvPluralSuffix || '_P%d'}
                      onChange={(e) => setLocalSettings({ ...localSettings, csvPluralSuffix: e.target.value })}
                      placeholder="_P%d"
                      className="w-24 bg-(--op-bg-surface) border border-(--op-border) rounded px-2 py-1 text-xs text-white focus:border-(--op-accent) outline-none font-mono"
                    />
                    <span className="text-(--op-text-muted) text-[10px] italic">{t('settings.pluralSuffixExample')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
          <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
            <div>
              <label className="text-white font-semibold flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-(--op-accent-alt)" />
                <span>{t('settings.themeTitle')}</span>
              </label>
              <p className="text-[11px] text-(--op-text-muted) mt-0.5">{t('settings.themeDesc')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {([
                { id: 'obsidian', accent: '#3B82F6', accentAlt: '#38BDF8', label: t('settings.themeObsidian'), desc: t('settings.themeObsidianDesc') },
                { id: 'emerald', accent: '#10B981', accentAlt: '#34D399', label: t('settings.themeEmerald'), desc: t('settings.themeEmeraldDesc') },
                { id: 'violet', accent: '#8B5CF6', accentAlt: '#C084FC', label: t('settings.themeViolet'), desc: t('settings.themeVioletDesc') },
                { id: 'orange', accent: '#F97316', accentAlt: '#FB923C', label: t('settings.themeOrange'), desc: t('settings.themeOrangeDesc') },
              ] as { id: AppTheme; accent: string; accentAlt: string; label: string; desc: string }[]).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setLocalSettings({ ...localSettings, theme: theme.id })}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${(localSettings.theme || 'obsidian') === theme.id
                    ? 'bg-(--op-bg-active) border-(--op-accent) text-white shadow-xs'
                    : 'bg-(--op-bg-surface) border-(--op-border) text-(--op-text-secondary) hover:bg-(--op-bg-raised)'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex -space-x-1.5">
                      <span className="w-4 h-4 rounded-full border border-black/30" style={{ background: theme.accent }} />
                      <span className="w-4 h-4 rounded-full border border-black/30" style={{ background: theme.accentAlt }} />
                    </div>
                    {(localSettings.theme || 'obsidian') === theme.id && <Check className="w-3.5 h-3.5 text-(--op-accent)" />}
                  </div>
                  <div className="font-semibold text-xs text-(--op-text-primary)">{theme.label}</div>
                  <div className="text-[10px] text-(--op-text-muted) mt-0.5">{theme.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
            <div>
              <label className="text-white font-semibold flex items-center gap-1.5">
                <span>{t('settings.saturationTitle')}</span>
                <span className="px-1.5 py-0.5 rounded bg-(--op-accent)/10 text-(--op-accent) font-mono text-[11px] font-bold border border-(--op-accent)/20">
                  {Math.round((localSettings.themeSaturation ?? 0.5) * 100)}%
                </span>
              </label>
              <p className="text-[11px] text-(--op-text-muted) mt-0.5">{t('settings.saturationDesc')}</p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[10px] text-(--op-text-muted) shrink-0">{t('settings.saturationGray')}</span>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={localSettings.themeSaturation ?? 0.5}
                onChange={(e) => setLocalSettings({ ...localSettings, themeSaturation: parseFloat(e.target.value) })}
                className="flex-1 accent-(--op-accent) h-1.5 bg-(--op-bg-raised) rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-(--op-text-muted) shrink-0">{t('settings.saturationFull')}</span>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'newlines' && (
          <div className="space-y-4">
            <SettingToggleRow
              icon={<CornerDownLeft className="w-4 h-4 text-(--op-accent-alt)" />}
              title={t('settings.autoNewlineEnter')}
              description={t('settings.autoNewlineDesc')}
              checked={localSettings.autoNewlineOnEnter}
              onChange={(checked) => setLocalSettings({ ...localSettings, autoNewlineOnEnter: checked })}
            />

            <SettingToggleRow
              icon={<Eye className="w-4 h-4 text-(--op-success)" />}
              title={t('settings.showNewlinesDefault')}
              description={t('settings.showNewlinesDesc')}
              checked={localSettings.showNewlinesVisible}
              onChange={(checked) => setLocalSettings({ ...localSettings, showNewlinesVisible: checked })}
            />
          </div>
        )}

        {activeTab === 'language' && (
          <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
            <div>
              <label className="text-white font-semibold flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-(--op-accent-alt)" />
                <span>{t('settings.uiLanguage')}</span>
              </label>
              <p className="text-[11px] text-(--op-text-muted) mt-0.5">{t('settings.uiLanguageDesc')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {SUPPORTED_UI_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setUiLanguage(lang.code as UiLanguage)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${currentUiLang === lang.code
                    ? 'bg-(--op-bg-active) border-(--op-accent) text-white shadow-xs'
                    : 'bg-(--op-bg-surface) border-(--op-border) text-(--op-text-secondary) hover:bg-(--op-bg-raised)'
                    }`}
                >
                  <div className="flex gap-2.5">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="text-left">
                      <div className="font-semibold text-(--op-text-primary)">{lang.nativeName}</div>
                      <div className="text-[10px] text-(--op-text-muted)">{lang.name} ({lang.code})</div>
                    </div>
                  </div>
                  {currentUiLang === lang.code && <Check className="w-4 h-4 text-(--op-accent)" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tm' && (
          <div className="space-y-5">
            <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
              <div>
                <label className="text-white font-semibold flex items-center gap-1.5">
                  <span>{t('settings.similarityThreshold')}</span>
                  <span className="px-1.5 py-0.5 rounded bg-(--op-accent)/10 text-(--op-accent) font-mono text-[11px] font-bold border border-(--op-accent)/20">
                    {localSettings.fuzzyMatchingThreshold}%
                  </span>
                </label>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">{t('settings.thresholdDesc')}</p>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <input
                  type="range"
                  min="30" max="100" step="1"
                  value={localSettings.fuzzyMatchingThreshold}
                  onChange={(e) => setLocalSettings({ ...localSettings, fuzzyMatchingThreshold: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-(--op-accent) h-1.5 bg-(--op-bg-raised) rounded-lg cursor-pointer"
                />
              </div>
              <div className="pt-2 border-t border-(--op-bg-raised) flex items-center gap-1.5">
                <span className="text-[10px] text-(--op-text-muted) mr-1">{t('settings.presets')}</span>
                {thresholdPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setLocalSettings({ ...localSettings, fuzzyMatchingThreshold: preset })}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${localSettings.fuzzyMatchingThreshold === preset ? 'bg-(--op-accent) text-white font-bold' : 'bg-(--op-bg-surface) text-(--op-text-secondary) border border-(--op-border)'
                      }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <SettingToggleRow
              icon={<ShieldCheck className="w-4 h-4 text-(--op-warning)" />}
              title={t('settings.autoMarkFuzzy')}
              description={t('settings.autoMarkFuzzyDesc')}
              checked={localSettings.autoMarkFuzzyUnder100}
              onChange={(checked) => setLocalSettings({ ...localSettings, autoMarkFuzzyUnder100: checked })}
            />
          </div>
        )}

        {activeTab === 'git' && (
          <div className="space-y-4">
            <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
              <div>
                <label className="text-white font-semibold flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-(--op-accent)" />
                  <span>{t('settings.gitAuthorTitle')}</span>
                </label>
                <p className="text-[11px] text-(--op-text-muted) mt-0.5">
                  {t('settings.gitAuthorDesc')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-(--op-text-secondary) text-[11px] mb-1 font-medium">{t('settings.gitAuthorName')}</label>
                  <input
                    type="text"
                    value={localSettings.authorName}
                    onChange={(e) => setLocalSettings({ ...localSettings, authorName: e.target.value })}
                    className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-3 py-1.5 text-xs text-white focus:border-(--op-accent) outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-(--op-text-secondary) text-[11px] mb-1 font-medium">{t('settings.gitAuthorEmail')}</label>
                  <input
                    type="email"
                    value={localSettings.authorEmail}
                    onChange={(e) => setLocalSettings({ ...localSettings, authorEmail: e.target.value })}
                    className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-3 py-1.5 text-xs text-white focus:border-(--op-accent) outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) space-y-3">
            <label className="text-white font-semibold text-xs block">
              {t('settings.shortcutsTitle')}
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                { label: 'Undo Edit:', kbd: 'Ctrl+Z / Cmd+Z' },
                { label: 'Redo Edit:', kbd: 'Ctrl+Y / Cmd+Shift+Z' },
                { label: 'Next / Prev:', kbd: 'Ctrl+Down / Up' },
                { label: 'Save & Next:', kbd: 'Ctrl+Enter' }
              ].map(s => (
                <div key={s.label} className="bg-(--op-bg-surface) p-2.5 rounded border border-(--op-border) flex justify-between items-center">
                  <span className="text-(--op-text-secondary)">{s.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-(--op-bg-canvas) text-(--op-text-primary) border border-(--op-border) font-mono text-[10px]">{s.kbd}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};