// A JÓVÁHAGYOTT SZOBA-SZERKESZTŐ ŐRE (kontraktus:
// assets/design-refs/tenant-admin/room-editor/README.md, tulaj 2026-09-22, ADR-0198).
//
// Miért kell: a kontraktus VISELKEDÉST köt, nem stílust — „kattintásra felugró",
// „a Mentés rögzített lábazatban", „a csillag hozzá is rendel", „a feltöltés nem
// írja át a meglévő borítót", „JS nélkül sem veszik funkció". Ezt egyetlen
// screenshot sem bizonyítja: a képen a kártya akkor is jól néz ki, ha a felugró soha
// nem nyílik meg. Ezért ez az őr VÉGIGKATTINTJA a valódi felületet — a saját
// worktree szerverén, efemer porton, bejelentkezett tenantként.
//
// A terv-kör HAT hibájából négyet a KÉP fogott meg, kettőt a mérő hazudott zöldre.
// Az ott megtanult szabályok itt kötelezőek:
//   · minden láthatóság-állítás a KIFESTETT téglalapot mérje (nem `hidden`-t);
//   · a szöveg-levágást SZÖVEG-szinten (a görgető-doboz túlcsordulása 0-t mutatott,
//     miközben a jelvény 94 px-nyi darabját levágta a kártya);
//   · a kontraszt-mérő ismerje a `color(srgb …)` 0–1-es alakot is — ÖNTESZTTEL;
//   · ami nem tud PIROSRA menni, az nem őr → a végén NEGATÍV KONTROLLOK futnak.
//
//   npx tsx scripts/room-editor-check.mts
//   npx tsx scripts/room-editor-check.mts --shots   (állapot-képeket is ment)

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.DATABASE_URL = "";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Server } from "node:http";

import { chromium, type Browser, type Page } from "playwright-core";
import { sql } from "kysely";
import sharp from "sharp";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";

const SHOTS = process.argv.includes("--shots");
const OUT = path.resolve(import.meta.dirname, "../assets/Temp");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}
/** Negatív kontroll: a JAVÍTÁS ELŐTTI állapoton az állításnak PIROSRA kell mennie. */
function mustFail(name: string, ok: boolean, detail = ""): void {
  if (!ok) console.log(`  ✅ [neg] ${name} — az őr helyesen pirosra ment`);
  else {
    console.log(`  ⛔ [neg] ${name} — az őr ZÖLD maradt a visszarontott állapoton${detail ? ` (${detail})` : ""}`);
    failures.push(`[neg] ${name}`);
  }
}

// ── kontraszt: MINDKÉT szín-alak (rgb() 0–255 és color(srgb …) 0–1) ─────────────
function parseColor(raw: string): [number, number, number] | null {
  const s = raw.trim();
  const m1 = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m1) {
    const p = m1[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [p[0]!, p[1]!, p[2]!];
    }
    return null;
  }
  // ⛔ A color-mix() a böngészőből `color(srgb 0.97 0.94 0.87)` alakban jön —
  // 0–1 LEBEGŐPONTOS. 0–255-ként olvasva egy világos háttér majdnem feketének
  // mérődik, és „éppen átment" álértékeket ad (a terv-körben 3,32 helyett 5,53).
  const m2 = /^color\(srgb\s+([^)]+)\)$/.exec(s);
  if (m2) {
    const p = m2[1]!.split(/[\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [p[0]! * 255, p[1]! * 255, p[2]! * 255];
    }
  }
  return null;
}
function luminance(c: [number, number, number]): number {
  const f = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * f[0]! + 0.7152 * f[1]! + 0.0722 * f[2]!;
}
function contrast(fg: string, bg: string): number | null {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ── a mérő ÖNTESZTJE (a mérőeszköz hitelessége, §N) ────────────────────────────
{
  const white = "rgb(255, 255, 255)";
  const blackOnWhite = contrast("rgb(0,0,0)", white);
  const srgbLight = contrast("rgb(0,0,0)", "color(srgb 0.97 0.94 0.87)");
  const same = contrast(white, white);
  check("önteszt: fekete/fehér kontraszt 21", Math.abs((blackOnWhite ?? 0) - 21) < 0.1, String(blackOnWhite));
  check(
    "önteszt: a color(srgb …) VILÁGOS háttérnek mérődik (nem majdnem feketének)",
    (srgbLight ?? 0) > 15,
    `kapott: ${srgbLight?.toFixed(2)}`,
  );
  check("önteszt: azonos szín = 1,0", Math.abs((same ?? 0) - 1) < 0.01, String(same));
  check("önteszt: ismeretlen alak null-t ad", contrast("kék", white) === null);
}

/** A KIFESTETT téglalap: a DOM-tulajdonság nem bizonyíték (display:flex üti a [hidden]-t). */
async function painted(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, selector);
}

let leadId = "";
let tenantId = "";
let siteId = "";
let browser: Browser | null = null;
const tmpFiles: string[] = [];

try {
  // ── fixture ────────────────────────────────────────────────────────────────
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: "roomeditor", country: "HU", region: "re", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "Szoba-szerkesztő teszt", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "Szoba-szerkesztő teszt" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  const user = await db
    .insertInto("tenant_user")
    .values({
      tenant_id: tenant.id,
      contact_email: "re-teszt@example.com",
      username: `re-teszt-${Date.now()}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const artifact = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: lead.id,
      status: "approved",
      inputs: sql`${JSON.stringify({
        recipe: {
          template: "editorial",
          skin: "editorial-warm",
          archetype: "classic",
          sections: [{ kind: "hero" }, { kind: "rooms" }],
        },
        siteData: {
          name: "Szoba-szerkesztő teszt",
          tagline: "Teszt",
          intro: "Teszt szállás az őrhöz.",
          highlights: ["Kert"],
          photos: [],
          contact: { email: "re-teszt@example.com" },
        },
      })}::jsonb`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `rechk${Date.now()}`,
      source_artifact_id: artifact.id,
      status: "provisioned",
      path: `sites/${tenant.id}/index.html`,
      slug: `re-teszt-${Date.now()}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  for (const m of ["rooms", "amenities"]) {
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenant.id, module: m, active: true } as never)
      .execute();
  }

  const { ensureUnits, createUnit, getUnits, setUnitAmenities } = await import("../src/tenant/units.js");
  await ensureUnits(siteId);
  await createUnit(siteId, "Tetőtéri Appartman", 6, null);
  await createUnit(siteId, "Kerti faház", 2, null);
  const units = await getUnits(siteId);
  const whole = units.find((u) => u.isWholeProperty)!;
  const roomA = units.find((u) => u.name === "Tetőtéri Appartman")!;
  const roomB = units.find((u) => u.name === "Kerti faház")!;
  // Az A szobának VAN leírása (→ „Van saját oldala"), a B-nek nincs (→ „Hiányos”).
  const { updateUnit } = await import("../src/tenant/units.js");
  await updateUnit(siteId, roomA.id, roomA.name, roomA.capacity, "Tetőtéri szoba, saját erkéllyel.");
  await setUnitAmenities(siteId, roomA.id, ["Erkély"]);

  // Négy megkülönböztethető kép data-URL-ként: így VALÓDI pixelek festődnek, és a
  // borító-váltás bizonyítható (⛔ a data-URL-t sosem csonkolva hasonlítjuk).
  const colors: [number, number, number][] = [
    [200, 40, 40],
    [40, 160, 80],
    [40, 90, 200],
    [220, 190, 40],
  ];
  const photoUrls: string[] = [];
  for (const [r, g, b] of colors) {
    const buf = await sharp({ create: { width: 16, height: 12, channels: 3, background: { r, g, b } } })
      .png()
      .toBuffer();
    photoUrls.push(`data:image/png;base64,${buf.toString("base64")}`);
  }
  const { addTenantPhotos, setTenantUnitPhotos, getTenantContent, unitCoverPhoto } = await import(
    "../src/tenant/editor.js"
  );
  await addTenantPhotos(
    tenantId,
    photoUrls.map((url, i) => ({ url, alt: `teszt kép ${i + 1}` })),
  );
  // ⛔ A MÉRT KIINDULÓPONT reprodukálása: a p3 kép MINDKÉT szoba első képe, tehát a
  // honlapon két kártya ugyanazt mutatná — ezt a hibát kell a felületnek kimondania.
  await setTenantUnitPhotos(tenantId, whole.id, [photoUrls[0]!]);
  await setTenantUnitPhotos(tenantId, roomA.id, [photoUrls[2]!, photoUrls[3]!]);
  await setTenantUnitPhotos(tenantId, roomB.id, [photoUrls[2]!]);

  // ── szerver + bejelentkezett tenant ────────────────────────────────────────
  const { server } = (await import("../src/server/public.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("nincs szerver-cím");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  const cookie = mintTenantCookieValue(user.id);
  const base = `http://localhost:${addr.port}`;
  const ROOMS = `${base}/admin?tab=modulok&m=rooms`;

  browser = await chromium.launch({ executablePath: config.chromiumPath });

  async function withPage(
    width: number,
    fn: (p: Page) => Promise<void>,
    opts: { js?: boolean; label?: string } = {},
  ): Promise<void> {
    const ctx = await browser!.newContext({
      viewport: { width, height: 950 },
      javaScriptEnabled: opts.js !== false,
    });
    await ctx.addCookies([{ name: "cit_session", value: cookie, url: base }]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await fn(page);
    if (opts.js !== false) {
      check(`JS-hiba nincs (${opts.label ?? width + "px"})`, errors.length === 0, errors.join(" | "));
    }
    await ctx.close();
  }

  /** A süti-sáv a felugró elé kerülhet (fixed, saját z-index) — a MÉRÉS elől is
   *  eltakarná a képtárat, ezért minden mérés előtt elfogadjuk. Ez a tenant saját
   *  döntése a valóságban is: egyszer megnyomja, és soha többé nem látja. */
  async function dismissConsent(page: Page): Promise<void> {
    await page.evaluate(() => {
      const el = document.getElementById("cit-consent");
      if (el) el.remove();
    });
  }

  for (const width of [390, 1280]) {
    const tag = width === 390 ? "mobile" : "desktop";
    console.log(`\n${width}px`);
    await withPage(width, async (page) => {
      await page.goto(ROOMS, { waitUntil: "networkidle" });
      await dismissConsent(page);

      // ① A RÁCS — a kártya azt mutatja, amit a vendég lát
      const cards = page.locator(".rs-gcard:not(.rs-gcard--preview)");
      check("három szoba-kártya a rácsban", (await cards.count()) === 3, `kapott: ${await cards.count()}`);
      const cols = await page.evaluate(() => {
        const xs = new Set<number>();
        for (const el of document.querySelectorAll(".rs-grid > .rs-gcard")) {
          xs.add(Math.round(el.getBoundingClientRect().x));
        }
        return xs.size;
      });
      check(
        width === 390 ? "mobilon KÉT oszlop" : "asztalin NÉGY oszlopos rács (3 egységnél 3 hasáb)",
        width === 390 ? cols === 2 : cols === 3,
        `oszlop: ${cols}`,
      );

      // ② a jelvény a SZÖVEGÉIG ér, nem a kártya széléig
      const badgeFit = await page.evaluate(() => {
        const out: { badge: number; card: number }[] = [];
        for (const b of document.querySelectorAll(".rs-gbd > .rs-b")) {
          const card = b.closest(".rs-gcard")!;
          out.push({ badge: b.getBoundingClientRect().width, card: card.getBoundingClientRect().width });
        }
        return out;
      });
      check(
        "a jelvény nem nyúlik a kártya széléig (justify-self:start)",
        badgeFit.length > 0 && badgeFit.every((x) => x.badge < x.card - 8),
        badgeFit.map((x) => `${Math.round(x.badge)}/${Math.round(x.card)}`).join(" "),
      );

      // ③ ⛔ a jelvény SZÖVEGE nem vágódhat le — SZÖVEG-szinten mérve (a görgető-doboz
      //    túlcsordulása 0 px-t mutatott, miközben 94 px-nyi darab eltűnt)
      const clipped = await page.evaluate(() => {
        const bad: string[] = [];
        for (const b of document.querySelectorAll(".rs-b, .rs-gcount, .rs-gbd b")) {
          const r = b.getBoundingClientRect();
          const card = b.closest(".rs-gcard");
          if (!card) continue;
          const cr = card.getBoundingClientRect();
          const overflowsBox = b.scrollWidth > b.clientWidth + 1;
          const outsideCard = r.right > cr.right + 1 || r.bottom > cr.bottom + 1;
          if (overflowsBox || outsideCard) bad.push((b.textContent ?? "").trim().slice(0, 40));
        }
        return bad;
      });
      check("egyetlen kártya-felirat sincs levágva", clipped.length === 0, clipped.join(" | "));

      // ④ az állapot-jelvény megtartja a SZEMANTIKUS színét, és olvasható
      const badgeColors = await page.evaluate(() => {
        const out: { cls: string; fg: string; bg: string; text: string }[] = [];
        for (const b of document.querySelectorAll(".rs-gbd > .rs-b")) {
          const st = getComputedStyle(b);
          out.push({
            cls: b.className,
            fg: st.color,
            bg: st.backgroundColor,
            text: (b.textContent ?? "").trim(),
          });
        }
        return out;
      });
      const muted = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--citui-muted").trim(),
      );
      const mutedRgb = parseColor(muted) ?? [96, 116, 139];
      check(
        "a státusz-jelvény NEM csúszott a semleges szürkére (specificitás-ütközés)",
        badgeColors.every((b) => {
          const c = parseColor(b.fg);
          return !c || Math.abs(c[0] - mutedRgb[0]) + Math.abs(c[1] - mutedRgb[1]) + Math.abs(c[2] - mutedRgb[2]) > 30;
        }),
        badgeColors.map((b) => `${b.text.slice(0, 12)}=${b.fg}`).join(" "),
      );
      const worst = badgeColors
        .map((b) => ({ t: b.text, c: contrast(b.fg, b.bg) ?? 99 }))
        .sort((a, b) => a.c - b.c)[0];
      check(
        "minden kártya-jelvény kontrasztja ≥ 4,5",
        (worst?.c ?? 99) >= 4.5,
        `legrosszabb: ${worst?.t.slice(0, 24)} = ${worst?.c.toFixed(2)}`,
      );

      // ⑤ az ÜTKÖZÉS-jelvény a RÁCSON is ott van — ez a mai valódi hiba egyetlen jele
      const clash = page.locator(".rs-b--clash");
      check("a borító-ütközés a RÁCSON is látszik (2 kártyán)", (await clash.count()) === 2, `kapott: ${await clash.count()}`);
      check(
        "az ütközés-jelvény MEGNEVEZI a másik egységet",
        /Kerti faház|Tetőtéri Appartman/.test((await clash.first().textContent()) ?? ""),
        (await clash.first().textContent()) ?? "",
      );

      // ⑥ a „N kép" / „Részletek" jelvény — soha nem „1 kép"
      const counts = await page.locator(".rs-gcount").allTextContents();
      check(
        "egyetlen képnél „Részletek”, többnél darabszám — „1 kép” soha",
        counts.some((c) => /Részletek/.test(c)) && counts.every((c) => !/\b1 kép\b/.test(c)),
        counts.join(" | "),
      );

      // ⑦ a felugró alapból NINCS kifestve, kattintásra megnyílik
      check("a felugró alapból nincs a képernyőn", (await painted(page, `#szoba-${roomA.id} .rs-pop`)) === null);
      await cards.filter({ hasText: "Tetőtéri Appartman" }).first().click();
      await page.waitForTimeout(150);
      const pop = await painted(page, `#szoba-${roomA.id} .rs-pop`);
      check("a kártyára kattintva FELUGRÓ nyílik", pop !== null);
      const vw = width;
      const vh = 950;
      if (pop) {
        if (width === 390) {
          // KÖT: majdnem teljes képernyő, de LÁTHATÓ kerettel
          check(
            "mobilon látható keret marad a felugró körül (nem másik oldal)",
            pop.x >= 4 && pop.x + pop.w <= vw - 4 && pop.y >= 4,
            `x=${pop.x} w=${pop.w} y=${pop.y}`,
          );
          check("mobilon majdnem teljes képernyő", pop.w > vw * 0.9 && pop.h > vh * 0.75, `${pop.w}×${pop.h}`);
        } else {
          check("asztalin középre zárt párbeszéd (≤960 px)", pop.w <= 961 && pop.w >= 600, String(pop.w));
          check(
            "asztalin a RÁCS látszik mögötte (nem borít lapot)",
            pop.x > 40 && pop.x + pop.w < vw - 40,
            `x=${pop.x} w=${pop.w}`,
          );
          const behind = await painted(page, ".rs-grid > .rs-gcard");
          check("a mögötte lévő kártya továbbra is kifestett", behind !== null);
        }
      }
      check("a háttér elsötétül (backdrop)", (await painted(page, `#szoba-${roomA.id} .rs-backdrop`)) !== null);

      // ⑧ a Mentés RÖGZÍTETT lábazatban — a törzs görget, a lábazat nem mozdul
      const footBefore = await painted(page, `#szoba-${roomA.id} .rs-pop__foot`);
      await page.evaluate((id) => {
        const body = document.querySelector(`#szoba-${id} .rs-pop__body`)!;
        body.scrollTop = body.scrollHeight;
      }, roomA.id);
      await page.waitForTimeout(100);
      const footAfter = await painted(page, `#szoba-${roomA.id} .rs-pop__foot`);
      check(
        "a Mentés a törzs végiggörgetése UTÁN is ugyanott áll (rögzített lábazat)",
        Boolean(footBefore && footAfter && Math.abs(footBefore.y - footAfter.y) < 2),
        `${footBefore?.y} → ${footAfter?.y}`,
      );
      const saveBtn = await painted(page, `#szoba-${roomA.id} .rs-pop__foot .citui-btn--primary`);
      check("a Mentés gomb kifestve, a képernyőn belül", Boolean(saveBtn && saveBtn.y + saveBtn.h <= vh));

      // ⑨ fülek: váltás, és a számláló a fülön áll
      const tabTexts = await page.locator(`#szoba-${roomA.id} .rs-tab`).allTextContents();
      check(
        "három fül, a Képek és a Felszereltség számlálóval",
        tabTexts.length === 3 && /Képek\s*2/.test(tabTexts[1] ?? "") && /Felszereltség\s*1/.test(tabTexts[2] ?? ""),
        tabTexts.join(" | "),
      );
      check("alapból az Alapok fül szól", (await painted(page, `#szoba-${roomA.id} .rs-pane--alap`)) !== null);
      check("a Képek fül tartalma rejtve", (await painted(page, `#szoba-${roomA.id} .rs-pane--kep`)) === null);
      await page.locator(`#szoba-${roomA.id} .rs-tab--kep`).click();
      await page.waitForTimeout(120);
      check("a Képek fülre váltva AZ jelenik meg", (await painted(page, `#szoba-${roomA.id} .rs-pane--kep`)) !== null);
      check("és az Alapok eltűnik", (await painted(page, `#szoba-${roomA.id} .rs-pane--alap`)) === null);

      // ⑩ Képek fül: hero → feltöltés → képtár, ebben a sorrendben
      const hero = await painted(page, `#szoba-${roomA.id} .rs-hero`);
      const lab = await painted(page, `#szoba-${roomA.id} .rs-herolab`);
      const up = await painted(page, `#szoba-${roomA.id} .rs-upbtn`);
      const grid = await painted(page, `#szoba-${roomA.id} .rs-libgrid`);
      check("nagy borító-előnézet, rajta a felirat", Boolean(hero && lab));
      check("⛔ a feltöltés a fül TETEJÉN van (a képtár FÖLÖTT)", Boolean(up && grid && up.y < grid.y), `${up?.y} < ${grid?.y}`);
      check("a feltöltő gomb vízszintesen is a keretben", Boolean(up && up.x >= 0 && up.x + up.w <= vw));
      const libCells = await page.locator(`#szoba-${roomA.id} .rs-libcell`).count();
      check("a képtárban a ház ÖSSZES képe ott van", libCells === 4, `kapott: ${libCells}`);
      const opac = await page.evaluate((id) => {
        const out: { on: boolean; op: number }[] = [];
        for (const c of document.querySelectorAll(`#szoba-${id} .rs-libcell`)) {
          const box = c.querySelector("input") as HTMLInputElement;
          const img = c.querySelector("img")!;
          out.push({ on: box.checked, op: Number(getComputedStyle(img).opacity) });
        }
        return out;
      }, roomA.id);
      check(
        "a nem hozzárendelt képek HALVÁNYAK, a hozzárendeltek teljesek",
        opac.filter((o) => o.on).every((o) => o.op > 0.9) && opac.filter((o) => !o.on).every((o) => o.op < 0.6),
        opac.map((o) => `${o.on ? "on" : "off"}:${o.op}`).join(" "),
      );
      const covBtns = await page.locator(`#szoba-${roomA.id} .rs-libcov`).count();
      check("minden képen ott a csillag (borítóvá tesz)", covBtns === 4, `kapott: ${covBtns}`);
      // az ütközés-figyelmeztetés a Képek fülön is, a MÁSIK egység nevével
      const warnTxt = (await page.locator(`#szoba-${roomA.id} .rs-pane--kep .rs-msg--warn`).first().textContent()) ?? "";
      check("a Képek fül ütközés-figyelmeztetése megnevezi a másik egységet", /Kerti faház/.test(warnTxt), warnTxt.slice(0, 80));

      if (SHOTS) {
        await page.screenshot({ path: path.join(OUT, `re-${tag}-kepek.png`) });
      }

      // ⑪ ESC zár, háttér-kattintás zár
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      check("az ESC bezárja a felugrót", (await painted(page, `#szoba-${roomA.id} .rs-pop`)) === null);
      await cards.filter({ hasText: "Tetőtéri Appartman" }).first().click();
      await page.waitForTimeout(120);
      await page.locator(`#szoba-${roomA.id} .rs-backdrop`).click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(150);
      check("a háttérre kattintva bezár", (await painted(page, `#szoba-${roomA.id} .rs-pop`)) === null);

      // ⑫ nincs vízszintes túlcsordulás
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check("nincs vízszintes túlcsordulás", over <= 1, `${over}px`);
    });
  }

  // ── VISELKEDÉS: a borító-váltás (a terv magja) ─────────────────────────────
  console.log("\nborítókép — a csillag");
  await withPage(1280, async (page) => {
    await page.goto(`${ROOMS}&e=${roomA.id}&fl=kep#szoba-${roomA.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    const before = await getTenantContent(tenantId);
    const houseCoverBefore = before!.photos[0]!.url;
    const bCoverBefore = unitCoverPhoto(roomB.id, before!.photos)!.url;
    // a 2. kép (index 1) NINCS ehhez az egységhez rendelve → a csillag HOZZÁ IS RENDEL
    const target = photoUrls[1]!;
    await page.locator(`#szoba-${roomA.id} .rs-libcov[value="${target.replace(/"/g, '\\"')}"]`).click();
    await page.waitForLoadState("networkidle");
    const after = await getTenantContent(tenantId);
    const aCover = unitCoverPhoto(roomA.id, after!.photos);
    check("a csillag borítóvá tette a képet", aCover?.url === target);
    check(
      "a csillag HOZZÁ IS RENDELTE az egységhez",
      (after!.photos.find((p) => p.url === target)?.units ?? []).includes(roomA.id),
    );
    check("⛔ a HÁZ nyitóképe (photos[0]) változatlan", after!.photos[0]!.url === houseCoverBefore);
    check("⛔ a MÁSIK szoba borítója nem mozdult", unitCoverPhoto(roomB.id, after!.photos)?.url === bCoverBefore);
    const notice = (await page.locator(`#szoba-${roomA.id} [data-rs-notice]`).textContent()) ?? "";
    check("a felület KIMONDJA mindkét felét (borító + hozzárendelés)", /kártyáján/.test(notice) && /hozzá is rendeltem/i.test(notice), notice.slice(0, 120));
    check("a visszatérés a KÉPEK fülre esik vissza", (await painted(page, `#szoba-${roomA.id} .rs-pane--kep`)) !== null);
    // ⑬ a mögötte lévő KÁRTYA azonnal az új borítót mutatja (teljes URL-lel hasonlítva)
    const cardSrc = await page.getAttribute(`[data-rs-card="${roomA.id}"] .rs-gim img`, "src");
    check("a rács kártyája már az ÚJ borítót mutatja", cardSrc === target);
    check("és az ütközés-jelvény eltűnt a kártyáról", (await page.locator(`[data-rs-card="${roomA.id}"] .rs-b--clash`).count()) === 0);
  });

  // ── VISELKEDÉS: a levétel üzenete ──────────────────────────────────────────
  console.log("\nlevétel — mi lesz a képpel és a borítóval");
  await withPage(1280, async (page) => {
    await page.goto(`${ROOMS}&e=${roomA.id}&fl=kep#szoba-${roomA.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    const target = photoUrls[1]!; // ez MOST a borító
    await page.locator(`#szoba-${roomA.id} .rs-libcell input[value="${target}"]`).uncheck();
    await page.locator(`#szoba-${roomA.id} .rs-pop__foot .citui-btn--primary`).click();
    await page.waitForLoadState("networkidle");
    const notice = (await page.locator(`#szoba-${roomA.id} [data-rs-notice]`).textContent()) ?? "";
    check("a levétel kimondja, hogy a kép a KÖZÖS KÉPTÁRBAN marad", /közös képtárban benne marad/.test(notice), notice.slice(0, 140));
    check("és hogy a sorban következő lépett a borító helyébe", /sorban következő/.test(notice), notice.slice(0, 140));
    const after = await getTenantContent(tenantId);
    check("a kép tényleg lekerült az egységről", !(after!.photos.find((p) => p.url === target)?.units ?? []).includes(roomA.id));
    check("de a KÖZÖS képtárban ott van", after!.photos.some((p) => p.url === target));
    check("és tényleg új borítója van az egységnek", unitCoverPhoto(roomA.id, after!.photos)?.url !== target);
  });

  // ── VISELKEDÉS: a név és a férőhely EGY helyen (eddig két űrlapon) ─────────
  console.log("\nnév + férőhely a szerkesztőben");
  await withPage(1280, async (page) => {
    await page.goto(`${ROOMS}&e=${roomB.id}&fl=alap#szoba-${roomB.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    const outsideNameInputs = await page.evaluate(() =>
      [...document.querySelectorAll('input[name="name"]')].filter((el) => !el.closest(".rs-pop")).length,
    );
    check("a rácson KÍVÜL csak az ÚJ egység név-mezője él (nincs második szerkesztő-hely)", outsideNameInputs === 1, `kapott: ${outsideNameInputs}`);
    await page.fill(`#szoba-${roomB.id} input[name="name"]`, "Kerti faház (felújítva)");
    await page.fill(`#szoba-${roomB.id} input[name="capacity"]`, "3");
    // élő előnézet: a vendég-kártya gépelés közben követi
    const prev = (await page.locator(`#szoba-${roomB.id} [data-rs-prev-cap]`).textContent()) ?? "";
    check("az élő vendég-előnézet követi a férőhelyet", /3/.test(prev), prev);
    await page.locator(`#szoba-${roomB.id} .rs-pop__foot .citui-btn--primary`).click();
    await page.waitForLoadState("networkidle");
    const saved = (await getUnits(siteId)).find((u) => u.id === roomB.id)!;
    check("a név mentődött", saved.name === "Kerti faház (felújítva)", saved.name);
    check("a férőhely mentődött", saved.capacity === 3, String(saved.capacity));
  });

  // ── VISELKEDÉS: feltöltés — a hiba MEGNEVEZI a fájlt és az okot ────────────
  console.log("\nfeltöltés a szobából");
  await withPage(1280, async (page) => {
    await page.goto(`${ROOMS}&e=${roomB.id}&fl=kep#szoba-${roomB.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    const okFile = path.join(os.tmpdir(), `re-ok-${Date.now()}.png`);
    const badFile = path.join(os.tmpdir(), `re-rossz-${Date.now()}.txt`);
    tmpFiles.push(okFile, badFile);
    await writeFile(
      okFile,
      await sharp({ create: { width: 20, height: 15, channels: 3, background: { r: 10, g: 200, b: 200 } } })
        .png()
        .toBuffer(),
    );
    await writeFile(badFile, "nem kép");
    const coverBefore = unitCoverPhoto(roomB.id, (await getTenantContent(tenantId))!.photos)?.url ?? "";
    await page.setInputFiles(`#szoba-${roomB.id} input[data-rs-upload]`, [okFile, badFile]);
    await page.waitForTimeout(1200);
    await page.waitForLoadState("networkidle");
    const msg = (await page.locator(`#szoba-${roomB.id} [data-rs-notice]`).textContent()) ?? "";
    check("a feltöltés nyugtázza a KÖZÖS képtárat ÉS a hozzárendelést", /közös képtárba/.test(msg) && /hozzárendeltem/.test(msg), msg.slice(0, 160));
    check("a visszautasított fájl NEVE és OKA is kiírva", new RegExp(path.basename(badFile)).test(msg) && /nem kép/.test(msg), msg.slice(0, 200));
    const kind = await page.getAttribute(`#szoba-${roomB.id} [data-rs-notice]`, "class");
    check("részleges siker: az üzenet nem tiszta sikerként jelenik meg", /rs-msg--warn|rs-msg--bad/.test(kind ?? ""), kind ?? "");
    const after = await getTenantContent(tenantId);
    const mineB = after!.photos.filter((p) => (p.units ?? []).includes(roomB.id));
    check("a feltöltött kép a KÖZÖS képtárba került, és ehhez az egységhez is", mineB.some((p) => p.url.startsWith("/uploads/")));
    check(
      "⛔ a feltöltés NEM írta át a meglévő borítót",
      (unitCoverPhoto(roomB.id, after!.photos)?.url ?? "") === coverBefore,
      `${coverBefore.slice(0, 24)} → ${unitCoverPhoto(roomB.id, after!.photos)?.url?.slice(0, 24)}`,
    );
  });

  // ── FELSZERELTSÉG fül ──────────────────────────────────────────────────────
  console.log("\nfelszereltség");
  await withPage(390, async (page) => {
    await page.goto(`${ROOMS}&e=${whole.id}&fl=fel#szoba-${whole.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    // ÜRES egység → a katalógus RÖGTÖN nyitva (mérve: csukva 21 % kitöltöttség volt)
    const open = await page.evaluate((id) => {
      const d = document.querySelector(`#szoba-${id} .rs-amcat`) as HTMLDetailsElement | null;
      return Boolean(d?.open);
    }, whole.id);
    check("ÜRES felszereltségnél a katalógus RÖGTÖN nyitva", open);
    const tiles = await page.locator(`#szoba-${whole.id} .ampick__tile`).count();
    check("és valódi, ikonos csempék állnak benne", tiles > 20, `kapott: ${tiles}`);
    // ⛔ A kitöltöttséget a TÉNYLEGES tartalom aljával mérjük: a scrollHeight/clientHeight
    //    rövid tartalomnál 100 %-ra csuklik, tehát az ÜRES lapra is zöldet adna.
    const fill = await page.evaluate((id) => {
      const pane = document.querySelector(`#szoba-${id} .rs-pane--fel`)!;
      const r = pane.getBoundingClientRect();
      let bottom = r.top;
      for (const el of pane.querySelectorAll("*")) {
        const er = el.getBoundingClientRect();
        if (er.height > 0 && er.bottom > bottom) bottom = er.bottom;
      }
      const body = document.querySelector(`#szoba-${id} .rs-pop__body`)!.getBoundingClientRect();
      return (bottom - r.top) / body.height;
    }, whole.id);
    check("a fül nem „nagy fehér semmi” (a tartalom kitölti a dobozt)", fill > 0.6, `kitöltöttség: ${(fill * 100).toFixed(0)}%`);

    // a MÁSIK egységnek VAN tétele → szerver-oldali csempesor, csukott katalógus
    await page.goto(`${ROOMS}&e=${roomA.id}&fl=fel#szoba-${roomA.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    const chips = await page.locator(`#szoba-${roomA.id} .rs-ams .rs-am`).count();
    check("a kiválasztott tétel KOMPAKT csempeként áll (nem 70 tételes rácsként)", chips === 1, `kapott: ${chips}`);
    const catOpen = await page.evaluate((id) => {
      const d = document.querySelector(`#szoba-${id} .rs-amcat`) as HTMLDetailsElement | null;
      return Boolean(d?.open);
    }, roomA.id);
    check("ahol már van tétel, a katalógus CSUKVA indul", !catOpen);
    const icon = await page.locator(`#szoba-${roomA.id} .rs-ams .rs-am svg`).count();
    check("a csempe a katalógus VALÓDI ikonját viseli", icon === 1, `kapott: ${icon}`);
  });

  // ── MODUL NÉLKÜL: ajánlat, nem hibaüzenet (ADR-0074 §5) ───────────────────
  console.log("\nfelszereltség modul nélkül");
  await db
    .updateTable("module_entitlement")
    .set({ active: false })
    .where("tenant_id", "=", tenantId as never)
    .where("module", "=", "amenities" as never)
    .execute();
  await withPage(390, async (page) => {
    await page.goto(`${ROOMS}&e=${roomA.id}&fl=fel#szoba-${roomA.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    check("a fül helyén KONVERZIÓS panel áll", (await painted(page, `#szoba-${roomA.id} .amlock`)) !== null);
    const inputs = await page.evaluate(
      (id) => document.querySelectorAll(`#szoba-${id} .rs-pane--fel input, #szoba-${id} .rs-pane--fel textarea`).length,
      roomA.id,
    );
    check("⛔ nincs szerkeszthető vezérlő a meg nem vett modulhoz", inputs === 0, `kapott: ${inputs}`);
    const txt = (await page.locator(`#szoba-${roomA.id} .amlock`).textContent()) ?? "";
    check("ajánlat, nem hibaüzenet (a bekapcsolás útja is ott van)", /bekapcsolás/i.test(txt), txt.slice(0, 90));
    // ⛔ A katalógus VALÓDI számai (nem beégetve): a maradék tételek és a kategóriák száma.
    const { AMENITY_CATALOG, AMENITY_CATEGORIES } = await import("../src/tenant/amenityCatalog.js");
    check(
      "a panel a katalógus VALÓDI számait írja",
      txt.includes(String(AMENITY_CATALOG.length - 8)) && txt.includes(String(AMENITY_CATEGORIES.length)),
      txt.slice(-90),
    );
    const tiles = await page.locator(`#szoba-${roomA.id} .amlock .ampick__tile`).count();
    check("és VALÓDI, halvány csempéket mutat (nem üres ígéretet)", tiles >= 4, `kapott: ${tiles}`);
    // a másik két fül attól még teljes értékű
    await page.locator(`#szoba-${roomA.id} .rs-tab--kep`).click();
    await page.waitForTimeout(120);
    check("a Képek fül változatlanul szerkeszthető marad", (await painted(page, `#szoba-${roomA.id} .rs-libgrid`)) !== null);
  });
  await db
    .updateTable("module_entitlement")
    .set({ active: true })
    .where("tenant_id", "=", tenantId as never)
    .where("module", "=", "amenities" as never)
    .execute();

  // ── JS NÉLKÜL: a felület nem veszít funkciót ───────────────────────────────
  console.log("\nJS nélkül");
  await withPage(
    390,
    async (page) => {
      await page.goto(`${ROOMS}#szoba-${roomA.id}`, { waitUntil: "networkidle" });
      check("JS nélkül is FELUGRIK a szerkesztő (:target)", (await painted(page, `#szoba-${roomA.id} .rs-pop`)) !== null);
      check("JS nélkül is az Alapok fül szól", (await painted(page, `#szoba-${roomA.id} .rs-pane--alap`)) !== null);
      // a fül rádió-gomb + label: JS nélkül is vált
      await page.locator(`#szoba-${roomA.id} .rs-tab--kep`).click();
      await page.waitForTimeout(100);
      check("JS nélkül is VÁLT a fül (rádió + CSS)", (await painted(page, `#szoba-${roomA.id} .rs-pane--kep`)) !== null);
      check("JS nélkül a képtár is ott van", (await painted(page, `#szoba-${roomA.id} .rs-libgrid`)) !== null);
      // és a mentés: sima űrlap-POST. A rejtett fül mezői is elmennek vele — ezért
      // az Alapok fülön beírt leírás akkor is mentődik, ha a Képek fülről ment.
      await page.locator(`#szoba-${roomA.id} .rs-tab--alap`).click();
      await page.waitForTimeout(100);
      await page.fill(`#szoba-${roomA.id} textarea[name="description"]`, "JS nélkül mentett leírás.");
      await page.locator(`#szoba-${roomA.id} .rs-tab--kep`).click();
      await page.waitForTimeout(100);
      await page.locator(`#szoba-${roomA.id} .rs-pop__foot .citui-btn--primary`).click();
      await page.waitForLoadState("networkidle");
      const saved = (await getUnits(siteId)).find((u) => u.id === roomA.id)!;
      check("JS nélkül is MENT az űrlap", saved.description === "JS nélkül mentett leírás.", saved.description ?? "");
    },
    { js: false, label: "JS nélkül" },
  );

  // ── NEGATÍV KONTROLLOK — ami nem tud pirosra menni, az nem őr ──────────────
  console.log("\nnegatív kontrollok (a visszarontott állapoton PIROSNAK kell lennie)");
  await withPage(390, async (page) => {
    await page.goto(`${ROOMS}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    // ① a specificitás-ütközés visszaállítva: a leíró szabály megeszi a jelvény színét
    await page.addStyleTag({ content: ".rs-gbd span{color:var(--citui-muted) !important}" });
    const c = await page.evaluate(() => {
      const b = document.querySelector(".rs-gbd > .rs-b")!;
      return getComputedStyle(b).color;
    });
    const mutedNeg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--citui-muted").trim());
    const cc = parseColor(c)!;
    const mm = parseColor(mutedNeg) ?? [96, 116, 139];
    mustFail(
      "a státusz-jelvény NEM csúszott a semleges szürkére",
      Math.abs(cc[0] - mm[0]) + Math.abs(cc[1] - mm[1]) + Math.abs(cc[2] - mm[2]) > 30,
      c,
    );
    // ② nowrap → a hosszú jelvény-szöveg levágódik
    await page.addStyleTag({ content: ".rs-b{white-space:nowrap !important}" });
    await page.waitForTimeout(80);
    const clippedNeg = await page.evaluate(() => {
      let bad = 0;
      for (const b of document.querySelectorAll(".rs-b")) {
        const card = b.closest(".rs-gcard");
        if (!card) continue;
        if (b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > card.getBoundingClientRect().right + 1) bad++;
      }
      return bad;
    });
    mustFail("egyetlen kártya-felirat sincs levágva", clippedNeg === 0, `levágva: ${clippedNeg}`);
  });
  await withPage(390, async (page) => {
    await page.goto(`${ROOMS}#szoba-${roomA.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    // ③ a felugró kitölti a keretet → már nem felugró, hanem másik oldal
    await page.addStyleTag({ content: ".rs-pop{left:0 !important;right:0 !important;top:0 !important;bottom:0 !important}" });
    await page.waitForTimeout(80);
    const p = (await painted(page, `#szoba-${roomA.id} .rs-pop`))!;
    mustFail("mobilon látható keret marad a felugró körül", p.x >= 4 && p.x + p.w <= 390 - 4 && p.y >= 4, `x=${p.x} y=${p.y}`);
    // ④ a lábazat együtt görög a törzzsel → a Mentés elúszik
    await page.addStyleTag({
      content: `#szoba-${roomA.id} .rs-pop{display:block !important;overflow:auto !important}` +
        `#szoba-${roomA.id} .rs-pop__body{overflow:visible !important}`,
    });
    await page.waitForTimeout(80);
    const fb = await painted(page, `#szoba-${roomA.id} .rs-pop__foot`);
    await page.evaluate((id) => {
      const el = document.querySelector(`#szoba-${id} .rs-pop`)!;
      el.scrollTop = el.scrollHeight;
    }, roomA.id);
    await page.waitForTimeout(100);
    const fa = await painted(page, `#szoba-${roomA.id} .rs-pop__foot`);
    mustFail(
      "a Mentés a törzs végiggörgetése UTÁN is ugyanott áll",
      Boolean(fb && fa && Math.abs(fb.y - fa.y) < 2),
      `${fb?.y} → ${fa?.y}`,
    );
  });
  await withPage(1280, async (page) => {
    await page.goto(`${ROOMS}#szoba-${roomA.id}`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    // ⑤ asztalin a felugró elborítja a listát
    await page.addStyleTag({ content: ".rs-pop{width:100% !important;left:0 !important;transform:none !important}" });
    await page.waitForTimeout(80);
    const p = (await painted(page, `#szoba-${roomA.id} .rs-pop`))!;
    mustFail("asztalin a RÁCS látszik mögötte", p.x > 40 && p.x + p.w < 1280 - 40, `x=${p.x} w=${p.w}`);
    // ⑥ a halványítás kikapcsolva → nem látszik, mi tartozik ide
    await page.locator(`#szoba-${roomA.id} .rs-tab--kep`).click();
    await page.addStyleTag({ content: ".rs-libcell img{opacity:1 !important}" });
    await page.waitForTimeout(80);
    const opac = await page.evaluate((id) => {
      const out: { on: boolean; op: number }[] = [];
      for (const c of document.querySelectorAll(`#szoba-${id} .rs-libcell`)) {
        const box = c.querySelector("input") as HTMLInputElement;
        out.push({ on: box.checked, op: Number(getComputedStyle(c.querySelector("img")!).opacity) });
      }
      return out;
    }, roomA.id);
    mustFail(
      "a nem hozzárendelt képek HALVÁNYAK",
      opac.filter((o) => !o.on).every((o) => o.op < 0.6),
      opac.map((o) => `${o.on ? "on" : "off"}:${o.op}`).join(" "),
    );
  });
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const f of tmpFiles) await rm(f, { force: true }).catch(() => {});
  // a fixture MINDENT visz magával: DB-sorok + a tenant saját fájljai
  if (tenantId) await rm(path.resolve(process.cwd(), "sites", tenantId), { recursive: true, force: true }).catch(() => {});
  if (siteId) {
    await db.deleteFrom("availability_day").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", siteId as never)).execute().catch(() => {});
    await db.deleteFrom("site_unit").where("site_id", "=", siteId as never).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", siteId as never).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", siteId as never).execute().catch(() => {});
  }
  if (tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", tenantId as never).execute().catch(() => {});
    await db.deleteFrom("tenant_user").where("tenant_id", "=", tenantId as never).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", tenantId as never).execute().catch(() => {});
  }
  if (leadId) {
    await db.deleteFrom("mock_artifact").where("lead_id", "=", leadId as never).execute().catch(() => {});
    await db.deleteFrom("lead").where("id", "=", leadId as never).execute().catch(() => {});
  }
  await db.destroy().catch(() => {});
}

console.log("");
if (failures.length) {
  console.log(`⛔ room-editor-check: ${failures.length} bukás`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
console.log("✅ room-editor-check: a jóváhagyott szoba-szerkesztő kontraktusa áll (ADR-0198).");
// ⛔ KIMONDOTT KILÉPÉS. A mérés a termék SAJÁT HTTP-szerverét indítja el (import
// mellékhatás), és az figyelő foglalatként ÉLETBEN TARTJA a folyamatot: a kiírt zöld
// verdikt után a szkript egyszerűen nem lépett ki. Kézzel futtatva ez csak furcsa
// (a `timeout` 124-gyel ölte meg), a pre-commit kapu-sorban viszont VÉGTELEN VÁRAKOZÁS
// — a commit sosem fejeződik be, és semmi nem mondja meg, miért (mérve 2026-09-22).
process.exit(0);
