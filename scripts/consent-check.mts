// Őr: a süti-hozzájárulás sáv és a Barion Pixel NÉGY TILTÁSA.
//
// A befagyasztott terv (assets/design-refs/public-site/consent-bar/README.md) a
// kinézetet köti; ez a négy szabály viszont NEM kinézeti kérdés, és mindegyik
// jogi következménnyel jár. Az oldalunk 2026-09-11-ig MÉRTEN 0 sütit tett le —
// a Pixel az első követő szkriptünk, tehát innentől ez a fájl őrzi, hogy a
// hozzájárulás valódi védelem maradjon, ne díszlet.
//
//   ① hozzájárulás ELŐTT nincs Pixel-kérés és nincs süti
//   ② ELUTASÍTÁS után sincs (és a döntés nem sütiben tárolódik)
//   ③ ELFOGADÁS után viszont TÉNYLEG betölt (különben csak színház)
//   ④ a generált tenant-oldalakra a sáv NEM kerül ki
//
// ⚠️ A Host fejlécet NYERS http-kéréssel állítjuk: a `fetch` némán eldobja
// (tiltott fejléc), és emiatt az első mérésem a saját landingünket hitte
// tenant-oldalnak — a hatókör-ellenőrzés így hamis riasztást adott.
//
// Usage: npx tsx scripts/consent-check.mts

import http from "node:http";
import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { PLATFORM_DOMAIN } from "../src/domains.js";
import { db } from "../src/db/client.js";
import { server } from "../src/server/public.js";

let failed = 0;
const check = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failed++;
    console.error(`  ✗ ${what}${detail ? ` — ${detail}` : ""}`);
  }
};

await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

/** Raw GET so the Host header actually goes out (fetch drops it). */
const rawGet = (host: string, path = "/"): Promise<string> =>
  new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port, path, headers: { Host: host } }, (res) => {
      let b = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve(b));
    });
    req.end();
  });

console.log("── Hatókör ────────────────────────────────────────────────────────");
const own = await rawGet(PLATFORM_DOMAIN);
check(
  config.barionPixelId ? own.includes("cit-consent.js") : !own.includes("cit-consent.js"),
  config.barionPixelId ? "a SAJÁT oldalunk megkapja a sávot" : "azonosító nélkül a saját oldalon SINCS sáv",
);

const site = await db
  .selectFrom("site")
  .select(["slug"])
  .where("status", "=", "live")
  .where("slug", "is not", null)
  .executeTakeFirst();
if (site?.slug) {
  const tenant = await rawGet(`${site.slug}.${PLATFORM_DOMAIN}`);
  check(
    !tenant.includes("cit-consent.js") && !tenant.includes("pixel.barion.com"),
    "⭐⭐ a generált TENANT-oldal NEM kap sávot és NEM kap Pixelt",
    "a vendég nem nálunk fizet — semmi nem indokolná a követését",
  );
} else {
  console.log("  · nincs live tenant a DB-ben — a hatókör-ág kihagyva");
}

// A négy viselkedési tiltás csak akkor mérhető, ha van azonosító.
if (!config.barionPixelId) {
  console.log("\n  · BARION_PIXEL_ID üres — a viselkedés-ág kihagyva (ilyenkor nincs is sáv).");
} else {
  console.log("\n── Viselkedés (élő böngészőben) ───────────────────────────────────");
  const b = await chromium.launch();
  const visit = async (act: "none" | "reject" | "accept") => {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const pixel: string[] = [];
    p.on("request", (r) => {
      if (/pixel\.barion\.com/.test(r.url())) pixel.push(r.url());
    });
    await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#cit-consent", { timeout: 8000 });
    if (act === "reject") await p.locator(".cit-consent__no").click();
    if (act === "accept") await p.locator(".cit-consent__yes").click();
    await p.waitForTimeout(act === "none" ? 900 : 1500);
    const cookies = await ctx.cookies();
    const barGone = !(await p.locator("#cit-consent").isVisible().catch(() => false));
    await ctx.close();
    return { pixel: pixel.length, cookies: cookies.length, barGone };
  };

  const before = await visit("none");
  check(before.pixel === 0, "① hozzájárulás ELŐTT nincs Pixel-kérés", `kapott: ${before.pixel}`);
  check(before.cookies === 0, "① hozzájárulás ELŐTT nincs süti", `kapott: ${before.cookies}`);

  const rejected = await visit("reject");
  check(rejected.pixel === 0, "② ELUTASÍTÁS után sincs Pixel-kérés", `kapott: ${rejected.pixel}`);
  check(rejected.cookies === 0, "② ELUTASÍTÁS nem ír le sütit (a döntés localStorage-ban)", `kapott: ${rejected.cookies}`);
  check(rejected.barGone, "② a döntés után a sáv eltűnik");

  const accepted = await visit("accept");
  check(accepted.pixel > 0, "③ ELFOGADÁS után a Pixel TÉNYLEG betölt (a sáv nem díszlet)", `kérések: ${accepted.pixel}`);
  await b.close();
}

console.log("\n── A terv köti (forrás-szintű) ────────────────────────────────────");
const src = await (await import("node:fs/promises")).readFile("public/assets/runtime/cit-consent.js", "utf8");
check(/if \(!pixelId\) return;/.test(src), "azonosító nélkül a sáv meg sem jelenik");
check(!/document\.cookie\s*=/.test(src), "a hozzájárulás-kezelő SEHOL nem ír sütit");
check(
  src.indexOf("loadPixel") > 0 && /saved === "all"[\s\S]{0,80}loadPixel/.test(src),
  "a Pixel csak az „all” döntés ágán tölt be",
);

server.close();
await db.destroy();
if (failed) {
  console.error(`\n⛔ ${failed} ellenőrzés bukott — a hozzájárulás nem valódi védelem.`);
  process.exit(1);
}
console.log("\n✅ consent-check: a Pixel csak hozzájárulás után indul, elutasításra semmi, tenant-oldalra semmi.");
process.exit(0);
