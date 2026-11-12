// ADR-XXXX — the NON-OPENER FOLLOW-UP: ONE letter to a lead who never opened the outreach link,
// 14 days after its LAST outreach on ANY channel (owner, 2026-11-12: „ezt a verziót 2 hét után
// küldenénk azoknak a leadeknek akik nem nyitották meg egyáltalán a megkeresést … ha nem a duma
// hanem a képpel indulna”; „ne csak emailt nézzünk, hanem az utolsó bármilyen csatornás
// megkeresést”). The letter: src/email/nonOpenerEmail.ts, frozen plan
// assets/design-refs/console/nem-nyito-level/.
//
// Who gets it — a lead whose cold MAIL went out (the follow-up is a letter, to the address the
// cold letter went to), addressed through its LIVE prospect (newest non-archived), and:
//   · NEVER OPENED: no human view (mock_view, bots excluded) of any of its links, ever;
//   · its LATEST outreach on any channel (cold mail, SMS / MMS stamp, Viber / WhatsApp / MMS send,
//     the trial-campaign letter) is at least NONOPENER_FOLLOWUP_DAYS old.
// Who does not (each counted under its own reason in the dry run):
//   archived · test lead · disqualified / terminated · unsubscribed (any prospect row, or the
//   address / number suppressed) · ANSWERED anything (outreach_reply — owner 2026-10-26: anyone
//   who answered gets nothing more) · WITHDRAWN (a cancelled outreach_dispatch row — owner
//   10-09: a lead taken back after sending gets no new outreach) · trialing / intent / bought ·
//   opened · too recent · already got this letter · the address changed since the cold letter ·
//   another lead already holds the address · a language with an incomplete pack.
// A lead that got the trial-campaign letter IS a target (owner 2026-11-12: „kapják meg szarok most
// már rá” — overriding that letter's „Erről a próbáról több levelet nem küldünk” for this one letter);
// its campaign send still counts as the last touch.
// Every verdict is taken AGAIN right before the claim.
//
// ⛔ ONE SHOT, in code: nonopener_followup has one row per lead and one per address, claimed
// BEFORE the send; a failed send releases the claim.
// ⛔ PACE: the hourly tick (scripts/offer-followup.mts) sends at most NONOPENER_PER_TICK letters,
// at most the daily cap (app_setting nonopener_followup_daily_cap) per Budapest day, inside the
// mock-outreach window (weekday 8–17, ADR-0334) — never a burst from one mailbox.
// ⛔ The image is the letter's point: no hero shot → no letter (the lead waits for the next tick).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { getSetting } from "../console/appSettings.js";
import { ownedSiteForLead } from "../conversion/owned.js";
import { ELEK_LEAD_NAME } from "../elek/park.js";
import { recipientKey } from "../email/address.js";
import { buildNonOpenerEmail, renderNonOpenerLetter, type NonOpenerLetter } from "../email/nonOpenerEmail.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { missingPackStrings } from "../i18n/packs.js";
import { mockOutreachWindowBlocks } from "../sms/sendWindow.js";
import { normalizePhone } from "../text/phone.js";
import { buildDraftForProspect } from "./draft.js";
import { ensureHeroShot } from "./heroShot.js";
import { assessMockPhotos, photoAcksOf, photoGateBlocks } from "./mockPhotoHealth.js";
import { tagLink } from "./openVia.js";
import { checkOutreachDraft } from "./outreachCheck.js";
import { isTestLeadName } from "./ownerTestPhone.js";
import { isEmailSuppressed } from "./sendBatch.js";
import { isPhoneSuppressed } from "./sendOutreachSms.js";
import { INACTIVE, sharedContactBlocks } from "./sharedContactGate.js";
import { artifactBlocks } from "./trialCampaign.js";

/** Days after the LAST outreach (any channel) before the follow-up may go (owner: „2 hét”). */
export const NONOPENER_FOLLOWUP_DAYS = 14;
/** Letters per hourly tick — spreads the day's letters over the window. */
export const NONOPENER_PER_TICK = 5;
/** app_setting: letters per Budapest day (a non-negative integer; 0 = paused). */
export const NONOPENER_DAILY_CAP_KEY = "nonopener_followup_daily_cap";
export const NONOPENER_DAILY_CAP_DEFAULT = 40;

export type NonOpenerExclusion =
  | "archived"
  | "test"
  | "inactive"
  | "unsubscribed"
  | "replied"
  | "withdrawn"
  | "trial"
  | "intent"
  | "bought"
  | "opened"
  | "too_recent"
  | "already"
  | "address_changed"
  | "no_address"
  | "duplicate_address";

/** Operator-facing names of the exclusion reasons (CLI / log output, never lead-facing). */
export const NONOPENER_EXCLUSION_LABEL: Record<NonOpenerExclusion, string> = {
  archived: "archivált (nincs élő link)", // i18n-exempt: operátori kimenet
  test: "teszt-lead", // i18n-exempt: operátori kimenet
  inactive: "kizárt / megszűnt lead (disqualified / terminated)", // i18n-exempt: operátori kimenet
  unsubscribed: "leiratkozott (prospect vagy cím/szám szintjén)", // i18n-exempt: operátori kimenet
  replied: "válaszolt egy megkeresésre — több levelet nem kap (tulaj 2026-10-26)", // i18n-exempt: operátori kimenet
  withdrawn: "visszavont kiküldés (outreach_dispatch cancelled) — új megkeresést nem kap (tulaj 2026-10-09)", // i18n-exempt: operátori kimenet
  trial: "próbázik / próbázott", // i18n-exempt: operátori kimenet
  intent: "rendelési szándék", // i18n-exempt: operátori kimenet
  bought: "vásárolt", // i18n-exempt: operátori kimenet
  opened: "megnyitotta a linket", // i18n-exempt: operátori kimenet
  too_recent: `az utolsó megkeresése ${NONOPENER_FOLLOWUP_DAYS} napnál frissebb`, // i18n-exempt: operátori kimenet
  already: "már megkapta az utánkövető levelet", // i18n-exempt: operátori kimenet
  address_changed: "a cím a hideg levél óta változott", // i18n-exempt: operátori kimenet
  no_address: "nincs hideg levél / cím", // i18n-exempt: operátori kimenet
  duplicate_address: "ugyanerre a címre már egy másik lead kapta / célpont", // i18n-exempt: operátori kimenet
};

export interface NonOpenerCandidate {
  readonly leadId: string;
  readonly leadName: string;
  readonly prospectId: string | null;
  readonly artifactId: string | null;
  readonly address: string | null;
  readonly addressKey: string | null;
  readonly segment: string | null;
  /** The latest outreach on any channel. */
  readonly lastTouch: Date | null;
  readonly excluded: NonOpenerExclusion | null;
}

const asDate = (v: unknown): Date | null => (v ? new Date(v as string) : null);
const INACTIVE_STATUSES: readonly string[] = INACTIVE;
/** Owner 2026-10-27: no-site leads first, then outdated, then the rest. */
const SEGMENT_ORDER: Readonly<Record<string, number>> = { nincs_honlap: 0, "0_labnyom": 0, elavult: 1, van_labnyom: 2 };

/** Lead ids → the set that has the row. */
async function leadSet(q: Promise<{ lead_id: string }[]>): Promise<Set<string>> {
  return new Set((await q).map((r) => r.lead_id));
}

/**
 * Every lead the cold MAIL reached, with its verdict, in send order (eligible first by segment,
 * then the oldest last touch). `onlyLeads` narrows the set (the guard's fixtures — the dev DB is
 * shared); product code passes nothing.
 */
export async function listNonOpenerCandidates(
  opts: { readonly onlyLeads?: readonly string[]; readonly now?: Date } = {},
): Promise<NonOpenerCandidate[]> {
  const now = opts.now ?? new Date();
  let mailed = db.selectFrom("prospect").select("lead_id").distinct().where("email_sent_at", "is not", null);
  if (opts.onlyLeads) {
    if (!opts.onlyLeads.length) return [];
    mailed = mailed.where("lead_id", "in", [...opts.onlyLeads]);
  }
  const leadIds = (await mailed.execute()).map((r) => r.lead_id);
  if (!leadIds.length) return [];

  const leads = await db.selectFrom("lead").select(["id", "name", "raw", "lifecycle_status"]).where("id", "in", leadIds).execute();
  const prospects = await db
    .selectFrom("prospect")
    .select([
      "id", "lead_id", "mock_artifact_id", "contact_email", "status", "segment", "created_at", "archived_at",
      "email_sent_at", "sms_sent_at", "mms_sent_at", "unsubscribed_at",
    ])
    .where("lead_id", "in", leadIds)
    .execute();
  const byLead = new Map<string, typeof prospects>();
  for (const p of prospects) byLead.set(p.lead_id, [...(byLead.get(p.lead_id) ?? []), p]);

  const opened = await leadSet(
    db
      .selectFrom("mock_view")
      .innerJoin("prospect", "prospect.id", "mock_view.prospect_id")
      .select("prospect.lead_id as lead_id")
      .where("prospect.lead_id", "in", leadIds)
      .where((eb) => eb.or([eb("mock_view.device", "is", null), eb("mock_view.device", "!=", "bot")]))
      .distinct()
      .execute(),
  );
  const messengerLast = new Map(
    (
      await db
        .selectFrom("mms_outbox")
        .innerJoin("prospect", "prospect.id", "mms_outbox.prospect_id")
        .select(["prospect.lead_id as lead_id", sql<string>`max(mms_outbox.sent_at)`.as("last")])
        .where("prospect.lead_id", "in", leadIds)
        .where("mms_outbox.status", "=", "sent")
        .where("mms_outbox.sent_at", "is not", null)
        .groupBy("prospect.lead_id")
        .execute()
    ).map((r) => [r.lead_id, asDate(r.last)]),
  );
  const campaign = new Map(
    (
      await db.selectFrom("trial_campaign").select(["lead_id", "channel", "sent_at"]).where("lead_id", "in", leadIds).execute()
    ).map((r) => [r.lead_id, r]),
  );
  const replied = await leadSet(db.selectFrom("outreach_reply").select("lead_id").where("lead_id", "in", leadIds).execute());
  const withdrawn = await leadSet(
    db.selectFrom("outreach_dispatch").select("lead_id").where("lead_id", "in", leadIds).where("status", "=", "cancelled").execute(),
  );
  const trials = await leadSet(db.selectFrom("free_trial").select("lead_id").where("lead_id", "in", leadIds).execute());
  const submitted = await leadSet(
    db
      .selectFrom("order_intent")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .select("prospect.lead_id as lead_id")
      .where("prospect.lead_id", "in", leadIds)
      .where((eb) => eb.or([eb("order_intent.status", "=", "submitted"), eb("order_intent.submitted_at", "is not", null)]))
      .execute(),
  );
  const done = await db.selectFrom("nonopener_followup").select(["lead_id", "address_key"]).execute();
  const doneLeads = new Set(done.map((r) => r.lead_id));
  const takenKeys = new Set(done.map((r) => r.address_key));
  const cutoff = now.getTime() - NONOPENER_FOLLOWUP_DAYS * 86_400_000;

  const verdicts: NonOpenerCandidate[] = [];
  const eligible: NonOpenerCandidate[] = [];
  for (const lead of leads) {
    const rows = byLead.get(lead.id) ?? [];
    const live = rows
      .filter((p) => !p.archived_at)
      .sort((a, b) => +new Date(b.created_at as unknown as string) - +new Date(a.created_at as unknown as string))[0];
    const mailedRow = rows
      .filter((p) => p.email_sent_at)
      .sort((a, b) => +new Date(b.email_sent_at as unknown as string) - +new Date(a.email_sent_at as unknown as string))[0];
    const mailedEmail = (mailedRow?.contact_email ?? "").trim() || null;
    const liveEmail = (live?.contact_email ?? "").trim() || null;
    const touches = [
      ...rows.flatMap((p) => [p.email_sent_at, p.sms_sent_at, p.mms_sent_at]).map(asDate),
      messengerLast.get(lead.id) ?? null,
      asDate(campaign.get(lead.id)?.sent_at),
    ].filter((d): d is Date => d !== null);
    const lastTouch = touches.length ? new Date(Math.max(...touches.map((d) => d.getTime()))) : null;
    const target = {
      leadId: lead.id,
      leadName: lead.name,
      prospectId: live?.id ?? null,
      artifactId: live?.mock_artifact_id ?? null,
      address: mailedEmail,
      addressKey: mailedEmail ? recipientKey(mailedEmail) || null : null,
      segment: live?.segment ?? null,
      lastTouch,
    };
    const no = (excluded: NonOpenerExclusion): void => {
      verdicts.push({ ...target, excluded });
    };
    const rawPhone = ((lead.raw ?? {}) as { phone?: string }).phone;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;

    if (doneLeads.has(lead.id)) { no("already"); continue; }
    if (!live) { no("archived"); continue; }
    if (isTestLeadName(lead.name) || lead.name === ELEK_LEAD_NAME) { no("test"); continue; }
    if (INACTIVE_STATUSES.includes(lead.lifecycle_status)) { no("inactive"); continue; }
    if (
      rows.some((p) => p.unsubscribed_at) ||
      (mailedEmail && (await isEmailSuppressed(mailedEmail))) ||
      (liveEmail && (await isEmailSuppressed(liveEmail))) ||
      (phone && (await isPhoneSuppressed(phone)))
    ) {
      no("unsubscribed");
      continue;
    }
    if (replied.has(lead.id)) { no("replied"); continue; }
    if (withdrawn.has(lead.id)) { no("withdrawn"); continue; }
    if (trials.has(lead.id)) { no("trial"); continue; }
    if (submitted.has(lead.id) || rows.some((p) => p.status === "order_intent" || p.status === "converted")) { no("intent"); continue; }
    if (opened.has(lead.id)) { no("opened"); continue; }
    if (!lastTouch || lastTouch.getTime() > cutoff) { no("too_recent"); continue; }
    if (!mailedEmail || !target.addressKey) { no("no_address"); continue; }
    if (liveEmail && recipientKey(liveEmail) !== target.addressKey) { no("address_changed"); continue; }
    if (await ownedSiteForLead(lead.id)) { no("bought"); continue; }
    eligible.push({ ...target, excluded: null });
  }

  eligible.sort(
    (a, b) =>
      (SEGMENT_ORDER[a.segment ?? ""] ?? 3) - (SEGMENT_ORDER[b.segment ?? ""] ?? 3) ||
      (a.lastTouch?.getTime() ?? 0) - (b.lastTouch?.getTime() ?? 0) ||
      a.leadName.localeCompare(b.leadName, "hu"),
  );
  const out: NonOpenerCandidate[] = [];
  for (const e of eligible) {
    if (takenKeys.has(e.addressKey!)) {
      out.push({ ...e, excluded: "duplicate_address" });
      continue;
    }
    takenKeys.add(e.addressKey!);
    out.push(e);
  }
  return [...out, ...verdicts];
}

export type NonOpenerOutcome =
  | { readonly kind: "sent"; readonly detail: string }
  | { readonly kind: "dry-run"; readonly detail: string }
  | { readonly kind: "skipped"; readonly reason: string };

export interface NonOpenerDeps {
  /** Test seam: the guard injects a recording sender — product code passes nothing. */
  readonly mailer?: EmailSender;
  readonly now?: Date;
  /** Build + gate everything, claim and send nothing. */
  readonly dryRun?: boolean;
  /** Skip the network-bound gates (photo health); the hero shot comes from `heroShot`. */
  readonly offline?: boolean;
  /** Test seam: a ready hero shot path (the guard's fixtures have no page to shoot). */
  readonly heroShot?: string;
  /** Test seam: the send-time re-judgement reads only these leads. */
  readonly onlyLeads?: readonly string[];
  /** Test seam: the sender name (product code reads OUTREACH_FOLLOWUP_SENDER_NAME). */
  readonly senderName?: string;
}

/** The letter for one candidate: `gate` carries the plain link (what the §C judge reads, as on
 *  the cold path), `send` the same letter with the `?f` channel letter. */
export async function buildNonOpenerLetterFor(
  c: NonOpenerCandidate,
  opts: { readonly dryRun?: boolean; readonly senderName: string },
): Promise<
  | { gate: NonOpenerLetter; send: NonOpenerLetter; lang: string; market: { country: string | null; approved: boolean } }
  | { error: string }
> {
  if (!c.prospectId) return { error: "nincs élő prospect" }; // i18n-exempt: operátori kimenet
  const d = await buildDraftForProspect(c.prospectId, { reserveLabel: !opts.dryRun });
  if (!d) return { error: "a piszkozat nem állítható elő" }; // i18n-exempt: operátori kimenet
  const t = d.draft.parts;
  const input = {
    lang: d.lang,
    leadName: d.input.leadName,
    planCount: t.planCount,
    trialDays: d.input.trialDays ?? null,
    senderName: opts.senderName,
    cold: {
      priceList: t.priceList,
      priceOffer: t.priceOffer,
      percent: t.percent,
      sigCo: t.sigCo,
      sigMail: t.sigMail,
      fine: t.fine,
      unsubTxt: t.unsubTxt,
      legal: t.legal,
      identity: t.identity,
    },
  };
  const links = { unsub: d.draft.unsubscribeLink, privacy: d.draft.privacyLink };
  return {
    gate: renderNonOpenerLetter({ ...input, links: { ...links, cta: d.draft.link } }),
    send: renderNonOpenerLetter({ ...input, links: { ...links, cta: tagLink(d.draft.link, "f") } }),
    lang: d.lang,
    market: d.market,
  };
}

async function sentToday(now: Date): Promise<number> {
  const r = await sql<{ n: string }>`select count(*) as n from nonopener_followup where status = 'sent'
    and sent_at >= date_trunc('day', ${now}::timestamptz at time zone 'Europe/Budapest') at time zone 'Europe/Budapest'`.execute(db);
  return Number(r.rows[0]?.n ?? 0);
}

export async function nonOpenerDailyCap(): Promise<number> {
  const v = await getSetting(NONOPENER_DAILY_CAP_KEY);
  return v !== null && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NONOPENER_DAILY_CAP_DEFAULT;
}

/** Send (or dry-run) the follow-up to one candidate, through every gate. */
export async function sendNonOpenerFollowup(c: NonOpenerCandidate, deps: NonOpenerDeps = {}): Promise<NonOpenerOutcome> {
  if (c.excluded) return { kind: "skipped", reason: NONOPENER_EXCLUSION_LABEL[c.excluded] };
  if (!c.address || !c.addressKey) return { kind: "skipped", reason: NONOPENER_EXCLUSION_LABEL.no_address };
  const senderName = (deps.senderName ?? config.outreachFollowupSenderName).trim();
  if (!senderName) return { kind: "skipped", reason: "OUTREACH_FOLLOWUP_SENDER_NAME üres — a levél csak személynévvel mehet ki (tulaj 2026-11-12)" }; // i18n-exempt: operátori kimenet
  if (await isEmailSuppressed(c.address)) return { kind: "skipped", reason: NONOPENER_EXCLUSION_LABEL.unsubscribed };
  const shared = await sharedContactBlocks(c.leadId, "email", c.address);
  if (shared) return { kind: "skipped", reason: shared };
  // The letter opens the same mock again: an un-approved or FLAGged one must not be re-sent.
  const verdict = await artifactBlocks(c.artifactId);
  if (verdict) return { kind: "skipped", reason: verdict };

  const built = await buildNonOpenerLetterFor(c, { dryRun: deps.dryRun, senderName });
  if ("error" in built) return { kind: "skipped", reason: built.error };
  if (built.lang !== DEFAULT_LANG) {
    // A half-translated letter reads as a scam — a gap means no letter (no AI spend here).
    const missing = (await missingPackStrings(built.lang)).length;
    if (missing > 0) return { kind: "skipped", reason: `${built.lang} nyelvi csomagból ${missing} string hiányzik` }; // i18n-exempt: operátori kimenet
  }
  const gate = checkOutreachDraft(built.gate, c.leadName, built.lang, built.market);
  if (gate.verdict === "FLAG") return { kind: "skipped", reason: `§C FLAG: ${gate.reasons.join(" · ")}` }; // i18n-exempt: operátori kimenet
  if (!deps.offline && c.artifactId) {
    const health = await assessMockPhotos(c.artifactId);
    const art = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", c.artifactId).executeTakeFirst();
    if (health.verdict === "unknown" || photoGateBlocks(health, photoAcksOf(art?.inputs))) {
      return { kind: "skipped", reason: `a mock képei nem rendben (${health.verdict}) — újragenerálás után mehet` }; // i18n-exempt: operátori kimenet
    }
  }
  if (deps.dryRun) return { kind: "dry-run", detail: built.send.subject };

  const block = mockOutreachWindowBlocks(deps.now ?? new Date());
  if (block) return { kind: "skipped", reason: block };
  const hero = deps.heroShot ?? (c.artifactId ? await ensureHeroShot(c.artifactId) : null);
  if (!hero) return { kind: "skipped", reason: "nincs nyitókép — a levél a képpel indul, kép nélkül nem megy" }; // i18n-exempt: operátori kimenet
  const msg = buildNonOpenerEmail(built.send, c.address, { heroShotPath: hero, lang: built.lang });
  if (!msg.text.includes(built.send.unsubscribeLink)) return { kind: "skipped", reason: "hiányzó leiratkozó-link" }; // i18n-exempt: operátori kimenet

  // Re-judge right before the claim: an answer, an open or an unsubscribe may have landed.
  const fresh = (await listNonOpenerCandidates({ onlyLeads: deps.onlyLeads ?? [c.leadId], now: deps.now })).find(
    (x) => x.leadId === c.leadId,
  );
  if (!fresh) return { kind: "skipped", reason: "a lead közben kikerült" }; // i18n-exempt: operátori kimenet
  if (fresh.excluded) return { kind: "skipped", reason: `${NONOPENER_EXCLUSION_LABEL[fresh.excluded]} (küldéskor újramérve)` }; // i18n-exempt: operátori kimenet
  if (fresh.addressKey !== c.addressKey || fresh.prospectId !== c.prospectId) {
    return { kind: "skipped", reason: "a célpont közben változott — a következő futás újraméri" }; // i18n-exempt: operátori kimenet
  }
  // ON CONFLICT DO NOTHING without a target covers BOTH unique keys: the lead's and the address's.
  const claim = await db
    .insertInto("nonopener_followup")
    .values({ lead_id: c.leadId, prospect_id: c.prospectId, address_key: c.addressKey, status: "claimed" })
    .onConflict((oc) => oc.doNothing())
    .returning("id")
    .executeTakeFirst();
  if (!claim) return { kind: "skipped", reason: NONOPENER_EXCLUSION_LABEL.already };
  try {
    const r = await (deps.mailer ?? getEmailSender()).send(msg);
    await db
      .updateTable("nonopener_followup")
      .set({ status: "sent", sent_at: new Date(), note: `${r.provider}:${r.id}` })
      .where("id", "=", claim.id)
      .execute();
    return { kind: "sent", detail: `${r.provider} ${c.address}` };
  } catch (e) {
    await db.deleteFrom("nonopener_followup").where("id", "=", claim.id).where("status", "=", "claimed").execute();
    return { kind: "skipped", reason: `küldési hiba (a foglalás feloldva, újrapróbálható): ${(e as Error).message}` }; // i18n-exempt: operátori kimenet
  }
}

export interface NonOpenerTickResult {
  readonly sent: number;
  readonly skipped: number;
  readonly eligible: number;
  readonly deferred?: string;
  readonly reasons?: readonly string[];
}

/**
 * One hourly tick: at most NONOPENER_PER_TICK letters, never over the daily cap, only inside the
 * mock-outreach window. A skipped lead does not use up a slot — the tick walks on (bounded).
 */
export async function runNonOpenerFollowups(now: Date = new Date(), deps: NonOpenerDeps = {}): Promise<NonOpenerTickResult> {
  const block = mockOutreachWindowBlocks(now);
  if (block) return { sent: 0, skipped: 0, eligible: 0, deferred: block };
  const cap = await nonOpenerDailyCap();
  const room = Math.min(NONOPENER_PER_TICK, cap - (await sentToday(now)));
  if (room <= 0) return { sent: 0, skipped: 0, eligible: 0, deferred: `napi keret (${cap}) elérve` }; // i18n-exempt: operátori kimenet
  const list = (await listNonOpenerCandidates({ onlyLeads: deps.onlyLeads, now })).filter((c) => !c.excluded);
  let sent = 0;
  let skipped = 0;
  const reasons: string[] = [];
  // Bounded walk: a lead skipped for a page problem must not stall the tick, nor make it crawl the whole list.
  for (const c of list.slice(0, room * 4)) {
    if (sent >= room) break;
    const r = await sendNonOpenerFollowup(c, { ...deps, now });
    if (r.kind === "sent") sent++;
    else {
      skipped++;
      reasons.push(`${c.leadName}: ${r.kind === "skipped" ? r.reason : r.detail}`);
    }
  }
  return { sent, skipped, eligible: list.length, ...(reasons.length ? { reasons } : {}) };
}
