// GUARD (ADR-0276): the house gets a mail when a timer, a booking mail or a payment
// webhook fails — proven for all three branches, each with a NEGATIVE control, against
// a mock mail sender (nothing leaves the machine, the DB is only read).
//
//   npx tsx scripts/house-alert-check.mts
//
// ① timer    — the unit registry demands OnFailure=citoviso-alert@%n.service on every prod
//              service (red on a copy with the line removed), the alert template has none
//              (no loop), and alertUnitFailure mails the unit name + journal.
// ② booking  — mailSafe: a throwing send → one alert with the booking_request id; a
//              succeeding send → no alert; a throwing ALERT → mailSafe still returns,
//              the alert is attempted exactly once (no loop).
// ③ webhook  — the REAL console route over HTTP (in-process, ephemeral port, mock gateway):
//              unknown paid payment → 400 + alert; malformed body → 400 + alert; a DB error
//              → 500 + alert; unknown FAILED payment (the harmless orphan) → 200, NO alert;
//              the same 400 again → deduped, no second mail.
// ④ servers  — ADR-0279: citoviso-public/console are prod units in the repo WITH OnFailure=,
//              their prod render equals the live unit (deploy/systemd/prod-snapshot/, sha
//              measured on the VPS 2026-09-30) plus exactly that one line; a crash loop mails
//              the 1st, 11th, 101st… crash only.
// ⑤ [TESZT]  — off the live host (isLiveHost) every alert subject starts with "[TESZT] ".
//
// Every expectation is counted; a check that could not run is a failure, not a skip.

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";

// Before any import that reads the env: the mock gateway parses our hand-made callbacks,
// the console must not run its boot-time AI top-ups, and it takes an ephemeral port.
process.env.PAYMENT_GATEWAY = "mock";
process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";

const { setHouseAlertDeps, alertUnitFailure, unitAlertDue } = await import("../src/console/houseAlert.js");
const { checkUnits, renderProd, ALERT_UNIT, ON_FAILURE_LINE } = await import("./systemd-units.mts");
type Mail = { to: string; subject: string; text: string };

let fails = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}`);
  if (!c) fails++;
};

const outbox: Mail[] = [];
let sendThrows = false;
let sendCalls = 0;
let baseUrl = "https://citoviso.com";
setHouseAlertDeps({
  publicBaseUrl: () => baseUrl,
  recipientEmail: async () => "haz@example.test",
  send: async (m) => {
    sendCalls++;
    if (sendThrows) throw new Error("mock SMTP down");
    outbox.push({ to: m.to, subject: m.subject, text: m.text });
    return { id: "mock", provider: "mock" };
  },
});
const drain = () => outbox.splice(0, outbox.length);

// ── ① timer ──────────────────────────────────────────────────────────────────────
console.log("① időzítő → OnFailure → riasztás");
{
  const dir = "deploy/systemd";
  const manifest = JSON.parse(readFileSync(path.join(dir, "targets.json"), "utf8"));
  const files: Record<string, string> = {};
  for (const f of readdirSync(dir)) if (/\.(timer|service)$/.test(f)) files[f] = readFileSync(path.join(dir, f), "utf8");
  ok(checkUnits(manifest, files).length === 0, "a repó egység-nyilvántartása zöld");
  const prodServices = Object.entries(manifest.timers as Record<string, { target: string }>)
    .filter(([, e]) => e.target === "prod")
    .map(([t]) => t.replace(/\.timer$/, ".service"));
  ok(prodServices.length > 0, `van prod service (${prodServices.length})`);
  ok(prodServices.every((s) => files[s]!.split("\n").includes(ON_FAILURE_LINE)), `mind a ${prodServices.length} prod service-ben ott az ${ON_FAILURE_LINE}`);
  ok(!!files[ALERT_UNIT] && !/^OnFailure=/m.test(files[ALERT_UNIT]!), `${ALERT_UNIT} létezik, és NINCS saját OnFailure-je`);
  // Negative control: the same registry, one prod service without the line → RED.
  const victim = prodServices[0]!;
  const broken = { ...files, [victim]: files[victim]!.replace(ON_FAILURE_LINE + "\n", "") };
  ok(checkUnits(manifest, broken).some((p: string) => p.startsWith(victim) && p.includes("OnFailure")), `NEGATÍV: ${victim} OnFailure nélkül → piros`);
  // And on a real copy on disk, via the CLI the pre-commit runs.
  const tmp = mkdtempSync(path.join(tmpdir(), "house-alert-units-"));
  cpSync(dir, tmp, { recursive: true });
  writeFileSync(path.join(tmp, victim), broken[victim]!);
  const { spawnSync } = await import("node:child_process");
  const cli = spawnSync("npx", ["tsx", "scripts/systemd-units.mts", "check", tmp], { encoding: "utf8" });
  ok(cli.status === 1 && /OnFailure/.test(cli.stderr), "NEGATÍV: a `systemd-units check` CLI is pirosra megy a sérült másolaton");

  drain();
  ok((await alertUnitFailure("citoviso-billing.service", "szept 29 03:00 billing-cycle HIBA: x")) === true, "alertUnitFailure → true");
  const m = drain();
  ok(m.length === 1 && m[0]!.to === "haz@example.test", "egy levél ment, az alert_email címre");
  ok(m[0]?.subject.includes("citoviso-billing.service") === true && m[0]!.text.includes("billing-cycle HIBA: x"), "a levél viszi az egység nevét és a journal-sorokat");
}

// ── ④ long-running servers ───────────────────────────────────────────────────────
console.log("④ public/console a repóból, OnFailure-rel; az éles alak = a mai éles + 1 sor");
{
  const dir = "deploy/systemd";
  const manifest = JSON.parse(readFileSync(path.join(dir, "targets.json"), "utf8"));
  // The live units as read from the VPS on 2026-09-30 (sha256sum /etc/systemd/system/…).
  const LIVE_SHA: Record<string, string> = {
    "citoviso-public.service": "281f9012549232fc2de8fdfd067dc0f386f0b1ae30e809413fd79b8d7b667710",
    "citoviso-console.service": "9f6bd77a920101d24ea6e486e9be02d51c13c3d95ff9ac3d21871d9dd4f0d84e",
  };
  // Prod render minus the one allowed line must equal the live snapshot, byte for byte.
  const matchesLive = (repo: string, live: string): boolean => {
    const out = renderProd(repo).split("\n");
    const i = out.indexOf(ON_FAILURE_LINE);
    if (i < 0 || out.lastIndexOf(ON_FAILURE_LINE) !== i) return false;
    out.splice(i, 1);
    return out.join("\n") === live;
  };
  for (const [u, sha] of Object.entries(LIVE_SHA)) {
    ok(manifest.services?.[u]?.target === "prod", `${u}: a targets.json-ban prod`);
    const repo = readFileSync(path.join(dir, u), "utf8");
    ok(renderProd(repo).split("\n").includes(ON_FAILURE_LINE), `${u}: az éles alakban ott az ${ON_FAILURE_LINE}`);
    const live = readFileSync(path.join(dir, "prod-snapshot", u), "utf8");
    ok(createHash("sha256").update(live).digest("hex") === sha, `${u}: a prod-snapshot a VPS-en mért sha-val egyezik`);
    ok(matchesLive(repo, live), `${u}: az éles render = a mai éles unit + pontosan 1 sor (OnFailure=)`);
    ok(!matchesLive(repo.replace("RestartSec=3", "RestartSec=5"), live), `NEGATÍV: ${u} egy további eltéréssel → nem egyezik`);
    ok(!matchesLive(repo.replace(ON_FAILURE_LINE + "\n", ""), live), `NEGATÍV: ${u} OnFailure nélkül → nem egyezik`);
    const files: Record<string, string> = {};
    for (const f of readdirSync(dir)) if (/\.(timer|service)$/.test(f)) files[f] = readFileSync(path.join(dir, f), "utf8");
    ok(
      checkUnits(manifest, { ...files, [u]: repo.replace(ON_FAILURE_LINE + "\n", "") }).some((p: string) => p.startsWith(u) && p.includes("OnFailure")),
      `NEGATÍV: ${u} OnFailure nélkül → a systemd-units check piros`,
    );
  }
  const due = (n: number) => unitAlertDue({ subState: "auto-restart", nRestarts: n });
  ok([0, 10, 100, 1000, 10000].every(due), "crash-hurok: az 1., 11., 101., 1001., 10001. összeomlás levelet kap");
  ok(![1, 2, 9, 11, 99, 101, 500, 1001].some(due), "NEGATÍV: a köztes összeomlások nem kapnak levelet");
  ok(unitAlertDue({ subState: "failed", nRestarts: 7 }), "leállva maradt egység (időzítő-tick) → mindig levél");
  drain();
  await alertUnitFailure("citoviso-public.service", "szept 30 07:00 public HIBA: y", { subState: "auto-restart", nRestarts: 10 });
  const m = drain();
  ok(m.length === 1 && m[0]!.subject.includes("újraindul") && m[0]!.subject.includes("11. összeomlás"), "újrainduló szerver → „újraindul … 11. összeomlás” tárgy");
  ok(!m[0]?.subject.includes("időzített") && m[0]!.text.includes("public HIBA: y"), "a szerver-levél nem „időzített feladatnak” hívja, és viszi a naplót");
}

// ── ⑤ [TESZT] ────────────────────────────────────────────────────────────────────
console.log("⑤ nem éles hoston a riasztás tárgya [TESZT]-tel kezdődik");
{
  drain();
  baseUrl = "https://mineral.tail3a89f.ts.net:8443";
  await alertUnitFailure("citoviso-billing.service", "x");
  baseUrl = "http://localhost:4800";
  await alertUnitFailure("citoviso-billing.service", "x");
  baseUrl = "https://citoviso.com";
  await alertUnitFailure("citoviso-billing.service", "x");
  const m = drain();
  ok(m.length === 3, `mindhárom levél elment — a dev NINCS némítva (mérve: ${m.length})`);
  ok(m[0]?.subject.startsWith("[TESZT] Citoviso:") === true && m[1]?.subject.startsWith("[TESZT] ") === true, "nem éles base URL → „[TESZT] ” előtag");
  ok(m[2]?.subject.startsWith("Citoviso:") === true, "NEGATÍV: https://citoviso.com → nincs előtag");
}

// ── ② booking mail ───────────────────────────────────────────────────────────────
console.log("② foglalási levél → mailSafe → riasztás");
{
  const { mailSafe } = await import("../src/booking/requests.js");
  drain();
  await mailSafe("owner-notify", "11111111-2222-3333-4444-555555555555", async () => {
    throw new Error("SMTP 553 mailbox unavailable");
  });
  let m = drain();
  ok(m.length === 1, "elhasalt levél → pontosan egy riasztás");
  ok(m[0]?.text.includes("11111111-2222-3333-4444-555555555555") === true && m[0]!.text.includes("SMTP 553"), "a riasztás viszi a booking_request id-t és a hibát");
  ok(m[0]?.subject.includes("owner-notify") === true, "a tárgy megnevezi a levelet");
  await mailSafe("guest-ack", "66666666-2222-3333-4444-555555555555", async () => undefined);
  ok(drain().length === 0, "NEGATÍV: sikeres levél → nincs riasztás");
  // No loop: the alert mail itself fails → mailSafe still resolves, one attempt only.
  sendThrows = true;
  sendCalls = 0;
  let threw = false;
  try {
    await mailSafe("guest-accepted", "77777777-2222-3333-4444-555555555555", async () => {
      throw new Error("SMTP down");
    });
  } catch {
    threw = true;
  }
  sendThrows = false;
  ok(!threw && sendCalls === 1, `a riasztó levél bukása: mailSafe nem dob, 1 kísérlet (mérve: ${sendCalls}) — nincs hurok`);
}

// ── ③ webhook ────────────────────────────────────────────────────────────────────
console.log("③ fizetési webhook 4xx/5xx → riasztás (valódi route, HTTP)");
{
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  ok(port > 0, `a konzol felállt (port ${port})`);
  const post = async (body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${port}/pay/webhook/mock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    await new Promise((r) => setTimeout(r, 150)); // the alert is fire-and-forget
    return { status: r.status, text };
  };
  const tag = `hac-${Date.now().toString(36)}`;

  drain();
  let r = await post({ gatewayRef: `${tag}-paid`, status: "paid" });
  let m = drain();
  ok(r.status === 400, `ismeretlen, SIKERES fizetés → 400 (mérve: ${r.status})`);
  ok(m.length === 1 && m[0]!.text.includes(`${tag}-paid`) && m[0]!.text.includes("nincs payment-sorunk"), "→ riasztás a payment id-val és az okkal");
  ok(!r.text.includes("payment-sor"), "az ok NEM megy vissza a szolgáltatónak a válaszban");

  r = await post({ gatewayRef: `${tag}-paid`, status: "paid" });
  ok(r.status === 400 && drain().length === 0, "ugyanaz a 400 újra (Barion-újrapróba) → nincs második levél");

  r = await post({ status: "paid" });
  m = drain();
  ok(r.status === 400 && m.length === 1 && m[0]!.text.includes("nem értelmezhető"), "értelmezhetetlen visszahívás → 400 + riasztás");

  r = await post({ gatewayRef: `${tag}-nul\u0000x`, status: "paid" });
  m = drain();
  ok(r.status === 500, `DB-hiba a feldolgozásban → 500 (mérve: ${r.status})`);
  ok(m.length === 1 && m[0]!.subject.includes("500"), "→ riasztás 500-zal");

  r = await post({ gatewayRef: `${tag}-orphan`, status: "failed" });
  ok(r.status === 200 && drain().length === 0, "NEGATÍV: ismeretlen, pénz nélkül zárult fizetés → 200, nincs riasztás");

  server.close();
}

const { db } = await import("../src/db/client.js");
await db.destroy();
setHouseAlertDeps(null);
console.log(fails ? `\n⛔ house-alert-check: ${fails} FAIL` : "\n✅ house-alert-check: mindhárom ág riaszt, a negatív kontrollok csendesek");
process.exit(fails ? 1 : 0);
