// Súgó-KATEGÓRIÁK — a tudásbázis csoportosítása (tulajdonosi döntés, 2026-09-12).
//
// ⛔ MIÉRT: a súgó 35 cikke egyetlen, kategória nélküli cikk-fal volt. Egy IT-kezdő
// nem tud benne tájékozódni: a lista címekből áll, a címek pedig képernyő-neveket
// mondanak, nem azt, hogy MIKOR van rájuk szükség.
//
// A csoportosítás a MUNKAFOLYAMATOT követi, nem a menüt (tulajdonosi választás): az
// olvasó ott keres, ahol a munkájában éppen tart. Ha a menü átrendeződik, a súgó
// szerkezete NEM romlik el tőle.
//
// ⚠️ A besorolás ADAT (a cikk fejlécében `category:`), nem kódbeli slug-táblázat: egy
// új cikk így nem eshet némán egy „egyéb" kupacba — a kb-check kötelezővé teszi, és
// ismeretlen kategóriára is bukik.
//
// A `label` mezőket az extract-i18n MEZŐNÉV szerint takarítja be (DATA_FILES), mert a
// nézet dinamikus argumentummal fordítja: T(lang, cat.label). Ezért maradnak nyers
// literálok — a T()-be burkolás pont a betakarítást törné el.

export interface KbCategory {
  readonly id: string;
  readonly label: string;
  readonly audience: "tenant" | "operator";
}

/** A sorrend a MEGJELENÍTÉS sorrendje — a munkafolyamat íve, nem ábécé. */
export const KB_CATEGORIES: readonly KbCategory[] = [
  // ── Operátor: a lead születésétől a vevővé válásig ──────────────────────────
  { id: "lead-path", label: "A lead útja", audience: "operator" },
  { id: "finance", label: "Pénzügy és partnerek", audience: "operator" },
  { id: "measure", label: "Mérés és napló", audience: "operator" },
  { id: "system", label: "Rendszer és fiók", audience: "operator" },
  // ── Tenant: a szállásadó saját munkája a honlapján ──────────────────────────
  { id: "my-site", label: "Az oldalam", audience: "tenant" },
  { id: "bookings", label: "Foglalás és vendégek", audience: "tenant" },
  { id: "modules", label: "Modulok és bővítések", audience: "tenant" },
  { id: "billing", label: "Előfizetés és számlák", audience: "tenant" },
  { id: "account", label: "Fiók, jog és üzenetek", audience: "tenant" },
];

export function kbCategory(id: string): KbCategory | null {
  return KB_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** A kategóriák a megjelenítés sorrendjében, egy adott olvasó-körre. */
export function kbCategoriesFor(audience: "tenant" | "operator"): readonly KbCategory[] {
  return KB_CATEGORIES.filter((c) => c.audience === audience);
}
