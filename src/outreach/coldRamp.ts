// The cold lane's RAMP and BRAKE (owner, 2026-11-18: "több ezer darabot akarok kiküldeni NAPONTA",
// on a sending domain that is one day old).
//
// A fresh domain has no sending history, and Gmail's guideline is explicit: "Avoid introducing
// sudden volume spikes if you do not have a history of sending large volumes." So the daily
// e-mail volume CLIMBS: `startCap` on the first working day, +`growthPct` every working day,
// never above `maxCap` (100 → +30%/day reaches 2 000 in ~12 working days). All countries count
// together — the reputation is the DOMAIN's, not a market's.
//
// The brake reads what the recipients did. The 24-hour view rate of the previous working day's
// e-mail sends (mock_view, bots excluded — the same measure that showed 21–39% healthy and
// 0–1% in spam on 2026-11-16..18) decides once per day, before the first send:
//   < STOP_BELOW   → the switch goes OFF and the house is alerted (mail + SMS);
//   < FREEZE_BELOW → the cap stops growing (holdCap = today's cap) and the house is alerted;
//   ≥ RELEASE_ABOVE with a hold in place → the hold is lifted.
// Fewer than MIN_SAMPLE sends → no verdict (a quiet day is not evidence). Gmail recipients are
// judged on their own when there are enough of them: that is where the reputation broke.
import { sql } from "kysely";
import { db } from "../db/client.js";
import { alertHouse } from "../console/houseAlert.js";
import { MOCK_OUTREACH_WINDOW } from "../sms/sendWindow.js";
import { budapestDayEnd, budapestIsoDay, budapestMidnight, budapestMinutes } from "../text/budapestTime.js";

export interface ColdRamp {
  /** First working day of the ramp (Budapest calendar day, YYYY-MM-DD). */
  readonly startDay: string;
  /** Leads per day on the first day. */
  readonly startCap: number;
  /** Growth per WORKING day, percent (30 = ×1.3). */
  readonly growthPct: number;
  /** The ceiling the ramp never exceeds. */
  readonly maxCap: number;
  /** Brake: the ramp may not exceed this until released (null/absent = no hold). */
  readonly holdCap?: number | null;
  /** The Budapest day the brake last judged — one verdict per day. */
  readonly judgedDay?: string | null;
}

export const RAMP_MIN_SAMPLE = 30;
export const RAMP_STOP_BELOW = 0.04;
export const RAMP_FREEZE_BELOW = 0.1;
export const RAMP_RELEASE_ABOVE = 0.15;
/** The dispatch timer's cadence (citoviso-outreach-dispatch.timer: OnCalendar=*:0/2). */
const TICK_MINUTES = 2;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored ramp, validated; anything malformed → null (no ramp, the static caps hold). */
export function parseColdRamp(raw: unknown): ColdRamp | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const startDay = typeof r.startDay === "string" && ISO_DAY.test(r.startDay) ? r.startDay : null;
  const startCap = Number(r.startCap);
  const growthPct = Number(r.growthPct);
  const maxCap = Number(r.maxCap);
  if (!startDay || !Number.isInteger(startCap) || startCap < 1 || !Number.isFinite(growthPct) || growthPct < 0 || !Number.isInteger(maxCap) || maxCap < startCap) {
    return null;
  }
  const holdCap = Number.isInteger(r.holdCap) && (r.holdCap as number) >= 0 ? (r.holdCap as number) : null;
  const judgedDay = typeof r.judgedDay === "string" && ISO_DAY.test(r.judgedDay) ? r.judgedDay : null;
  return { startDay, startCap, growthPct, maxCap, holdCap, judgedDay };
}

function isWorkingDay(isoDay: string): boolean {
  const wd = new Date(`${isoDay}T00:00:00Z`).getUTCDay();
  return wd >= 1 && wd <= 5;
}

function shiftDay(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Working days (Mon–Fri) strictly after `startDay` up to and including `today`; 0 on/before the start. */
export function workingDaysAfter(startDay: string, today: string): number {
  if (today <= startDay) return 0;
  let n = 0;
  for (let d = shiftDay(startDay, 1); d <= today; d = shiftDay(d, 1)) if (isWorkingDay(d)) n++;
  return n;
}

/** The previous working day before `today` (Budapest calendar). */
export function previousWorkingDay(today: string): string {
  let d = shiftDay(today, -1);
  while (!isWorkingDay(d)) d = shiftDay(d, -1);
  return d;
}

/** Today's ceiling: start × growth^(working days), capped by maxCap and by a brake hold. */
export function rampCapOn(ramp: ColdRamp, today: string): number {
  const grown = Math.round(ramp.startCap * Math.pow(1 + ramp.growthPct / 100, workingDaysAfter(ramp.startDay, today)));
  let cap = Math.min(ramp.maxCap, grown);
  if (ramp.holdCap != null) cap = Math.min(cap, ramp.holdCap);
  return cap;
}

/**
 * How many leads THIS timer firing may send so the day's remainder spreads evenly over the
 * remaining window (Budapest 08:00–toHour) instead of leaving in one burst — measured
 * 2026-11-16: 180 Gmail letters in two morning hours preceded the collapse. 0 when the cap is
 * reached; the last slots take what is left.
 */
export function tickAllowance(now: Date, ramp: ColdRamp, sentToday: number): number {
  const remaining = rampCapOn(ramp, budapestIsoDay(now)) - sentToday;
  if (remaining <= 0) return 0;
  const minutesLeft = Math.max(1, MOCK_OUTREACH_WINDOW.toHour * 60 - budapestMinutes(now));
  const slots = Math.max(1, Math.floor(minutesLeft / TICK_MINUTES));
  return Math.min(remaining, Math.ceil(remaining / slots));
}

export interface ColdHealth {
  readonly day: string;
  readonly sent: number;
  readonly viewed: number;
  readonly gmailSent: number;
  readonly gmailViewed: number;
}

/** E-mail sends of one Budapest day and how many were viewed (non-bot) within 24 hours. */
export async function coldHealthOf(day: string): Promise<ColdHealth> {
  const from = budapestMidnight(day);
  const to = budapestDayEnd(day);
  const r = await sql<{ sent: string; viewed: string; gsent: string; gviewed: string }>`
    select count(*) as sent,
           count(*) filter (where v.seen) as viewed,
           count(*) filter (where p.gmail) as gsent,
           count(*) filter (where p.gmail and v.seen) as gviewed
    from (
      select p.id, p.email_sent_at,
             lower(split_part(p.contact_email, '@', 2)) in ('gmail.com', 'googlemail.com') as gmail
      from prospect p
      where p.email_sent_at >= ${from} and p.email_sent_at <= ${to} and p.contact_email is not null
    ) p
    cross join lateral (
      select exists (
        select 1 from mock_view v
        where v.prospect_id = p.id and coalesce(v.device, '') <> 'bot'
          and v.started_at between p.email_sent_at and p.email_sent_at + interval '24 hours'
      ) as seen
    ) v
  `.execute(db);
  const row = r.rows[0];
  return {
    day,
    sent: Number(row?.sent ?? 0),
    viewed: Number(row?.viewed ?? 0),
    gmailSent: Number(row?.gsent ?? 0),
    gmailViewed: Number(row?.gviewed ?? 0),
  };
}

export type BrakeVerdict =
  | { readonly kind: "no-data"; readonly sent: number }
  | { readonly kind: "ok" | "stop" | "freeze" | "release"; readonly basis: "gmail" | "all"; readonly sent: number; readonly rate: number };

/** The pure verdict on one day's health; `held` = a hold is currently in place. */
export function judgeColdHealth(h: ColdHealth, held: boolean): BrakeVerdict {
  const basis: "gmail" | "all" | null = h.gmailSent >= RAMP_MIN_SAMPLE ? "gmail" : h.sent >= RAMP_MIN_SAMPLE ? "all" : null;
  if (!basis) return { kind: "no-data", sent: h.sent };
  const sent = basis === "gmail" ? h.gmailSent : h.sent;
  const rate = (basis === "gmail" ? h.gmailViewed : h.viewed) / sent;
  if (rate < RAMP_STOP_BELOW) return { kind: "stop", basis, sent, rate };
  if (rate < RAMP_FREEZE_BELOW) return { kind: "freeze", basis, sent, rate };
  if (held && rate >= RAMP_RELEASE_ABOVE) return { kind: "release", basis, sent, rate };
  return { kind: "ok", basis, sent, rate };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/**
 * Once per Budapest day, before the first send: judge the previous working day and apply the
 * verdict to the settings through `save`. Returns the settings to continue with (the switch
 * may have gone off). Alerts are best-effort: a failed alert never blocks the verdict.
 */
export async function applyColdBrake<S extends { readonly enabled: boolean; readonly ramp?: ColdRamp | null }>(
  now: Date,
  settings: S,
  save: (next: Partial<S>) => Promise<S>,
): Promise<S> {
  const ramp = settings.ramp;
  if (!ramp) return settings;
  const today = budapestIsoDay(now);
  if (ramp.judgedDay === today) return settings;
  const day = previousWorkingDay(today);
  const health = await coldHealthOf(day);
  const verdict = judgeColdHealth(health, ramp.holdCap != null);
  const todayCap = rampCapOn({ ...ramp, holdCap: null }, today);
  let next: Partial<S>;
  let alert: { subject: string; text: string; sms: boolean } | null = null;
  const where = verdict.kind === "no-data" ? "" : ` (${verdict.basis === "gmail" ? "Gmail-címzettek" : "minden címzett"}: ${verdict.sent} levél, ${pct(verdict.rate)} nézte meg 24 órán belül)`;
  switch (verdict.kind) {
    case "stop":
      next = { enabled: false, ramp: { ...ramp, holdCap: Math.min(ramp.holdCap ?? Infinity, todayCap), judgedDay: today } } as Partial<S>;
      alert = {
        subject: `Hideg kiküldés LEÁLLÍTVA — ${day} nézési arány ${pct(verdict.rate)}`,
        text: `A ${day}-i e-mailek nézési aránya${where} a ${pct(RAMP_STOP_BELOW)} küszöb alatt van: a Gmail valószínűleg spambe teszi a leveleket. A kiküldő kapcsolója KI. Döntés után: outreach-dispatch.mts on (és ramp release, ha a felfutás mehet tovább).`,
        sms: true,
      };
      break;
    case "freeze":
      next = { ramp: { ...ramp, holdCap: Math.min(ramp.holdCap ?? Infinity, todayCap), judgedDay: today } } as Partial<S>;
      alert = {
        subject: `Hideg felfutás BEFAGYASZTVA ${todayCap}/nap — ${day} nézési arány ${pct(verdict.rate)}`,
        text: `A ${day}-i e-mailek nézési aránya${where} a ${pct(RAMP_FREEZE_BELOW)} küszöb alatt van. A napi keret ${todayCap}-on marad, amíg az arány ${pct(RAMP_RELEASE_ABOVE)} fölé nem megy (akkor magától old), vagy: outreach-dispatch.mts ramp release.`,
        sms: false,
      };
      break;
    case "release":
      next = { ramp: { ...ramp, holdCap: null, judgedDay: today } } as Partial<S>;
      break;
    default:
      next = { ramp: { ...ramp, judgedDay: today } } as Partial<S>;
  }
  const saved = await save(next);
  console.log(`[cold-ramp] ${today}: ${day} → ${verdict.kind}${where}; mai keret ${rampCapOn(saved.ramp ?? ramp, today)}`);
  if (alert) {
    try {
      await alertHouse({ tag: "cold-ramp", ...alert });
    } catch (e) {
      console.error(`[cold-ramp] riasztás nem ment ki: ${(e as Error).message}`);
    }
  }
  return saved;
}
