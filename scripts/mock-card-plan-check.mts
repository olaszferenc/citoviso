// A MOCK-KÁRTYÁK JÓVÁHAGYOTT TERVÉNEK ŐRE — `assets/design-refs/console/mock-cards/`
// (A — kép-vezérelt csempe, tulajdonosi döntés 2026-09-20).
//
// A KIRENDERELT lapon mér, VALÓDI STÍLUSLAPPAL. A terv fele geometria (hány kártya fér egy
// sorba, mekkora a csukott kártya, egy sorban áll-e a négy kapu), amire a forrás-grep vak.
//
// ⚠️ A PILLANATKÉP négy állapotát KÜLÖN-KÜLÖN méri, és a legfontosabb állítás NEGATÍV:
// hiányzó képnél NEM születhet `<img>`. Egy feltétel nélkül kitett `<img>` néma
// törött-kép ikon, a kurátor pedig vakon dönt — az Elek FK-004 H1 ezt már egyszer
// megmérte az MMS-előnézeten, és ez a kapu az, ami nem engedi visszajönni.
//
//   npx tsx scripts/mock-card-plan-check.mts
//   npx tsx scripts/mock-card-plan-check.mts --self-test   (PIROS önteszt)

process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { chromium } from "playwright-core";
import sharp from "sharp";

import { config } from "../src/config.js";
import type { ArtifactView, LeadDetail } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import { leadPage } from "../src/console/views.js";
import type { HeroShotState } from "../src/outreach/heroShot.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

/** A MAI (terv előtti) kártya mérete a tulaj beküldött képernyőképén mérve. */
const TODAY_AREA = 1529 * 586;

let bad = 0;
/** Azok az állítás-azonosítók, amiket az önteszt visszarontásának MEG KELL buktatnia. */
const SELF_TEST_TARGETS = new Set(["②-egy", "③-nincs-img", "⑤-3oszlop", "⑥-halvány"]);
const failedIds = new Set<string>();
const ok = (id: string, label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${id} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) {
    bad++;
    failedIds.add(id);
  }
};

// ── Fixture ─────────────────────────────────────────────────────────────────────
// NÉGY artefaktum, mert a pillanatképnek NÉGY állapota van, és mindegyiket meg kell
// mérni. Az elutasított kapja a „még senki nem kérte" állapotot, hogy a ⑥ (hátul,
// halványan) és a ③-none egy kártyán mérhető legyen.
const artifact = (over: Partial<ArtifactView> & { id: string }): ArtifactView =>
  ({
    status: "generated",
    path: `/tmp/${over.id}.html`,
    generatedAt: "2026-09-20T12:40:00.000Z",
    inputs: {
      template: "transit",
      skin: "signage-amber",
      engine: "composition",
      region: "Balaton",
      recipeSource: "template",
      archetype: "stacked",
      photos: 6,
      heroSubject: "exterior",
      heroScore: 88,
      heroReason: "Rendezett főhomlokzat, napfényes látvány.",
      factVerdict: "pass",
      marketVerdict: "pass",
      designVerdict: "pass",
      heroVerdict: "pass",
      marketAmenityTotal: 16,
      factCandidates: 3,
      guestReviewCount: 5,
      aiUsage: { calls: 3, inputTokens: 35397, outputTokens: 1791, costUsd: 0.22176, byStep: {} },
    },
    decisions: [],
    ...over,
  }) as ArtifactView;

const A_READY = artifact({ id: "aaaaaaaa-0000-0000-0000-000000000001", status: "approved",
  decisions: [{ decision: "approve", notes: "", decidedBy: "console", decidedAt: "2026-09-20T12:45:00.000Z" }] });
const A_RUNNING = artifact({ id: "aaaaaaaa-0000-0000-0000-000000000002" });
const A_FAILED = artifact({ id: "aaaaaaaa-0000-0000-0000-000000000003" });
const A_NONE = artifact({ id: "aaaaaaaa-0000-0000-0000-000000000004", status: "rejected",
  decisions: [{ decision: "reject", notes: "", decidedBy: "console", decidedAt: "2026-09-20T12:46:00.000Z" }] });

const SHOTS = new Map<string, HeroShotState>([
  [A_READY.id, { kind: "ready", path: "/tmp/whatever.png" }],
  [A_RUNNING.id, { kind: "running" }],
  [A_FAILED.id, { kind: "failed", fail: { code: "broken-images", detail: "https://pelda.hu/kep.jpg" } }],
  [A_NONE.id, { kind: "none" }],
]);

function lead(artifacts: ArtifactView[]): LeadDetail {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Őr-teszt Vendégház",
    qualification: "no_site",
    lifecycle: "new",
    matchConfidence: null,
    address: "Teszt utca 1.",
    region: "balaton-north",
    regionLabel: "Balaton",
    regionKnown: true,
    surveyedAt: "2026-09-04T06:00:00.000Z",
    raw: { material: { totalImages: 8, placesPhotos: 0, portalPhotos: 8, websiteImages: 0, streetView: false } },
    provenance: [],
    artifacts,
    heroScores: {},
    heroPin: null,
  } as unknown as LeadDetail;
}

const render = (artifacts: ArtifactView[]): string =>
  runWithConsoleLang(() =>
    leadPage(lead(artifacts), { running: false } as never, null, [], [], [], null,
      new Set(), new Set(), null, null, SHOTS),
  );

/**
 * PIROS ÖNTESZT — a visszarontás pontosan azt veszi el, amit a terv KÖT:
 * ② minden kártya egyszerre nyílik, ③ a hiányzó képre is kikerül egy `<img>`,
 * ⑤ a rács egy oszlopra esik, ⑥ az elutasított kártya nem halványabb.
 */
function breakIt(html: string): string {
  return html
    .replaceAll('class="con-mk__det"', 'class="con-mk__det" data-broken="1"')
    .replaceAll(' hidden>', '>')
    .replace(
      /(data-shot-state="failed">)/,
      '$1<img src="/artifact/x/shot.jpg" alt="törött">',
    )
    .replace(
      "</head>",
      `<style>.con .con-mkgrid{grid-template-columns:1fr !important}
        .con .con-mk[data-mk-state="rejected"]{opacity:1 !important}</style></head>`,
    );
}

// ── Kiszolgáló a STÍLUSLAPPAL (a `setContent` vak a CSS-re) ─────────────────────
const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
// A `ready` kártya képe VALÓDI JPEG-et kap: így a ③-kész állítás nem azt méri, hogy
// van-e `<img>` tag, hanem hogy a kép TÉNYLEG betöltődik (naturalWidth > 0).
const FAKE_SHOT = await sharp({
  create: { width: 640, height: 360, channels: 3, background: { r: 30, g: 60, b: 90 } },
})
  .jpeg()
  .toBuffer();
let served = "<!doctype html><title>üres</title>";
const assetServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(served);
    return;
  }
  if (/^\/artifact\/[^/]+\/shot\.jpg$/.test(url.pathname)) {
    res.writeHead(200, { "content-type": "image/jpeg" });
    res.end(FAKE_SHOT);
    return;
  }
  const rel = path.normalize(url.pathname).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, "public", rel);
  if (!abs.startsWith(path.join(ROOT, "public")) || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(abs)] ?? "application/octet-stream" });
  res.end(readFileSync(abs));
});
assetServer.listen(0);
await once(assetServer, "listening");
const port = (assetServer.address() as AddressInfo).port;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const jsErrors: string[] = [];
page.on("pageerror", (e) => jsErrors.push(e.message));

async function open(html: string, width = 1280): Promise<void> {
  served = SELF_TEST ? breakIt(html) : html;
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  // A fül csak akkor látszik, ha kiválasztjuk — a kártyák a „Mock és generálás" alatt élnek.
  await page.evaluate(`document.querySelector('[href="#ls-mocks"],[data-tab="ls-mocks"]')?.click()`);
  await page.waitForTimeout(150);
}

const HTML = render([A_READY, A_RUNNING, A_FAILED, A_NONE]);

console.log("=== mock-card-plan-check — a jóváhagyott A változat őre ===\n");
console.log("① A MOCKOK A FÜL ELSŐ ELEME");
await open(HTML);

// ① Dokumentum-sorrend: a rács a generáló-blokk ELŐTT.
const order = (await page.evaluate(`(() => {
  const grid = document.querySelector('.con-mkgrid');
  const gen  = document.querySelector('.con-mkgen');
  if (!grid || !gen) return null;
  return (grid.compareDocumentPosition(gen) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'grid-first' : 'gen-first';
})()`)) as string | null;
ok("①", "a kártya-rács a generáló-blokk ELŐTT áll", order === "grid-first", String(order));
ok(
  "①",
  "a generáló-blokk CSUKVA van, ha már van mock",
  (await page.evaluate(`!document.querySelector('.con-mkgen')?.open`)) === true,
);
ok("①", "a rács horgonya kint van", await page.locator("[data-cit-mocksfirst]").count() > 0);

// …és mock NÉLKÜL fordítva: ott a generálás van elöl.
const emptyHtml = render([]);
served = emptyHtml;
await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
await page.waitForTimeout(150);
ok(
  "①",
  "mock NÉLKÜLI leaden a generáló-panel van elöl (üres rács nem lehet a lap első mondata)",
  (await page.evaluate(`document.querySelector('[data-cit-mocksfirst]')?.getAttribute('data-cit-mocksfirst')`)) === "0",
);

console.log("\n② KÁRTYÁNKÉNTI KINYITÁS");
await open(HTML);
const cards = page.locator(".con-mk");
ok("②", "négy kártya a rácsban", (await cards.count()) === 4, `${await cards.count()}`);
ok(
  "②",
  "induláskor MINDEN kinyitott rész csukva",
  (await page.locator(".con-mk__det:not([hidden])").count()) === 0,
);
await cards.nth(0).locator("[data-mk-more]").click();
await page.waitForTimeout(120);
ok("②", "az 1. kártya kinyílt", await cards.nth(0).locator(".con-mk__det").isVisible());
ok(
  "②-egy",
  "⭐ és CSAK az — a másik három csukva maradt (nem globális kinyitás)",
  (await page.locator(".con-mk__det:not([hidden])").count()) === 1,
  `${await page.locator(".con-mk__det:not([hidden])").count()} nyitott`,
);
ok(
  "②",
  "a gomb a saját tettét mondja (Bezárom)",
  ((await cards.nth(0).locator("[data-mk-more]").textContent()) ?? "").includes("Bezárom"),
);
// ⛔ A kisebb kártya nem információ-vesztés: aminek a kinyitott részbe kellett költöznie,
// annak OTT is kell lennie. Ez az állítás fogja meg, ha egy átszervezés némán eldob valamit.
for (const [sel, what] of [
  [".con-recipe", "a recept megnevezett sorai"],
  [".con-rawmeta", "a nyers fejlesztői blokk"],
  ['form[action$="/delete"]', "a mock törlése"],
] as const) {
  ok(
    "②",
    `a kinyitott részben ott van: ${what}`,
    (await page.locator(`.con-mk__det ${sel}`).count()) > 0,
  );
}
ok(
  "②",
  "az AI-költség is a kinyitott részbe került",
  (await page.locator(".con-mk__det").first().innerText()).includes("AI-költség"),
);

console.log("\n③ A PILLANATKÉP NÉGY ÁLLAPOTA");
const shotOf = (id: string) => page.locator(`#a-${id} .con-mk__shot`);
ok(
  "③",
  "kész: van kép, és TÉNYLEG betöltődik",
  (await page.evaluate(
    `(() => { const i = document.querySelector('#a-${A_READY.id} .con-mk__shot img'); return !!i && i.naturalWidth > 0; })()`,
  )) === true,
);
ok("③", "készül: kimondja, hogy készül",
  (await shotOf(A_RUNNING.id).innerText()).includes("készül"));
ok("③", "hibázott: kimondja, hogy nincs kép",
  (await shotOf(A_FAILED.id).innerText()).includes("Nincs pillanatkép"));
ok("③", "hibázott: MEGNEVEZI az okot (a hibás kép URL-jével)",
  (await shotOf(A_FAILED.id).innerText()).includes("pelda.hu"));
ok("③", "még nem kérték: kimondja, és felkínálja a kérést",
  (await shotOf(A_NONE.id).innerText()).includes("Még nem készült pillanatkép"));
for (const [id, name] of [[A_FAILED.id, "hibázott"], [A_NONE.id, "még nem kérték"]] as const) {
  ok(
    "③",
    `${name}: van KIMONDOTT kérés-gomb (a lap nem indít magától renderelést)`,
    (await page.locator(`#a-${id} form[action$="/shot"] button`).count()) === 1,
  );
}
// ⭐ A NEGATÍV állítás — ez a kapu lényege.
ok(
  "③-nincs-img",
  "⭐ hiányzó képnél SEHOL nincs `<img>` (nincs néma törött-kép ikon)",
  (await page.locator('.con-mk__shot:not([data-shot-state="ready"]) img').count()) === 0,
  `${await page.locator('.con-mk__shot:not([data-shot-state="ready"]) img').count()} felesleges kép`,
);

console.log("\n④ A CSUKOTT KÁRTYA TARTALMA");
const facts = cards.nth(1).locator(".con-mk__facts");
ok("④", "a képszám a csukott kártyán áll", (await facts.innerText()).includes("6"));
ok("④", "a nyitókép pontszáma és témája is", (await facts.innerText()).includes("88") &&
  (await facts.innerText()).includes("épület kívülről"));
const gateBoxes = await cards.nth(1).locator(".con-mk__gate").evaluateAll(
  (els) => els.map((e) => Math.round((e as HTMLElement).getBoundingClientRect().top)),
);
ok("④", "mind a NÉGY kapu kint van", gateBoxes.length === 4, `${gateBoxes.length}`);
ok(
  "④",
  "⭐ a négy kapu EGYETLEN sorban (a jóváhagyott kép szerint)",
  new Set(gateBoxes).size === 1,
  `sor-tetejük: ${[...new Set(gateBoxes)].join(", ")}`,
);
ok(
  "④",
  "a recept-rács NEM ismétli meg a csukott kártyán álló mezőket",
  !(await page.locator(".con-mk__det .con-recipe").first().innerText()).includes("Képek a lapon"),
);
// ⑦ A két meglévő link a feliratával együtt megmaradt.
const c1 = await cards.nth(0).innerText();
ok("⑦", "megmaradt az „előnézet ▸” link", c1.includes("előnézet ▸"));
ok("⑦", "megmaradt a „prospect-konfigurátor ▸” link", c1.includes("prospect-konfigurátor ▸"));

console.log("\n⑤ MÉRET ÉS ELRENDEZÉS");
// ⚠️ ÚJRATÖLTÉS a mérés előtt: a ② lépés KINYITOTTA az első kártyát, és a mérés így a
// kinyitott magasságot vette (391×1131 = a mai 49 %-a, piros). A terv a CSUKOTT kártya
// méretét köti — egy kinyitott kártya más kérdésre felel.
await open(HTML);
const colCount = async (): Promise<number> =>
  (await page.evaluate(
    `getComputedStyle(document.querySelector('.con-mkgrid')).gridTemplateColumns.split(' ').length`,
  )) as number;
ok("⑤-3oszlop", "asztalin HÁROM kártya egy sorban", (await colCount()) === 3, `${await colCount()}`);
const box = await cards.nth(0).boundingBox();
const area = (box?.width ?? 0) * (box?.height ?? 0);
ok(
  "⑤",
  "⭐ a csukott kártya a mai kártya HARMADÁNÁL is kisebb",
  !!box && area < TODAY_AREA / 3,
  box ? `${Math.round(box.width)}×${Math.round(box.height)} px = a mai ${Math.round((area / TODAY_AREA) * 100)} %-a` : "nincs kártya",
);
await open(HTML, 390);
ok("⑤", "390 px-en EGY oszlop (a tulaj a 2 oszlopos változatot elvetette)", (await colCount()) === 1);
ok(
  "⑤",
  "…és a rács nem görget oldalra",
  (await page.evaluate(
    `(() => { const g = document.querySelector('.con-mkgrid'); return g.scrollWidth <= g.clientWidth + 1; })()`,
  )) === true,
);

// A kép-kérés visszairányítása a KÁRTYÁHOZ visz (`#a-<uuid>`), nem csak a fülhöz — de ez
// csak akkor ér valamit, ha a fül-kapcsoló a panelen BELÜLI horgonyra is vált. Enélkül a
// kurátor egy REJTETT fülön ülő kártyához érkezne (ugyanaz az osztály, amit a
// `lead-tab-anchor-check` ② őriz), ezért itt MÉRJÜK, nem feltételezzük.
console.log("\n⑧ A KÉP-KÉRÉS VISSZAIRÁNYÍTÁSA");
served = HTML;
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`http://localhost:${port}/#a-${A_FAILED.id}`, { waitUntil: "load" });
await page.waitForTimeout(400);
ok(
  "⑧",
  "a kártya-horgony a MOCK-fülre vált",
  (await page.evaluate(`document.querySelector('.con-tabp.on')?.id`)) === "ls-mocks",
  String(await page.evaluate(`document.querySelector('.con-tabp.on')?.id`)),
);
ok("⑧", "…és a megcélzott kártya LÁTSZIK", await page.locator(`#a-${A_FAILED.id}`).isVisible());

console.log("\n⑥ AZ ELUTASÍTOTT KÁRTYA");
await open(HTML);
ok(
  "⑥",
  "az elutasított kártya a RÁCSBAN van (nincs külön kinyitható csoport)",
  (await page.locator('.con-mkgrid .con-mk[data-mk-state="rejected"]').count()) === 1,
);
ok(
  "⑥",
  "…és a rács VÉGÉN áll",
  (await page.evaluate(
    `document.querySelector('.con-mkgrid').lastElementChild?.getAttribute('data-mk-state')`,
  )) === "rejected",
);
ok(
  "⑥-halvány",
  "…halványan (a jelvénye mellett ez is kimondja, hogy lezárt)",
  Number(
    await page.evaluate(
      `getComputedStyle(document.querySelector('.con-mk[data-mk-state="rejected"]')).opacity`,
    ),
  ) < 1,
);

ok("JS", "0 JS-hiba a lapon", jsErrors.length === 0, jsErrors.join(" | ").slice(0, 200));

await browser.close();
assetServer.close();

/**
 * ③ A KÉP-ÚTVONAL — a VALÓDI konzolon, saját folyamatban, efemer porton (ugyanaz a minta,
 * amit a `ui-shot` használ; nem ad-hoc dev-szerver).
 *
 * ⛔ A legfontosabb állítás itt is NEGATÍV: a `shot.jpg` CSAK GYORSTÁR. Ha egy `<img>`
 * kérés el tudna indítani egy renderelést, visszajönne az FK-004 H1 esete (2×30 s
 * Chromium egy kép-kérésen belül, a végén 404 → törött kép). Ezért mérjük, hogy a GET
 * NEM billenti át az állapotot `running`-ra.
 */
if (!SELF_TEST) {
  console.log("\n③ A KÉP-ÚTVONAL A VALÓDI KONZOLON");
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: import("node:http").Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address() as AddressInfo;
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { db } = await import("../src/db/client.js");
  const op =
    (await db.selectFrom("operator_user").select("id").where("username", "=", "claude-test").executeTakeFirst()) ??
    (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());
  // A `ready` ág csak akkor mérhető, ha VAN gyorstárazott kép. Ezért nem vakon a
  // legfrissebbet vesszük: végignézünk a legutóbbi néhányon, és ha van kész képű, AZT
  // mérjük (így a 200-as ág is futhat). Ha nincs, azt HANGOSAN kiírjuk — a ki nem mért ág
  // ne látsszon lefedettnek.
  const { heroShotState: probeState } = await import("../src/outreach/heroShot.js");
  const recent = await db
    .selectFrom("mock_artifact").select("id").orderBy("generated_at", "desc").limit(8).execute();
  let real = recent[0];
  for (const r of recent) {
    if ((await probeState(r.id)).kind === "ready") { real = r; break; }
  }
  if (!op || !real) {
    ok("③", "van operátor és artefaktum a dev DB-ben (az útvonal-mérésnek van tárgya)", false,
      "hiányzó operator_user vagy mock_artifact — az útvonal-szakasz NEM futott le");
  } else {
    const base = `http://127.0.0.1:${addr.port}`;
    // ⚠️ A konzol a `cit_op_session` NEVŰ sütit olvassa (ADR-0021 control/data plane) — a
    // puszta érték `/login`-ra terelt, és a válasz üres törzsén a JSON.parse szállt el.
    const headers = { cookie: `cit_op_session=${mintOperatorCookieValue(op.id)}` };
    const get = async (p: string): Promise<Response> => fetch(`${base}${p}`, { headers, redirect: "manual" });
    const stateRes = await get(`/artifact/${real.id}/shot-state`);
    ok("③", "a shot-state útvonal hitelesítve 200-at ad (nem terel a bejelentkezésre)",
      stateRes.status === 200, `${stateRes.status}`);
    const before = (stateRes.status === 200
      ? await stateRes.json()
      : { kind: "?" }) as { kind: string };
    ok("③", "a shot-state útvonal az ismert négy állapot egyikét adja",
      ["ready", "running", "failed", "none"].includes(before.kind), before.kind);
    const img = await get(`/artifact/${real.id}/shot.jpg`);
    if (before.kind === "ready") {
      ok("③", "kész állapotban a kép 200-zal, képként jön", img.status === 200 &&
        (img.headers.get("content-type") ?? "").startsWith("image/"), `${img.status}`);
      ok("③", "…és tényleg van benne bájt", (await img.arrayBuffer()).byteLength > 1000);
    } else {
      ok("③", "nem-kész állapotban 404 (a lap ilyenkor ki sem teszi a képet)", img.status === 404, `${img.status}`);
      console.log(
        `  ⚠️ A KÉSZ ág NEM lett megmérve: a dev DB legutóbbi ${recent.length} artefaktuma közül` +
          ` egyiknek sincs gyorstárazott pillanatképe (a megmért állapot: ${before.kind}).` +
          ` Ez KIHAGYOTT lefedettség, nem zöld ág.`,
      );
    }
    const after = (await (await get(`/artifact/${real.id}/shot-state`)).json()) as { kind: string };
    ok("③-csak-gyorstár", "⭐ a kép-kérés NEM indított renderelést (csak gyorstár)",
      after.kind === before.kind, `${before.kind} → ${after.kind}`);
  }
  server.close();
}

if (SELF_TEST) {
  const survived = [...SELF_TEST_TARGETS].filter((t) => !failedIds.has(t));
  console.log(
    survived.length
      ? `\n⛔ ÖNTESZT BUKOTT: a visszarontás ellenére ZÖLD maradt: ${survived.join(", ")}`
      : `\n✅ ÖNTESZT: a visszarontás mind a ${SELF_TEST_TARGETS.size} célzott állítást megbuktatta (összesen ${bad} piros).`,
  );
  process.exit(survived.length ? 1 : 0);
}
console.log(
  bad === 0
    ? "\n✅ A mock-kártyák a jóváhagyott A terv szerint viselkednek."
    : `\n⛔ ${bad} eltérés a jóváhagyott tervtől.`,
);
process.exit(bad === 0 ? 0 : 1);
