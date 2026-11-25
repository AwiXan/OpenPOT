// Entry strings always hold real newline characters; the `\n` escape exists only in .po files.
// With markers shown, the editor displays each newline as a visible `\n` and turns it back on input.

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export function toDisplayText(value: string, showMarkers: boolean): string {
  const normalized = normalizeLineBreaks(value);
  return showMarkers ? normalized.replace(/\n/g, '\\n') : normalized;
}

export function toStoredText(value: string, showMarkers: boolean): string {
  const normalized = normalizeLineBreaks(value);
  return showMarkers ? normalized.replace(/\\n/g, '\n') : normalized;
}

export function countNewlines(value: string): number {
  return (value.match(/\n/g) || []).length;
}
