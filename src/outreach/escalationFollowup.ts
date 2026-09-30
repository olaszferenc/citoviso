// ADR-0088 §4b — the escalation follow-up mail. SEQUENTIAL by owner ruling:
// the on-page decision card leads; if the prospect still has not purchased
// the operator-set follow-up delay (ADR-0286; getEscalationConfig().followupHours)
// after the offer was minted, ONE follow-up mail
// carries the same offer and deadline ("kell más személy is a döntéshez" case).
// Never re-sent (offer.followup_sent_at), never after purchase or expiry
// (escalationFollowupsDue re-checks both), and every §C gate applies: opt-out
// at prospect AND address level, unsubscribe link + legal basis in the body.
//
// The wording mirrors the approved decision card (design-refs/console/offer-ui):
// same percent, same single-transaction validity, same deadline — the mail and
// the page it links to must not disagree (§I).

import { db } from "../db/client.js";
import {
  claimFollowup,
  escalationFollowupsDue,
  getEscalationConfig,
  releaseFollowup,
} from "../payment/offers.js";
import { SEND_WINDOW, budapestMinutes } from "../sms/sendWindow.js";
import {
  advertiserIdentity,
  buildDraftForProspect,
  composeBody,
  formatHuf,
  senderParts,
  type OutreachParts,
} from "./draft.js";
import { applyOffer } from "../payment/offers.js";
import { getBaseMonthly } from "../pricing.js";
import { checkOutreachDraft } from "./outreachCheck.js";
import { isEmailSuppressed } from "./sendBatch.js";
import { buildOutreachEmail } from "../email/outreachEmail.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { T } from "../i18n/mail.js";

export interface FollowupRunResult {
  readonly sent: number;
  readonly skipped: number;
  /** Set when the run was outside the send window: nothing was queried or sent. */
  readonly deferred?: string;
}

/**
 * ADR-0287: the follow-up runs hourly (citoviso-offer-followup.timer), but no mail goes
 * out at night. The window reuses the cold-outreach hours (SEND_WINDOW, 8–20) read on
 * the BUDAPEST wall clock — the live VPS runs in UTC, so the process-local hour would
 * shift it by 1–2 hours. A due reminder outside the window waits for the first run
 * inside it. Returns why the window is shut, or null when it is open.
 */
export function followupWindowBlocks(now: Date): string | null {
  const m = budapestMinutes(now);
  if (m >= SEND_WINDOW.fromHour * 60 && m < SEND_WINDOW.toHour * 60) return null;
  const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `az emlékeztető ${SEND_WINDOW.fromHour}:00–${SEND_WINDOW.toHour}:00 (Budapest) között megy (most ${hhmm})`; // i18n-exempt: operátori napló, sosem éri el a leadet
}

function deadlineText(d: Date, lang: string): string {
  try {
    return (
      d.toLocaleDateString(lang, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * Run one follow-up tick (hourly: scripts/offer-followup.mts, ADR-0287). `sender` and
 * `onlyProspects` are for the guard only: the dev DB is shared, and a guard run must
 * neither mail nor claim another thread's offers. Product code passes neither.
 */
export async function sendEscalationFollowups(
  now: Date = new Date(),
  opts: { readonly sender?: EmailSender; readonly onlyProspects?: ReadonlySet<string> } = {},
): Promise<FollowupRunResult> {
  const blocked = followupWindowBlocks(now);
  if (blocked) return { sent: 0, skipped: 0, deferred: blocked };
  const sender = opts.sender ?? getEmailSender();
  const due = (await escalationFollowupsDue(now)).filter(
    (f) => !opts.onlyProspects || opts.onlyProspects.has(f.prospectId),
  );
  const { followupHours } = await getEscalationConfig();
  let sent = 0;
  let skipped = 0;
  for (const f of due) {
    const p = await db
      .selectFrom("prospect")
      .select(["contact_email", "unsubscribed_at"])
      .where("id", "=", f.prospectId)
      .executeTakeFirst();
    const email = p?.contact_email?.trim() || null;
    if (!email || p?.unsubscribed_at || (await isEmailSuppressed(email))) {
      skipped++;
      continue;
    }
    // The base draft supplies the tracked link, the unsubscribe/privacy links
    // and the LEAD LANGUAGE (the mail must match the page it opens, ADR-0070).
    const base = await buildDraftForProspect(f.prospectId);
    if (!base) {
      skipped++;
      continue;
    }
    const lang = base.lang;
    const name = base.input.leadName;
    const subject = T(lang, "{name} – döntés-segítő ajánlat", { name });
    // ⛔ The follow-up supplies its OWN parts. It used to be `{...base.draft, subject,
    // body}` — which overrode the text but INHERITED the cold letter's parts. Since the
    // HTML renders `parts` (ADR-0101), that spread would have shown the recipient the
    // INTRO discount in the layout while the text promised this, larger one. The
    // compiler accepts the spread; only this explicit construction (and the consistency
    // guard in buildOutreachEmail) rules it out.
    //
    // The lead's NAME is deliberately left out of the SENTENCES: it would need a case
    // ending, and guessing one is exactly what produced the "a(z) Név" boilerplate the
    // owner rejected (ADR-0101). It rides in the SALUTATION instead (nominative, no
    // ending to guess) — which since 2026-09-11 opens the letter on both paths.
    const listPrice = formatHuf(getBaseMonthly());
    const offerPrice = formatHuf(applyOffer(getBaseMonthly(), { percent: f.percent }));
    const parts: OutreachParts = {
      greet: T(lang, "Tisztelt {name}!", { name }),
      hook: T(lang, "Köszönjük, hogy többször is megnézte a honlap-tervét."),
      p1: T(
        lang,
        "Szeretnénk segíteni a döntésben: ha {deadline}-ig rendel, az első díjból a bemutatkozó kedvezmény helyett {percent}% kedvezményt adunk.",
        { deadline: deadlineText(f.expiresAt, lang), percent: String(f.percent) },
      ),
      p2: T(lang, "A fenti linken a kedvezményes ár már be van állítva — egy kattintással megrendelheti."),
      p3: T(
        lang,
        "Döntés-segítő ajánlat: {percent}% kedvezmény — a saját honlapja havi {price} forint helyett {offerPrice} forinttól az Öné.",
        { percent: String(f.percent), price: listPrice, offerPrice },
      ),
      p4: T(lang, "Ha tetszik, élesítjük. A vendégei ezután közvetlenül Önnél foglalnak, jutalék nélkül."),
      priceList: listPrice,
      priceOffer: offerPrice,
      percent: String(f.percent),
      ...senderParts(),
      fine: T(lang, "A kedvezmény az első havi vagy éves díjra érvényes, a hosszabbítás listaáron megy."),
      unsubTxt: T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:"),
      legal: T(
        lang,
        "Ezt a levelet azért kapta, mert korábban megtekintette a honlap-tervét, és a döntés-segítő ajánlata hamarosan lejár (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató:",
      ),
      // §C.2 advertiser identification — the follow-up is an advertising message too.
      identity: advertiserIdentity(lang),
    };
    const body = composeBody(
      parts,
      { cta: base.draft.link, unsub: base.draft.unsubscribeLink, privacy: base.draft.privacyLink },
      lang,
    );

    const draft = { ...base.draft, subject, body, parts };
    // §C DETERMINISTIC GATE on the REPLACED text (guard-scope lesson: a new send
    // path must run the same judge as the old one, incl. the ADR-0036 country
    // gate) — a FLAGged follow-up is skipped and reported, never sent.
    const gate = checkOutreachDraft(draft, name, lang, base.market);
    if (gate.verdict !== "PASS") {
      console.error(
        `[offer] follow-up §C FLAG · prospect ${f.prospectId}: ${gate.reasons.join(" · ")}`,
      );
      skipped++;
      continue;
    }
    const msg = buildOutreachEmail(draft, email, { lang });
    // Claim BEFORE the send (ADR-0287): an overlapping or repeated run loses here and
    // sends nothing; an offer that expired since the query cannot be claimed.
    if (!(await claimFollowup(f.offerId, now))) {
      skipped++;
      continue;
    }
    try {
      await sender.send(msg);
    } catch (e) {
      // Loud per-prospect failure; the claim is released, so the next run retries.
      console.error(`[offer] follow-up küldés HIBA · prospect ${f.prospectId}:`, e);
      await releaseFollowup(f.offerId, now);
      skipped++;
      continue;
    }
    console.log(
      `[offer] eszkalációs follow-up elküldve (${followupHours}h+ · −${f.percent}%, ` + // i18n-exempt: operátori napló, sosem éri el a leadet
        `lejárat ${f.expiresAt.toISOString()}) · ${email}`, // i18n-exempt: operátori napló, sosem éri el a leadet
    );
    sent++;
  }
  return { sent, skipped };
}
