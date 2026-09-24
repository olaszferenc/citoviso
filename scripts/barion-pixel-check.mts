/**
 * Kapu — a Barion Pixel (Full) a VALÓDI vásárlási úton, a Barion SAJÁT validátorán
 * mérve (ADR-0186).
 *
 * ⛔ MIÉRT NEM FORRÁS-ELLENŐRZÉS. Egy `grep "initiateCheckout"` azt bizonyítja,
 * hogy leírtam a szót — nem azt, hogy elsül, és főleg nem azt, hogy a Barion
 * ELFOGADJA. A `bp.js` kötelező mezőket ellenőriz (`validate()`), és hiányzó
 * kulcsnál NEM küld: egy elgépelt `unitPrice` így néma adatvesztés lenne, zöld
 * teszt mellett. Ezért az őr a `pixel.barion.com/bp.js`-t TÖLTI BE, és azt méri,
 * mi jut el a kimenő üzenetig — vagyis a Barion saját szabályain.
 *
 * Amit mér:
 *  Z1  hozzájárulás ELŐTT: a Pixel be sem töltődik, és EGYETLEN esemény sem megy ki
 *      (a kosár-kattintás sem) — a sáv valódi kapu, nem díszlet;
 *  Z2  „Csak a szükségeseket": a sor SOHA nem ürül (a döntés tartós);
 *  Z3  „Elfogadom" után: a várakozó események kimennek, és a lap-megtekintés is —
 *      ez a Base hiányzó eleme volt (a bp.js magától NEM küld contentView-t);
 *  Z4  a kosár mozgása (addToCart / removeFromCart) a KÖTELEZŐ mezőkkel;
 *  Z5  a pénztár indulása (initiateCheckout): tételes kosár + a TERHELENDŐ összeg;
 *  Z6  a `revenue` EGYEZIK a felületen mutatott fizetendő összeggel — a Pixel és a
 *      vevő nem mondhat két számot ugyanarról a vásárlásról;
 *  Z7  a szerver-oldali `purchase` (a fizetés-visszaigazoló lap sora) átmegy a
 *      validátoron;
 *  Z8  grantConsent: az „Elfogadom" ténye kimegy a `consent` csatornán, és a sor
 *      ELEJÉN — a Barion minden mást csak érvényes consent mellett dolgoz fel;
 *  Z9  setEncryptedEmail: a beírt számlázási e-mail kimegy az `identity` csatornán;
 *  ZM  ⛔ A BARION KÉRDÉSE A ZÁRÓ KAPU, nem a miénk. 2026-09-18-án az elfogadóhely
 *      Starterre bukott, mert a Full Pixel két kötelező eseménye (grantConsent,
 *      setEncryptedEmail) HIÁNYZOTT — és ez az őr akkor ZÖLD volt, mert a saját
 *      eseménylistánkat mérte, nem a Barionét (a hiányzó állítás nem piros, hanem
 *      láthatatlan). A ZM ezért a Barion hivatalos kötelező-minimumát tételesen
 *      járja végig (forrás: docs.barion.com/Implementing_the_Full_Barion_Pixel,
 *      „Mandatory events") — ha a lista bővül, ide kell felvenni, és addig piros.
 *
 * ⚠️ Amit NEM tud: hogy a Barion a beérkezett eseményt hogyan értékeli, és hogy az
 * elfogadóhely-adatlapon melyik díjcsomag áll. Az az ő oldaluk. Hálózat nélkül pedig
 * NEM ÍTÉL: hangosan (stderr) kihagy, mert a nem-mérhető nem ugyanaz, mint a rendben.
 *
 * Futtatás: npx tsx scripts/barion-pixel-check.mts [--self-test]
 */
import { chromium, type Page } from "playwright-core";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { sessionTmpDir } from "./lib/session-tmp.mts";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { consentSnippet, pixelQueueScript } from "../src/server/consent.js";

const SELF_TEST = process.argv.includes("--self-test");
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
// Session-private preview: /tmp is shared by every worktree, a FIXED path raced siblings.
const PREVIEW = path.join(sessionTmpDir("barion-pixel-check"), "preview.html");
const PIXEL_ID = "BP-rTpo59JAam-6C";
const BP_URL = "https://pixel.barion.com/bp.js";
/** ⛔ A fixture NEM `file://`-ből fut. A `bp.js` valódi eredetet vár (süti, hostname),
 *  a Playwright pedig a `file://` alkéréseket el sem tudja fogni — az első
 *  változatom emiatt mért némát. Szintetikus HTTPS-eredet, szerver nélkül: magát a
 *  lapot is `route()` szolgálja ki. Az útvonal a VALÓDI ajánlat-út alakja. */
const PAGE_URL = "https://citoviso-fixture.test/p/teszt-token";

let failed = 0;
/** A bukott állítások címkéi — az önteszt ebből bizonyítja, hogy MINDHÁROM
 *  szándékos törést észrevette (egy `failed > 0` összesítő mellett két halott
 *  kontroll is elbújna a harmadik mögött). */
const failedWhat: string[] = [];
/** A szervernek ténylegesen beküldött ár — a Z6 ehhez méri a Pixel `revenue`-ját. */
let submittedPrice: number | null = null;
/** A Fizetek ELŐTT kiment üzenetek — a Z9/b ezen mér (lásd walkToPayment). */
let sentBeforePay: Sent[] = [];
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) {
    console.log(`✓ ${what}`);
    return;
  }
  failed++;
  failedWhat.push(what);
  console.error(`✗ BUKÁS  ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
};

const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-2/900/1100", alt: "Szoba", provenance: "owner" },
  ],
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [
    {
      name: "Superior szoba",
      capacity: "2 fő · 26 m²",
      note: "Városra néző.",
      price: "42 000 Ft / éj",
      photo: { url: "https://picsum.photos/seed/cit-r1/900/560", alt: "Superior" },
    },
  ],
  reviews: [{ quote: "Pontos, kedves, tiszta.", author: "Andrea", meta: "Budapest" }],
  place: { city: "Példaváros", country: "HU" },
};

const sections: Recipe["sections"] = (
  ["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const
).map((kind) => ({ kind }));

/** A `bp.js` élő példánya. ⛔ Ha nem érhető el, az őr HANGOSAN kihagy — nem
 *  „zöld, mert nem volt dolga" (a néma mérőeszköz bizalmat gyárt). */
async function fetchPixelScript(): Promise<string | null> {
  try {
    const r = await fetch(BP_URL, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const src = await r.text();
    return src.includes("addBarionPixelId") ? src : null;
  } catch {
    return null;
  }
}

/**
 * A mérendő lap: a TERMÉK saját forrásából épül (valódi sablon + valódi
 * konfigurátor-manifeszt), és ugyanazt a hozzájárulás-futtatót kapja, amit a
 * szerver tesz ki. A `purchase` sorát is úgy adjuk be, ahogy a fizetés-lap teszi.
 *
 * `broken=true` esetén a kosár-tétel elveszíti a kötelező `unitPrice` mezőjét —
 * ez a PIROS ÖNTESZT: a Barion validátora ilyenkor eldobja az eseményt, és az
 * őrnek ezt észre KELL vennie.
 */
async function buildPreview(broken: boolean): Promise<void> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections,
  };
  let html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, demo)),
    ARTIFACT_ID,
    demo.name,
  );
  if (broken) {
    html = html.replace("unitPrice: p,", "unitPriceX: p,");
    // 🔴 önteszt: a setEncryptedEmail MINDKÉT útja kiütve (change-figyelő + a
    // Fizetek-gomb ága) — a Z9-nek és a ZM-nek ezt észre KELL vennie.
    // ⛔ UTÓ-FELTÉTEL kötelező: egy nem-találó csere az öntesztet némán
    // gyengítené — a „törött" fixture valójában ép lenne, és a piros kontroll
    // a unitPrice-ra szűkülne (a szűk felismerő ugyanúgy hamis zöld).
    for (const gone of [
      'if (t && t.getAttribute && t.getAttribute("data-f") === "buyer_email") pxEmail(t.value);',
      'pxEmail(val("buyer_email"));',
    ]) {
      html = html.replace(gone, "");
      if (html.includes(gone)) {
        console.error(`⛔ ÖNTESZT-HIBA: a kiütendő minta nem tűnt el: ${gone}`);
        process.exit(1);
      }
    }
  }
  // A szerver által tudott esemény — szó szerint ugyanaz a hívás, amit a
  // fizetés-visszaigazoló lap használ (nem egy másolat).
  const purchase = pixelQueueScript("purchase", {
    contents: [
      {
        id: "order",
        contentType: "Product",
        name: "Hotel Példa",
        unit: "db",
        unitPrice: 39000,
        totalItemPrice: 39000,
        currency: "HUF",
        quantity: 1,
      },
    ],
    currency: "HUF",
    step: 3,
    revenue: 39000,
    orderNumber: "CIT-TESZT01",
  });
  // ⛔ A hozzájárulás-réteget a TERMÉK SAJÁT kimenetéből tesszük a lapra
  // (`consentSnippet()`), nem kézzel összerakva: az első változatom csak a
  // szkriptet injektálta, a STÍLUSLAPOT nem — a sáv így z-index nélkül renderelt,
  // a konfigurátor takarója alá került, és az őr a saját fixture-hibáját mérte
  // valódi leletként. A fixture bizonyítsa, hogy azt az utat járja, amit a szerver.
  const snippet = consentSnippet();
  if (!snippet.body) {
    console.error("⛔ KIHAGYVA: nincs BARION_PIXEL_ID a konfigurációban — nincs mit mérni.");
    process.exit(2);
  }
  // ⛔ A lap `file://`-ből fut, a Playwright pedig a `file://` kéréseket NEM tudja
  // elfogni — a hivatkozott sáv-CSS és -JS így SOHA nem érkezett meg, és az őr a
  // saját fixture-hibáját mérte. Ezért a két fájl TARTALMÁT ágyazzuk be. A HIVATKOZÁS
  // ettől még a termék sajátja marad: alább megköveteljük, hogy a snippet tényleg
  // ezekre a fájlokra mutasson — egy átnevezés így hangosan bukik, nem némán zöldül.
  for (const needed of ["cit-consent.css", "cit-consent.js"]) {
    if (!`${snippet.head}${snippet.body}`.includes(needed)) {
      console.error(`⛔ A hozzájárulás-snippet már nem a(z) ${needed}-t hivatkozza — az őr elavult.`);
      process.exit(1);
    }
  }
  let consentJs = readFileSync("public/assets/runtime/cit-consent.js", "utf8");
  if (broken) {
    // 🔴 önteszt: a grantConsent kiütve a sor éléről — a Z8-nak és a ZM-nek
    // ezt észre KELL vennie (2026-09-18: pont ez az esemény hiányzott élesben,
    // és az akkori őr zölden hallgatott róla). Utó-feltétel itt is (lásd fent).
    const gone = 'window.citPixel("grantConsent");';
    consentJs = consentJs.replace(gone, "");
    if (consentJs.includes(gone)) {
      console.error(`⛔ ÖNTESZT-HIBA: a kiütendő minta nem tűnt el: ${gone}`);
      process.exit(1);
    }
  }
  const inline =
    `<style>${readFileSync("public/assets/runtime/cit-consent.css", "utf8")}</style>` +
    `<script data-pixel-id="${PIXEL_ID}">${consentJs}</script>`;
  html = html.replace("</body>", `${purchase}${inline}</body>`);
  await writeFile(PREVIEW, html, "utf8");
}

/** A kimenő üzenetek elkapása: a `bp.js` egy `barion_receiver` iframe-nek
 *  posztolja a VALIDÁLT üzenetet, ezért az iframe-et cseréljük megfigyelőre. */
async function arm(page: Page, bpSource: string): Promise<void> {
  await page.route(PAGE_URL, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: readFileSync(PREVIEW, "utf8") }),
  );
  // ⛔ A `bp.js` HÁROMLÉPCSŐS kézfogással indul, és ezt hűen kell lejátszani, különben
  // az őr a saját stubja miatt mér némát (az első két változatom pontosan ezt tette,
  // és majdnem „élesben is néma a Pixel" leletet írtam belőle):
  //   ① `window.load` → létrejön a `barion.html` iframe;
  //   ② az visszaüzen `pixelStatusBase`-t → ekkor épül a KÜLDŐ iframe
  //      (`barionbase.html`, id=`barion_receiver`) — a `send_message` ezt keresi;
  //   ③ a küldő iframe `pixelStatus`-a hívja a `load_tracker()`-t → csak ekkor
  //      kezdi FELDOLGOZNI a `bp.q` sorát.
  // Az origin-ellenőrzés (`e.origin === EMITTER_HOST`) miatt az üzeneteknek a
  // pixel.barion.com-ról kell jönniük — ezért stubolunk, nem injektálunk.
  const STATUS = "{deniedBase:false,approvedBase:true,approvedMarketing:false}";
  await page.route(
    (u) => u.hostname === "pixel.barion.com",
    (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith("bp.js")) {
        return route.fulfill({ status: 200, contentType: "application/javascript", body: bpSource });
      }
      if (p.endsWith("barionbase.html")) {
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body:
            `<!doctype html><meta charset="utf-8"><script>` +
            `parent.postMessage({message:"pixelStatus",pixelStatus:${STATUS}},"*");` +
            `window.addEventListener("message",function(e){` +
            `try{window.parent.postMessage({__citPixel:e.data},"*")}catch(x){}});</script>`,
        });
      }
      if (p.endsWith("barion.html")) {
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body:
            `<!doctype html><meta charset="utf-8"><script>` +
            `parent.postMessage({message:"pixelStatusBase",pixelStatus:${STATUS}},"*");</script>`,
        });
      }
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    },
  );
  // A rendelés-végpont: valódi POST megy rá, mi pedig ELKAPJUK a beküldött árat —
  // így a Z6 nem egy képernyő-szöveget hasonlít, hanem a KÉT TÉNYLEGES számot.
  // ⛔ A válasz `payUrl`-je egy 204-re mutat: a böngésző nem navigál el, tehát a
  // lapon marad a mérés (navigáció után a begyűjtött események elvesznének).
  await page.route("**/request", async (route) => {
    try {
      const body = route.request().postDataJSON() as { price?: number } | null;
      if (body && typeof body.price === "number") submittedPrice = body.price;
    } catch {
      /* nem JSON — a mérés ettől még menjen tovább */
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ payUrl: `${PAGE_URL}/fizetes-stub` }),
    });
  });
  await page.route(`${PAGE_URL}/fizetes-stub`, (route) => route.fulfill({ status: 204, body: "" }));
  // A szállás-fotók a vizsgálat tárgyán kívül esnek (CDN, nem a mi kódunk).
  await page.route("**/picsum.photos/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/gif", body: "" }),
  );
  await page.addInitScript(() => {
    (window as unknown as { __sent: unknown[] }).__sent = [];
    window.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { __citPixel?: Record<string, unknown> };
      if (d && d.__citPixel) (window as unknown as { __sent: unknown[] }).__sent.push(d.__citPixel);
    });
  });
}

interface Sent {
  readonly event_name?: string;
  readonly [k: string]: unknown;
}

const sentEvents = (page: Page): Promise<Sent[]> =>
  page.evaluate(() => (window as unknown as { __sent: Sent[] }).__sent.slice());

const namesOf = (rows: Sent[]): string[] =>
  rows.map((r) => String(r.event_name ?? "")).filter((n) => n && n !== "addBarionPixelId");

/**
 * Egy esemény ELSŐ előfordulása a kimenő üzenetek közt — nem csak `event_name`
 * szerint: a consent/identity csatorna (grantConsent, setEncryptedEmail) üzenet-alakja
 * eltérhet a track-ekétől, ezért a teljes üzenetben is keresünk. A találat így is a
 * bp.js KIMENŐ üzenete (a megfigyelő-iframe-hez csak az jut el), nem a forrásunk
 * visszhangja.
 */
const firstIndexOf = (rows: Sent[], name: string): number =>
  rows.findIndex((r) => r.event_name === name || JSON.stringify(r).includes(`"${name}"`));

/**
 * A kosár mozgatása VALÓDI kattintással — oda-vissza.
 * ⛔ A lap alapból MINDENT bekapcsolva mutat (ADR-0047 „all-in az első képen"),
 * ezért az első kattintás KIVESZ a kosárból. Az őr első változata `addToCart`-ot
 * várt, és a saját téves feltevését mérte hibának.
 */
async function togglePricedRow(page: Page): Promise<boolean> {
  await page.mouse.wheel(0, 900);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 9000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(400);
  const row = page.locator(".cit-cfg-row[aria-pressed]").first();
  if (!(await row.count())) return false;
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.waitForTimeout(250);
  await row.click();
  await page.waitForTimeout(250);
  return true;
}

/** A vevő tényleges útja a fizetésig: modulok → jogi pipa → számlázás → Fizetek. */
async function walkToPayment(page: Page): Promise<string | null> {
  const next = page.locator(".cit-cfg-next");
  if (await next.count()) {
    await next.click();
    await page.waitForTimeout(250);
  }
  await page.locator(".cit-cfg-rights").check();
  await page.waitForTimeout(150);
  await page.locator(".cit-cfg-submit").click();
  await page.waitForTimeout(350);
  if (!(await page.locator(".cit-cfg-step3").isVisible())) return "a számlázási lépés nem nyílt meg";
  const fields: Record<string, string> = {
    buyer_name: "Teszt Elek",
    buyer_zip: "1011",
    buyer_city: "Budapest",
    buyer_address: "Fő utca 1.",
    buyer_email: "teszt@pelda.hu",
  };
  for (const [key, value] of Object.entries(fields)) {
    const input = page.locator(`[data-fw="${key}"] input`).first();
    if (await input.count()) await input.fill(value);
  }
  // ⛔ A cím beírása UTÁN a vevő továbblép (blur → change) — és a Barion
  // bírálója PONT ITT áll meg: beírja, de nem fizet. A `fill()` magától nem
  // blurol, ezért az őr 2026-09-24-ig csak a Fizetek-ágon látta a
  // setEncryptedEmailt, és a halott change-figyelő zöld maradt.
  await page.locator('[data-fw="buyer_email"] input').first().press("Tab");
  await page.waitForTimeout(400);
  sentBeforePay = await sentEvents(page);
  // Minden LÁTHATÓ hozzájárulás-pipa — a gomb addig tiltott (ADR-0088 ⑨).
  const boxes = page.locator('.cit-cfg-consent input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) {
    const b = boxes.nth(i);
    if (await b.isVisible()) await b.check().catch(() => {});
  }
  await page.waitForTimeout(200);
  const pay = page.locator(".cit-cfg-pay");
  if (await pay.isDisabled()) return "a Fizetek gomb tiltott maradt (egy kapu nem teljesült)";
  await pay.click();
  await page.waitForTimeout(700);
  return null;
}

async function run(broken: boolean): Promise<void> {
  const bpSource = await fetchPixelScript();
  if (!bpSource) {
    // ⛔ NEM MÉRHETŐ ≠ RENDBEN. A commitot nem állítjuk meg (hálózat nélkül is kell
    // tudni dolgozni), de a kihagyás STDERR-re megy: a hook a stdout-ot naplófájlba
    // tereli, és egy oda írt figyelmeztetést senki nem látna. Aki ezt a sort olvassa,
    // tudja, hogy a Pixelt EZEN a commiton nem ellenőrizte senki.
    console.error(
      "\n⚠️  barion-pixel-check KIHAGYVA — NEM PASS, csak nem mérhető:\n" +
        "   a pixel.barion.com/bp.js nem érhető el, így a Barion saját validátorán\n" +
        "   nem tudom átfuttatni az eseményeket. Hálózat mellett futtasd újra:\n" +
        "   npx tsx scripts/barion-pixel-check.mts\n",
    );
    process.exit(0);
  }
  await buildPreview(broken);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const jsErrors: string[] = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));
  await arm(page, bpSource);
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // ── Z1: hozzájárulás ELŐTT semmi ─────────────────────────────────────────────
  const bar = page.locator("#cit-consent");
  say((await bar.count()) > 0, "a süti-sáv megjelenik a konfigurátor-lapon (a kapu létezik)");
  const toggled = await togglePricedRow(page);
  say(toggled, "a kosár-panel nyílik és van kapcsolható modul-sor");
  const beforeConsent = await sentEvents(page);
  say(
    beforeConsent.length === 0,
    "Z1: hozzájárulás ELŐTT egyetlen esemény sem megy ki (a kosár-kattintás sem)",
    `${beforeConsent.length} üzenet ment ki: ${namesOf(beforeConsent).join(", ")}`,
  );
  say(
    !(await page.evaluate(() => Boolean((window as unknown as { bp?: unknown }).bp))),
    "Z1: a Pixel be sem töltődik döntés előtt",
  );

  // ── Z2: elutasítás tartós ────────────────────────────────────────────────────
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await arm(page2, bpSource);
  await page2.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(400);
  await page2.locator('#cit-consent button[data-c="necessary"]').click();
  await togglePricedRow(page2);
  await page2.waitForTimeout(500);
  const afterDecline = await sentEvents(page2);
  say(
    afterDecline.length === 0,
    "Z2: elutasítás után SEM megy ki semmi (a várakozó sor nem ürül)",
    `${afterDecline.length} üzenet: ${namesOf(afterDecline).join(", ")}`,
  );
  await page2.close();

  // ── Z3–Z6: elfogadás után ────────────────────────────────────────────────────
  await page.locator('#cit-consent button[data-c="all"]').click();
  await page.waitForTimeout(1500);
  const after = await sentEvents(page);
  const names = namesOf(after);
  // ⛔ Z3/a — AZ AZONOSÍTÓ KIMONDVA. Élesen mérve (2026-09-16) itt bukott a csatorna:
  // a `bp.js` a pixel-azonosítót `window.barion_pixel_id`-ből vagy egy INLINE szkript
  // szövegéből olvassa, a mi `data-pixel-id` attribútumunkból NEM — ezért a Barion
  // kódja „Base code implementaion not found"-ot adott, a küldő iframe fel sem épült.
  // Ezt az őr STUBJA nem foghatta meg (mindig válaszolt), ezért külön állítás.
  say(
    (await page.evaluate(() => (window as unknown as { barion_pixel_id?: string }).barion_pixel_id)) === PIXEL_ID,
    "Z3/a: a Pixel-azonosító ott van, ahol a bp.js KERESI (window.barion_pixel_id)",
  );
  // ── Z8: grantConsent — az „Elfogadom" ténye ─────────────────────────────────
  const gcIdx = firstIndexOf(after, "grantConsent");
  say(
    gcIdx >= 0,
    "Z8: a hozzájárulás ténye kimegy (grantConsent — Full Pixel kötelező #1)",
    `kiment: ${namesOf(after).join(", ") || "(semmi)"}`,
  );
  const cvIdx = firstIndexOf(after, "contentView");
  if (gcIdx >= 0 && cvIdx >= 0) {
    say(
      gcIdx < cvIdx,
      "Z8: a grantConsent MEGELŐZI a contentView-t (minden mást csak érvényes consent mellett dolgoznak fel)",
      `grantConsent a #${gcIdx}. üzenet, contentView a #${cvIdx}.`,
    );
  }
  say(names.includes("contentView"), "Z3: lap-megtekintés kimegy (a Base hiányzó eleme)", names.join(", "));
  say(names.includes("purchase"), "Z3: a szerver által beadott purchase is kimegy", names.join(", "));
  say(
    names.includes("addToCart") && names.includes("removeFromCart"),
    "Z4: a döntés ELŐTTI kosár-mozgás sem vész el (ki- ÉS bekapcsolás)",
    names.join(", "),
  );

  const cart = after.find((r) => r.event_name === "addToCart");
  const cartKeys = ["id", "contentType", "name", "unit", "unitPrice", "totalItemPrice", "currency", "quantity"];
  say(
    !!cart && cartKeys.every((k) => cart[k] !== undefined),
    "Z4: az addToCart MINDEN kötelező mezőt visz (a bp.js különben eldobná)",
    cart ? `hiányzik: ${cartKeys.filter((k) => cart[k] === undefined).join(", ")}` : "nincs addToCart üzenet",
  );

  // ── Z5: a pénztár teljes útja ────────────────────────────────────────────────
  const walkProblem = await walkToPayment(page);
  say(walkProblem === null, "Z5: a vevő el tud jutni a Fizetek gombig", walkProblem ?? "");
  const all = await sentEvents(page);
  const ic = all.find((r) => r.event_name === "initiateCheckout");
  const api = all.find((r) => r.event_name === "addPaymentInfo");
  say(!!ic, "Z5: a pénztár indulása kimegy (initiateCheckout)", namesOf(all).join(", "));
  say(!!api, "Z5: a fizetési kapunak átadás is kimegy (addPaymentInfo)", namesOf(all).join(", "));
  if (ic) {
    say(
      Array.isArray(ic.contents) && (ic.contents as unknown[]).length > 0 && typeof ic.revenue === "number",
      "Z5: tételes kosarat és számszerű fizetendő összeget visz",
      JSON.stringify({ contents: ic.contents, revenue: ic.revenue }).slice(0, 180),
    );
    // Z6 — a Pixel és a SZERVERNEK KÜLDÖTT ár ugyanaz a szám (egy forrás,
    // `payableTotal()`); a beküldött törzset a route-ból olvassuk ki.
    say(
      submittedPrice === null || submittedPrice === ic.revenue,
      "Z6: a Pixel `revenue`-ja EGYEZIK a szervernek beküldött árral",
      `beküldve: ${String(submittedPrice)} · pixel: ${String(ic.revenue)}`,
    );
  }
  say(jsErrors.length === 0, "Z7: nincs JS-hiba a lapon", jsErrors[0] ?? "");

  // ── Z9: setEncryptedEmail — a beírt számlázási cím azonosítója ──────────────
  const seIdx = firstIndexOf(all, "setEncryptedEmail");
  say(
    seIdx >= 0,
    "Z9: a számlázási e-mail azonosító kimegy (setEncryptedEmail — Full Pixel kötelező #2)",
    `kiment: ${namesOf(all).join(", ") || "(semmi)"}`,
  );
  if (seIdx >= 0) {
    // A doksi szerint a bp.js SHA-1-gyel hashel; kisbetűs plaintextet is elfogad.
    // Bármelyik alak bizonyítja, hogy a BEÍRT cím ment ki, nem egy üres string.
    const msg = JSON.stringify(all[seIdx]);
    const sha1 = createHash("sha1").update("teszt@pelda.hu").digest("hex");
    say(
      msg.includes(sha1) || msg.includes("teszt@pelda.hu"),
      "Z9: az üzenet a BEÍRT címet viszi (SHA-1 hash vagy kisbetűs plaintext)",
      msg.slice(0, 220),
    );
  }

  // ── Z9/b: a cím a Fizetek ELŐTT megy ki ─────────────────────────────────────
  // A bíráló (és a meggondolja-magát vevő) nem nyom Fizeteket. Ha az azonosító
  // csak a fizetés-ágon indul, neki SOHA nem jelenik meg (-001, 2026-09-23).
  say(
    firstIndexOf(sentBeforePay, "setEncryptedEmail") >= 0,
    "Z9/b: a setEncryptedEmail már a cím BEÍRÁSAKOR kimegy, Fizetek nélkül",
    `a Fizetek előtt kiment: ${namesOf(sentBeforePay).join(", ") || "(semmi)"}`,
  );

  // ── ZM: a Barion kötelező-minimuma, TÉTELESEN ───────────────────────────────
  // ⛔ Ez a kapu a BARION kérdését teszi fel, nem a miénket. Forrás:
  // docs.barion.com/Implementing_the_Full_Barion_Pixel „Mandatory events" —
  // „the events that must be implemented in every webshop as a bare minimum".
  // 2026-09-18: az elfogadóhely Starterre bukott, mert ebből kettő hiányzott,
  // és az akkori őr zölden hallgatott — a hiányzó állítás nem piros, láthatatlan.
  const MANDATORY: readonly (readonly string[])[] = [
    ["grantConsent"],
    ["setEncryptedEmail"],
    ["contentView"],
    ["addToCart"],
    ["initiateCheckout"],
    ["initiatePurchase", "purchase"],
  ];
  for (const alt of MANDATORY) {
    say(
      alt.some((n) => firstIndexOf(all, n) >= 0),
      `ZM: Barion-kötelező esemény kimegy: ${alt.join(" VAGY ")}`,
      `kiment: ${namesOf(all).join(", ") || "(semmi)"}`,
    );
  }

  await browser.close();
}

await run(SELF_TEST);

if (SELF_TEST) {
  // Törésenként EGY-EGY nevesített piros kell: a Z4 a unitPrice-é, a Z8 a
  // grantConsent-é, a Z9 a setEncryptedEmailé. Az összesítő ehhez kevés.
  const mustFail = ["Z4", "Z8", "Z9:", "Z9/b"];
  const deadControls = mustFail.filter((z) => !failedWhat.some((w) => w.startsWith(z)));
  console.log(
    `\n🔴 ÖNTESZT: három szándékos törés (unitPrice elgépelve · grantConsent kiütve ·\n` +
      `   setEncryptedEmail mindkét útja kiütve) összesen ${failed} állítást buktatott.\n` +
      (deadControls.length
        ? `   ⛔ HALOTT KONTROLL: a(z) ${deadControls.join(", ")} törése NEM adott pirosat — az őr ott vak.`
        : "   Mindhárom törés nevesítetten piros — az őr mindhármat méri."),
  );
  process.exit(deadControls.length === 0 ? 0 : 1);
}

if (failed) {
  console.error(`\n⛔ ${failed} mérés bukott — a Barion Pixel nem azt küldi, amit a vevő tesz.`);
  process.exit(1);
}
console.log("\n✅ barion-pixel-check: a Full Pixel a vásárlás lépéseit küldi, és csak hozzájárulás után.");
