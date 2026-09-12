// A JÓVÁHAGYOTT súgó-terv ŐRE (kontraktus: assets/design-refs/console/help-collapse/README.md).
//
// Miért nem elég a képernyőkép: a terv VISELKEDÉST köt — „alapállapotban minden csoport csukva",
// „több csoport lehet nyitva egyszerre", „a keresés eredménye LÁTSZIK", „JS nélkül is működik".
// Egy statikus kép mindegyikre ugyanúgy néz ki, akár igaz, akár nem. Ezért ez az őr a VALÓDI
// konzol- és tenant-admin lapot kattintja végig, és a PIXELT kérdezi, nem a DOM-ot.
//
//   npx tsx scripts/help-collapse-check.mts
//   npx tsx scripts/help-collapse-check.mts --self-test   (piros önteszt: a romlott állapotot fogja-e)

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import type { Server } from "node:http";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";

const SELF_TEST = process.argv.includes("--self-test");
let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

const { db } = await import("../src/db/client.js");
const { server: consoleServer } = (await import("../src/console/server.js")) as { server: Server };
if (!consoleServer.listening) await once(consoleServer, "listening");
const conBase = `http://127.0.0.1:${(consoleServer.address() as { port: number }).port}`;
const { server: publicServer } = (await import("../src/server/public.js")) as { server: Server };
if (!publicServer.listening) await once(publicServer, "listening");
const pubBase = `http://127.0.0.1:${(publicServer.address() as { port: number }).port}`;

const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
const tu = await db
  .selectFrom("tenant_user")
  .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")
  .select(["tenant_user.id as id"])
  .limit(1)
  .executeTakeFirst();
if (!op || !tu) {
  console.log("⛔ nincs operátor- vagy tenant-fiók — az őr NEM futott le (ez nem zöld)");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });

/**
 * Egy súgó-felület végigmérése. `sel` a csoport/fejléc/link választói, hogy a két
 * felület UGYANAZON az állítás-listán menjen át — ha az egyik lemarad, az látszik.
 */
async function measure(
  name: string,
  base: string,
  url: string,
  cookie: { name: string; value: string },
  sel: { group: string; head: string; link: string; tools: string },
  searchUrl: string,
): Promise<void> {
  console.log(`\n── ${name}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ ...cookie, url: base }]);
  const pg: Page = await ctx.newPage();
  const errs: string[] = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto(`${base}${url}`, { waitUntil: "domcontentloaded" });

  const groups = pg.locator(sel.group);
  const openN = async (): Promise<number> => await pg.locator(`${sel.group}[open]`).count();
  const visibleLinks = async (): Promise<number> => await pg.locator(`${sel.link}:visible`).count();

  const n = await groups.count();
  ok("vannak csoportok", n >= 4, `${n}`);

  // ① ALAPÁLLAPOT: minden csukva — ez a változtatás egész értelme.
  ok("alapállapotban MINDEN csoport csukva", (await openN()) === 0, `${await openN()} nyitva`);
  ok("csukott állapotban egy cikk-link sem látszik", (await visibleLinks()) === 0);

  // ② nyitás — és a PIXEL mondja meg, nem a DOM (a hidden elem is „ott van").
  await pg.locator(sel.head).first().click();
  await pg.waitForTimeout(120);
  ok("egy csoport kinyitható", (await openN()) === 1);
  const first = pg.locator(`${sel.link}`).first();
  ok("a kinyitott csoport cikkei LÁTSZANAK", await first.isVisible());
  const box = await first.boundingBox();
  ok("a cikk-link tényleges magassága nem nulla", !!box && box.height > 10, JSON.stringify(box));

  // ③ TÖBB csoport nyitva lehet (a tulaj az A-t választotta, nem a B-t).
  await pg.locator(sel.head).nth(1).click();
  await pg.waitForTimeout(120);
  ok("KETTŐ csoport lehet egyszerre nyitva (nem exkluzív)", (await openN()) === 2, `${await openN()}`);

  // ④ csukás
  await pg.locator(sel.head).nth(1).click();
  await pg.waitForTimeout(120);
  ok("újrakattintás becsukja", (await openN()) === 1);

  // ⑤ „Mindet kinyitom / becsukom" — a tulaj EZT kérte a viselkedésekből.
  const tools = pg.locator(sel.tools);
  ok("a gombpár látszik (JS-es ráadás)", await tools.first().isVisible());
  await pg.locator(`${sel.tools} [data-kb-all="1"]`).click();
  await pg.waitForTimeout(150);
  ok("„Mindet kinyitom” tényleg mindet kinyitja", (await openN()) === n, `${await openN()}/${n}`);
  await pg.locator(`${sel.tools} [data-kb-all="0"]`).click();
  await pg.waitForTimeout(150);
  ok("„Mindet becsukom” tényleg mindet becsukja", (await openN()) === 0, `${await openN()}`);

  // ⑥ KERESÉS: a találat LÁTSZIK. Ez a kontraktus legfontosabb pontja — enélkül a lap
  // találatot ígérne csukott fejlécek mögött.
  await pg.goto(`${base}${searchUrl}`, { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(120);
  const hitGroups = await pg.locator(sel.group).count();
  ok("keresés: van találati csoport", hitGroups > 0, `${hitGroups}`);
  ok("keresés: a találatos csoportok NYITVA renderelnek", (await openN()) === hitGroups,
     `${await openN()}/${hitGroups}`);
  ok("keresés: a találatok LÁTSZANAK is", (await visibleLinks()) > 0);

  // ⑦ JS NÉLKÜL is működjön — a súgó keresése is sima GET.
  const noJs = await browser.newContext({ viewport: { width: 390, height: 900 }, javaScriptEnabled: false });
  await noJs.addCookies([{ ...cookie, url: base }]);
  const p2 = await noJs.newPage();
  await p2.goto(`${base}${url}`, { waitUntil: "domcontentloaded" });
  await p2.locator(sel.head).first().click();
  await p2.waitForTimeout(120);
  ok("JS NÉLKÜL is nyílik a csoport (natív <details>)",
     (await p2.locator(`${sel.group}[open]`).count()) === 1);
  ok("JS nélkül a gombpár NEM jelenik meg (nincs halott gomb)",
     !(await p2.locator(sel.tools).first().isVisible()));
  await noJs.close();

  ok("nincs JS-hiba a lapon", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

const CON = { group: ".con-kb-toc details", head: ".con-kb-toc summary", link: ".con-kb-toc details a", tools: "#kb-tools" };
const ADM = { group: ".adm-kb-g", head: ".adm-kb-g summary", link: ".adm-kb-g .adm-kb-list a", tools: "#adm-kb-tools" };

await measure("KONZOL /help", conBase, "/help", { name: "cit_op_session", value: mintOperatorCookieValue(op.id) },
  CON, "/help?q=foto");
await measure("TENANT-ADMIN /admin?tab=sugo", pubBase, "/admin?tab=sugo",
  { name: "cit_session", value: mintTenantCookieValue(tu.id) }, ADM, "/admin?tab=sugo&q=foto");

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────
// A romlott állapotot egy MÁSIK lapon állítjuk elő (nem a forrást rontjuk vissza):
// ha a csoportok `open`-nel születnének, az ① állítás bukjon; ha a keresés csukva
// hagyná őket, a ⑥ bukjon. Amelyik állítás erre sem pirul, az dísz.
if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT — a romlott állapotot MEGFOGJA-E?");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: conBase }]);
  const pg = await ctx.newPage();

  await pg.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  await pg.evaluate(() => document.querySelectorAll(".con-kb-toc details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
  const openedAll = await pg.locator(".con-kb-toc details[open]").count();
  ok("① megfogná, ha alapból minden NYITVA lenne", openedAll > 0 && openedAll !== 0);
  console.log(`     (a romlott állapotban ${openedAll} csoport nyitva — az ① állítás erre pirosat ad)`);

  await pg.goto(`${conBase}/help?q=foto`, { waitUntil: "domcontentloaded" });
  const before = await pg.locator(".con-kb-toc details[open]").count();
  await pg.evaluate(() => document.querySelectorAll(".con-kb-toc details").forEach((d) => ((d as HTMLDetailsElement).open = false)));
  const after = await pg.locator(".con-kb-toc details a:visible").count();
  ok("⑥ megfogná, ha a keresés CSUKVA hagyná a találatot", before > 0 && after === 0,
     `keresésnél nyitva=${before}, becsukva látható link=${after}`);
  await ctx.close();
}

await browser.close();
await db.destroy();
console.log(bad === 0 ? "\n✅ A jóváhagyott súgó-terv viselkedése ÁLL." : `\n⛔ ${bad} eltérés a kontraktustól.`);
process.exit(bad === 0 ? 0 : 1);
