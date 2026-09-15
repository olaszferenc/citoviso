// KONZOL-KONTRASZT őr — a jelentés-vivő felirat OLVASHATÓ legyen (tulajdonosi döntés,
// 2026-09-15; terv: assets/design-refs/console/semantic-contrast/).
//
//   npx tsx scripts/console-contrast-check.mts [--self-test] [--all]
//
// ⛔⛔ MÉRT HIBA (2026-09-14/15). A konzol jelzés-színeit FELIRATNAK is használtuk, és
// világos háttéren egyik sem olvasható a 4,5-ös küszöb szerint:
//     --citui-ok      #2fa96b → 3,00  (a „Fizetek ▸" és a „Jóváhagyás" GOMB, .q-good)
//     --citui-bad     #e5484d → 3,91  (.con button.bad, .pg-head, .q-bad)
//     --citui-warn    #d29922 → 2,52  (.q-mid, „elavult" jelvény)
//     --citui-cyan-500 #1fb6d6 → 2,41 (MINDEN link a konzolon)
//     --citui-info (= cián)   → 2,15  (.pill.generated/.sent, a saját tintjén)
// 4 lapon mérve 1074 szöveg-elemből 318 volt a küszöb alatt. A döntő gomb feliratát
// nehéz elolvasni — és a gépi „látható-e" próba közben IGAZAT mondott, mert az a DOM-ot
// kérdezi, nem a szemet.
//
// ⚠️ EZ AZ ŐR NEM FIXTURE-ÖN MÉR. A RENDERELT konzol-lapokat nyitja meg valódi
// Chromiumban, és MINDEN szöveget hordozó elemre kiszámolja a kontrasztot —
// ALFA-KOMPOZITÁLVA (a féligáttetsző háttér és a féligáttetsző felirat is számít; a
// kontrasztot az opacityvel EGYÜTT kell mérni).
//
// ⛔ KIMONDOTT KIVÉTEL, nem néma elnyelés: a `--citui-muted` másodlagos szöveg
// (4,37–4,81 a háttértől függően) TULAJDONOSI DÖNTÉSSEL marad — a token átütne a
// tenant-adminra és a vendég-oldalra is. Az őr ezt NÉVVEL engedi át, MEGSZÁMOLJA, és
// KIÍRJA, hány elem ül benne. Ami nem ebben a névsorban van, az bukás.

import { once } from "node:events";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { mintOperatorCookieValue } from "../src/auth/operatorAuth.js";
import { db } from "../src/db/client.js";

const selfTest = process.argv.includes("--self-test");

let fails = 0;
const check = (cond: boolean, msg: string, why = ""): void => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${msg}${cond || !why ? "" : `\n       → ${why}`}`);
};

/** A küszöb. Nagy betűnél (≥24px, vagy ≥18,66px és félkövér) 3,0 — ezt a mérés dönti el. */
const AA = 4.5;

/**
 * KIMONDOTT KIVÉTEL — a tulaj döntése szerint a másodlagos szürke marad.
 * ⛔ A kivétel SZÍNRE szól, nem elemre: így egy új felület, ami ezt a tokent használja,
 * automatikusan benne van — de bármi MÁS szín azonnal bukik. A számát kiírjuk, hogy a
 * „maradék" ne tűnjön el a szőnyeg alá.
 */
const ALLOWED = [
  { color: "rgb(96, 116, 139)", token: "--citui-muted", why: "másodlagos szöveg — tulajdonosi döntés, 2026-09-15 (a token átütne a tenant-adminra és a vendég-oldalra)" },
];

/**
 * ⛔ AMIT NEM MÉRÜNK, ÉS MIÉRT (§B.17 — csak arról állítunk, amit megmértünk):
 * `<option>`: a legördülő listát a böngésző SAJÁT felülete festi, az elem DOM-háttere
 * átlátszó (mérve: `rgba(0,0,0,0)`), tehát a DOM-ból számolt érték nem az, amit a
 * felhasználó lát. Egy ilyen elemre mondott piros a mérőeszköz hibája lenne, nem leleté.
 */
const SKIP_TAGS = new Set(["option", "optgroup", "script", "style", "title", "noscript"]);

interface Hit {
  lap: string; tag: string; cls: string; color: string; bg: string;
  /** Amit a SZEM lát (az ős-opacitykkel együtt kompozitálva). */
  cr: number;
  /** Ugyanaz a felirat TOMPÍTÁS NÉLKÜL. Ez választja szét a rossz SZÍNT a szándékos
   *  ki-/kikapcsolt állapottól — és zárja a kiskaput: rossz alapszínt nem lehet egy
   *  `opacity`-vel „szándékosnak" álcázni. */
  crBase: number;
  /** Az ősöktől örökölt szorzott opacity (1 = nincs tompítás). */
  dim: number;
  thr: number; px: number; w: number; txt: string;
}

/** A mérés a lapon belül fut — ez a forrása. A `parse` KÉT szín-alakot ismer (lásd lent). */
const MEASURE = `(() => {
  // ⛔⛔ KÉT SZÍN-ALAK, KÉT SKÁLA. A böngésző a color-mix() eredményét
  // \`color(srgb 0.99 0.95 0.95)\` alakban adja (0..1), a többit \`rgb(229,72,77)\`-ként
  // (0..255). Ezt a kettőt egyszer már összemostam, és a tökéletesen olvasható prózát
  // 1,22-vel „bukónak" mondta MINDEN felületen. A skálát a SZINTAXIS dönti el.
  function parse(c){
    c = c || '';
    var m = c.match(/-?[\\d.]+(?:e-?\\d+)?/g) || [];
    var k = /^color\\(\\s*srgb/i.test(c) ? 255 : 1;
    return { r:+m[0]*k, g:+m[1]*k, b:+m[2]*k, a: m.length > 3 ? +m[3] : 1 };
  }
  function over(f, b){ var a = f.a; return { r:f.r*a+b.r*(1-a), g:f.g*a+b.g*(1-a), b:f.b*a+b.b*(1-a), a:1 }; }
  // A HÁTTÉR FELFELÉ keresendő, az első ÁTLÁTSZATLAN ősig — és ott meg kell állni.
  // Gradiens ősnél NULL: azt nem tudjuk kiszámolni, tehát nem állítunk róla semmit.
  function effBg(el){
    var stack = [];
    for (var n = el; n; n = n.parentElement){
      var cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none') return null;
      var c = parse(cs.backgroundColor);
      if (c.a > 0){ stack.push(c); if (c.a >= 1) break; }
    }
    var acc = { r:255, g:255, b:255, a:1 };
    for (var i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  }
  function lum(c){
    function f(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
  }
  var SKIP = __SKIP__;
  var out = [];
  document.querySelectorAll('*').forEach(function(el){
    if (SKIP.indexOf(el.tagName.toLowerCase()) >= 0) return;
    var hasText = false;
    el.childNodes.forEach(function(n){ if (n.nodeType === 3 && n.textContent.trim().length > 1) hasText = true; });
    if (!hasText) return;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    var bg = effBg(el); if (!bg) return;
    // ⛔ AZ OPACITY IS SZÁMÍT: egy 0,6-os opacityjű szöveg ténylegesen a háttérrel
    // keveredik. A kontrasztot a KOMPOZITÁLT értéken mérjük, nem a deklaráltan.
    var op = 1, node = el;
    for (var m = el; m && m !== document.documentElement; m = m.parentElement){
      var o = parseFloat(getComputedStyle(m).opacity);
      if (!isNaN(o)) op *= o;
    }
    function ratio(f, b){
      var L1 = lum(f), L2 = lum(b);
      var hi = Math.max(L1, L2), lo = Math.min(L1, L2);
      return (hi + 0.05) / (lo + 0.05);
    }
    var base = parse(cs.color);
    // A SAJÁT alfája (rgba) mindig számít — az a szín része.
    var baseC = base.a < 1 ? over(base, bg) : base;
    // A LÁTOTT szín: az ős-opacityk is rákeverik a háttérre.
    var fg = { r: base.r, g: base.g, b: base.b, a: base.a * op };
    if (fg.a < 1) fg = over(fg, bg);
    var cr = ratio(fg, bg);
    var crBase = ratio(baseC, bg);
    var px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400;
    var large = px >= 24 || (px >= 18.66 && w >= 700);
    out.push({
      tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 30),
      color: 'rgb(' + [baseC.r, baseC.g, baseC.b].map(Math.round).join(', ') + ')',
      bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')',
      cr: +cr.toFixed(2), crBase: +crBase.toFixed(2), dim: +op.toFixed(2),
      thr: large ? 3 : 4.5, px: +px.toFixed(1), w: w,
      txt: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40)
    });
  });
  return out;
})()`;

async function main(): Promise<void> {
  process.env.CIT_SHOT = "1";
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
  if (!op) {
    console.error("⛔ nincs operator_user a DB-ben — az őr nem tud belépni, és a nulla mérésre írt pipa semmit nem jelentene");
    process.exit(1);
  }
  const art = await db.selectFrom("mock_artifact").select("lead_id").limit(1).executeTakeFirst();

  const ROUTES: [string, string][] = [
    ["/", "irányítópult"],
    ["/leads", "leadek"],
    ["/pricing", "árazás"],
    ["/settings", "beállítások"],
    ["/scrape", "begyűjtés"],
    ["/documents", "dokumentumok"],
    ["/partners", "partnerek"],
    ["/duplicates", "duplikátumok"],
    ["/help", "súgó"],
    ...(art ? ([[`/lead/${art.lead_id}`, "lead-lap"]] as [string, string][]) : []),
  ];

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const hits: Hit[] = [];
  let measured = 0;
  const skippedRoutes: string[] = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([
      { name: "cit_op_session", value: mintOperatorCookieValue(op.id as string), domain: "127.0.0.1", path: "/" },
    ]);
    const js = MEASURE.replace("__SKIP__", JSON.stringify([...SKIP_TAGS]));
    for (const [route, name] of ROUTES) {
      // MINDKÉT MÉRET: a tulaj telefonon dolgozik, és a tördelés más hátteret adhat
      // egy feliratnak (ADR-0149 — a méret-specifikus lelet ÖNÁLLÓ lelet).
      for (const w of [390, 1280]) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width: w, height: 1000 });
        const r = await p.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "networkidle" });
        if (!r || r.status() >= 400) {
          if (w === 390) skippedRoutes.push(`${name} (HTTP ${r?.status() ?? "?"})`);
          await p.close();
          continue;
        }
        // A rejtett fülek/összecsukott blokkok feliratai is a kurátor elé kerülnek.
        await p.evaluate(`document.querySelectorAll('[hidden]').forEach(e=>e.hidden=false);
                          document.querySelectorAll('details').forEach(d=>d.open=true);`);
        if (selfTest) {
          // ⛔ ÖNTESZT: visszaállítjuk a NYERS jelzés-színeket a feliratokra. Az őrnek
          // ettől pirosra kell mennie — különben nem a renderelt lapból dolgozik.
          await p.evaluate(`(() => {
            const r = document.documentElement.style;
            r.setProperty('--citui-ok-ink',   getComputedStyle(document.documentElement).getPropertyValue('--citui-ok'));
            r.setProperty('--citui-bad-ink',  getComputedStyle(document.documentElement).getPropertyValue('--citui-bad'));
            r.setProperty('--citui-warn-ink', getComputedStyle(document.documentElement).getPropertyValue('--citui-warn'));
            r.setProperty('--citui-link-ink', getComputedStyle(document.documentElement).getPropertyValue('--citui-cyan-500'));
          })()`);
          await p.waitForTimeout(350); // a `transition` miatt a szín ANIMÁL — a pixelre várunk
        }
        for (const h of (await p.evaluate(js)) as Omit<Hit, "lap">[]) {
          measured++;
          if (h.cr < h.thr) hits.push({ lap: `${name}@${w}`, ...h });
        }
        await p.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n① Lefedettség`);
  check(measured > 1500, `${measured} szöveg-elem megmérve ${ROUTES.length} útvonalon, 390 ÉS 1280 px-en`,
    "kevés mérés = a zöld semmit nem jelentene");
  if (skippedRoutes.length) {
    console.log(`  ⏭️  KIMARADT útvonal: ${skippedRoutes.join(" · ")} — ezekről nem állítunk semmit.`);
  }

  // ── HÁROM CSOPORT, mind KIMONDVA ─────────────────────────────────────────
  // ① a tulaj által engedett szín · ② szándékosan TOMPÍTOTT (ki-/kikapcsolt) elem,
  // aminek az ALAPSZÍNE olvasható · ③ minden más = bukás.
  const isAllowedColor = (h: Hit): boolean => ALLOWED.some((a) => a.color === h.color);
  // ⚠️ KÉT KÜLÖN KÉRDÉS, KÉT KÜLÖN VÁLASZ. A tulaj a SZÍNRŐL döntött (a szürke marad),
  // a tompítás viszont ÁLLAPOT (ki-/kikapcsolt elem). Egy szürke, RÁADÁSUL tompított
  // felirat mindkettő — ezért a szín-kivétel mérőszáma a TOMPÍTATLAN érték (arról szólt
  // a döntés), a tompítás pedig külön sorban jelenik meg. Így egyik sem tünteti el a másikat.
  const allowed = hits.filter((h) => isAllowedColor(h));
  // ⛔ A TOMPÍTÁS NEM KISKAPU: csak akkor engedjük, ha a felirat tompítás NÉLKÜL
  // átmenne. Egy olvashatatlan alapszínt egy `opacity`-vel nem lehet „szándékosnak"
  // álcázni — az a ③ csoportba esik, és bukik.
  const dimmed = hits.filter((h) => !isAllowedColor(h) && h.dim < 1 && h.crBase >= h.thr);
  const offenders = hits.filter((h) => !isAllowedColor(h) && !(h.dim < 1 && h.crBase >= h.thr));

  console.log(`\n② A kimondott kivétel (tulajdonosi döntés — NEM néma elnyelés)`);
  for (const a of ALLOWED) {
    const n = allowed.filter((h) => h.color === a.color).length;
    console.log(`  ⚠️  ${a.token} ${a.color}: ${n} elem a küszöb alatt — ${a.why}`);
  }
  const worstAllowed = allowed.length ? Math.min(...allowed.map((h) => h.crBase)) : null;
  if (worstAllowed !== null) {
    console.log(`      a SZÍNÜK legrosszabb értéke: ${worstAllowed.toFixed(2)} (a küszöb ${AA})`);
    const alsoDim = allowed.filter((h) => h.dim < 1);
    if (alsoDim.length) {
      console.log(`      ebből ${alsoDim.length} RÁADÁSUL tompított is (ki-/kikapcsolt állapot) — a szem ${Math.min(...alsoDim.map((h) => h.cr)).toFixed(2)}-ot lát rajtuk`);
    }
    // ⛔ A kivétel NEM korlátlan: ha a szürke valaha BEROMLIK, azt meg kell tudni.
    // A kivétel arról szólt, hogy „a határon van", nem arról, hogy „bármi lehet".
    check(worstAllowed >= 4.0,
      `a kivétel HATÁRON marad (a szín legrosszabb értéke ${worstAllowed.toFixed(2)} ≥ 4,0)`,
      "a tulaj azt engedte át, ami épphogy a küszöb alatt van — nem egy tetszőlegesen romló tokent");
  }

  console.log(`\n②b Szándékosan TOMPÍTOTT (ki-/kikapcsolt) elemek`);
  if (dimmed.length) {
    const byCls = new Map<string, Hit[]>();
    for (const h of dimmed) (byCls.get(`${h.tag}.${h.cls}`) ?? byCls.set(`${h.tag}.${h.cls}`, []).get(`${h.tag}.${h.cls}`)!).push(h);
    for (const [cls, g] of byCls) {
      const s = g[0]!;
      console.log(`  ⚠️  ${cls} · ${g.length} elem · látott ${Math.min(...g.map((x) => x.cr))} · TOMPÍTÁS NÉLKÜL ${s.crBase} (opacity ${s.dim}) — „${s.txt}"`);
    }
    console.log(`      Ez a ház SAJÁT szabálya: a tiltott/kikapcsolt elem NÉZZEN KI tiltottnak.`);
    console.log(`      Az alapszínük olvasható, tehát nem szín-hiba — de ki van írva, nem elnyelve.`);
  } else {
    console.log(`  (nincs ilyen elem ebben a futásban)`);
  }

  console.log(`\n③ A jelentés-vivő feliratok olvashatók`);
  if (offenders.length) {
    const byColor = new Map<string, Hit[]>();
    for (const h of offenders) (byColor.get(h.color) ?? byColor.set(h.color, []).get(h.color)!).push(h);
    for (const [color, g] of [...byColor.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const s = g[0]!;
      console.log(`     ${color} · ${g.length} elem · legrosszabb ${Math.min(...g.map((x) => x.cr))}`);
      console.log(`       pl. ${s.lap} · <${s.tag} class="${s.cls}"> ${s.px}px/${s.w} a ${s.bg} háttéren — „${s.txt}"`);
    }
  }
  check(offenders.length === 0,
    `EGYETLEN jelentés-vivő felirat sincs a küszöb alatt (${offenders.length} találat)`,
    "ezek olyan színek, amikre a tulaj NEM adott kivételt");

  await db.destroy();
}

console.log(`KONZOL-KONTRASZT őr${selfTest ? " — ÖNTESZT (visszaállítottuk a nyers jelzés-színeket)" : ""}`);
await main();

if (selfTest) {
  if (fails) {
    console.log(`\n✅ önteszt: az őr PIROSRA ment a nyers színekkel (${fails} bukás) — a renderelt lapból dolgozik.`);
    process.exit(0);
  }
  console.error("\n⛔ önteszt: az őr ZÖLD maradt, pedig a feliratok visszakapták az olvashatatlan színt — nem a renderelt lapot méri.");
  process.exit(1);
}
if (fails) {
  console.error(`\n⛔ console-contrast: ${fails} bukás`);
  process.exit(1);
}
console.log("\n✅ console-contrast: minden jelentés-vivő felirat olvasható; a kivétel kimondott és megszámolva.");
process.exit(0);
