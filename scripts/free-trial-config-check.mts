// ADR-0342 — the free trial's length and coupon are OPERATOR-SET on /pricing („Ingyenes próba”
// section, the ADR-0285 „Lead-ajánlatok” pattern). What this proves — each leg is a way the
// setting could silently stop meaning anything:
//   ① the validity rule: days 1–90, coupon 0–90 (0 = no coupon), whole numbers only;
//   ② the /pricing POST parse: no section → null (an old open tab resets nothing), switched off
//      → the STORED numbers survive, "20%" / " 30 " normalise, "2,5" / "-1" / junk are refused;
//   ③ the POST handler validates the trial section BEFORE anything is written — a refused value
//      must not leave half a save (prices or escalation stored, trial not) (structural);
//   ④ the page renders the section with the STORED values (not the defaults), the presence
//      marker, the switch state, and the running-trial count; switched off → inputs disabled;
//   ⑤ switched off → startTrial refuses a NEW trial ('disabled') — before any row is written;
//   ⑥ the running-trial count reads the DB without error.
//
// The dev DB is SHARED by parallel worktrees: the config is set with the PROCESS-LOCAL override,
// never by writing the app_setting row. This guard writes NO row at all (leg ⑤ is refused
// before the claim).
//
// Run: npx tsx scripts/free-trial-config-check.mts

import { readFileSync } from "node:fs";

import { db } from "../src/db/client.js";
import { pricingPage } from "../src/console/views.js";
import { ESCALATION_CONFIG_DEFAULT } from "../src/payment/offers.js";
import { loadPricing, pricingRegions, pricingSnapshot } from "../src/pricing.js";
import {
  FREE_TRIAL_CONFIG_DEFAULT,
  freeTrialConfigErrors,
  freeTrialFromForm,
  overrideFreeTrialConfigInProcess,
  runningFreeTrials,
  type FreeTrialConfig,
} from "../src/trial/config.js";
import { startTrial } from "../src/trial/start.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const f = (o: Record<string, string>): { get(name: string): string | null } => ({
  get: (n) => (n in o ? o[n] : null),
});

try {
  // ① bounds
  const errs = (days: number, couponPercent: number) => freeTrialConfigErrors({ days, couponPercent });
  check("① 14 nap / 25% érvényes", errs(14, 25), []);
  check("① 1 nap / 0% (nincs kupon) érvényes", errs(1, 0), []);
  check("① 90 nap / 90% érvényes", errs(90, 90), []);
  check("① 0 nap hibás", errs(0, 25), ["days"]);
  check("① 91 nap hibás", errs(91, 25), ["days"]);
  check("① 91% hibás", errs(14, 91), ["couponPercent"]);
  check("① −1% hibás", errs(14, -1), ["couponPercent"]);
  check("① tört szám hibás (2,5 nap, 10,5%)", errs(2.5, 10.5), ["days", "couponPercent"]);
  check("① NaN hibás", errs(Number.NaN, Number.NaN), ["days", "couponPercent"]);

  // ② POST parse
  const stored: FreeTrialConfig = { enabled: true, days: 21, couponPercent: 30 };
  check("② szekció nélküli űrlap (régi fül) → null, nem nulláz", freeTrialFromForm(f({ base_monthly: "3900" }), stored), null);
  check(
    "② kikapcsolva (a tiltott mezők nem jönnek) → a TÁROLT számok maradnak",
    freeTrialFromForm(f({ trial_present: "1" }), stored),
    { enabled: false, days: 21, couponPercent: 30 },
  );
  check(
    "② bekapcsolva, normalizálás (\" 30 \", \"20%\")",
    freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: " 30 ", trial_coupon: "20 %" }), stored),
    { enabled: true, days: 30, couponPercent: 20 },
  );
  const frac = freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: "2,5", trial_coupon: "abc" }), stored);
  check("② \"2,5\" nap / \"abc\" % → a szabály elutasítja", frac ? freeTrialConfigErrors(frac) : null, ["days", "couponPercent"]);
  const neg = freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: "14", trial_coupon: "-1" }), stored);
  check("② \"-1\" % → a szabály elutasítja", neg ? freeTrialConfigErrors(neg) : null, ["couponPercent"]);
  const empty = freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: "", trial_coupon: "25" }), stored);
  check("② üres nap-mező → a szabály elutasítja (nem 0, nem alapérték)", empty ? freeTrialConfigErrors(empty) : null, ["days"]);

  // ③ structural: in the POST /pricing handler the trial refusal precedes every write.
  const server = readFileSync(new URL("../src/console/server.ts", import.meta.url), "utf8");
  const post = server.slice(server.indexOf('if (method === "POST" && path === "/pricing")'));
  const at = (needle: string): number => post.indexOf(needle);
  const refuse = at("freeTrialConfigErrors(trial)");
  check("③ a POST /pricing ellenőrzi a próba-szekciót", refuse > 0, true);
  check(
    "③ …MINDEN írás előtt (setEscalationConfig, setFreeTrialConfig, savePricing, setDisabledModules)",
    ["await setEscalationConfig(", "await setFreeTrialConfig(", "await savePricing(", "await setDisabledModules("].map(
      (w) => at(w) > refuse,
    ),
    [true, true, true, true],
  );

  // ④ the page
  await loadPricing(true);
  const page = (cfg: FreeTrialConfig, running: number): string =>
    pricingPage(pricingSnapshot("hu"), pricingRegions(), null, new Set(), new Map(), {
      cfg: ESCALATION_CONFIG_DEFAULT,
      live: { count: 0, percents: [] },
    }, { cfg, running });
  const html = page({ enabled: true, days: 21, couponPercent: 30 }, 3);
  check("④ a szekció megjelenik", html.includes('id="pr-trial"'), true);
  check("④ jelenlét-jelölő (trial_present)", html.includes('name="trial_present" value="1"'), true);
  check("④ a TÁROLT napszám a mezőben", /name="trial_days" inputmode="numeric" value="21">/.test(html), true);
  check("④ a TÁROLT kupon-% a mezőben", /name="trial_coupon" inputmode="numeric" value="30">/.test(html), true);
  check("④ bekapcsolva: a kapcsoló bepipálva", /id="trial_on" name="trial_on" checked/.test(html), true);
  const data = JSON.parse(/<script type="application\/json" id="trial_data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "null") as {
    running: number;
    saved: FreeTrialConfig;
  } | null;
  check("④ a futó próbák száma a lap adatában", data?.running ?? null, 3);
  check("④ a tárolt érték a lap adatában (a „változott-e” alapja)", data?.saved ?? null, { enabled: true, days: 21, couponPercent: 30 });
  const off = page({ enabled: false, days: 21, couponPercent: 30 }, 0);
  check("④ kikapcsolva: a kapcsoló NINCS bepipálva", /id="trial_on" name="trial_on" checked/.test(off), false);
  check("④ kikapcsolva: a nap-mező tiltott (a tárolt szám marad)", /name="trial_days" inputmode="numeric" value="21" disabled>/.test(off), true);
  check("④ kikapcsolva: a kupon-mező tiltott", /name="trial_coupon" inputmode="numeric" value="30" disabled>/.test(off), true);

  // ⑤ switched off → no new trial. A prospect whose lead has no trial yet, so the getter
  // decides (an existing trial would answer first, by design). Refused before any write.
  const p = await db
    .selectFrom("prospect")
    .select(["token"])
    .where("mock_artifact_id", "is not", null)
    .where(({ not, exists, selectFrom }) =>
      not(exists(selectFrom("free_trial").select("free_trial.id").whereRef("free_trial.lead_id", "=", "prospect.lead_id"))),
    )
    .limit(1)
    .executeTakeFirst();
  check("⑤ van próba nélküli, mockos prospect a méréshez", !!p, true);
  if (p) {
    overrideFreeTrialConfigInProcess({ ...FREE_TRIAL_CONFIG_DEFAULT, enabled: false });
    const before = await db.selectFrom("free_trial").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow();
    const r = await startTrial(p.token, {
      name: "Próba Őr",
      email: "trial-config-check@example.com",
      phone: "+36 30 123 4567",
      aszfAccepted: true,
      photoRightsAccepted: true,
    });
    const after = await db.selectFrom("free_trial").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow();
    check("⑤ kikapcsolt próba → startTrial 'disabled'", r.ok ? "ok" : r.error, "disabled");
    check("⑤ …és nem írt free_trial sort", Number(after.n) - Number(before.n), 0);
  }

  // ⑥ the count
  const n = await runningFreeTrials();
  check("⑥ a futó próbák száma olvasható (nem negatív egész)", Number.isInteger(n) && n >= 0, true);
} finally {
  overrideFreeTrialConfigInProcess(null);
  await db.destroy();
}

if (failures) {
  console.error(`\n⛔ free-trial-config-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ free-trial-config-check: minden zöld");
