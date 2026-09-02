import React, { useState, useEffect } from 'react';
import { Plus, Folder } from 'lucide-react';
import { PoEntry } from '../types/gettext';
import { generateEntryId } from '../lib/poParser';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';

interface NewKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddKey: (entry: PoEntry) => void;
  availableCategories?: string[];
  defaultCategory?: string;
}

export const NewKeyModal: React.FC<NewKeyModalProps> = ({
  isOpen,
  onClose,
  onAddKey,
  availableCategories = [],
  defaultCategory = '',
}) => {
  const { t } = useTranslation();

  const [msgid, setMsgid] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [hasPlural, setHasPlural] = useState(false);
  const [msgidPlural, setMsgidPlural] = useState('');
  const [msgctxt, setMsgctxt] = useState('');
  const [comments, setComments] = useState('');
  const [references, setReferences] = useState('');

  useEffect(() => {
    if (isOpen) setCategory(defaultCategory);
  }, [defaultCategory, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgid.trim()) return;

    const newEntry: PoEntry = {
      id: generateEntryId(),
      msgid: msgid.trim(),
      category: category.trim() ? category.trim() : undefined,
      msgidPlural: hasPlural && msgidPlural.trim() ? msgidPlural.trim() : undefined,
      msgctxt: msgctxt.trim() ? msgctxt.trim() : undefined,
      msgstr: hasPlural ? ['', ''] : [''],
      comments: comments ? comments.split('\n').filter((c) => c.trim() !== '') : [],
      extractedComments: category.trim() ? [`Category: ${category.trim()}`] : [],
      references: references ? references.split(',').map((r) => r.trim()).filter(Boolean) : ['src/manual_entry.tsx:1'],
      flags: [],
    };

    onAddKey(newEntry);
    onClose();
    
    setMsgid('');
    setCategory('');
    setHasPlural(false);
    setMsgidPlural('');
    setMsgctxt('');
    setComments('');
    setReferences('');
  };

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
        form="new-key-form"
        className="px-4 py-1.5 rounded bg-(--op-accent) hover:bg-(--op-accent-strong) text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-(--op-accent)/20 cursor-pointer transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t('newKey.submit')}</span>
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('newKey.title')}
      subtitle={t('newKey.desc')}
      icon={<Plus className="w-4 h-4" />}
      maxWidth="max-w-lg"
      footer={modalFooter}
    >
      <form id="new-key-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-(--op-text-primary) font-medium mb-1">
            {t('newKey.sourceLabel')}
          </label>
          <textarea
            required
            rows={2}
            value={msgid}
            onChange={(e) => setMsgid(e.target.value)}
            placeholder={t('newKey.sourcePlaceholder')}
            className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded p-2.5 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-(--op-text-secondary) font-medium mb-1 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-(--op-warning)" />
            <span>{t('newKey.categoryLabel')}</span>
          </label>
          <input
            type="text"
            list="newkey-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('newKey.categoryPlaceholder')}
            className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-mono text-(--op-accent-alt) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none"
          />
          <datalist id="newkey-category-suggestions">
            {availableCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-[10px] text-(--op-text-muted) mt-1">{t('category.categoryHelp')}</p>
        </div>

        <div className="bg-(--op-bg-canvas) p-3 rounded border border-(--op-border) space-y-2">
          <label className="flex items-center gap-2 cursor-pointer w-max">
            <input
              type="checkbox"
              checked={hasPlural}
              onChange={(e) => setHasPlural(e.target.checked)}
              className="rounded bg-(--op-bg-surface) border-(--op-border) text-(--op-accent) focus:ring-0"
            />
            <span className="font-medium text-(--op-text-primary)">{t('newKey.hasPlural')}</span>
          </label>

          {hasPlural && (
            <div className="pt-2 border-t border-(--op-border)">
              <label className="block text-(--op-text-secondary) text-[11px] mb-1">{t('newKey.pluralLabel')}</label>
              <input
                type="text"
                value={msgidPlural}
                onChange={(e) => setMsgidPlural(e.target.value)}
                placeholder={t('newKey.pluralPlaceholder')}
                className="w-full bg-(--op-bg-surface) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-(--op-text-secondary) font-medium mb-1">{t('newKey.contextLabel')}</label>
            <input
              type="text"
              value={msgctxt}
              onChange={(e) => setMsgctxt(e.target.value)}
              placeholder={t('newKey.contextPlaceholder')}
              className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none"
            />
          </div>
          <div>
            <label className="block text-(--op-text-secondary) font-medium mb-1">{t('newKey.refLabel')}</label>
            <input
              type="text"
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              placeholder="src/components/Header.tsx:42"
              className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded px-2.5 py-1.5 text-xs font-mono text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-(--op-text-secondary) font-medium mb-1">{t('newKey.commentsLabel')}</label>
          <input
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={t('newKey.commentsPlaceholder')}
            className="w-full bg-(--op-bg-canvas) border border-(--op-border) rounded px-2.5 py-1.5 text-xs text-(--op-text-primary) placeholder-(--op-text-muted) focus:border-(--op-accent) outline-none"
          />
        </div>
      </form>
    </Modal>
  );
};