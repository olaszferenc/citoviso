// ⛔ EGY GOMB-OSZTÁLY, AMIHEZ NINCS SZABÁLY, NÉMÁN AZ ELLENKEZŐJÉT CSINÁLJA.
//
// A konzolban hat helyen állt `class="ghost"` — a szándék „halvány, másodlagos" —, de a
// `.ghost`-hoz EGYETLEN CSS-szabály sem tartozott. A submit-gombokra így a navy
// gradiens ült rá, vagyis a „másodlagos" gomb ELSŐDLEGESNEK látszott. MÉRVE
// (2026-09-15, valódi konzol): a lead-lapon 2 ilyen gomb, a `/duplicates`-en pedig a
// HÁROM válaszból KETTŐ — az „Ugyanaz — összevonás" (ami lead-rekordokat VON ÖSSZE)
// semmiben nem különbözött a másik két verdikttől.
//
// Amit ez az őr a VALÓDI konzolon, 390 és 1280 px-en mér:
//   ① NINCS HALOTT GOMB-OSZTÁLY. Minden osztály, amit egy konzol-gomb visel, vagy FEST
//      (van rá szabály a BETÖLTÖTT stíluslapokban — nem forrás-grepből, mert egy
//      szabály, ami nem jut el a böngészőig, nem szabály), vagy HORGONY (a lap saját
//      szkriptje `querySelector`-ral hivatkozik rá). Ami egyik sem: halott. Ez a
//      lényeg — nem a `ghost`-ot őrizzük, hanem a HIBAOSZTÁLYT. Rögtön talált is egy
//      másodikat: a `.gen-go`-t — az viszont VALÓDI horgony, ezért nem bukás.
//   ② A `ghost` SOHA nem elsődleges: a kirajzolt háttere nem gradiens.
//   ③ A másodlagos gomb OLVASHATÓ marad: felirat/háttér kontraszt ≥ 4.5. A „halvány"
//      nem jelentheti azt, hogy „nem látszik" (a ház ezt már megfizette egy cián
//      gradiensre festett cián gombbal).
//   ④ A duplikátum-lap döntés-sorában PONTOSAN EGY elsődleges gomb van — ott három
//      válasz közül az egyik összevon.
//
// Piros önteszt (`--self-test`): a betöltött lapon visszaadjuk a `ghost`-nak a navy
// gradienst (pontosan az az állapot, ami 2026-09-15 előtt élt), és az őrnek pirosra
// kell mennie. A termék forrásához nem nyúlunk.
//
// Használat: npx tsx scripts/button-weight-check.mts [--self-test]

import { once } from "node:events";
import type { Server } from "node:http";

import { chromium, type Browser } from "playwright-core";

import { config } from "../src/config.js";

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";

const SELF_TEST = process.argv.includes("--self-test");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`  ✅ ${what}`);
  else {
    failed++;
    console.error(`  ❌ ${what}${detail ? ` — ${detail}` : ""}`);
  }
};

/**
 * ⛔ A KIVÉTEL SZERKEZETI, NEM SZÓLISTA. Egy gomb-osztály akkor jogos szabály nélkül, ha
 * JS-HORGONY: a lap saját szkriptje `querySelector('button.xy')`-ként hivatkozik rá. Ezt
 * a mérés a lapról olvassa ki (lásd MEASURE_JS `hooks`), nem egy kézzel karbantartott
 * listából — így a KÖVETKEZŐ horgonyhoz nem kell hozzányúlni az őrhöz, a következő
 * HALOTT osztály viszont fennakad. (Az első változatom szólistát használt, és rögtön
 * bele is futott: a `.gen-go` valódi horgony, nem szemét.)
 * Ide csak az kerül, ami se nem fest, se nem horgony — ilyet ma nem ismerünk.
 */
const NO_RULE_OK: Readonly<Record<string, string>> = {};

const VIEWPORTS = [
  { tag: "mobil 390px", width: 390, height: 844 },
  { tag: "asztali 1280px", width: 1280, height: 900 },
] as const;

async function bootConsole(): Promise<{ port: number; cookie: string }> {
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { db } = await import("../src/db/client.js");
  const op =
    (await db
      .selectFrom("operator_user")
      .select("id")
      .where("username", "=", "claude-test")
      .executeTakeFirst()) ??
    (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());
  if (!op) throw new Error("nincs operator_user a dev DB-ben");
  return { port: addr.port, cookie: mintOperatorCookieValue(op.id) };
}

/** A mérés a lapon belül — STRING alakban (a tsx keepNames-e miatt, lásd a többi őrt). */
const MEASURE_JS = `(() => {
  /* sRGB relatív fényesség + WCAG kontraszt — a „halvány" nem lehet olvashatatlan */
  const lum = (c) => {
    const m = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  };
  const contrast = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  /* Van-e EGYÁLTALÁN szabály erre az osztályra? A BETÖLTÖTT stíluslapokból olvassuk,
     nem forrás-grepből: egy szabály, ami nem jut el a böngészőig, nem szabály. */
  const classesWithRules = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    const walk = (list) => {
      for (const r of list) {
        if (r.selectorText) {
          for (const m of r.selectorText.matchAll(/\\.([A-Za-z0-9_-]+)/g)) classesWithRules.add(m[1]);
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    walk(rules);
  }
  /* A gomb hátterét az ős is adhatja (átlátszó gomb): a TÉNYLEGESEN látható hátteret
     keressük felfelé, különben a kontraszt egy láthatatlan színhez mérődne. */
  const effBg = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) return bg;
    }
    return "rgb(255, 255, 255)";
  };
  /* JS-HORGONYOK: amire a lap saját szkriptje osztály-szelektorral hivatkozik. */
  const hooks = new Set();
  for (const sc of document.querySelectorAll("script")) {
    const txt = sc.textContent || "";
    for (const m of txt.matchAll(/querySelector(?:All)?\\(\\s*['"\`][^'"\`]*?\\.([A-Za-z0-9_-]+)/g)) hooks.add(m[1]);
  }
  for (const el of document.querySelectorAll("[onsubmit],[onclick]")) {
    const txt = (el.getAttribute("onsubmit") || "") + " " + (el.getAttribute("onclick") || "");
    for (const m of txt.matchAll(/querySelector(?:All)?\\(\\s*['"\`][^'"\`]*?\\.([A-Za-z0-9_-]+)/g)) hooks.add(m[1]);
  }
  const out = [];
  for (const b of document.querySelectorAll(".con button")) {
    const cs = getComputedStyle(b);
    const classes = (b.className || "").toString().trim().split(/\\s+/).filter(Boolean);
    out.push({
      label: (b.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40),
      classes: classes,
      dead: classes.filter((c) => !classesWithRules.has(c) && !hooks.has(c)),
      hooks: classes.filter((c) => !classesWithRules.has(c) && hooks.has(c)),
      primary: cs.backgroundImage.indexOf("gradient") >= 0,
      contrast: Math.round(contrast(cs.color, effBg(b)) * 100) / 100,
      color: cs.color,
      bg: effBg(b),
    });
  }
  const dupRow = document.querySelector(".dup-actions");
  return {
    buttons: out,
    dupPrimaries: dupRow
      ? Array.from(dupRow.querySelectorAll("button")).filter(
          (x) => getComputedStyle(x).backgroundImage.indexOf("gradient") >= 0,
        ).length
      : null,
    dupTotal: dupRow ? dupRow.querySelectorAll("button").length : null,
  };
})()`;

/** A 2026-09-15 ELŐTTI állapot visszaadása: a ghost megint elsődlegesnek látszik. */
const POISON_JS = `(() => {
  const st = document.createElement("style");
  st.textContent = ".con button.ghost, .con button.ghost[type=submit]" +
    "{background:linear-gradient(120deg,#0e2a47,#203a59) !important;color:#fff !important;border-color:transparent !important}";
  document.head.appendChild(st);
})()`;

async function measureRoute(
  browser: Browser,
  origin: string,
  cookie: string,
  route: string,
  vp: (typeof VIEWPORTS)[number],
  poison: boolean,
): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies([{ name: "cit_op_session", value: cookie, url: origin }]);
  const page = await ctx.newPage();
  const res = await page.goto(`${origin}${route}`, { waitUntil: "networkidle" }).catch(() => null);
  const label = `${vp.tag} · ${route}${poison ? " · MÉRGEZETT" : ""}`;
  if (!res || res.status() >= 400) {
    say(false, `${label}: a lap betölt`, `HTTP ${res?.status() ?? "nincs válasz"}`);
    await ctx.close();
    return;
  }
  if (poison) await page.evaluate(POISON_JS);
  const m = (await page.evaluate(MEASURE_JS)) as {
    buttons: {
      label: string;
      classes: string[];
      dead: string[];
      primary: boolean;
      contrast: number;
      color: string;
      bg: string;
    }[];
    dupPrimaries: number | null;
    dupTotal: number | null;
  };
  say(m.buttons.length > 0, `${label}: van mérhető gomb (${m.buttons.length})`);

  // ① nincs halott osztály
  const dead = m.buttons
    .flatMap((b) => b.dead.map((c) => ({ cls: c, label: b.label })))
    .filter((d) => !(d.cls in NO_RULE_OK));
  say(
    dead.length === 0,
    `${label}: ① egyetlen gomb-osztályhoz sincs HIÁNYZÓ CSS-szabály`,
    dead.map((d) => `.${d.cls} („${d.label}")`).join(" · "),
  );

  // ② a ghost soha nem elsődleges
  const ghosts = m.buttons.filter((b) => b.classes.includes("ghost"));
  for (const g of ghosts) {
    say(!g.primary, `${label}: ② „${g.label}" ghost, tehát NEM elsődleges`, "navy gradiens ül rajta");
  }

  // ③ a másodlagos is olvasható
  for (const g of ghosts) {
    say(
      g.contrast >= 4.5,
      `${label}: ③ „${g.label}" felirata olvasható (kontraszt ${g.contrast})`,
      `${g.color} a(z) ${g.bg} felett`,
    );
  }

  // ④ a döntés-sorban EGY elsődleges
  if (m.dupTotal !== null) {
    say(
      m.dupPrimaries === 1,
      `${label}: ④ a döntés-sorban pontosan EGY elsődleges gomb (${m.dupTotal} válaszból)`,
      `mérve ${m.dupPrimaries}`,
    );
  }
  await ctx.close();
}

async function main(): Promise<void> {
  console.log(
    SELF_TEST
      ? "GOMB-SÚLY ŐR — ÖNTESZT (a régi, halott ghost-tal PIROSRA kell mennie)"
      : "GOMB-SÚLY ŐR — nincs halott gomb-osztály, és a másodlagos nem néz ki elsődlegesnek",
  );
  const { port, cookie } = await bootConsole();
  const origin = `http://localhost:${port}`;
  const { db } = await import("../src/db/client.js");
  const lead = await db
    .selectFrom("lead")
    .select("id")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!lead) throw new Error("nincs lead a dev DB-ben — az őr nem tud mit mérni");
  const routes = [`/lead/${lead.id}`, "/duplicates", "/leads"];

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  if (!SELF_TEST) {
    for (const r of routes) for (const vp of VIEWPORTS) await measureRoute(browser, origin, cookie, r, vp, false);
  } else {
    const before = failed;
    for (const r of routes) await measureRoute(browser, origin, cookie, r, VIEWPORTS[1], true);
    const reds = failed - before;
    failed = reds === 0 ? 1 : 0;
    console.log(`\n⚑ ÖNTESZT: a régi (halott) ghost ${reds} állítást vitt pirosra.`);
    if (reds === 0) console.error("❌ AZ ŐR NEM TUD PIROSRA MENNI — ez díszlet, nem őr.");
    else console.log("✅ az őr megfogja a 2026-09-15 előtti állapotot");
  }
  await browser.close();
  await db.destroy();

  if (failed) {
    console.error(`\n⛔ button-weight-check: ${failed} bukás.`);
    process.exit(1);
  }
  console.log("\n🟢 button-weight-check: minden gomb-osztálynak van szabálya, és a másodlagos másodlagosnak látszik.");
  process.exit(0);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
