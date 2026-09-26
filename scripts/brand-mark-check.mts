#!/usr/bin/env npx tsx
/**
 * brand-mark-check — the Citoviso logo comes from ONE place and shows the right variant
 * (ADR-XXXX; contract: assets/design-refs/console/brand-mark/README.md).
 *
 * Why: until 2026-09-26 the console, the tenant admin, the homepage and the favicon each
 * carried their OWN hand-drawn mark (four different logos, one of them with the navy eye
 * the owner had rejected on dark), and the approved E4 existed only as a file nobody used.
 *
 *  ① ONE SOURCE — no product file draws the C arc itself; the only drawings are the two
 *     approved asset files, read by src/ui/brand.ts. The retired marks are not referenced.
 *  ② THE ASSETS ARE THE CONTRACT — both files carry the README geometry verbatim (the play
 *     at the C's mouth, the cyan arc), and differ only where the README says they do.
 *  ③ FAVICON = LIGHT — every /favicon.ico handler serves faviconSvg(), every <link rel=icon>
 *     points at /favicon.ico, and faviconSvg() is the light file byte for byte.
 *  ④ WIRED — the surfaces use the lockup/mark from src/ui/brand.ts (console frame + plain
 *     pages + login, admin frame + login pages, /pay/*, the homepage header + footer).
 *  ⑤ SEEN IN A BROWSER — per theme exactly ONE mark is visible in every themed lockup/mark,
 *     it is the variant for that theme, and its eye is painted (a gradient referenced from
 *     a hidden copy does not paint). Negative control (--selftest also runs it): the rule
 *     that once showed both marks must turn this red.
 *
 * Usage: npx tsx scripts/brand-mark-check.mts [--selftest]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { MARK_VIEWBOX, faviconSvg, lockup, markFile, markThemed } from "../src/ui/brand.js";

const ROOT = process.cwd();
const fails: string[] = [];
const fail = (m: string) => fails.push(m);
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

// ── ① one source ────────────────────────────────────────────────────────────
/** An SVG arc that opens to the right like our C (any radius): "A<r> <r> 0 1 0". */
const C_ARC = /A\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+0\s+1\s+0\s/;
const RETIRED = /\b(?:mark-gradient|lockup-gradient|mark-mono|lockup-mono)\.svg\b/;
/** Named exceptions — each with the reason it is not a logo instance. */
const ARC_ALLOW: Record<string, string> = {
  "public/index.html":
    "a hero ILLUSZTRÁCIÓ (nagy fehér C a cián gömbön, `.visual-core`) — nem fejléc-logó; a tulaj kérdése nyitott (ADR-XXXX)",
};
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, e);
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(ts|mts|html|css|js)$/.test(e)) out.push(rel);
  }
  return out;
}
const scanned = [...walk("src"), ...walk("public").filter((f) => !f.includes("/vendor/"))];
for (const f of scanned) {
  const s = read(f);
  if (C_ARC.test(s) && !ARC_ALLOW[f]) fail(`① ${f}: saját C-ív rajz — a jelet a src/ui/brand.ts adja`);
  if (RETIRED.test(s)) fail(`① ${f}: kivezetett jel-fájlra hivatkozik (${s.match(RETIRED)![0]})`);
}
if (scanned.length < 50) fail(`① csak ${scanned.length} fájlt néztem át — a bejárás elromlott`);
for (const f of ["public/assets/ui/mark-gradient.svg", "public/assets/ui/lockup-gradient.svg", "public/assets/ui/mark-mono.svg", "public/assets/ui/lockup-mono.svg"]) {
  try { statSync(path.join(ROOT, f)); fail(`① ${f}: a kivezetett jel még kiszolgálható`); } catch { /* gone — good */ }
}

// ── ② the assets are the contract ───────────────────────────────────────────
const GEOM = [
  /<path d="M84\.6 29\.3 A42 42 0 1 0 84\.6 90\.7" fill="none" stroke="#1fb6d6" stroke-width="12" stroke-linecap="round"\/>/,
  /<circle cx="48" cy="60" r="12\.5" fill="url\(#cit-eye-(?:dark|light)\)"\/>/,
  /<circle cx="42\.5" cy="54" r="3\.5" fill="#ffffff"/,
  /<path d="M82 49 L82 71 L102 60 Z" fill="#(?:ffffff|1fb6d6)"\/>/,
];
for (const v of ["dark", "light"] as const) {
  const s = markFile(v);
  GEOM.forEach((re, i) => { if (!re.test(s)) fail(`② mark-e4-${v}.svg: a README geometriájának ${i + 1}. eleme eltér`); });
}
if (!/L102 60 Z" fill="#ffffff"/.test(markFile("dark"))) fail("② a sötét változat play-e nem fehér");
if (!/L102 60 Z" fill="#1fb6d6"/.test(markFile("light"))) fail("② a világos változat play-e nem cián");
if (!/stop-color="#8ee6f6"/.test(markFile("dark"))) fail("② a sötét változat szeme nem VILÁGOS (navy pupilla sötéten = 1,44 kontraszt)");

// ②b the inline crop holds the WHOLE drawing (a 12..106 crop once cut the C's left edge flat).
{
  const [vx, vy, vw, vh] = MARK_VIEWBOX.split(/\s+/).map(Number) as [number, number, number, number];
  const [x1, y1, r, y2, half] = [84.6, 29.3, 42, 90.7, 6]; // README: arc ends, radius, stroke/2
  const cx = x1 - Math.sqrt(r * r - ((y2 - y1) / 2) ** 2);
  const cy = (y1 + y2) / 2;
  const need = { left: cx - r - half, top: cy - r - half, right: 102, bottom: cy + r + half };
  if (vx > need.left || vy > need.top || vx + vw < need.right || vy + vh < need.bottom) {
    fail(`②b a jel kivágása (${MARK_VIEWBOX}) levágja a rajzot — kell: x ${need.left.toFixed(2)}..${need.right}, y ${need.top.toFixed(2)}..${need.bottom.toFixed(2)}`);
  }
}

// ── ③ favicon = light ───────────────────────────────────────────────────────
if (faviconSvg() !== read("assets/brand/mark-e4-light.svg")) fail("③ a favikon nem a világos E4 fájl");
for (const f of ["src/server/public.ts", "src/console/server.ts"]) {
  const s = read(f);
  const handlers = s.split('=== "/favicon.ico"').length - 1;
  const served = s.split("faviconSvg()").length - 1;
  if (handlers === 0) fail(`③ ${f}: nincs /favicon.ico kezelő`);
  if (served < handlers) fail(`③ ${f}: ${handlers} favikon-kezelőből csak ${served} adja a faviconSvg()-t`);
}
for (const f of scanned) {
  for (const m of read(f).matchAll(/<link rel="(?:shortcut )?icon"\s[^>]*>/g)) {
    if (!/href="\/favicon\.ico"/.test(m[0])) fail(`③ ${f}: a favikon-link nem a /favicon.ico-ra mutat: ${m[0]}`);
  }
}

// ── ④ wired ─────────────────────────────────────────────────────────────────
const WIRED: Array<[string, RegExp, string]> = [
  ["src/console/views.ts", /const BRAND = lockup\(/, "konzol sima lapok + belépő"],
  ["src/console/views.ts", /con-side__top">\$\{frameLockup\(lang\)\}/, "konzol oldalsáv"],
  ["src/console/views.ts", /con-drawer__h">\$\{frameLockup\(lang\)\}/, "konzol telefonos menü"],
  ["src/console/views.ts", /PAY_MARK_SRC = markDataUri\("dark"\)/, "/pay/* fejléc (sötét)"],
  ["src/server/adminViews.ts", /const LOGO = lockup\(/, "ügyfél-belépő lapok"],
  ["src/server/adminViews.ts", /const LOGO_MARK = markThemed\(/, "tulaj-admin keret (ikon)"],
  ["src/server/public.ts", /lockup\(\{ on: "dark"/, "főoldal fejléc + lábléc (sötét)"],
];
for (const [f, re, what] of WIRED) if (!re.test(read(f))) fail(`④ ${f}: ${what} — nem a közös forrásból`);
const home = read("public/index.html");
if ((home.match(/<!--CIT_BRAND-->/g) ?? []).length !== 2) fail("④ public/index.html: a fejléc+lábléc CIT_BRAND jelölője nem 2 db");

// ── ⑤ seen in a browser ─────────────────────────────────────────────────────
const CSS = read("public/assets/ui/citui.css") + read("public/assets/ui/citui-console.css");
/** The page under test: every themed use, in both themes, on its real surface colour. */
function page(extraCss = ""): string {
  const block = (theme: string) =>
    `<section data-citui-theme="${theme}" style="background:var(--citui-panel);padding:12px">` +
    `<div class="probe" data-want="${theme}">${lockup({ on: "themed", sub: "belső konzol" })}</div>` +
    `<div class="probe" data-want="${theme}" style="font-size:26px">${markThemed(40)}</div>` +
    `<div class="probe" data-want="${theme}" style="display:none">${markThemed(40)}</div>` + // a hidden copy first…
    `<div class="probe" data-want="${theme}">${markThemed(40)}</div>` + // …must not blank this one
    // A LINKED lockup inside the console: its `.con a` rule once painted the word link-cyan.
    `<div class="probe con" data-want="${theme}" data-word="${theme === "dark" ? "ink" : "navy"}">${lockup({ on: "themed", href: "/" })}</div>` +
    `</section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extraCss}</style></head><body>` +
    block("light") + block("dark") +
    `<div class="probe con" data-want="dark" data-word="white" style="background:#0a1f36;padding:8px">${lockup({ on: "dark", href: "#top" })}</div>` +
    `<div class="probe" data-want="light" style="background:#fff;padding:8px">${lockup({ on: "light" })}</div>` +
    `</body></html>`;
}
async function browserCheck(extraCss = ""): Promise<string[]> {
  const out: string[] = [];
  const b = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    const p = await b.newPage({ viewport: { width: 600, height: 900 } });
    await p.setContent(page(extraCss));
    const probes = await p.$$eval(".probe", (els) =>
      els.map((el, i) => {
        const hidden = getComputedStyle(el).display === "none";
        const vis = [...el.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 0 && getComputedStyle(s).display !== "none");
        const eye = vis[0]?.querySelector("circle") ?? null;
        const w = el.querySelector(".citui-lockup__word");
        const wantWord = (el as HTMLElement).dataset.word;
        const probe = document.createElement("span");
        probe.style.color = wantWord === "white" ? "var(--citui-white)" : wantWord === "navy" ? "var(--citui-navy-900)" : "var(--citui-ink)";
        el.appendChild(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        const r = eye?.getBoundingClientRect();
        return {
          i, hidden, want: (el as HTMLElement).dataset.want!, n: vis.length,
          dark: vis[0] ? /stop-color="#8ee6f6"/.test(vis[0].outerHTML) : null,
          eye: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null,
          word: w && wantWord ? { got: getComputedStyle(w).color, expected } : null,
        };
      }),
    );
    for (const pr of probes) {
      if (pr.hidden) continue;
      if (pr.n !== 1) { out.push(`⑤ #${pr.i} (${pr.want}): ${pr.n} látható jel (1 kell)`); continue; }
      if (pr.word && pr.word.got !== pr.word.expected) out.push(`⑤ #${pr.i} (${pr.want}): a szó színe ${pr.word.got}, várt ${pr.word.expected} (link-szabály festi át?)`);
      if (pr.dark !== (pr.want === "dark")) out.push(`⑤ #${pr.i}: ${pr.want} felületen a ${pr.dark ? "sötét" : "világos"} változat látszik`);
      if (pr.eye) {
        // The eye's centre must differ from the surface: an unpainted gradient = empty eye.
        const shot = await p.screenshot({ clip: { x: Math.round(pr.eye.x) - 1, y: Math.round(pr.eye.y) + 2, width: 1, height: 1 } });
        const px = await p.evaluate(async (b64) => {
          const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
          const c = document.createElement("canvas"); c.width = c.height = 1;
          const g = c.getContext("2d")!; g.drawImage(img, 0, 0); return [...g.getImageData(0, 0, 1, 1).data];
        }, shot.toString("base64"));
        const [r, g, bl] = px as number[];
        const cyanish = bl! > r! + 40; // both eyes are cyan/blue gradients; panels are grey/white/black
        if (!cyanish) out.push(`⑤ #${pr.i} (${pr.want}): a szem közepe nem festett (rgb ${r},${g},${bl}) — a gradiens nem él`);
      }
    }
    if (probes.filter((x) => !x.hidden).length < 8) out.push("⑤ a próbalap kevesebb mintát adott, mint várt");
  } finally {
    await b.close();
  }
  return out;
}

fails.push(...(await browserCheck()));

if (process.argv.includes("--selftest") || fails.length === 0) {
  // Negative controls: each must turn ⑤ red, or ⑤ is blind.
  const controls: Array<[string, string]> = [
    ["a méretező szabály mindkét jelet mutatja (2026-09-26, „CC”)", ".citui-mark-themed svg,.citui-lockup__row svg{display:block!important}"],
    ["sötét témában is a világos jel", '[data-citui-theme="dark"] svg.citui-mark--light{display:block!important}[data-citui-theme="dark"] svg.citui-mark--dark{display:none!important}'],
    ["a szem nem festett", "svg circle{fill:none!important}"],
    ["a konzol link-szabálya átfesti a szót", ".con a.citui-lockup{color:#1fb6d6!important}"],
  ];
  for (const [name, css] of controls) {
    const r = await browserCheck(css);
    if (r.length === 0) fails.push(`⑤ önteszt: a negatív kontroll ZÖLD maradt — „${name}” (az őr vak)`);
    else console.log(`  ✓ negatív kontroll piros: ${name} (${r.length} lelet)`);
  }
}

if (fails.length) {
  console.error(`❌ brand-mark-check: ${fails.length} hiba\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`✅ brand-mark-check: egy forrás, ${scanned.length} fájl átnézve, a favikon világos, a jel témánként helyes (böngészőben mérve)`);
