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

import { sql } from "kysely";
import { db } from "../db/client.js";
import {
  claimFollowup,
  escalationFollowupsDue,
  getEscalationConfig,
  releaseFollowup,
} from "../payment/offers.js";
import { SEND_WINDOW, SEND_WINDOW_TZ, budapestHhmm, sendWindowOpen } from "../sms/sendWindow.js";
import {
  advertiserIdentity,
  buildDraftForProspect,
  composeBody,
  fromPricePair,
  senderParts,
  type OutreachParts,
} from "./draft.js";
import { checkOutreachDraft } from "./outreachCheck.js";
import { isEmailSuppressed } from "./sendBatch.js";
import { trialCampaignReached } from "./trialCampaign.js";
import { buildOutreachEmail } from "../email/outreachEmail.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { T } from "../i18n/mail.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { collectFallbacks } from "../i18n/packs.js";
import { foreignEscalationSentence } from "./foreignPrice.js";
import { allCountriesSync, countryConfigSync } from "../country.js";
import { followupWindowBlocksIn, leadCountryCfg } from "./leadClock.js";

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
  if (sendWindowOpen(now)) return null;
  return `az emlékeztető ${SEND_WINDOW.fromHour}:00–${SEND_WINDOW.toHour}:00 (Budapest) között megy (most ${budapestHhmm(now)})`; // i18n-exempt: operátori napló, sosem éri el a leadet
}

/** The deadline as the follow-up mail prints it (exported for the send-window guard). */
export function deadlineText(d: Date, lang: string): string {
  try {
    return (
      // ADR-0288: the Budapest wall clock, like the decision card on the page this
      // mail links to (offerViews.ts) — the server's zone (UTC on prod) would put
      // a deadline 1–2 hours earlier in the mail than on the page (§I).
      d.toLocaleDateString(lang, { month: "short", day: "numeric", timeZone: SEND_WINDOW_TZ }) +
      " " +
      d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", timeZone: SEND_WINDOW_TZ })
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
/**
 * Owner 2026-11-18 („az újramegkereső email se menjen ki”): the stop switch of this follow-up LETTER (the
 * on-page offer keeps running). „Országok / Árazás” 4. fázis (0155): the switch is the lead's COUNTRY ROW's
 * escalation_followup — the old global app_setting 'escalation_followup' was written into every row.
 */
export function escalationFollowupOn(country: string | null): boolean {
  return countryConfigSync(country)?.dispatch.escalationFollowup ?? false;
}

/** The lead said no: any of its prospects opted out, or a reply's basis starts „elutasító” / „nem érintett”. */
export async function leadRejected(leadId: string): Promise<boolean> {
  const r = await db
    .selectFrom("lead as l")
    .select("l.id")
    .where("l.id", "=", leadId)
    .where((eb) =>
      eb.or([
        eb.exists(eb.selectFrom("prospect as px").select("px.id").whereRef("px.lead_id", "=", "l.id").where("px.unsubscribed_at", "is not", null)),
        eb.exists(
          eb.selectFrom("outreach_reply as r").select("r.id").whereRef("r.lead_id", "=", "l.id")
            .where(sql<boolean>`(r.suggestion_basis[1] ilike 'elutasító%' or r.suggestion_basis[1] ilike 'nem érintett%')`), // i18n-exempt: Poe's basis marker (machine key, RUNBOOK §6b), never shown
        ),
      ]),
    )
    .executeTakeFirst();
  return Boolean(r);
}

export async function sendEscalationFollowups(
  now: Date = new Date(),
  opts: { readonly sender?: EmailSender; readonly onlyProspects?: ReadonlySet<string> } = {},
): Promise<FollowupRunResult> {
  // NEMZETKÖZI B: the window is the LEAD's (its zone, its holidays). The run is deferred only when
  // no country's window is open; the HU row reads followupWindowBlocks' own sentence, so a
  // Hungarian-only list is deferred exactly as before.
  const homeBlocked = followupWindowBlocks(now);
  if (allCountriesSync().every((c) => followupWindowBlocksIn(now, c, followupWindowBlocks) !== null)) {
    return { sent: 0, skipped: 0, deferred: homeBlocked ?? "egyik ország emlékeztető-ablaka sincs nyitva" }; // i18n-exempt: operátori napló
  }
  // 0155: no country lets the letter go → nothing is read.
  if (allCountriesSync().every((c) => !c.dispatch.escalationFollowup)) return { sent: 0, skipped: 0, deferred: "kikapcsolva (minden országban: escalation_followup)" }; // i18n-exempt: operátori napló
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
      .innerJoin("lead", "lead.id", "prospect.lead_id")
      .select(["prospect.lead_id as lead_id", "prospect.contact_email as contact_email", "prospect.unsubscribed_at as unsubscribed_at", "lead.contact_block_at as contact_block_at"])
      .where("prospect.id", "=", f.prospectId)
      .executeTakeFirst();
    const email = p?.contact_email?.trim() || null;
    // NEMZETKÖZI B védőháló: „ne keressük” on the LEAD (lead.contact_block_at) stops it too — a
    // prospect created after the block carries no unsubscribed_at of its own.
    if (!email || p?.unsubscribed_at || p?.contact_block_at || (await isEmailSuppressed(email))) {
      skipped++;
      continue;
    }
    // ⛔ A REJECTER NEVER GETS ANYTHING MORE (owner 2026-10-26, ADR-0421) — not even this reminder, whether or not someone
    // clicked the block mark: an opt-out on ANY of the lead's prospects, or a reply Poe classed „elutasító / nem érintett”
    // (the first line of the suggestion's basis, Poe RUNBOOK §6b — language-independent, always Hungarian).
    if (await leadRejected(p!.lead_id)) {
      skipped++;
      continue;
    }
    // The lead's own window (zone, holidays); no country row → not sent (fail closed). A due
    // reminder outside its window is left unclaimed: the next hourly run inside it sends it.
    const leadCfg = await leadCountryCfg(p!.lead_id);
    // 0155: the lead's country switched the letter off (Kiküldés tab) → left unclaimed.
    if (!leadCfg?.dispatch.escalationFollowup) {
      skipped++;
      continue;
    }
    if (followupWindowBlocksIn(now, leadCfg, followupWindowBlocks)) {
      skipped++;
      continue;
    }
    // ADR-0348: the retroactive trial letter promised "Erről a próbáról több levelet nem
    // küldünk" — a lead (or address) that got the campaign mail or SMS gets no follow-up.
    if (p && (await trialCampaignReached(p.lead_id, email))) {
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
    // ORSZÁG-RÉTEG 3/6 (ADR-0456 pattern): the follow-up's render is MEASURED — on a foreign letter
    // one Hungarian fallback holds it (§C NYELV, „Bábelre vár”), it never goes out half Hungarian.
    const measured = collectFallbacks(() => {
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
    // The same from-price as the cold letter: the cheapest offered package (owner 2026-10-12).
    // ORSZÁG-RÉTEG 3/6: in the lead region's currency (absent / HUF = forint, as before).
    const foreignMoney = Boolean(base.input.currency && base.input.currency.toUpperCase() !== "HUF");
    const { priceList: listPrice, priceOffer: offerPrice } = fromPricePair(
      base.input.fromMonthly ?? null,
      f.percent,
      foreignMoney ? { currency: base.input.currency, lang } : undefined,
    );
    const parts: OutreachParts = {
      greet: T(lang, "Tisztelt {name}!", { name }),
      hook: T(lang, "Köszönjük, hogy többször is megnézte a honlap-tervét."),
      p1: T(
        lang,
        "Szeretnénk segíteni a döntésben: ha {deadline}-ig rendel, az első díjból a bemutatkozó kedvezmény helyett {percent}% kedvezményt adunk.",
        { deadline: deadlineText(f.expiresAt, lang), percent: String(f.percent) },
      ),
      p2: T(lang, "A fenti linken a kedvezményes ár már be van állítva — egy kattintással megrendelheti."),
      p3: foreignMoney
        ? foreignEscalationSentence(lang, { percent: String(f.percent), price: listPrice, offerPrice })
        : T(
        lang,
        "Döntés-segítő ajánlatként {percent}% kedvezményt adunk: a saját honlap havi {price} forint helyett {offerPrice} forinttól indul.",
        { percent: String(f.percent), price: listPrice, offerPrice },
      ),
      p4: T(lang, "Ha tetszik, elindítjuk az oldalt. A vendégei ezután közvetlenül Önnél foglalnak, jutalék nélkül."),
      priceList: listPrice,
      priceOffer: offerPrice,
      percent: String(f.percent),
      ...senderParts(),
      fine: T(lang, "A kedvezmény az első havi vagy éves díjra érvényes, a hosszabbítás már listaáras."),
      // ADR-0322 ④/B: one optional line — the link opens a page with five buttons, and
      // only the POST there answers (ADR-0291), so a mail scanner says nothing for them.
      // ⚖️ It SAYS it is not an opt-out (jog-őr FLAG 2026-10-04): it sits right above the
      // unsubscribe line, and someone who wants out must not take the wrong door.
      why: T(lang, "Nem aktuális? Jelezze egy koppintással, miért (ez nem leiratkozás):"),
      unsubTxt: T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:"),
      legal: T(
        lang,
        "Ezt a levelet azért kapta, mert korábban megtekintette a honlap-tervét, és a döntés-segítő ajánlata hamarosan lejár (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató:",
      ),
      // §C.2 advertiser identification — the follow-up is an advertising message too.
      identity: advertiserIdentity(lang),
      // The follow-up's own copy speaks of ONE plan ("a honlap-tervét") and has no image;
      // its multi-plan wording was not part of the 2026-09-23 approval, so it stays as is.
      planCount: 1,
    };
    // The why-link is the unsubscribe link's sibling (same slug + token path).
    const whyLink = base.draft.unsubscribeLink.replace(/\/unsubscribe$/, "/why");
    const body = composeBody(
      parts,
      { cta: base.draft.link, unsub: base.draft.unsubscribeLink, privacy: base.draft.privacyLink, why: whyLink },
      lang,
    );

    const draft = { ...base.draft, subject, body, parts, whyLink };
    return { draft, msg: buildOutreachEmail(draft, email, { lang, openVia: "e" }) };
    });
    const draft = lang !== DEFAULT_LANG ? { ...measured.value.draft, untranslated: measured.fallbacks } : measured.value.draft;
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
    const msg = measured.value.msg;
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
