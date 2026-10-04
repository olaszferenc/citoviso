// LYRICAL OPENING — the rule for the hero headline, the subtitle and the intro (ADR-XXXX).
//
// Owner, 2026-10-04: „valahogy el kellene érni, hogy ilyen nem vendégcsalogató szövegeket
// generáljon a rendszer. 9/10 esetben ez van…” and „le kellene tiltani a nyitórésznél azt, hogy
// leíró módban menjen… Lírai szöveg kell”. Measured on the stored corpus: 49 of the last 50 mock
// headlines led with an inventory („Bekerített kert tűzrakóval és saját parkoló Hárskúton”), and
// 16 of 27 leads' intros described surfaces read off the photos („két sötétre pácolt faháza”).
// The cause was ours: four places REQUIRED the headline to name amenities (ADR-0091 ④,
// ADR-0097 ④), and the intro schema asked for „the features visible on the photos”.
//
// The prompt now asks for a lyrical opening — but a prompt is statistical (measured: with the
// lyrical prompt alone 3 of 5 openings stretched a source, 2 of 5 copied the prompt's example
// frame). These are the deterministic twins; the vendég-kritikus raises each as a BLOCKING
// objection, so its rewrite round fixes it, and an unfixed one stops at the curator.
//
// ONE SOURCE: the prompts interpolate OPENING_BAD_EXAMPLES from here, so the copy check and
// the model always see the same list.

import { MATERIAL_WORDS } from "./highlightValue.js";

/** The opening's fields, as `surfaceLines()` names them. */
export const OPENING_FIELDS: ReadonlySet<string> = new Set(["hero.lead", "tagline", "intro"]);

/**
 * Real shipped openings the owner rejected — inventory AND empty mood alike (the 2026-08-31
 * ruling still stands: lyrical is not the same as saying nothing). Quoted in the prompts as
 * ROSSZ; there is deliberately NO fill-in „JÓ” frame, because the model copies it verbatim
 * (measured 2026-10-04: two different properties got „Ahol a falu véget ér, és kezdődik …”).
 */
export const OPENING_BAD_EXAMPLES: readonly string[] = [
  "Bekerített kert tűzrakóval és saját parkoló Hárskúton",
  "Zárt udvar tekepályával, ping-ponggal és gyerekjátékokkal",
  "Kerti medence, grill és játszótér a gondozott udvarban",
  "Fenyőillatú csend a tető alatt",
  "Ahol az idő lassabban jár",
  "A Kerekerdő Vendégház két sötétre pácolt faháza",
  "zöld-fehér homlokzatú, piros cseréptetős épülete",
];

/** Surface, material, colour and furniture — the vocabulary of a photo DESCRIPTION. */
const SURFACE_STEMS: readonly string[] = [
  "pácolt", "festett", "meszelt", "homlokzat", "cseréptet", "cserepes tet", "cserépfedel",
  "nádfedel", "nádtet", "zsindely", "burkol", "csempé", "padló", "parkett", "faszerkezet",
  "kőalap", "támfal", "spalettá", "árkád", "boltív", "tornácú", "falú", "színű", "bézs",
  "terrakott", "ülősar", "kerti bútor", "kerti asztal", "bútor", "ágynemű", "függöny",
  "sarokülő", "mennyezet", "kavicsos", "kaviccsal",
  ...MATERIAL_WORDS,
];
const COLOUR_PAIR = /(?<![\p{L}])(?:zöld|fehér|piros|sárga|kék|barna|rózsaszín|szürke)-(?:fehér|zöld|piros|sárga|kék|barna|szürke)/iu;

/** What the house HAS — an opening that lists these is an inventory, not a reason to come. */
const AMENITY_STEMS: readonly string[] = [
  "kert", "udvar", "parkol", "garázs", "grill", "bogrács", "tűzrak", "terasz", "erkély", "wifi",
  "játszó", "gyerekjáték", "tekepály", "ping-pong", "pingpong", "asztalitenisz", "röplabd", "biliárd", "medenc",
  "uszod", "szauna", "jacuzzi", "jakuzzi", "dézsa", "kemenc", "reggeli", "vacsor", "félpanzió",
  "konyh", "étterem", "étterm", "kávézó", "kerékpár", "bicikli", "klím", "légkondi", "pavilon",
  "napozó", "sátorhely", "parcell", "zuhany",
];
/** At most ONE amenity, as an experience (owner, 2026-10-04: „Nagyon szűken mehet”). */
const AMENITY_LIMIT: Readonly<Record<string, number>> = { "hero.lead": 1, tagline: 1, intro: 2 };

/** Mood and sense details — the easiest lie of a lyrical line. Each needs a source word. */
const MOOD_CLAIMS: readonly { name: string; re: RegExp; evidence: RegExp; quiet?: true }[] = [
  { name: "csend", re: /csend/iu, evidence: /csend/iu, quiet: true },
  { name: "nyugalom", re: /nyugal|nyugod/iu, evidence: /nyugal|nyugod|csend/iu, quiet: true },
  { name: "madárszó", re: /madár/iu, evidence: /madár/iu },
  { name: "illat", re: /illat/iu, evidence: /illat/iu },
  { name: "csillagos ég", re: /csillagos (?:ég|éj)|csillagfény|csillagok/iu, evidence: /csillagos (?:ég|éj)|csillagfény|csillagok/iu },
  { name: "ropogó tűz", re: /ropog/iu, evidence: /ropog/iu },
];
/** A guest complaint about noise makes every quiet claim false, whatever else is said. */
const NOISE = /(?<![\p{L}])(?:zaj|zajos|hangos|munkazaj|építkez|forgalmas|lárm)/iu;

export type OpeningKind = "leiro_nyitas" | "leltar_nyitas" | "minta_masolas" | "hangulat_forras_nelkul";

export interface OpeningFinding {
  readonly field: string;
  readonly quote: string;
  readonly kind: OpeningKind;
  readonly guestReaction: string;
  readonly fix: string;
}

export interface OpeningSource {
  /** The property's name and town — stripped before counting („Balatonudvari” is not a yard). */
  readonly name: string;
  readonly town?: string | null;
  /** Listing prose, fact quotes and review texts — everything a claim may stand on. */
  readonly texts: readonly string[];
  /** Guest reviews alone (the noise counter-evidence lives there). */
  readonly reviews: readonly string[];
}

/**
 * Every surface/material/colour WORD in a line, as written (whole word around the stem, one per
 * position — „cseréptetős” is one finding, not „cseréptet” + „cserép”). Exported for the guard.
 */
export function surfaceWords(text: string): string[] {
  const lower = text.toLowerCase();
  const spans: [number, number][] = [];
  const add = (i: number, len: number) => {
    let a = i;
    let b = i + len;
    while (a > 0 && /[\p{L}-]/u.test(lower[a - 1]!)) a--;
    while (b < lower.length && /[\p{L}-]/u.test(lower[b]!)) b++;
    if (!spans.some(([x, y]) => x === a && y === b)) spans.push([a, b]);
  };
  for (const w of SURFACE_STEMS) {
    const i = lower.indexOf(w);
    if (i >= 0) add(i, w.length);
  }
  const c = COLOUR_PAIR.exec(lower);
  if (c) add(c.index, c[0].length);
  return spans.sort((x, y) => x[0] - y[0]).map(([a, b]) => text.slice(a, b));
}

/**
 * Words naming the GUEST, not the house: „kerékpárosoknak”, „kerékpártúrázó-kedvelőknek” are an
 * audience (measured 2026-10-04: the Kerekerdő intro was flagged as an inventory for its cyclists).
 */
const AUDIENCE = /(?:kerékpáros|kerékpártúr|biciklis|bicikliz|grillez[őö]k)\p{L}*/giu;

/** Distinct amenity stems a line names, in order of appearance. Exported for the gate. */
export function amenityStems(text: string): string[] {
  const s = text.toLowerCase().replace(AUDIENCE, " ");
  return AMENITY_STEMS.map((w) => ({ w, i: s.indexOf(w) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.w);
}

const words = (t: string) => t.toLowerCase().match(/\p{L}+/gu) ?? [];

/** The longest run of consecutive words shared with a prompt example (the copy's tell). */
function sharedRun(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  let best = 0;
  for (let i = 0; i < x.length; i++)
    for (let j = 0; j < y.length; j++) {
      let k = 0;
      while (x[i + k] !== undefined && x[i + k] === y[j + k]) k++;
      if (k > best) best = k;
    }
  return best;
}

/** The four opening rules on the copy's labelled lines. Lines outside the opening are skipped. */
export function lintOpening(lines: readonly { field: string; text: string }[], source: OpeningSource): OpeningFinding[] {
  const out: OpeningFinding[] = [];
  const hay = source.texts.join(" \n ");
  const noisy = source.reviews.some((r) => NOISE.test(r));
  const proper = [source.name, source.town ?? ""].filter((p) => p.trim().length >= 3);
  for (const { field, text: raw } of lines) {
    if (!OPENING_FIELDS.has(field) || !raw.trim()) continue;
    // Proper names carry no claim: strip them (and their suffixed forms) before measuring.
    let text = raw;
    for (const p of proper) text = text.replace(new RegExp(`${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\p{L}*`, "giu"), " ");

    for (const w of surfaceWords(text)) {
      out.push({
        field,
        quote: w.trim(),
        kind: "leiro_nyitas",
        guestReaction: "A nyitó szöveg a ház kinézetét írja le — ezért senki nem foglal szállást.",
        fix: "hagyd ki a felület/anyag/szín/bútor leírását; a nyitórész a hely érzetét adja, forrásból",
      });
    }

    const amen = amenityStems(text);
    const limit = AMENITY_LIMIT[field] ?? 1;
    if (amen.length > limit) {
      out.push({
        field,
        quote: raw,
        kind: "leltar_nyitas",
        guestReaction: "Ez egy felszereltség-lista, nem ok arra, hogy idejöjjek.",
        fix: `a nyitórész lírai: legfeljebb ${limit} adottság, élménybe ágyazva; a többi (${amen.join(", ")}) a kiemelésekbe`,
      });
    }

    if (field !== "intro") {
      const copied = OPENING_BAD_EXAMPLES.find((e) => sharedRun(text, e) >= 4);
      if (copied) {
        out.push({
          field,
          quote: raw,
          kind: "minta_masolas",
          guestReaction: "Ezt a mondatot már láttam egy másik szállásnál.",
          fix: `ne a prompt példáját („${copied}”) kövesd — saját, erre a helyre igaz mondat`,
        });
      }
    }

    for (const m of MOOD_CLAIMS) {
      const hit = m.re.exec(text);
      if (!hit) continue;
      const unsourced = !m.evidence.test(hay);
      const contradicted = m.quiet === true && noisy;
      if (!unsourced && !contradicted) continue;
      let a = hit.index;
      let b = hit.index + hit[0].length;
      while (a > 0 && /\p{L}/u.test(text[a - 1]!)) a--;
      while (b < text.length && /\p{L}/u.test(text[b]!)) b++;
      out.push({
        field,
        quote: text.slice(a, b),
        kind: "hangulat_forras_nelkul",
        guestReaction: contradicted
          ? "A vélemények zajra panaszkodnak — ezt a csendet számon kérem."
          : "Ezt honnan tudják? Sehol nem olvastam.",
        fix: contradicted
          ? `hagyd ki a(z) „${m.name}” állítást: egy vendég-vélemény zajról szól`
          : `hagyd ki a(z) „${m.name}” képet, vagy csak forrásból (a bemutatkozás vagy egy vélemény mondja ki)`,
      });
    }
  }
  return out;
}
