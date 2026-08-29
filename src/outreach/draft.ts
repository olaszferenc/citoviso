// Outreach e-mail draft (PILOT.md §2.5 + 03-INVARIANTS §C) — deterministic,
// grounded, per-lead personalized. The pilot send is MANUAL (A2 house step):
// the operator reviews the draft in the console, copies it into their mail
// client, sends, then marks the prospect "sent". No SMTP pipeline yet (§C
// DEFERRED) — building the draft surface activates the §C NOW gate instead.
//
// Grounding (§B.17 applies to outreach copy too): every concrete claim in the
// draft comes from real lead data (name, region, qualification, rating) or
// from what WE did (built a preview). Nothing invented. The subject and body
// state honestly that the linked page is a PREVIEW/PLAN (§A demo-framing),
// never "your site is ready".
//
// The owner tunes the wording HERE (one file) at the pre-send copy gate.

import { config } from "../config.js";
import { db } from "../db/client.js";
import { slugify } from "../domains.js";
import { T, prepareMailLang } from "../i18n/mail.js";
import { langForCountry } from "../i18n/lang.js";
import { loadPricing, getBaseMonthly } from "../pricing.js";

export interface OutreachDraft {
  readonly subject: string;
  readonly body: string;
  /** The absolute tracked link embedded in the body. */
  readonly link: string;
  /** The absolute unsubscribe link embedded in the body. */
  readonly unsubscribeLink: string;
  /** The absolute privacy-notice link (GDPR Art. 13/14 page). */
  readonly privacyLink: string;
}

export interface DraftInput {
  readonly leadName: string;
  readonly region: string;
  readonly qualification: string | null;
  readonly segment: string | null;
  readonly rating: { value: number; count: number } | null;
  readonly token: string;
  /**
   * The reader's language (ADR-0067/0070). REQUIRED: this file writes the entire
   * cold-outreach mail — subject and body — and it used to be hardcoded Hungarian
   * while sitting OUTSIDE the i18n guard's file list. Nothing broke only because a
   * different gate (the ADR-0036 country gate) happened to block non-`hu` leads;
   * the day that opens, every lead would get Hungarian. Making the field required
   * means the compiler asks the question at every call site instead.
   *
   * Load the pack with prepareMailLang() before rendering — T() here is sync.
   */
  readonly lang: string;
}

/**
 * The SHORT, segment-specific observation — the honest, concrete thing we noticed.
 *
 * ⛔ Segment-aware on purpose: an 'elavult' lead DOES have a website (it is just old),
 * so a blanket "saját honlapot nem találtunk" would be a fabricated hard claim about
 * their business (§B.17). Each branch may only state what that segment actually means.
 *
 * Kept short because this sentence now opens the mail, and its first ~90 characters
 * ARE the Gmail preview line — the third and last thing a recipient sees before
 * deciding to open (feladó / tárgy / első sor).
 */
function observation(d: DraftInput): string {
  const seg = d.segment ?? "";
  if (seg === "elavult") return T(d.lang, "a mostani honlapja telefonon nehezen boldogul");
  if (seg === "van_labnyom") return T(d.lang, "saját, modern oldal még nincs a képben");
  // nincs_honlap / 0_labnyom — the core segment.
  return T(d.lang, "saját honlapot nem találtunk");
}

/**
 * The opening paragraph = the Gmail preview line. It leads with the PROOF (their own
 * rating, from A4-gated data) because that is the one thing only someone who actually
 * looked at their business could write; the generic "Tisztelt Vendéglátó!" greeting
 * used to sit here and burned ~21 of the ~90 visible characters on nothing.
 */
function openingLine(d: DraftInput): string {
  const obs = observation(d);
  if (d.rating?.count) {
    return T(d.lang, "A(z) {name} a Google-on {stars} csillagos értékelést kapott {count} vélemény alapján — {obs}.", {
      name: d.leadName,
      stars: String(d.rating.value).replace(".", ","),
      count: d.rating.count,
      obs,
    });
  }
  return T(d.lang, "A(z) {name} kapcsán feltűnt, hogy {obs} — pedig a vendégek ma az interneten keresnek és ott döntenek.", {
    name: d.leadName,
    obs,
  });
}

/**
 * Grouped HUF amount ("3 900"). The advertised from-price comes from the ONE
 * pricing source (modules.ts BASE_PRICE_MONTHLY = the cheapest real package,
 * monthly billing) — the mail can never claim a price the configurator does
 * not actually offer (Fttv.: an advertised from-price must be attainable).
 */
function formatHuf(n: number): string {
  return new Intl.NumberFormat("hu-HU").format(n);
}


/**
 * Build the deterministic outreach draft for a tracked prospect. Pure render
 * from real data + config; the §C gate (outreachCheck) judges the result.
 */
export function renderDraft(d: DraftInput): OutreachDraft {
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  // The link carries a READABLE slug before the token (/p/<slug>/<token>). A bare
  // random token from an unknown sender reads exactly like a phishing link — the
  // strongest trust signal we can put in a cold mail is the recipient seeing their
  // OWN business name in the URL. The slug is cosmetic only: the unguessable token
  // still identifies and guards the preview, so nobody can browse other leads'
  // pages by typing a name. The console normalizes the shape, so links already
  // sent as /p/<token> keep working.
  const slug = slugify(d.leadName).slice(0, 40).replace(/-+$/, "");
  const pathBase = slug ? `/p/${slug}/${d.token}` : `/p/${d.token}`;
  const link = base ? `${base}${pathBase}` : `[HIÁNYZÓ PUBLIC_BASE_URL]${pathBase}`; // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  const unsubscribeLink = base
    ? `${base}${pathBase}/unsubscribe`
    : `[HIÁNYZÓ PUBLIC_BASE_URL]${pathBase}/unsubscribe`; // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  const privacyLink = base ? `${base}/privacy` : `[HIÁNYZÓ PUBLIC_BASE_URL]/privacy`; // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  const s = config.outreachSender;
  const senderBlock = [
    s.name || "[KÜLDŐ NEVE — OUTREACH_SENDER_NAME]", // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
    s.company || "[CÉG — OUTREACH_SENDER_COMPANY]", // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
    [s.email || "[E-MAIL — OUTREACH_SENDER_EMAIL]", s.phone].filter(Boolean).join(" · "), // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  ].join("\n");

  // Personal, first-person subject (no marketing hook) → better Primary-tab odds.
  //
  // SHORT on purpose (owner's pick, 2026-08-26). Mobile Gmail renders ~38 characters:
  // measured on the 389 leads that have an address, the previous subject — the name
  // followed by "– készítettem Önöknek egy honlap-tervet" — fit for ZERO of them, so
  // the offer always fell behind the ellipsis and a long-named lead saw nothing but
  // their own name. This form fits for 336 of 389 (86%), name AND point visible.
  const subject = T(d.lang, "{name} – honlap-terv", { name: d.leadName });

  // The first paragraph IS the Gmail preview line, so it carries the proof and the
  // observation; the greeting moves down one paragraph rather than burning the
  // preview on "Tisztelt Vendéglátó!".
  const body = `${openingLine(d)}

${T(d.lang, "Tisztelt Vendéglátó! Ezért elkészítettem a(z) {name} személyre szabott honlap-TERVÉT — ez egy előzetes látványterv az Önről nyilvánosan elérhető adatokból, nem kész oldal, és semmire nem kötelezi:", { name: d.leadName })}

${link}

${T(d.lang, "Egy kattintással ki is próbálhatja: a linken beállíthatja, mi kerüljön az oldalra, és az árat azonnal látja. A saját honlapja már havi {price} forinttól az Öné lehet — ha tetszik, mi élesítjük, és a vendégei közvetlenül Önnél foglalnak, közvetítői jutalék nélkül.", { price: formatHuf(getBaseMonthly()) })}

${T(d.lang, "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat itt:")}
${unsubscribeLink}

${T(d.lang, "Üdvözlettel,")}
${senderBlock}

${T(d.lang, "Ezt a levelet azért kapta, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató: {privacy}", { privacy: privacyLink })}`;

  return { subject, body, link, unsubscribeLink, privacyLink };
}

/** A compact SMS variant of the outreach (ADR-0030). Same §C obligations as e-mail —
 *  identifiable sender, personalization (the lead's name), opt-out — but SMS-length. The
 *  actual transport is a later GSM-module slice; today the console composes + previews it
 *  and the "send" is a marked PLACEHOLDER (no real transmission). */
export interface SmsDraft {
  readonly text: string;
  readonly link: string;
  readonly unsubscribeLink: string;
}

/** Shared pieces of every SMS-shaped outreach message (link, opt-out, sender). */
function smsDraftParts(d: DraftInput): { link: string; unsubscribeLink: string; sender: string } {
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  // SAME readable slug as the mail (ADR-0082 / guard finding 2026-08-29): a bare
  // random token arriving from an unknown mobile number is the strongest phishing
  // signature we could produce. The recipient must see their own name in the URL.
  const slug = slugify(d.leadName).slice(0, 40).replace(/-+$/, "");
  const pathBase = slug ? `/p/${slug}/${d.token}` : `/p/${d.token}`;
  const link = base ? `${base}${pathBase}` : `[HIÁNYZÓ PUBLIC_BASE_URL]${pathBase}`; // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  const unsubscribeLink = base
    ? `${base}${pathBase}/unsubscribe`
    : `[HIÁNYZÓ PUBLIC_BASE_URL]${pathBase}/unsubscribe`; // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  // Unfilled sender config must FAIL the gate, not silently fall back to a brand
  // name: the recipient of a cold SMS has a right to know who is writing.
  const sender =
    config.outreachSender.name ||
    config.outreachSender.company ||
    "[KÜLDŐ NEVE — OUTREACH_SENDER_NAME]"; // i18n-exempt: konfig-hiba jelölő, nem vevő-szöveg (a §C-kapu kidobja)
  return { link, unsubscribeLink, sender };
}

export function renderSmsDraft(d: DraftInput): SmsDraft {
  const { link, unsubscribeLink, sender } = smsDraftParts(d);
  // Personal, non-misleading, opt-out included — kept short for SMS. The
  // legitimate-interest wording is REQUIRED (Grt./GDPR transparency at first
  // contact); the linked page carries the full privacy notice.
  const text = T(
    d.lang,
    "{name} – készítettünk egy ingyenes honlap-TERVET Önről, jogos érdekű megkeresésként (nem kötelez). Nézze meg (adatkezelési tájékoztatóval): {link} – {sender}. Leiratkozás: {unsub}",
    { name: d.leadName, link, sender, unsub: unsubscribeLink },
  );
  return { text, link, unsubscribeLink };
}

/**
 * The COMPANION SMS of the ADR-0083 MMS+SMS pair. It arrives right after the
 * mock's image, so it references "the plan we just sent" — and it carries the
 * legal mandatories the MMS physically cannot (the CLI takes only an image +
 * ASCII subject): live link, legal basis, sender identity, opt-out.
 */
export function renderPairSmsDraft(d: DraftInput): SmsDraft {
  const { link, unsubscribeLink, sender } = smsDraftParts(d);
  const text = T(
    d.lang,
    "{name} – az imént MMS-ben küldött honlap-látványtervet élőben itt nézheti meg (jogos érdekű megkeresés, nem kötelez): {link} – {sender}. Leiratkozás: {unsub}",
    { name: d.leadName, link, sender, unsub: unsubscribeLink },
  );
  return { text, link, unsubscribeLink };
}

/** Load the draft inputs for a prospect id (real lead data only). Returns both the e-mail
 *  draft and the SMS draft (ADR-0030), plus the lead's phone for the SMS channel. */
export async function buildDraftForProspect(prospectId: string): Promise<
  { draft: OutreachDraft; sms: SmsDraft; input: DraftInput; phone: string | null; lang: string; leadId: string } | null
> {
  await loadPricing();
  const r = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .leftJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select([
      "prospect.token as token",
      "prospect.segment as segment",
      "lead.id as leadId",
      "lead.name as leadName",
      "lead.qualification as qualification",
      "lead.raw as raw",
      "scraper_definition.region as region",
      "scraper_definition.country as country",
      "mock_artifact.inputs as artifactInputs",
    ])
    .where("prospect.id", "=", prospectId)
    .executeTakeFirst();
  if (!r) return null;
  const phoneRaw = ((r.raw ?? {}) as { phone?: string }).phone;
  const phone = phoneRaw && phoneRaw.trim() ? phoneRaw.trim() : null;
  // Rating ONLY from the artifact's persisted SiteData — it passed the A4 gate at
  // generation time (resolveGatedPhotos: non-low match band), and it is exactly
  // what the linked mock shows (§I: the mail claims what the mock claims).
  const inputs = (r.artifactInputs ?? {}) as {
    siteData?: { rating?: { value?: number; count?: number } };
  };
  const sdRating = inputs.siteData?.rating;
  const rating =
    sdRating && typeof sdRating.value === "number" && typeof sdRating.count === "number"
      ? { value: sdRating.value, count: sdRating.count }
      : null;
  // Load the reader's pack BEFORE rendering — renderDraft's T() is synchronous.
  // ADR-0070: the mail's language is the MOCK's language (the page the link
  // opens), falling back to the scrape country (ADR-0036) — the letter and the
  // page it links to must not disagree.
  const sdLang = (inputs.siteData as { lang?: string } | undefined)?.lang;
  const lang = await prepareMailLang(sdLang || langForCountry(r.country));
  const input: DraftInput = {
    leadName: r.leadName,
    region: r.region,
    qualification: r.qualification,
    segment: r.segment,
    rating,
    token: r.token,
    lang,
  };
  return {
    draft: renderDraft(input),
    sms: renderSmsDraft(input),
    input,
    phone,
    lang,
    // The draft page is a SUB-page of the lead; without this it had no way back.
    leadId: r.leadId,
  };
}
