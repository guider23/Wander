import nspell from 'nspell';
import aff from './data/index.aff?raw';
import dic from './data/index.dic?raw';
import { TECH_KNOWLEDGE_MAP, COMMON_TYPOS_MAP } from './dictionary';

// Initialize open-source Hunspell spellchecker instance
let spellInstance: ReturnType<typeof nspell> | null = null;

function getSpellChecker() {
  if (!spellInstance) {
    try {
      spellInstance = nspell({ aff, dic });
    } catch (e) {
      console.error('Failed to initialize Hunspell nspell engine:', e);
      // Fallback empty instance
      spellInstance = {
        correct: () => true,
        suggest: () => []
      } as any;
    }
  }
  return spellInstance!;
}

/**
 * Autocorrect a single token (preserving surrounding punctuation).
 * Follows the core rule: If a word is already a valid English word (like "plan"),
 * NEVER corrupt it! Only correct actual typos or tech casing.
 */
export function autocorrectWord(
  rawWord: string,
  options?: { isFirstWord?: boolean }
): { corrected: string; changed: boolean } {
  if (!rawWord || rawWord.trim().length === 0) {
    return { corrected: rawWord, changed: false };
  }

  // Extract leading and trailing punctuation (e.g., "(chatgpt)..." => "(", "chatgpt", ")...")
  const match = rawWord.match(/^([^a-zA-Z0-9#+.]*)([a-zA-Z0-9#+.-]+)([^a-zA-Z0-9#+.]*)$/);
  if (!match) {
    return { corrected: rawWord, changed: false };
  }

  const [, prefix, coreWord, suffix] = match;
  const lower = coreWord.toLowerCase();
  const spell = getSpellChecker();

  // 1. High-Knowledge Tech & Brand Dictionary (exact canonical casing)
  // e.g. "chatgpt" -> "ChatGPT", "github" -> "GitHub", "vscode" -> "VS Code"
  if (TECH_KNOWLEDGE_MAP[lower]) {
    const canonical = TECH_KNOWLEDGE_MAP[lower];
    return {
      corrected: prefix + canonical + suffix,
      changed: canonical !== coreWord
    };
  }

  // 2. Authoritative Fast-Typing Swaps & Wikipedia Common Misspellings
  // e.g. "speeling" -> "spelling", "brnach" -> "branch", "dont" -> "don't"
  if (COMMON_TYPOS_MAP[lower]) {
    let result = COMMON_TYPOS_MAP[lower];
    if (options?.isFirstWord && result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return {
      corrected: prefix + result + suffix,
      changed: true
    };
  }

  // 3. Pronoun 'i' -> 'I'
  if (coreWord === 'i') {
    return {
      corrected: prefix + 'I' + suffix,
      changed: true
    };
  }

  // 4. Check if word is already a valid English word in Hunspell!
  // CRITICAL: Words like "plan", "plant", "work", "focus", "run", "chat"
  // are 100% VALID and must NEVER be autocorrected!
  if (spell.correct(coreWord) || spell.correct(lower)) {
    let result = coreWord;
    if (options?.isFirstWord && result.length > 0 && result.charAt(0) >= 'a' && result.charAt(0) <= 'z') {
      result = result.charAt(0).toUpperCase() + result.slice(1);
      return {
        corrected: prefix + result + suffix,
        changed: result !== coreWord
      };
    }
    return {
      corrected: rawWord,
      changed: false
    };
  }

  // 5. Word is NOT in dictionary and NOT a tech word -> Actual misspelling!
  // Query Hunspell for phonetic & edit-distance suggestions
  const suggestions = spell.suggest(lower);
  if (suggestions && suggestions.length > 0) {
    let best = suggestions[0];
    if (options?.isFirstWord && best.length > 0) {
      best = best.charAt(0).toUpperCase() + best.slice(1);
    }
    return {
      corrected: prefix + best + suffix,
      changed: true
    };
  }

  // Fallback: word is unknown (e.g. unique name, slug) -> keep original
  return { corrected: rawWord, changed: false };
}

/**
 * Autocorrect a complete sentence or phrase (applied on submit or full text review).
 */
export function autocorrectSentence(text: string): { text: string; hasChanges: boolean } {
  if (!text || !text.trim()) {
    return { text, hasChanges: false };
  }

  // Normalize duplicate spaces and whitespace around punctuation
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;?!])/g, '$1')
    .replace(/([,.:;?!])(?=[^\s\d,.:;?!])/g, '$1 ');

  // Split into tokens preserving delimiters
  const tokens = cleaned.split(/(\s+)/);
  let wordIndex = 0;
  let overallChanged = false;

  const correctedTokens = tokens.map((token) => {
    // If it's whitespace, preserve it
    if (/^\s+$/.test(token)) {
      return token;
    }

    const isFirstWord = wordIndex === 0;
    wordIndex++;

    const { corrected, changed } = autocorrectWord(token, { isFirstWord });
    if (changed) overallChanged = true;
    return corrected;
  });

  let result = correctedTokens.join('').trim();

  // Ensure first character of entire sentence is capitalized if it is a letter
  if (result.length > 0) {
    const firstAlphaMatch = result.match(/^([^a-zA-Z]*)([a-z])(.*)$/);
    if (firstAlphaMatch) {
      const [, pre, char, rest] = firstAlphaMatch;
      result = pre + char.toUpperCase() + rest;
      overallChanged = true;
    }
  }

  return {
    text: result,
    hasChanges: overallChanged || result !== text
  };
}

/**
 * Real-time word autocorrect when user types a delimiter (Space, Enter, punctuation).
 * Corrects the word preceding the cursor and updates cursor position seamlessly.
 */
export function autocorrectOnDelimiter(
  currentValue: string,
  cursorPosition: number,
  delimiter: string
): { newText: string; newCursor: number; corrected: boolean } {
  const beforeCursor = currentValue.slice(0, cursorPosition);
  const afterCursor = currentValue.slice(cursorPosition);

  // Match the word directly before the cursor
  const wordMatch = beforeCursor.match(/([a-zA-Z0-9#+.-]+)$/);
  if (!wordMatch) {
    // No word to correct, just insert delimiter
    return {
      newText: beforeCursor + delimiter + afterCursor,
      newCursor: cursorPosition + delimiter.length,
      corrected: false
    };
  }

  const rawWord = wordMatch[1];
  const wordStartIdx = beforeCursor.length - rawWord.length;
  const isFirstWord = wordStartIdx === 0 || !/[a-zA-Z0-9]/.test(beforeCursor.slice(0, wordStartIdx));

  const { corrected, changed } = autocorrectWord(rawWord, { isFirstWord });

  const newBefore = beforeCursor.slice(0, wordStartIdx) + corrected + delimiter;
  const newText = newBefore + afterCursor;
  const newCursor = newBefore.length;

  return {
    newText,
    newCursor,
    corrected: changed
  };
}
