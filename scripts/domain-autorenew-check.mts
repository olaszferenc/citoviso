// Regression guard for the OWN DOMAIN'S RENEWAL at the registrar (ADR-XXXX, owner 2026-10-25).
//
// WHAT IT PROVES (no database, no network — the mock registrar holds the services):
//   * PAYING TENANT — a name bought with the switch OFF (the live default, measured on
//     overseer.hu) is switched ON.
//   * ENDED, ≥90 DAYS LEFT — the switch goes OFF on the run after the subscription ended.
//   * ENDED, <90 DAYS LEFT — the switch stays ON for exactly one renewal; once the expiry
//     moved a year on, it goes OFF.
//   * COMEBACK — a stored end is cleared when the subscription is no longer cancelled.
//   * REFUSED SWITCH — a registrar refusal is a recorded problem, never a silent pass.
//   * MISSING / LAPSED — a paying tenant's name absent from the account (after a day) or past
//     its expiry is a problem; an ended tenant's lapsed name is not.
//   * CREDIT — renewals due within 30 days not covered by the credit are a problem.
//   * WIRING — the daily prod timer, the stall-watch sweep, the landing redirect.
//
// Run:  npx tsx scripts/domain-autorenew-check.mts
//       npx tsx scripts/domain-autorenew-check.mts --self-test   (must go RED)

import { readFileSync } from "node:fs";

process.env.REGISTRAR_PROVIDER = "mock";
const { MockRegistrar } = await import("../src/domains/registrar/mock.js");
const { creditProblem, reconcileRenewal, renewEndAtCancel, wantAutoRenew, RENEW_ONCE_DAYS } = await import(
  "../src/domains/domainRenewal.js"
);
type Row = Parameters<typeof reconcileRenewal>[0];

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  const c = SELF_TEST ? !cond : cond;
  if (!c) failed++;
  console.log(`${c ? "✓" : "✗ FAIL"}  ${label}${c ? "" : `\n     ↳ ${detail}`}`);
}

const DAY = 86_400_000;
const NOW = new Date("2026-10-25T10:00:00Z");
const reg = new MockRegistrar();

function seed(domain: string, expiresAt: Date, autoRenew: boolean): void {
  MockRegistrar.services.set(domain, { serviceRef: `svc:${domain}`, domain, expiresAt, autoRenew, renewalPrice: 1990 });
}
function row(domain: string, over: Partial<Row> = {}): Row {
  return {
    siteId: `site-${domain}`,
    tenantId: `t-${domain}`,
    domain,
    boughtAt: new Date(NOW.getTime() - 10 * DAY),
    subscriptionStatus: "active",
    cancelledAt: null,
    renewEnd: null,
    ...over,
  };
}

// ── 1. the pure rule ─────────────────────────────────────────────────────────
const exp = new Date(NOW.getTime() + 200 * DAY);
ok(renewEndAtCancel(NOW, exp).getTime() === exp.getTime(), "≥90 nap a lejáratig: a megújítás vége = a mostani lejárat");
const near = new Date(NOW.getTime() + (RENEW_ONCE_DAYS - 1) * DAY);
ok(renewEndAtCancel(NOW, near).getTime() > near.getTime(), "<90 nap: a vége a lejárat UTÁN (még egy megújítás belefér)");
ok(wantAutoRenew(exp, null), "fizető tenant (nincs vége): a kapcsoló BE");
ok(!wantAutoRenew(exp, exp), "≥90 nap esetén a kapcsoló KI");

// ── 2. reconcile against the mock registrar ──────────────────────────────────
seed("fizeto.hu", exp, false);
let o = await reconcileRenewal(row("fizeto.hu"), reg, NOW);
ok(o.flipped && o.want && MockRegistrar.services.get("fizeto.hu")!.autoRenew, "fizető tenant: a KI-kapcsolt név BEkapcsolódik", JSON.stringify(o));
o = await reconcileRenewal(row("fizeto.hu"), reg, NOW);
ok(!o.flipped && o.problems.length === 0, "második futás: nincs újabb állítás, nincs hiba", JSON.stringify(o));

seed("tavoli.hu", exp, true);
o = await reconcileRenewal(row("tavoli.hu", { subscriptionStatus: "cancelled", cancelledAt: NOW }), reg, NOW);
ok(
  !o.want && o.flipped && !MockRegistrar.services.get("tavoli.hu")!.autoRenew && o.renewEnd?.getTime() === exp.getTime(),
  "megszűnt, ≥90 nap: a kapcsoló KI, a vége a lejárat",
  JSON.stringify(o),
);

seed("kozeli.hu", near, true);
o = await reconcileRenewal(row("kozeli.hu", { subscriptionStatus: "cancelled", cancelledAt: NOW }), reg, NOW);
ok(o.want && !o.flipped && MockRegistrar.services.get("kozeli.hu")!.autoRenew, "megszűnt, <90 nap: a kapcsoló BE marad (egy megújítás)", JSON.stringify(o));
const end = o.renewEnd!;
seed("kozeli.hu", new Date(near.getTime() + 365 * DAY), true); // the registrar renewed it
o = await reconcileRenewal(row("kozeli.hu", { subscriptionStatus: "cancelled", cancelledAt: NOW, renewEnd: end }), reg, new Date(near.getTime() + DAY));
ok(!o.want && o.flipped && !MockRegistrar.services.get("kozeli.hu")!.autoRenew, "az egy megújítás után a kapcsoló KI", JSON.stringify(o));

seed("visszajott.hu", exp, false);
o = await reconcileRenewal(row("visszajott.hu", { subscriptionStatus: "active", renewEnd: exp }), reg, NOW);
ok(o.renewEnd === null && o.want && MockRegistrar.services.get("visszajott.hu")!.autoRenew, "visszatérő tenant: a vége törlődik, a kapcsoló BE", JSON.stringify(o));

seed("elutasit.hu", exp, false);
MockRegistrar.refuseAutoRenew = true;
o = await reconcileRenewal(row("elutasit.hu"), reg, NOW);
MockRegistrar.refuseAutoRenew = false;
ok(!o.flipped && o.problems.some((p) => /BEkapcsolása nem sikerült/.test(p)), "a regisztrátor elutasítja: rögzített hiba", JSON.stringify(o));

o = await reconcileRenewal(row("nincs.hu"), reg, NOW);
ok(o.problems.some((p) => /NINCS a regisztrátor-fiókunk/.test(p)), "fizető tenant neve hiányzik a fiókból: hiba", JSON.stringify(o));
o = await reconcileRenewal(row("friss.hu", { boughtAt: new Date(NOW.getTime() - 60_000) }), reg, NOW);
ok(o.problems.length === 0, "percekkel ezelőtti vétel még nincs a listában: nem hiba", JSON.stringify(o));
o = await reconcileRenewal(row("nincs.hu", { subscriptionStatus: "cancelled", cancelledAt: NOW, renewEnd: exp }), reg, NOW);
ok(o.problems.length === 0, "megszűnt tenant lejárt neve eltűnt: ez a szabály, nem hiba", JSON.stringify(o));

seed("lejart.hu", new Date(NOW.getTime() - DAY), true);
o = await reconcileRenewal(row("lejart.hu"), reg, NOW);
ok(o.problems.some((p) => /LEJÁRT/.test(p)), "fizető tenant neve lejárt és nem újult meg: hiba", JSON.stringify(o));

// ── 3. credit ────────────────────────────────────────────────────────────────
seed("hamar.hu", new Date(NOW.getTime() + 10 * DAY), true);
const soon = await reconcileRenewal(row("hamar.hu"), reg, NOW);
ok(creditProblem([soon], 1000, NOW) !== null, "30 napon belüli megújítás, kevés kredit: hiba");
ok(creditProblem([soon], 5000, NOW) === null, "elég kredit: nincs hiba");
ok(creditProblem([await reconcileRenewal(row("fizeto.hu"), reg, NOW)], 0, NOW) === null, "távoli lejárat: a kredit most nem számít");

// ── 4. wiring ────────────────────────────────────────────────────────────────
const targets = JSON.parse(readFileSync("deploy/systemd/targets.json", "utf8")) as { timers: Record<string, { target: string }> };
ok(targets.timers["citoviso-domain-renewal.timer"]?.target === "prod", "a napi megújítás-időzítő élesre települ (targets.json prod)");
const unit = readFileSync("deploy/systemd/citoviso-domain-renewal.service", "utf8");
ok(/scripts\/domain-renewal-sync\.mts/.test(unit), "az időzítő a szinkront futtatja");
const stall = readFileSync("src/console/stallWatch.ts", "utf8");
ok(/sweepRenewal\(now\)/.test(stall) && /domain_renew_problem/.test(stall), "az óránkénti őr a szinkron hibáiból riaszt");
const pub = readFileSync("src/server/public.ts", "utf8");
ok(/isRetiredCustomDomain\(req\)/.test(pub) && /"deactivated"/.test(pub), "a megszűnt előfizetés saját címe a nyitóoldalra irányít");
const sync = readFileSync("scripts/domain-renewal-sync.mts", "utf8");
ok(/isLiveHost\(/.test(sync), "nem éles gépen a szinkron a kapcsolóhoz nem nyúl");

if (SELF_TEST) {
  console.log(failed > 0 ? "\n✅ önteszt: a kapu pirosra tud menni" : "\n❌ önteszt: a kapu NEM tud pirosra menni");
  process.exit(failed > 0 ? 0 : 1);
}
console.log(failed ? `\n❌ domain-autorenew: ${failed} hiba` : "\n✅ domain-autorenew: minden állítás zöld");
process.exit(failed ? 1 : 0);
