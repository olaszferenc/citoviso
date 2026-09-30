// ADR-0285 — the escalation offer's threshold and percent are OPERATOR-SET on /pricing
// (app_setting 'escalation_offer'; frozen plan: assets/design-refs/console/escalation-offer-admin/).
//
// What this proves — each leg is a way the setting could silently stop meaning anything:
//   ① the CONFIGURED threshold gates the minting (2 → the 2nd view mints, the 1st does not),
//      and the CONFIGURED percent lands in offer.percent (40, not the 50 default);
//   ② switched off → no offer, even far past the threshold;
//   ③ the validity rule: 2–10 opening, (outreach+1)–90 percent, integers only;
//   ④ the /pricing POST parse: no section → null (an old tab resets nothing), switched off →
//      the STORED numbers survive, "40%" / " 4 " normalise, "2,5" is refused;
//   ⑤ the page renders the section with the stored values and the live-offer data.
//
// Reverting ensureEscalationOffer to the ESCALATION_VISIT_THRESHOLD / ESCALATION_OFFER_PERCENT
// constants turns ① red (measured when this guard was written: 3 failures).
//
// The dev DB is SHARED by parallel worktrees: the config is set with the PROCESS-LOCAL override,
// never by writing the app_setting row; the only rows written are this run's own prospects
// (their offer/mock_view rows cascade) and they are deleted in `finally`.
//
// Run: npx tsx scripts/escalation-config-check.mts

import { db } from "../src/db/client.js";
import {
  ESCALATION_CONFIG_DEFAULT,
  ESCALATION_PERCENT_MAX,
  ESCALATION_PERCENT_MIN,
  OUTREACH_OFFER_PERCENT,
  ensureEscalationOffer,
  escalationConfigErrors,
  escalationFromForm,
  overrideEscalationConfigInProcess,
} from "../src/payment/offers.js";
import { loadPricing, pricingRegions, pricingSnapshot } from "../src/pricing.js";
import { pricingPage } from "../src/console/views.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const made: string[] = [];

async function touchedProspect(tag: string): Promise<string> {
  // gate-subject-allow: a lead-id csak a saját (bélyegzett tokenű, a végén törölt) prospect FK-horgonya, a lead tartalmát a mérés nem olvassa
  const lead = await db.selectFrom("lead").select("id").limit(1).executeTakeFirstOrThrow();
  const p = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `esc-config-check-${tag}-${process.pid}`, sent_at: new Date() } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  made.push(p.id);
  return p.id;
}

async function view(prospectId: string): Promise<void> {
  await db.insertInto("mock_view").values({ prospect_id: prospectId }).execute();
}

try {
  // ① configured threshold + percent reach the minted row.
  overrideEscalationConfigInProcess({ enabled: true, threshold: 2, percent: 40 });
  const a = await touchedProspect("on");
  await view(a);
  check("① 1. megnyitás (küszöb 2) → nincs ajánlat", await ensureEscalationOffer(a), null);
  await view(a);
  const minted = await ensureEscalationOffer(a);
  check("① 2. megnyitás (küszöb 2) → ajánlat születik", minted?.kind ?? null, "escalation");
  check("① a mintázott offer.percent a KONFIGURÁLT 40", minted?.percent ?? null, 40);
  const note = await db.selectFrom("offer").select("note").where("prospect_id", "=", a).where("kind", "=", "escalation").executeTakeFirst();
  check("① a note a konfigurált küszöböt nevezi meg", /#2 /.test(note?.note ?? ""), true);

  // ② switched off → nothing, however many views.
  overrideEscalationConfigInProcess({ enabled: false, threshold: 2, percent: 40 });
  const b = await touchedProspect("off");
  for (let i = 0; i < 4; i++) await view(b);
  check("② kikapcsolva → 4 megnyitás után sincs ajánlat", await ensureEscalationOffer(b), null);
  overrideEscalationConfigInProcess(null);

  // ③ the validity rule.
  const errs = (threshold: number, percent: number) => escalationConfigErrors({ threshold, percent });
  check("③ 3 / 50 érvényes", errs(3, 50), []);
  check("③ 2 / 26 (alsó határok) érvényes", errs(2, OUTREACH_OFFER_PERCENT + 1), []);
  check("③ 10 / 90 (felső határok) érvényes", errs(10, 90), []);
  check("③ küszöb 1 → hiba", errs(1, 50), ["threshold"]);
  check("③ küszöb 11 → hiba", errs(11, 50), ["threshold"]);
  check("③ küszöb 2.5 → hiba", errs(2.5, 50), ["threshold"]);
  check(`③ ${OUTREACH_OFFER_PERCENT}% (= bemutatkozó) → hiba`, errs(3, OUTREACH_OFFER_PERCENT), ["percent"]);
  check("③ 91% → hiba", errs(3, 91), ["percent"]);
  check("③ NaN mindkettő → két hiba", errs(Number.NaN, Number.NaN), ["threshold", "percent"]);
  check("③ az alsó %-határ a bemutatkozóból származik", ESCALATION_PERCENT_MIN, OUTREACH_OFFER_PERCENT + 1);
  check("③ a felső %-határ 90", ESCALATION_PERCENT_MAX, 90);

  // ④ the POST parse.
  const f = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k]! : null) });
  const stored = { enabled: true, threshold: 4, percent: 45 };
  check("④ szekció nélküli űrlap → null (nem nulláz)", escalationFromForm(f({ base_monthly: "3900" }), stored), null);
  check(
    "④ kikapcsolva (tiltott mezők nem jönnek) → a TÁROLT számok maradnak",
    escalationFromForm(f({ esc_present: "1" }), stored),
    { enabled: false, threshold: 4, percent: 45 },
  );
  check(
    "④ „ 4 ” és „40%” normalizálódik",
    escalationFromForm(f({ esc_present: "1", esc_on: "on", esc_threshold: " 4 ", esc_percent: "40%" }), stored),
    { enabled: true, threshold: 4, percent: 40 },
  );
  const frac = escalationFromForm(f({ esc_present: "1", esc_on: "on", esc_threshold: "2,5", esc_percent: "abc" }), stored);
  check("④ „2,5” és „abc” → a validátor elutasítja", frac && escalationConfigErrors(frac), ["threshold", "percent"]);

  // ⑤ the page renders the stored values.
  await loadPricing(true);
  const html = pricingPage(pricingSnapshot("hu"), pricingRegions(), null, new Set(), new Map(), {
    cfg: { enabled: true, threshold: 7, percent: 35 },
    live: { count: 2, percents: [50] },
  });
  check("⑤ a szekció megjelenik", html.includes('id="pr-esc"'), true);
  check("⑤ a küszöb-mező a tárolt 7-et mutatja", /id="esc_n" name="esc_threshold" inputmode="numeric" value="7"/.test(html), true);
  check("⑤ a %-mező a tárolt 35-öt mutatja", /id="esc_p" name="esc_percent" inputmode="numeric" value="35"/.test(html), true);
  check("⑤ az esc_present jelölő ott van (különben a POST nem menti)", html.includes('name="esc_present" value="1"'), true);
  check("⑤ az élő ajánlatok száma az adatban", html.includes('"live":{"count":2,"pcts":"−50%"}'), true);
  const off = pricingPage(pricingSnapshot("hu"), pricingRegions(), null, new Set(), new Map(), {
    cfg: { ...ESCALATION_CONFIG_DEFAULT, enabled: false },
    live: { count: 0, percents: [] },
  });
  check("⑤ kikapcsolt állapot: a kapcsoló üres, a mezők tiltva", /id="esc_on" name="esc_on">/.test(off) && /value="3" disabled/.test(off), true);
} finally {
  overrideEscalationConfigInProcess(null);
  if (made.length) await db.deleteFrom("prospect").where("id", "in", made).execute();
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n✗ ESCALATION-CONFIG-CHECK: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ ESCALATION-CONFIG-CHECK: minden ellenőrzés zöld (a teszt-sorok törölve, az app_setting sort nem írta)");
