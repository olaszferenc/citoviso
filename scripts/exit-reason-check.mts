// Exit-reason self-test: fixed visit fixtures → the label the rules MUST give. Runs in
// the pre-commit set so a threshold tweak (PRICE_SHOCK_SECONDS, NO_HOOK_*) cannot
// relabel the pilot's visits without this going red (ADR „Riport-modul" ④ őr).
//
//   npx tsx scripts/exit-reason-check.mts

import { inferExitReason, signalsFromEvents, type RawEvent, type ExitReason } from "../src/analytics/exitReason.js";

const t0 = Date.parse("2026-10-04T10:00:00Z");
const at = (sec: number): string => new Date(t0 + sec * 1000).toISOString();
const ev = (type: string, sec: number, payload: Record<string, unknown> = {}): RawEvent => ({ type, payload, occurredAt: at(sec) });

interface Case {
  readonly name: string;
  readonly events: RawEvent[];
  readonly paid?: boolean;
  readonly expect: ExitReason | null;
  readonly confidence?: "sure" | "medium";
}

const CASES: Case[] = [
  { name: "paid visit → no reason", events: [ev("open", 0), ev("panel_open", 30), ev("checkout_redirect", 90)], paid: true, expect: null },
  { name: "bounce: 6 s, scroll 25 → no_hook (sure)", events: [ev("open", 0), ev("scroll", 2, { pct: 25 }), ev("dwell_end", 6, { seconds: 6 })], expect: "no_hook", confidence: "sure" },
  { name: "read it all, touched nothing → browsed (medium)", events: [ev("open", 0), ev("scroll", 20, { pct: 100 }), ev("dwell", 15, { seconds: 15 }), ev("dwell", 30, { seconds: 30 }), ev("dwell_end", 44, { seconds: 44 })], expect: "browsed", confidence: "medium" },
  { name: "toggled modules, never opened the panel → played", events: [ev("open", 0), ev("module_add", 40, { module: "reviews" }), ev("preset_select", 50, { preset: "teljes" }), ev("dwell_end", 70, { seconds: 70 })], expect: "played", confidence: "medium" },
  { name: "panel opened, left 12 s later → price_shock", events: [ev("open", 0), ev("scroll", 30, { pct: 75 }), ev("panel_open", 60), ev("dwell_end", 72, { seconds: 72 })], expect: "price_shock", confidence: "medium" },
  { name: "panel opened, stayed 90 s → browsed (not a shock)", events: [ev("open", 0), ev("panel_open", 60), ev("dwell", 150, { seconds: 150 }), ev("dwell_end", 160, { seconds: 160 })], expect: "browsed" },
  { name: "panel at 60, no dwell_end, last event at 65 → price_shock from the last event", events: [ev("open", 0), ev("panel_open", 60), ev("period_select", 65, { period: "annual" })], expect: "price_shock" },
  { name: "billing step opened, stalled → billing_friction (sure)", events: [ev("open", 0), ev("panel_open", 30), ev("checkout_step", 40, { step: "billing" }), ev("billing_step_open", 41), ev("dwell_end", 120, { seconds: 120 })], expect: "billing_friction", confidence: "sure" },
  { name: "billing_invalid → billing_friction", events: [ev("open", 0), ev("panel_open", 30), ev("billing_step_open", 41), ev("billing_invalid", 50, { field: "tax_number" })], expect: "billing_friction" },
  { name: "own-domain check then left → domain_gate", events: [ev("open", 0), ev("panel_open", 30), ev("own_domain_check", 45, { domain: "x.hu" }), ev("dwell_end", 60, { seconds: 60 })], expect: "domain_gate", confidence: "sure" },
  { name: "module dependency unmet → module_dependency", events: [ev("open", 0), ev("module_add", 20, { module: "booking" }), ev("module_dependency_unmet", 21, { module: "booking" })], expect: "module_dependency" },
  { name: "sent to the gateway, never paid → payment_stall", events: [ev("open", 0), ev("panel_open", 30), ev("order_intent_submitted", 200), ev("checkout_redirect", 201)], expect: "payment_stall", confidence: "sure" },
  { name: "escalation dismissed → escalation_dismissed", events: [ev("open", 0), ev("escalation_shown", 1), ev("escalation_dismiss", 5), ev("dwell_end", 30, { seconds: 30 })], expect: "escalation_dismissed" },
  { name: "order send failed → technical, beats payment_stall", events: [ev("open", 0), ev("panel_open", 30), ev("order_intent_submitted", 100), ev("order_send_failed", 101)], expect: "technical", confidence: "sure" },
  { name: "client error → technical", events: [ev("open", 0), ev("client_error", 3, { msg: "TypeError" })], expect: "technical" },
  { name: "the open alone (no beacon after) → no_hook", events: [ev("open", 0)], expect: "no_hook" },
];

let failed = 0;
for (const c of CASES) {
  const v = inferExitReason(signalsFromEvents(c.events, c.paid ?? false));
  const got = v?.reason ?? null;
  const okReason = got === c.expect;
  const okConf = c.confidence === undefined || v?.confidence === c.confidence;
  const ok = okReason && okConf;
  if (!ok) failed++;
  console.log(`${ok ? "✓ " : "✗ FAIL"}  ${c.name}${ok ? "" : `\n     ↳ várt: ${c.expect}${c.confidence ? ` (${c.confidence})` : ""} · kapott: ${got}${v ? ` (${v.confidence})` : ""}`}`);
}
console.log(failed ? `\n❌ exit-reason-check: ${failed} eset bukott` : `\n✅ exit-reason-check: ${CASES.length} eset, a szabályok a rögzített látogatásokat helyesen címkézik.`);
process.exit(failed ? 1 : 0);
