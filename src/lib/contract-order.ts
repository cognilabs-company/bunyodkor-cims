/**
 * Orders for contract lists.
 *
 * - `compareContractsNewestFirst` — the Contracts page: most recently added
 *   first.
 * - `compareContracts` — a group's contracts dialog: number order.
 *
 * Neither parses letters out of the contract number, which stops describing
 * the group after a transfer; both use the payload's own fields.
 */

interface OrderableContract {
  id: number;
  contract_number: string;
  birth_year?: number | null;
  sequence_number?: number | null;
  created_at?: string | null;
  start_date?: string | null;
}

const timeOf = (value: string | null | undefined) => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Newest first: the contract added most recently (today, then yesterday, …)
 * leads. Falls back to the start date, then the id — ids grow with creation —
 * when `created_at` is missing or equal.
 */
export function compareContractsNewestFirst<T extends OrderableContract>(
  a: T,
  b: T,
): number {
  return (
    timeOf(b.created_at) - timeOf(a.created_at) ||
    timeOf(b.start_date) - timeOf(a.start_date) ||
    b.id - a.id
  );
}

const LAST = Number.MAX_SAFE_INTEGER;

/**
 * Number order: oldest birth year first (2008, 2009, …), then the running
 * serial within the year, so 22-2008C1 is followed by 23-2008C1. The number
 * itself (compared numerically) and the id only break ties when
 * `birth_year` / `sequence_number` are missing.
 */
export function compareContracts<T extends OrderableContract>(
  a: T,
  b: T,
  /** Birth year to use when a contract carries none (e.g. its group's). */
  birthYearOf: (contract: T) => number | null | undefined = (contract) =>
    contract.birth_year,
): number {
  return (
    (birthYearOf(a) ?? LAST) - (birthYearOf(b) ?? LAST) ||
    (a.sequence_number ?? LAST) - (b.sequence_number ?? LAST) ||
    String(a.contract_number).localeCompare(String(b.contract_number), undefined, {
      numeric: true,
    }) ||
    a.id - b.id
  );
}
