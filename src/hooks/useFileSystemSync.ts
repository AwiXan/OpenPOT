import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { Workspace, PoFileRecord, PotFileRecord, LocalDirectoryState, AppSettings } from '../types/gettext';
import { getPluralRuleForLanguage } from '../lib/pluralEngine';
import { scanFileList, savePoAndMoToDirectory, saveWorkspaceToDirectory, formatPoFilename, formatMoFilename } from '../lib/localDirectoryManager';
import { parsePoContent, serializePoFile } from '../lib/poParser';
import { compileMoBinary } from '../lib/moCompiler';
import { pickNativeDirectory, pickNativeFile, readNativeEncodedTextFile, scanNativeDirectoryFiles, writeNativeTextFile, writeNativeBinaryFile } from '../lib/nativeFS';
import { initGitRepository } from '../lib/gitEngine';
import { createImportedPoFiles, parseTranslationsCsv, parseTranslationsJson, serializeTranslationsCsv, serializeTranslationsJson, JsonFormat, TranslationFormat } from '../lib/translationFormats';
import type { CsvEncoding } from '../components/TransferModal';

export function useFileSystemSync(
  activeWorkspaceId: string,
  currentWorkspace: Workspace | undefined,
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>,
  setActiveWorkspaceId: (id: string) => void,
  settings: AppSettings,
  showToast: (msg: string, type: 'info' | 'success' | 'warning') => void,
  t: (key: string) => string
) {
  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem('openpot_recents');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('openpot_recents', JSON.stringify(recentFolders));
  }, [recentFolders]);

  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
      folderInputRef.current.setAttribute('mozdirectory', '');
    }
  }, []);

  const localDirState = useMemo<LocalDirectoryState>(() => {
    if (!currentWorkspace) {
      return { isConnected: false, dirName: '', dirHandle: null, autoCompileMo: true, totalFiles: 0, savedFilesCount: 0 };
    }
    return {
      isConnected: !!currentWorkspace.localDirPath || !!currentWorkspace.localDirHandle,
      dirName: currentWorkspace.localDirPath || (currentWorkspace.localDirHandle ? currentWorkspace.localDirHandle.name : ''),
      dirHandle: currentWorkspace.localDirHandle || null,
      autoCompileMo: settings.autoCompileMoOnSave ?? true,
      totalFiles: 1 + currentWorkspace.poFiles.length,
      savedFilesCount: currentWorkspace.poFiles.length,
    };
  }, [currentWorkspace, settings.autoCompileMoOnSave]);

  const loadFolderNatively = async (dirPath: string) => {
    try {
      const files = await scanNativeDirectoryFiles(dirPath);
      if (files.length === 0) {
        showToast(`No gettext files found in: ${dirPath}`, 'warning');
        return false;
      }

      const potFileScanned = files.find((f) => f.name.endsWith('.pot'));
      const poFilesScanned = files.filter((f) => f.name.endsWith('.po'));

      const domainName = potFileScanned ? potFileScanned.name.replace(/\.pot$/, '') : 'messages';

      const parsedPot = potFileScanned
        ? parsePoContent(potFileScanned.content)
        : parsePoContent('');

      const potRecord: PotFileRecord = {
        id: `pot_${Date.now()}`,
        filename: potFileScanned ? potFileScanned.name : `${domainName}.pot`,
        domainName,
        header: parsedPot.header,
        entries: parsedPot.entries,
      };

      const poRecords: PoFileRecord[] = poFilesScanned.map((f, i) => {
        const parsed = parsePoContent(f.content);
        const langCode = parsed.header.language || f.name.replace(/\.po$/, '');
        parsed.header.language = langCode;
        if (!parsed.header.pluralForms) {
          parsed.header.pluralForms = getPluralRuleForLanguage(langCode).formula;
        }
        return {
          id: `po_${langCode}_${Date.now()}_${i}`,
          filename: f.name,
          language: langCode,
          languageName: langCode.toUpperCase(),
          header: parsed.header,
          entries: parsed.entries,
        };
      });

      const loadedWorkspace: Workspace = {
        id: `ws_${Date.now()}`,
        name: domainName,
        domainName,
        potFile: potRecord,
        poFiles: poRecords,
        activeFileId: poRecords[0]?.id || 'pot',
        activeEntryId: potRecord.entries[0]?.id || null,
        createdAt: new Date().toISOString(),
        localDirPath: dirPath,
      };

      setWorkspaces((prev) => [...prev, loadedWorkspace]);
      setActiveWorkspaceId(loadedWorkspace.id);

      setRecentFolders((prev) => {
        const filtered = prev.filter((p) => p !== dirPath);
        return [dirPath, ...filtered].slice(0, 10);
      });

      const message = t('toast.loaded').replace('${dirPath}', dirPath);
      showToast(message, 'success');

      return true;
    } catch (err: any) {
      console.error('Failed to load native directory:', err);
      showToast(`Error loading directory: ${err?.message || err}`, 'warning');
      return false;
    }
  };

  const handleOpenLocalFolder = async () => {
    const dirPath = await pickNativeDirectory();
    if (!dirPath) return;
    await loadFolderNatively(dirPath);
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const result = await scanFileList(files);
      if (result.workspaces.length === 0) {
        showToast('No .pot or .po gettext files found in selected folder.', 'warning');
        return;
      }

      const newWorkspaces = result.workspaces.map(w => ({
        ...w,
        localDirPath: result.dirName,
        localDirHandle: result.dirHandle
      }));

      setWorkspaces((prev) => [...prev, ...newWorkspaces]);
      setActiveWorkspaceId(newWorkspaces[0].id);

      showToast(`Loaded folder "${result.dirName}" with ${newWorkspaces.length} domain(s) and ${result.totalFilesFound} file(s)!`, 'success');
    } catch (err: any) {
      console.error('Failed to parse selected folder:', err);
      showToast(err.message || 'Failed to read files from folder', 'warning');
    }

    e.target.value = '';
  };

  const handleDisconnectLocalFolder = () => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === activeWorkspaceId
          ? { ...w, localDirPath: undefined, localDirHandle: undefined }
          : w
      )
    );
    showToast('Local folder disconnected from this workspace.', 'info');
  };

  const handleSyncLocalFolder = async () => {
    if (!currentWorkspace) return;

    const dirPath = currentWorkspace.localDirPath;
    const dirHandle = currentWorkspace.localDirHandle;

    if (!dirPath && !dirHandle) {
      showToast('No local folder is connected to this workspace.', 'warning');
      return;
    }

    if (dirPath) {
      try {
        const domain = currentWorkspace.domainName || 'messages';
        let savedPo = 0;
        let savedMo = 0;
        const cleanDir = dirPath.replace(/\\/g, '/');

        // 1. ИСПРАВЛЕНИЕ: Обязательно сохраняем POT-файл (шаблон)
        const potFilename = currentWorkspace.potFile.filename || `${domain}.pot`;
        const potContent = serializePoFile(currentWorkspace.potFile.header, currentWorkspace.potFile.entries, true);
        await writeNativeTextFile(`${cleanDir}/${potFilename}`, potContent);
        savedPo++;

        // 2. ИСПРАВЛЕНИЕ: Сохраняем языковые PO-файлы БЕЗ принудительной авто-категоризации
        for (const po of currentWorkspace.poFiles) {
          const poFilename = po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme);
          const poContent = serializePoFile(po.header, po.entries, false);
          const fullPoPath = `${cleanDir}/${poFilename}`;

          await writeNativeTextFile(fullPoPath, poContent);
          savedPo++;

          if (settings.autoCompileMoOnSave ?? true) {
            const moFilename = poFilename.endsWith('.po')
              ? poFilename.slice(0, -3) + '.mo'
              : formatMoFilename(domain, po.language, settings.poNamingScheme);

            const moBinary = compileMoBinary(po.header, po.entries);
            const fullMoPath = `${cleanDir}/${moFilename}`;
            await writeNativeBinaryFile(fullMoPath, moBinary);
            savedMo++;
          }
        }

        if (settings.autoCompileJsonOnSave) {
          await writeNativeTextFile(`${cleanDir}/${domain}.json`, serializeTranslationsJson(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
        }
        if (settings.autoCompileCsvOnSave) {
          await writeNativeTextFile(`${cleanDir}/${domain}.csv`, serializeTranslationsCsv(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
        }

        setWorkspaces((prev) =>
          prev.map((w) => (w.id === activeWorkspaceId ? { ...w, isModified: false } : w))
        );

        const message = t('toast.synced').replace('${savedPo}', savedPo.toString()).replace('${savedMo}', savedMo.toString());
        showToast(message, 'success');
      } catch (err: any) {
        console.error('Failed to sync native folder:', err);
        showToast(`Native disk sync failed: ${err.message}`, 'warning');
      }
      return;
    }

    if (dirHandle) {
      try {
        const summary = await saveWorkspaceToDirectory(
          dirHandle,
          currentWorkspace,
          settings.autoCompileMoOnSave ?? true,
          settings.poNamingScheme || 'domain_lang',
          false // 3. ИСПРАВЛЕНИЕ: Отключаем перезапись категорий для Web API
        );

        if (settings.autoCompileJsonOnSave || settings.autoCompileCsvOnSave) {
          const writeDirectoryText = async (filename: string, content: string) => {
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
          };
          const domain = currentWorkspace.domainName || 'messages';
          if (settings.autoCompileJsonOnSave) await writeDirectoryText(`${domain}.json`, serializeTranslationsJson(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
          if (settings.autoCompileCsvOnSave) await writeDirectoryText(`${domain}.csv`, serializeTranslationsCsv(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
        }

        setWorkspaces((prev) =>
          prev.map((w) => (w.id === activeWorkspaceId ? { ...w, isModified: false } : w))
        );

        showToast(`Synced ${summary.savedPoCount} .po files and compiled ${summary.savedMoCount} .mo binaries directly to disk!`, 'success');
      } catch (err: any) {
        console.error('Failed to sync to local directory:', err);
        showToast(`Disk sync failed: ${err.message}`, 'warning');
      }
    }
  };

  const handleExport = async (format: TranslationFormat, csvEncoding: CsvEncoding = 'utf8-bom', jsonFormat: JsonFormat = 'key-first') => {
    if (!currentWorkspace) return;
    const destination = await pickNativeDirectory();
    if (!destination) return;
    const domain = currentWorkspace.domainName || currentWorkspace.name || 'messages';
    const safeName = domain.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    if (format === 'gettext') {
      const zip = new JSZip();
      const folder = zip.folder(safeName) || zip;
      
      folder.file(
        currentWorkspace.potFile.filename || `${domain}.pot`,
        serializePoFile(currentWorkspace.potFile.header, currentWorkspace.potFile.entries, true)
      );
      
      currentWorkspace.poFiles.forEach((po) => {
        folder.file(
          po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme),
          serializePoFile(po.header, po.entries, false)
        );
        folder.file(
          formatMoFilename(domain, po.language, settings.poNamingScheme),
          compileMoBinary(po.header, po.entries)
        );
      });
      await writeNativeBinaryFile(`${destination}/${safeName}.zip`, await zip.generateAsync({ type: 'uint8array' }));
    } else {
      const content = format === 'csv'
        ? serializeTranslationsCsv(currentWorkspace, settings.csvPluralSuffix || '_P%d')
        : serializeTranslationsJson(currentWorkspace, settings.csvPluralSuffix || '_P%d', jsonFormat);
      if (format === 'csv') {
        const encoded = new TextEncoder().encode(content);
        const bytes = csvEncoding === 'utf8'
          ? encoded
          : csvEncoding === 'utf8-bom'
            ? new Uint8Array([0xEF, 0xBB, 0xBF, ...encoded])
            : (() => {
              const utf16 = new Uint8Array(2 + content.length * 2);
              utf16[0] = 0xFF;
              utf16[1] = 0xFE;
              for (let index = 0; index < content.length; index++) {
                const code = content.charCodeAt(index);
                utf16[2 + index * 2] = code & 0xFF;
                utf16[3 + index * 2] = code >> 8;
              }
              return utf16;
            })();
        await writeNativeBinaryFile(`${destination}/${safeName}.csv`, bytes);
      } else {
        await writeNativeTextFile(`${destination}/${safeName}.${format}`, content);
      }
    }
    showToast(`Exported ${format.toUpperCase()} to ${destination}`, 'success');
  };

  const handleExportMo = async (po: PoFileRecord, useConnectedFolder = false) => {
    const connectedPath = currentWorkspace?.localDirPath;
    const connectedHandle = currentWorkspace?.localDirHandle;
    if (!useConnectedFolder || (!connectedPath && !connectedHandle)) {
      const destination = await pickNativeDirectory();
      if (!destination) return;
      const domain = currentWorkspace?.domainName || 'messages';
      await writeNativeBinaryFile(`${destination}/${formatMoFilename(domain, po.language, settings.poNamingScheme)}`, compileMoBinary(po.header, po.entries));
      showToast(`Exported ${po.language.toUpperCase()} .MO to ${destination}`, 'success');
      return;
    }

    const domain = currentWorkspace?.domainName || 'messages';
    const filename = formatMoFilename(domain, po.language, settings.poNamingScheme);
    if (connectedPath) {
      await writeNativeBinaryFile(`${connectedPath.replace(/\\/g, '/')}/${filename}`, compileMoBinary(po.header, po.entries));
    } else if (connectedHandle) {
      const fileHandle = await connectedHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(compileMoBinary(po.header, po.entries));
      await writable.close();
    }
    showToast(`Exported ${po.language.toUpperCase()} .MO to the connected folder`, 'success');
  };

  const handleImportCsvJson = async () => {
    const filePath = await pickNativeFile();
    if (!filePath) return;
    const content = await readNativeEncodedTextFile(filePath);
    const extension = filePath.toLowerCase().split('.').pop();
    if (extension === 'po' || extension === 'pot') {
      const parsed = parsePoContent(content);
      if (extension === 'pot') {
        const domainName = filePath.split(/[\\/]/).pop()?.replace(/\.pot$/i, '') || 'messages';
        const potFile: PotFileRecord = { id: `pot_${Date.now()}`, filename: `${domainName}.pot`, domainName, header: parsed.header, entries: parsed.entries };
        const newWorkspace: Workspace = { id: `ws_${Date.now()}`, name: domainName, domainName, potFile, poFiles: [], activeFileId: 'pot', activeEntryId: parsed.entries[0]?.id || null, createdAt: new Date().toISOString() };
        setWorkspaces((prev) => [...prev, newWorkspace]);
        setActiveWorkspaceId(newWorkspace.id);
      } else {
        const language = parsed.header.language || 'und';
        const po: PoFileRecord = { id: `po_${Date.now()}`, filename: filePath.split(/[\\/]/).pop() || `${language}.po`, language, languageName: language.toUpperCase(), header: parsed.header, entries: parsed.entries };
        setWorkspaces((prev) => prev.map((workspace) => workspace.id === activeWorkspaceId ? { ...workspace, poFiles: [...workspace.poFiles, po], activeFileId: po.id, isModified: true } : workspace));
      }
    } else {
      const entriesByLanguage = extension === 'csv'
        ? parseTranslationsCsv(content, settings.csvPluralSuffix || '_P%d')
        : parseTranslationsJson(content);
      const importedFiles = createImportedPoFiles(entriesByLanguage);
      setWorkspaces((prev) => prev.map((workspace) => workspace.id === activeWorkspaceId ? { ...workspace, poFiles: [...workspace.poFiles, ...importedFiles], activeFileId: importedFiles[0]?.id || workspace.activeFileId, activeEntryId: importedFiles[0]?.entries[0]?.id || workspace.activeEntryId, isModified: true } : workspace));
    }
    showToast(`Imported ${filePath.split(/[\\/]/).pop()}`, 'success');
  };

  const triggerDiskSyncForPo = useCallback(
    async (poRecord: PoFileRecord) => {
      if (!currentWorkspace) return;

      const dirPath = currentWorkspace.localDirPath;
      const dirHandle = currentWorkspace.localDirHandle;

      if (dirPath) {
        try {
          const domain = currentWorkspace.domainName || 'messages';
          const poFilename = poRecord.filename || formatPoFilename(domain, poRecord.language, settings.poNamingScheme);
          const poContent = serializePoFile(poRecord.header, poRecord.entries, false);
          const cleanDir = dirPath.replace(/\\/g, '/');
          const fullPoPath = `${cleanDir}/${poFilename}`;

          await writeNativeTextFile(fullPoPath, poContent);

          if (settings.autoCompileMoOnSave ?? true) {
            const moFilename = poFilename.endsWith('.po')
              ? poFilename.slice(0, -3) + '.mo'
              : formatMoFilename(domain, poRecord.language, settings.poNamingScheme);
            const moBinary = compileMoBinary(poRecord.header, poRecord.entries);
            const fullMoPath = `${cleanDir}/${moFilename}`;
            await writeNativeBinaryFile(fullMoPath, moBinary);
          }

          if (settings.autoCompileJsonOnSave) await writeNativeTextFile(`${cleanDir}/${domain}.json`, serializeTranslationsJson(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
          if (settings.autoCompileCsvOnSave) await writeNativeTextFile(`${cleanDir}/${domain}.csv`, serializeTranslationsCsv(currentWorkspace, settings.csvPluralSuffix || '_P%d'));

          setWorkspaces((prev) =>
            prev.map((w) => (w.id === activeWorkspaceId ? { ...w, isModified: false } : w))
          );
        } catch (err) {
          console.error('NATIVE DISK SYNC ERROR:', err);
        }
        return;
      }

      if (dirHandle) {
        try {
          const domain = currentWorkspace.domainName || 'messages';
          await savePoAndMoToDirectory(
            dirHandle,
            poRecord,
            settings.autoCompileMoOnSave ?? true,
            domain,
            settings.poNamingScheme || 'domain_lang',
            false // 4. ИСПРАВЛЕНИЕ: Отключаем перезапись категорий
          );
          if (settings.autoCompileJsonOnSave || settings.autoCompileCsvOnSave) {
            const writeDirectoryText = async (filename: string, content: string) => {
              const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(content);
              await writable.close();
            };
            const domain = currentWorkspace.domainName || 'messages';
            if (settings.autoCompileJsonOnSave) await writeDirectoryText(`${domain}.json`, serializeTranslationsJson(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
            if (settings.autoCompileCsvOnSave) await writeDirectoryText(`${domain}.csv`, serializeTranslationsCsv(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
          }
        } catch (err) {
          console.error('FULL DISK SYNC ERROR:', err);
        }
      }
    },
    [currentWorkspace, settings.autoCompileMoOnSave, settings.autoCompileCsvOnSave, settings.autoCompileJsonOnSave, settings.csvPluralSuffix, settings.poNamingScheme, activeWorkspaceId, setWorkspaces]
  );

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      const { header, entries } = parsePoContent(text);
      const filename = file.name;
      const isPot = filename.endsWith('.pot') || !header.language;

      if (isPot) {
        const domainName = filename.replace(/\.pot$/, '');
        const newPot: PotFileRecord = {
          id: `pot_${Date.now()}_${i}`,
          filename,
          domainName,
          header,
          entries,
        };

        const newWs: Workspace = {
          id: `ws_${Date.now()}_${i}`,
          name: domainName,
          domainName,
          potFile: newPot,
          poFiles: [],
          activeFileId: 'pot',
          activeEntryId: entries[0]?.id || null,
          createdAt: new Date().toISOString(),
        };

        newWs.git = initGitRepository(newWs, `Initial commit for ${filename}`, settings.authorName, settings.authorEmail);

        setWorkspaces((prev) => [...prev, newWs]);
        setActiveWorkspaceId(newWs.id);
      } else {
        const langCode = header.language || filename.replace(/\.po$/, '');
        
        header.language = langCode;
        if (!header.pluralForms) {
          header.pluralForms = getPluralRuleForLanguage(langCode).formula;
        }

        const newPo: PoFileRecord = {
          id: `po_${langCode}_${Date.now()}`,
          filename,
          language: langCode,
          languageName: langCode.toUpperCase(),
          header,
          entries,
        };

        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === activeWorkspaceId
              ? { ...w, poFiles: [...w.poFiles, newPo], activeFileId: newPo.id, isModified: true }
              : w
          )
        );
      }
    }
    e.target.value = '';
  };

  return {
    localDirState,
    folderInputRef,
    recentFolders,
    loadFolderNatively,
    handleOpenLocalFolder,
    handleFolderInputChange,
    handleDisconnectLocalFolder,
    handleSyncLocalFolder,
    triggerDiskSyncForPo,
    handleImportFile,
    handleExport,
    handleExportMo,
    handleImportCsvJson,
  };
}