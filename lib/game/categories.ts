import categoriesData from "@/data/categories.json";

export interface WordCategory {
  id: string;
  label: string;
  words: string[];
}

// Add a new category by appending an entry to data/categories.json —
// no other code changes are needed.
export const CATEGORIES: WordCategory[] = categoriesData;

export const DEFAULT_CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id);

// Must match BOARD_SIZE in server.js
export const MIN_BOARD_WORDS = 25;

export function getWordPool(categoryIds: string[]): string[] {
  const ids = new Set(categoryIds);
  return CATEGORIES.filter((c) => ids.has(c.id)).flatMap((c) => c.words);
}
