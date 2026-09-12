// Lead-list COLUMNS and FILTERS — one registry, used by three places that used to
// drift apart: the data layer (which rows survive), the view (which header carries
// which control, and what the filter summary SAYS), and the guard.
//
// WHY a registry and not three hand-kept lists: the default filter used to be
// labelled "min. 1 kép" while the predicate actually ran on the MATERIAL column —
// so the operator read a promise about the FOTÓK column and saw 0 in it on 100 of
// the 260 listed rows (Elek FK-003, 2026-09-11). A label and a predicate that live
// in different files WILL drift. Here a filter cannot name a column it does not
// read: both its predicate and its summary are derived from the same `cell()`.

import { T } from "../i18n/mail.js";

import type { LeadListRow, LeadQuery } from "./data.js";

export type LeadColumnKey =
  | "name"
  | "region"
  | "country"
  | "city"
  | "qualification"
  | "photos"
  | "material"
  | "match"
  | "contact"
  | "mock";

export interface LeadColumnDef {
  readonly key: LeadColumnKey;
  /**
   * The value the COLUMN CELL stands for — the single comparable truth behind the
   * rendered cell. Filtering, sorting and the guard all read this, never the row
   * fields directly, so "what the column shows" and "what the filter tests" are the
   * same expression.
   */
  readonly cell: (r: LeadListRow) => string | number;
}

export const LEAD_COLUMNS: Record<LeadColumnKey, LeadColumnDef> = {
  name: { key: "name", cell: (r) => r.name },
  region: { key: "region", cell: (r) => r.region },
  country: { key: "country", cell: (r) => r.country ?? "" },
  city: { key: "city", cell: (r) => r.city ?? "" },
  qualification: { key: "qualification", cell: (r) => r.qualification ?? "unknown" },
  photos: { key: "photos", cell: (r) => r.photos },
  material: { key: "material", cell: (r) => r.material },
  match: { key: "match", cell: (r) => r.matchConfidence ?? -1 },
  contact: { key: "contact", cell: (r) => r.contact },
  mock: { key: "mock", cell: (r) => (r.latestArtifact ? r.latestArtifact.status : "none") },
};

/** Column header text (UI copy → a function of the language, ADR-0067 ③). */
export function columnLabel(key: LeadColumnKey, lang = "hu"): string {
  switch (key) {
    case "name":
      return T(lang, "Név");
    case "region":
      return T(lang, "Régió");
    case "country":
      return T(lang, "Ország");
    case "city":
      return T(lang, "Város");
    case "qualification":
      return T(lang, "Kvalifikáció");
    case "photos":
      return T(lang, "Fotók");
    case "material":
      return T(lang, "Anyag");
    case "match":
      return T(lang, "Match");
    case "contact":
      return T(lang, "Kontakt");
    case "mock":
      return T(lang, "Mock");
  }
}

/**
 * What the column MEANS — rendered as the header tooltip and in the legend under
 * the table. "Fotók" and "Anyag" had the same one-sentence description in the
 * handbook, which is exactly why nobody could tell which one the default filter
 * was measuring.
 */
export function columnMeaning(key: LeadColumnKey, lang = "hu"): string {
  switch (key) {
    case "name":
      return T(lang, "A szereplő neve a gyűjtésből; a névre koppintva nyílik a lead-lap.");
    case "region":
      return T(lang, "A gyűjtési terület, ahonnan a lead származik.");
    case "country":
      return T(lang, "A gyűjtés országa egységes kóddal; „–” = a gyűjtés nem hozott országot.");
    case "city":
      return T(lang, "A gyűjtés települése; „–” = a gyűjtés nem hozott települést.");
    case "qualification":
      return T(lang, "A honlap-helyzet: nincs honlap / elavult / modern / ismeretlen.");
    case "photos":
      return T(lang, "CSAK a Google Places-ből letöltött szállás-fotók száma.");
    case "material":
      return T(
        lang,
        "MINDEN összegyűjtött kép (Places + portál-profil + Street View) — ebből készül a mock.",
      );
    case "match":
      return T(
        lang,
        "0 és 1 közti pontszám: mennyire biztos, hogy a megtalált portál-profil tényleg EHHEZ a szálláshoz tartozik. „–” = nem volt portál-találat.",
      );
    case "contact":
      return T(lang, "A legjobb elérhető megkeresési csatorna.");
    case "mock":
      return T(lang, "A legutóbbi mock állapota: nincs / generated / approved / rejected.");
  }
}

/** The glyph a lead from an unregistered scrape area wears in the Régió column. */
export function unknownRegionMark(lang = "hu"): string {
  return T(lang, "?");
}

/**
 * Extra marks that appear INSIDE a cell and need their own legend line. A mark whose
 * meaning lives only in a `title` tooltip is unreachable on a touch screen — that is
 * why they are listed in the open legend, not just hinted at.
 */
export function cellMarkMeanings(lang = "hu"): { mark: string; meaning: string }[] {
  return [
    {
      mark: "SV",
      meaning: T(
        lang,
        "Street View-felvétel is elérhető a címről (tartalék nyitókép, ha nincs jobb).",
      ),
    },
    {
      mark: T(lang, "✓ kiküldve"),
      meaning: T(lang, "A megkereső e-mail már elment a leadhez tartozó prospectnek."),
    },
    {
      // Wrapped, like every other visible glyph: an unmarked literal would be the
      // one fragment of this surface that never passes through the language pack.
      mark: unknownRegionMark(lang),
      meaning: T(
        lang,
        "A gyűjtési területhez nincs felvett terület-rekord — a nyers azonosító látszik, nem helynév.",
      ),
    },
    // The list colour-codes two columns and prints "–" for an empty number. Both are
    // information the operator reads off the screen every day, and neither had a
    // definition anywhere (tudásbázis-őr, 2026-09-11).
    {
      mark: T(lang, "zöld / sárga / piros szám"),
      meaning: T(
        lang,
        "A Fotók és a Kontakt oszlop színe az erősséget jelzi: zöld = jó (3+ fotó, illetve e-mail), sárga = gyenge, piros = nincs.",
      ),
    },
    {
      mark: "–",
      meaning: T(lang, "Nincs adat: a gyűjtés nem hozott értéket ebbe az oszlopba (nulla anyagnál is ez áll)."),
    },
  ];
}

export type LeadFilterKind = "text" | "multi" | "min";

export interface LeadFilterDef {
  /** Query-string parameter AND form field name. */
  readonly param:
    | "name"
    | "region"
    | "country"
    | "city"
    | "qualification"
    | "contact"
    | "mock"
    | "minPhotos"
    | "minMaterial"
    | "minMatch";
  readonly column: LeadColumnKey;
  readonly kind: LeadFilterKind;
}

/**
 * Every filter the list offers. `column` is not documentation: the predicate below
 * reads THAT column's `cell()`, and the summary names THAT column's label. There is
 * no way to write a filter here that measures one column and advertises another.
 */
export const LEAD_FILTERS: readonly LeadFilterDef[] = [
  { param: "name", column: "name", kind: "text" },
  { param: "region", column: "region", kind: "multi" },
  { param: "country", column: "country", kind: "multi" },
  { param: "city", column: "city", kind: "multi" },
  { param: "qualification", column: "qualification", kind: "multi" },
  { param: "minPhotos", column: "photos", kind: "min" },
  { param: "minMaterial", column: "material", kind: "min" },
  // Match is a 0–1 score, and a lead with NO portal hit carries -1 as its cell value
  // (see LEAD_COLUMNS.match), so "legalább 0,8" excludes the "–" rows by arithmetic —
  // which is what the sentence promises: a row with no match does not reach 0,8.
  { param: "minMatch", column: "match", kind: "min" },
  { param: "contact", column: "contact", kind: "multi" },
  { param: "mock", column: "mock", kind: "multi" },
];

export function filterFor(param: LeadFilterDef["param"]): LeadFilterDef {
  const f = LEAD_FILTERS.find((x) => x.param === param);
  if (!f) throw new Error(`unknown lead filter: ${param}`);
  return f;
}

/** The raw value of a filter in a query (undefined / empty array = not active). */
export function filterValue(q: LeadQuery, f: LeadFilterDef): string | string[] | number | undefined {
  const v = (q as Record<string, unknown>)[f.param];
  if (f.kind === "multi") return Array.isArray(v) && v.length ? (v as string[]) : undefined;
  if (f.kind === "min") return typeof v === "number" && v > 0 ? v : undefined;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Does a row pass this filter? Reads the COLUMN CELL — never the row field. */
export function passes(f: LeadFilterDef, value: string | string[] | number, r: LeadListRow): boolean {
  const cell = LEAD_COLUMNS[f.column].cell(r);
  if (f.kind === "min") return Number(cell) >= Number(value);
  if (f.kind === "multi") return (value as string[]).includes(String(cell));
  return String(cell).toLowerCase().includes(String(value).toLowerCase());
}

/** Apply every active filter of a query to a row set. */
export function applyLeadFilters(rows: LeadListRow[], q: LeadQuery): LeadListRow[] {
  let out = rows;
  for (const f of LEAD_FILTERS) {
    const v = filterValue(q, f);
    if (v === undefined) continue;
    out = out.filter((r) => passes(f, v, r));
  }
  return out;
}

/** Is any column filter active in this query? (View switching / default injection.) */
export function anyLeadFilter(q: LeadQuery): boolean {
  return LEAD_FILTERS.some((f) => filterValue(q, f) !== undefined);
}

/**
 * Human summary of ONE active filter, in the shape `<Oszlop-felirat>: <feltétel>`.
 * The column name comes from the registry, so the sentence cannot advertise a
 * column the predicate does not read. `labelValue` renders the option codes the way
 * the cells do (e.g. `no_site` → „nincs honlap”).
 */
export function filterSummary(
  f: LeadFilterDef,
  value: string | string[] | number,
  labelValue: (column: LeadColumnKey, code: string) => string,
  lang = "hu",
): string {
  const col = columnLabel(f.column, lang);
  if (f.kind === "min") return T(lang, "{col}: legalább {n}", { col, n: String(value) });
  if (f.kind === "multi") {
    const list = (value as string[]).map((v) => labelValue(f.column, v)).join(T(lang, " vagy "));
    return `${col}: ${list}`;
  }
  return T(lang, "{col}: tartalmazza „{q}”", { col, q: String(value) });
}

/** Sort key for a column — the same cell value the column displays. */
export function sortCell(r: LeadListRow, key: string): number | string {
  const col = LEAD_COLUMNS[key as LeadColumnKey];
  if (!col) return 0;
  const v = col.cell(r);
  return typeof v === "string" ? v.toLowerCase() : v;
}
