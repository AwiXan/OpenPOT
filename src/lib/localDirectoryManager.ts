import { Workspace, PotFileRecord, PoFileRecord, PoNamingScheme } from '../types/gettext';
import { parsePoContent, serializePoFile, linkPoEntriesToPot } from './poParser';
import { compileMoBinary } from './moCompiler';
import { COMMON_PLURAL_RULES } from './pluralEngine';
import { initGitRepository } from './gitEngine';
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export interface LoadedDirectoryResult {
  dirHandle: any;
  dirName: string;
  workspaces: Workspace[];
  totalFilesFound: number;
}

/**
 * Derives language code and domain name from filename
 * Examples:
 *   "ecommerce_en.po" -> domain: "ecommerce", lang: "en"
 *   "gamemode_survival_es.po" -> domain: "gamemode_survival", lang: "es"
 *   "es.po" -> domain: "messages", lang: "es"
 *   "fr_FR.po" -> domain: "messages", lang: "fr_FR"
 */
export function parseFilenameParts(filename: string): { domain: string; lang?: string; ext: string } {
  const clean = filename.trim();
  const lastDot = clean.lastIndexOf('.');
  const ext = lastDot >= 0 ? clean.slice(lastDot + 1).toLowerCase() : '';
  const baseName = lastDot >= 0 ? clean.slice(0, lastDot) : clean;

  if (ext === 'pot') {
    return { domain: baseName || 'messages', ext: 'pot' };
  }

  // Check for domain_lang format (e.g. ecommerce_en, gamemode_survival_es, app_fr_FR)
  const underscoreIdx = baseName.lastIndexOf('_');
  if (underscoreIdx > 0) {
    const candidateLang = baseName.slice(underscoreIdx + 1);
    // If the part after underscore looks like a locale (2-5 chars like 'en', 'es', 'zh_CN', 'pt_BR')
    if (/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(candidateLang) || candidateLang.length <= 5) {
      const candidateDomain = baseName.slice(0, underscoreIdx);
      return { domain: candidateDomain, lang: candidateLang, ext };
    }
  }

  // Plain lang format (e.g. es.po, ru.po, en_US.po)
  return { domain: 'messages', lang: baseName, ext };
}

/**
 * Returns formatted PO filename based on naming scheme
 */
export function formatPoFilename(
  domain: string,
  langCode: string,
  scheme: PoNamingScheme = 'domain_lang'
): string {
  const safeDomain = (domain || 'messages').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeLang = langCode || 'en';

  if (scheme === 'domain_lang') {
    return `${safeDomain}_${safeLang}.po`;
  }
  if (scheme === 'lang') {
    return `${safeLang}.po`;
  }
  // 'locale_path'
  return `${safeLang}/${safeDomain}.po`;
}

/**
 * Returns formatted MO filename matching the PO filename
 */
export function formatMoFilename(
  domain: string,
  langCode: string,
  scheme: PoNamingScheme = 'domain_lang'
): string {
  const safeDomain = (domain || 'messages').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeLang = langCode || 'en';

  if (scheme === 'domain_lang') {
    return `${safeDomain}_${safeLang}.mo`;
  }
  if (scheme === 'lang') {
    return `${safeLang}.mo`;
  }
  return `${safeLang}/${safeDomain}.mo`;
}

/**
 * Builds workspaces from an array of parsed file objects (.pot and .po)
 */
export function buildWorkspacesFromFiles(
  fileEntries: { name: string; handle?: any; content: string }[],
  dirName: string,
  dirHandle: any = null
): LoadedDirectoryResult {
  if (fileEntries.length === 0) {
    throw new Error('No .pot or .po gettext files found in the selected folder.');
  }

  // Group files by domain
  const domainGroups = new Map<
    string,
    {
      pot?: { name: string; handle?: any; content: string };
      pos: { name: string; handle?: any; content: string; lang: string }[];
    }
  >();

  for (const f of fileEntries) {
    const { domain, lang, ext } = parseFilenameParts(f.name);
    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, { pos: [] });
    }
    const group = domainGroups.get(domain)!;

    if (ext === 'pot') {
      group.pot = f;
    } else if (ext === 'po') {
      group.pos.push({ ...f, lang: lang || 'en' });
    }
  }

  const workspaces: Workspace[] = [];

  for (const [domain, group] of domainGroups.entries()) {
    // If no POT was in the group, build one from the first PO or empty
    let potRecord: PotFileRecord;

    if (group.pot) {
      const parsedPot = parsePoContent(group.pot.content);
      potRecord = {
        id: `pot_${domain}_${Date.now()}`,
        filename: group.pot.name,
        domainName: domain,
        header: parsedPot.header,
        entries: parsedPot.entries,
        localFileHandle: group.pot.handle,
        isModified: false,
      };
    } else if (group.pos.length > 0) {
      // Synthesize POT from first PO
      const parsedFirst = parsePoContent(group.pos[0].content);
      const potEntries = parsedFirst.entries.map((e) => ({
        ...e,
        msgstr: e.msgidPlural ? ['', ''] : [''],
      }));
      potRecord = {
        id: `pot_${domain}_${Date.now()}`,
        filename: `${domain}.pot`,
        domainName: domain,
        header: parsedFirst.header,
        entries: potEntries,
        isModified: false,
      };
    } else {
      continue;
    }

    // Parse PO files
    const poRecords: PoFileRecord[] = group.pos.map((poFile, idx) => {
      const parsed = parsePoContent(poFile.content);
      const langCode = poFile.lang || parsed.header.language || 'en';
      const langName = langCode.toUpperCase();

      return {
        id: `po_${langCode}_${Date.now()}_${idx}`,
        filename: poFile.name,
        language: langCode,
        languageName: langName,
        header: parsed.header,
        entries: linkPoEntriesToPot(potRecord.entries, parsed.entries),
        localFileHandle: poFile.handle,
        isModified: false,
      };
    });

    const wsName = domain.charAt(0).toUpperCase() + domain.slice(1).replace(/_/g, ' ');
    const ws: Workspace = {
      id: `ws_local_${domain}_${Date.now()}`,
      name: `${wsName} (${dirName})`,
      description: `Local folder domain: ${domain} in ${dirName}`,
      domainName: domain,
      potFile: potRecord,
      poFiles: poRecords,
      activeFileId: poRecords[0]?.id || 'pot',
      activeEntryId: potRecord.entries[0]?.id || null,
      createdAt: new Date().toISOString(),
      isModified: false,
    };

    initGitRepository(ws);
    workspaces.push(ws);
  }

  return {
    dirHandle,
    dirName,
    workspaces,
    totalFilesFound: fileEntries.length,
  };
}

/**
 * Scans standard HTML5 FileList or File[] (e.g. from <input type="file" webkitdirectory />)
 * Works universally across desktop browsers and sandboxed iframes.
 */
export async function scanFileList(
  files: FileList | File[],
  fallbackDirName: string = 'Local Directory'
): Promise<LoadedDirectoryResult> {
  const fileEntries: { name: string; content: string }[] = [];
  let detectedDirName = fallbackDirName;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const lower = file.name.toLowerCase();

    // Extract directory name from relative path if available
    const relPath = (file as any).webkitRelativePath || '';
    if (relPath && detectedDirName === fallbackDirName) {
      const firstSegment = relPath.split('/')[0];
      if (firstSegment) {
        detectedDirName = firstSegment;
      }
    }

    if (lower.endsWith('.pot') || lower.endsWith('.po')) {
      try {
        const text = await file.text();
        fileEntries.push({ name: file.name, content: text });
      } catch (err) {
        console.warn('Failed to read file:', file.name, err);
      }
    }
  }

  return buildWorkspacesFromFiles(fileEntries, detectedDirName, null);
}

/**
 * Scans a local directory handle and constructs Workspace objects for all domains found
 */
export async function scanLocalDirectory(dirHandle: any): Promise<LoadedDirectoryResult> {
  const dirName = dirHandle.name || 'Local Folder';
  const fileEntries: { name: string; handle: any; content: string }[] = [];

  // Iterate over files in the directory
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.pot') || lower.endsWith('.po')) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          fileEntries.push({ name: entry.name, handle: entry, content: text });
        } catch (err) {
          console.warn('Failed to read file from directory:', entry.name, err);
        }
      }
    }
  }

  return buildWorkspacesFromFiles(fileEntries, dirName, dirHandle);
}

/**
 * Writes text content to a file in the directory
 */
export async function writeTextFileToDirectory(
  dirTarget: any, 
  filename: string, 
  content: string
) {
  if (typeof dirTarget === 'string') {
    const fullPath = `${dirTarget}/${filename}`;
    await writeTextFile(fullPath, content);
    return;
  }

  const fileHandle = await dirTarget.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function writeBinaryFileToDirectory(
  dirTarget: any, 
  filename: string, 
  data: Uint8Array
) {

  if (typeof dirTarget === 'string') {
    const fullPath = `${dirTarget}/${filename}`;
    await writeFile(fullPath, data);
    return;
  }


  const fileHandle = await dirTarget.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

/**
 * Writes a PO file and optionally its paired .MO file directly to disk in the local folder
 */
export async function savePoAndMoToDirectory(
  dirHandle: any,
  poFile: PoFileRecord,
  autoCompileMo: boolean = true,
  domainName: string = 'messages',
  namingScheme: PoNamingScheme = 'domain_lang',
  autoGenerateCategories = true
): Promise<{ poFilename: string; moFilename?: string; moBytesCount?: number }> {
  // 1. Serialize and save .po file
  const poContent = serializePoFile(poFile.header, poFile.entries, false, autoGenerateCategories);
  const poFilename = poFile.filename || formatPoFilename(domainName, poFile.language, namingScheme);

  await writeTextFileToDirectory(dirHandle, poFilename, poContent);

  let moFilename: string | undefined;
  let moBytesCount: number | undefined;

  // 2. Automatically compile and save .mo file if requested
  if (autoCompileMo) {
    // Derive .mo filename directly from .po filename (replace .po with .mo)
    if (poFilename.endsWith('.po')) {
      moFilename = poFilename.slice(0, -3) + '.mo';
    } else {
      moFilename = formatMoFilename(domainName, poFile.language, namingScheme);
    }

    const moBinary = compileMoBinary(poFile.header, poFile.entries);
    await writeBinaryFileToDirectory(dirHandle, moFilename, moBinary);
    moBytesCount = moBinary.byteLength;
  }

  return { poFilename, moFilename, moBytesCount };
}

/**
 * Saves entire workspace (POT + all PO files + compiled MO files) to directory
 */
export async function saveWorkspaceToDirectory(
  dirHandle: any,
  workspace: Workspace,
  autoCompileMo: boolean = true,
  namingScheme: PoNamingScheme = 'domain_lang',
  autoGenerateCategories = true
): Promise<{ savedPoCount: number; savedMoCount: number; timestamp: string }> {
  const domain = workspace.domainName || workspace.potFile.domainName || 'messages';

  // 1. Save POT template
  if (workspace.potFile) {
    const potContent = serializePoFile(workspace.potFile.header, workspace.potFile.entries, true, autoGenerateCategories);
    const potFilename = workspace.potFile.filename || `${domain}.pot`;
    await writeTextFileToDirectory(dirHandle, potFilename, potContent);
  }

  let savedPoCount = 0;
  let savedMoCount = 0;

  // 2. Save each PO and paired MO
  for (const po of workspace.poFiles) {
    const res = await savePoAndMoToDirectory(dirHandle, po, autoCompileMo, domain, namingScheme, autoGenerateCategories);
    savedPoCount++;
    if (res.moFilename) {
      savedMoCount++;
    }
  }

  return {
    savedPoCount,
    savedMoCount,
    timestamp: new Date().toLocaleTimeString(),
  };
}
