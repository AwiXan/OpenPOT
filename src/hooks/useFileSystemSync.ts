import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { confirm } from '@tauri-apps/plugin-dialog';
import { exists } from '@tauri-apps/plugin-fs';
import { Workspace, PoFileRecord, PotFileRecord, LocalDirectoryState, AppSettings } from '../types/gettext';
import { getPluralRuleForLanguage } from '../lib/pluralEngine';
import {
  scanFileList,
  scanLocalDirectoryEntries,
  savePoAndMoToDirectory,
  saveWorkspaceToDirectory,
  formatPoFilename,
  formatMoFilename,
} from '../lib/localDirectoryManager';
import { parsePoContent, serializePoFile, linkPoEntriesToPot } from '../lib/poParser';
import { compileMoBinary } from '../lib/moCompiler';
import { pickNativeDirectory, pickNativeFile, readNativeEncodedTextFile, scanNativeDirectoryFiles, writeNativeTextFile, writeNativeBinaryFile } from '../lib/nativeFS';
import { initGitRepository } from '../lib/gitEngine';
import { createImportedPoFiles, parseTranslationsCsv, parseTranslationsJson, serializeTranslationsCsv, serializeTranslationsJson, JsonFormat, TranslationFormat } from '../lib/translationFormats';
import {
  ScannedFolderFile,
  computeDiskFileHashes,
  detectExternalFolderChanges,
  hashFileContent,
  mergeFolderFilesIntoWorkspace,
} from '../lib/folderSync';
import type { CsvEncoding } from '../components/TransferModal';

export interface SyncFromFolderOptions {
  silent?: boolean;
  onlyIfUnmodified?: boolean;
  confirmIfModified?: boolean;
  onBeforeApply?: (ws: Workspace) => void;
}

export function useFileSystemSync(
  workspaces: Workspace[],
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
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  const hasRunStartupSyncRef = useRef(false);
  const isAutoSyncingRef = useRef(false);
  const lastAutoSyncAtRef = useRef(0);

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

  const readWorkspaceFolderFiles = useCallback(async (ws: Workspace): Promise<ScannedFolderFile[]> => {
    if (ws.localDirPath) {
      const knownPaths = [ws.potFile.filename, ...ws.poFiles.map((p) => p.filename)];
      const nativeFiles = await scanNativeDirectoryFiles(ws.localDirPath, knownPaths);
      return nativeFiles.map((f) => ({ name: f.name, content: f.content }));
    }
    if (ws.localDirHandle) {
      return scanLocalDirectoryEntries(ws.localDirHandle);
    }
    return [];
  }, []);

  const syncWorkspaceFromFolder = useCallback(
    async (targetWorkspace: Workspace, options: SyncFromFolderOptions = {}): Promise<boolean> => {
      if (!targetWorkspace.localDirPath && !targetWorkspace.localDirHandle) {
        if (!options.silent) {
          showToast(t('toast.noFolderConnected') || 'No local folder is connected to this workspace.', 'warning');
        }
        return false;
      }

      if (options.onlyIfUnmodified && targetWorkspace.isModified) {
        return false;
      }

      let scannedFiles: ScannedFolderFile[];
      try {
        scannedFiles = await readWorkspaceFolderFiles(targetWorkspace);
      } catch (err: any) {
        console.error('Failed to read connected folder:', err);
        if (!options.silent) {
          showToast(`Failed to read folder: ${err?.message || err}`, 'warning');
        }
        return false;
      }

      if (scannedFiles.length === 0) {
        if (!options.silent) {
          showToast(t('toast.noGettextFilesFound') || 'No .pot or .po files found in connected folder.', 'warning');
        }
        return false;
      }

      const result = mergeFolderFilesIntoWorkspace(targetWorkspace, scannedFiles, {
        preserveInAppCategoriesWhenModified: Boolean(targetWorkspace.isModified),
      });

      if (options.confirmIfModified && targetWorkspace.isModified) {
        const confirmMsg =
          t('toast.confirmFetchOverModified') ||
          'You have unsaved changes in OpenPO. Syncing from the folder will update translations from disk (categories will be preserved and you can undo with Ctrl+Z). Continue?';
        const ok = await confirm(confirmMsg, {
          title: t('header.syncFromFolder') || 'Sync from Folder',
          kind: 'warning',
        });
        if (!ok) return false;
      }

      const hashesChanged =
        JSON.stringify(targetWorkspace.diskFileHashes || {}) !==
        JSON.stringify(result.workspace.diskFileHashes || {});

      if (!result.hasContentChanges && !hashesChanged) {
        if (!options.silent) {
          showToast(t('toast.folderUpToDate') || 'Folder is already up to date.', 'info');
        }
        return false;
      }

      if (result.hasContentChanges) {
        options.onBeforeApply?.(targetWorkspace);
      }

      setWorkspaces((prev) =>
        prev.map((w) => (w.id === targetWorkspace.id ? result.workspace : w))
      );

      if (result.hasContentChanges) {
        const msg = (
          t('toast.fetchedFromFolder') ||
          'Synced ${count} file(s) from folder (categories preserved)!'
        ).replace('${count}', result.changedFilesCount.toString());
        showToast(msg, 'success');
      } else if (!options.silent) {
        showToast(t('toast.folderUpToDate') || 'Folder is already up to date.', 'info');
      }

      return result.hasContentChanges;
    },
    [readWorkspaceFolderFiles, setWorkspaces, showToast, t]
  );

  const handleSyncFromFolder = useCallback(
    async (options: SyncFromFolderOptions = {}) => {
      if (!currentWorkspace) return false;
      return syncWorkspaceFromFolder(currentWorkspace, {
        confirmIfModified: true,
        ...options,
      });
    },
    [currentWorkspace, syncWorkspaceFromFolder]
  );

  // Auto-sync connected native folders on app startup so external manual edits appear immediately
  useEffect(() => {
    if (hasRunStartupSyncRef.current) return;
    hasRunStartupSyncRef.current = true;

    const runStartupSync = async () => {
      const initialWorkspaces = workspacesRef.current;
      let totalExternalWarned = false;

      for (const ws of initialWorkspaces) {
        if (!ws.localDirPath) continue;
        try {
          const dirExists = await exists(ws.localDirPath);
          if (!dirExists) continue;

          if (!ws.isModified) {
            await syncWorkspaceFromFolder(ws, { silent: true, onlyIfUnmodified: true });
          } else if (ws.diskFileHashes) {
            const scanned = await readWorkspaceFolderFiles(ws);
            const { changedFiles } = detectExternalFolderChanges(ws, scanned);
            if (changedFiles.length > 0 && !totalExternalWarned) {
              totalExternalWarned = true;
              showToast(
                t('toast.externalChangesDetected') ||
                  'External edits detected in folder. Click "Sync from Folder" to pull them without losing categories.',
                'warning'
              );
            }
          }
        } catch {
          // Ignore non-native path or inaccessible folder on startup
        }
      }
      lastAutoSyncAtRef.current = Date.now();
    };

    runStartupSync();
  }, [readWorkspaceFolderFiles, showToast, syncWorkspaceFromFolder, t]);

  // Auto-sync active workspace when window regains focus if there are no unsaved in-app edits
  useEffect(() => {
    const handleWindowFocus = async () => {
      if (isAutoSyncingRef.current) return;
      if (Date.now() - lastAutoSyncAtRef.current < 1500) return;

      const ws = workspacesRef.current.find((w) => w.id === activeWorkspaceIdRef.current);
      if (!ws || !ws.localDirPath || ws.isModified) return;

      isAutoSyncingRef.current = true;
      try {
        const dirExists = await exists(ws.localDirPath);
        if (!dirExists) return;

        const scanned = await readWorkspaceFolderFiles(ws);
        if (scanned.length === 0) return;

        if (ws.diskFileHashes) {
          const { changedFiles } = detectExternalFolderChanges(ws, scanned);
          if (changedFiles.length === 0) return;
        }

        await syncWorkspaceFromFolder(ws, { silent: true, onlyIfUnmodified: true });
      } catch {
        // Ignore transient focus errors
      } finally {
        lastAutoSyncAtRef.current = Date.now();
        isAutoSyncingRef.current = false;
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [readWorkspaceFolderFiles, syncWorkspaceFromFolder]);

  const loadFolderNatively = async (dirPath: string) => {
    try {
      const files = await scanNativeDirectoryFiles(dirPath);
      if (files.length === 0) {
        showToast(`No gettext files found in: ${dirPath}`, 'warning');
        return false;
      }

      const potFileScanned = files.find((f) => f.name.toLowerCase().endsWith('.pot'));
      const poFilesScanned = files.filter((f) => f.name.toLowerCase().endsWith('.po'));

      const domainName = potFileScanned ? potFileScanned.name.replace(/\.pot$/i, '') : 'messages';

      const parsedPot = potFileScanned
        ? parsePoContent(potFileScanned.content)
        : parsePoContent('');

      let potEntries = parsedPot.entries;
      if (!potFileScanned && poFilesScanned.length > 0) {
        const firstParsed = parsePoContent(poFilesScanned[0].content);
        potEntries = firstParsed.entries.map((e) => ({
          ...e,
          msgstr: e.msgidPlural ? ['', ''] : [''],
        }));
      }

      const potRecord: PotFileRecord = {
        id: `pot_${Date.now()}`,
        filename: potFileScanned ? potFileScanned.name : `${domainName}.pot`,
        domainName,
        header: parsedPot.header,
        entries: potEntries,
        isModified: false,
      };

      const poRecords: PoFileRecord[] = poFilesScanned.map((f, i) => {
        const parsed = parsePoContent(f.content);
        const langCode = parsed.header.language || f.name.replace(/\.po$/i, '');
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
          entries: linkPoEntriesToPot(potRecord.entries, parsed.entries),
          isModified: false,
        };
      });

      const diskFileHashes = computeDiskFileHashes(
        files.map((f) => ({ name: f.name, content: f.content }))
      );

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
        isModified: false,
        diskFileHashes,
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
          ? { ...w, localDirPath: undefined, localDirHandle: undefined, diskFileHashes: undefined }
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

    // Check if external edits happened on disk before blindly overwriting
    try {
      const scannedOnDisk = await readWorkspaceFolderFiles(currentWorkspace);
      if (scannedOnDisk.length > 0 && currentWorkspace.diskFileHashes) {
        const { changedFiles } = detectExternalFolderChanges(currentWorkspace, scannedOnDisk);
        if (changedFiles.length > 0) {
          if (!currentWorkspace.isModified) {
            // Nothing was edited in OpenPO -> pull from disk instead of overwriting external work!
            const merged = mergeFolderFilesIntoWorkspace(currentWorkspace, scannedOnDisk, {
              preserveInAppCategoriesWhenModified: false,
            });
            let compiledMo = 0;
            if (dirPath && (settings.autoCompileMoOnSave ?? true)) {
              const domain = merged.workspace.domainName || 'messages';
              const cleanDir = dirPath.replace(/\\/g, '/');
              for (const po of merged.workspace.poFiles) {
                const poFilename = po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme);
                const moFilename = poFilename.endsWith('.po')
                  ? poFilename.slice(0, -3) + '.mo'
                  : formatMoFilename(domain, po.language, settings.poNamingScheme);
                await writeNativeBinaryFile(`${cleanDir}/${moFilename}`, compileMoBinary(po.header, po.entries));
                compiledMo++;
              }
            }
            setWorkspaces((prev) =>
              prev.map((w) => (w.id === activeWorkspaceId ? merged.workspace : w))
            );
            const msg = (
              t('toast.pulledBeforeSync') ||
              'External edits found in folder — synced ${count} file(s) from disk (categories preserved)!'
            ).replace('${count}', merged.changedFilesCount.toString());
            showToast(compiledMo > 0 ? `${msg} (+${compiledMo} .mo)` : msg, 'success');
            return;
          }

          const overwriteMsg = (
            t('toast.confirmOverwriteExternal') ||
            'Files in the folder (${files}) were modified externally since the last sync.\n\nOverwrite disk files with your OpenPO changes?\n(Click Cancel and use "Sync from Folder" to keep external edits.)'
          ).replace('${files}', changedFiles.join(', '));
          const confirmed = await confirm(overwriteMsg, {
            title: t('menu.saveSync') || 'Save & Sync to Disk',
            kind: 'warning',
          });
          if (!confirmed) return;
        }
      }
    } catch (err) {
      console.warn('Pre-sync disk check failed, continuing save:', err);
    }

    if (dirPath) {
      try {
        const domain = currentWorkspace.domainName || 'messages';
        let savedPo = 0;
        let savedMo = 0;
        const cleanDir = dirPath.replace(/\\/g, '/');
        const writtenHashes: Record<string, string> = {};

        // 1. Save POT template
        const potFilename = currentWorkspace.potFile.filename || `${domain}.pot`;
        const potContent = serializePoFile(currentWorkspace.potFile.header, currentWorkspace.potFile.entries, true);
        await writeNativeTextFile(`${cleanDir}/${potFilename}`, potContent);
        writtenHashes[potFilename] = hashFileContent(potContent);
        savedPo++;

        // 2. Save PO files without forcing auto-categorization
        for (const po of currentWorkspace.poFiles) {
          const poFilename = po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme);
          const poContent = serializePoFile(po.header, po.entries, false);
          const fullPoPath = `${cleanDir}/${poFilename}`;

          await writeNativeTextFile(fullPoPath, poContent);
          writtenHashes[poFilename] = hashFileContent(poContent);
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
          prev.map((w) =>
            w.id === activeWorkspaceId
              ? {
                  ...w,
                  isModified: false,
                  potFile: { ...w.potFile, isModified: false },
                  poFiles: w.poFiles.map((p) => ({ ...p, isModified: false })),
                  diskFileHashes: writtenHashes,
                }
              : w
          )
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
          false
        );

        const domain = currentWorkspace.domainName || 'messages';
        const writtenHashes: Record<string, string> = {};
        const potFilename = currentWorkspace.potFile.filename || `${domain}.pot`;
        writtenHashes[potFilename] = hashFileContent(
          serializePoFile(currentWorkspace.potFile.header, currentWorkspace.potFile.entries, true)
        );
        for (const po of currentWorkspace.poFiles) {
          const poFilename = po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme);
          writtenHashes[poFilename] = hashFileContent(serializePoFile(po.header, po.entries, false));
        }

        if (settings.autoCompileJsonOnSave || settings.autoCompileCsvOnSave) {
          const writeDirectoryText = async (filename: string, content: string) => {
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
          };
          if (settings.autoCompileJsonOnSave) await writeDirectoryText(`${domain}.json`, serializeTranslationsJson(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
          if (settings.autoCompileCsvOnSave) await writeDirectoryText(`${domain}.csv`, serializeTranslationsCsv(currentWorkspace, settings.csvPluralSuffix || '_P%d'));
        }

        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === activeWorkspaceId
              ? {
                  ...w,
                  isModified: false,
                  potFile: { ...w.potFile, isModified: false },
                  poFiles: w.poFiles.map((p) => ({ ...p, isModified: false })),
                  diskFileHashes: writtenHashes,
                }
              : w
          )
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
        setWorkspaces((prev) => prev.map((workspace) => workspace.id === activeWorkspaceId ? { ...workspace, poFiles: [...workspace.poFiles, { ...po, entries: linkPoEntriesToPot(workspace.potFile.entries, po.entries) }], activeFileId: po.id, isModified: true } : workspace));
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
            prev.map((w) =>
              w.id === activeWorkspaceId
                ? {
                    ...w,
                    isModified: false,
                    diskFileHashes: {
                      ...(w.diskFileHashes || {}),
                      [poFilename]: hashFileContent(poContent),
                    },
                  }
                : w
            )
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
            false
          );
          if (settings.autoCompileJsonOnSave || settings.autoCompileCsvOnSave) {
            const writeDirectoryText = async (filename: string, content: string) => {
              const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(content);
              await writable.close();
            };
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
              ? { ...w, poFiles: [...w.poFiles, { ...newPo, entries: linkPoEntriesToPot(w.potFile.entries, newPo.entries) }], activeFileId: newPo.id, isModified: true }
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
    handleSyncFromFolder,
    triggerDiskSyncForPo,
    handleImportFile,
    handleExport,
    handleExportMo,
    handleImportCsvJson,
  };
}
