/**
 * Who asked for a contract to be terminated — the parent (the customer who
 * signed it) or the coach.
 *
 * The backend still stores one free-text `termination_reason`, so the choice
 * is written there as a token and read back with `parseTerminationInitiator`.
 * Contracts terminated before this change carry real free text and are shown
 * exactly as typed. `BACKEND_TERMINATION_INITIATOR.md` describes the column
 * that is meant to replace the token.
 */

export type TerminationInitiator = "parent" | "coach";

export const TERMINATION_INITIATORS: TerminationInitiator[] = [
  "parent",
  "coach",
];

/** The stored initiator, or null when the reason is older free text. */
export function parseTerminationInitiator(
  reason: string | null | undefined,
): TerminationInitiator | null {
  const value = reason?.trim().toLowerCase();
  return value === "parent" || value === "coach" ? value : null;
}

/** Translation key naming an initiator: parent → `terminatedByParent`. */
export function terminationInitiatorKey(initiator: TerminationInitiator) {
  return initiator === "parent" ? "terminatedByParent" : "terminatedByCoach";
}

/**
 * How a stored reason reads in the current language: a token becomes its
 * label, older free text is returned as it was typed.
 */
export function formatTerminationReason(
  reason: string | null | undefined,
  t: (key: string) => string,
): string {
  const initiator = parseTerminationInitiator(reason);
  return initiator ? t(terminationInitiatorKey(initiator)) : reason?.trim() || "";
}
