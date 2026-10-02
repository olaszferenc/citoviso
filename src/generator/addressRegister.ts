// FAMILIAR-REGISTER (tegező) DETECTION — the guest critic's deterministic twin (ADR-0292).
//
// WHY RULES, NOT A WORD LIST. The first version matched a closed list of whole forms
// ("kapsz", "nézd", "várunk" …). Measured 2026-10-02 (M4): it caught "Amit itt kapsz", but let
// "kaphatsz", "érezd magad", "töltsd", "pihenj", "foglald", "jársz", "nálad" through — every
// inflection of a listed verb, and every verb not on the list, was invisible. Hungarian marks
// the familiar 2nd person in the ENDING, so the rules below generate the endings:
//   · pronouns and pronominal case forms (te, téged, neked, nálad, veletek …);
//   · the potential -hatsz/-hetsz/-hatod/-heted/-hatnál/-hetnél — no other word ends like that;
//   · the indefinite imperative "consonant + j" (foglalj, pihenj, írj, maradj) — a vowel + j
//     ending (díj, olaj, táj, fej) is a noun, so the consonant is required;
//   · verb STEMS that hospitality copy actually uses × the familiar endings (present, definite,
//     imperative, conditional, past, plural), with their preverbs (meg-, el-, ki- …);
//   · noun stems × the 2nd-person possessive (szobád, foglalásod, kerted, leveled).
// The stem rules are deliberately stem-bound: a bare "-sz" / "-d" / "-nál" ending would hit
// tavasz, egész, család, föld, a háznál. Precision is measured on the whole i18n catalogue
// (3850 guest/owner strings, all polite) plus a trap list — scripts/address-register-check.mts.
//
// Kept free of imports so the guard can load a mutated copy of THIS file and prove that every
// rule family is load-bearing.

type Harmony = "back" | "front" | "round";

/** Verb stem → its harmony class, whether it is sibilant-final (-ol/-el/-öl in the present),
 *  and the irregular forms that the regular endings would not produce. */
interface VerbStem {
  readonly stem: string;
  readonly h: Harmony;
  /** Present 2sg takes -ol/-el/-öl (sibilant stem: néz → nézel). */
  readonly sib?: boolean;
  /** A linking vowel before -sz (tölt → töltesz, választ → választasz). */
  readonly link?: boolean;
  /** Imperative stem when it is not stem + j (néz → nézz, tölt → tölts). */
  readonly imp?: string;
  /** Definite imperative when it is not derivable (választ → válaszd). */
  readonly impDef?: string;
  /** The stem is also a noun whose adessive would collide (vár → „a várnál”): no conditional. */
  readonly noCond?: boolean;
}

const V: readonly VerbStem[] = [
  { stem: "kap", h: "back" },
  { stem: "talál", h: "back" },
  { stem: "foglal", h: "back" },
  { stem: "pihen", h: "front" },
  { stem: "jár", h: "back" },
  { stem: "sétál", h: "back" },
  { stem: "próbál", h: "back" },
  { stem: "marad", h: "back" },
  { stem: "tud", h: "back" },
  { stem: "ír", h: "back" },
  { stem: "vár", h: "back", noCond: true },
  { stem: "fogad", h: "back" },
  { stem: "kirándul", h: "back" },
  { stem: "lát", h: "back", link: true, imp: "láss", impDef: "lásd" },
  { stem: "választ", h: "back", link: true, imp: "válassz", impDef: "válaszd" },
  { stem: "tölt", h: "round", link: true, imp: "tölts", impDef: "töltsd" },
  { stem: "szeret", h: "front", link: true, imp: "szeress", impDef: "szeresd" },
  { stem: "néz", h: "front", sib: true, imp: "nézz" },
  { stem: "élvez", h: "front", sib: true, imp: "élvezz" },
  { stem: "fedez", h: "front", sib: true, imp: "fedezz" },
  { stem: "érez", h: "front", sib: true, imp: "érezz" },
  { stem: "kérdez", h: "front", sib: true, imp: "kérdezz" },
  { stem: "érkez", h: "front", sib: true, imp: "érkezz" },
  { stem: "keres", h: "front", sib: true, imp: "keress" },
  { stem: "tervez", h: "front", sib: true, imp: "tervezz" },
  { stem: "grillez", h: "front", sib: true, imp: "grillezz" },
  { stem: "hoz", h: "back", sib: true, imp: "hozz" },
  { stem: "utaz", h: "back", sib: true, imp: "utazz" },
  { stem: "főz", h: "round", sib: true, imp: "főzz" },
  { stem: "kér", h: "front" },
  { stem: "ül", h: "round" },
];

/** Irregular verbs: their familiar forms, spelled out. */
const IRREGULAR: readonly string[] = [
  "vagytok", "leszel", "lesztek", "légy", "legyél", "legyetek", "voltál", "lennél",
  "jössz", "jöttök", "gyere", "gyertek", "jöttél", "jönnél",
  "mész", "menj", "menjetek", "mentél", "mennél",
  "eszel", "egyél", "edd", "ettél", "iszol", "igyál", "idd", "ittál", "innál",
  "teszel", "tegyél", "tedd", "tetted", "tennél", "veszel", "vegyél", "vedd", "vetted", "vennél",
  "viszel", "vigyél", "vidd", "vitted", "vinnél", "hiszel", "hidd", "adsz", "adj", "adod",
  "alszol", "aludj", "aludtál", "aludnál", "úszol", "ússz", "úsztál", "fürdesz", "fürödsz", "fürödj",
  "érzel", "érzed",
];

/** Noun stems a page would put a "your …" on (2sg possessive: szobád, kerted, leveled). */
const N: readonly { stem: string; h: Harmony; poss?: string }[] = [
  { stem: "szobá", h: "back" }, { stem: "foglalás", h: "back" }, { stem: "szállás", h: "back" },
  { stem: "kert", h: "front" }, { stem: "ház", h: "back", poss: "házad" }, { stem: "utazás", h: "back" },
  { stem: "nyaralás", h: "back" }, { stem: "pihenés", h: "front" }, { stem: "család", h: "back" },
  { stem: "gyerek", h: "front" }, { stem: "autó", h: "back", poss: "autód" }, { stem: "kutyá", h: "back" },
  { stem: "kedvenc", h: "front" }, { stem: "időpont", h: "back" }, { stem: "kérés", h: "front" },
  { stem: "kérdés", h: "front" }, { stem: "élmény", h: "front" }, { stem: "levél", h: "front", poss: "leveled" },
  { stem: "otthon", h: "back" }, { stem: "barát", h: "back", poss: "barátod" }, { stem: "párod", h: "back", poss: "párod" },
];

const VOW = { back: "o", front: "e", round: "ö" } as const;
const VOWA = { back: "a", front: "e", round: "e" } as const;
const PREVERB = "(?:meg|el|ki|fel|be|le|át|vissza|oda|rá|össze)?";
const L = "\\p{L}";
const CASE = "dal|del|at|et|ot|öt|ba|be|ban|ben|ra|re|ról|ről|hoz|hez|höz|nak|nek|nál|nél|tól|től|val|vel|ból|ből|on|en|ön|ért|ig|ként";
/** Frozen expressions that wear a 2sg form but address nobody („lásd lent” = see below). */
const FROZEN = new Set(["lásd"]);

/** Every familiar ending of one verb stem: present, definite, imperative, conditional, past
 *  (2sg), and the back-harmony 2pl. ⚠️ No front-harmony 2pl: „kértek”, „szerettek”, „néztek”
 *  are ALSO the 3pl past („they asked”) — a third-person sentence must not fail. */
function verbForms(v: VerbStem): string[] {
  const o = VOW[v.h], a = VOWA[v.h], back = v.h === "back";
  const s = v.stem;
  const imp = v.imp ?? s + "j";
  const forms = [
    v.sib ? s + o + "l" : (v.link ? s + a : s) + "sz", // present indefinite: kapsz · nézel · töltesz
    s + o + "d", // present definite: kapod · nézed · töltöd
    imp, imp + (back ? "ál" : "él"), // imperative: foglalj · foglaljál · nézz
    v.impDef ?? (imp.endsWith("j") ? s + "d" : imp.slice(0, -1) + "d"), // definite imperative: foglald · nézd · töltsd
    imp + (back ? "ad" : "ed"), // foglaljad
    s + "t" + (back ? "ál" : "él"), // past: kaptál · kértél
    ...(v.link ? [s + o + "tt" + (back ? "ál" : "él")] : []), // választottál · töltöttél
    s + "t" + (back ? "ad" : "ed"), // past definite: kaptad · kérted
    ...(v.noCond ? [] : [s + "n" + (back ? "ál" : "él"), s + "n" + (back ? "ád" : "éd")]), // conditional: kapnál · szeretnél
    ...(v.link && !v.noCond ? [s + a + "n" + (back ? "ál" : "él")] : []), // töltenél · választanál
    ...(back ? [s + "tok", s + "otok", imp + "atok"] : []), // 2pl: fogadtok · foglaljatok
  ];
  return [...new Set(forms)];
}

function nounForms(n: { stem: string; h: Harmony; poss?: string }): string[] {
  if (n.poss) return [n.poss];
  const last = n.stem.slice(-1);
  if (/[aáeéiíoóöőuúüű]/.test(last)) return [n.stem + "d"];
  return [n.stem + VOW[n.h] + "d"];
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (xs: readonly string[]): string => [...new Set(xs)].sort((a, b) => b.length - a.length).map(esc).join("|");

/** The rule families. Each is a whole-word pattern; the guard mutates them one by one. */
export const RULES: Readonly<Record<string, RegExp>> = {
  // RULE:pronoun
  pronoun: new RegExp(
    `(?<!${L})(te|téged|neked|nálad|tőled|hozzád|veled|rólad|rád|rajtad|benned|belőled|beléd|tiéd|tieid|ti|titeket|nektek|nálatok|tőletek|hozzátok|veletek|rólatok|rátok|bennetek|benneteket|magatokat|tiétek|magad|magadat|magadnak)(?!${L})`,
    "giu",
  ),
  // RULE:potential
  potential: new RegExp(`(?<!${L})${L}{2,}(?:hatsz|hetsz|hatod|heted|hatnál|hetnél|hatnád|hetnéd|hattok|hettek)(?!${L})`, "giu"),
  // RULE:imperative
  imperative: new RegExp(`(?<!${L})${L}{2,}[bcdfghklmnprtvz]j(?:ál|él|atok|etek)?(?!${L})`, "giu"),
  // RULE:verb
  verb: new RegExp(`(?<!${L})${PREVERB}(?:${alt([...V.flatMap(verbForms), ...IRREGULAR])})(?!${L})`, "giu"),
  // RULE:possessive
  // A case ending may follow (szobádban, kertedet) — only a case ending, never any letters:
  // „szállás” + „ad” + „ó” is the noun „szállásadó”, not „your accommodation”.
  possessive: new RegExp(`(?<!${L})(?:${alt(N.flatMap(nounForms))})(?:${CASE})?(?!${L})`, "giu"),
  // RULE:legacy — the first word list, kept so nothing it caught is lost.
  legacy: /(?<![\p{L}])(kapsz|leszel|érkezel|pihensz|szeretnél|találsz|foglalj|írj|nézd|gyere|várunk|neked|téged|leveled|szobád|foglalásod|élvezd|fedezd|próbáld|válassz|kérdezz)(?![\p{L}])/giu,
};

export interface FamiliarHit {
  readonly quote: string;
  readonly rule: string;
  readonly index: number;
}

/** Every familiar-register form in `text`, de-duplicated by position. */
export function familiarForms(text: string): FamiliarHit[] {
  const seen = new Map<number, FamiliarHit>();
  for (const [rule, re] of Object.entries(RULES)) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      if (FROZEN.has(m[0].toLowerCase())) continue;
      if (!seen.has(m.index!)) seen.set(m.index!, { quote: m[0], rule, index: m.index! });
    }
  }
  return [...seen.values()].sort((a, b) => a.index - b.index);
}
