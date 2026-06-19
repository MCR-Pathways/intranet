/**
 * Pure client-side quiz scoring. The Safeguarding course is public with no
 * server-side grading, so answer keys ship in the content and scoring happens
 * in the browser. These functions are the single source of correctness logic.
 */

/** Exact option match. */
export function scoreSingle(chosen: string | null, correct: string): boolean {
  return chosen === correct;
}

/** All-or-nothing: the chosen set must equal the correct set (order-independent). */
export function scoreMulti(chosen: string[], correct: string[]): boolean {
  if (chosen.length !== correct.length) return false;
  const chosenSet = new Set(chosen);
  if (chosenSet.size !== chosen.length) return false; // no duplicates
  return correct.every((c) => chosenSet.has(c));
}

/** Exact sequence match. */
export function scoreOrdering(chosen: string[], correct: string[]): boolean {
  return chosen.length === correct.length && chosen.every((v, i) => v === correct[i]);
}
