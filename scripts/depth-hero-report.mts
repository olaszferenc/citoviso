#!/usr/bin/env npx tsx
/**
 * DEPTH-HERO EXPERIMENT REPORT (ADR-0472) — does the moving cover change what a lead does AFTER
 * opening the mock?
 *
 *   npx tsx scripts/depth-hero-report.mts [--days 30]
 *
 * Read-only. Arms come from the mock itself (mock_artifact.inputs.heroDepthArm, decided at
 * generation — see src/generator/depthArm.ts); only 'depth' and 'control' are compared, 'skip:*'
 * is listed separately (counting it as control would tilt control towards small / Places covers).
 * The plan a prospect was SENT is prospect.mock_artifact_id (plan 1).
 *
 * Why post-click: the outreach experiment's steering metric (link72 = letter → mock click within
 * 72 h) cannot see the cover — the lead meets it only after the click. So per arm:
 *   sent       prospects whose letter left (outreach_dispatch.status = 'sent')
 *   opened     with at least one non-bot mock_view
 *   dwell      median seconds on the page (dwell_end.seconds, longest per prospect)
 *   scroll75   share of openers who scrolled ≥ 75 %
 *   engaged    share of openers with an interaction (question, plan / trial / checkout panel,
 *              preset or domain pick)
 *   replied    share of sent with a reply (outreach_reply)
 *   intent     share of sent at prospect.status order_intent / converted
 * With small samples the numbers are noise — the report prints the counts next to every share.
 */
import { sql } from "kysely";

import { db } from "../src/db/client.js";

const daysArg = process.argv.indexOf("--days");
const DAYS = daysArg > 0 ? Math.max(1, Number(process.argv[daysArg + 1]) || 30) : 30;
const ENGAGE = ["ask_q", "panel_open", "trial_open", "checkout_step", "plan_view_click", "preset_select", "domain_pick"];

interface Row {
  arm: string;
  sent: number;
  opened: number;
  dwell_median: number | null;
  scroll75: number;
  engaged: number;
  replied: number;
  intent: number;
}

const rows = await sql<Row>`
  WITH base AS (
    SELECT p.id AS prospect_id, p.lead_id, p.status AS pstatus,
           coalesce(a.inputs->>'heroDepthArm', 'nincs') AS arm
    FROM outreach_dispatch d
    JOIN prospect p ON p.lead_id = d.lead_id
    JOIN mock_artifact a ON a.id = p.mock_artifact_id
    WHERE d.status = 'sent' AND d.sent_at > now() - make_interval(days => ${DAYS})
      AND a.inputs ? 'heroDepthArm'
  ),
  views AS (
    SELECT v.prospect_id, v.id AS view_id FROM mock_view v
    JOIN base b ON b.prospect_id = v.prospect_id
    WHERE coalesce(v.device, '') <> 'bot'
  ),
  per AS (
    SELECT b.arm, b.prospect_id, b.pstatus,
      EXISTS (SELECT 1 FROM views w WHERE w.prospect_id = b.prospect_id) AS opened,
      (SELECT max((e.payload->>'seconds')::int) FROM mock_event e JOIN views w ON w.view_id = e.mock_view_id
         WHERE w.prospect_id = b.prospect_id AND e.type = 'dwell_end') AS dwell,
      EXISTS (SELECT 1 FROM mock_event e JOIN views w ON w.view_id = e.mock_view_id
         WHERE w.prospect_id = b.prospect_id AND e.type = 'scroll' AND (e.payload->>'pct')::int >= 75) AS scroll75,
      EXISTS (SELECT 1 FROM mock_event e JOIN views w ON w.view_id = e.mock_view_id
         WHERE w.prospect_id = b.prospect_id AND e.type = ANY(${ENGAGE})) AS engaged,
      EXISTS (SELECT 1 FROM outreach_reply r WHERE r.prospect_id = b.prospect_id OR r.lead_id = b.lead_id) AS replied
    FROM base b
  )
  SELECT arm,
    count(*)::int AS sent,
    count(*) FILTER (WHERE opened)::int AS opened,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY dwell) FILTER (WHERE opened AND dwell IS NOT NULL) AS dwell_median,
    count(*) FILTER (WHERE opened AND scroll75)::int AS scroll75,
    count(*) FILTER (WHERE opened AND engaged)::int AS engaged,
    count(*) FILTER (WHERE replied)::int AS replied,
    count(*) FILTER (WHERE pstatus IN ('order_intent', 'converted'))::int AS intent
  FROM per GROUP BY arm ORDER BY arm
`.execute(db);

const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1)} % (${n}/${d})` : "— (0)");
console.log(`Térhatású borítókép — kísérlet, az utolsó ${DAYS} nap kiküldései\n`);
if (!rows.rows.length) console.log("Még nincs kiküldött mock a kísérletből (DEPTH_HERO nem „experiment”, vagy nincs küldés).");
for (const r of rows.rows) {
  const label = r.arm === "depth" ? "TÉRHATÁS" : r.arm === "control" ? "KONTROLL" : `kimaradt (${r.arm})`;
  console.log(`■ ${label}`);
  console.log(`   kiküldve: ${r.sent} · megnyitotta: ${pct(r.opened, r.sent)}`);
  if (!r.arm.startsWith("skip:")) {
    console.log(`   ottlét (medián): ${r.dwell_median === null ? "—" : `${Math.round(Number(r.dwell_median))} mp`} · ≥75 % görgetés: ${pct(r.scroll75, r.opened)}`);
    console.log(`   kattintott valamire: ${pct(r.engaged, r.opened)} · válaszolt: ${pct(r.replied, r.sent)} · rendelés-szándék: ${pct(r.intent, r.sent)}`);
  }
}
await db.destroy();
