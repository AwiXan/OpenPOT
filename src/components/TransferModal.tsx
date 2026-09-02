import React, { useState } from 'react';
import { Download, FileArchive, FileJson, FileSpreadsheet, FolderOpen, Upload } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';
import { JsonFormat } from '../lib/translationFormats';
import { DropdownMenu } from './ui/DropdownMenu';

export type TransferMode = 'export' | 'import';
export type TransferFormat = 'gettext' | 'csv' | 'json';
export type CsvEncoding = 'utf8' | 'utf8-bom' | 'utf16le';

interface TransferModalProps {
  isOpen: boolean;
  mode: TransferMode;
  onClose: () => void;
  onExport: (format: TransferFormat, csvEncoding: CsvEncoding, jsonFormat: JsonFormat) => Promise<void>;
  onImport: () => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, mode, onClose, onExport, onImport }) => {
  const [format, setFormat] = useState<TransferFormat>('gettext');
  const [csvEncoding, setCsvEncoding] = useState<CsvEncoding>('utf8-bom');
  const [jsonFormat, setJsonFormat] = useState<JsonFormat>('key-first');
  const [busy, setBusy] = useState(false);
  const isExport = mode === 'export';
  const { t } = useTranslation();

  const handleAction = async () => {
    setBusy(true);
    try {
      if (isExport) await onExport(format, csvEncoding, jsonFormat);
      else await onImport();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isExport ? t('transfer.exportTitle') : t('transfer.importTitle')}
      subtitle={isExport ? t('transfer.exportSubtitle') : t('transfer.importSubtitle')}
      icon={isExport ? <Download className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
      footer={(
        <div className="w-full flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-(--op-border) text-(--op-text-secondary) hover:text-white hover:bg-(--op-bg-raised-hover) cursor-pointer">{t('common.cancel')}</button>
          <button onClick={handleAction} disabled={busy} className="px-4 py-1.5 rounded bg-(--op-accent) text-white font-semibold hover:bg-(--op-accent-strong) disabled:opacity-50 cursor-pointer flex items-center gap-2">
            {isExport ? <FolderOpen className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            {busy ? t('transfer.working') : isExport ? t('transfer.chooseFolder') : t('transfer.chooseFile')}
          </button>
        </div>
      )}
    >
      {isExport ? (
        <div className="space-y-2">
          {([
            ['gettext', t('transfer.gettextTitle'), t('transfer.gettextDescription'), FileArchive],
            ['csv', t('transfer.csvTitle'), t('transfer.csvDescription'), FileSpreadsheet],
            ['json', t('transfer.jsonTitle'), t('transfer.jsonDescription'), FileJson],
          ] as const).map(([value, title, description, Icon]) => (
            <button key={value} onClick={() => setFormat(value)} className={`w-full p-3 rounded border text-left flex items-center gap-3 cursor-pointer ${format === value ? 'border-(--op-accent) bg-(--op-bg-active)' : 'border-(--op-border) bg-(--op-bg-canvas) hover:bg-(--op-bg-raised)'}`}>
              <Icon className={`w-5 h-5 ${format === value ? 'text-(--op-accent-alt)' : 'text-(--op-text-secondary)'}`} />
              <span><span className="block text-white font-semibold text-xs">{title}</span><span className="block text-(--op-text-muted) text-[11px] mt-0.5">{description}</span></span>
            </button>
          ))}
          {format === 'csv' && (
            <label className="block pt-3 text-(--op-text-secondary) text-xs">
              <span className="block mb-1.5 font-semibold text-white">{t('transfer.csvEncoding')}</span>
              <DropdownMenu value={csvEncoding} onChange={setCsvEncoding} options={[{ value: 'utf8', label: t('transfer.utf8') }, { value: 'utf8-bom', label: t('transfer.utf8Bom') }, { value: 'utf16le', label: t('transfer.utf16le') }]} />
            </label>
          )}
          {format === 'json' && (
            <label className="block pt-3 text-(--op-text-secondary) text-xs">
              <span className="block mb-1.5 font-semibold text-white">{t('transfer.jsonStructure')}</span>
              <DropdownMenu value={jsonFormat} onChange={setJsonFormat} options={[{ value: 'key-first', label: t('transfer.jsonKeyFirst') }, { value: 'language-first', label: t('transfer.jsonLanguageFirst') }]} />
            </label>
          )}
        </div>
      ) : (
        <div className="rounded border border-(--op-border) bg-(--op-bg-canvas) p-4 text-(--op-text-secondary) text-xs leading-relaxed">
          {t('transfer.importDescription')}
        </div>
      )}
    </Modal>
  );
};