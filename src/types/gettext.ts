export interface PoHeader {
  projectIdVersion?: string;
  reportMsgidBugsTo?: string;
  potCreationDate?: string;
  poRevisionDate?: string;
  lastTranslator?: string;
  languageTeam?: string;
  language?: string;
  mimeVersion?: string;
  contentType?: string;
  contentTransferEncoding?: string;
  pluralForms?: string;
  xGenerator?: string;
  rawHeaders: Record<string, string>;
}

export interface PoEntry {
  id: string; // Internal unique ID for React keys
  msgid: string;
  msgidPlural?: string;
  msgctxt?: string;
  msgstr: string[]; // [0] for single, [0..N] for plurals
  comments: string[]; // # Translator comments
  extractedComments: string[]; // #. Extracted comments
  references: string[]; // #: File references, e.g. src/auth/login.ts:42
  flags: string[]; // #, fuzzy, c-format, etc.
  previousMsgid?: string; // #| Previous msgid for fuzzy matches
  category?: string; // Derived category from key naming or context
}

export interface PoFileRecord {
  id: string;
  filename: string; // e.g., 'es.po', 'ecommerce_es.po'
  language: string; // e.g., 'es', 'fr_FR'
  languageName: string; // e.g., 'Spanish', 'French'
  header: PoHeader;
  entries: PoEntry[];
  isModified?: boolean;
  compiledMoSize?: number;
  lastCompiledAt?: string;
  localFileHandle?: any; // FileSystemFileHandle for live disk sync
}

export interface PotFileRecord {
  id: string;
  filename: string; // e.g., 'ecommerce.pot', 'messages.pot'
  domainName?: string; // e.g., 'ecommerce', 'gamemode_survival', 'base'
  header: PoHeader;
  entries: PoEntry[];
  isModified?: boolean;
  localFileHandle?: any; // FileSystemFileHandle for live disk sync
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  domainName?: string; // e.g., 'ecommerce', 'gamemode_survival'
  potFile: PotFileRecord;
  poFiles: PoFileRecord[];
  activeFileId: string; // 'pot' or poFile.id
  activeEntryId: string | null;
  createdAt: string;
  isModified?: boolean;
  git?: WorkspaceGitState;
  customCategories?: string[];
  localDirPath?: string;
  localDirHandle?: any;
}

export type FilterStatus = 'all' | 'untranslated' | 'fuzzy' | 'translated' | 'issues' | 'plurals';

export interface LintIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  field: 'msgstr' | 'plural' | 'header';
  pluralIndex?: number;
  expected?: string;
  actual?: string;
}

export interface TmSuggestion {
  id: string;
  sourceMsgid: string;
  suggestedMsgstr: string;
  similarity: number; // 0 to 100%
  sourceLanguage: string;
  targetLanguage: string;
  originWorkspace?: string;
}

export interface PluralRuleInfo {
  language: string;
  nplurals: number;
  formula: string;
  names: string[]; // e.g. ['One', 'Other'] or ['Zero', 'One', 'Few', 'Many', 'Other']
  examples: Record<number, string>; // e.g. { 1: '1 item', 2: '2 items' }
}

export interface GitCommitFileChange {
  filename: string;
  fileId: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

export interface GitCommit {
  id: string; // short hash, e.g. "8f3b21a"
  fullHash: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: string;
  filesChanged: GitCommitFileChange[];
  snapshot: {
    potFile: PotFileRecord;
    poFiles: PoFileRecord[];
  };
}

export interface GitFileStatus {
  filename: string;
  fileId: string;
  type: 'pot' | 'po';
  language?: string;
  languageName?: string;
  status: 'unmodified' | 'modified' | 'untracked' | 'deleted' | 'added';
  isStaged: boolean;
  entriesCount: number;
  diffSummary?: {
    additions: number;
    deletions: number;
    modifications: number;
    isDifferent: boolean;
  };
}

export interface WorkspaceGitState {
  isInitialized: boolean;
  branch: string;
  stagedFiles: string[]; // filenames of staged files
  commits: GitCommit[];
}

export type PoNamingScheme = 'domain_lang' | 'lang' | 'locale_path';

export type AppTheme = 'obsidian' | 'emerald' | 'violet' | 'orange';

export interface AppSettings {
  theme?: AppTheme;
  themeSaturation?: number; // 0 (gray) to 1 (fully tinted), default 0.5
  fuzzyMatchingThreshold: number; // 0 to 100, default 80
  autoMarkFuzzyUnder100: boolean;
  authorName: string;
  authorEmail: string;
  autoSaveInterval: number; // in seconds, 0 = disabled
  poNamingScheme: PoNamingScheme; // 'domain_lang' (e.g. ecommerce_en.po), 'lang' (en.po), 'locale_path'
  autoCompileMoOnSave: boolean; // Auto generate .mo file in folder upon save
  autoNewlineOnEnter: boolean; // Pressing Enter creates natural newline
  showNewlinesVisible: boolean; // Show visible \n markers badge
  autoCompileCsvOnSave?: boolean;
  autoCompileJsonOnSave?: boolean;
  csvPluralSuffix?: string;
  autoGenerateCategories?: boolean;
}

export interface WorkspaceSnapshot {
  timestamp: number;
  description: string;
  potFile: PotFileRecord;
  poFiles: PoFileRecord[];
  activeFileId: string;
  activeEntryId: string | null;
  customCategories?: string[];
}

export interface LocalDirectoryState {
  isConnected: boolean;
  dirName: string;
  dirHandle: any | null; // FileSystemDirectoryHandle
  lastSyncedAt?: string;
  savedFilesCount: number;
  autoCompileMo: boolean;
}
