/**
 * Kapu — a kimenő MMS KÉPE nélkül nincs páros-indítás, és a felület MONDJA KI (ADR-0131 ①).
 *
 * Kiváltó (Elek FK-004 H1, 2026-09-13): a piszkozat-lap feltétel nélkül linkelte a
 * `/prospect/<id>/mms-preview.jpg`-t. A kép nem állt elő (a látványterv nyitóképe a
 * portálon 404), a route 404-et adott, a böngésző törött-kép ikont rajzolt — közvetlenül
 * alatta ÉLŐ „Páros indítása" gombbal. Az operátor valódi SIM-ről indított volna MMS-t
 * úgy, hogy soha nem látta, mi megy ki. A küldés maga már akkor is fail-closed volt
 * (`sendOutreachPair` megtagadja kép nélkül) — csak a KÉPERNYŐ hallgatott róla.
 *
 * Amit mér, a RENDERELT piszkozat-lapon (a felirat a kimeneten dől el, nem a forráson):
 *
 *  ① A `mms-preview.jpg` hivatkozás CSAK `ready` állapotban létezhet. (Ez maga a hibaosztály:
 *     a lap ne kérjen olyan képet, amit a szerver nem tud kiszolgálni.)
 *  ② `failed` állapotban a lap KIMONDJA, mi a baj — a bukás OKÁVAL (a törött kép URL-jével),
 *     nem csak annyit, hogy „hiba".
 *  ③ `failed`/`running` állapotban a „Páros indítása” gomb `disabled`, és a felirata megnevezi,
 *     miért (a gomb maga mondja meg — nem a kattintás utáni visszautasító sáv, ADR-0082 elve).
 *  ④ `failed`/`running` állapotban az egygombos „MINDKÉT csatorna” sáv sincs ott — az is a
 *     párost indítja, tehát ugyanazt ígérné, amit a szerver megtagad.
 *  ⑤ `ready` állapotban MINDEZ FORDÍTVA: van kép, a gomb él, az egygombos sáv ott van.
 *     (Ez a ①③④ piros ikre: egy „mindig hibát mutató" lap nem csúszhat át zölden.)
 *  ⑥ `running` állapotban van követő (poll) szkript, és NINCS periodikus teljes-újratöltés a
 *     `location.pathname`-re — az letörölné a `?kuldes=` visszaigazolást a lapról.
 *  ⑦ BÖNGÉSZŐBEN (`failed` állapot, valódi konzol-CSS-sel): a lap EGYETLEN kérést sem intéz a
 *     `mms-preview.jpg`-re (nulla 404 lehetőség), az ok-sáv tényleg LÁTSZIK (elementFromPoint,
 *     nem csak „benne van a DOM-ban"), és a gomb tényleg tiltott.
 *  ⑧ ÖNTESZT — a REGRESSZIÓ szimulálása: a `failed` lapba visszainjektálom a régi, feltétel
 *     nélküli `<img>`-et és az élő gombot; a detektornak MINDKETTŐT el KELL utasítania.
 *     Aki sosem bukott, azt senki nem tesztelte.
 *  ⑨ A KÉP-ELŐÁLLÍTÁS Python nélkül (ADR-0282): élesen a route 500-at adott, mert a VPS-en
 *     nincs Pillow. Az `ensureMmsJpeg` sharp-pal dolgozik: nagy PNG → JPEG, leghosszabb
 *     él ≤1280 px, ≤290 KB; kis kép NEM nagyítódik; az átlátszóság fehérre simul; a
 *     plafon fölé nem engedhető kép DOB (nem csúszik ki csendben túlméretesen); és a
 *     forrásban nincs `python3`/`PIL` hívás.
 *
 * Futtatás: npx tsx scripts/mms-preview-gate-check.mts
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

import { outreachDraftPage } from "../src/console/views.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import { config } from "../src/config.js";
import type { HeroShotState } from "../src/outreach/heroShot.js";

let bad = 0;
const ok = (m: string): void => console.log(`  ✓ ${m}`);
const fail = (m: string): void => {
  bad++;
  console.log(`  ✗ ${m}`);
};
const check = (cond: boolean, m: string): void => (cond ? ok(m) : fail(m));

const PROSPECT = "9ee2604d-0503-45f7-bbc7-43ecd3802dc1";
const BROKEN_URL = "https://hovamenjek.hu/upload/places/11235/main/vendeglo-fogado3.jpg";
const PHONE = "+36301234567";

/** The exact shape the console hands the view (src/console/server.ts draft route). */
function page(preview: HeroShotState, phone: string | null = PHONE): string {
  return runWithConsoleLang(() =>
    outreachDraftPage(
      PROSPECT,
      { leadName: "ELEK-TESZT Vendégház", segment: "szállás" },
      {
        subject: "Elkészült az ELEK-TESZT Vendégház látványterve",
        body: "Jó napot! Készítettünk egy előzetes látványtervet…",
        link: "https://citoviso.com/p/elek-teszt-vendeghaz/TOKEN",
      },
      { verdict: "PASS", reasons: [] },
      "elek@citoviso.com",
      null,
      {
        sms: { text: "ELEK-TESZT Vendégház – az imént MMS-ben küldött látványterv: …" },
        phone,
        emailSentAt: null,
        emailAddressMailed: false,
        smsSentAt: null,
        mmsSentAt: null,
        pairJob: null,
        smsBlockedReason: null,
        mmsPreview: preview,
      },
      "11111111-2222-3333-4444-555555555555",
    ),
  );
}

/** The <form action=…/send-pair> block, so the button is judged where it stands. */
function pairForm(html: string): string {
  const i = html.indexOf("/send-pair\"");
  if (i < 0) return "";
  const start = html.lastIndexOf("<form", i);
  const end = html.indexOf("</form>", i);
  return start < 0 || end < 0 ? "" : html.slice(start, end);
}

/** ⑧ The detector, as a function — so the self-test can feed it a BROKEN page. */
interface Violation {
  readonly rule: string;
}
function detect(html: string, previewReady: boolean): Violation[] {
  const v: Violation[] = [];
  const linksImage = /src="\/prospect\/[0-9a-f-]{36}\/mms-preview\.jpg/.test(html);
  if (linksImage !== previewReady) {
    v.push({ rule: previewReady ? "ready: nincs kép-hivatkozás" : "nem-ready: VAN kép-hivatkozás" });
  }
  const form = pairForm(html);
  const disabled = /<button[^>]*\sdisabled/.test(form);
  if (disabled === previewReady) {
    v.push({ rule: previewReady ? "ready: a gomb tiltott" : "nem-ready: a gomb ÉLŐ" });
  }
  const oneClick = html.includes("/send-all\"");
  if (oneClick !== previewReady) {
    v.push({ rule: previewReady ? "ready: nincs egygombos sáv" : "nem-ready: VAN egygombos sáv" });
  }
  return v;
}

console.log("MMS-előnézet kapu — a kép nélkül nincs páros, és a lap kimondja\n");

const failedState: HeroShotState = {
  kind: "failed",
  fail: { code: "broken-images", detail: BROKEN_URL },
};
const failedHtml = page(failedState);
const readyHtml = page({ kind: "ready", path: "/tmp/shot.png" });
const runningHtml = page({ kind: "running" });

console.log("① a kép-hivatkozás CSAK ready állapotban létezik");
check(!failedHtml.includes("mms-preview.jpg"), "failed: nincs mms-preview.jpg hivatkozás");
check(!runningHtml.includes("mms-preview.jpg"), "running: nincs mms-preview.jpg hivatkozás");
check(
  /src="\/prospect\/[0-9a-f-]{36}\/mms-preview\.jpg"/.test(readyHtml),
  "ready: OTT van a kép (⑤ piros iker — különben egy mindig-hibás lap is átmenne)",
);

console.log("\n② failed: a lap kimondja az OKOT, a törött URL-lel");
check(failedHtml.includes("NINCS KIMENŐ KÉP"), "kimondja, hogy nincs kimenő kép");
check(failedHtml.includes(BROKEN_URL), "megnevezi a konkrét törött kép-URL-t");
check(
  failedHtml.includes("a páros nem indítható"),
  "kimondja a KÖVETKEZMÉNYT is (nem indítható), nem csak a tényt",
);
check(
  /action="\/prospect\/[0-9a-f-]{36}\/mms-preview"/.test(failedHtml),
  "van kiút: „Kép előállítása újra” gomb",
);

console.log("\n③ a „Páros indítása” gomb kép nélkül halott, és megnevezi, miért");
const failedForm = pairForm(failedHtml);
const runningForm = pairForm(runningHtml);
const readyForm = pairForm(readyHtml);
check(/<button[^>]*\sdisabled/.test(failedForm), "failed: a submit disabled");
check(failedForm.includes("(nincs kép)"), "failed: a felirat megnevezi az okot — „(nincs kép)”");
check(/<button[^>]*\sdisabled/.test(runningForm), "running: a submit disabled");
check(!/<button[^>]*\sdisabled/.test(readyForm), "ready: a submit ÉLŐ (⑤ piros iker)");
check(
  /<button[^>]*\sdisabled/.test(pairForm(page(failedState, null))),
  "szám nélkül szintén tiltott (a régi viselkedés nem sérült)",
);
check(
  pairForm(page({ kind: "ready", path: "/tmp/s.png" }, null)).includes("(nincs szám)"),
  "szám nélkül a régi ok-felirat marad meg",
);

console.log("\n④ az egygombos „MINDKÉT csatorna” sáv is a párost indítja — kép nélkül nincs");
check(!failedHtml.includes("/send-all\""), "failed: nincs egygombos sáv");
check(!runningHtml.includes("/send-all\""), "running: nincs egygombos sáv");
check(readyHtml.includes("/send-all\""), "ready: OTT van az egygombos sáv (⑤ piros iker)");

console.log("\n⑥ running: követő poll, NEM periodikus teljes újratöltés");
check(runningHtml.includes("/mms-preview-state"), "van állapot-poll az idővonalon");
check(
  !/setInterval\([^)]*location\.replace\(location\.pathname/.test(runningHtml),
  "nincs időzített location.pathname-újratöltés (az letörölné a ?kuldes= visszaigazolást)",
);
check(
  runningHtml.includes("location.replace(location.href)"),
  "a befejezéskori EGY újratöltés a teljes URL-t tartja (a notice megmarad)",
);

// ── ⑦ böngésző: valódi CSS, valódi kérések ──────────────────────────────────
console.log("\n⑦ böngészőben: nulla kép-kérés, LÁTHATÓ ok-sáv, tiltott gomb");
const requested: string[] = [];
const server = http.createServer(async (req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  requested.push(url);
  if (url === "/draft") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(failedHtml);
    return;
  }
  // Serve the REAL console assets so specificity/visibility is judged as shipped.
  try {
    const file = path.resolve(process.cwd(), "public", url.replace(/^\/+/, ""));
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": url.endsWith(".css") ? "text/css" : "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404).end("nincs");
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const httpErrors: string[] = [];
  p.on("response", (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(`http://127.0.0.1:${port}/draft`, { waitUntil: "networkidle" });
  check(
    !requested.some((u) => u.includes("mms-preview")),
    `a lap nem kér MMS-képet (kért útvonalak: ${requested.filter((u) => u !== "/draft").length} db asset)`,
  );
  check(
    !httpErrors.some((e) => e.includes("mms-preview")),
    `nincs mms-preview HTTP-hiba${httpErrors.length ? ` (egyéb: ${httpErrors.join(" · ")})` : ""}`,
  );
  // NOT isVisible(): a `display:flex` rule beats `[hidden]`, and an overflow ancestor
  // can clip a "visible" element to zero pixels. elementFromPoint is the referee.
  // ⛔ A GÖRGETÉS NEM AZONNALI (2026-09-14): a dizájn-mag `html{scroll-behavior:smooth}`-t
  // ír elő, ezért a `scrollIntoView` UTÁN rögtön kiolvasott doboz még a RÉGI pozícióhoz
  // tartozik — az `elementFromPoint` a képernyőn kívülre esett, és az őr „elfedve: semmi"-t
  // jelentett egy tökéletesen látható sávra. A hiba akkor vált állandóvá, amikor a lap
  // megnőtt (a küldés-sáv terve), vagyis eddig is ÉRME-FELDOBÁS volt. `instant` + a
  // tényleges megérkezés kivárása.
  const hit = await p.evaluate(`(async () => {
    const el = document.getElementById("cit-mms-prev-fail");
    if (!el) return "nincs elem";
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return "nulla méret (" + Math.round(r.width) + "×" + Math.round(r.height) + ")";
    el.scrollIntoView({ block: "center", behavior: "instant" });
    let last = -1;
    for (let i = 0; i < 60; i++) {
      if (Math.abs(window.scrollY - last) <= 1) break;
      last = window.scrollY;
      await new Promise((res) => requestAnimationFrame(res));
    }
    const r2 = el.getBoundingClientRect();
    const top = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
    return el.contains(top) ? "ok" : "elfedve: " + (top ? top.tagName : "semmi");
  })()`);
  check(hit === "ok", `az ok-sáv valóban a képernyőn van (${hit})`);
  const btn = p.locator('form[action$="/send-pair"] button[type=submit]');
  check(await btn.isDisabled(), "a „Páros indítása” gomb a böngészőben is tiltott");
  check(
    (await btn.textContent())?.includes("nincs kép") === true,
    "a gomb felirata a böngészőben is megnevezi az okot",
  );
} finally {
  await browser.close();
  server.close();
}

// ── ⑧ önteszt: a REGRESSZIÓT is el kell kapni ───────────────────────────────
console.log("\n⑧ önteszt — a detektor a visszarontott lapot ELUTASÍTJA");
check(detect(failedHtml, false).length === 0, "a mai failed-lap tiszta");
check(detect(readyHtml, true).length === 0, "a mai ready-lap tiszta");
const regressed = failedHtml
  // the old, unconditional image link
  .replace(
    "<b class=\"small\">MMS",
    `<img src="/prospect/${PROSPECT}/mms-preview.jpg" alt="x"><b class="small">MMS`,
  )
  // the old, always-live button
  .replace(/(<form[^>]*\/send-pair"[\s\S]*?<button[^>]*?) disabled/, "$1");
const found = detect(regressed, false);
check(
  found.some((v) => v.rule.includes("VAN kép-hivatkozás")),
  "elkapja a feltétel nélküli kép-hivatkozást (a 2026-09-13-i hiba)",
);
check(
  found.some((v) => v.rule.includes("a gomb ÉLŐ")),
  "elkapja a törött előnézet alatti ÉLŐ páros-gombot",
);

// ── ⑨ a JPEG-előállítás Python nélkül (sharp) ────────────────────────────────
console.log("\n⑨ az MMS-JPEG sharp-pal áll elő (az élesen nincs Pillow)");
{
  const sharp = (await import("sharp")).default;
  const { ensureMmsJpeg, toMmsJpeg, isJpeg, MMS_MAX_BYTES } = await import("../src/mms/sender.js");
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(path.join(tmpdir(), "cit-mms-jpeg-"));
  try {
    // A screenshot-like PNG: large, with an alpha channel and some texture.
    const big = await sharp({
      create: { width: 2600, height: 1700, channels: 4, background: { r: 30, g: 110, b: 150, alpha: 0.6 } },
    })
      .composite([
        {
          input: await sharp({ create: { width: 2600, height: 1700, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 18 } } })
            .png()
            .toBuffer(),
          blend: "overlay",
        },
      ])
      .png()
      .toBuffer();
    const src = path.join(dir, "hero.png");
    await writeFile(src, big);
    const out = await ensureMmsJpeg(src);
    const buf = await readFile(out);
    const meta = await sharp(buf).metadata();
    check(out.endsWith("hero.mms.jpg"), "ensureMmsJpeg a forrás mellé ír (<név>.mms.jpg)");
    check(isJpeg(buf) && meta.format === "jpeg", "a kimenet JPEG (magic bytes + formátum)");
    check(buf.length <= MMS_MAX_BYTES, `a kimenet ≤${MMS_MAX_BYTES} bájt (${buf.length})`);
    check(Math.max(meta.width ?? 0, meta.height ?? 0) === 1280, `a leghosszabb él 1280 px (${meta.width}×${meta.height})`);
    check(!meta.hasAlpha, "az átlátszóság kisimítva (JPEG-ben nincs alfa)");

    const small = await toMmsJpeg(await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer());
    const sm = await sharp(small).metadata();
    check(sm.width === 400 && sm.height === 300, `kis kép NEM nagyítódik (${sm.width}×${sm.height})`);

    // Pure full-strength noise defeats JPEG: the ladder must end in a THROW, not an oversize file.
    const noise = await sharp({ create: { width: 1280, height: 1280, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 120 } } })
      .png()
      .toBuffer();
    let verdict = "";
    try {
      const n = await toMmsJpeg(noise);
      verdict = n.length <= MMS_MAX_BYTES ? "ok" : `túlméretes (${n.length})`;
    } catch (e) {
      verdict = /plafon/.test((e as Error).message) ? "dob" : `más hiba: ${(e as Error).message}`;
    }
    check(verdict === "ok" || verdict === "dob", `a plafon fölé nem engedhető kép dob vagy belefér — soha nem túlméretes (${verdict})`);

    const code = await readFile(path.join(process.cwd(), "src/mms/sender.ts"), "utf8");
    check(!/python3|from PIL|"PIL"/.test(code.replace(/^\s*(\/\/|\*).*$/gm, "")), "src/mms/sender.ts kódjában nincs python3/PIL hívás");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

console.log(bad ? `\n⛔ ${bad} sértés` : "\n✅ MMS-előnézet kapu: minden állítás áll");
process.exit(bad ? 1 : 0);
