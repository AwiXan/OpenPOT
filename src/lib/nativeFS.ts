import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, readFile, writeTextFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';

export interface NativeScannedFile {
  name: string;
  path: string;
  content: string;
}

export async function pickNativeDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Localization Project Directory',
  });

  if (typeof selected === 'string') {
    return selected;
  }
  return null;
}

export async function scanNativeDirectoryFiles(
  dirPath: string,
  knownRelativePaths: string[] = []
): Promise<NativeScannedFile[]> {
  if (!(await exists(dirPath))) {
    return [];
  }

  const cleanDir = dirPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const entries = await readDir(cleanDir);
  const result: NativeScannedFile[] = [];
  const seenNames = new Set<string>();

  const readScannedEntry = async (relName: string, fullPath: string) => {
    if (seenNames.has(relName)) return;
    seenNames.add(relName);
    const content = await readNativeEncodedTextFile(fullPath);
    result.push({
      name: relName,
      path: fullPath,
      content,
    });
  };

  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (entry.isFile && (lower.endsWith('.po') || lower.endsWith('.pot'))) {
      await readScannedEntry(entry.name, `${cleanDir}/${entry.name}`);
    }
  }

  // Also check 1-level subdirectories for locale_path scheme (e.g. ru/messages.po)
  const expectedSubdirFiles = new Set(
    knownRelativePaths
      .map((p) => p.replace(/\\/g, '/'))
      .filter((p) => p.includes('/'))
  );

  const hasRootPoFiles = result.some((f) => f.name.toLowerCase().endsWith('.po'));

  for (const entry of entries) {
    if (!entry.isDirectory || entry.name === '.git' || entry.name === 'node_modules') continue;
    const looksLikeLocaleDir = /^[a-zA-Z]{2,3}([_-][a-zA-Z]{2,4})?$/.test(entry.name);
    if (hasRootPoFiles && !looksLikeLocaleDir && expectedSubdirFiles.size === 0) continue;
    const subDir = `${cleanDir}/${entry.name}`;
    try {
      const subEntries = await readDir(subDir);
      for (const subEntry of subEntries) {
        if (!subEntry.isFile) continue;
        const lower = subEntry.name.toLowerCase();
        if (!lower.endsWith('.po') && !lower.endsWith('.pot')) continue;
        const relName = `${entry.name}/${subEntry.name}`;
        if (!hasRootPoFiles || looksLikeLocaleDir || expectedSubdirFiles.has(relName)) {
          await readScannedEntry(relName, `${subDir}/${subEntry.name}`);
        }
      }
    } catch {
      // Ignore unreadable subdirectories
    }
  }

  return result;
}

export async function writeNativeTextFile(filePath: string, content: string): Promise<void> {
  await writeTextFile(filePath, content);
}

export async function writeNativeBinaryFile(filePath: string, data: Uint8Array): Promise<void> {
  await writeFile(filePath, data);
}

export async function pickNativeFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: 'Select a translation file',
    filters: [{ name: 'Translations', extensions: ['po', 'pot', 'csv', 'json'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function readNativeTextFile(filePath: string): Promise<string> {
  return readTextFile(filePath);
}

export async function readNativeEncodedTextFile(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.slice(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.slice(2));
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.slice(3));
  return new TextDecoder('utf-8').decode(bytes);
}