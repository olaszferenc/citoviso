// The conversion tree's STRUCTURE (ADR-0510) — states, causes, levers and their measurement marks, in
// ONE place. Source of truth for the words: _planning/DOMAIN/07-CONVERSION-TREE.md §B (spine) and §C
// (causes and levers per transition). This module carries, next to every cause and lever, the doc's
// own wording (`doc`) — scripts/conversion-tree-check.mts parses §B/§C and fails when the two drift
// (a cause or lever added, removed, renamed or re-marked on either side).
//
// The UI texts (`title`, `name`, `desc`) are the console's short forms of the same items; the numbers
// come from the report fold (src/console/reportData.ts, `TreeCounts`), never from here.
// Frozen surface: assets/design-refs/console/konverzios-fa/ (B · Folyam).

/** Measurement mark of a state or cause (§A): measured · partial (indirect / undercounts) · blind spot. */
export type TreeMeasure = "merve" | "reszben" | "vakfolt";
/** Cause mark (§A): verified (a reply / measurement is the source) or hypothesis. */
export type CauseKind = "igazolt" | "felteves";

export interface TreeState {
  readonly n: number;
  /** The §B row's state name as the doc starts it (the guard compares). */
  readonly doc: string;
  /** Console label (short) — shown on the flow. */
  readonly short: string;
  /** How the state is measured TODAY (0, 2, 3, 10 are blind: no number, never zero). */
  readonly measure: TreeMeasure;
}

export interface TreeLever {
  /** Stable id — conversion_task.lever_id points here; never reuse or rename one in use. */
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  /** The §C wording of the lever, verbatim (after „Kar:”, split on „;”, trailing period dropped). */
  readonly doc: string;
}

export interface TreeCause {
  readonly id: string;
  readonly kind: CauseKind;
  readonly measure: TreeMeasure;
  readonly title: string;
  /** The §C cause text the doc starts with (after „Ok · <kind> — ”). */
  readonly doc: string;
  /** Evidence line under the title ("" = none). */
  readonly evidence: string;
  /** The returners count (side exit) is shown under this cause. */
  readonly showsReturners?: boolean;
  readonly levers: readonly TreeLever[];
}

export interface TreeTransition {
  /** "a-b" — a and b are adjacent spine states. */
  readonly key: string;
  /** Console label of the drop ("végignézi, nem nyúl az ajánlathoz"). */
  readonly label: string;
  /** The §C heading's parenthesis, when the doc has one. */
  readonly docLabel: string | null;
  readonly causes: readonly TreeCause[];
}

/** The e-mail first round's start (07 §E: „e-mailes első kör, 2026-11-09…”) — the „Pilot” period chip. */
export const EMAIL_PILOT_FROM = "2026-11-09";

export const TREE_STATES: readonly TreeState[] = [
  { n: 0, doc: "Kiválasztott lead", short: "Kiválasztott", measure: "vakfolt" },
  { n: 1, doc: "Kiküldve", short: "Kiküldve", measure: "merve" },
  { n: 2, doc: "Megérkezett a beérkezők közé", short: "Megérkezett", measure: "vakfolt" },
  { n: 3, doc: "Észrevette", short: "Észrevette", measure: "vakfolt" },
  { n: 4, doc: "Megnyitotta a levelet", short: "Levelet nyitott", measure: "reszben" },
  { n: 5, doc: "Megnyitotta a tervet", short: "Tervet nyitott", measure: "merve" },
  { n: 6, doc: "Végignézte", short: "Végignézte", measure: "merve" },
  { n: 7, doc: "Ajánlathoz nyúlt", short: "Ajánlathoz nyúlt", measure: "merve" },
  { n: 8, doc: "Próba / rendelés", short: "Próba / rendelés", measure: "merve" },
  { n: 9, doc: "Fizetett", short: "Fizetett", measure: "merve" },
  // §B: „mérve, ha lesz vevő” — until the first payment there is nothing to measure: a blind spot.
  { n: 10, doc: "Megmaradt", short: "Megmaradt", measure: "vakfolt" },
];

/** Transitions with no rate today (one end is a blind state): the drop is a hole, never a number. */
export const BLIND_TRANSITIONS: readonly string[] = ["0-1", "1-2", "2-3", "3-4", "9-10"];

export const TREE_TRANSITIONS: readonly TreeTransition[] = [
  {
    key: "0-1",
    label: "rossz kiválasztás",
    docLabel: "rossz kiválasztás",
    causes: [
      {
        id: "dead_business", kind: "igazolt", measure: "reszben", title: "Nem működik már", doc: "Nem működik már",
        evidence: "8 válasz + 5 leiratkozási ok (11-09…27)",
        levers: [{ id: "fresh_signal", name: "Csak friss működési jellel küldünk", desc: "a kiválasztás kér egy friss jelet, hogy a szállás működik", doc: "csak friss működési jellel küldünk" }],
      },
      {
        id: "has_site", kind: "igazolt", measure: "reszben", title: "Van honlapja", doc: "Van honlapja",
        evidence: "9 válasz + 5 leiratkozási ok",
        levers: [{ id: "site_truth_sample", name: "Honlapcím a kapu igazság-mintájába", desc: "a válaszban talált honlapcím a saját-honlap kapu igazság-mintájába kerül", doc: "a válaszban talált honlapcím a saját-honlap kapu igazság-mintájába" }],
      },
      {
        id: "wrong_address", kind: "igazolt", measure: "reszben", title: "A cím nem a gazdáé", doc: "A cím nem a gazdáé",
        evidence: "4 válasz + 1 leiratkozási ok",
        levers: [{ id: "contact_match_accuracy", name: "Kontakt-egyezés pontosságának mérése", desc: "mennyi a kontakt-egyezés pontossága, mintán mérve", doc: "a kontakt-egyezés pontosságának mérése" }],
      },
    ],
  },
  {
    key: "1-2",
    label: "nem érkezik meg",
    docLabel: "nem érkezik meg",
    causes: [
      {
        id: "dead_address", kind: "felteves", measure: "vakfolt", title: "Halott cím", doc: "Halott cím",
        evidence: "ma nem látjuk: a visszapattanót eldobjuk",
        levers: [{ id: "bounce", name: "Visszapattanó rögzítése", desc: "domainenként rögzítjük; halott címre többé nem küldünk", doc: "visszapattanó rögzítése, domainenként, halott címre többé nem" }],
      },
      {
        id: "spam_folder", kind: "igazolt", measure: "vakfolt", title: "Spam", doc: "Spam",
        evidence: "a 11-16…18 ablakban igazolva; azóta vakfolt",
        levers: [{ id: "seed_inboxes", name: "Napi 3–5 saját próbacím", desc: "a gép nézi, melyik mappába érkezik a levél", doc: "napi 3–5 saját próbacím, a gép nézi a mappát" }],
      },
    ],
  },
  {
    key: "2-3",
    label: "nem veszi észre",
    docLabel: "nem veszi észre",
    causes: [
      {
        id: "sinks", kind: "felteves", measure: "reszben", title: "Elsüllyed", doc: "Elsüllyed",
        evidence: "közvetett: a tervnyitás 40%-a 1 órán, 80%-a 1 napon belül",
        levers: [{ id: "send_hour", name: "Kiküldési óra", desc: "a küldés idejét a nyitási időzítéshez igazítjuk", doc: "kiküldési óra" }],
      },
      {
        id: "unread_mailbox", kind: "felteves", measure: "vakfolt", title: "Nem olvasott postafiók", doc: "Nem olvasott postafiók",
        evidence: "régi freemail, citromail",
        levers: [{ id: "open_by_domain", name: "Nyitás domainenként", desc: "a nyitási arányt postafiók-domainenként mérjük", doc: "nyitás domainenként" }],
      },
    ],
  },
  {
    key: "3-4",
    label: "észreveszi, nem nyitja",
    docLabel: "észreveszi, nem nyitja",
    causes: [
      {
        id: "dull_sender_subject", kind: "felteves", measure: "vakfolt", title: "A feladó / tárgy nem érdekes", doc: "A feladó / tárgy nem érdekes",
        evidence: "",
        levers: [{ id: "subject_ab", name: "Tárgy- és feladó-A/B", desc: "ADR-0462 motor, ma csak a kontroll fut", doc: "tárgy- és feladó-A/B (ADR-0462 motor, ma csak control)" }],
      },
      {
        id: "preview_looks_spam", kind: "felteves", measure: "vakfolt", title: "Az előnézet alapján spamnek hiszi", doc: "Az előnézet alapján spamnek hiszi",
        evidence: "nincs előnézeti sor",
        levers: [{ id: "preheader_ab", name: "Saját előnézeti sor, A/B", desc: "a levél elejére saját előnézeti szöveg, változatokkal", doc: "saját előnézeti sor, A/B" }],
      },
    ],
  },
  {
    key: "4-5",
    label: "megnyitja, nem kattint",
    docLabel: "megnyitja, nem kattint",
    causes: [
      { id: "not_their_place", kind: "igazolt", measure: "reszben", title: "Nem az ő szállása", doc: "Nem az ő szállása", evidence: "4 válasz", levers: [] },
      {
        id: "thinks_scam", kind: "igazolt", measure: "reszben", title: "Spamnek / átverésnek hiszi", doc: "Spamnek / átverésnek hiszi",
        evidence: "3 válasz + 1 „distrust”",
        levers: [{ id: "data_source_sentence", name: "Mondat arról, honnan az adat", desc: "a levélben kimondjuk, honnan vettük az adatait", doc: "mondat arról, honnan az adat" }],
      },
      {
        id: "weak_promise", kind: "felteves", measure: "vakfolt", title: "Nem ad jó ígéretet", doc: "Nem ad jó ígéretet",
        evidence: "minek honlap · nem foglalkozok vele · a kép rossz · ár?? · átverés · nem kértem, nem dőlök be (tulaj skicce)",
        levers: [
          { id: "first_line_price_ab", name: "Első mondat és ársor A/B", desc: "változatok a levél első mondatára és az ár sorára", doc: "első mondat és ársor A/B" },
          { id: "plain_personal_letter", name: "Kép nélküli személyes változat", desc: "rövid, személyes levél kép nélkül", doc: "kép nélküli személyes változat" },
        ],
      },
      {
        id: "no_time_now", kind: "felteves", measure: "vakfolt", title: "Most nincs ideje", doc: "Most nincs ideje",
        evidence: "",
        levers: [{ id: "second_letter_openers", name: "Második levél a nyitó-nem-kattintónak", desc: "ma nincs ilyen levél", doc: "második levél a nyitó-nem-kattintónak (ma nincs ilyen)" }],
      },
    ],
  },
  {
    key: "5-6",
    label: "rögtön kilép",
    docLabel: "rögtön kilép",
    causes: [
      {
        id: "bad_hero", kind: "igazolt", measure: "reszben", title: "Rossz nyitókép", doc: "Rossz nyitókép",
        evidence: "javító levél ügye, ADR-0508",
        levers: [
          { id: "render_gate_rules", name: "Render-kapu szabályok", desc: "a gép nem enged ki rossz nyitóképet", doc: "render-kapu szabályok" },
          { id: "exit_by_hero_kind", name: "Kilépés képfajtánként", desc: "a rögtön-kilépést a nyitókép fajtája szerint mérjük", doc: "kilépés képfajtánként" },
        ],
      },
      { id: "not_recognised", kind: "felteves", measure: "vakfolt", title: "Nem ismeri fel a saját szállását", doc: "Nem ismeri fel a saját szállását", evidence: "", levers: [] },
    ],
  },
  {
    key: "6-7",
    label: "végignézi, nem nyúl az ajánlathoz",
    docLabel: "végignézi, nem nyúl az ajánlathoz",
    causes: [
      {
        id: "not_now", kind: "igazolt", measure: "reszben", title: "Most nem aktuális", doc: "Most nem aktuális",
        evidence: "„érdekel, de költözöm” (not_now)", showsReturners: true,
        levers: [{ id: "returner_message", name: "A visszatérőkre reagáló üzenet", desc: "ma KI van kapcsolva", doc: "a visszatérőkre reagáló üzenet (ma KI)" }],
      },
      {
        id: "price_unclear_value", kind: "felteves", measure: "vakfolt", title: "Az ár · nem érti az ajánlatot / a teendőt · nem hiszi, hogy megéri", doc: "Az ár.",
        evidence: "",
        levers: [
          { id: "pricequestion", name: "Kérdés az árak alatt", desc: "egy kérdés az árak alatt / kilépéskor, 4 gombbal, mint a leiratkozási kérdőív", doc: "egy kérdés az árak alatt / kilépéskor (4 gomb, mint a leiratkozási kérdőív)" },
          { id: "offer_ab", name: "Ajánlat-változatok A/B-ben", desc: "több ajánlat-változat, véletlen elosztással", doc: "ajánlat-változatok A/B-ben" },
        ],
      },
    ],
  },
  {
    key: "7-8",
    label: "az ajánlatig jut, nem próbáz",
    docLabel: null,
    causes: [
      {
        id: "trial_form", kind: "felteves", measure: "merve", title: "A próba-űrlap", doc: "A próba-űrlap",
        evidence: "13 megnyitás → 1 indítás",
        levers: [{ id: "trial_form_fields", name: "Mezőnkénti mérés, kevesebb mező", desc: "melyik mezőnél áll meg; a felesleges mezők kikerülnek", doc: "mezőnkénti mérés, kevesebb mező" }],
      },
    ],
  },
  {
    key: "8-9",
    label: "próbázik, nem fizet",
    docLabel: null,
    causes: [
      { id: "trial_no_order", kind: "felteves", measure: "vakfolt", title: "A próba után nem rendel / a fizetésnél elakad", doc: "A próba után nem rendel / a fizetésnél elakad", evidence: "", levers: [] },
    ],
  },
  { key: "9-10", label: "fizetett, nem marad", docLabel: null, causes: [] },
];

export const transitionOf = (key: string): TreeTransition | undefined => TREE_TRANSITIONS.find((t) => t.key === key);

/** Every lever with its transition and cause — the task CLI validates against this. */
export function allLevers(): { node: string; cause: TreeCause; lever: TreeLever }[] {
  return TREE_TRANSITIONS.flatMap((t) => t.causes.flatMap((c) => c.levers.map((lever) => ({ node: t.key, cause: c, lever }))));
}
export const leverOf = (node: string, leverId: string): { cause: TreeCause; lever: TreeLever } | undefined =>
  allLevers().find((x) => x.node === node && x.lever.id === leverId);

/**
 * The flow's (B · Folyam) units: the measured spine 1, 5, 6, 7, 8, 9. 2·3·4 sit inside the 1→5 branch
 * (the lead is lost there, but we cannot tell in which step); 0 and 10 are in the legend.
 */
export const FLOW_NODES: readonly number[] = [1, 5, 6, 7, 8, 9];
export const FLOW_TRANSITIONS: readonly string[] = ["1-5", "5-6", "6-7", "7-8", "8-9"];
/** The tree transitions that a flow branch stands for (1→5 = the four steps inside it). */
export const FLOW_PARTS: Readonly<Record<string, readonly string[]>> = {
  "1-5": ["1-2", "2-3", "3-4", "4-5"],
  "5-6": ["5-6"],
  "6-7": ["6-7"],
  "7-8": ["7-8"],
  "8-9": ["8-9"],
};
/** The flow branch (or legend panel) a tree transition opens in. */
export function flowKeyOf(node: string): string {
  for (const [k, parts] of Object.entries(FLOW_PARTS)) if (parts.includes(node)) return k;
  return node; // "0-1" / "9-10": their own panel, opened from the legend
}

/** „Után” waits for a measured cohort: sends at/after the lever's start that are this old… */
export const TASK_AFTER_WAIT_DAYS = 7;
/** …and at least this many of them reached the parent state. */
export const TASK_AFTER_MIN_PARENT = 30;
