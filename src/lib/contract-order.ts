/**
 * The one order contracts are listed in: oldest birth year first
 * (2008, 2009, …), then by the contract's running serial within the year, so
 * 22-2008C1 is followed by 23-2008C1.
 *
 * Uses the payload's own `birth_year` and `sequence_number` — never letters
 * parsed out of the contract number, which stops describing the group after a
 * transfer. The number itself (compared numerically) and the id only break
 * ties when those fields are missing.
 */

interface OrderableContract {
  id: number;
  contract_number: string;
  birth_year?: number | null;
  sequence_number?: number | null;
}

const LAST = Number.MAX_SAFE_INTEGER;

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
