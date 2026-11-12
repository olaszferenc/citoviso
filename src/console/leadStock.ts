// Lead-állomány (owner, 2026-11-12; frozen plan: assets/design-refs/console/lead-allomany/):
// every qualified lead sorted by PHOTO KIND × STATE, the sendable ones by CHANNEL, and the
// waiting ones by WHY they wait. One classifier feeds three surfaces — the dashboard card,
// the Riport „Lead-állomány” tab and the lead-list `?stock=` filter a number opens — so a
// number and the list behind it cannot disagree.
//
// Definitions (the plan's „Mit jelentenek az oszlopok?” box says the same, in words):
// - qualified   = no or outdated website, not disqualified, not blocked from contact.
//                 ⚠️ Wider than the CRM list default (`defaultLeadQuery`, ≥1 gathered image):
//                 the photo-less leads are shown in their own rows instead of hidden.
// - own photo   = ≥1 portal / Places / own-website image (Street View does not count).
// - town/stock  = no own photo, and the shown mock got a town photo (ADR-0436) — or there
//                 is no mock yet (the town photo is the default a new mock will get).
// - no image    = no own photo and the shown mock has no town photo either (nophoto gate).
// - sent        = any prospect of the lead has `sent_at` (any channel).
// - mock ready  = the shown mock is not rejected, its stored review verdict is „pass”, and
//                 the owner did not refuse it on /jovahagyas (dispatch cancelled/skipped).
// - contact ok  = an e-mail address, or a HU mobile whose Viber/WhatsApp check has run.
// - sendable    = not sent, mock ready, contact ok.
// - waiting     = not sent and not sendable; mock first, then contact (one bucket per lead).
// The period is a COHORT: leads first surveyed (`lead.created_at`) inside it, in their state now.

import { sql } from "kysely";

import { db } from "../db/client.js";
import { isHuMobileE164, normalizePhone } from "../text/phone.js";
import { pickShownMock } from "./leadFilters.js";
import { reportPeriod, type ReportPeriod } from "./reportData.js";

export type StockCat = "own" | "town" | "none";
export const STOCK_CATS: readonly StockCat[] = ["own", "town", "none"];

/** The cell a number stands for — also the `?stock=<cat>.<col>` value of the list filter. */
export type StockCol =
  | "all"
  | "sent"
  | "wait"
  | "ready"
  | "wmock"
  | "wcontact"
  | "nomock"
  | "unreviewed"
  | "refused"
  | "email"
  | "messenger"
  | "mms"
  | "both";
export const STOCK_COLS: readonly StockCol[] = [
  "all", "sent", "wait", "ready", "wmock", "wcontact", "nomock", "unreviewed", "refused", "email", "messenger", "mms", "both",
];

export type StockCounts = Record<StockCol, number>;

export interface LeadStock {
  readonly period: ReportPeriod;
  /** Every lead surveyed in the period (qualified or not, disqualified included). */
  readonly total: number;
  readonly notQualified: number;
  readonly rows: Readonly<Record<StockCat, StockCounts>>;
  readonly sum: StockCounts;
}

interface Classified {
  readonly id: string;
  readonly at: number;
  readonly cat: StockCat;
  readonly cols: ReadonlySet<StockCol>;
}

const zero = (): StockCounts => Object.fromEntries(STOCK_COLS.map((c) => [c, 0])) as StockCounts;

const mobileOf = (raw: string | null): string | null => {
  const e = raw ? normalizePhone(raw) : null;
  return e && isHuMobileE164(e) ? e : null;
};

/** All qualified leads, classified — `null` cat rows are the not-qualified ones (counted only). */
async function classifyAll(): Promise<{ qualified: Classified[]; all: { at: number }[] }> {
  const leads = await sql<{
    id: string;
    at: Date;
    q: boolean;
    own: number;
    email: string | null;
    phone: string | null;
  }>`
    select l.id, l.created_at as at,
           (l.lifecycle_status is distinct from 'disqualified'
             and l.qualification in ('no_site','outdated')
             and l.contact_block_at is null) as q,
           (case when jsonb_typeof(l.raw->'material'->'placesPhotos') = 'number' then (l.raw->'material'->>'placesPhotos')::int else 0 end
          + case when jsonb_typeof(l.raw->'material'->'portalPhotos') = 'number' then (l.raw->'material'->>'portalPhotos')::int else 0 end
          + case when jsonb_typeof(l.raw->'material'->'websiteImages') = 'number' then (l.raw->'material'->>'websiteImages')::int else 0 end) as own,
           nullif(trim(l.raw->>'email'), '') as email, l.raw->>'phone' as phone
      from lead l`.execute(db);

  const mocks = await sql<{ lead_id: string; status: string; pass: boolean; flag: boolean; town: boolean; generated_at: Date }>`
    select m.lead_id, m.status,
           (m.inputs->>'reviewVerdict' = 'pass' and m.inputs->'review'->>'verdict' = 'pass') as pass,
           coalesce(m.inputs->>'reviewVerdict' = 'flag', false) as flag,
           coalesce(jsonb_typeof(m.inputs->'siteData'->'townPhoto') = 'object', false) as town,
           m.generated_at
      from mock_artifact m
     order by m.generated_at desc`.execute(db);
  const mocksByLead = new Map<string, { status: string; pass: boolean; flag: boolean; town: boolean }[]>();
  for (const m of mocks.rows) {
    const list = mocksByLead.get(m.lead_id) ?? [];
    list.push({ status: m.status, pass: m.pass, flag: m.flag, town: m.town });
    mocksByLead.set(m.lead_id, list);
  }

  const sent = new Set(
    (await db.selectFrom("prospect").select("lead_id").where("sent_at", "is not", null).execute()).map((r) => r.lead_id),
  );
  const refused = new Set(
    (await db.selectFrom("outreach_dispatch").select("lead_id").where("status", "in", ["cancelled", "skipped"]).execute()).map(
      (r) => r.lead_id,
    ),
  );
  const presence = new Map(
    (await db.selectFrom("messenger_presence").select(["phone", "viber", "whatsapp"]).execute()).map((p) => [p.phone, p]),
  );

  const qualified: Classified[] = [];
  for (const l of leads.rows) {
    if (!l.q) continue;
    const shown = pickShownMock(mocksByLead.get(l.id) ?? []);
    const own = Number(l.own) > 0;
    const cat: StockCat = own ? "own" : !shown || shown.town ? "town" : "none";
    const cols = new Set<StockCol>(["all"]);
    if (sent.has(l.id)) {
      cols.add("sent");
    } else {
      const mob = mobileOf(l.phone);
      const p = mob ? presence.get(mob) : undefined;
      const hasEmail = !!l.email;
      const messenger = !!p && (p.viber === "yes" || p.whatsapp === "yes");
      const mobileChecked = !!p;
      const contactOk = hasEmail || mobileChecked;
      const mockReady = !!shown && shown.status !== "rejected" && shown.pass && !refused.has(l.id);
      if (mockReady && contactOk) {
        cols.add("ready");
        if (hasEmail) cols.add("email");
        if (messenger) cols.add("messenger");
        if (mobileChecked) cols.add("mms");
        if (hasEmail && messenger) cols.add("both");
      } else {
        cols.add("wait");
        if (!mockReady) {
          cols.add("wmock");
          if (!shown) cols.add("nomock");
          else if (shown.status === "rejected" || shown.flag || refused.has(l.id)) cols.add("refused");
          else cols.add("unreviewed");
        } else {
          cols.add("wcontact");
        }
      }
    }
    qualified.push({ id: l.id, at: new Date(l.at).getTime(), cat, cols });
  }
  return { qualified, all: leads.rows.map((l) => ({ at: new Date(l.at).getTime() })) };
}

// The classification is the same for every period (state now) — one 60 s cache serves the
// card, the report and the list filter alike.
let cache: { at: number; data: Promise<Awaited<ReturnType<typeof classifyAll>>> } | null = null;
const TTL_MS = 60_000;
function classified(): Promise<Awaited<ReturnType<typeof classifyAll>>> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const data = classifyAll();
    cache = { at: Date.now(), data };
    data.catch(() => {
      if (cache?.data === data) cache = null;
    });
  }
  return cache.data;
}

const inPeriod = (at: number, p: ReportPeriod): boolean => at >= p.fromMs && at <= p.toMs;

export async function getLeadStock(period: ReportPeriod): Promise<LeadStock> {
  const { qualified, all } = await classified();
  const rows = { own: zero(), town: zero(), none: zero() } as Record<StockCat, StockCounts>;
  const sum = zero();
  let q = 0;
  for (const l of qualified) {
    if (!inPeriod(l.at, period)) continue;
    q++;
    for (const c of l.cols) {
      rows[l.cat][c]++;
      sum[c]++;
    }
  }
  const total = all.filter((l) => inPeriod(l.at, period)).length;
  return { period, total, notQualified: total - q, rows, sum };
}

/** The `?stock=<cat>.<col>` list filter: `cat` may be "all" (every photo kind). */
export function parseStockFilter(v: string | null | undefined): { cat: StockCat | "all"; col: StockCol } | null {
  if (!v) return null;
  const [cat, col] = v.split(".");
  if (!(cat === "all" || (STOCK_CATS as readonly string[]).includes(cat ?? ""))) return null;
  if (!(STOCK_COLS as readonly string[]).includes(col ?? "")) return null;
  return { cat: cat as StockCat | "all", col: col as StockCol };
}

/** The lead ids behind one card number — the list filter reads exactly what the card counted. */
export async function leadStockIds(stock: string, days: string | null): Promise<Set<string> | null> {
  const f = parseStockFilter(stock);
  if (!f) return null;
  const period = reportPeriod(days, null, null, new Date(), "0");
  const { qualified } = await classified();
  return new Set(
    qualified.filter((l) => inPeriod(l.at, period) && (f.cat === "all" || l.cat === f.cat) && l.cols.has(f.col)).map((l) => l.id),
  );
}

/** The Megkeresések card in the chosen period: links sent, leads that replied, orders started. */
export async function outreachInPeriod(period: ReportPeriod): Promise<{ sent: number; replied: number; orderIntent: number }> {
  const from = Number.isFinite(period.fromMs) ? new Date(period.fromMs) : new Date(0);
  const to = new Date(period.toMs);
  const r = await sql<{ sent: string; replied: string; order_intent: string }>`
    select (select count(*) from prospect where sent_at >= ${from} and sent_at <= ${to}) as sent,
           (select count(distinct lead_id) from outreach_reply where received_at >= ${from} and received_at <= ${to}) as replied,
           (select count(distinct prospect_id) from order_intent where created_at >= ${from} and created_at <= ${to}) as order_intent`.execute(db);
  const row = r.rows[0];
  return { sent: Number(row?.sent ?? 0), replied: Number(row?.replied ?? 0), orderIntent: Number(row?.order_intent ?? 0) };
}
