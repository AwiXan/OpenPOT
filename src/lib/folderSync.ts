import { PoEntry, PoFileRecord, PotFileRecord, Workspace } from '../types/gettext';
import { parseFilenameParts } from './localDirectoryManager';
import { parsePoContent } from './poParser';
import { getPluralRuleForLanguage } from './pluralEngine';

export interface ScannedFolderFile {
  name: string;
  content: string;
  handle?: any;
}

export interface MergeFolderResult {
  workspace: Workspace;
  changedFilesCount: number;
  hasContentChanges: boolean;
}

function entryKey(entry: Pick<PoEntry, 'msgid' | 'msgctxt'>): string {
  return `${entry.msgctxt || ''}\x04${entry.msgid}`;
}

/**
 * Deterministic fast hash for comparing disk file contents across reloads/syncs.
 * Normalizes UTF-8 BOM and CRLF/LF so Windows line-ending differences don't trigger false conflicts.
 */
export function hashFileContent(content: string): string {
  const norm = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 = ((h2 << 5) + h2 + c) | 0;
  }
  return `${(h1 >>> 0).toString(16)}_${(h2 >>> 0).toString(16)}_${norm.length}`;
}

function parseScannedFileInfo(filename: string): { domain: string; lang?: string; ext: string } {
  const clean = filename.replace(/\\/g, '/').trim();
  const slashIdx = clean.lastIndexOf('/');
  if (slashIdx >= 0) {
    const dirPart = clean.slice(0, slashIdx);
    const filePart = clean.slice(slashIdx + 1);
    const lastDot = filePart.lastIndexOf('.');
    const ext = lastDot >= 0 ? filePart.slice(lastDot + 1).toLowerCase() : '';
    const baseName = lastDot >= 0 ? filePart.slice(0, lastDot) : filePart;
    if (ext === 'pot') {
      return { domain: baseName || 'messages', ext: 'pot' };
    }
    return { domain: baseName || 'messages', lang: dirPart, ext };
  }
  return parseFilenameParts(clean);
}

export function selectWorkspaceFolderFiles(
  workspace: Workspace,
  scannedFiles: ScannedFolderFile[]
): { potFile?: ScannedFolderFile; poFiles: ScannedFolderFile[] } {
  const potCandidates = scannedFiles.filter((f) => f.name.toLowerCase().endsWith('.pot'));
  const poCandidates = scannedFiles.filter((f) => f.name.toLowerCase().endsWith('.po'));

  const targetDomain = workspace.domainName || workspace.potFile.domainName || 'messages';
  const targetPotName = workspace.potFile.filename;

  const potFile =
    potCandidates.find((f) => f.name === targetPotName) ||
    potCandidates.find((f) => parseScannedFileInfo(f.name).domain === targetDomain) ||
    (potCandidates.length === 1 ? potCandidates[0] : undefined);

  const existingPoFilenames = new Set(workspace.poFiles.map((p) => p.filename));
  const singleDomainFolder = potCandidates.length <= 1;

  const poFiles = poCandidates.filter((f) => {
    if (existingPoFilenames.has(f.name)) return true;
    const info = parseScannedFileInfo(f.name);
    if (info.domain === targetDomain) return true;
    if (singleDomainFolder && info.domain === 'messages') return true;
    return false;
  });

  return { potFile, poFiles };
}

export function computeDiskFileHashes(files: ScannedFolderFile[]): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const f of files) {
    hashes[f.name] = hashFileContent(f.content);
  }
  return hashes;
}

export function detectExternalFolderChanges(
  workspace: Workspace,
  scannedFiles: ScannedFolderFile[]
): {
  changedFiles: string[];
  currentHashes: Record<string, string>;
  selected: { potFile?: ScannedFolderFile; poFiles: ScannedFolderFile[] };
} {
  const selected = selectWorkspaceFolderFiles(workspace, scannedFiles);
  const selectedList = [...(selected.potFile ? [selected.potFile] : []), ...selected.poFiles];
  const currentHashes = computeDiskFileHashes(selectedList);

  const prevHashes = workspace.diskFileHashes;
  if (!prevHashes) {
    return { changedFiles: [], currentHashes, selected };
  }

  const changedFiles: string[] = [];
  for (const [name, hash] of Object.entries(currentHashes)) {
    if (prevHashes[name] !== hash) {
      changedFiles.push(name);
    }
  }
  for (const prevName of Object.keys(prevHashes)) {
    if (!(prevName in currentHashes)) {
      changedFiles.push(prevName);
    }
  }

  return { changedFiles, currentHashes, selected };
}

function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function entriesContentEqual(a: PoEntry[], b: PoEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ea = a[i];
    const eb = b[i];
    if (
      ea.msgid !== eb.msgid ||
      (ea.msgidPlural || '') !== (eb.msgidPlural || '') ||
      (ea.msgctxt || '') !== (eb.msgctxt || '') ||
      (ea.previousMsgid || '') !== (eb.previousMsgid || '') ||
      (ea.category || '') !== (eb.category || '') ||
      !stringArraysEqual(ea.msgstr, eb.msgstr) ||
      !stringArraysEqual(ea.flags, eb.flags) ||
      !stringArraysEqual(ea.comments, eb.comments) ||
      !stringArraysEqual(ea.extractedComments, eb.extractedComments) ||
      !stringArraysEqual(ea.references, eb.references)
    ) {
      return false;
    }
  }
  return true;
}

function headersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Merges scanned .pot and .po files from the connected folder into an existing workspace
 * while preserving entry IDs, explicit category assignments, customCategories, and active selection.
 */
export function mergeFolderFilesIntoWorkspace(
  workspace: Workspace,
  scannedFiles: ScannedFolderFile[],
  options: { preserveInAppCategoriesWhenModified?: boolean } = {}
): MergeFolderResult {
  const { potFile: diskPot, poFiles: diskPos } = selectWorkspaceFolderFiles(workspace, scannedFiles);

  if (!diskPot && diskPos.length === 0) {
    return { workspace, changedFilesCount: 0, hasContentChanges: false };
  }

  const preserveInAppCats = Boolean(options.preserveInAppCategoriesWhenModified && workspace.isModified);
  let changedFilesCount = 0;

  // 1. Merge POT template
  const existingPotByKey = new Map<string, PoEntry>();
  for (const entry of workspace.potFile.entries) {
    const key = entryKey(entry);
    if (!existingPotByKey.has(key)) existingPotByKey.set(key, entry);
  }

  let mergedPot: PotFileRecord = {
    ...workspace.potFile,
    isModified: false,
  };

  if (diskPot) {
    const parsedPot = parsePoContent(diskPot.content);
    const mergedPotEntries: PoEntry[] = parsedPot.entries.map((parsedEntry) => {
      const existing = existingPotByKey.get(entryKey(parsedEntry));
      const category = preserveInAppCats
        ? existing?.category || parsedEntry.category
        : parsedEntry.category || existing?.category;
      return {
        ...parsedEntry,
        id: existing?.id || parsedEntry.id,
        category,
      };
    });

    const potChanged =
      workspace.potFile.filename !== diskPot.name ||
      !headersEqual(workspace.potFile.header.rawHeaders || {}, parsedPot.header.rawHeaders || {}) ||
      !entriesContentEqual(workspace.potFile.entries, mergedPotEntries);

    if (potChanged) changedFilesCount++;

    mergedPot = {
      ...workspace.potFile,
      filename: diskPot.name,
      header: parsedPot.header,
      entries: mergedPotEntries,
      localFileHandle: diskPot.handle ?? workspace.potFile.localFileHandle,
      isModified: false,
    };
  }

  const mergedPotByKey = new Map<string, PoEntry>();
  for (const potEntry of mergedPot.entries) {
    const key = entryKey(potEntry);
    if (!mergedPotByKey.has(key)) mergedPotByKey.set(key, potEntry);
  }

  // 2. Merge PO files
  const matchedExistingPoIds = new Set<string>();
  const mergedPoFiles: PoFileRecord[] = [];

  for (let i = 0; i < diskPos.length; i++) {
    const diskPo = diskPos[i];
    const parsed = parsePoContent(diskPo.content);
    const info = parseScannedFileInfo(diskPo.name);

    let existingPo = workspace.poFiles.find(
      (p) => p.filename === diskPo.name && !matchedExistingPoIds.has(p.id)
    );
    const candidateLang = parsed.header.language || info.lang;
    if (!existingPo && candidateLang) {
      existingPo = workspace.poFiles.find(
        (p) => p.language === candidateLang && !matchedExistingPoIds.has(p.id)
      );
    }
    if (existingPo) {
      matchedExistingPoIds.add(existingPo.id);
    }

    const langCode = parsed.header.language || existingPo?.language || info.lang || diskPo.name.replace(/\.po$/i, '');
    parsed.header.language = langCode;
    if (!parsed.header.pluralForms) {
      parsed.header.pluralForms = existingPo?.header.pluralForms || getPluralRuleForLanguage(langCode).formula;
    }

    const existingPoByKey = new Map<string, PoEntry>();
    if (existingPo) {
      for (const entry of existingPo.entries) {
        const key = entryKey(entry);
        if (!existingPoByKey.has(key)) existingPoByKey.set(key, entry);
      }
    }

    const mergedEntries: PoEntry[] = parsed.entries.map((parsedEntry) => {
      const key = entryKey(parsedEntry);
      const potMatch = mergedPotByKey.get(key);
      const existingMatch = existingPoByKey.get(key);
      const id = potMatch?.id || existingMatch?.id || parsedEntry.id;

      // Preserve categories: never lose category metadata if the external PO lacked #. Category:
      const category = preserveInAppCats
        ? existingMatch?.category || potMatch?.category || parsedEntry.category
        : parsedEntry.category || existingMatch?.category || potMatch?.category;

      return {
        ...parsedEntry,
        id,
        category,
      };
    });

    const poChanged =
      !existingPo ||
      existingPo.filename !== diskPo.name ||
      !headersEqual(existingPo.header.rawHeaders || {}, parsed.header.rawHeaders || {}) ||
      !entriesContentEqual(existingPo.entries, mergedEntries);

    if (poChanged) changedFilesCount++;

    mergedPoFiles.push({
      id: existingPo?.id || `po_${langCode}_${Date.now()}_${i}`,
      filename: diskPo.name,
      language: langCode,
      languageName: existingPo?.languageName || langCode.toUpperCase(),
      header: parsed.header,
      entries: mergedEntries,
      localFileHandle: diskPo.handle ?? existingPo?.localFileHandle,
      isModified: false,
    });
  }

  // Keep newly added in-app languages that have never been written to disk yet
  for (const existingPo of workspace.poFiles) {
    if (matchedExistingPoIds.has(existingPo.id)) continue;
    const existedOnDisk = Boolean(workspace.diskFileHashes && existingPo.filename in workspace.diskFileHashes);
    if (!existedOnDisk && existingPo.isModified) {
      mergedPoFiles.push(existingPo);
    } else {
      changedFilesCount++;
    }
  }

  // If no .pot existed on disk and our POT was empty, synthesize entries from the first PO
  if (!diskPot && mergedPot.entries.length === 0 && mergedPoFiles.length > 0) {
    mergedPot = {
      ...mergedPot,
      entries: mergedPoFiles[0].entries.map((e) => ({
        ...e,
        msgstr: e.msgidPlural ? ['', ''] : [''],
      })),
    };
  }

  // 3. Preserve active file & entry selection
  const activeFileStillExists =
    workspace.activeFileId === 'pot' || mergedPoFiles.some((p) => p.id === workspace.activeFileId);
  const nextActiveFileId = activeFileStillExists
    ? workspace.activeFileId
    : mergedPoFiles[0]?.id || 'pot';

  const oldActiveEntries =
    workspace.activeFileId === 'pot'
      ? workspace.potFile.entries
      : workspace.poFiles.find((p) => p.id === workspace.activeFileId)?.entries || [];
  const oldActiveEntry = oldActiveEntries.find((e) => e.id === workspace.activeEntryId);

  const nextActiveEntries =
    nextActiveFileId === 'pot'
      ? mergedPot.entries
      : mergedPoFiles.find((p) => p.id === nextActiveFileId)?.entries || [];

  let nextActiveEntryId = workspace.activeEntryId;
  if (!nextActiveEntries.some((e) => e.id === nextActiveEntryId)) {
    const byKey = oldActiveEntry
      ? nextActiveEntries.find((e) => entryKey(e) === entryKey(oldActiveEntry))
      : undefined;
    nextActiveEntryId = byKey?.id || nextActiveEntries[0]?.id || null;
  }

  const nextHashes = computeDiskFileHashes([...(diskPot ? [diskPot] : []), ...diskPos]);
  const hasUnsavedInAppPo = mergedPoFiles.some((p) => p.isModified);

  const mergedWorkspace: Workspace = {
    ...workspace,
    potFile: mergedPot,
    poFiles: mergedPoFiles,
    activeFileId: nextActiveFileId,
    activeEntryId: nextActiveEntryId,
    customCategories: workspace.customCategories ? [...workspace.customCategories] : undefined,
    isModified: hasUnsavedInAppPo,
    diskFileHashes: nextHashes,
  };

  return {
    workspace: mergedWorkspace,
    changedFilesCount,
    hasContentChanges: changedFilesCount > 0,
  };
}
