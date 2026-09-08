// SÜTI-AUDIT — mit tesz le egy oldal a látogató gépére, és kihez szól ki?
//
// Ez az az eszköz, amivel a "nem használunk sütit" állítás bármikor ELLENŐRIZHETŐ, nem
// pedig elhihető. Az ADR-0110 „Röviden" doboza ezt állítja a vendégnek; az állítás csak
// addig maradhat kint, amíg ez a mérés nullát mutat.
//
// Amit mér, friss böngésző-profilban, teljes végiggörgetés után (a lusta betöltésű
// térkép csak így jön be):
//   - sütik (a látogató gépén, hozzájárulás nélkül),
//   - localStorage / sessionStorage kulcsok,
//   - minden KÜLSŐ host, ahová kérés ment (IP-továbbítás, süti nélkül is),
//   - ismert követők jelenléte.
//
//   npx tsx scripts/cookie-audit.mts sites/<id>/index.html
//   npx tsx scripts/cookie-audit.mts sites/<id>/adatvedelem.html sites/<id>/index.html
//   npx tsx scripts/cookie-audit.mts https://valami.citoviso.com/
//
// Kilépési kód: 0, ha nincs süti és nincs tárolás; 1, ha van (akkor a jogi szöveg is
// felülvizsgálandó).
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

let targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// --demo: no DB, no existing tenant. Renders a LIVE page and both legal pages from the
// engine into a temp dir and measures those — the same output a real tenant gets, so the
// claim stays checkable even when the shared dev database has been wiped by another
// session (which is exactly what happened on 2026-09-08).
if (process.argv.includes("--demo")) {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const os = await import("node:os");
  const { renderSite } = await import("../src/engine/render.js");
  const { renderTenantLegalPage, withLegalStrip } = await import("../src/engine/legalPages.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "cit-cookie-"));
  const demo = {
    name: "Nyugalom Vendégház",
    tagline: "Csend, kert, Balaton",
    intro: "Szólád szélén, a szőlőhegy alatt.",
    highlights: ["Dézsafürdő", "Fedett terasz"],
    photos: [{ url: "https://placehold.co/900x560", alt: "Kert" }],
    contact: { email: "info@nyugalom.example", phone: "+36 30 123 4567", address: "Szólád" },
    geo: { lat: 46.7466, lon: 17.8412 },
  } as Parameters<typeof renderSite>[1];
  const recipe = {
    // No `template`: the composition path renders the location section, i.e. the
    // embedded Google map. And a WEBFONT skin, so Google Fonts is in the picture too.
    skin: "coastal-fresh",
    archetype: "stacked",
    sections: [{ kind: "hero" as const }, { kind: "location" as const }, { kind: "enquiry" as const }],
  } as Parameters<typeof renderSite>[0];
  const who = {
    legalName: "Nyugalom Vendégház Kft.",
    address: "8625 Szólád, Kossuth Lajos utca 12.",
    taxNumber: "12345678-2-41",
    regNumber: "Cg. 14-09-123456",
    ntakId: "SZ26001234",
    email: "info@nyugalom.example",
    phone: "+36 30 123 4567",
  };
  const host = {
    name: "Citoviso — Olasz Ferenc e.v.",
    address: "1111 Budapest, Példa utca 1.",
    email: "info@citoviso.com",
    site: "citoviso.com",
  };
  await writeFile(
    path.join(dir, "index.html"),
    withLegalStrip(renderSite(recipe, demo, { phase: "live" }), who),
    "utf8",
  );
  for (const kind of ["privacy", "imprint"] as const) {
    await writeFile(
      path.join(dir, kind === "privacy" ? "adatvedelem.html" : "impresszum.html"),
      renderTenantLegalPage({ recipe, data: demo, kind, who, host }),
      "utf8",
    );
  }
  console.log(`(demó-oldalak a motorból: ${dir})`);
  targets = [
    path.join(dir, "index.html"),
    path.join(dir, "adatvedelem.html"),
    path.join(dir, "impresszum.html"),
  ];
}

if (!targets.length) {
  console.error(
    "használat: npx tsx scripts/cookie-audit.mts <fájl.html | http(s)://…> [...]\n" +
      "     vagy: npx tsx scripts/cookie-audit.mts --demo   (a motorból renderelt oldalak, DB nélkül)",
  );
  process.exit(2);
}

/** Known third-party trackers — their presence would make the "no cookies" claim false. */
const TRACKERS = [
  "googletagmanager.com",
  "google-analytics.com",
  "connect.facebook.net",
  "matomo",
  "hotjar",
  "clarity.ms",
  "plausible.io",
  "segment.io",
];

// Local files are served over loopback rather than opened as file://, because a
// file:// page is treated as an opaque origin: third-party cookies and storage behave
// differently there, and the measurement would understate what a real visitor gets.
const localFiles = targets.filter((t) => !/^https?:\/\//.test(t));
let port = 0;
let server: http.Server | null = null;
if (localFiles.length) {
  const root = process.cwd();
  server = http.createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    if (url === "/favicon.ico") return void res.writeHead(204).end();
    try {
      // Absolute paths (the --demo temp dir) are served as-is; everything else is
      // resolved under the repo root.
      const rel = url.slice(1);
      const buf = await readFile(rel.startsWith("/") || rel.startsWith("tmp/") ? `/${rel}` : path.join(root, rel));
      const ext = path.extname(url);
      res.writeHead(200, {
        "Content-Type":
          ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html; charset=utf-8",
      });
      res.end(buf);
    } catch {
      res.writeHead(404).end("nincs");
    }
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let dirty = 0;      // pages that store something on the visitor's device
let unmeasured = 0; // pages we could NOT measure (404, no network) — never a green result

for (const target of targets) {
  const url = /^https?:\/\//.test(target) ? target : `http://127.0.0.1:${port}/${target}`;
  // A FRESH context per target: a cookie left by the previous page would be counted twice.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const hosts = new Map<string, number>();
  page.on("request", (r) => {
    try {
      const h = new URL(r.url()).host;
      if (!h.startsWith("127.0.0.1") && !h.startsWith("localhost")) {
        hosts.set(h, (hosts.get(h) ?? 0) + 1);
      }
    } catch {
      /* data: URIs and the like have no host */
    }
  });

  console.log(`\n═══ ${target}`);
  const resp = await page
    .goto(url, { waitUntil: "networkidle", timeout: 60_000 })
    .catch((e: Error) => {
      console.log(`  ⛔ betöltés: ${e.message}`);
      return null;
    });
  // A 404 sets no cookies either — and would report a spotless result for a page that
  // was never measured. Measured target or nothing.
  if (!resp || !resp.ok()) {
    console.log(`  ⛔ NEM MÉRHETŐ: a cél nem töltődött be (HTTP ${resp?.status() ?? "—"}).`);
    unmeasured++;
    await ctx.close();
    continue;
  }
  // Scroll the whole page: the map iframe is lazy, and an unscrolled page would report
  // a cleaner result than the visitor actually experiences.
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);

  const cookies = await ctx.cookies();
  const store = await page
    .evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))
    .catch(() => ({ local: [] as string[], session: [] as string[] }));

  console.log(`  SÜTI: ${cookies.length === 0 ? "0 — nincs" : `${cookies.length} db`}`);
  for (const c of cookies) {
    console.log(
      `    ${c.domain} · ${c.name} · lejárat=${
        c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : "munkamenet"
      }`,
    );
  }
  console.log(
    `  TÁROLÁS: localStorage ${store.local.length ? store.local.join(", ") : "üres"} · ` +
      `sessionStorage ${store.session.length ? store.session.join(", ") : "üres"}`,
  );

  const external = [...hosts].sort((a, b) => b[1] - a[1]);
  console.log(`  KÜLSŐ HOSTOK (${external.length}):`);
  for (const [h, n] of external) console.log(`    ${String(n).padStart(3)}×  ${h}`);
  const found = external.map(([h]) => h).filter((h) => TRACKERS.some((t) => h.includes(t)));
  console.log(`  KÖVETŐ: ${found.length ? `⛔ ${found.join(", ")}` : "nincs"}`);

  // Sanity check against a silent false negative: if the HTML names external hosts but
  // NONE of them was requested, the run had no network — and then "no cookies" says
  // nothing at all.
  const html = await page.content();
  const namesExternal = /https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+\.[a-z]{2,}/i.test(html);
  if (namesExternal && external.length === 0) {
    console.log(
      "  ⛔ GYANÚS: az oldal hivatkozik külső címre, de EGY kérés sem ment ki — " +
        "valószínűleg nincs hálózat, a mérés nem bizonyít semmit.",
    );
    unmeasured++;
  }

  if (cookies.length || store.local.length || store.session.length || found.length) dirty++;
  await ctx.close();
}

await browser.close();
server?.close();

if (unmeasured) {
  console.log(
    `\n🔴 SÜTI-AUDIT: ${unmeasured} oldalt NEM sikerült megmérni (nem töltődött be, vagy nincs\n` +
      "   hálózat). Ez nem jó hír és nem rossz hír — ez NINCS HÍR: a mérést meg kell ismételni.",
  );
} else if (dirty) {
  console.log(
    `\n🔴 SÜTI-AUDIT: ${dirty} oldal sütit tesz le vagy tárol a látogató gépén — a jogi szöveg\n` +
      "   felülvizsgálandó (ADR-0110 ④: ilyenkor a hozzájárulás kérdése is újranyílik).",
  );
} else {
  console.log(
    "\n✅ SÜTI-AUDIT: egyik oldal sem tesz le sütit és nem tárol a látogató gépén.\n" +
      "   Az adatkezelési tájékoztató „nem használunk sütit” állítása IGAZ.",
  );
}
process.exit(dirty === 0 && unmeasured === 0 ? 0 : 1);
