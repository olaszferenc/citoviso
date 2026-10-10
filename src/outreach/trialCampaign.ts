// ADR-0348 — the RETROACTIVE trial campaign: one "{name}: 14 napig ingyen, élesben" letter (or,
// for the mobile-only leads, its accent-free SMS) to every lead that ALREADY received the cold
// outreach, sent once, after the big deploy, on the owner's separate "mehet".
//
// Who gets it (owner, 2026-10-09):
//   · a lead whose cold outreach actually went out (some prospect has email_sent_at or
//     sms_sent_at), addressed through its LIVE prospect (the newest non-archived one);
//   · the channel is the one the cold outreach used: mail if a cold MAIL went out (and an
//     address is known), else SMS if a cold SMS went out to a Hungarian mobile;
//   · a rejecting reply is NOT an unsubscribe — those leads get the letter.
// Who does not (each counted under its own reason in the dry run):
//   archived (no live prospect) · test lead · disqualified / terminated lead · unsubscribed
//   (any prospect row, or the address / number suppressed at person level) · bought
//   (ownedSiteForLead) · trialing (a free_trial row) · order intent (status
//   order_intent|converted, or a submitted order) · operator exclusion (`--kizar`, a
//   'excluded' trial_campaign row — e.g. a conversation handled by hand) · already got the
//   campaign · a stuck claim (`--felold`) · the mail address changed since the cold letter ·
//   no usable channel · a second lead of the same PERSON (mail address or mobile).
// Every verdict is taken AGAIN right before the claim (a run takes hours).
//
// ⛔ ONE SHOT, in code: trial_campaign has one row per lead and one per (channel, address),
// claimed BEFORE the send; a failed send releases the claim. The escalation follow-up reads
// trialCampaignReached() and stays silent afterwards — the footer promises "Erről a próbáról
// több levelet nem küldünk".
//
// ⛔ NO REAL SEND without the runner's explicit `--go`; the mock-outreach window (weekday
// 9–16 Budapest, ADR-0334) applies to both channels.

import { db } from "../db/client.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { recipientKey } from "../email/address.js";
import {
  buildTrialCampaignEmail,
  buildTrialCampaignSmsText,
  renderTrialCampaignLetter,
  type TrialCampaignLetter,
} from "../email/trialCampaignEmail.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { plannedSiteSlug } from "../conversion/provision.js";
import { ownedSiteForLead } from "../conversion/owned.js";
import { ELEK_LEAD_NAME } from "../elek/park.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { missingPackStrings } from "../i18n/packs.js";
import { getCouponConfig } from "../payment/couponConfig.js";
import { sendSms, type SmsMessage, type SmsSendResult } from "../sms/sender.js";
import { mockOutreachWindowBlocks } from "../sms/sendWindow.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { isHuMobileE164, normalizePhone } from "../text/phone.js";
import { getFreeTrialConfig } from "../trial/config.js";
import { TRIAL_RETENTION_DAYS } from "../trial/retention.js";
import { advertiserIdentity, buildDraftForProspect, senderParts } from "./draft.js";
import { ensureHeroShot } from "./heroShot.js";
import { assessMockPhotos, photoAcksOf, photoGateBlocks } from "./mockPhotoHealth.js";
import { checkOutreachDraft, checkOutreachSms } from "./outreachCheck.js";
import { isTestLeadName } from "./ownerTestPhone.js";
import { isEmailSuppressed } from "./sendBatch.js";
import { isPhoneSuppressed, mobileOutreachGates } from "./sendOutreachSms.js";
import { INACTIVE, sharedContactBlocks } from "./sharedContactGate.js";

export type TrialCampaignChannel = "email" | "sms";

/** Why a contacted lead is NOT a target — the dry run counts each. */
export type TrialCampaignExclusion =
  | "archived"
  | "test"
  | "inactive"
  | "unsubscribed"
  | "bought"
  | "trial"
  | "intent"
  | "operator"
  | "already"
  | "stuck"
  | "address_changed"
  | "no_channel"
  | "duplicate_address";

/** Operator-facing names of the exclusion reasons (CLI output, never lead-facing). */
export const EXCLUSION_LABEL: Record<TrialCampaignExclusion, string> = {
  archived: "archivált (nincs élő link)", // i18n-exempt: operátori CLI-kimenet
  test: "teszt-lead", // i18n-exempt: operátori CLI-kimenet
  inactive: "kizárt / megszűnt lead (disqualified / terminated)", // i18n-exempt: operátori CLI-kimenet
  unsubscribed: "leiratkozott (prospect vagy cím/szám szintjén)", // i18n-exempt: operátori CLI-kimenet
  bought: "vásárolt (tenant vagy fizetett rendelés)", // i18n-exempt: operátori CLI-kimenet
  trial: "próbázik / próbázott", // i18n-exempt: operátori CLI-kimenet
  intent: "rendelési szándék (order_intent / converted / leadott rendelés)", // i18n-exempt: operátori CLI-kimenet
  operator: "operátori kizárás (--kizar)", // i18n-exempt: operátori CLI-kimenet
  already: "már megkapta a kampányt", // i18n-exempt: operátori CLI-kimenet
  stuck: "beragadt foglalás: lefoglalva, de nem igazoltan kiment — ellenőrzés után: --felold <id>", // i18n-exempt: operátori CLI-kimenet
  address_changed: "a cím a hideg levél óta változott (az új címre hideg levél nem ment)", // i18n-exempt: operátori CLI-kimenet
  no_channel: "nincs használható csatorna (cím / magyar mobil)", // i18n-exempt: operátori CLI-kimenet
  duplicate_address: "ugyanez a személy (cím vagy szám) már egy másik lead célpontja / kapta / kizárva", // i18n-exempt: operátori CLI-kimenet
};

/** A `claimed` row older than this, still without sent_at, is a run that died mid-send (IT D-3a). */
export const STUCK_CLAIM_MS = 30 * 60_000;

export interface TrialCampaignCandidate {
  readonly leadId: string;
  readonly leadName: string;
  /** The LIVE prospect (newest non-archived); null when every link is archived. */
  readonly prospectId: string | null;
  readonly artifactId: string | null;
  readonly channel: TrialCampaignChannel | null;
  /** The mail address (email) or the E.164 number (sms). */
  readonly address: string | null;
  /** recipientKey(email) / E.164 — the one-shot key. */
  readonly addressKey: string | null;
  /** When the cold outreach went out on this channel. */
  readonly sentAt: Date | null;
  readonly excluded: TrialCampaignExclusion | null;
  /** The operator's exclusion reason, when there is one. */
  readonly note?: string | null;
  /** The trial_campaign row of a stuck claim (`--felold <id>`). */
  readonly campaignRowId?: string | null;
}

interface ProspectRow {
  id: string;
  lead_id: string;
  token: string;
  mock_artifact_id: string | null;
  contact_email: string | null;
  status: string;
  created_at: unknown;
  archived_at: unknown;
  email_sent_at: unknown;
  sms_sent_at: unknown;
  unsubscribed_at: unknown;
}

const asDate = (v: unknown): Date | null => (v ? new Date(v as string) : null);
const isTestLead = (name: string): boolean => isTestLeadName(name) || name === ELEK_LEAD_NAME;
const INACTIVE_STATUSES: readonly string[] = INACTIVE;

/**
 * Every lead the cold outreach reached, with its verdict. `onlyLeads` narrows the set (the
 * guard's own fixtures — the dev DB is shared); product code passes nothing.
 *
 * ONE SHOT PER PERSON (IT D-1g/D-1h/D-1x): a lead's person keys are every address it is
 * known by here — the mail address(es) and the Hungarian mobile. A lead that already got
 * the campaign, is mid-send, or was excluded by the operator holds ALL its person keys; a
 * mail target holds its mobile too, so a twin lead on that number gets no SMS. Mail targets
 * are allocated before SMS ones (the letter is the fuller message).
 */
export async function listTrialCampaignCandidates(
  opts: { readonly onlyLeads?: readonly string[]; readonly now?: Date } = {},
): Promise<TrialCampaignCandidate[]> {
  let contacted = db
    .selectFrom("prospect")
    .select("lead_id")
    .distinct()
    .where((eb) => eb.or([eb("email_sent_at", "is not", null), eb("sms_sent_at", "is not", null)]));
  if (opts.onlyLeads) {
    if (!opts.onlyLeads.length) return [];
    contacted = contacted.where("lead_id", "in", [...opts.onlyLeads]);
  }
  const leadIds = (await contacted.execute()).map((r) => r.lead_id);
  if (!leadIds.length) return [];

  const leads = await db
    .selectFrom("lead")
    .select(["id", "name", "raw", "lifecycle_status"])
    .where("id", "in", leadIds)
    .execute();
  const prospects = (await db
    .selectFrom("prospect")
    .select([
      "id", "lead_id", "token", "mock_artifact_id", "contact_email", "status", "created_at",
      "archived_at", "email_sent_at", "sms_sent_at", "unsubscribed_at",
    ])
    .where("lead_id", "in", leadIds)
    .execute()) as ProspectRow[];
  const byLead = new Map<string, ProspectRow[]>();
  for (const p of prospects) byLead.set(p.lead_id, [...(byLead.get(p.lead_id) ?? []), p]);

  const trials = new Set(
    (await db.selectFrom("free_trial").select("lead_id").where("lead_id", "in", leadIds).execute()).map((r) => r.lead_id),
  );
  const submitted = new Set(
    (
      await db
        .selectFrom("order_intent")
        .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
        .select("prospect.lead_id as leadId")
        .where("prospect.lead_id", "in", leadIds)
        .where((eb) => eb.or([eb("order_intent.status", "=", "submitted"), eb("order_intent.submitted_at", "is not", null)]))
        .execute()
    ).map((r) => r.leadId),
  );
  const campaign = new Map(
    (
      await db
        .selectFrom("trial_campaign")
        .select(["id", "lead_id", "channel", "status", "address_key", "note", "created_at", "sent_at"])
        .where("lead_id", "in", leadIds)
        .execute()
    ).map((r) => [r.lead_id, r]),
  );
  const nowMs = (opts.now ?? new Date()).getTime();

  const verdicts = new Map<string, TrialCampaignCandidate>();
  const takenKeys = new Set<string>();
  const eligible: { readonly target: Omit<TrialCampaignCandidate, "excluded">; readonly keys: readonly string[] }[] = [];
  // Stable order: by lead name, so a re-run walks the same list.
  const sorted = [...leads].sort((a, b) => a.name.localeCompare(b.name, "hu"));
  for (const lead of sorted) {
    const rows = byLead.get(lead.id) ?? [];
    const live = rows
      .filter((p) => !p.archived_at)
      .sort((a, b) => +new Date(b.created_at as string) - +new Date(a.created_at as string))[0];
    const base = { leadId: lead.id, leadName: lead.name, prospectId: live?.id ?? null, artifactId: live?.mock_artifact_id ?? null };

    // The channel the cold outreach used: mail first (the letter), else the SMS.
    const mailed = rows
      .filter((p) => p.email_sent_at)
      .sort((a, b) => +new Date(b.email_sent_at as string) - +new Date(a.email_sent_at as string))[0];
    const texted = rows
      .filter((p) => p.sms_sent_at)
      .sort((a, b) => +new Date(b.sms_sent_at as string) - +new Date(a.sms_sent_at as string))[0];
    // IT D-1f: the letter says "we sent you a plan on <date>" — so it goes to the address
    // the cold letter went to, never to one added since (which never got a cold letter).
    const mailedEmail = (mailed?.contact_email ?? "").trim() || null;
    const liveEmail = (live?.contact_email ?? "").trim() || null;
    const addressChanged = Boolean(mailedEmail && liveEmail && recipientKey(mailedEmail) !== recipientKey(liveEmail));
    const rawPhone = ((lead.raw ?? {}) as { phone?: string }).phone;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const mobile = phone && isHuMobileE164(phone) ? phone : null;
    let channel: TrialCampaignChannel | null = null;
    let address: string | null = null;
    let addressKey: string | null = null;
    let sentAt: Date | null = null;
    if (mailed && mailedEmail) {
      channel = "email";
      address = mailedEmail;
      addressKey = recipientKey(mailedEmail) || null;
      sentAt = asDate(mailed.email_sent_at);
    } else if (texted && mobile) {
      channel = "sms";
      address = mobile;
      addressKey = mobile;
      sentAt = asDate(texted.sms_sent_at);
    }
    // Every address this person is known by here — the one-shot is per PERSON.
    const keys = [
      ...new Set(
        [
          ...[mailedEmail, liveEmail].filter((e): e is string => !!e).map((e) => recipientKey(e)).filter(Boolean).map((k) => `email:${k}`),
          ...(mobile ? [`sms:${mobile}`] : []),
        ],
      ),
    ];
    const target = { ...base, channel, address, addressKey, sentAt };
    const no = (excluded: TrialCampaignExclusion, extra: { note?: string | null; campaignRowId?: string | null } = {}): void => {
      verdicts.set(lead.id, { ...target, excluded, note: extra.note ?? null, campaignRowId: extra.campaignRowId ?? null });
    };
    const hold = (): void => {
      for (const k of keys) takenKeys.add(k);
    };

    const row = campaign.get(lead.id);
    if (row) {
      hold();
      if (row.address_key) takenKeys.add(`${row.channel}:${row.address_key}`);
      if (row.channel === "excluded") no("operator", { note: row.note });
      else if (row.status === "claimed" && !row.sent_at && nowMs - +new Date(row.created_at as unknown as string) > STUCK_CLAIM_MS) {
        no("stuck", { campaignRowId: row.id });
      } else no("already");
      continue;
    }
    if (!live) { no("archived"); continue; }
    if (isTestLead(lead.name)) { no("test"); continue; }
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
    if (await ownedSiteForLead(lead.id)) { no("bought"); continue; }
    if (trials.has(lead.id)) { no("trial"); continue; }
    if (submitted.has(lead.id) || rows.some((p) => p.status === "order_intent" || p.status === "converted")) {
      no("intent");
      continue;
    }
    if (channel === "email" && addressChanged) { no("address_changed"); continue; }
    if (!channel || !addressKey) { no("no_channel"); continue; }
    eligible.push({ target, keys });
  }

  // Allocation: mail targets first, then SMS — each in name order.
  for (const ch of ["email", "sms"] as const) {
    for (const e of eligible.filter((x) => x.target.channel === ch)) {
      const own = `${ch}:${e.target.addressKey}`;
      if (takenKeys.has(own) || e.keys.some((k) => takenKeys.has(k))) {
        verdicts.set(e.target.leadId, { ...e.target, excluded: "duplicate_address", note: null });
        continue;
      }
      takenKeys.add(own);
      for (const k of e.keys) takenKeys.add(k);
      verdicts.set(e.target.leadId, { ...e.target, excluded: null });
    }
  }
  return sorted.flatMap((l) => verdicts.get(l.id) ?? []);
}

/** Did this lead (or this mail address) get the campaign mail or SMS? (follow-up gate) */
export async function trialCampaignReached(leadId: string, email: string | null): Promise<boolean> {
  const key = email ? recipientKey(email) : "";
  const hit = await db
    .selectFrom("trial_campaign")
    .select("id")
    .where("channel", "in", ["email", "sms"])
    .where((eb) =>
      key
        ? eb.or([eb("lead_id", "=", leadId), eb.and([eb("channel", "=", "email"), eb("address_key", "=", key)])])
        : eb("lead_id", "=", leadId),
    )
    .limit(1)
    .executeTakeFirst();
  return Boolean(hit);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Operator exclusion (`--kizar <prospectId|leadId> --ok "<reason>"`): a persistent row that
 * keeps the lead out of every later run — a conversation handled by hand, for instance.
 * Never by name: the id is what the operator looked up.
 */
export async function excludeFromTrialCampaign(
  id: string,
  reason: string,
): Promise<{ ok: true; leadId: string; leadName: string } | { ok: false; message: string }> {
  const why = reason.trim();
  if (why.length < 3) return { ok: false, message: "a kizárás oka kötelező (--ok \"…\", legalább 3 karakter)" }; // i18n-exempt: operátori CLI-kimenet
  if (!UUID_RE.test(id)) return { ok: false, message: `nem azonosító: ${id}` }; // i18n-exempt: operátori CLI-kimenet
  const viaProspect = await db.selectFrom("prospect").select("lead_id").where("id", "=", id).executeTakeFirst();
  const leadId = viaProspect?.lead_id ?? id;
  const lead = await db.selectFrom("lead").select(["id", "name"]).where("id", "=", leadId).executeTakeFirst();
  if (!lead) return { ok: false, message: `nincs ilyen prospect vagy lead: ${id}` }; // i18n-exempt: operátori CLI-kimenet
  const live = await db
    .selectFrom("prospect")
    .select("id")
    .where("lead_id", "=", lead.id)
    .where("archived_at", "is", null)
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  const r = await db
    .insertInto("trial_campaign")
    .values({ lead_id: lead.id, prospect_id: live?.id ?? null, channel: "excluded", status: "excluded", note: why })
    .onConflict((oc) => oc.column("lead_id").doNothing())
    .returning("id")
    .executeTakeFirst();
  if (!r) return { ok: false, message: `${lead.name}: már van kampány-sora (kiküldve vagy kizárva) — nem írom felül` }; // i18n-exempt: operátori CLI-kimenet
  return { ok: true, leadId: lead.id, leadName: lead.name };
}

/**
 * Release a STUCK claim (`--felold <rowId|leadId> --ok "<reason>"`, IT D-3a): a run died
 * between the claim and the send, so the row says "taken" though nothing may have gone out.
 * Only a `claimed` row without sent_at, older than STUCK_CLAIM_MS (a live run's fresh claim
 * is not touched). The operator checks the outbox / modem log first — the reason is logged.
 * Releasing also lifts the escalation follow-up's silence (trialCampaignReached).
 */
export async function releaseStuckTrialCampaignClaim(
  id: string,
  reason: string,
  now: Date = new Date(),
): Promise<{ ok: true; leadId: string; leadName: string } | { ok: false; message: string }> {
  if (reason.trim().length < 3) return { ok: false, message: "a feloldás oka kötelező (--ok \"…\", pl. „a postafiókban/modem-naplóban nincs nyoma”)" }; // i18n-exempt: operátori CLI-kimenet
  if (!UUID_RE.test(id)) return { ok: false, message: `nem azonosító: ${id}` }; // i18n-exempt: operátori CLI-kimenet
  const r = await db
    .deleteFrom("trial_campaign")
    .where((eb) => eb.or([eb("id", "=", id), eb("lead_id", "=", id)]))
    .where("status", "=", "claimed")
    .where("sent_at", "is", null)
    .where("created_at", "<", new Date(now.getTime() - STUCK_CLAIM_MS) as never)
    .returning("lead_id")
    .executeTakeFirst();
  if (!r) return { ok: false, message: `nincs ${Math.round(STUCK_CLAIM_MS / 60_000)} percnél régebbi, beragadt (claimed, nem kiment) foglalás ezzel az azonosítóval: ${id}` }; // i18n-exempt: operátori CLI-kimenet
  const lead = await db.selectFrom("lead").select("name").where("id", "=", r.lead_id).executeTakeFirst();
  return { ok: true, leadId: r.lead_id, leadName: lead?.name ?? r.lead_id };
}

/** CLAIM the one shot BEFORE the send. null = the lead or the address already has a row. */
async function claim(c: TrialCampaignCandidate): Promise<string | null> {
  // ON CONFLICT DO NOTHING without a target covers BOTH unique keys: the lead's and the address's.
  const r = await db
    .insertInto("trial_campaign")
    .values({
      lead_id: c.leadId,
      prospect_id: c.prospectId,
      channel: c.channel!,
      address_key: c.addressKey!,
      status: "claimed",
    })
    .onConflict((oc) => oc.doNothing())
    .returning("id")
    .executeTakeFirst();
  return r?.id ?? null;
}

async function release(id: string): Promise<void> {
  await db.deleteFrom("trial_campaign").where("id", "=", id).where("status", "=", "claimed").execute();
}

async function markSent(id: string, note: string | null): Promise<void> {
  await db.updateTable("trial_campaign").set({ status: "sent", sent_at: new Date(), note }).where("id", "=", id).execute();
}

/** The numbers the letter quotes, each from its one source. */
export async function trialCampaignNumbers(): Promise<{
  days: number;
  retentionDays: number;
  coupon: { percent: number; days: number } | null;
}> {
  const trial = await getFreeTrialConfig();
  const coupon = await getCouponConfig();
  return {
    days: trial.days,
    retentionDays: TRIAL_RETENTION_DAYS,
    coupon: coupon.percent > 0 ? { percent: coupon.percent, days: coupon.days } : null,
  };
}

/** The trial site's promised host (ADR-0347 ④: the same rule the provisioning runs). */
export async function trialCampaignHost(leadId: string): Promise<string | null> {
  const slug = await plannedSiteSlug(leadId);
  return slug ? `${slug}.${PLATFORM_DOMAIN}` : null;
}

export type TrialCampaignOutcome =
  | { readonly kind: "sent"; readonly detail: string }
  | { readonly kind: "dry-run"; readonly detail: string }
  | { readonly kind: "skipped"; readonly reason: string };

export interface TrialCampaignDeps {
  /** Test seam: the guard injects a recording sender — product code passes nothing. */
  readonly mailer?: EmailSender;
  readonly sms?: (msg: SmsMessage) => Promise<SmsSendResult>;
  /** The clock the window is judged on. */
  readonly now?: Date;
  /** Build + gate everything, claim and send nothing. */
  readonly dryRun?: boolean;
  /** Skip the network-bound gates (hero shot, photo health) — the guard's fixtures have no page. */
  readonly offline?: boolean;
  /** Test seam: the send-time re-judgement reads only these leads (the guard's fixtures). */
  readonly onlyLeads?: readonly string[];
}

/**
 * IT D-1i: the runner reads the list ONCE and a run takes hours (20 s per letter, ≥ 90 s per
 * SMS). Right before the claim the lead is judged AGAIN, by the same rules as the list: a
 * trial started, an order placed, an archive, a disqualification, a twin that got it since —
 * each stops the send. null = still a target, on the same channel and address.
 */
async function rejudge(c: TrialCampaignCandidate, deps: TrialCampaignDeps): Promise<string | null> {
  const fresh = (await listTrialCampaignCandidates({ onlyLeads: deps.onlyLeads, now: deps.now })).find((x) => x.leadId === c.leadId);
  if (!fresh) return "a lead közben kikerült a megkeresettek közül"; // i18n-exempt: operátori CLI-kimenet
  if (fresh.excluded) return `${EXCLUSION_LABEL[fresh.excluded]} (küldéskor újramérve)`; // i18n-exempt: operátori CLI-kimenet
  if (fresh.channel !== c.channel || fresh.addressKey !== c.addressKey || fresh.prospectId !== c.prospectId) {
    return "a célpont közben változott (csatorna, cím vagy link) — a következő futás újraméri"; // i18n-exempt: operátori CLI-kimenet
  }
  return null;
}

/** Build the letter for one candidate (no DB writes beyond the draft's preview label — and
 *  none at all with `dryRun`, IT D-8k). */
export async function buildTrialCampaignLetterFor(
  c: TrialCampaignCandidate,
  opts: { readonly dryRun?: boolean } = {},
): Promise<{ letter: TrialCampaignLetter; lang: string; market: { country: string | null; approved: boolean } } | { error: string }> {
  if (!c.prospectId || !c.sentAt) return { error: "nincs élő prospect vagy küldési dátum" }; // i18n-exempt: operátori CLI-kimenet
  const d = await buildDraftForProspect(c.prospectId, { reserveLabel: !opts.dryRun });
  if (!d) return { error: "a piszkozat nem állítható elő" }; // i18n-exempt: operátori CLI-kimenet
  const host = await trialCampaignHost(c.leadId);
  if (!host) return { error: "a próba-aldomain nem határozható meg" }; // i18n-exempt: operátori CLI-kimenet
  const n = await trialCampaignNumbers();
  const letter = renderTrialCampaignLetter({
    lang: d.lang,
    leadName: d.input.leadName,
    sentIso: budapestIsoDay(c.sentAt),
    days: n.days,
    host,
    retentionDays: n.retentionDays,
    coupon: n.coupon,
    sender: senderParts(),
    identity: advertiserIdentity(d.lang),
    links: { cta: d.draft.link, unsub: d.draft.unsubscribeLink, privacy: d.draft.privacyLink },
  });
  return { letter, lang: d.lang, market: d.market };
}

/** Send (or dry-run) the campaign MAIL to one candidate, through every gate. */
export async function sendTrialCampaignMail(c: TrialCampaignCandidate, deps: TrialCampaignDeps = {}): Promise<TrialCampaignOutcome> {
  if (c.excluded) return { kind: "skipped", reason: EXCLUSION_LABEL[c.excluded] };
  if (c.channel !== "email" || !c.address || !c.addressKey) return { kind: "skipped", reason: "nem e-mailes célpont" }; // i18n-exempt: operátori CLI-kimenet
  // Re-judge at send time: an unsubscribe may have landed since the list was read.
  if (await isEmailSuppressed(c.address)) return { kind: "skipped", reason: EXCLUSION_LABEL.unsubscribed };
  const shared = await sharedContactBlocks(c.leadId, "email", c.address);
  if (shared) return { kind: "skipped", reason: shared };

  const built = await buildTrialCampaignLetterFor(c, { dryRun: deps.dryRun });
  if ("error" in built) return { kind: "skipped", reason: built.error };
  const { letter, lang, market } = built;
  if (lang !== DEFAULT_LANG) {
    // Measured, never provisioned (no AI spend from a campaign run): a half-translated
    // letter reads as a scam, so a gap means no letter.
    const missing = (await missingPackStrings(lang)).length;
    if (missing > 0) return { kind: "skipped", reason: `${lang} nyelvi csomagból ${missing} string hiányzik` }; // i18n-exempt: operátori CLI-kimenet
  }
  // §C gate on the text that goes out — the cold letter's own judge (CheckableLetter).
  const gate = checkOutreachDraft(letter, c.leadName, lang, market);
  if (gate.verdict === "FLAG") return { kind: "skipped", reason: `§C FLAG: ${gate.reasons.join(" · ")}` }; // i18n-exempt: operátori CLI-kimenet

  // The link opens the mock again — a page that lost its photos since must not be re-sent.
  if (!deps.offline && c.artifactId) {
    const health = await assessMockPhotos(c.artifactId);
    const art = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", c.artifactId).executeTakeFirst();
    if (health.verdict === "unknown" || photoGateBlocks(health, photoAcksOf(art?.inputs))) {
      return { kind: "skipped", reason: `a mock képei nem rendben (${health.verdict}) — újragenerálás után mehet` }; // i18n-exempt: operátori CLI-kimenet
    }
  }
  if (deps.dryRun) return { kind: "dry-run", detail: letter.subject };

  const block = mockOutreachWindowBlocks(deps.now ?? new Date());
  if (block) return { kind: "skipped", reason: block };

  const heroShotPath = !deps.offline && c.artifactId ? await ensureHeroShot(c.artifactId) : null;
  const msg = buildTrialCampaignEmail(letter, c.address, { heroShotPath, lang });
  if (!msg.text.includes(letter.unsubscribeLink)) return { kind: "skipped", reason: "hiányzó leiratkozó-link" }; // i18n-exempt: operátori CLI-kimenet

  const changed = await rejudge(c, deps);
  if (changed) return { kind: "skipped", reason: changed };
  const claimId = await claim(c);
  if (!claimId) return { kind: "skipped", reason: EXCLUSION_LABEL.already };
  try {
    const r = await (deps.mailer ?? getEmailSender()).send(msg);
    await markSent(claimId, `${r.provider}:${r.id}`);
    return { kind: "sent", detail: `${r.provider} ${c.address}` };
  } catch (e) {
    await release(claimId);
    return { kind: "skipped", reason: `küldési hiba (a foglalás feloldva, újrapróbálható): ${(e as Error).message}` }; // i18n-exempt: operátori CLI-kimenet
  }
}

/** Send (or dry-run) the campaign SMS to one candidate, through the cold SMS's gate chain. */
export async function sendTrialCampaignSms(c: TrialCampaignCandidate, deps: TrialCampaignDeps = {}): Promise<TrialCampaignOutcome> {
  if (c.excluded) return { kind: "skipped", reason: EXCLUSION_LABEL[c.excluded] };
  if (c.channel !== "sms" || !c.address || !c.addressKey || !c.prospectId || !c.sentAt) {
    return { kind: "skipped", reason: "nem SMS-es célpont" }; // i18n-exempt: operátori CLI-kimenet
  }
  // The cold SMS's shared chain (opt-out, curator sign-off, language, verdicts, photo health,
  // number, person-level suppression, shared contact, allowlist, 8–20 window) — ONE copy.
  // Offline (the guard) it is replaced by the person-level checks that need no network.
  let link: string;
  let lang: string;
  let market: { country: string | null; approved: boolean };
  let unsubscribeLink: string;
  if (deps.offline) {
    if (await isPhoneSuppressed(c.address)) return { kind: "skipped", reason: EXCLUSION_LABEL.unsubscribed };
    const d = await buildDraftForProspect(c.prospectId, { reserveLabel: !deps.dryRun });
    if (!d) return { kind: "skipped", reason: "a piszkozat nem állítható elő" }; // i18n-exempt: operátori CLI-kimenet
    ({ lang, market } = d);
    link = d.sms.link;
    unsubscribeLink = d.sms.unsubscribeLink;
  } else {
    const g = await mobileOutreachGates(c.prospectId);
    if (!g.ok) return { kind: "skipped", reason: g.message };
    if (g.to !== c.address) return { kind: "skipped", reason: `a lead száma közben változott (${g.to})` }; // i18n-exempt: operátori CLI-kimenet
    ({ lang, market } = g.d);
    link = g.d.sms.link;
    unsubscribeLink = g.d.sms.unsubscribeLink;
  }
  const n = await trialCampaignNumbers();
  const sms = buildTrialCampaignSmsText({ lang, leadName: c.leadName, sentIso: budapestIsoDay(c.sentAt), days: n.days, link });
  // §C on the text that goes out. The name is checked in its GSM-7 form — the form the
  // message actually carries (the accented original is, by design, not in it).
  const gate = checkOutreachSms({ text: sms.text, link, unsubscribeLink }, sms.name, lang, market);
  if (gate.verdict === "FLAG") return { kind: "skipped", reason: `§C FLAG: ${gate.reasons.join(" · ")}` }; // i18n-exempt: operátori CLI-kimenet
  if (deps.dryRun) return { kind: "dry-run", detail: sms.text };

  const block = mockOutreachWindowBlocks(deps.now ?? new Date());
  if (block) return { kind: "skipped", reason: block };

  const changed = await rejudge(c, deps);
  if (changed) return { kind: "skipped", reason: changed };
  const claimId = await claim(c);
  if (!claimId) return { kind: "skipped", reason: EXCLUSION_LABEL.already };
  const r = await (deps.sms ?? sendSms)({ to: c.address, text: sms.text });
  if (r.provider === "blocked") {
    await release(claimId);
    return { kind: "skipped", reason: "az SMS nem ment ki (modem/relay hiba) — a foglalás feloldva, újrapróbálható" }; // i18n-exempt: operátori CLI-kimenet
  }
  await markSent(claimId, `${r.provider}:${r.id}`);
  return { kind: "sent", detail: `${r.provider} ${c.address}` };
}

/** One candidate, whichever channel it has. */
export function sendTrialCampaign(c: TrialCampaignCandidate, deps: TrialCampaignDeps = {}): Promise<TrialCampaignOutcome> {
  return c.channel === "sms" ? sendTrialCampaignSms(c, deps) : sendTrialCampaignMail(c, deps);
}
