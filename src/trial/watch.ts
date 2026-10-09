// FREE-TRIAL WATCH — the operator hears about a stuck free trial (ADR-0342/0344/0345).
//
// Why this exists: every way a card-less trial can go wrong was SILENT. A dead daily
// 07:00 billing tick leaves expired trials live for free; a failed T−3/T−1 warning is a
// 'failed' ledger row nobody reads; a trial whose provisioning crashed is a console.error
// in the public server's stdout; a continuation payment that never became an invoice or a
// subscription is money in with nothing out; a login letter that failed leaves the
// trialist locked out of the site they just started. The house did not know.
//
// STATE-based, not event-hooked: a process that died never runs its own hook. The hourly
// tick (scripts/offer-followup.mts) reads the DB and asks five questions; it therefore
// also catches the DAILY tick being dead (condition ①).
//
//   ① lapse_overdue      — active trial, tenant set, trial_until older than now − 26 h
//   ② notice_failed      — a free_trial_notice row 'failed', or 'claimed' for over 1 h
//   ③ site_not_live      — active trial started over 30 min ago, no tenant or no live site
//   ④ continuation_stuck — a paid initial order of the trial's lead (paid over 30 min ago,
//                          after the trial started), and no issued invoice for that payment,
//                          or no subscription for the trial tenant, or the trial not 'converted'
//   ⑤ login_not_sent     — active trial, tenant set, started over 15 min ago, and no
//                          tenant_message kind='credentials' (logged only AFTER a successful send)
//
// EXACTLY ONCE per incident: the free_trial_alert ledger (0100), unique on (trial, kind,
// ref). The row is CLAIMED before the send (an overlapping run cannot double-alert); after
// it, 'sent' if at least one channel went out. With NO recipient, or when every channel
// failed, the claim is DELETED — an alert that never left must not be marked as given —
// and the miss is loud (console.error); the next hourly tick retries. A crash between the
// claim and the mark leaves a 'claimed' row that is not retried: the crashed tick exits
// non-zero and the unit's OnFailure= mails the house (ADR-0276).
//
// BATCHING: one e-mail + one SMS per KIND per tick, naming every new incident of that kind
// — a dead daily tick with twenty expired trials is one alert, not twenty phone buzzes.
//
// ⛔ Never throws past runTrialWatch's own per-kind try/catch for the SEND: a failing alert
// must not break the other jobs of the hourly tick. A failing DETECTION query does throw —
// the tick catches it in its own try/catch and exits non-zero (a blind watch is a failure).
//
// Internal operator text (e-mail + accent-free ASCII SMS) — outside the §B.18
// customer-facing i18n scope (i18n-scope EXCEPTIONS lists this file).

import { sql } from "kysely";
import { config } from "../config.js";
import { alertSubject } from "../console/houseAlert.js";
import { getAlertRecipients } from "../console/appSettings.js";
import { db } from "../db/client.js";
import { getEmailSender, type EmailMessage } from "../email/sender.js";
import { publicPaymentRef } from "../payment/publicRef.js";
import { sendSms, type SmsMessage } from "../sms/sender.js";

export const LAPSE_OVERDUE_HOURS = 26;
export const NOTICE_CLAIM_STALE_MINUTES = 60;
export const SITE_LIVE_GRACE_MINUTES = 30;
export const CONTINUATION_GRACE_MINUTES = 30;
export const LOGIN_GRACE_MINUTES = 15;

export type TrialAlertKind =
  | "lapse_overdue"
  | "notice_failed"
  | "site_not_live"
  | "continuation_stuck"
  | "login_not_sent";

export const TRIAL_ALERT_KINDS: readonly TrialAlertKind[] = [
  "lapse_overdue",
  "notice_failed",
  "site_not_live",
  "continuation_stuck",
  "login_not_sent",
];

/** One stuck trial, one reason. `ref` = the offending record where a trial can have several. */
export interface TrialIncident {
  readonly kind: TrialAlertKind;
  readonly trialId: string;
  readonly ref: string;
  readonly leadId: string;
  readonly name: string;
  readonly tenantId: string | null;
  /** What exactly is wrong, for this trial (Hungarian, operator text). */
  readonly problem: string;
  /** The concrete next step for THIS trial (real CLI / page names only). */
  readonly next: string;
}

/** Injectable for the guard (scripts/free-trial-watch-check.mts) — the real ones by default. */
export interface TrialWatchDeps {
  recipients(): Promise<{ readonly email: string | null; readonly phone: string | null }>;
  sendEmail(msg: EmailMessage): Promise<unknown>;
  /** Must throw (or return provider 'blocked') when the SMS did not go out. */
  sendSms(msg: SmsMessage): Promise<{ readonly provider: string }>;
  /** The base URL the live-host verdict ("[TESZT] ") and the /p/<token> links are made from. */
  publicBaseUrl(): string;
}

const REAL_DEPS: TrialWatchDeps = {
  recipients: async () => {
    const r = await getAlertRecipients();
    return { email: r.email, phone: r.phone };
  },
  sendEmail: (msg) => getEmailSender().send(msg),
  sendSms: (msg) => sendSms(msg),
  publicBaseUrl: () => config.publicBaseUrl,
};

export interface TrialWatchResult {
  /** New (not yet alerted) incidents found, per kind. */
  readonly found: Readonly<Record<TrialAlertKind, number>>;
  /** Incidents whose alert went out this run (ledger → 'sent'). */
  readonly alerted: number;
  /** Alert messages (one per kind) that went out on at least one channel. */
  readonly messages: number;
  /** New incidents existed but there was nobody to tell — nothing claimed, retried next tick. */
  readonly noRecipient: boolean;
  /** Kinds whose alert failed on every channel (claims released, retried next tick). */
  readonly failedKinds: readonly TrialAlertKind[];
}

export interface TrialWatchOpts {
  /** Narrows the run to named trials (guards on a shared DB); an empty list = nothing. */
  readonly onlyTrialIds?: readonly string[];
}

const minutesAgo = (now: Date, m: number): Date => new Date(now.getTime() - m * 60_000);
const iso = (v: unknown): string => (v == null ? "—" : new Date(v as string).toISOString());

/** Accent-free printable ASCII for the operator SMS (ő/ű fold too: NFD + strip marks). */
export function asciiSms(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[„”“"]/g, "'")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

// ── detection ────────────────────────────────────────────────────────────────────

interface TrialRow {
  id: string;
  lead_id: string;
  tenant_id: string | null;
  lead_name: string | null;
  tenant_name: string | null;
  token: string | null;
}

function trialBase(opts: TrialWatchOpts) {
  let q = db
    .selectFrom("free_trial as ft")
    .innerJoin("lead", "lead.id", "ft.lead_id")
    .leftJoin("tenant", "tenant.id", "ft.tenant_id")
    .leftJoin("prospect", "prospect.id", "ft.prospect_id")
    .select([
      "ft.id as id",
      "ft.lead_id as lead_id",
      "ft.tenant_id as tenant_id",
      "lead.name as lead_name",
      "tenant.display_name as tenant_name",
      "prospect.token as token",
    ]);
  if (opts.onlyTrialIds) q = q.where("ft.id", "in", [...opts.onlyTrialIds]);
  return q;
}

const nameOf = (r: TrialRow): string => r.tenant_name ?? r.lead_name ?? "ismeretlen szállás";

export async function detectTrialIncidents(
  now: Date,
  opts: TrialWatchOpts = {},
  publicBaseUrl: string = config.publicBaseUrl,
): Promise<TrialIncident[]> {
  if (opts.onlyTrialIds && opts.onlyTrialIds.length === 0) return [];
  const out: TrialIncident[] = [];
  const base = (): string => publicBaseUrl.replace(/\/$/, "");

  // ① the daily lapse did not run
  const overdue = await trialBase(opts)
    .select("ft.trial_until as trial_until")
    .where("ft.status", "=", "active")
    .where("ft.tenant_id", "is not", null)
    .where("ft.trial_until", "<", new Date(now.getTime() - LAPSE_OVERDUE_HOURS * 3_600_000))
    .execute();
  for (const r of overdue) {
    out.push({
      kind: "lapse_overdue",
      trialId: r.id,
      ref: "",
      leadId: r.lead_id,
      name: nameOf(r),
      tenantId: r.tenant_id,
      problem: `A próba ${iso(r.trial_until)}-kor lejárt, de még 'active' — az oldal ingyen él tovább.`,
      next: `npx tsx scripts/billing-cycle.ts --tenant=${r.tenant_id}`,
    });
  }

  // ② a T−3/T−1 (or p7) warning failed, or its send crashed mid-way
  const notices = await trialBase(opts)
    .innerJoin("free_trial_notice as n", "n.free_trial_id", "ft.id")
    .select(["n.id as notice_id", "n.step as step", "n.channel as channel", "n.status as nstatus", "n.detail as ndetail", "n.created_at as ncreated"])
    .where("ft.status", "!=", "purged")
    .where((eb) =>
      eb.or([
        eb("n.status", "=", "failed"),
        eb.and([eb("n.status", "=", "claimed"), sql<boolean>`n.created_at < ${minutesAgo(now, NOTICE_CLAIM_STALE_MINUTES)}`]),
      ]),
    )
    .execute();
  for (const r of notices) {
    const link = r.token ? ` A folytatás linkje: ${base()}/p/${r.token}/folytatas` : "";
    out.push({
      kind: "notice_failed",
      trialId: r.id,
      ref: r.notice_id,
      leadId: r.lead_id,
      name: nameOf(r),
      tenantId: r.tenant_id,
      problem:
        r.nstatus === "failed"
          ? `A ${r.step} figyelmeztetés (${r.channel}) NEM ment ki: ${r.ndetail ?? "ismeretlen hiba"}.`
          : `A ${r.step} figyelmeztetés (${r.channel}) küldése ${iso(r.ncreated)} óta 'claimed' — a küldés közben leállt, nem tudni, kiment-e.`,
      next:
        `A napló a lépcsőt nem küldi újra. Az ok a free_trial_notice sor detail mezőjében áll (id: ${r.notice_id}); ` +
        `ha a levél/SMS nem ment ki, értesítsd a próbázót kézzel a próba végéről.${link}`,
    });
  }

  // ③ the trial started but its site is not live
  const notLive = await trialBase(opts)
    .select((eb) =>
      eb
        .selectFrom("site")
        .select("site.status")
        .whereRef("site.tenant_id", "=", "ft.tenant_id")
        .limit(1)
        .as("site_status"),
    )
    .where("ft.status", "=", "active")
    .where("ft.started_at", "<", minutesAgo(now, SITE_LIVE_GRACE_MINUTES))
    .where((eb) =>
      eb.or([
        eb("ft.tenant_id", "is", null),
        eb.not(
          eb.exists(
            eb.selectFrom("site").select("site.id").whereRef("site.tenant_id", "=", "ft.tenant_id").where("site.status", "=", "live"),
          ),
        ),
      ]),
    )
    .execute();
  for (const r of notLive) {
    out.push({
      kind: "site_not_live",
      trialId: r.id,
      ref: "",
      leadId: r.lead_id,
      name: nameOf(r),
      tenantId: r.tenant_id,
      problem: r.tenant_id
        ? `A próba elindult, de az oldala nem él (site: ${r.site_status ?? "nincs"}).`
        : "A próba-foglalás megvan, de a tenant nem jött létre (a provisioning félbeszakadt).",
      next: r.tenant_id
        ? `Hibaok a public szerver naplójában: "[trial] ${r.id} hiba". Az élesítésre nincs konzol-gomb — kézi (fejlesztői) beavatkozás kell.`
        : `A próbázó a ${r.token ? `${base()}/p/${r.token}` : "mock-lapján"} az űrlap újraküldésével folytatja (a félbehagyott foglalást a startTrial folytatja). Hibaok a public szerver naplójában: "[trial] ${r.id} hiba".`,
    });
  }

  // ④ the continuation was paid, but no invoice / subscription / conversion followed
  const paidCut = minutesAgo(now, CONTINUATION_GRACE_MINUTES);
  const stuck = await trialBase(opts)
    .innerJoin("prospect as pp", "pp.lead_id", "ft.lead_id")
    .innerJoin("order_intent as oi", "oi.prospect_id", "pp.id")
    .innerJoin("payment as pay", "pay.order_intent_id", "oi.id")
    .select((eb) => [
      "pay.id as payment_id",
      "pay.paid_at as paid_at",
      "ft.status as trial_status",
      eb
        .exists(eb.selectFrom("invoice").select("invoice.id").whereRef("invoice.payment_id", "=", "pay.id").where("invoice.status", "=", "issued"))
        .as("has_invoice"),
      eb
        .exists(eb.selectFrom("subscription").select("subscription.id").whereRef("subscription.tenant_id", "=", "ft.tenant_id"))
        .as("has_sub"),
      eb.selectFrom("site").select("site.status").whereRef("site.tenant_id", "=", "ft.tenant_id").limit(1).as("site_status"),
    ])
    .where("ft.status", "!=", "purged")
    .where("oi.kind", "=", "initial")
    .where("pay.status", "=", "paid")
    .where("pay.paid_at", "<", paidCut)
    .whereRef("pay.paid_at", ">", "ft.started_at")
    .execute();
  for (const r of stuck) {
    const missing: string[] = [];
    if (!r.has_invoice) missing.push("nincs kiállított számla");
    if (!r.has_sub) missing.push("nincs előfizetés (subscription)");
    if (r.trial_status !== "converted") missing.push(`a próba '${r.trial_status}', nem 'converted'`);
    if (missing.length === 0) continue;
    const steps: string[] = [];
    if (!r.has_invoice) steps.push(`számla: npx tsx scripts/invoice-retry.mts ${r.payment_id}`);
    if (!r.has_sub || r.trial_status !== "converted") {
      steps.push(
        `aktiválás (előfizetés/converted): a fizetés utáni activate() nem futott végig — kézi (fejlesztői) beavatkozás; ` +
          `a fizetés: npx tsx scripts/find-payment.mts ${publicPaymentRef(r.payment_id) ?? r.payment_id}`,
      );
    }
    out.push({
      kind: "continuation_stuck",
      trialId: r.id,
      ref: r.payment_id,
      leadId: r.lead_id,
      name: nameOf(r),
      tenantId: r.tenant_id,
      problem:
        `A folytatás KI VAN FIZETVE (${iso(r.paid_at)}, ${publicPaymentRef(r.payment_id) ?? r.payment_id}), de: ` +
        `${missing.join("; ")}. Site: ${r.site_status ?? "nincs"}.`,
      next: steps.join(" · "),
    });
  }

  // ⑤ the login letter never went out
  const noLogin = await trialBase(opts)
    .select((eb) => [
      eb.exists(eb.selectFrom("tenant_user").select("tenant_user.id").whereRef("tenant_user.tenant_id", "=", "ft.tenant_id")).as("has_user"),
      "ft.contact_email as contact_email",
    ])
    .where("ft.status", "=", "active")
    .where("ft.tenant_id", "is not", null)
    .where("ft.started_at", "<", minutesAgo(now, LOGIN_GRACE_MINUTES))
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("tenant_message")
            .select("tenant_message.id")
            .whereRef("tenant_message.tenant_id", "=", "ft.tenant_id")
            .where("tenant_message.kind", "=", "credentials"),
        ),
      ),
    )
    .execute();
  for (const r of noLogin) {
    const site = config.publicSiteUrl.replace(/\/$/, "");
    out.push({
      kind: "login_not_sent",
      trialId: r.id,
      ref: "",
      leadId: r.lead_id,
      name: nameOf(r),
      tenantId: r.tenant_id,
      problem: `A próbázó (${r.contact_email}) nem kapta meg a belépő-levelet — a tenant postafiókjában nincs 'credentials' levél.`,
      next: r.has_user
        ? `A fiók megvan: a ${site}/login/help oldalon („Elfelejtett jelszó?”) a(z) ${r.contact_email} címre új belépő-link kérhető. Hibaok a public szerver naplójában: "[trial] ${r.id}: belépés-kiadás SIKERTELEN".`
        : `Fiók (tenant_user) sincs — kézi (fejlesztői) beavatkozás kell. Hibaok a public szerver naplójában: "[trial] ${r.id}: belépés-kiadás SIKERTELEN".`,
    });
  }

  return out;
}

// ── message ──────────────────────────────────────────────────────────────────────

const KIND_TITLE: Readonly<Record<TrialAlertKind, string>> = {
  lapse_overdue: "a lejárt próba nem szünetelt (a napi lejáratás nem futott)",
  notice_failed: "a lejárat előtti figyelmeztetés nem ment ki",
  site_not_live: "a próba elindult, de az oldala nem él",
  continuation_stuck: "kifizetett folytatás, de nincs számla / előfizetés",
  login_not_sent: "a próbázó nem kapta meg a belépő-levelet",
};

const KIND_SMS: Readonly<Record<TrialAlertKind, string>> = {
  lapse_overdue: "LEJART PROBA NEM SZUNETELT (napi lejaratas nem futott)",
  notice_failed: "PROBA-FIGYELMEZTETES NEM MENT KI",
  site_not_live: "PROBA ELINDULT, DE AZ OLDAL NEM EL",
  continuation_stuck: "KIFIZETETT FOLYTATAS, DE NINCS SZAMLA/ELOFIZETES",
  login_not_sent: "PROBAZO NEM KAPOTT BELEPO-LEVELET",
};

const KIND_INTRO: Readonly<Record<TrialAlertKind, string>> = {
  lapse_overdue:
    `A napi 07:00-s billing-tick (citoviso-billing.timer → scripts/billing-cycle.ts) a lejárt próbát ${LAPSE_OVERDUE_HOURS} óra ` +
    `után sem szüneteltette. Valószínűleg a tick nem fut: systemctl status citoviso-billing.timer · journalctl -u citoviso-billing. ` +
    `A pótlás próbánként lent (a --tenant a futást arra az egy tenantra szűkíti; idempotens).`,
  notice_failed:
    "A próba lejárata előtti figyelmeztetés (free_trial_notice) elbukott vagy félbeszakadt. A napló kétszeri küldést tilt, ezért magától nem megy ki újra.",
  site_not_live: `A próba több mint ${SITE_LIVE_GRACE_MINUTES} perce elindult, de a próbázó oldala nem él — a próbázó egy nem működő ígéretet kapott.`,
  continuation_stuck:
    `A próbázó KIFIZETTE a folytatást (${CONTINUATION_GRACE_MINUTES} percnél régebben), de a fizetés utáni lépések nem fejeződtek be. A pénz bent van, a vevő nem kapta meg, amit vett.`,
  login_not_sent: `A próba több mint ${LOGIN_GRACE_MINUTES} perce fut, de a belépő-levél nem ment ki (a levél csak sikeres küldés után naplózódik) — a próbázó nem tud belépni.`,
};

function emailFor(kind: TrialAlertKind, list: readonly TrialIncident[], publicBaseUrl: string): { subject: string; text: string } {
  const consoleBase = (config.consoleUrl ?? "").replace(/\/$/, "");
  const blocks = list.map((i) =>
    [
      `• ${i.name} — próba ${i.trialId}`,
      `  lead: ${i.leadId}${consoleBase ? ` · konzol: ${consoleBase}/lead/${i.leadId}` : ` · konzol: /lead/${i.leadId}`}`,
      `  tenant: ${i.tenantId ?? "—"}`,
      `  Mi a baj: ${i.problem}`,
      `  Teendő: ${i.next}`,
    ].join("\n"),
  );
  return {
    subject: alertSubject(`Citoviso: ingyenes próba — ${KIND_TITLE[kind]} (${list.length} db)`, publicBaseUrl),
    text:
      `${KIND_INTRO[kind]}\n\n${blocks.join("\n\n")}\n\n` +
      `Erről az esetről ez az egyetlen riasztás (free_trial_alert napló, src/trial/watch.ts).`,
  };
}

function smsFor(kind: TrialAlertKind, list: readonly TrialIncident[], publicBaseUrl: string): string {
  const names = list.slice(0, 3).map((i) => i.name).join(", ") + (list.length > 3 ? ` +${list.length - 3}` : "");
  const head = alertSubject(`Citoviso: ${KIND_SMS[kind]} - ${list.length} db: ${names}.`, publicBaseUrl);
  const tail = list.length === 1 ? ` Teendo: ${list[0]!.next}` : " Reszletek es teendok e-mailben.";
  // ≤ 3 GSM-7 segments; the full detail is in the e-mail.
  return asciiSms(head + tail).slice(0, 459);
}

// ── run ──────────────────────────────────────────────────────────────────────────

const zero = (): Record<TrialAlertKind, number> => ({
  lapse_overdue: 0,
  notice_failed: 0,
  site_not_live: 0,
  continuation_stuck: 0,
  login_not_sent: 0,
});

/**
 * One watch pass: detect, drop what was already alerted, alert the rest once per kind.
 * The send side never throws; a failing detection query does (the tick reports it).
 */
export async function runTrialWatch(
  now: Date,
  deps: TrialWatchDeps = REAL_DEPS,
  opts: TrialWatchOpts = {},
): Promise<TrialWatchResult> {
  const all = await detectTrialIncidents(now, opts, deps.publicBaseUrl());
  const found = zero();
  if (all.length === 0) return { found, alerted: 0, messages: 0, noRecipient: false, failedKinds: [] };

  // Already alerted (any status) → not new. The claim below is the race-safe check; this
  // pre-filter only keeps an already-alerted incident from re-triggering the loud
  // no-recipient line every hour.
  const ledger = await db
    .selectFrom("free_trial_alert")
    .select(["free_trial_id", "kind", "ref"])
    .where("free_trial_id", "in", [...new Set(all.map((i) => i.trialId))])
    .execute();
  const seen = new Set(ledger.map((l) => `${l.free_trial_id}|${l.kind}|${l.ref}`));
  const fresh = all.filter((i) => !seen.has(`${i.trialId}|${i.kind}|${i.ref}`));
  for (const i of fresh) found[i.kind]++;
  if (fresh.length === 0) return { found, alerted: 0, messages: 0, noRecipient: false, failedKinds: [] };

  let rcpt: { email: string | null; phone: string | null };
  try {
    rcpt = await deps.recipients();
  } catch (e) {
    console.error(`[trial-watch] a riasztási címzett nem olvasható — ${fresh.length} próba-hiba NEM lett jelezve:`, e); // i18n-exempt: operátori napló
    return { found, alerted: 0, messages: 0, noRecipient: true, failedKinds: [] };
  }
  if (!rcpt.email && !rcpt.phone) {
    // LOUD and UNMARKED: nothing is claimed, the next tick tries again.
    console.error(
      `[trial-watch] ⛔ ${fresh.length} ingyenes-próba hiba (${TRIAL_ALERT_KINDS.filter((k) => found[k]).map((k) => `${k}: ${found[k]}`).join(", ")}), ` +
        `de nincs riasztási címzett (konzol /settings vagy OWNER_ALERT_PHONE) — az operátor NEM lett értesítve; a következő tick újra próbálja. ` +
        fresh.map((i) => `${i.kind} ${i.trialId} (${i.name})`).join("; "),
    ); // i18n-exempt: operátori napló
    return { found, alerted: 0, messages: 0, noRecipient: true, failedKinds: [] };
  }

  let alerted = 0;
  let messages = 0;
  const failedKinds: TrialAlertKind[] = [];
  for (const kind of TRIAL_ALERT_KINDS) {
    const candidates = fresh.filter((i) => i.kind === kind);
    if (candidates.length === 0) continue;
    const claimed: { id: string; inc: TrialIncident }[] = [];
    try {
      for (const inc of candidates) {
        const row = await db
          .insertInto("free_trial_alert")
          .values({ free_trial_id: inc.trialId, kind, ref: inc.ref, status: "claimed", detail: inc.problem.slice(0, 1000) })
          .onConflict((oc) => oc.columns(["free_trial_id", "kind", "ref"]).doNothing())
          .returning("id")
          .executeTakeFirst();
        if (row) claimed.push({ id: row.id, inc });
      }
      if (claimed.length === 0) continue; // an overlapping run took them all
      const list = claimed.map((c) => c.inc);
      const publicBaseUrl = deps.publicBaseUrl();
      const sentVia: string[] = [];
      const errors: string[] = [];
      if (rcpt.email) {
        try {
          const { subject, text } = emailFor(kind, list, publicBaseUrl);
          await deps.sendEmail({ to: rcpt.email, audience: "platform", subject, text });
          sentVia.push("e-mail");
        } catch (e) {
          errors.push(`e-mail: ${(e as Error).message}`);
        }
      }
      if (rcpt.phone) {
        try {
          const r = await deps.sendSms({ to: rcpt.phone, text: smsFor(kind, list, publicBaseUrl) });
          if (r.provider === "blocked") throw new Error("az SMS-küldő blokkolta");
          sentVia.push("SMS");
        } catch (e) {
          errors.push(`SMS: ${(e as Error).message}`);
        }
      }
      const ids = claimed.map((c) => c.id);
      if (sentVia.length === 0) {
        // Nothing left the house: release the claims so the next tick retries.
        await db.deleteFrom("free_trial_alert").where("id", "in", ids).execute();
        failedKinds.push(kind);
        console.error(`[trial-watch] ⛔ ${kind} riasztás (${list.length} próba) EGYIK csatornán sem ment ki — a következő tick újra próbálja. ${errors.join(" · ")}`); // i18n-exempt: operátori napló
        continue;
      }
      const via = `${sentVia.join(" + ")}${errors.length ? ` (hiba: ${errors.join(" · ")})` : ""}`;
      for (const c of claimed) {
        await db
          .updateTable("free_trial_alert")
          .set({ status: "sent", detail: `${via} — ${c.inc.problem}`.slice(0, 1000) })
          .where("id", "=", c.id)
          .execute();
      }
      alerted += ids.length;
      messages++;
      console.warn(`[trial-watch] ${kind}: ${list.length} próba jelezve (${sentVia.join(" + ")}) — ${list.map((i) => i.trialId).join(", ")}${errors.length ? ` · ${errors.join(" · ")}` : ""}`); // i18n-exempt: operátori napló
    } catch (e) {
      // Never let one kind's failure stop the others; release what this pass claimed.
      if (claimed.length) {
        await db.deleteFrom("free_trial_alert").where("id", "in", claimed.map((c) => c.id)).where("status", "=", "claimed").execute().catch(() => undefined);
      }
      failedKinds.push(kind);
      console.error(`[trial-watch] ⛔ ${kind} riasztás elhasalt — a következő tick újra próbálja:`, e); // i18n-exempt: operátori napló
    }
  }
  return { found, alerted, messages, noRecipient: false, failedKinds };
}
