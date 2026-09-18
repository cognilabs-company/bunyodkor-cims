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
  /** Every field, normalized and joined by one space. */
  text: string;
  /** Punctuation-free form of each field, one per field: "20-2013 C6" → "202013c6". */
  compacts: string[];
  /** Punctuation-free primary key (e.g. the contract number), when given. */
  key: string;
}

/**
 * Pre-computes the searchable form of the given fields, once per record.
 * `key` is the record's identifier (a contract number): queries that look
 * like one are matched against it first, ahead of every other field.
 */
export function buildSearchEntry(
  fields: unknown[],
  key?: unknown,
): SearchIndexEntry {
  const normalized = fields.map(normalizeForSearch).filter(Boolean);
  return {
    text: normalized.join(" "),
    compacts: normalized.map((field) => field.replace(/[^a-z0-9]/g, "")),
    key: compactForSearch(key),
  };
}

/** Splits a raw query into normalized words. Empty query → no words. */
export function tokenizeQuery(query: string): string[] {
  return normalizeForSearch(query).split(" ").filter(Boolean);
}

/**
 * True when every query word occurs in the entry, in any order. A word also
 * matches with punctuation ignored, so "202013c6" finds "20-2013C6" — but
 * only inside one field, never across the boundary of two.
 */
export function matchesSearch(
  entry: SearchIndexEntry,
  tokens: string[],
): boolean {
  return tokens.every((token) => tokenMatches(entry, token) > 0);
}

// Score of one word against one entry; 0 when it does not occur.
function tokenMatches(entry: SearchIndexEntry, token: string): number {
  if (entry.text.startsWith(token) || entry.text.includes(" " + token)) {
    return 3; // starts a word: "hay" → "Hayotov"
  }
  if (entry.text.includes(token)) return 2;
  const compact = token.replace(/[^a-z0-9]/g, "");
  if (compact === "") return 0;
  if (entry.compacts.some((field) => field.startsWith(compact))) return 2;
  return entry.compacts.some((field) => field.includes(compact)) ? 1 : 0;
}

const KEY_EXACT = 1_000_000;
const KEY_PREFIX = 100_000;
const KEY_CONTAINS = 10_000;

/** A query with a digit in it is taken for a contract number. */
export function looksLikeKey(query: string): boolean {
  return /\d/.test(query);
}

/**
 * Relevance of `entry` for `query`; 0 means no match.
 *
 * A query with digits is matched against the key first: the exact number
 * outranks numbers that start with the query, which outrank numbers merely
 * containing it ("22-2008" → 22-2008C1 before 122-2008C1). Shorter keys
 * rank ahead of longer ones within a tier, so the closest number leads.
 * Queries without a key match fall back to word search over every field,
 * where matches at the start of a word rank higher.
 */
export function scoreSearch(entry: SearchIndexEntry, query: string): number {
  const compactQuery = compactForSearch(query);
  if (compactQuery === "") return 1;

  if (entry.key && looksLikeKey(query)) {
    const closeness = Math.max(0, 999 - (entry.key.length - compactQuery.length));
    if (entry.key === compactQuery) return KEY_EXACT;
    if (entry.key.startsWith(compactQuery)) return KEY_PREFIX + closeness;
    if (entry.key.includes(compactQuery)) return KEY_CONTAINS + closeness;
  }

  let score = 0;
  for (const token of tokenizeQuery(query)) {
    const tokenScore = tokenMatches(entry, token);
    if (tokenScore === 0) return 0;
    score += tokenScore;
  }
  return score;
}

/**
 * Filters and orders `items` by relevance to `query`, keeping the incoming
 * order among equally relevant items. When the query looks like a contract
 * number, only the best-matching tier of numbers is returned: the exact
 * number if one exists, else numbers starting with the query, else numbers
 * containing it. "22-2008" therefore lists 22-2008C1 and not 122-2008C1, and
 * a number never surfaces unrelated rows whose name or group happens to
 * contain the same digits.
 */
export function rankSearch<T>(
  items: T[],
  entryOf: (item: T) => SearchIndexEntry,
  query: string,
): T[] {
  if (compactForSearch(query) === "") return items;

  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const score = scoreSearch(entryOf(item), query);
    if (score > 0) scored.push({ item, score, index });
  });

  const best = Math.max(0, ...scored.map(({ score }) => score));
  const tierOf = (score: number) =>
    score >= KEY_EXACT ? 3 : score >= KEY_PREFIX ? 2 : score >= KEY_CONTAINS ? 1 : 0;
  const bestTier = tierOf(best);

  return scored
    .filter(({ score }) => tierOf(score) === bestTier)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
