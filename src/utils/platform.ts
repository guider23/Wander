// Cross-platform key modifier & OS detection utility

export const isMac =
  typeof navigator !== 'undefined' &&
  Boolean(
    (navigator as any).userAgentData?.platform === 'macOS' ||
      /Mac|iPhone|iPod|iPad/i.test(navigator.platform || '') ||
      /Macintosh/i.test(navigator.userAgent || '')
  );

export const modKey = isMac ? '⌘' : 'Ctrl';
export const altKey = isMac ? '⌥' : 'Alt';
export const shiftKey = isMac ? '⇧' : 'Shift';

/**
 * Automatically transforms standard shortcut strings to native platform glyphs.
 * E.g., "Ctrl + N" -> "⌘N" on Mac, or "Ctrl+N" on Windows.
 */
export function formatShortcut(shortcut: string): string {
  if (!isMac) return shortcut;

  return shortcut
    .replace(/Ctrl\s*\+\s*/gi, '⌘')
    .replace(/Cmd\s*\+\s*/gi, '⌘')
    .replace(/Alt\s*\+\s*/gi, '⌥')
    .replace(/Shift\s*\+\s*/gi, '⇧')
    .replace(/\s*\+\s*/g, '+');
}
