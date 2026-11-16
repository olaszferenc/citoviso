// The quote markers of mail clients, PER LANGUAGE, as data (ADR-0455, ország-réteg 3/4).
// stripQuoted() (mime.ts) builds its patterns from this table — a new language is a new
// entry, never a new `if`. Covered: the languages Bábel already ships (src/i18n/babel/packs)
// plus the languages of the countries we prepare (cs, ro, bg, sr, el …) and the big
// neighbours (fr, es). The phrases are the ones Gmail / Outlook / Apple Mail / Thunderbird
// write in each locale.
//
//   wrote   — the attribution line's verb, at the END of the line, right before the colon
//             ("On … X wrote:", "… napsal(a):", "… написа:", "Le … a écrit :")
//   wroteThen — a verb the NAME follows ("Am 12.10. um 10:30 schrieb Max <max@x.de>:")
//   lead    — words that START a wrapped attribution line (its verb is on the next line)
//   header  — the "-----Original Message-----" / "Forwarded message" banner text
//   from    — the first label of Outlook's quoted header block ("From: …")
//   bare    — a phrase that marks the attribution anywhere on the line, without a colon
//             (Gmail HU wraps "X ezt írta (időpont: …" over two lines)
export interface QuoteMarkerSet {
  readonly wrote: readonly string[];
  readonly wroteThen?: readonly string[];
  readonly lead: readonly string[];
  readonly header: readonly string[];
  readonly from: readonly string[];
  readonly bare?: readonly string[];
}

export const QUOTE_MARKERS: Readonly<Record<string, QuoteMarkerSet>> = {
  en: { wrote: ["wrote"], lead: ["On"], header: ["Original Message", "Forwarded message"], from: ["From"] },
  hu: {
    wrote: ["írta"],
    lead: [],
    header: ["Eredeti üzenet", "Továbbított üzenet"],
    from: ["Feladó", "Küldő"],
    bare: ["ezt írta"],
  },
  de: { wrote: [], wroteThen: ["schrieb"], lead: ["Am"], header: ["Ursprüngliche Nachricht", "Weitergeleitete Nachricht"], from: ["Von"] },
  hr: {
    wrote: ["napisao", "napisala", "napisao/la", "je napisao", "je napisala"],
    lead: ["Dana"],
    header: ["Izvorna poruka", "Proslijeđena poruka"],
    from: ["Od", "Šalje"],
  },
  sl: {
    wrote: ["napisal", "napisala", "napisal/a", "je napisal", "je napisala"],
    lead: ["Dne"],
    header: ["Izvirno sporočilo", "Posredovano sporočilo"],
    from: ["Od", "Pošiljatelj"],
  },
  sk: {
    wrote: ["napísal", "napísala", "napísal(a)"],
    lead: ["Dňa", "V"],
    header: ["Pôvodná správa", "Preposlaná správa"],
    from: ["Od"],
  },
  cs: {
    wrote: ["napsal", "napsala", "napsal(a)"],
    lead: ["Dne", "V"],
    header: ["Původní zpráva", "Přeposlaná zpráva", "Původní e-mail"],
    from: ["Od"],
  },
  pl: {
    wrote: ["napisał", "napisała", "napisał(a)"],
    lead: ["W dniu", "Dnia"],
    header: ["Wiadomość oryginalna", "Oryginalna wiadomość", "Przekazana wiadomość"],
    from: ["Od"],
  },
  it: { wrote: ["ha scritto", "scritto"], lead: ["Il"], header: ["Messaggio originale", "Messaggio inoltrato"], from: ["Da"] },
  ro: { wrote: ["a scris"], lead: ["În", "Pe"], header: ["Mesaj original", "Mesaj redirecționat", "Mesaj transmis"], from: ["De la"] },
  bg: { wrote: ["написа"], lead: ["На"], header: ["Оригинално съобщение", "Препратено съобщение"], from: ["От"] },
  sr: {
    wrote: ["написао", "написала", "написао/ла", "је написао", "је написала", "napisao/la", "napisao", "napisala", "je napisao", "je napisala"],
    lead: ["Дана", "Dana"],
    header: ["Оригинална порука", "Прослеђена порука", "Originalna poruka", "Prosleđena poruka"],
    from: ["Од", "Od", "Шаље"],
  },
  mk: { wrote: ["напиша"], lead: ["На"], header: ["Оригинална порака", "Препратена порака"], from: ["Од"] },
  el: { wrote: ["έγραψε"], lead: ["Στις"], header: ["Αρχικό μήνυμα", "Προωθημένο μήνυμα"], from: ["Από"] },
  fr: { wrote: ["a écrit"], lead: ["Le"], header: ["Message d'origine", "Message transféré"], from: ["De"] },
  es: { wrote: ["escribió"], lead: ["El"], header: ["Mensaje original", "Mensaje reenviado"], from: ["De"] },
};

const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const alt = (pick: (m: QuoteMarkerSet) => readonly string[] | undefined): string =>
  [...new Set(Object.values(QUOTE_MARKERS).flatMap((m) => [...(pick(m) ?? [])]))]
    .sort((a, b) => b.length - a.length)
    .map(reEscape)
    .join("|");

const WROTE = alt((m) => m.wrote);
const WROTE_THEN = alt((m) => m.wroteThen);
const LEAD = alt((m) => m.lead);
/** The verb right before the colon, or a name-after verb followed by the name. */
const ATTRIBUTION_END = `(?:(?:${WROTE})\\s?|(?:${WROTE_THEN})\\s+[^:\\n]{1,80}):\\s*$`;

/** The line patterns that start the quoted tail (one regex per kind, every language in it). */
export const QUOTE_LINE_PATTERNS: readonly RegExp[] = [
  // "On … wrote:" / "… írta:" / "Am … schrieb X:" — the attribution verb ends the line.
  new RegExp(`^\\s*.{0,200}${ATTRIBUTION_END}`, "iu"),
  // Gmail HU-style: the attribution phrase anywhere, the date wrapping onto the next line.
  new RegExp(`^\\s*.{0,200}(?<![\\p{L}])(?:${alt((m) => m.bare)})(?![\\p{L}])`, "iu"),
  new RegExp(`^\\s*-{2,}\\s*(?:${alt((m) => m.header)})\\s*-{2,}`, "iu"),
  new RegExp(`^\\s*(?:${alt((m) => m.from)}):\\s.+`, "iu"),
  /^\s*_{10,}\s*$/,
];

/** A wrapped attribution: this line starts like one ("On …", "Am …", a date) … */
export const QUOTE_WRAP_FIRST = new RegExp(`^\\s*(?:(?:${LEAD})|\\d{1,4}[./-])\\s.+`, "u");
/** … and the next line ends with the verb and a colon. */
export const QUOTE_WRAP_SECOND = new RegExp(ATTRIBUTION_END, "iu");
