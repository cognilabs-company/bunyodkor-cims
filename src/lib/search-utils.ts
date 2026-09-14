/**
 * Forgiving text search for staff-typed queries.
 *
 * Names in this system are stored in both Cyrillic and Latin Uzbek, typed with
 * any of several apostrophes, and spelled with x/h interchangeably
 * ("Хаётов", "Xayotov", "Hayotov"). Everything is folded to one Latin
 * skeleton before comparing, so any of those spellings finds the others.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

// o' / oʻ / o‘ / o’ / g` … all mean the same letter.
const APOSTROPHES = /['`ʻʼ‘’´]/g;

/** Lower-case Latin skeleton of `value`, with words separated by one space. */
export function normalizeForSearch(value: unknown): string {
  if (value === null || value === undefined) return "";

  // Transliterate on composed letters first: decomposing would turn ў into
  // у + breve and й into и + breve, losing the distinction.
  const text = String(value).toLowerCase().normalize("NFC");

  let latin = "";
  for (const char of text) {
    latin += CYRILLIC_TO_LATIN[char] ?? char;
  }

  return latin
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents left on Latin letters
    .replace(APOSTROPHES, "")
    .replace(/x/g, "h") // Xayotov == Hayotov
    .replace(/\s+/g, " ")
    .trim();
}

/** Same skeleton with every non-alphanumeric removed: "20-2013 C6" → "202013c6". */
export function compactForSearch(value: unknown): string {
  return normalizeForSearch(value).replace(/[^a-z0-9]/g, "");
}

export interface SearchIndexEntry {
  text: string;
  compact: string;
}

/** Pre-computes the searchable form of the given fields, once per record. */
export function buildSearchEntry(fields: unknown[]): SearchIndexEntry {
  const text = fields.map(normalizeForSearch).filter(Boolean).join(" ");
  return { text, compact: text.replace(/[^a-z0-9]/g, "") };
}

/** Splits a raw query into normalized words. Empty query → no words. */
export function tokenizeQuery(query: string): string[] {
  return normalizeForSearch(query).split(" ").filter(Boolean);
}

/**
 * True when every query word occurs in the entry, in any order. A word also
 * matches with punctuation ignored, so "202013c6" finds "20-2013C6".
 */
export function matchesSearch(
  entry: SearchIndexEntry,
  tokens: string[],
): boolean {
  return tokens.every((token) => {
    if (entry.text.includes(token)) return true;
    const compactToken = token.replace(/[^a-z0-9]/g, "");
    return compactToken !== "" && entry.compact.includes(compactToken);
  });
}
