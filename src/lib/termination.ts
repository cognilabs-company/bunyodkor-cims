export type TerminationInitiator = "parent" | "coach" | "other";

export const TERMINATION_INITIATORS: TerminationInitiator[] = [
  "parent",
  "coach",
  "other",
];

export function isTerminationInitiator(
  value: string | null | undefined,
): value is TerminationInitiator {
  return value === "parent" || value === "coach" || value === "other";
}

export function parseTerminationInitiator(
  reason: string | null | undefined,
): TerminationInitiator | null {
  const value = reason?.trim().toLowerCase();
  return isTerminationInitiator(value) ? value : null;
}

export function resolveTerminationInitiator(contract: {
  terminated_by_type?: string | null;
  termination_reason?: string | null;
} | null | undefined): TerminationInitiator | null {
  if (!contract) return null;
  if (isTerminationInitiator(contract.terminated_by_type)) {
    return contract.terminated_by_type;
  }
  return parseTerminationInitiator(contract.termination_reason);
}

export function terminationInitiatorKey(initiator: TerminationInitiator) {
  if (initiator === "parent") return "terminatedByParent";
  if (initiator === "coach") return "terminatedByCoach";
  return "terminatedByOther";
}

export function terminationNoteOf(contract: {
  terminated_by_type?: string | null;
  termination_reason?: string | null;
} | null | undefined): string {
  const note = contract?.termination_reason?.trim() || "";
  return isTerminationInitiator(note) ? "" : note;
}

export function formatTerminationReason(
  contract:
    | string
    | { terminated_by_type?: string | null; termination_reason?: string | null }
    | null
    | undefined,
  t: (key: string) => string,
): string {
  const row =
    typeof contract === "string" || contract === null || contract === undefined
      ? { termination_reason: contract }
      : contract;

  const initiator = resolveTerminationInitiator(row);
  const note = terminationNoteOf(row);

  if (!initiator) return note;
  if (initiator === "other") return note || t("terminatedByOther");
  return t(terminationInitiatorKey(initiator));
}
