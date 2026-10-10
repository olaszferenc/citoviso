// proba-C (design-refs/console/proba-c, approved 2026-10-10; ADR-0354 "C", ADR-0356) — the
// trialist's checkout and the plan page a trial mail opens, CLICKED in a real browser.
// What this proves, each leg a promise the approved plan makes:
//   ① /folytatas during the trial: annual is the default; the price line carries the ONE
//      discount („Próba-kedvezmény −X% az első évre · a próba végéig, <nap>-ig”) — no ribbon,
//      no escalation pop-up (the pinned trial offer may be an escalation offer);
//   ② annual adds the savings up (free months + the trial % on the first year); monthly says
//      „csak az első hónapra” and „Évesre váltok” switches the ONE period state;
//   ③ step 2: the card names the deadline and the first year; the next-charge line says the
//      paid period starts after the trial (subscription.ts, ADR-0354 ⓐ);
//   ④ ADR-0356 rename: a label held by another lead is refused; a free one is committed with
//      „Ezt választom”, the old address's fate is spelled out, and the ORDER carries it;
//   ⑤ a lapsed trial: the list price, the „szünetel” line first, no discount line;
//   ⑥ the plan page from the trial campaign mail (forras=proba&proba=nyit): no escalation
//      card, the trial form open with the one line, the visit beacon carries forras=proba
//      (Elek3 B2 — the server then mints no escalation offer; free-trial-e2e ⑩); the control without the param still
//      shows the card (the suppression is scoped, not a global switch-off);
//   ⑦ 0 JS errors, at 390 px and 1280 px.
//
// The dev DB is SHARED: every row is this run's own and deleted in `finally` (leftovers of a
// crashed earlier run are swept by their `_pcc_` prefix). EMAIL_PROVIDER must be mock.
//
// Run: EMAIL_PROVIDER=mock npx tsx scripts/proba-c-checkout-check.mts

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";

const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock") {
  console.error(`⛔ proba-c-checkout-check: EMAIL_PROVIDER=${config.emailProvider} — a próba valódi belépő-levelet küldene. Futtasd: EMAIL_PROVIDER=mock`);
  process.exit(2);
}
const { db } = await import("../src/db/client.js");
const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");

const stamp = Date.now().toString(36);
let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};
const jsErrors: string[] = [];

const SITE: SiteData = {
  name: `_pcc_${stamp} Üdülő`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló üdülő, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/pcc-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE: Recipe = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const MOCK_REL = `sites/_pcc_${stamp}.html`;
const MOCK_FILE = path.resolve(process.cwd(), MOCK_REL);
const FORM = { name: "Teszt Elek", email: "pcc@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

const leads: string[] = [];
async function fixture(tag: string, label: string, pct: number, kind: "outreach" | "escalation", runId: string) {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: runId, name: `_pcc_${stamp} Üdülő ${tag}`, raw: JSON.stringify({}), preview_label: label })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: MOCK_REL, inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `pcc${stamp}${tag}xxxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9]/g, "");
  const pr = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("offer")
    .values({
      kind,
      prospect_id: pr.id,
      percent: pct,
      scope: "initial",
      ...(kind === "escalation" ? { expires_at: new Date(Date.now() + 70 * 3_600_000) } : {}),
    })
    .execute();
  return { leadId: lead.id, token };
}

const browser = await chromium.launch();
let closeConsole: (() => void) | null = null;
try {
  await writeFile(MOCK_FILE, "<!doctype html><html lang=\"hu\"><head><title>t</title></head><body><main><h1>Üdülő</h1><p>mock</p></main></body></html>");
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: `_pcc_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;

  // A trial whose pinned offer is an ESCALATION one (the case that popped the card up).
  const t = await fixture("t", `pcc-${stamp}-udulo`, 50, "escalation", runId);
  const rt = await startTrial(t.token, FORM);
  // A lapsed trial: ended yesterday, its offer expired with it.
  const l = await fixture("l", `pcc-${stamp}-lejart`, 25, "outreach", runId);
  const rl = await startTrial(l.token, FORM);
  const DAY = 86_400_000;
  await db
    .updateTable("free_trial")
    .set({ status: "lapsed", started_at: new Date(Date.now() - 15 * DAY), created_at: new Date(Date.now() - 15 * DAY), trial_until: new Date(Date.now() - DAY), lapsed_at: new Date() })
    .where("lead_id", "=", l.leadId)
    .execute();
  const lt = await db.selectFrom("free_trial").select("offer_id").where("lead_id", "=", l.leadId).executeTakeFirst();
  if (lt?.offer_id) await db.updateTable("offer").set({ expires_at: new Date(Date.now() - DAY) }).where("id", "=", lt.offer_id).execute();
  // A plan-page lead (no trial) with a live escalation offer.
  const pl = await fixture("p", `pcc-${stamp}-terv`, 50, "escalation", runId);
  check("a fixtúra-próbák elindultak", rt.ok && rl.ok, JSON.stringify([rt.ok, rl.ok]));

  const { server } = await import("../src/console/server.js");
  closeConsole = () => {
    server.closeAllConnections();
    server.close();
  };
  if (!server.listening) await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  for (const [w, tag] of [[390, "390px"], [1280, "asztali"]] as const) {
    console.log(`── ${tag}`);
    const open = async (url: string, opts: { keepConsent?: boolean } = {}): Promise<Page> => {
      const p = await browser.newPage({ viewport: { width: w, height: 900 } });
      p.on("pageerror", (e) => jsErrors.push(`${tag} ${url}: ${e.message}`));
      await p.goto(base + url, { waitUntil: "networkidle" });
      // The consent bar sits over the panel's foot on a phone; a visitor answers it first.
      const essentials = p.getByRole("button", { name: "Csak a szükségeseket" });
      if (!opts.keepConsent && (await essentials.isVisible().catch(() => false))) await essentials.click();
      return p;
    };
    const openPanel = async (p: Page) => {
      const launch = p.locator(".cit-cfg-launch");
      await launch.waitFor({ state: "visible", timeout: 15_000 });
      await launch.click();
      await p.waitForSelector(".cit-cfg-panel .cit-cfg-mini__amt", { state: "visible" });
      await p.waitForTimeout(300);
    };

    let p = await open(`/p/${t.token}/folytatas`);
    await openPanel(p);
    // ① price line + annual default + no escalation card
    const line = (await p.textContent(".cit-cfg-mini__offer")) ?? "";
    check("① éves az alapértelmezés", (await p.getAttribute('.cit-cfg-ppill [data-period="annual"]', "aria-pressed")) === "true");
    check("① az ár-sor: Próba-kedvezmény −50% az első évre · a próba végéig, <nap>-ig", /^Próba-kedvezmény −50% az első évre · a próba végéig, [^·]+-ig$/.test(line.trim()), line);
    check("① nincs döntés-segítő kártya a folytatáson", (await p.locator(".cit-cfg-esccard").count()) === 0);
    // ② savings / monthly honesty / switch back
    check("② éves: a megtakarítás összeadva", ((await p.textContent(".cit-cfg-tsavebox")) ?? "").includes("Megtakarítás az első évben"));
    if (w === 390) {
      // Elek3 A5: on a phone the sticky foot must leave room to choose (it took half the
      // screen); the breakdown folds under its sum and opens with one tap.
      const footH = await p.locator(".cit-cfg-foot").evaluate((e) => e.getBoundingClientRect().height);
      check("A5: mobilon az alsó összegző sáv a képernyő legfeljebb negyede", footH <= 900 * 0.25, `${Math.round(footH)} px / 900`);
      await p.locator(".cit-cfg-tsave--fold > summary:visible").first().click();
      const opened = await p.locator(".cit-cfg-tsave--fold:visible").first().evaluate((e) => (e as HTMLDetailsElement).open).catch(() => false);
      check("A5: …a bontás egy koppintással kinyílik (12 havi lista / 2 hó / próba-%)", opened && ((await p.locator(".cit-cfg-tsave--fold:visible").first().textContent()) ?? "").includes("12 havi díj listaáron"));
      await p.locator(".cit-cfg-tsave--fold > summary:visible").first().click();
    }
    check("② a „bekapcsolva marad a próba végéig” sor", ((await p.textContent(".cit-cfg-cnote")) ?? "").includes("bekapcsolva marad a próba végéig"));
    await p.locator('.cit-cfg-ppill [data-period="monthly"]').click();
    const mline = (await p.textContent(".cit-cfg-mini__offer")) ?? "";
    check("② havi: „csak az első hónapra”", mline.includes("— csak az első hónapra · a próba végéig"), mline);
    await p.locator(".cit-cfg-toannual:visible").first().click();
    check("② „Évesre váltok” átvált (egy állapot)", (await p.getAttribute('.cit-cfg-ppill [data-period="annual"]', "aria-pressed")) === "true");
    // ④ rename (step 1 body)
    await p.locator(".cit-cfg-ren__open").scrollIntoViewIfNeeded();
    await p.locator(".cit-cfg-ren__open").click();
    await p.fill(".cit-cfg-ren__in", `pcc-${stamp}-lejart`);
    await p.waitForFunction(() => /foglalt|Nem választható/.test(document.querySelector(".cit-cfg-ren__msg")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
    check("④ másik lead címe: foglalt", ((await p.textContent(".cit-cfg-ren__msg")) ?? "").includes("foglalt"));
    // Elek3 A4: a refused label cannot be chosen — the button is off, and pressing it keeps the old address.
    check("④ foglalt címnél az „Ezt választom” tiltott", await p.locator(".cit-cfg-ren__apply").isDisabled());
    const hostBefore = (await p.textContent(".cit-cfg-ren__host")) ?? "";
    await p.locator(".cit-cfg-ren__apply").click({ force: true });
    const hostAfter = (await p.textContent(".cit-cfg-ren__host")) ?? "";
    check("④ …megnyomva sem változik a cím", !!hostBefore && hostAfter === hostBefore && (await p.locator(".cit-cfg-ren__fate").isHidden()), `${hostBefore} → ${hostAfter}`);
    await p.fill(".cit-cfg-ren__in", "admin");
    await p.waitForFunction(() => /fenntartott|Nem választható/.test(document.querySelector(".cit-cfg-ren__msg")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
    check("④ fenntartott névnél is tiltott", await p.locator(".cit-cfg-ren__apply").isDisabled(), (await p.textContent(".cit-cfg-ren__msg")) ?? "");
    await p.fill(".cit-cfg-ren__in", `PCC ${stamp} Új Név`);
    await p.waitForFunction(() => /Szabad:/.test(document.querySelector(".cit-cfg-ren__msg")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
    await p.locator(".cit-cfg-ren__apply").click();
    const want = `pcc-${stamp}-uj-nev.citoviso.com`;
    const fate = (await p.textContent(".cit-cfg-ren__fate")) ?? "";
    check("④ „Ezt választom” után az új cím és a régi sorsa", fate.includes(want) && fate.includes("örökre az újra irányít"), fate.slice(0, 80));
    check("④ a fejléc-cím az új", ((await p.textContent(".cit-cfg-ren__host")) ?? "") === want);
    // ③ step 2
    await p.locator(".cit-cfg-next").click();
    await p.waitForSelector(".cit-cfg-step2:not([hidden])");
    const card = (await p.textContent(".cit-cfg-sum")) ?? "";
    check("③ a kártya: határidő + „az első év”", card.includes("a próba végéig") && card.includes("az első év"), card.slice(0, 120));
    const nc = (await p.textContent(".cit-cfg-nextcharge")) ?? "";
    check("③ a fizetett időszak a próba vége után indul", nc.startsWith("A fizetett időszak a próba vége után indul"), nc);
    // ④ the order carries the committed label: intercept the order POST
    let posted: string | null = null;
    await p.route("**/request", async (route) => {
      posted = route.request().postData();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "pcc-intercept" }) });
    });
    const rights = p.locator(".cit-cfg-s2decl input[type=checkbox]");
    if (await rights.count()) await rights.first().check({ force: true });
    await p.locator(".cit-cfg-submit").click();
    await p.waitForSelector('.cit-cfg-i[data-f="buyer_name"]', { state: "visible", timeout: 10_000 });
    const fill = async (key: string, v: string) => {
      const i = p.locator(`.cit-cfg-i[data-f="${key}"]`);
      if ((await i.count()) && (await i.isVisible()) && !(await i.inputValue()).trim()) await i.fill(v);
    };
    await fill("buyer_name", "Teszt Elek");
    await fill("buyer_zip", "8360");
    await fill("buyer_city", "Keszthely");
    await fill("buyer_address", "Fő utca 1.");
    await fill("buyer_email", "pcc@example.invalid");
    for (const c of await p.locator(".cit-cfg-consent input[type=checkbox]").all()) await c.check({ force: true });
    await p.locator(".cit-cfg-pay").click({ timeout: 10_000 });
    await p.waitForTimeout(800);
    const body = posted ? JSON.parse(posted as string) as { domain_name?: string } : null;
    check("④ a rendelés a választott címet viszi", body?.domain_name === want, String(body?.domain_name ?? posted ?? "nincs POST"));
    await p.close();

    // ⑤ lapsed
    p = await open(`/p/${l.token}/folytatas`);
    await openPanel(p);
    check("⑤ lejárt: a „szünetel” sor elöl", ((await p.textContent(".cit-cfg-cnote--lapsed")) ?? "").includes("a honlap szünetel"));
    check("⑤ lejárt: nincs kedvezmény-sor", ((await p.textContent(".cit-cfg-mini__offer")) ?? "").trim() === "");
    await p.close();

    // ⑥ plan page from the trial mail, and the control
    p = await open(`/p/${pl.token}?forras=proba&proba=nyit`);
    // Elek3 B2: the visit beacon tells the server it came from the trial mail (no escalation).
    const viewBodies: string[] = [];
    p.on("request", (r) => {
      if (/\/view$/.test(r.url()) && r.method() === "POST") viewBodies.push(r.postData() ?? "");
    });
    await p.waitForSelector(".cit-cfg-talt span", { state: "attached", timeout: 10_000 }).catch(() => {});
    await p.mouse.wheel(0, 200);
    await p.waitForTimeout(2500);
    check("⑥ a látogatás-jelzés viszi a forras=proba jelet", viewBodies.some((b) => b.includes('"forras":"proba"')), viewBodies.join(" | ") || "nem ment jelzés");
    check("⑥ a próba-levélből: nincs döntés-segítő kártya", (await p.locator(".cit-cfg-esccard.cit-cfg-on").count()) === 0);
    const alt = (await p.textContent(".cit-cfg-talt span").catch(() => "")) ?? "";
    check("⑥ a próba-űrlap nyitva, egy sorban a kedvezmény", alt.startsWith("−50% az első díjból, ha a próba végéig megrendeli"), alt);
    await p.close();
    p = await open(`/p/${pl.token}`, { keepConsent: true });
    const shown = await p.waitForSelector(".cit-cfg-esccard.cit-cfg-on", { timeout: 10_000 }).then(() => true, () => false);
    check("⑥ kontroll: paraméter nélkül a kártya marad", shown);
    // Elek2 (2026-10-10): with the consent bar still up, every card button must be hit-able —
    // on a phone „Most még gondolkodom” sat behind the bar.
    // On the sent page the bar waits for the first scroll (cit-consent.js renderWhenEngaged).
    await p.mouse.wheel(0, 300);
    await p.waitForSelector("#cit-consent", { state: "visible", timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(600);
    const consentUp = await p.locator("#cit-consent").isVisible().catch(() => false);
    check("⑥ (a süti-sáv fent van a mérésnél)", consentUp);
    const blocked = await p.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>(".cit-cfg-esccard button").forEach((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!hit || !(hit === b || b.contains(hit))) out.push((b.textContent ?? "").trim());
      });
      return out;
    });
    check("⑥ a kártya gombjai a süti-sáv mellett is elérhetők", shown && blocked.length === 0, blocked.join(", "));
    await p.close();
  }
  check("⑦ 0 JS-hiba", jsErrors.length === 0, jsErrors.join(" | "));
} finally {
  closeConsole?.();
  await browser.close();
  overrideFreeTrialConfigInProcess(null);
  await rm(MOCK_FILE, { force: true });
  const stale = await db.selectFrom("lead").select("id").where("name", "like", "\\_pcc\\_%").execute();
  for (const r of stale) if (!leads.includes(r.id)) leads.push(r.id);
  for (const lid of leads) {
    const tIds = (await db.selectFrom("tenant").select("id").where("lead_id", "=", lid).execute()).map((r) => r.id);
    for (const tid of tIds) {
      await db.deleteFrom("offer").where("tenant_id", "=", tid).execute();
      await db.deleteFrom("tenant_user").where("tenant_id", "=", tid).execute();
      await rm(path.resolve(process.cwd(), "sites", tid), { recursive: true, force: true });
    }
    await db.deleteFrom("free_trial").where("lead_id", "=", lid).execute();
    for (const tid of tIds) await db.deleteFrom("tenant").where("id", "=", tid).execute();
    const pIds = (await db.selectFrom("prospect").select("id").where("lead_id", "=", lid).execute()).map((r) => r.id);
    for (const pid of pIds) {
      await db.deleteFrom("offer").where("prospect_id", "=", pid).execute();
      const vIds = (await db.selectFrom("mock_view").select("id").where("prospect_id", "=", pid).execute()).map((r) => r.id);
      for (const v of vIds) await db.deleteFrom("mock_event").where("mock_view_id", "=", v).execute();
      await db.deleteFrom("mock_view").where("prospect_id", "=", pid).execute();
    }
    await db.deleteFrom("prospect").where("lead_id", "=", lid).execute();
    await db.deleteFrom("mock_artifact").where("lead_id", "=", lid).execute();
    await db.deleteFrom("lead").where("id", "=", lid).execute();
  }
  const defs = await db.selectFrom("scraper_definition").select("id").where("label", "like", "\\_pcc\\_%").execute();
  for (const d of defs) {
    await db.deleteFrom("scrape_run").where("scraper_definition_id", "=", d.id).execute();
    await db.deleteFrom("scraper_definition").where("id", "=", d.id).execute();
  }
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n⛔ proba-c-checkout-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ proba-c-checkout-check: a próba-folytatás és a próba-levél terv-lapja a jóváhagyott terv szerint működik");
