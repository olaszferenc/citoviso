// ADR-XXXX — the BEHAVIOUR MESSAGE (variant A, owner 2026-11-11): ONE automatic message per lead,
// ever, sent when the lead acts on their plan page. Frozen plan: assets/design-refs/console/viselkedes-uzenet/
// (README = what BINDS). Runner: scripts/behavior-message.mts (citoviso-behavior-message.timer, every 10 min).
//
// TRIGGERS (only events AFTER the master switch was turned on — no retroactive sweep: the
// 2026-10-26 mass second letter brought 6 opt-outs and 0 trials):
//   return — the lead opens the plan again (a visit with an earlier visit before it);
//   price  — the lead opens the „Árak és rendelés” panel (mock_event 'panel_open');
//   start  — the lead presses the free-trial button (mock_event 'trial_open', not one our own
//            #inditas link opened) and does not send the form (no free_trial row — that excludes anyway).
// The message answers the STRONGEST step that happened (start > price > return), with the link to
// the matching part of the page (kerdes-inditas anchors: #kerdes · ?k=ar#ar · #inditas).
//
// TIMING: 20 minutes after the lead's LAST activity on the page (a new visit postpones it — never
// while they are reading), on weekdays 08:00–20:00 Budapest (behaviorWindowBlocks). Outside the
// window it goes at the first run inside it; a trigger older than BEHAVIOR_MAX_AGE_MS is dropped
// (an outage or a long holiday must not produce a message about a visit the lead has forgotten).
//
// CHANNEL: SMS when the cold outreach reached the lead's Hungarian mobile (SMS / MMS pair), else
// the e-mail when the cold letter went out. ONE message per PERSON: (channel, address) is unique.
//
// NEVER (each re-checked right before the claim): unsubscribed (any link, or the address / number
// at person level) · „ne keressük” (lead.contact_block_at, ADR-0421) · replied to any message (the
// reply goes to the owner's approval queue; automatic answers are NOT enabled) · trialing / tried ·
// bought · order intent · disqualified / terminated · test lead · archived (no live link) · a shared
// mobile or address another lead already used (ADR-0353) · un-approved or FLAGged mock (the mobile
// gate chain / artifactBlocks).
//
// ⛔ The master switch is OFF by default (app_setting 'behavior_message'): a deploy installs the timer,
// but nothing goes out until the owner turns it on in the console (CRM → Viselkedés-üzenetek).

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { getSetting, setSetting } from "../console/appSettings.js";
import { recipientKey } from "../email/address.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { ownedSiteForLead } from "../conversion/owned.js";
import { ELEK_LEAD_NAME } from "../elek/park.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { missingPackStrings } from "../i18n/packs.js";
import { sendSms, type SmsMessage, type SmsSendResult } from "../sms/sender.js";
import { behaviorWindowBlocks } from "../sms/sendWindow.js";
import { isHuMobileE164, normalizePhone } from "../text/phone.js";
import { helperFromName, helperName } from "../trial/helperPersona.js";
import { advertiserIdentity, buildDraftForProspect, formatHuf } from "./draft.js";
import { checkOutreachDraft, checkOutreachSms } from "./outreachCheck.js";
import { isTestLeadName } from "./ownerTestPhone.js";
import { isEmailSuppressed } from "./sendBatch.js";
import { isPhoneSuppressed, mobileOutreachGates } from "./sendOutreachSms.js";
import { INACTIVE, sharedContactBlocks } from "./sharedContactGate.js";
import { artifactBlocks, trialCampaignHost } from "./trialCampaign.js";
import {
  BEHAVIOR_TRIGGER_RANK,
  buildBehaviorMail,
  buildBehaviorSms,
  type BehaviorTrigger,
} from "./behaviorMessageCopy.js";

export const BEHAVIOR_SETTING_KEY = "behavior_message";
/** The message waits this long after the lead's last activity (never while they are reading). */
export const BEHAVIOR_QUIET_MS = 20 * 60_000;
/** A trigger older than this is dropped, not sent late (Friday evening → Monday 8:00 still goes). */
export const BEHAVIOR_MAX_AGE_MS = 4 * 24 * 3_600_000;
/** At most this many messages per run (the timer runs every 10 minutes) — a burst brake. */
export const BEHAVIOR_MAX_PER_RUN = 5;
/** A `claimed` row older than this, still without sent_at, is a run that died mid-send. */
export const BEHAVIOR_STUCK_CLAIM_MS = 30 * 60_000;

export interface BehaviorSettings {
  /** Master switch — false = the timer sends nothing. */
  readonly enabled: boolean;
  /** When the switch was last turned on: only events after it are triggers. */
  readonly since: Date | null;
  readonly by: string | null;
}

export async function getBehaviorSettings(): Promise<BehaviorSettings> {
  const raw = await getSetting(BEHAVIOR_SETTING_KEY);
  try {
    const p = raw ? (JSON.parse(raw) as { enabled?: unknown; since?: unknown; by?: unknown }) : {};
    const since = typeof p.since === "string" && !Number.isNaN(Date.parse(p.since)) ? new Date(p.since) : null;
    // ON needs a valid `since` — without it every old visit would count (a retroactive sweep).
    return { enabled: p.enabled === true && since !== null, since, by: typeof p.by === "string" ? p.by : null };
  } catch {
    // A broken value must not send: treat it as "off".
    return { enabled: false, since: null, by: null };
  }
}

/** Turn the master switch on/off. Turning it ON (from off) restarts `since` = now. */
export async function setBehaviorEnabled(on: boolean, by: string, now: Date = new Date()): Promise<BehaviorSettings> {
  const cur = await getBehaviorSettings();
  const since = on ? (cur.enabled && cur.since ? cur.since : now) : cur.since;
  await setSetting(BEHAVIOR_SETTING_KEY, JSON.stringify({ enabled: on, since: since?.toISOString() ?? null, by }));
  return { enabled: on, since, by };
}

export type BehaviorExclusion =
  | "already"
  | "stuck"
  | "archived"
  | "test"
  | "inactive"
  | "unsubscribed"
  | "blocked"
  | "replied"
  | "bought"
  | "trial"
  | "intent"
  | "no_channel"
  | "duplicate_address"
  | "too_old";

/** Operator-facing names of the exclusion reasons (CLI / console, never lead-facing). */
export const BEHAVIOR_EXCLUSION_LABEL: Record<BehaviorExclusion, string> = {
  already: "már kapott viselkedés-üzenetet", // i18n-exempt: operátori kimenet
  stuck: "beragadt foglalás (lefoglalva, nem igazoltan kiment)", // i18n-exempt: operátori kimenet
  archived: "archivált (nincs élő link)", // i18n-exempt: operátori kimenet
  test: "teszt-lead", // i18n-exempt: operátori kimenet
  inactive: "kizárt / megszűnt lead", // i18n-exempt: operátori kimenet
  unsubscribed: "leiratkozott (link, cím vagy szám szintjén)", // i18n-exempt: operátori kimenet
  blocked: "„ne keressük” jelölés (ADR-0421)", // i18n-exempt: operátori kimenet
  replied: "válaszolt — a válasz a tulaj jóváhagyó sorába megy, automatikus üzenet nem jár", // i18n-exempt: operátori kimenet
  bought: "vásárolt", // i18n-exempt: operátori kimenet
  trial: "próbázik / próbázott", // i18n-exempt: operátori kimenet
  intent: "rendelési szándék / leadott rendelés", // i18n-exempt: operátori kimenet
  no_channel: "nincs csatorna (a hideg megkeresés nem ért el se magyar mobilt, se e-mail-címet)", // i18n-exempt: operátori kimenet
  duplicate_address: "ugyanez a cím / szám egy másik lead üzenetéhez tartozik", // i18n-exempt: operátori kimenet
  too_old: "a kiváltó 4 napnál régebbi — késve nem küldjük", // i18n-exempt: operátori kimenet
};

export interface BehaviorCandidate {
  readonly leadId: string;
  readonly leadName: string;
  /** The LIVE prospect (newest non-archived) — whose link the message carries. */
  readonly prospectId: string | null;
  readonly artifactId: string | null;
  /** The strongest step since the switch; null = nothing happened yet. */
  readonly trigger: BehaviorTrigger | null;
  readonly triggerAt: Date | null;
  /** The lead's last activity on the page (visit start or event). */
  readonly lastActivity: Date | null;
  readonly channel: "email" | "sms" | null;
  readonly address: string | null;
  readonly addressKey: string | null;
  /** When the message may go (lastActivity + 20 min); null = no trigger. */
  readonly dueAt: Date | null;
  readonly excluded: BehaviorExclusion | null;
}

interface ProspectRow {
  id: string;
  lead_id: string;
  mock_artifact_id: string | null;
  contact_email: string | null;
  status: string;
  created_at: unknown;
  archived_at: unknown;
  sent_at: unknown;
  email_sent_at: unknown;
  sms_sent_at: unknown;
  mms_sent_at: unknown;
  unsubscribed_at: unknown;
}

const asDate = (v: unknown): Date | null => (v ? new Date(v as string) : null);
const ms = (v: unknown): number => +new Date(v as string);

/**
 * The leads with activity after the switch, each with its verdict. `onlyLeads` narrows the set
 * (the guard's fixtures — the dev DB is shared); product code passes nothing. `since` overrides
 * the stored switch time (guard only).
 */
export async function listBehaviorCandidates(
  opts: { readonly now?: Date; readonly since?: Date; readonly onlyLeads?: readonly string[] } = {},
): Promise<BehaviorCandidate[]> {
  const now = opts.now ?? new Date();
  const since = opts.since ?? (await getBehaviorSettings()).since;
  if (!since) return [];
  if (opts.onlyLeads && !opts.onlyLeads.length) return [];

  // Leads with a human visit or a trigger event after the switch, on a link whose cold outreach went out.
  const active = await sql<{ lead_id: string }>`
    select distinct p.lead_id
      from prospect p
      join mock_view v on v.prospect_id = p.id
     where p.sent_at is not null
       and coalesce(v.device, '') <> 'bot'
       and (v.started_at >= ${since}
            or exists (select 1 from mock_event e
                        where e.mock_view_id = v.id and e.occurred_at >= ${since}
                          and e.type in ('panel_open', 'trial_open')))
       ${opts.onlyLeads ? sql`and p.lead_id in (${sql.join([...opts.onlyLeads])})` : sql``}
  `.execute(db);
  const leadIds = active.rows.map((r) => r.lead_id);
  if (!leadIds.length) return [];

  const leads = await db.selectFrom("lead").select(["id", "name", "raw", "lifecycle_status", "contact_block_at"]).where("id", "in", leadIds).execute();
  const prospects = (await db
    .selectFrom("prospect")
    .select([
      "id", "lead_id", "mock_artifact_id", "contact_email", "status", "created_at", "archived_at",
      "sent_at", "email_sent_at", "sms_sent_at", "mms_sent_at", "unsubscribed_at",
    ])
    .where("lead_id", "in", leadIds)
    .execute()) as ProspectRow[];
  const byLead = new Map<string, ProspectRow[]>();
  for (const p of prospects) byLead.set(p.lead_id, [...(byLead.get(p.lead_id) ?? []), p]);
  const sentOf = new Map(prospects.map((p) => [p.id, asDate(p.sent_at)]));

  const views = await db
    .selectFrom("mock_view")
    .select(["id", "prospect_id", "started_at", "device"])
    .where("prospect_id", "in", prospects.map((p) => p.id))
    .execute();
  const humanViews = views.filter((v) => v.device !== "bot");
  const events = humanViews.length
    ? await db
        .selectFrom("mock_event")
        .select(["mock_view_id", "type", "payload", "occurred_at"])
        .where("mock_view_id", "in", humanViews.map((v) => v.id))
        .execute()
    : [];
  const viewProspect = new Map(humanViews.map((v) => [v.id, v.prospect_id]));
  const prospectLead = new Map(prospects.map((p) => [p.id, p.lead_id]));

  const rows = new Map(
    (await db.selectFrom("behavior_message").select(["lead_id", "status", "sent_at", "created_at"]).where("lead_id", "in", leadIds).execute()).map((r) => [r.lead_id, r]),
  );
  const replied = new Set((await db.selectFrom("outreach_reply").select("lead_id").where("lead_id", "in", leadIds).execute()).map((r) => r.lead_id));
  // PERSON level (jog/provenance-őr 2026-11-12; owner: „elutasító soha többé”): a reply or a
  // „ne keressük” mark belongs to the PERSON — a same-owner twin lead on the same mobile or mail
  // address must not get the message either (sharedContactBlocks lets same_owner pairs through).
  const { repliedKeys, blockedKeys } = await personStopKeys();
  const trials = new Set((await db.selectFrom("free_trial").select("lead_id").where("lead_id", "in", leadIds).execute()).map((r) => r.lead_id));
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
  const takenKeys = new Set(
    (await db.selectFrom("behavior_message").select(["channel", "address_key"]).execute()).map((r) => `${r.channel}:${r.address_key}`),
  );

  const out: BehaviorCandidate[] = [];
  const sorted = [...leads].sort((a, b) => a.name.localeCompare(b.name, "hu"));
  for (const lead of sorted) {
    const pr = byLead.get(lead.id) ?? [];
    const live = pr.filter((p) => !p.archived_at).sort((a, b) => ms(b.created_at) - ms(a.created_at))[0];
    // Visits on a link AFTER its cold outreach went out (the operator's own pre-send views do not count).
    const lv = humanViews
      .filter((v) => prospectLead.get(v.prospect_id) === lead.id)
      .filter((v) => {
        const s = sentOf.get(v.prospect_id);
        return s !== null && s !== undefined && ms(v.started_at) >= +s;
      })
      .sort((a, b) => ms(a.started_at) - ms(b.started_at));
    const lvIds = new Set(lv.map((v) => v.id));
    const le = events.filter((e) => lvIds.has(e.mock_view_id) && viewProspect.has(e.mock_view_id));

    const at: Partial<Record<BehaviorTrigger, Date>> = {};
    const ret = lv.find((v, i) => i > 0 && ms(v.started_at) >= +since);
    if (ret) at.return = asDate(ret.started_at)!;
    const price = le.filter((e) => e.type === "panel_open" && ms(e.occurred_at) >= +since).sort((a, b) => ms(a.occurred_at) - ms(b.occurred_at))[0];
    if (price) at.price = asDate(price.occurred_at)!;
    const start = le
      .filter((e) => e.type === "trial_open" && ms(e.occurred_at) >= +since && (e.payload as { via?: unknown } | null)?.via !== "link")
      .sort((a, b) => ms(a.occurred_at) - ms(b.occurred_at))[0];
    if (start) at.start = asDate(start.occurred_at)!;
    const trigger = BEHAVIOR_TRIGGER_RANK.find((t) => at[t]) ?? null;
    const triggerAt = trigger ? at[trigger]! : null;
    const lastMs = Math.max(0, ...lv.map((v) => ms(v.started_at)), ...le.map((e) => ms(e.occurred_at)));
    const lastActivity = lastMs ? new Date(lastMs) : null;

    // The channel the cold outreach used: the mobile first (owner's plan: „Mobil van → SMS”).
    const rawPhone = ((lead.raw ?? {}) as { phone?: string }).phone;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const mobile = phone && isHuMobileE164(phone) ? phone : null;
    const texted = pr.some((p) => p.sms_sent_at || p.mms_sent_at);
    const mailed = pr.filter((p) => p.email_sent_at && (p.contact_email ?? "").trim()).sort((a, b) => ms(b.email_sent_at) - ms(a.email_sent_at))[0];
    const mailedEmail = mailed ? mailed.contact_email!.trim() : null;
    let channel: "email" | "sms" | null = null;
    let address: string | null = null;
    let addressKey: string | null = null;
    if (texted && mobile) {
      channel = "sms";
      address = mobile;
      addressKey = mobile;
    } else if (mailedEmail && recipientKey(mailedEmail)) {
      channel = "email";
      address = mailedEmail;
      addressKey = recipientKey(mailedEmail);
    }
    const base = {
      leadId: lead.id,
      leadName: lead.name,
      prospectId: live?.id ?? null,
      artifactId: live?.mock_artifact_id ?? null,
      trigger,
      triggerAt,
      lastActivity,
      channel,
      address,
      addressKey,
      dueAt: trigger && lastActivity ? new Date(+lastActivity + BEHAVIOR_QUIET_MS) : null,
    };
    const no = (excluded: BehaviorExclusion): void => {
      out.push({ ...base, excluded });
    };
    const row = rows.get(lead.id);
    if (row) {
      no(row.status === "claimed" && !row.sent_at && +now - ms(row.created_at) > BEHAVIOR_STUCK_CLAIM_MS ? "stuck" : "already");
      continue;
    }
    if (!live) { no("archived"); continue; }
    if (isTestLeadName(lead.name) || lead.name === ELEK_LEAD_NAME) { no("test"); continue; }
    if ((INACTIVE as readonly string[]).includes(lead.lifecycle_status)) { no("inactive"); continue; }
    if (
      pr.some((p) => p.unsubscribed_at) ||
      (mailedEmail && (await isEmailSuppressed(mailedEmail))) ||
      (phone && (await isPhoneSuppressed(phone)))
    ) {
      no("unsubscribed");
      continue;
    }
    // Every address this person is known by here: the mobile and every mail address on any link.
    const personKeys = [
      ...(phone ? [`sms:${phone}`] : []),
      ...pr.map((p) => recipientKey(p.contact_email)).filter(Boolean).map((k) => `email:${k}`),
    ];
    if (lead.contact_block_at || personKeys.some((k) => blockedKeys.has(k))) { no("blocked"); continue; }
    if (replied.has(lead.id) || personKeys.some((k) => repliedKeys.has(k))) { no("replied"); continue; }
    if (await ownedSiteForLead(lead.id)) { no("bought"); continue; }
    if (trials.has(lead.id)) { no("trial"); continue; }
    if (submitted.has(lead.id) || pr.some((p) => p.status === "order_intent" || p.status === "converted")) { no("intent"); continue; }
    if (!channel || !addressKey) { no("no_channel"); continue; }
    if (takenKeys.has(`${channel}:${addressKey}`)) { no("duplicate_address"); continue; }
    if (triggerAt && +now - +triggerAt > BEHAVIOR_MAX_AGE_MS) { no("too_old"); continue; }
    out.push({ ...base, excluded: null });
  }
  return out;
}

/**
 * The person keys (`sms:+36…`, `email:<recipientKey>`) of everyone who REPLIED to any message
 * (the reply's own sender, and the phone / mail addresses of the lead it belongs to) and of every
 * lead marked „ne keressük”. Small sets: replies and blocks are dozens, not thousands.
 */
async function personStopKeys(): Promise<{ repliedKeys: Set<string>; blockedKeys: Set<string> }> {
  const keyOf = (v: string | null | undefined): string[] => {
    const raw = (v ?? "").trim();
    if (!raw) return [];
    if (raw.includes("@")) {
      const k = recipientKey(raw);
      return k ? [`email:${k}`] : [];
    }
    const ph = normalizePhone(raw);
    return ph ? [`sms:${ph}`] : [];
  };
  const repliedKeys = new Set<string>();
  const blockedKeys = new Set<string>();
  for (const r of await db.selectFrom("outreach_reply").select("sender").execute()) for (const k of keyOf(r.sender)) repliedKeys.add(k);
  const rows = await sql<{ phone: string | null; email: string | null; blocked: boolean; replied: boolean }>`
    select l.raw->>'phone' as phone, p.contact_email as email,
           (l.contact_block_at is not null) as blocked,
           exists (select 1 from outreach_reply r where r.lead_id = l.id) as replied
      from lead l
      left join prospect p on p.lead_id = l.id
     where l.contact_block_at is not null
        or exists (select 1 from outreach_reply r where r.lead_id = l.id)
  `.execute(db);
  for (const r of rows.rows) {
    const keys = [...keyOf(r.phone), ...keyOf(r.email)];
    for (const k of keys) {
      if (r.blocked) blockedKeys.add(k);
      if (r.replied) repliedKeys.add(k);
    }
  }
  return { repliedKeys, blockedKeys };
}

export type BehaviorOutcome =
  | { readonly kind: "sent"; readonly detail: string }
  | { readonly kind: "dry-run"; readonly detail: string }
  | { readonly kind: "skipped"; readonly reason: string };

export interface BehaviorDeps {
  /** Test seam: the guard injects a recording sender — product code passes nothing. */
  readonly mailer?: EmailSender;
  readonly sms?: (msg: SmsMessage) => Promise<SmsSendResult>;
  readonly now?: Date;
  /** Build + gate everything, claim and send nothing. */
  readonly dryRun?: boolean;
  /** Skip the network-bound mobile gate chain (photo health) — the guard's fixtures have no page. */
  readonly offline?: boolean;
  /** Test seam: the re-judgement reads only these leads; `since` overrides the stored switch. */
  readonly onlyLeads?: readonly string[];
  readonly since?: Date;
}

async function claim(c: BehaviorCandidate): Promise<string | null> {
  // ON CONFLICT DO NOTHING without a target covers BOTH unique keys: the lead's and the address's.
  const r = await db
    .insertInto("behavior_message")
    .values({
      lead_id: c.leadId,
      prospect_id: c.prospectId,
      trigger: c.trigger!,
      trigger_at: c.triggerAt!,
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
  await db.deleteFrom("behavior_message").where("id", "=", id).where("status", "=", "claimed").execute();
}

async function markSent(id: string, trigger: BehaviorTrigger, detail: string, body: string): Promise<void> {
  // The trigger column records what the message ANSWERED (a 'start' without a trial on offer went as 'price').
  await db.updateTable("behavior_message").set({ status: "sent", sent_at: new Date(), trigger, detail, body }).where("id", "=", id).execute();
}

/** Right before the claim the lead is judged AGAIN (a reply, an opt-out or a trial may have landed). */
async function rejudge(c: BehaviorCandidate, deps: BehaviorDeps): Promise<string | null> {
  const fresh = (await listBehaviorCandidates({ now: deps.now, since: deps.since, onlyLeads: deps.onlyLeads ?? [c.leadId] })).find((x) => x.leadId === c.leadId);
  if (!fresh) return "a lead közben kikerült"; // i18n-exempt: operátori kimenet
  if (fresh.excluded) return `${BEHAVIOR_EXCLUSION_LABEL[fresh.excluded]} (küldéskor újramérve)`; // i18n-exempt: operátori kimenet
  if (fresh.channel !== c.channel || fresh.addressKey !== c.addressKey || fresh.prospectId !== c.prospectId) {
    return "a célpont közben változott — a következő futás újraméri"; // i18n-exempt: operátori kimenet
  }
  return null;
}

/** Send (or dry-run) the message to one DUE candidate, through every gate. */
export async function sendBehaviorMessage(c: BehaviorCandidate, deps: BehaviorDeps = {}): Promise<BehaviorOutcome> {
  const now = deps.now ?? new Date();
  if (c.excluded) return { kind: "skipped", reason: BEHAVIOR_EXCLUSION_LABEL[c.excluded] };
  if (!c.trigger || !c.triggerAt || !c.dueAt || !c.prospectId || !c.channel || !c.address || !c.addressKey) {
    return { kind: "skipped", reason: "nincs kiváltó vagy célpont" }; // i18n-exempt: operátori kimenet
  }
  if (+now < +c.dueAt) return { kind: "skipped", reason: "még olvas — az utolsó aktivitás után 20 percet várunk" }; // i18n-exempt: operátori kimenet
  const block = behaviorWindowBlocks(now);
  if (block) return { kind: "skipped", reason: block };

  let send: () => Promise<{ detail: string; failed: boolean }>;
  let sentTrigger: BehaviorTrigger;
  let preview: string;
  let body: string;
  if (c.channel === "sms") {
    // The cold SMS's shared chain (opt-out, customer, curator sign-off, language, verdicts, photo
    // health, number, person-level suppression, shared contact, allowlist, 8–20) — ONE copy.
    let d;
    if (deps.offline) {
      if (await isPhoneSuppressed(c.address)) return { kind: "skipped", reason: BEHAVIOR_EXCLUSION_LABEL.unsubscribed };
      d = await buildDraftForProspect(c.prospectId, { reserveLabel: !deps.dryRun });
      if (!d) return { kind: "skipped", reason: "a piszkozat nem állítható elő" }; // i18n-exempt: operátori kimenet
    } else {
      const g = await mobileOutreachGates(c.prospectId);
      if (!g.ok) return { kind: "skipped", reason: g.message };
      if (g.to !== c.address) return { kind: "skipped", reason: `a lead száma közben változott (${g.to})` }; // i18n-exempt: operátori kimenet
      d = g.d;
    }
    const sms = buildBehaviorSms({
      lang: d.lang,
      leadName: c.leadName,
      trigger: c.trigger,
      link: d.sms.link,
      priceList: d.input.fromMonthly ? formatHuf(d.input.fromMonthly) : null,
      trialDays: d.input.trialDays ?? null,
      planCount: d.input.planCount,
    });
    const gate = checkOutreachSms({ text: sms.text, link: d.sms.link, unsubscribeLink: d.sms.unsubscribeLink }, sms.name, d.lang, d.market);
    if (gate.verdict === "FLAG") return { kind: "skipped", reason: `§C FLAG: ${gate.reasons.join(" · ")}` }; // i18n-exempt: operátori kimenet
    sentTrigger = sms.trigger;
    preview = sms.text;
    body = sms.text;
    const to = c.address;
    send = async () => {
      const r = await (deps.sms ?? sendSms)({ to, text: sms.text });
      return { detail: `${r.provider}:${r.id}`, failed: r.provider === "blocked" };
    };
  } else {
    if (await isEmailSuppressed(c.address)) return { kind: "skipped", reason: BEHAVIOR_EXCLUSION_LABEL.unsubscribed };
    const shared = await sharedContactBlocks(c.leadId, "email", c.address);
    if (shared) return { kind: "skipped", reason: shared };
    const verdict = await artifactBlocks(c.artifactId);
    if (verdict) return { kind: "skipped", reason: verdict };
    const d = await buildDraftForProspect(c.prospectId, { reserveLabel: !deps.dryRun });
    if (!d) return { kind: "skipped", reason: "a piszkozat nem állítható elő" }; // i18n-exempt: operátori kimenet
    if (d.lang !== DEFAULT_LANG) {
      const missing = (await missingPackStrings(d.lang)).length;
      if (missing > 0) return { kind: "skipped", reason: `${d.lang} nyelvi csomagból ${missing} string hiányzik` }; // i18n-exempt: operátori kimenet
    }
    const mail = buildBehaviorMail({
      lang: d.lang,
      leadName: c.leadName,
      trigger: c.trigger,
      link: d.draft.link,
      priceList: d.input.fromMonthly ? formatHuf(d.input.fromMonthly) : null,
      trialDays: d.input.trialDays ?? null,
      planCount: d.input.planCount,
      to: c.address,
      trialHost: await trialCampaignHost(c.leadId),
      unsubscribeLink: d.draft.unsubscribeLink,
      privacyLink: d.draft.privacyLink,
      identity: advertiserIdentity(d.lang),
      helperName: helperName(d.lang),
      fromName: helperFromName(d.lang),
      listUnsubscribe: config.outreachListUnsubscribe,
    });
    // §C on the text that goes out — the cold letter's own judge (link, opt-out, identity, country).
    const gate = checkOutreachDraft(mail.letter, c.leadName, d.lang, d.market);
    if (gate.verdict === "FLAG") return { kind: "skipped", reason: `§C FLAG: ${gate.reasons.join(" · ")}` }; // i18n-exempt: operátori kimenet
    sentTrigger = mail.trigger;
    preview = `${mail.letter.subject} · ${mail.letter.link}`;
    body = `${mail.letter.subject}\n\n${mail.letter.body}`;
    const msg = mail.message;
    send = async () => {
      const r = await (deps.mailer ?? getEmailSender()).send(msg);
      return { detail: `${r.provider}:${r.id}`, failed: false };
    };
  }
  if (deps.dryRun) return { kind: "dry-run", detail: preview };

  const changed = await rejudge(c, deps);
  if (changed) return { kind: "skipped", reason: changed };
  const claimId = await claim(c);
  if (!claimId) return { kind: "skipped", reason: BEHAVIOR_EXCLUSION_LABEL.already };
  try {
    const r = await send();
    if (r.failed) {
      await release(claimId);
      return { kind: "skipped", reason: "az SMS nem ment ki (modem/relay hiba) — a foglalás feloldva, újrapróbálható" }; // i18n-exempt: operátori kimenet
    }
    await markSent(claimId, sentTrigger, r.detail, body);
    return { kind: "sent", detail: `${c.channel} ${c.address} · ${sentTrigger}` };
  } catch (e) {
    await release(claimId);
    return { kind: "skipped", reason: `küldési hiba (a foglalás feloldva, újrapróbálható): ${(e as Error).message}` }; // i18n-exempt: operátori kimenet
  }
}

export interface BehaviorRunResult {
  readonly off?: true;
  readonly deferred?: string;
  readonly due: number;
  readonly sent: number;
  readonly skipped: readonly { readonly lead: string; readonly reason: string }[];
  readonly dry: readonly { readonly lead: string; readonly detail: string }[];
}

/** One timer tick: the due candidates, at most BEHAVIOR_MAX_PER_RUN sends. */
export async function runBehaviorMessages(deps: BehaviorDeps = {}): Promise<BehaviorRunResult> {
  const now = deps.now ?? new Date();
  const settings = await getBehaviorSettings();
  if (!deps.since && !settings.enabled) return { off: true, due: 0, sent: 0, skipped: [], dry: [] };
  const block = behaviorWindowBlocks(now);
  if (block && !deps.dryRun) return { deferred: block, due: 0, sent: 0, skipped: [], dry: [] };
  const all = await listBehaviorCandidates({ now, since: deps.since, onlyLeads: deps.onlyLeads });
  const due = all.filter((c) => !c.excluded && c.dueAt && +c.dueAt <= +now);
  let sent = 0;
  const skipped: { lead: string; reason: string }[] = [];
  const dry: { lead: string; detail: string }[] = [];
  for (const c of due) {
    if (sent >= BEHAVIOR_MAX_PER_RUN) break;
    const o = await sendBehaviorMessage(c, { ...deps, now });
    if (o.kind === "sent") sent++;
    else if (o.kind === "dry-run") dry.push({ lead: c.leadName, detail: o.detail });
    else skipped.push({ lead: c.leadName, reason: o.reason });
  }
  return { due: due.length, sent, skipped, dry };
}
