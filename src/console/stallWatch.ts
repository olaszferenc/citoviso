// STALL WATCH — the house hears about an EXTERNAL process that stopped moving
// (ADR-0374; owner 2026-09-30: "ha valamely külső folyamat megakad, arról jöjjön
// értesítés + SMS: ha a tenant fizetési folyamata megakad, ha a saját domain regisztrálás
// nem megy le, ha a számlázás nem megy, ha valamelyik API kulcs hal meg stb.").
//
// What was blind before this (measured from the code 2026-10-13, _planning/DEPLOY-READY.md 4b.3):
//   ① a payment left 'pending' — the buyer went to the gateway, no webhook came back, and
//     our row only refreshed when the buyer came back by himself;
//   ② a domain beszerzés stuck in pending / registering / registered (the 0107 clock only
//     starts at dns_pending);
//   ③ the SMS queue not draining — the dev-box relay (modem) dead, every SMS of prod waits;
//   ④ an iCal portal link failing for a day — the OWNER was mailed (0106), the house not;
//   ⑤ a dead API key — nothing anywhere said so. Places / Brave / Websupport / SMTP report
//     their 401/403 through reportCredentialFailure() at the call site; Anthropic has 18
//     call sites and no shared client, so its key is PROBED here (GET /v1/models is free).
//
// STATE, not events: the sweep runs in the hourly tick (scripts/offer-followup.mts) and
// reads what is stuck NOW. One incident = one alert: the house_alert_once key is claimed
// BEFORE alerting and released when no channel carried it (the next hour retries). One
// alert per kind per tick, listing every new case.
//
// Severe (mail + filtered SMS, src/console/houseAlert.ts): ① ② ⑤. Mail only: ③ (an SMS
// would wait in the very queue that is stuck) and ④ (the owner already got a letter).
//
// Operator text — outside the §B.18 customer-facing i18n scope.

import { config } from "../config.js";
import { db } from "../db/client.js";
import { isLiveHost } from "../invoicing/keyGuard.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { alertHouse, type HouseAlert } from "./houseAlert.js";

/** A pending payment older than this was not closed by the gateway (Barion expires a checkout in 30 min). */
export const PAYMENT_STUCK_MINUTES = 60;
/** Older pending rows are history, not a live buyer — the first run after a deploy must not flood. */
export const PAYMENT_LOOKBACK_DAYS = 7;
/** pending / registering / registered take minutes (the resume timer runs every 2 min). */
export const DOMAIN_STALL_HOURS = 2;
/** An SMS queued this long: the relay (the dev box with the modem) is not draining. */
export const SMS_QUEUE_STALL_MINUTES = 30;
/** An import link failing this long (the owner's own letter goes at the same mark, 0106). */
export const ICAL_STALL_HOURS = 24;

/** ADR-XXXX: a .hu name bought this long ago with no registry confirmation mail = the registrar did not file it. */
export const REGISTRY_CONFIRM_HOURS = 2;

export type StallKind = "payment" | "domain" | "sms-queue" | "ical" | "api-key" | "registry" | "registrar";

export interface StallWatchDeps {
  /** Ask the gateway about a pending payment (the same idempotent path /pay/done runs). */
  refreshPayment(gatewayRef: string): Promise<void>;
  /** Payments of these gateways are asked; a mock payment has no gateway state to ask. */
  gateways: readonly string[];
  /** The Anthropic key probe: HTTP status of GET /v1/models, or null (no key / no network). */
  probeAnthropic(): Promise<number | null>;
  alert(a: HouseAlert): Promise<boolean>;
  /** Live-host override for the key alert (the guard); default isLiveHost(config.publicBaseUrl). */
  live?: boolean;
  /**
   * ADR-XXXX: the registrar account's pre-flight (null = no live registrar here, nothing to
   * measure). Default: the memoized live adapter; the guard injects a verdict.
   */
  registrarReady?(): Promise<{ ok: boolean; problems: readonly string[]; facts: readonly string[] } | null>;
  /** ADR-XXXX: did a .hu confirmation link arrive since `since`? Default: the mailbox watcher's state. */
  confirmLinkSeenSince?(since: Date): Promise<boolean>;
}

export const realStallDeps: StallWatchDeps = {
  refreshPayment: async (ref) => {
    const { handleWebhook } = await import("../payment/service.js");
    await handleWebhook({ paymentId: ref }, {});
  },
  gateways: ["barion"],
  probeAnthropic: async () => {
    const key = config.anthropicApiKey;
    if (!key) return null; // not configured here ≠ dead
    try {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(15_000),
      });
      return r.status;
    } catch {
      return null; // a network hiccup is not a dead key
    }
  },
  alert: alertHouse,
  registrarReady: async () => {
    const { isMockDomainProvisioning } = await import("../domains/provisionDomain.js");
    if (isMockDomainProvisioning()) return null;
    const { registrarReadiness } = await import("../domains/registrar/index.js");
    return registrarReadiness();
  },
  confirmLinkSeenSince: async (since) => {
    // Lazy: the watcher module (IMAP) stays out of every stall-watch import.
    const { confirmLinkSeenSince } = await import("../domains/registryConfirmWatch.js");
    return confirmLinkSeenSince(since);
  },
};

/** Claim an incident key; false = it was already alerted (or another run holds it). */
export async function claimOnce(key: string, tag: string): Promise<boolean> {
  const row = await db
    .insertInto("house_alert_once")
    .values({ key, tag })
    .onConflict((oc) => oc.column("key").doNothing())
    .returning("key")
    .executeTakeFirst();
  return row !== undefined;
}

async function releaseOnce(keys: readonly string[]): Promise<void> {
  if (keys.length) await db.deleteFrom("house_alert_once").where("key", "in", keys).execute();
}

interface Case {
  readonly key: string;
  readonly line: string;
}

/** Claim the new cases, send ONE alert for them, release the claims if it did not go out. */
async function alertNew(
  deps: StallWatchDeps,
  kind: StallKind,
  cases: readonly Case[],
  build: (lines: readonly string[]) => HouseAlert,
): Promise<{ alerted: number; failed: boolean }> {
  const fresh: Case[] = [];
  for (const c of cases) if (await claimOnce(c.key, kind)) fresh.push(c);
  if (!fresh.length) return { alerted: 0, failed: false };
  const ok = await deps.alert(build(fresh.map((c) => c.line)));
  if (!ok) {
    await releaseOnce(fresh.map((c) => c.key));
    console.error(`[stall-watch:${kind}] ${fresh.length} eset riasztása NEM ment ki — a következő futás újrapróbálja`);
    return { alerted: 0, failed: true };
  }
  return { alerted: fresh.length, failed: false };
}

const ago = (now: Date, minutes: number): Date => new Date(now.getTime() - minutes * 60_000);
const iso = (t: unknown): string => new Date(t as string).toISOString().replace("T", " ").slice(0, 16) + " UTC";

// ── ① payments ──────────────────────────────────────────────────────────────────────

async function sweepPayments(now: Date, deps: StallWatchDeps): Promise<{ stuck: Case[]; recovered: Case[] }> {
  if (!deps.gateways.length) return { stuck: [], recovered: [] };
  const rows = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "payment.id as id",
      "payment.gateway as gateway",
      "payment.gateway_ref as ref",
      "payment.amount as amount",
      "payment.currency as currency",
      "payment.created_at as createdAt",
      "order_intent.kind as kind",
      "order_intent.buyer_email as email",
      "lead.name as leadName",
    ])
    .where("payment.status", "=", "pending")
    .where("payment.gateway", "in", deps.gateways)
    .where("payment.gateway_ref", "is not", null)
    .where("payment.created_at", "<", ago(now, PAYMENT_STUCK_MINUTES) as never)
    .where("payment.created_at", ">", ago(now, PAYMENT_LOOKBACK_DAYS * 24 * 60) as never)
    .orderBy("payment.created_at", "asc")
    .execute();
  const stuck: Case[] = [];
  const recovered: Case[] = [];
  for (const r of rows) {
    let refreshError: string | null = null;
    try {
      await deps.refreshPayment(r.ref!);
    } catch (e) {
      refreshError = (e as Error)?.message ?? String(e);
    }
    const after = await db.selectFrom("payment").select("status").where("id", "=", r.id).executeTakeFirst();
    const desc =
      `${r.leadName ?? "?"} · ${r.amount} ${r.currency} · ${r.kind} · vevő ${r.email ?? "?"} · ` +
      `indult ${iso(r.createdAt)} · payment ${r.id} · ${r.gateway} ${r.ref}`;
    if (after?.status === "pending") {
      stuck.push({
        key: `payment-stuck:${r.id}`,
        line: `- ${desc}${refreshError ? ` · a szolgáltató lekérdezése HIBÁS: ${refreshError}` : " · a szolgáltató szerint is folyamatban"}`,
      });
    } else if (after?.status === "paid") {
      recovered.push({ key: `payment-recovered:${r.id}`, line: `- ${desc}` });
    }
    // failed / cancelled: the buyer abandoned the checkout — the gateway closed it, nothing to do.
  }
  return { stuck, recovered };
}

// ── ② domains ───────────────────────────────────────────────────────────────────────

async function sweepDomains(now: Date): Promise<Case[]> {
  const rows = await db
    .selectFrom("domain_provisioning")
    .select(["id", "domain", "status", "tenant_id as tenantId", "created_at as createdAt", "error"])
    .where("status", "in", ["pending", "registering", "registered"])
    .where("created_at", "<", ago(now, DOMAIN_STALL_HOURS * 60) as never)
    .orderBy("created_at", "asc")
    .execute();
  return rows.map((r) => ({
    key: `domain-stall:${r.id}:${r.status}`,
    line:
      `- ${r.domain} · '${r.status}' · indult ${iso(r.createdAt)} · tenant ${r.tenantId} · beszerzés ${r.id}` +
      (r.error ? ` · utolsó hiba: ${r.error}` : ""),
  }));
}

// ── ②b the .hu registry confirmation (ADR-XXXX) ─────────────────────────────────────
//
// A bought .hu name waits in dns_pending for the registry's confirmation mail — measured:
// minutes (citoviso.hu, 2026-09-06 21:27 → same evening), NEVER (overseer.hu, 2026-10-21:
// the registrar did not file because our profile lacked an identifier; the only signal was
// a support mail 16 hours later). No link within REGISTRY_CONFIRM_HOURS of the purchase is
// the registrar's problem, not the registry's pace — the house hears it then, not at the
// 24 h mark. A row the registrar already wrote about (registrar_note_at) is in human hands.

async function sweepRegistryConfirmation(now: Date, deps: StallWatchDeps): Promise<Case[]> {
  const rows = await db
    .selectFrom("domain_provisioning")
    .select(["id", "domain", "waiting_since as waitingSince", "tenant_id as tenantId", "registrar_ref as registrarRef"])
    .where("status", "=", "dns_pending")
    .where("domain", "like", "%.hu")
    .where("ns_active_at", "is", null)
    .where("registrar_note_at", "is", null)
    .where("waiting_since", "<", ago(now, REGISTRY_CONFIRM_HOURS * 60) as never)
    .orderBy("waiting_since", "asc")
    .execute();
  const seen = deps.confirmLinkSeenSince ?? realStallDeps.confirmLinkSeenSince!;
  const out: Case[] = [];
  for (const r of rows) {
    const since = new Date(r.waitingSince as unknown as string);
    if (await seen(since)) continue;
    const hours = Math.floor((now.getTime() - since.getTime()) / 3_600_000);
    out.push({
      key: `domain-registry:${r.id}`,
      line: `- ${r.domain} · megvéve ${iso(r.waitingSince)} (${hours} órája) · regisztrátor-rendelés ${r.registrarRef ?? "?"} · tenant ${r.tenantId} · beszerzés ${r.id}`,
    });
  }
  return out;
}

// ── ②c the registrar account itself (ADR-XXXX) ─────────────────────────────────────
//
// Asked hourly, not only at a purchase: the gap (no identifier on the domain profile, 0
// credit, ToS pending) must surface BEFORE a customer pays. One alert per problem-set per
// day; a changed problem-set is a new alert.

async function sweepRegistrarReadiness(now: Date, deps: StallWatchDeps): Promise<Case[]> {
  const ask = deps.registrarReady ?? realStallDeps.registrarReady!;
  let r: { ok: boolean; problems: readonly string[]; facts: readonly string[] } | null;
  try {
    r = await ask();
  } catch (e) {
    r = { ok: false, problems: [`a készenlét-ellenőrzés hibázott: ${(e as Error).message}`], facts: [] };
  }
  if (!r || r.ok) return [];
  const day = budapestIsoDay(now);
  const sig = r.problems.join("|").length.toString(36) + ":" + r.problems.length;
  return [
    {
      key: `registrar-ready:${day}:${sig}`,
      line: r.problems.map((p) => `- ${p}`).join("\n") + (r.facts.length ? `\n\nMért tények:\n${r.facts.map((f) => `- ${f}`).join("\n")}` : ""),
    },
  ];
}

// ── ③ SMS queue ─────────────────────────────────────────────────────────────────────

async function sweepSmsQueue(now: Date): Promise<Case[]> {
  const rows = await db
    .selectFrom("sms_outbox")
    .select(["id", "status", "created_at as createdAt"])
    .where("status", "in", ["queued", "sending"])
    .where("created_at", "<", ago(now, SMS_QUEUE_STALL_MINUTES) as never)
    .orderBy("created_at", "asc")
    .execute();
  if (!rows.length) return [];
  // ONE incident per backlog: keyed by its oldest row — the next backlog (after this one
  // drained) is a new incident, the same backlog an hour later is not.
  const oldest = rows[0]!;
  return [
    {
      key: `sms-queue:${oldest.id}`,
      line: `- ${rows.length} SMS vár a sorban; a legrégebbi ${iso(oldest.createdAt)} óta (${oldest.status})`,
    },
  ];
}

// ── ④ iCal ──────────────────────────────────────────────────────────────────────────

async function sweepIcal(now: Date): Promise<Case[]> {
  const rows = await db
    .selectFrom("calendar_link")
    .select(["id", "unit_id as unitId", "provider", "failing_since as failingSince", "last_ok_at as lastOk", "last_error as lastError"])
    .where("direction", "=", "import")
    .where("failing_since", "is not", null)
    .where("failing_since", "<", ago(now, ICAL_STALL_HOURS * 60) as never)
    .execute();
  return rows.map((r) => ({
    // Per failure STREAK: a link that heals and breaks again is a new incident.
    key: `ical:${r.id}:${new Date(r.failingSince as unknown as string).toISOString()}`,
    line:
      `- ${r.provider} · egység ${r.unitId} · link ${r.id} · hibás ${iso(r.failingSince)} óta` +
      ` · utolsó sikeres: ${r.lastOk ? iso(r.lastOk) : "soha"}${r.lastError ? ` · ${r.lastError}` : ""}`,
  }));
}

// ── ⑤ API keys ──────────────────────────────────────────────────────────────────────

/** Where each key lives — the alert names the fix, not just the fault. */
const KEY_HOME: Record<string, string> = {
  places: "GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_GENERATOR_KEY (Google Cloud konzol → Hitelesítő adatok)",
  brave: "BRAVE_API_KEY (Brave Search API fiók)",
  websupport: "WEBSUPPORT_API_KEY / WEBSUPPORT_API_SECRET (Websupport fiók → API)",
  smtp: "SMTP_URL (a levelező fiók jelszava / alkalmazás-jelszava)",
  anthropic: "ANTHROPIC_API_KEY (Anthropic konzol → API keys)",
};

const credentialMemo = new Set<string>();

/**
 * A provider answered 401/403: its key is dead or revoked. Once per provider per Budapest
 * day (house_alert_once), mail + SMS. Never throws, never blocks the caller beyond one
 * insert — call it fire-and-forget (`void reportCredentialFailure(…)`) from the hot path.
 */
export async function reportCredentialFailure(
  provider: string,
  detail: string,
  opts: { now?: Date; alert?: (a: HouseAlert) => Promise<boolean>; live?: boolean } = {},
): Promise<boolean> {
  const key = `api-key:${provider}:${budapestIsoDay(opts.now ?? new Date())}`;
  // LIVE HOST ONLY: the guards stub 401/403 answers on the dev box (places-outage-check);
  // a dead DEV key is the developer's to see in the log, not a house alarm.
  if (!(opts.live ?? isLiveHost(config.publicBaseUrl))) {
    console.error(`[api-key] ${provider}: hitelesítési hiba (401/403) — nem éles host, riasztás nincs: ${detail.slice(0, 200)}`);
    return false;
  }
  try {
    if (credentialMemo.has(key)) return false;
    if (!(await claimOnce(key, "api-key"))) {
      credentialMemo.add(key);
      return false;
    }
    const ok = await (opts.alert ?? alertHouse)({
      tag: "api-key",
      sms: true,
      smsKey: `api-key:${provider}`,
      subject: `Citoviso: API-kulcs elutasítva (401/403) — ${provider}`,
      text:
        `A(z) ${provider} szolgáltató hitelesítési hibával utasította el a hívásunkat — a kulcs ` +
        `lejárt, visszavonták, vagy a fiók korlátozott. Ami erre a szolgáltatóra épül, most nem működik.\n\n` +
        `Részlet: ${detail.slice(0, 500)}\n\n` +
        `Hol van a kulcs: ${KEY_HOME[provider] ?? "a .env megfelelő sora"}\n` +
        `Teendő: új kulcs a szolgáltatónál, a .env frissítése, majd a szolgáltatások újraindítása.\n` +
        `Ma erről a szolgáltatóról több riasztás nem jön.\n`,
    });
    if (!ok) await releaseOnce([key]);
    else credentialMemo.add(key);
    return ok;
  } catch (e) {
    console.error(`[stall-watch:api-key] ${provider} kulcs-hiba jelzése elhasalt:`, e);
    return false;
  }
}

// ── the sweep ───────────────────────────────────────────────────────────────────────

export interface StallWatchResult {
  readonly alerted: Partial<Record<StallKind | "payment-recovered", number>>;
  /** Kinds whose alert could not go out (the tick then exits non-zero). */
  readonly failedKinds: string[];
}

export async function runStallWatch(now: Date, deps: StallWatchDeps = realStallDeps): Promise<StallWatchResult> {
  const alerted: Record<string, number> = {};
  const failedKinds: string[] = [];
  const note = (kind: string, r: { alerted: number; failed: boolean }): void => {
    if (r.alerted) alerted[kind] = r.alerted;
    if (r.failed) failedKinds.push(kind);
  };

  const pay = await sweepPayments(now, deps);
  note(
    "payment",
    await alertNew(deps, "payment", pay.stuck, (lines) => ({
      tag: "payment-stuck",
      sms: true,
      smsKey: "payment-stuck",
      subject: `Citoviso: ${lines.length} fizetés megakadt (${PAYMENT_STUCK_MINUTES} percnél régebben függőben)`,
      text:
        `A vevő elindította a fizetést, de a fizetési szolgáltató ${PAYMENT_STUCK_MINUTES} perc után sem zárta le, ` +
        `és visszahívás (webhook) sem jött. A rendelés nem aktiválódott, a vevő vár — vagy fizetett, és nem tudunk róla.\n\n` +
        `${lines.join("\n")}\n\n` +
        `Teendő: a szolgáltató (Barion) felületén nézd meg a fizetést. Kikeresés: npx tsx scripts/find-payment.mts <azonosító>. ` +
        `Ha ott sikeres, a lead-lapon aktiválás kézzel; ha ott sincs nyoma, a vevővel egyeztess.\n`,
    })),
  );
  note(
    "payment-recovered",
    await alertNew(deps, "payment", pay.recovered, (lines) => ({
      tag: "payment-recovered",
      subject: `Citoviso: ${lines.length} sikeres fizetésről nem jött visszahívás — a söprés pótolta`,
      text:
        `Ezek a fizetések a szolgáltatónál SIKERESEK voltak, de a visszahívás (webhook) nem érkezett meg; ` +
        `az óránkénti söprés lekérdezte és lefuttatta az aktiválást.\n\n${lines.join("\n")}\n\n` +
        `Teendő: nézd meg, hogy az aktiválás és a számla rendben van-e; ha ez ismétlődik, a webhook-cím ` +
        `(Barion → CallbackUrl) vagy a nyilvános végpont elérhetősége hibás.\n`,
    })),
  );

  note(
    "domain",
    await alertNew(deps, "domain", await sweepDomains(now), (lines) => ({
      tag: "domain-stall",
      sms: true,
      smsKey: "domain-stall",
      subject: `Citoviso: ${lines.length} domain-beszerzés áll (${DOMAIN_STALL_HOURS} óránál régebben a regisztrációnál)`,
      text:
        `A vevő kifizette (vagy zárolta) a saját domain díját, de a beszerzés ${DOMAIN_STALL_HOURS} óra után sem jutott ` +
        `túl a regisztráción. Ez percek kérdése szokott lenni.\n\n${lines.join("\n")}\n\n` +
        `Teendő: journalctl -u citoviso-domain-resume -n 100; a regisztrátor (Websupport) fiók és egyenleg ` +
        `megnézése, majd  npx tsx scripts/resume-domains.mts\n`,
    })),
  );

  note(
    "registry",
    await alertNew(deps, "registry", await sweepRegistryConfirmation(now, deps), (lines) => ({
      tag: "domain-registry",
      sms: true,
      smsKey: "domain-registry",
      subject: `Citoviso: ${lines.length} .hu név megvéve, de ${REGISTRY_CONFIRM_HOURS} óra alatt nem jött a Nyilvántartó megerősítő levele`,
      text:
        `A nevet megvettük és kifizettük a regisztrátornál, de a .hu Nyilvántartó megerősítő levele (cfm.drr.hu) ` +
        `${REGISTRY_CONFIRM_HOURS} órán belül NEM érkezett a postafiókba (INBOX + Spam). Mérve: rendben menő igénylésnél ` +
        `a levél PERCEKEN belül jön — ha nem jön, a regisztrátor nem adta be (hiányos domain-profil, elemzői elbírálás), ` +
        `és a vevő képernyője hiába ígér holnapot.\n\n${lines.join("\n")}\n\n` +
        `Teendő: a postafiók (olasz.ferenc@citoviso.com) support-levelei a Websupporttól; a Websupport Webadminban a ` +
        `domain-profil (azonosító!) és a rendelés állapota; ha semmi, ticket a supportnak a rendelés-azonosítóval. ` +
        `A gép a megerősítő linkre továbbra is riaszt, ha megjön.\n`,
    })),
  );

  note(
    "registrar",
    await alertNew(deps, "registrar", await sweepRegistrarReadiness(now, deps), (lines) => ({
      tag: "registrar-ready",
      sms: true,
      smsKey: "registrar-ready",
      subject: "Citoviso: a regisztrátor-fiókunk NEM tud domaint regisztrálni — a következő vevő rendelése elakadna",
      text:
        `Az óránkénti ellenőrzés szerint a regisztrátor-fiók (Websupport) hiányos, ezért a következő saját-domain ` +
        `vétel NEM indulna el (a sor pending maradna, a vevő várna).\n\n${lines.join("\n")}\n\n` +
        `Teendő: a Websupport Webadmin → fiók / domain-profil kiegészítése (az azonosító a .hu Nyilvántartónak kell), ` +
        `kredit feltöltése, ÁSZF megerősítése. A fiók 10 percen belül újra mérődik; ez a levél naponta egyszer jön, amíg a hiány áll.\n`,
    })),
  );

  note(
    "sms-queue",
    await alertNew(deps, "sms-queue", await sweepSmsQueue(now), (lines) => ({
      tag: "sms-queue",
      subject: `Citoviso: az SMS-sor nem ürül (${SMS_QUEUE_STALL_MINUTES} percnél régebbi SMS vár)`,
      text:
        `Az éles rendszer SMS-ei sorban állnak, a modem-gép relaya nem viszi ki őket ` +
        `(a gép, a modem vagy a relay-időzítő áll). Riasztó SMS sem megy ki, amíg ez tart.\n\n${lines.join("\n")}\n\n` +
        `Teendő a modemes dev gépen: systemctl --user status citoviso-sms-relay.timer (vagy a rendszer-egység), ` +
        `journalctl -u citoviso-sms-relay -n 50; a docs/mms-send.md „Hibák” szakasza.\n`,
    })),
  );

  note(
    "ical",
    await alertNew(deps, "ical", await sweepIcal(now), (lines) => ({
      tag: "ical-stall",
      subject: `Citoviso: ${lines.length} naptár-szinkron ${ICAL_STALL_HOURS} órája hibás`,
      text:
        `Egy szállás portál-naptárának (iCal) behúzása ${ICAL_STALL_HOURS} órája folyamatosan hibázik — a ` +
        `portálon lefoglalt napok nálunk szabadnak látszhatnak (dupla foglalás veszélye). A tulaj levelet kapott.\n\n` +
        `${lines.join("\n")}\n\n` +
        `Teendő: a link megnyitása böngészőben; ha a portál cserélte, a tulajjal az új linket felvenni.\n`,
    })),
  );

  const status = await deps.probeAnthropic();
  if (status === 401 || status === 403) {
    const ok = await reportCredentialFailure("anthropic", `GET /v1/models → HTTP ${status}`, {
      now,
      alert: deps.alert,
      ...(deps.live === undefined ? {} : { live: deps.live }),
    });
    if (ok) alerted["api-key"] = 1;
  }

  return { alerted, failedKinds };
}

/** Test seam: forget the per-process credential memo (the guard runs several days in one process). */
export function resetCredentialMemo(): void {
  credentialMemo.clear();
}
