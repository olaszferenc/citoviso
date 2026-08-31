// ADR-0088 §4b — the escalation follow-up mail. SEQUENTIAL by owner ruling:
// the on-page decision card leads; if the prospect still has not purchased
// ESCALATION_FOLLOWUP_HOURS after the offer was minted, ONE follow-up mail
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
  ESCALATION_FOLLOWUP_HOURS,
  escalationFollowupsDue,
} from "../payment/offers.js";
import { buildDraftForProspect, outreachSenderBlock } from "./draft.js";
import { checkOutreachDraft } from "./outreachCheck.js";
import { isEmailSuppressed } from "./sendBatch.js";
import { buildOutreachEmail } from "../email/outreachEmail.js";
import { getEmailSender } from "../email/sender.js";
import { T } from "../i18n/mail.js";

export interface FollowupRunResult {
  readonly sent: number;
  readonly skipped: number;
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

/** Run one follow-up tick (invoked from the daily billing-cycle script). */
export async function sendEscalationFollowups(
  now: Date = new Date(),
): Promise<FollowupRunResult> {
  const due = await escalationFollowupsDue(now);
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
    const body = `${T(lang, "Tisztelt Vendéglátó! Köszönjük, hogy többször is megnézte a(z) {name} honlap-tervét. Szeretnénk segíteni a döntésben: ha {deadline}-ig rendel, az első díjból a bemutatkozó kedvezmény helyett {percent}% kedvezményt adunk. A kedvezmény az első havi vagy éves díjra érvényes, a hosszabbítás listaáron megy.", {
      name,
      deadline: deadlineText(f.expiresAt, lang),
      percent: String(f.percent),
    })}

${base.draft.link}

${T(lang, "A fenti linken a kedvezményes ár már be van állítva — egy kattintással megrendelheti.")}

${T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat itt:")}
${base.draft.unsubscribeLink}

${T(lang, "Üdvözlettel,")}
${outreachSenderBlock()}

${T(lang, "Ezt a levelet azért kapta, mert korábban megtekintette a honlap-tervét, és a döntés-segítő ajánlata hamarosan lejár (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató: {privacy}", { privacy: base.draft.privacyLink })}`;

    const draft = { ...base.draft, subject, body };
    // §C DETERMINISTIC GATE on the REPLACED text (guard-scope lesson: a new send
    // path must run the same judge as the old one, incl. the ADR-0036 country
    // gate) — a FLAGged follow-up is skipped and reported, never sent.
    const gate = checkOutreachDraft(draft, name, lang);
    if (gate.verdict !== "PASS") {
      console.error(
        `[offer] follow-up §C FLAG · prospect ${f.prospectId}: ${gate.reasons.join(" · ")}`,
      );
      skipped++;
      continue;
    }
    const msg = buildOutreachEmail(draft, email, { lang });
    try {
      await getEmailSender().send(msg);
    } catch (e) {
      // Loud per-prospect failure; the un-stamped offer retries next tick.
      console.error(`[offer] follow-up küldés HIBA · prospect ${f.prospectId}:`, e);
      skipped++;
      continue;
    }
    // Stamp AFTER the send succeeded — a failed send retries on the next tick.
    await db
      .updateTable("offer")
      .set({ followup_sent_at: now })
      .where("id", "=", f.offerId)
      .execute();
    console.log(
      `[offer] eszkalációs follow-up elküldve (${ESCALATION_FOLLOWUP_HOURS}h+ · −${f.percent}%, ` +
        `lejárat ${f.expiresAt.toISOString()}) · ${email}`,
    );
    sent++;
  }
  return { sent, skipped };
}
