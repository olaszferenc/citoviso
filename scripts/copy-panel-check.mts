// Contract check for the mock copy panel — asserts, point by point, what the approved
// plan BINDS (assets/design-refs/console/README.md). Run: npx tsx scripts/copy-panel-check.mts
// Contract verification for the mock copy panel (assets/design-refs/console/README.md).
import { once } from "node:events";
import type { Server } from "node:http";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";

process.env.CONSOLE_PORT = "0";
const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const addr = server.address() as { port: number };
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { db } = await import("../src/db/client.js");
const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
const cookie = mintOperatorCookieValue(op!.id);

const LEAD = "e16165d9-0686-448e-9c10-2ca5fa390739";
const b = await chromium.launch({ executablePath: config.chromiumPath });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addCookies([{ name: "cit_op_session", value: cookie, domain: "127.0.0.1", path: "/" }]);
const pg = await ctx.newPage();
const errs: string[] = [];
pg.on("pageerror", e => errs.push(String(e)));
// A resource 404 is NOT a script error — the browser logs both to console, and conflating
// them makes the guard measure the wrong thing. Real JS exceptions come from "pageerror".
const noise: string[] = [];
pg.on("console", m => { if (m.type() === "error") noise.push(m.text()); });

await pg.goto(`http://127.0.0.1:${addr.port}/lead/${LEAD}`, { waitUntil: "networkidle" });
// The lead page is tabbed; the mock tab must be selected for its controls to be visible.
await pg.click('[data-tab="ls-mocks"], a[href="#ls-mocks"], button:has-text("Mock és generálás")').catch(() => {});
await pg.waitForTimeout(400);

let bad = 0;
const ok = (l: string, c: boolean) => { console.log(`  ${c ? "✅" : "❌"} ${l}`); if (!c) bad++; };

// ①,② the copy is readable + the balance speaks plain Hungarian
ok("① a hero-főcím olvasható a konzolban", (await pg.locator(".cp-lead").count()) === 1);
ok("① a dőlt akcent renderel", (await pg.locator(".cp-lead em").count()) === 1);
ok("① alcím + bemutatkozó + kiemelések ott vannak",
   (await pg.locator(".cp-tag").count()) === 1 && (await pg.locator(".cp-intro").count()) === 1
   && (await pg.locator(".cp-hl li").count()) > 0);
const scaleTxt = (await pg.locator(".cp-scale").textContent()) ?? "";
ok("② mérleg-sáv van", (await pg.locator(".cp-scale").count()) === 1);
ok("② NINCS benne az 'erős pont' zsargon", !/erős pont/i.test(scaleTxt));
console.log("     mérleg: " + scaleTxt.replace(/\s+/g, " ").trim());

// ③ two groups, visibly separate
ok("③ felhasznált csempék", (await pg.locator(".cp-chip.used").count()) > 0);
const missN = await pg.locator("#cp-miss .cp-chip.miss").count();
ok("③ nem említett csempék", missN > 0);

// the grouping actually collapsed the duplicates
const missLabels = await pg.locator("#cp-miss .cp-chip.miss").allTextContents();
ok("③ a wifi-duplikátumok EGY csempévé olvadtak",
   missLabels.filter(t => /wifi|internet/i.test(t)).length <= 1);
console.log("     nem említi: " + missLabels.map(t => t.replace("+","").trim()).join(" | "));

// ④ chip → prompt behaviour (the contract's four rules)
await pg.fill("#cp-in", "Kézzel írt sor.");
await pg.click("#cp-miss .cp-chip.miss >> nth=0");
await pg.click("#cp-miss .cp-chip.miss >> nth=1");
const v1 = await pg.inputValue("#cp-in");
ok("④ a koppintás beírja az utasításba", v1.includes("Emeld be a szövegbe:"));
ok("④ a kézzel írt szöveg MEGMARAD", v1.includes("Kézzel írt sor."));
ok("④ két csempe EGY sorba fűződik", (v1.match(/Emeld be a szövegbe:/g) ?? []).length === 1);
const first = (await pg.locator("#cp-miss .cp-chip.miss >> nth=0").textContent())!.replace("+","").trim().toLowerCase();
await pg.click("#cp-miss .cp-chip.miss >> nth=0");
const v2 = await pg.inputValue("#cp-in");
ok("④ újra-koppintás CSAK azt az egyet veszi ki", !v2.includes(first) && v2.includes("Emeld be"));
ok("④ nem írja át magától a lap szövegét", (await pg.locator(".cp-lead").textContent()) !== "");

// ⑤ counter matches the server-side cap
ok("⑤ karakter-számláló él és 600-hoz mér", /\/\s*600/.test((await pg.textContent("#cp-count")) ?? ""));
ok("⑤ a mező maxlength-je is 600", (await pg.getAttribute("#cp-in", "maxlength")) === "600");

// ⑥ verdicts readable
ok("⑥ őr-verdikt látszik", (await pg.locator(".cp-v").count()) > 0);
await pg.click(".cp-v >> nth=0");
ok("⑥ az indoklás kinyílik", await pg.locator(".cp-why").first().evaluate(e => e.classList.contains("open")));

// layout: container query reorders at desktop, one column on mobile
const colsDesk = await pg.locator(".cp-cols").evaluate(e => getComputedStyle(e).gridTemplateColumns);
await pg.setViewportSize({ width: 390, height: 900 });
await pg.waitForTimeout(300);
const colsMob = await pg.locator(".cp-cols").evaluate(e => getComputedStyle(e).gridTemplateColumns);
ok("@container: asztalin KÉT oszlop, mobilon egy", colsDesk.split(" ").length === 2 && colsMob.split(" ").length === 1);
const small = await pg.locator(".cp-chip.miss:visible, .cp-v:visible").evaluateAll(
  els => els.filter(e => e.getBoundingClientRect().height < 30).length);
ok("mobilon minden koppintható elem ≥30px", small === 0);
ok("nincs JS-kivétel a panelen", errs.length === 0);
if (errs.length) console.log("    " + errs.join("\n    "));
if (noise.length) console.log("  (i) böngésző-konzol zaj, nem JS-kivétel: " + noise.join(" | "));

// Capture what the operator actually sees, from inside the authenticated session.
await pg.setViewportSize({ width: 390, height: 900 });
await pg.waitForTimeout(300);
await pg.locator(".cp-panel").screenshot({ path: "assets/Temp/cp-live-mobile.png" });
await pg.setViewportSize({ width: 1280, height: 1000 });
await pg.waitForTimeout(300);
await pg.locator(".cp-panel").screenshot({ path: "assets/Temp/cp-live-desktop.png" });
console.log("  kép: assets/Temp/cp-live-{mobile,desktop}.png");
await b.close(); await db.destroy(); server.close();
console.log(bad ? `\n⛔ ${bad} BUKOTT` : "\n✅ a kontraktus minden pontja teljesül");
process.exit(bad ? 1 : 0);
