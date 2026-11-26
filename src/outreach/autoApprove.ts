// „Országok / Árazás” 4. fázis (0155; terv assets/design-refs/console/orszagok-arazas/ ⑪4 + D12):
// the AUTOMATIC APPROVAL of the leads waiting on /jovahagyas, in the repo, per country — it replaces
// the repo-less /opt/citoviso/auto-approve.mts that a Debian crontab line ran every 20 minutes.
//
// The decision is the old script's, branch for branch (owner rules 11-11 … 11-17), each branch behind
// the country row's switch (country.dispatch_rules):
//   twoMocks       — two mocks with own photos, or with the town photo (11-11, 11-12, 11-13);
//   townNoMms      — a town-photo pair never on the MMS path (11-12);
//   emailOnly      — a lead with an e-mail gets the e-mail only, approved as soon as its mocks qualify (11-16/17);
//   uncheckedEmail — a lead whose mobile was not checked yet goes by e-mail (11-13);
//   noMailNoSend   — no e-mail, no send (11-20): enforced by the DISPATCHER (autoDispatch.dispatchOne holds
//                    the row), not here — so the approval picks exactly what the old script picked.
// The old script's „checked” set (the contact chain's done files, uploaded to /opt/citoviso/checked-ids.txt
// by the cron line) is lead.contact_checked_at, written by the chain through the console (POST /contact-checked).
//
// Only a country whose dispatch_approval is 'auto' is decided; 'owner' leaves its leads to the owner's „Mehet”.
// The whole thing runs only while outreach_auto.autoApprove is on (off by default — the cutover turns it
// on in the same step that comments out the cron line; ⛔ never both at once: double approval).
import { sql } from "kysely";
import { countryConfigSync, type CountryDispatch } from "../country.js";
import { db } from "../db/client.js";
import { decideApproval, listPendingApprovals, type PendingApproval } from "../console/approvalQueue.js";
import { getSetting, setSetting } from "../console/appSettings.js";

/** What the decision reads of one mock: its own-photo count (inputs.photos) and whether it carries the town photo. */
export interface MockFacts {
  readonly photos: number;
  readonly town: boolean;
}

export interface ApprovalFacts {
  readonly mocks: ReadonlyMap<string, MockFacts>;
  /** Leads whose mobile presence the contact chain checked. */
  readonly checked: ReadonlySet<string>;
}

export type ApprovalKind = "email" | "email-ellenorizetlen-mobil" | "email+mms" | "viber" | "whatsapp" | "mms";

export interface ApprovalPick {
  readonly item: PendingApproval;
  /** The old script's log key: „telepfoto-” prefix for a town-photo pair, then the path. */
  readonly key: string;
  readonly note: string;
}

const channelOf = (i: PendingApproval): string => i.channel.channel;
const isHeld = (i: PendingApproval): boolean => "held" in i.channel && (i.channel as { held?: boolean }).held === true;

/**
 * The decision for ONE pending lead under its country's rules — null = it waits. Pure: the same
 * function the dispatch tick runs and the equivalence check (scripts/dispatch-equivalence.mts) compares
 * with the old script.
 */
export function decideOne(i: PendingApproval, f: ApprovalFacts, rules: CountryDispatch["rules"]): ApprovalPick | null {
  const ph = (id: string | null): number => (id ? (f.mocks.get(id)?.photos ?? 0) : 0);
  const town = (id: string | null): boolean => (id ? (f.mocks.get(id)?.town ?? false) : false);
  const okPic = (id: string | null): boolean => ph(id) > 0 || town(id);
  // twoMocks off: the main mock alone decides (the second plan is still attached by the dispatcher).
  const own = rules.twoMocks ? ph(i.mainId) > 0 && !!i.altId && ph(i.altId) > 0 : ph(i.mainId) > 0;
  const townOk = rules.twoMocks ? okPic(i.mainId) && (i.altId ? okPic(i.altId) : town(i.mainId)) : okPic(i.mainId);
  const checked = f.checked.has(i.leadId);
  const ch = channelOf(i);
  const uncheckedEmail = rules.uncheckedEmail && ch === "check" && !!i.email;
  const emailLead = rules.emailOnly && !!i.email && (own || townOk);

  let ok: boolean;
  if (emailLead) ok = true;
  else if (isHeld(i) && !uncheckedEmail) ok = false;
  else if (uncheckedEmail) ok = own || townOk;
  else if (!own) {
    if (!townOk) ok = false;
    else if (ch === "viber" || ch === "whatsapp") ok = true;
    else if (ch === "mms" && !rules.townNoMms) ok = !!i.email || checked;
    else ok = ch === "email" && checked;
  } else if (ch === "viber" || ch === "whatsapp") ok = true;
  else if (ch === "mms") ok = !!i.email || checked;
  else if (ch === "email") ok = checked;
  else ok = false;
  if (!ok) return null;

  const path = emailLead ? "email" : uncheckedEmail ? "email-ellenorizetlen-mobil" : ch === "mms" && i.email ? "email+mms" : ch;
  const key = (own ? "" : "telepfoto-") + path;
  const why =
    (own ? "2 mock saját képpel — tulaj 2026-11-11" : "településfotós mock, MMS nélkül — tulaj 2026-11-12") +
    (emailLead ? "; e-mailes lead csak e-mailt kap — tulaj 2026-11-16/17" : uncheckedEmail ? "; e-mail, Viber+WhatsApp áll — tulaj 2026-11-13" : "");
  return { item: i, key, note: `automata jóváhagyás (${key}), ${why} — az ország szabálylistája (Kiküldés fül)` };
}

/** The facts of the pending list: the mocks' own-photo counts / town photo, and the checked leads. */
export async function approvalFacts(items: readonly PendingApproval[]): Promise<ApprovalFacts> {
  const ids = [...new Set(items.flatMap((i) => [i.mainId, i.altId].filter((x): x is string => !!x)))];
  const mocks = new Map<string, MockFacts>();
  if (ids.length) {
    for (const r of await db.selectFrom("mock_artifact").select(["id", "inputs"]).where("id", "in", ids).execute()) {
      mocks.set(r.id, {
        photos: Number((r.inputs as { photos?: unknown } | null)?.photos ?? 0) || 0,
        // The old script's test, kept literally: the inputs mention a townPhoto anywhere.
        town: JSON.stringify(r.inputs ?? {}).includes("townPhoto"),
      });
    }
  }
  const leadIds = [...new Set(items.map((i) => i.leadId))];
  const checked = new Set<string>();
  if (leadIds.length) {
    for (const r of await db.selectFrom("lead").select("id").where("id", "in", leadIds).where("contact_checked_at", "is not", null).execute()) {
      checked.add(r.id);
    }
  }
  return { mocks, checked };
}

export interface AutoApproveRun {
  readonly pending: number;
  /** Leads of an 'auto' country that passed their rules. */
  readonly picks: readonly ApprovalPick[];
  /** Leads left for the owner (their country is 'owner' or has no row). */
  readonly ownerLeft: number;
  readonly approved: number;
  readonly by: Readonly<Record<string, number>>;
}

/** Decide the pending list. `go` false = dry (nothing is written). */
export async function runAutoApprove(opts: { readonly go: boolean }): Promise<AutoApproveRun> {
  const all = await listPendingApprovals();
  const facts = await approvalFacts(all);
  const picks: ApprovalPick[] = [];
  let ownerLeft = 0;
  for (const i of all) {
    const d = countryConfigSync(i.country || null)?.dispatch;
    if (!d || d.approval !== "auto") {
      ownerLeft++;
      continue;
    }
    const p = decideOne(i, facts, d.rules);
    if (p) picks.push(p);
  }
  const by: Record<string, number> = {};
  let approved = 0;
  for (const p of picks) {
    by[p.key] = (by[p.key] ?? 0) + 1;
    if (opts.go && (await decideApproval(p.item.leadId, true, p.note))) approved++;
  }
  return { pending: all.length, picks, ownerLeft, approved, by };
}

/** app_setting: the last automatic approval run (ISO time) — the tick decides at most every 20 minutes, as the cron did. */
export const AUTO_APPROVE_LAST_KEY = "auto_approve_last_run";
const EVERY_MS = 20 * 60_000;

/**
 * The dispatch tick's hook: runs the approval when it is due (≥ 20 minutes since the last run). The
 * caller checks outreach_auto.autoApprove. Returns null when not due.
 */
export async function autoApproveIfDue(now: Date): Promise<AutoApproveRun | null> {
  const last = await getSetting(AUTO_APPROVE_LAST_KEY);
  if (last && now.getTime() - Date.parse(last) < EVERY_MS) return null;
  // Stamp first: an overlapping tick sees a fresh stamp and skips (decideApproval is idempotent anyway).
  await setSetting(AUTO_APPROVE_LAST_KEY, now.toISOString());
  const run = await runAutoApprove({ go: true });
  const stamp = now.toLocaleString("hu-HU", { timeZone: "Europe/Budapest" });
  console.log(`[auto-approve] ${stamp} pending=${run.pending} pick=${run.picks.length} ${JSON.stringify(run.by)} approved=${run.approved} owner=${run.ownerLeft}`); // i18n-exempt: operátori napló
  return run;
}

/** Mark leads as „contact chain checked” (POST /contact-checked, scripts/contact-checked-import.mts). Idempotent. */
export async function markContactChecked(leadIds: readonly string[], at: Date = new Date()): Promise<number> {
  const ids = [...new Set(leadIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  let n = 0;
  for (let k = 0; k < ids.length; k += 1000) {
    const chunk = ids.slice(k, k + 1000);
    const r = await db
      .updateTable("lead")
      .set({ contact_checked_at: sql`coalesce(contact_checked_at, ${at})` as never })
      .where("id", "in", chunk)
      .where("contact_checked_at", "is", null)
      .executeTakeFirst();
    n += Number(r.numUpdatedRows ?? 0);
  }
  return n;
}
