// A MÁR VÁSÁROLT LÁTOGATÓ — a harmadik keretezési állapot őre.
//
//   npx tsx scripts/prospect-owned-check.mts
//   npx tsx scripts/prospect-owned-check.mts --selftest   (PIROS önteszt)
//
// MIT ŐRIZ, ÉS MIÉRT ÍGY
//
//  ① A PÉNZ-KAPU, A MŰVELET SAJÁT PREDIKÁTUMÁVAL. Nem egy jelvényt kérdezünk meg
//     („küldhető?"), hanem lefuttatjuk a VALÓDI `requestPayment()`-et egy VALÓDI,
//     már vásárolt lead `initial` rendelésére, és megköveteljük, hogy null-t adjon.
//     Mellékhatás nincs: a kapu minden írás ELŐTT áll. Egy jelvény MÁS kérdésre
//     válaszolna — pont ez a hiba termelte a bejelentést.
//
//  ② A KÉPERNYŐ NEM ÁLLÍT VALÓTLANT. A követett sáv úgy végződik, hogy „Ez még nem
//     élő oldal.", a követett lábléc pedig azt állítja, hogy mérünk, „hogy az
//     ajánlatot az igényeihez igazíthassuk". Egy FIZETŐ ügyfélnek mindkettő hamis
//     (§B.17 ránk is áll), ezért az `owned` ágnak SAJÁT sávja és SAJÁT lábléce van
//     — az őr mindkét mondatot NÉVSZERINT tiltja ezen a lapon.
//
//  ③ NINCS VÁSÁRLÁSI RÉTEG. A konfigurátor VALÓDI horgonyára (`data-cit-configurator`)
//     kötve, nem szóra: az első változatom a `Megrendel` szóra illesztett, és a SAJÁT
//     sávom szövegére („Megrendelve: …") ment pirosra egy hibátlan lapon.
//
//  ④ A LEIRATKOZÁS NINCS OTT. Egy fizető ügyfél saját lapján a „Leiratkozás" úgy
//     olvasódik, mintha a SZOLGÁLTATÁSA lenne lemondható egy kattintással.
//
//  ⑤ A SÁV HELYE ÉS OLVASHATÓSÁGA — ugyanaz a mérce, mint a testvér-őrben
//     (ADR-0159): normál folyam, a lap tetején, natív <details> JS nélkül is nyílik,
//     a linkek/gombok kontrasztja MÉRVE ≥ 4,5 a saját hátterükön.
//
//  ⑥ MOBIL ÉS ASZTALI KÉT DÖNTÉS. 390-en oszlop + teljes szélességű gomb, 1280-on
//     sor. Ha a töréspont elromlik, a sáv telefonon egy sorba préselődne.
//
// ⛔ AMIT EZ AZ ŐR NEM FED LE, KIMONDVA: azt NEM méri, hogy egy NEM vásárolt lead
// rendelése tényleg kap-e pay-linket — az valódi `payment` sort írna a közös
// dev-adatbázisba. A kapu „átenged" iránya az Elek-forgatókönyvek dolga; itt a
// predikátum mindkét polaritását mérjük helyette (van tenant → nem null, nincs →
// null), hogy egy mindig-igaz predikátum ne adhasson néma zöldet.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
// ⛔ EPHEMERAL PORT, or this guard cannot run WHERE THE WORK HAPPENS. It booted the
// console on the fixed CONSOLE_PORT (4600), which on this dev box is held by the
// running `citoviso-console` service — so every worktree run died with EADDRINUSE
// before a single assertion (measured 2026-09-21, on a commit that only touched
// payment/service.ts). The server already supports CONSOLE_PORT=0 and this guard
// already reads the assigned port back; only the asking was missing.
// ⚠️ Must be set BEFORE the (dynamic) import of console/server.js — that module reads
// the variable at load time (reference_env_assignment_loses_to_esm_imports).
// `??=` so an explicit CONSOLE_PORT from the caller still wins.
process.env.CONSOLE_PORT ??= "0";

import { mkdir, rm, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { chromium } from "playwright-core";

import { db } from "../src/db/client.js";
import { ownedSiteForLead } from "../src/conversion/owned.js";
import { requestPayment } from "../src/payment/service.js";
import {
  disableIntroAnimation,
  injectOwnedBanner,
  injectOwnedNotice,
  type OwnedBannerInput,
} from "../src/console/prospectNotice.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

// ⛔ Munkafánként külön: assets/Temp SYMLINK a fő fába, és ez az őr rm -rf-eli a
// saját könyvtárát — a testvér-őr ugyanezen a csapdán bukott (2026-09-15).
const SCOPE = path.basename(path.resolve(import.meta.dirname, ".."));
const SELFTEST = process.argv.includes("--selftest");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

const DATA: SiteData = {
  name: "ELEK-PRÓBA Vendégház",
  tagline: "Szigliget, Balaton",
  intro: "Szigligeten, a várdomb és a strand között, tágas kerttel.",
  highlights: ["Teraszos kert, grillsarok", "Strand néhány perc sétára"],
  geo: { lat: 46.8, lon: 17.43 },
  photos: [1, 2, 3].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36, Szigliget, 8264" },
};

/** Two templates, each for a named reason (the sweep lives in the sibling guard). */
const TEMPLATES_UNDER_TEST: ReadonlyArray<[string, string]> = [
  ["fullbleed", "navja position:absolute; top:0 — ráfekhetne a sávra"],
  ["aurora", "body>*{position:relative} — ez ejtett már injektált réteget a lap aljára"],
];

const recipe = (templateId: string): Recipe =>
  ({
    skin: TEMPLATES[templateId]!.skins[0]!,
    archetype: "stacked",
    template: templateId,
    sections: [],
  }) as unknown as Recipe;

const OWNED: OwnedBannerInput = {
  stage: "live",
  siteUrl: "https://elek-proba.citoviso.com",
  loginUrl: "https://citoviso.com/login",
};

/** The page exactly as the console serves it to a lead who already bought. */
async function ownedPage(tpl: string): Promise<string> {
  const base = disableIntroAnimation(await injectRuntime(renderSite(recipe(tpl), DATA)));
  const page = injectOwnedNotice(injectOwnedBanner(base, OWNED), OWNED);
  // ÖNTESZT: a hiba, amit a bejelentés leírt — a vásárlási réteg ott maradt, és a
  // követett sáv „még nem élő oldal" mondata is. Pirosnak KELL lennie.
  return SELFTEST
    ? page.replace(
        "</body>",
        `<script type="application/json" data-cit-configurator>{}</script>` +
          `<p>Ez még nem élő oldal.</p>` +
          `<a href="/p/x/unsubscribe">Leiratkozás</a></body>`,
      )
    : page;
}

function srgb(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function contrast(fg: number[], bg: number[]): number {
  const l = (c: number[]) => 0.2126 * srgb(c[0]!) + 0.7152 * srgb(c[1]!) + 0.0722 * srgb(c[2]!);
  const [a, b] = [l(fg), l(bg)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}
const rgb = (s: string): number[] => {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
};

const OUT = path.resolve(import.meta.dirname, `../assets/Temp/_owned-${SCOPE}`);
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// ── ① A PÉNZ-KAPU, ÉLESBEN ───────────────────────────────────────────────────
console.log("\n① Pénz-kapu — a valódi requestPayment() egy MÁR VÁSÁROLT leaden");

const ownedLead = await db
  .selectFrom("tenant")
  .innerJoin("lead", "lead.id", "tenant.lead_id")
  .select(["lead.id as leadId", "lead.name as name"])
  .executeTakeFirst();

if (!ownedLead) {
  // ⛔ Nem néma kihagyás: előfeltétel hiányzik, az őr NEM tud ítélni.
  console.error("  ✗ ELŐFELTÉTEL HIÁNYZIK: nincs egyetlen tenant sem a dev-adatbázisban");
  failures++;
} else {
  const owned = await ownedSiteForLead(ownedLead.leadId);
  check(`a predikátum IGAZ a vásárolt leadre (${ownedLead.name})`, owned !== null, owned?.stage);
  check("a belépési cím a kanonikus platform-login", owned?.loginUrl === "https://citoviso.com/login", owned?.loginUrl);

  const oi = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select("order_intent.id as id")
    .where("prospect.lead_id", "=", ownedLead.leadId)
    .where("order_intent.kind", "=", "initial")
    .executeTakeFirst();
  if (!oi) {
    console.error("  ✗ ELŐFELTÉTEL HIÁNYZIK: a vásárolt leadnek nincs 'initial' rendelése");
    failures++;
  } else {
    // A kapu MINDEN írás előtt áll, tehát ez a hívás mellékhatás-mentes.
    const pay = await requestPayment(oi.id);
    check("requestPayment() MEGTAGADJA az initial rendelést (nincs pay-link)", pay === null, pay);
  }
}

// A predikátum MÁSIK polaritása — különben egy mindig-igaz predikátum is zöld lenne.
const freeLead = await db
  .selectFrom("lead")
  .select(["id", "name"])
  .where(({ not, exists, selectFrom }) =>
    not(exists(selectFrom("tenant").select("tenant.id").whereRef("tenant.lead_id", "=", "lead.id"))),
  )
  .where(({ not, exists, selectFrom }) =>
    not(
      exists(
        selectFrom("prospect")
          .innerJoin("order_intent", "order_intent.prospect_id", "prospect.id")
          .innerJoin("payment", "payment.order_intent_id", "order_intent.id")
          .select("payment.id")
          .where("payment.status", "=", "paid")
          .whereRef("prospect.lead_id", "=", "lead.id"),
      ),
    ),
  )
  .executeTakeFirst();
if (!freeLead) {
  console.error("  ✗ ELŐFELTÉTEL HIÁNYZIK: nincs egyetlen NEM vásárolt lead sem (kontroll)");
  failures++;
} else {
  check(
    `a predikátum HAMIS a nem vásárolt leadre (${freeLead.name})`,
    (await ownedSiteForLead(freeLead.id)) === null,
  );
}

// ── ②–⑥ A KÉPERNYŐ ───────────────────────────────────────────────────────────
const browser = await chromium.launch();

for (const [tpl, why] of TEMPLATES_UNDER_TEST) {
  console.log(`\n②–⑥ ${tpl} (${why})`);
  const html = await ownedPage(tpl);

  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const bar = page.locator('[data-cit-framing="owned"]');
    check(`${width}px · a sáv ott van`, await bar.isVisible());

    const box = await bar.boundingBox();
    check(`${width}px · a lap tetején ül`, box !== null && Math.round(box.y) === 0, box?.y);
    // ⛔ NEM `position === "static"`: az aurora `body>*{position:relative}` szabálya
    // RELATÍVVÁ teszi a sávot, az viszont BENNE MARAD a folyamban — az első
    // változatom emiatt ment pirosra egy hibátlan lapon. A veszélyes érték a
    // kiemelés (fixed/absolute), és a döntő bizonyíték a GEOMETRIA: a lap többi
    // eleme a sáv ALATT kezdődik, tehát a sáv nem fekszik semmire és semmi nem
    // fekszik rá.
    const pos = await bar.evaluate((el) => getComputedStyle(el).position);
    check(`${width}px · nincs kiemelve a folyamból`, pos !== "fixed" && pos !== "absolute", pos);
    // ⛔ A „minden más elem a sáv alatt kezdődik" NYERS változata HAMIS PIROSAT ad:
    // a fullbleed `nav.t-nav`-ja fixed, top:-10 — de görgetés előtt NEM LÁTSZIK,
    // és a testvér-őr pixellel igazolja, hogy nem fest a sávra. Ezért két külön,
    // pontos állítás: (a) a FOLYAMBAN lévő, látható tartalom a sáv alatt kezdődik
    // (ez a „lenyomja a lapot" bizonyíték), és (b) a sáv rácspontjain tényleg a
    // sáv van (ADR-0147 mintája).
    const geom = await bar.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const inFlow = [...document.body.children].filter((x) => {
        if (x === el) return false;
        const cs = getComputedStyle(x);
        if (cs.position === "fixed" || cs.position === "absolute") return false;
        const r = x.getBoundingClientRect();
        return r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      });
      const minTop = inFlow.length ? Math.min(...inFlow.map((x) => x.getBoundingClientRect().top)) : Infinity;
      const pts: Array<[number, number]> = [];
      for (let i = 1; i <= 3; i++)
        for (let j = 1; j <= 3; j++) pts.push([b.left + (b.width * i) / 4, b.top + (b.height * j) / 4]);
      const stolen = pts.filter(([x, y]) => {
        const t = document.elementFromPoint(x, y);
        return !(t === el || el.contains(t));
      }).length;
      return { bottom: b.bottom, height: b.height, minTop, stolen };
    });
    check(
      `${width}px · a folyamban lévő tartalom a sáv ALATT kezdődik`,
      geom.height > 0 && geom.minTop >= geom.bottom - 1,
      geom,
    );
    check(`${width}px · a sáv rácspontjain a sáv van (semmi nem fest rá)`, geom.stolen === 0, geom.stolen);

    // ③ a vásárlási réteg VALÓDI horgonya
    check(`${width}px · nincs vásárlási réteg`, (await page.locator("[data-cit-configurator]").count()) === 0);

    const text = await page.locator("body").innerText();
    // ② a két mondat, ami itt hazugság lenne
    check(`${width}px · nem állítja, hogy „még nem élő oldal"`, !/még nem élő oldal/i.test(text));
    check(`${width}px · nem állít ajánlat-személyre szabó mérést`, !/igényeihez igazíthassuk/i.test(text));
    check(`${width}px · kimondja, hogy nem mérünk`, /nem rögzítjük/i.test(text));
    // ④ a leiratkozás nem való egy ügyfél saját lapjára
    check(`${width}px · nincs leiratkozó link`, (await page.locator('a[href*="unsubscribe"]').count()) === 0);

    // ⑥ két elrendezés, két döntés
    const dir = await page.locator(".ow-row").evaluate((el) => getComputedStyle(el).flexDirection);
    check(`${width}px · elrendezés ${width === 390 ? "oszlop" : "sor"}`, dir === (width === 390 ? "column" : "row"), dir);

    // ⑤ olvashatóság — mérve, nem szemre
    for (const sel of [".ow-btn", '[data-cit-framing="owned"] .ow-txt a', '[data-cit-footer="owned"] a']) {
      const n = await page.locator(sel).count();
      if (n === 0) continue;
      const c = await page.locator(sel).first().evaluate((el) => {
        const cs = getComputedStyle(el);
        let bg = cs.backgroundColor;
        let node: HTMLElement | null = el as HTMLElement;
        while (bg === "rgba(0, 0, 0, 0)" && node?.parentElement) {
          node = node.parentElement;
          bg = getComputedStyle(node).backgroundColor;
        }
        return { fg: cs.color, bg };
      });
      const r = contrast(rgb(c.fg), rgb(c.bg));
      check(`${width}px · ${sel} kontraszt ≥ 4,5`, r >= 4.5, r.toFixed(2));
    }

    await ctx.close();
  }

  // ⑤ a jogi részlet JS NÉLKÜL is nyílik — natív <details>, nem szkript
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const p2 = await noJs.newPage();
  await p2.setContent(html, { waitUntil: "load" });
  const det = p2.locator(".ow-det");
  check("JS nélkül · alapból csukva", !(await det.evaluate((d) => (d as HTMLDetailsElement).open)));
  await p2.locator(".ow-det summary").click();
  check("JS nélkül · kattintásra nyílik", await det.evaluate((d) => (d as HTMLDetailsElement).open));
  await noJs.close();
}

await browser.close();
await rm(OUT, { recursive: true, force: true });

// ── ⑦ A KÉT ÍGÉRET AZ ÉLES ÚTON ──────────────────────────────────────────────
// Az ADR két olyat állít, amit a fenti, tiszta-függvényes mérések NEM tudnak
// igazolni, mert a ROUTE viselkedéséről szólnak: (a) a lap nem mér (a lábléce ezt
// ki is mondja — §B.17), és (b) az elutasított rendelés nem hagy maga után
// `order_intent`-et (különben egy operátori riasztás is születne egy
// nem-problémából). Ígéret őr nélkül elrohad, ezért itt a VALÓDI szerver felel.
if (!SELFTEST) {
  console.log("\n⑦ Az éles útvonal — a lap nem mér, a rendelés nem hagy nyomot");
  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .innerJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select(["prospect.id as id", "prospect.token as token", "mock_artifact.path as artifactPath"])
    .executeTakeFirst();
  if (!prospect) {
    console.error("  ✗ ELŐFELTÉTEL HIÁNYZIK: nincs vásárlott leadhez kötött, mockos prospect");
    failures++;
  } else {
    const views = async () =>
      String(
        (
          await db
            .selectFrom("mock_view")
            .select(db.fn.countAll().as("n"))
            .where("prospect_id", "=", prospect.id)
            .executeTakeFirstOrThrow()
        ).n,
      );
    const orders = async () =>
      String((await db.selectFrom("order_intent").select(db.fn.countAll().as("n")).executeTakeFirstOrThrow()).n);
    const [v0, o0] = [await views(), await orders()];

    // ⛔ KIMONDATLAN, MUNKAFA-FÜGGŐ ELŐFELTÉTEL — ez buktatta el a landolást
    // (2026-09-20): a `mock_artifact.path` egy PUSZTA FÁJLNÉV, amit a route a
    // cwd-hez képest olvas, a fájl viszont a FŐ FA gyökerében fekszik. Egy
    // munkafában (és friss klónon) tehát nincs ott → a `/p/<token>` a 404-ágra
    // fut, és az őr a TERMÉKET jelentette hibásnak a KÖRNYEZET helyett.
    // Ezért: ha hiányzik, az őr legyártja a saját fájában (a motorral, nem
    // üres HTML-lel), és a végén eltakarítja. A fő fához nem nyúl.
    const artRel = String(prospect.artifactPath ?? "");
    const artAbs = path.resolve(import.meta.dirname, "..", artRel);
    let artifactMade = false;
    if (artRel && !existsSync(artAbs)) {
      await mkdir(path.dirname(artAbs), { recursive: true });
      await writeFile(artAbs, await injectRuntime(renderSite(recipe("fullbleed"), DATA)), "utf8");
      artifactMade = true;
      console.log(`  ⓘ a mock fájl hiányzott ebből a fából — az őr legyártotta: ${artRel}`);
    }

    const { server } = (await import("../src/console/server.js")) as { server: import("node:http").Server };
    if (!server.listening) await once(server, "listening");
    const port = (server.address() as { port: number }).port;

    const pageRes = await fetch(`http://127.0.0.1:${port}/p/${prospect.token}`);
    const html = await pageRes.text();
    check("a lap kimegy (200)", pageRes.status === 200, pageRes.status);
    check("az owned sáv van rajta", html.includes('data-cit-framing="owned"'));
    check("nincs rajta vásárlási réteg", !html.includes("data-cit-configurator"));
    check("MÉRVE: a megtekintés nem rögzült", (await views()) === v0, { v0, most: await views() });

    const orderRes = await fetch(`http://127.0.0.1:${port}/p/${prospect.token}/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modules: [],
        billing_period: "annual",
        price: 95000,
        domain_type: "citoviso_sub",
        photo_rights_declared: true,
        recurring_consent: true,
        buyer_type: "person",
        buyer_name: "ŐR-PRÓBA",
        buyer_country: "HU",
        buyer_zip: "8264",
        buyer_city: "Szigliget",
        buyer_street: "Kossuth u. 36",
        buyer_email: "or-proba@example.invalid",
        terms_accepted: true,
      }),
    });
    const payload = (await orderRes.json()) as { error?: string };
    check("a rendelés 409-cel elutasítva", orderRes.status === 409, orderRes.status);
    check("a válasz megnevezi az okot", payload.error === "already_owned", payload.error);
    check("MÉRVE: nem keletkezett order_intent", (await orders()) === o0, { o0, most: await orders() });
    server.close();
    if (artifactMade) await unlink(artAbs).catch(() => {});
  }
}

await db.destroy();

if (SELFTEST) {
  console.log(
    failures > 0
      ? `\n✅ ÖNTESZT: a beültetett hibákat elkapta (${failures} piros)`
      : "\n❌ ÖNTESZT: a beültetett hibákra ZÖLD maradt — az őr nem mér",
  );
  process.exit(failures > 0 ? 0 : 1);
}
console.log(failures === 0 ? "\n✅ prospect-owned-check: tiszta" : `\n❌ ${failures} bukás`);
process.exit(failures === 0 ? 0 : 1);
