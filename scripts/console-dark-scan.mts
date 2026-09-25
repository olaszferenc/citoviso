// Dark-mode audit of the WHOLE operator console (linear-shell README ⑧: no „white hole",
// and every text readable on the surface it actually sits on). Boots this worktree's
// console on an ephemeral port (same pattern as ui-shot.mts), visits every screen in
// dark mode at phone AND desktop width, and reports:
//   ① light surfaces   — an element whose own background is light (L > 0.75) inside the frame
//   ② unreadable text  — a text node's colour vs. its EFFECTIVE background < 4.5:1
//                        (< 3:1 for bold ≥ 14 px / ≥ 18.66 px)
// Read-only: GET requests only, CIT_SHOT=1 (no boot self-heal, no AI, no DB writes).
//
//   npx tsx scripts/console-dark-scan.mts            (report; exit 1 on any finding)
//   npx tsx scripts/console-dark-scan.mts --light    (the same audit in LIGHT mode — control)

process.env.CIT_SHOT = "1";

import { once } from "node:events";
import type { Server } from "node:http";
import { chromium, type Page } from "playwright-core";
import { config } from "../src/config.js";

const THEME = process.argv.includes("--light") ? "light" : "dark";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").split("=")[1] ?? "";

process.env.CONSOLE_PORT = "0";
const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const addr = server.address();
if (!addr || typeof addr === "string") throw new Error("konzol cím nélkül");
const base = `http://localhost:${addr.port}`;
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { db } = await import("../src/db/client.js");
const op =
  (await db.selectFrom("operator_user").select("id").where("username", "=", "claude-test").executeTakeFirst()) ??
  (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());
if (!op) throw new Error("nincs operator_user");
const cookie = mintOperatorCookieValue(op.id);

// Real ids for the detail screens (read-only lookups).
const lead = await db.selectFrom("lead").select("id").orderBy("created_at", "desc").limit(1).executeTakeFirst();
const partner = await db.selectFrom("partner").select("id").limit(1).executeTakeFirst();
const prospect = await db.selectFrom("prospect").select(["id"]).orderBy("created_at", "desc").limit(1).executeTakeFirst();

const { navLeaves, navTree } = await import("../src/console/nav.js");
/** Every function page of the tree, by path (query-less leaves only — a filtered list shares its path). */
const LEAF_BY_PATH = new Map(
  navLeaves(navTree("hu"))
    .filter(({ leaf }) => !/[?#]/.test(leaf.href))
    .map(({ leaf }) => [leaf.href, { href: leaf.href, label: leaf.label }] as const),
);

const ROUTES = [
  "/",
  "/hub/crm",
  "/hub/finance",
  "/hub/report",
  "/hub/system",
  "/leads",
  "/leads?mock=approved",
  lead ? `/lead/${lead.id}` : null,
  "/duplicates",
  "/scrape",
  "/scrape/map",
  "/scrape/regions",
  "/pricing",
  "/documents",
  "/documents/new",
  "/partners",
  partner ? `/partner/${partner.id}` : null,
  "/partners/new",
  "/report",
  "/settings",
  "/help",
  "/test-log",
  prospect ? `/prospect/${prospect.id}/draft` : null,
].filter((r): r is string => !!r && (!ONLY || r.includes(ONLY)));

interface Finding {
  kind: "surface" | "text" | "nav";
  sel: string;
  detail: string;
}

async function audit(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number];
    const parse = (c: string): RGBA => {
      // color-mix() computes to `color(srgb r g b / a)` with 0..1 channels — reading it as
      // „transparent" made every mixed colour measure 1,00:1 (a false red, 2026-09-25).
      const cm = c.match(/color\(srgb ([^)]+)\)/);
      if (cm) {
        const q = cm[1]!.split(/[ /]+/).filter(Boolean).map(Number);
        return [q[0]! * 255, q[1]! * 255, q[2]! * 255, q.length > 3 ? q[3]! : 1];
      }
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1];
    };
    const lum = ([r, g, b]: RGBA) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const a = top[3];
      return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
    };
    /** The colour actually behind an element: its own and its ancestors' backgrounds, composited. */
    const effBg = (el: Element | null): RGBA => {
      const stack: RGBA[] = [];
      let hasImage = false;
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage && cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("url(")) hasImage = true;
        const c = parse(cs.backgroundColor);
        if (c[3] > 0) {
          stack.push(c);
          if (c[3] >= 1) break;
        }
      }
      let out: RGBA = [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i]!, out);
      (out as unknown as { img?: boolean }).img = hasImage;
      return out;
    };
    const name = (el: Element) => {
      const cls = String((el as HTMLElement).className || "").trim().split(/\s+/).slice(0, 2).join(".");
      return el.tagName.toLowerCase() + (cls ? "." + cls : "") + (el.id ? "#" + el.id : "");
    };
    const path = (el: Element) => {
      const parts: string[] = [];
      for (let e: Element | null = el, i = 0; e && i < 3; e = e.parentElement, i++) parts.unshift(name(e));
      return parts.join(" > ");
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
    };
    const out: Array<{ kind: "surface" | "text"; sel: string; detail: string }> = [];
    const seen = new Set<string>();
    const root = document.querySelector(".con-shell") ?? document.body;
    // ① light surfaces
    for (const el of root.querySelectorAll("*")) {
      if (!visible(el) || el.closest("iframe, .leaflet-container, img, svg, video, [data-dark-exempt]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 300) continue;
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c[3] < 0.5) continue;
      const L = lum(c);
      if (L > 0.55) {
        const k = "s:" + name(el);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ kind: "surface", sel: path(el), detail: `bg ${getComputedStyle(el).backgroundColor} (L=${L.toFixed(2)})` });
      }
    }
    // ② unreadable text
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      if (t.length < 2) continue;
      const el = n.parentElement;
      if (!el || !visible(el) || el.closest("iframe, .leaflet-container, [data-dark-exempt], script, style, noscript, option")) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = effBg(el);
      if ((bg as unknown as { img?: boolean }).img) continue; // gradients/images: judged by eye, not by this rule
      const fgc = over(fg, bg);
      const a = lum(fgc), b = lum(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 600;
      const need = px >= 18.66 || (bold && px >= 14) ? 3 : 4.5;
      if (ratio < need) {
        const k = "t:" + name(el) + ":" + cs.color;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ kind: "text", sel: path(el), detail: `„${t.slice(0, 40)}” ${ratio.toFixed(2)}:1 < ${need} (szín ${cs.color} a ${`rgb(${bg.slice(0, 3).map(Math.round).join(", ")})`}-n)` });
      }
    }
    return out;
  });
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
let total = 0;
const bySel = new Map<string, { detail: string; where: string[] }>();
for (const vp of [
  { tag: "mobil", width: 390, height: 844 },
  { tag: "asztali", width: 1280, height: 900 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies([{ name: "cit_op_session", value: cookie, url: base }]);
  // tsx (esbuild keepNames) wraps named functions in `__name(...)` — also inside the
  // function handed to page.evaluate, where that helper does not exist.
  await ctx.addInitScript("window.__name = (f) => f;");
  await ctx.addInitScript((t: string) => {
    try {
      localStorage.setItem("citui-theme", t);
    } catch {}
  }, THEME);
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(base + r, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(350);
    const f = await audit(page);
    // ③ the tree lights THIS screen: a function's own page must highlight that function
    //    (2026-09-25: the three scrape screens all passed `active: "/scrape"`, so on
    //    „Területek" the sidebar and the breadcrumb said „Adatgyűjtés indítása").
    const leaf = LEAF_BY_PATH.get(r.replace(/[?#].*$/, ""));
    if (leaf && !r.includes("?")) {
      const got = await page.evaluate(() => {
        // The phone hides the sidebar and keeps the tree in the (closed) drawer — both carry the
        // same marks, so the DOM is read regardless of visibility (visibility is the phone's bar).
        const a = document.querySelector<HTMLAnchorElement>(".con-nav .con-nav__it.is-active") ??
          document.querySelector<HTMLAnchorElement>("#con-menu .con-nav__it.is-active");
        return { href: a?.getAttribute("href") ?? "", crumb: document.querySelector(".con-crumb b")?.textContent?.trim() ?? "" };
      });
      if (got.href !== leaf.href || got.crumb !== leaf.label)
        f.push({ kind: "nav", sel: r, detail: `a menü „${got.href}”-t világítja / az útvonal „${got.crumb}” — várt: „${leaf.href}” / „${leaf.label}”` });
    }
    total += f.length;
    for (const x of f) {
      const k = `${x.kind} ${x.sel}`;
      const e = bySel.get(k) ?? { detail: x.detail, where: [] };
      e.where.push(`${r} @${vp.tag}`);
      bySel.set(k, e);
    }
  }
  await ctx.close();
}
await browser.close();

const rows = [...bySel.entries()].sort((a, b) => b[1].where.length - a[1].where.length);
console.log(`\n=== console-dark-scan · téma: ${THEME} · ${ROUTES.length} képernyő × 2 méret ===\n`);
for (const [k, v] of rows) {
  console.log(`⛔ ${k}\n     ${v.detail}\n     ${v.where.length}× — ${v.where.slice(0, 4).join(", ")}${v.where.length > 4 ? " …" : ""}`);
}
console.log(rows.length ? `\n⛔ ${rows.length} különböző lelet (${total} előfordulás)` : "\n✅ nincs lelet");
process.exit(rows.length ? 1 : 0);
