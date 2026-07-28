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
}

/** Segment/qualification-specific opening hook — the honest, concrete observation. */
function hookSentence(d: DraftInput): string {
  const seg = d.segment ?? "";
  if (seg === "elavult") {
    return (
      "Kerestük a(z) " + d.leadName + " honlapját, és úgy láttuk, a mostani oldal " +
      "nehezen boldogul telefonon — pedig ma a vendégek túlnyomó része mobilról keres szállást."
    );
  }
  if (seg === "van_labnyom") {
    return (
      "A(z) " + d.leadName + " szépen jelen van az interneten, de úgy láttuk, egy saját, " +
      "modern oldal még hiányzik a képből — pedig a vendégek ott döntenek."
    );
  }
  // nincs_honlap / 0_labnyom — the core segment.
  return (
    "Szállásokat kerestünk a környéken (" + d.region + "), és feltűnt, hogy a(z) " +
    d.leadName + " nem található meg saját honlappal — pedig a vendégek ma ott keresnek és ott döntenek."
  );
}

/** The social-proof line — ONLY from real, gated data (A4). Empty if none. */
function proofSentence(d: DraftInput): string {
  if (!d.rating || !d.rating.count) return "";
  const v = String(d.rating.value).replace(".", ",");
  return (
    "A Google-on " + v + " csillagos értékelése van " + d.rating.count +
    " vélemény alapján — ez pontosan az az erősség, aminek egy saját oldalon is látszania kell. "
  );
}

/**
 * Build the deterministic outreach draft for a tracked prospect. Pure render
 * from real data + config; the §C gate (outreachCheck) judges the result.
 */
export function renderDraft(d: DraftInput): OutreachDraft {
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  const link = base ? `${base}/p/${d.token}` : `[HIÁNYZÓ PUBLIC_BASE_URL]/p/${d.token}`;
  const unsubscribeLink = base
    ? `${base}/p/${d.token}/leiratkozas`
    : `[HIÁNYZÓ PUBLIC_BASE_URL]/p/${d.token}/leiratkozas`;
  const privacyLink = base ? `${base}/adatvedelem` : `[HIÁNYZÓ PUBLIC_BASE_URL]/adatvedelem`;
  const s = config.outreachSender;
  const senderBlock = [
    s.name || "[KÜLDŐ NEVE — OUTREACH_SENDER_NAME]",
    s.company || "[CÉG — OUTREACH_SENDER_COMPANY]",
    [s.email || "[E-MAIL — OUTREACH_SENDER_EMAIL]", s.phone].filter(Boolean).join(" · "),
  ].join("\n");

  const subject = `Elkészítettük a(z) ${d.leadName} honlap-tervét — egy kattintásra megnézheti`;

  const body = `Tisztelt Vendéglátó!

${hookSentence(d)}

${proofSentence(d)}Hogy ne csak beszéljünk róla, elkészítettük a(z) ${d.leadName} személyre szabott honlap-TERVÉT — ez egy előzetes látványterv az Önről nyilvánosan elérhető adatokból, nem kész oldal, és semmire nem kötelezi:

${link}

A linken azt is beállíthatja, mi kerüljön az oldalra — az árat azonnal látja. Ha tetszik, mi élesítjük; a vendégei közvetlenül Önnél foglalnak, közvetítői jutalék nélkül.

Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat itt:
${unsubscribeLink}

Üdvözlettel,
${senderBlock}

Ezt a levelet azért kapta, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató: ${privacyLink}`;

  return { subject, body, link, unsubscribeLink, privacyLink };
}

/** Load the draft inputs for a prospect id (real lead data only). */
export async function buildDraftForProspect(prospectId: string): Promise<
  { draft: OutreachDraft; input: DraftInput } | null
> {
  const r = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .leftJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select([
      "prospect.token as token",
      "prospect.segment as segment",
      "lead.name as leadName",
      "lead.qualification as qualification",
      "scraper_definition.region as region",
      "mock_artifact.inputs as artifactInputs",
    ])
    .where("prospect.id", "=", prospectId)
    .executeTakeFirst();
  if (!r) return null;
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
  const input: DraftInput = {
    leadName: r.leadName,
    region: r.region,
    qualification: r.qualification,
    segment: r.segment,
    rating,
    token: r.token,
  };
  return { draft: renderDraft(input), input };
}
