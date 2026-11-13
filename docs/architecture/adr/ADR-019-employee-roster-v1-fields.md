# ADR-019: Employee roster grows v1's HR fields, kept on the existing Person/Employment split

## Status

Accepted

## Context

The product owner asked that the People page ("Employees Roster" in the legacy v1 app) gain the fields
and behavior v1's real Employee record has: gender, birth date, address, contact number, and four
statutory ID numbers (SSS/PhilHealth/Pag-IBIG/TIN), each with the exact zod format v1 validates
(`src/schemas/employee.ts`/`src/schemas/shared.ts`); a conditionally-required "end of contract"
date; Age and Length of Service roster columns; and CSV export + a print report.

v1 stores all of this as one flat `Employee` document. This codebase already splits that same
information across `Person` (identity/contact), `Employee` (employeeNumber), `Employment`
(status/type/dates), and `EmployeeAssignment` (position/project/manager) — a deliberate design
from Phase 2/3, not something this task should undo. The fields were added to whichever of those
models already owns that kind of fact, not flattened back into one document.

## Decision

- **`Person`** gains `gender` (`"Male" | "Female"`, a fixed two-value enum — unlike employment
  status/type this isn't an org-configurable business category, so a plain Mongoose enum matches
  v1 exactly rather than becoming a ninth catalog), `birthDate`, `address`, and `sssNumber`/
  `philHealthNumber`/`pagIbigNumber`/`tinNumber`. The four statutory numbers are plain text
  inputs (per explicit instruction — v1's masked auto-formatting inputs were not ported), but
  validated with v1's exact regex (`src/shared/validation/shared.ts`:
  `sssNumberSchema`/`philHealthNumberSchema`/`pagIbigNumberSchema`/`tinNumberSchema`).
- **`Employment`** gains `endOfContract` (optional Date). Whether it's required depends on the
  selected `EmploymentType`'s `metadata.requiresEndOfContract` flag — the catalog-driven
  equivalent of v1's hardcoded `END_OF_CONTRACT_STATUSES = ["Contractual", "Probationary"]` name
  list (`src/lib/employment-status.ts`). `scripts/seed.ts` sets this flag on the seeded
  Contractual/Probationary `EmploymentType` items, and backfills it onto rows that already
  existed before this flag was introduced (see `seedCatalogDefaults`'s per-key `$exists: false`
  guard) — without it, real clusters seeded before this ADR would never get the new behavior.
  v1's `lastDay` concept is not a new field: `Employment.effectiveTo` (already existed, set by
  `terminate()`) already means the same thing.
- **Age / Length of service** are computed, not stored — `src/lib/employee-dates.ts`
  (`calculateAge`/`formatLengthOfService`, ported from v1's `src/lib/employee-dates.ts` and
  adapted to take `Date` objects instead of ISO strings) derives them from `Person.birthDate` and
  `Employment.effectiveFrom` at render time, the same "derive at read time, never store a value
  that can drift" precedent this codebase already uses for `LeaveBalance.getAvailable()`.
- **CSV export and print report**, matching v1's roster feature (leave-balance columns from v1's
  version were left out — this app already has a separate `/leave/balances` page, so embedding
  them in the roster export would duplicate that view rather than mirror a gap). Both reuse
  `src/lib/csv.ts` and the `hidden print:block` Tailwind print-report convention established in
  ADR-018.

## Consequences

- The Hire form (`/people/new`) is the only place these new fields are collected today; there is
  no general "edit an existing employee's profile" dialog yet — out of scope for this task, and a
  natural next addition if requested.
- A person hired before this ADR simply has these fields `undefined` — Age/Length of Service
  render as "—" for them, not an error, since every new field is optional at the schema level.

## Addendum (November 2026): optional employee remarks

`Person` gains `remarks`, an optional free-text HR note of at most 200 characters (for example
"Senior, PWD"). It sits next to `address` for the same reason the fields above do: it is a fact
about the person, not about one employment or assignment. There is no new collection and no
migration; people without a note simply have no `remarks` field.

- **One rule, three layers.** `remarksSchema` and `REMARKS_MAX_LENGTH` in
  `src/shared/validation/shared.ts` are used by the Hire form and the Edit employee dialog
  (checked before submit, with a live `n/200` counter), by the request schemas in
  `src/shared/validation/workforce.ts` (a longer note is a 400 on the `remarks` field), and by the
  model's `maxlength`, which is the last line of defence if a write bypasses the route.
- **Blank means different things on hire and edit.** On hire, a whitespace-only note is dropped,
  so `""` is never stored. On edit, the form always sends every field, so `""` reaches
  `PersonService.update` and becomes an `$unset`, like the other clearable fields.
- **Where it shows.** A Remarks column on the roster (after Length of service), the CSV/Excel
  export (after Address), the print report, and the profile header.
- **Not searchable.** The roster search still covers name, employee number and position only.
- **No new permission.** Remarks can hold sensitive facts and travel with the export, which stays
  behind `employees.read`, rate limited and audited (`employees.exported`). The export note already
  asks people to share the file only with those who need it.
