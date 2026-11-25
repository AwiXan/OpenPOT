import { LintIssue, PoEntry } from '../types/gettext';

/**
 * Extracts placeholders and format variables from text
 */
export function extractVariables(text: string): string[] {
  if (!text) return [];
  const vars = new Set<string>();

  // C-format specifiers: %s, %d, %f, %1$s, %02d, %ld, %u, etc.
  const cFormatRegex = /%(\d+\$)?[#0\- +']*\d*(?:\.\d+)?[hlLzjt]*[diuoxXfFeEgGaAcspn]/g;
  let match: RegExpExecArray | null;
  while ((match = cFormatRegex.exec(text)) !== null) {
    // Exclude escaped percent like '%%'
    if (match[0] !== '%%') {
      vars.add(match[0]);
    }
  }

  // Python named format specifiers: %(name)s, %(count)d
  const pyFormatRegex = /%\([a-zA-Z0-9_]+\)[a-zA-Z]/g;
  while ((match = pyFormatRegex.exec(text)) !== null) {
    vars.add(match[0]);
  }

  // Bracket variables: {name}, {0}, {{count}}, {{ user_name }}
  const bracketRegex = /\{{1,2}\s*[a-zA-Z0-9_.]+\s*\}{1,2}/g;
  while ((match = bracketRegex.exec(text)) !== null) {
    vars.add(match[0].replace(/\s+/g, ''));
  }

  // HTML / XML tag names: <tag>, </tag>, <tag ...>
  const htmlTagRegex = /<\/?([a-zA-Z0-9_-]+)(?:\s+[^>]*?)?\/?>/g;
  while ((match = htmlTagRegex.exec(text)) !== null) {
    vars.add(`<${match[1]}>`);
  }

  return Array.from(vars);
}

/**
 * Helper to determine if a msgid is a symbolic key identifier (e.g. AUTH_LOGIN_WELCOME_BACK, ui.nav.home)
 * rather than natural language text containing explicit interpolations.
 */
function isSymbolicKey(msgid: string): boolean {
  if (!msgid) return false;
  // If it has spaces and lowercase words, it's natural language prose
  if (msgid.includes(' ') && /[a-z]/.test(msgid)) {
    return false;
  }
  // All uppercase, underscores, dots, hyphens
  return /^[A-Z0-9_.:-]+$/.test(msgid) || !msgid.includes(' ');
}

/**
 * Validates a single PO entry against its source msgid and target msgstr
 */
export function lintEntry(entry: PoEntry, requiredPluralCount = 1): LintIssue[] {
  const issues: LintIssue[] = [];

  // Check 1: Untranslated or Empty
  const isPlural = Boolean(entry.msgidPlural);
  const isUntranslated = entry.msgstr.length === 0 || entry.msgstr.every(s => !s || s.trim() === '');

  if (isUntranslated) {
    issues.push({
      id: `${entry.id}_untranslated`,
      type: 'warning',
      message: 'String is missing translation',
      field: 'msgstr',
    });
    return issues;
  }

  // Check 2: Fuzzy
  if (entry.flags.includes('fuzzy')) {
    issues.push({
      id: `${entry.id}_fuzzy`,
      type: 'info',
      message: 'String is marked as fuzzy (needs review)',
      field: 'msgstr',
    });
  }

  // Check 3: Plural count mismatch
  if (isPlural && entry.msgstr.length < requiredPluralCount) {
    issues.push({
      id: `${entry.id}_plural_count`,
      type: 'warning',
      message: `Incomplete plural forms (has ${entry.msgstr.length} of ${requiredPluralCount} expected forms)`,
      field: 'plural',
    });
  }

  // Source variables
  const sourceVars = extractVariables(entry.msgid);
  const pluralSourceVars = entry.msgidPlural ? extractVariables(entry.msgidPlural) : [];
  const allSourceVars = Array.from(new Set([...sourceVars, ...pluralSourceVars]));

  const isSymbolic = isSymbolicKey(entry.msgid);
  const isFormatFlagged = entry.flags.some(f => f === 'c-format' || f === 'python-format');
  const commentsMentionVars = entry.comments.some(c => /interpolat|parameter|variable|placeholder|format|%s|%d/i.test(c)) ||
                             entry.extractedComments.some(c => /interpolat|parameter|variable|placeholder|format|%s|%d/i.test(c));

  // Check each translation string
  entry.msgstr.forEach((str, idx) => {
    if (!str && isPlural) {
      issues.push({
        id: `${entry.id}_plural_empty_${idx}`,
        type: 'warning',
        message: `Plural form [${idx}] is empty`,
        field: 'plural',
        pluralIndex: idx,
      });
      return;
    }

    if (!str) return;

    // Check variable parity
    const targetVars = extractVariables(str);

    // If source key explicitly defined variables, verify all expected variables are present
    if (allSourceVars.length > 0) {
      for (const expectedVar of allSourceVars) {
        if (!targetVars.includes(expectedVar) && !str.includes(expectedVar)) {
          issues.push({
            id: `${entry.id}_var_missing_${expectedVar}_${idx}`,
            type: 'error',
            message: `Missing variable "${expectedVar}" in translation${isPlural ? ` [form ${idx}]` : ''}`,
            field: isPlural ? 'plural' : 'msgstr',
            pluralIndex: idx,
            expected: expectedVar,
          });
        }
      }

      // Check for extra unrecognized variables not in source
      for (const targetVar of targetVars) {
        if (
          !allSourceVars.includes(targetVar) &&
          !entry.msgid.includes(targetVar) &&
          !(entry.msgidPlural && entry.msgidPlural.includes(targetVar))
        ) {
          issues.push({
            id: `${entry.id}_var_extra_${targetVar}_${idx}`,
            type: 'warning',
            message: `Unexpected variable "${targetVar}" not found in original key`,
            field: isPlural ? 'plural' : 'msgstr',
            pluralIndex: idx,
            actual: targetVar,
          });
        }
      }
    } else {
      // If source had 0 variables, only flag target variables if msgid is natural prose and NOT flagged as format/symbolic
      if (!isSymbolic && !isFormatFlagged && !commentsMentionVars) {
        for (const targetVar of targetVars) {
          // If the target has format specifiers like %s or {var} in plain text with no format flags, give a light info notice
          if (!entry.msgid.includes(targetVar)) {
            issues.push({
              id: `${entry.id}_var_extra_${targetVar}_${idx}`,
              type: 'info',
              message: `Translation contains format variable "${targetVar}" not present in source text`,
              field: isPlural ? 'plural' : 'msgstr',
              pluralIndex: idx,
              actual: targetVar,
            });
          }
        }
      }
    }

    // Check leading/trailing newlines
    const sourceHasLeadingNewline = entry.msgid.startsWith('\n');
    const targetHasLeadingNewline = str.startsWith('\n');
    if (sourceHasLeadingNewline !== targetHasLeadingNewline && !isSymbolic) {
      issues.push({
        id: `${entry.id}_newline_start_${idx}`,
        type: 'info',
        message: sourceHasLeadingNewline
          ? 'Source begins with newline, but translation does not'
          : 'Translation has leading newline',
        field: isPlural ? 'plural' : 'msgstr',
        pluralIndex: idx,
      });
    }

    const sourceHasTrailingNewline = entry.msgid.endsWith('\n');
    const targetHasTrailingNewline = str.endsWith('\n');
    if (sourceHasTrailingNewline !== targetHasTrailingNewline && !isSymbolic) {
      issues.push({
        id: `${entry.id}_newline_end_${idx}`,
        type: 'info',
        message: sourceHasTrailingNewline
          ? 'Source ends with newline, but translation does not'
          : 'Translation has trailing newline',
        field: isPlural ? 'plural' : 'msgstr',
        pluralIndex: idx,
      });
    }

    // Check trailing punctuation for natural prose
    if (!isSymbolic) {
      const punctuationChars = ['.', ':', '?', '!'];
      for (const p of punctuationChars) {
        const srcEnds = entry.msgid.trimEnd().endsWith(p);
        const tgtEnds = str.trimEnd().endsWith(p);
        if (srcEnds && !tgtEnds) {
          issues.push({
            id: `${entry.id}_punct_missing_${p}_${idx}`,
            type: 'info',
            message: `Original ends with "${p}", translation should end with "${p}"`,
            field: isPlural ? 'plural' : 'msgstr',
            pluralIndex: idx,
          });
        }
      }
    }
  });

  return issues;
}
