// ŐR: az operátori nyitókép-választás a KONZOLON — végigkattintva, nem képnézve.
//
// Miért kell böngésző: a screenshot nem bizonyítja a viselkedést (mért hiba: egy [hidden]
// elem LÁTSZOTT a zöldnek hitt képen). Amit itt ellenőrzünk, az mind a jóváhagyott terv
// KÖTELME (assets/design-refs/console/hero-override/README.md):
//   ① a bélyeg-sáv és a nagy nyitókép tényleg ott van, és PIXELEN is kattintható;
//   ② a választott kép LESZ a nyitókép, és a felület kimondja, hogy kézi + visszavonható;
//   ③ gyenge/kizárt tárgyú képnél megerősítést kér (de nem tilt);
//   ④ a Fotók fül ugyanazt a nyitóképet jelöli, mint a mock-panel — EGY igazság;
//   ⑤ nulla JS-hiba.
//
// Futtatás: npx tsx scripts/hero-override-ui-check.mts [leadId]

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
import { once } from "node:events";
import type { Server } from "node:http";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";

const results: [string, boolean][] = [];
const ok = (label: string, pass: boolean): void => {
  results.push([label, pass]);
  console.log(`${pass ? "✅" : "⛔"} ${label}`);
};

/** Egy lead, aminek van mockja legalább 3 fotóval — különben nincs mit cserélni. */
async function pickLead(): Promise<string | null> {
  if (process.argv[2]) return process.argv[2];
  const rows = await db
    .selectFrom("mock_artifact")
    .select(["lead_id", "inputs"])
    .where("path", "is not", null)
    .orderBy("generated_at", "desc")
    .execute();
  return (
    rows.find((r) => (((r.inputs ?? {}) as { siteData?: { photos?: unknown[] } }).siteData?.photos ?? []).length >= 3)
      ?.lead_id ?? null
  );
}

const leadId = await pickLead();
if (!leadId) {
  console.log("⚠️ nincs alkalmas mock a dev DB-ben — a felület-próba kimarad");
  await db.destroy();
  process.exit(0);
}

const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const addr = server.address();
if (!addr || typeof addr === "string") throw new Error("a konzol nem kapott portot");
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
if (!op) throw new Error("nincs operator_user a dev DB-ben");
const base = `http://127.0.0.1:${addr.port}`;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([
  { name: "cit_op_session", value: mintOperatorCookieValue(op.id), domain: "127.0.0.1", path: "/" },
]);
const page = await ctx.newPage();
const jsErrors: string[] = [];
page.on("pageerror", (e) => jsErrors.push(e.message));
const openTab = async (id: string, wait = 400): Promise<void> => {
  await page.evaluate((t) => document.querySelector<HTMLElement>(`[data-tab="${t}"]`)?.click(), id);
  await page.waitForTimeout(wait);
};

await page.goto(`${base}/lead/${leadId}`, { waitUntil: "networkidle" });
await openTab("ls-mocks");

// ① a sáv létezik és PIXELEN is ott van (a DOM zöld lehet, miközben egy ős levágja)
ok("a nyitókép-sáv bélyegei megjelennek", (await page.locator(".hp-alt").count()) > 0);
const box = await page.locator(".hp-cur img").boundingBox();
ok(
  "a nagy nyitókép a kattintható pixelen van",
  box
    ? await page.evaluate(
        ([x, y]) => Boolean((document.elementFromPoint(x, y) as HTMLElement | null)?.closest(".hp-cur")),
        [box.x + box.width / 2, box.y + box.height / 2],
      )
    : false,
);

// ② csere → a választott kép lesz a nyitókép, és a felület kimondja, hogy kézi
const good = page.locator(".hp-alt").filter({ has: page.locator(".hp-sc:not(.low)") }).first();
const wanted = await good.locator("img").getAttribute("src");
await good.click();
await page.waitForLoadState("networkidle");
await openTab("ls-mocks");
ok("a választott kép lett a nyitókép", (await page.locator(".hp-cur img").getAttribute("src")) === wanted);
ok("a felület kimondja, hogy KÉZI a választás", (await page.locator(".hp-note").count()) > 0);

// ④ egy igazság: a Fotók fül ugyanazt jelöli
await openTab("ls-photos", 1500);
const key = (u: string | null): string => (u ?? "").split("?")[0]!.toLowerCase();
const bHero = await page
  .locator(".lead-photos .hp-pick[disabled]")
  .locator("xpath=..")
  .locator("img")
  .getAttribute("src");
ok("a Fotók fül ugyanazt a nyitóképet jelöli, mint a mock-panel", key(bHero) === key(wanted));

// ③ gyenge kép → megerősítés, de nem tiltás
await openTab("ls-mocks");
const low = page.locator(".hp-alt").filter({ has: page.locator(".hp-sc.low") }).first();
if (await low.count()) {
  await low.click();
  await page.waitForTimeout(300);
  ok("gyenge képnél megerősítést kér", await page.locator(".hp-warnbox").isVisible());
  await page.locator("#hp-no").click();
  await page.waitForTimeout(200);
  ok("a „Mégsem” elveti a cserét", (await page.locator(".hp-warnbox").count()) === 0);
} else {
  console.log("⚠️ ezen a leaden nincs 55 alatti kép — a figyelmeztetés-ág most nem mérhető");
}

// visszaállás
await page.locator(".hp-undo").click();
await page.waitForLoadState("networkidle");
await openTab("ls-mocks");
ok("visszavonás után eltűnik a kézi jelölés", (await page.locator(".hp-note").count()) === 0);
ok("nulla JS-hiba a felületen", jsErrors.length === 0);
if (jsErrors.length) console.error(jsErrors.join("\n"));

await browser.close();
await db.destroy();
process.exit(results.every(([, r]) => r) ? 0 : 1);
