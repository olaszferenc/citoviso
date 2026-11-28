// Guard: the conversion tree section (ADR-0510) folds and renders what the frozen plan binds
// (assets/design-refs/console/konverzios-fa/README.md) — on a synthetic pilot shaped like the prod
// numbers measured 2026-11-28 with the report's own definitions (1797 → 328 → 224 → 32 → 1 → 0).
//
//   ① the fold: states „reached at least this far” (no uphill flow), mailbox filter, side exits;
//   ② blind spots (0, 2, 3, 10) have NO number — never a zero; 4 is partial and 4→5 is not computed;
//   ③ „után” only after a measured cohort: wait / number / blind;
//   ④ the collapsed one-line summary, the biggest measured drop, the default open branch;
//   ⑤ empty state for a filter with no letters; the task table missing → said, not „no tasks”;
//   ⑥ ⛔ no animation: the section's CSS carries no transition / animation / keyframes.
//
// Pure fold, no DB. REP_SHOT_DIR=<dir> also writes the rendered pages for ui-shot / Playwright.
// Run: npx tsx scripts/conversion-tree-fold-check.mts

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_TARGETS, foldReport, reportPeriod, treeStateCount, type ProspectFacts, type TreeTasksLoad, type Visit } from "../src/console/reportData.ts";
import { reportFunnelPage } from "../src/console/reportViews.ts";

const NOW = new Date("2026-11-28T15:00:00Z");
const DAY = 86_400_000;
let failed = 0;
const check = (name: string, ok: boolean, got = ""): void => {
  if (ok) console.log(`  ✓ ${name}`);
  else { failed++; console.error(`  ✗ ${name}${got ? ` — ${got}` : ""}`); }
};

// ── a synthetic pilot: 1797 e-mails 11-09…11-27, prod-shaped ──────────────────────────────────
function visit(id: string, at: Date, scroll: number, offer: boolean): Visit {
  const events = [
    { type: "open", payload: {}, occurredAt: at },
    ...(scroll ? [{ type: "scroll", payload: { pct: scroll }, occurredAt: new Date(at.getTime() + 20_000) }] : []),
    ...(offer ? [{ type: "pkg_open", payload: {}, occurredAt: new Date(at.getTime() + 40_000) }] : []),
  ];
  return { id, startedAt: at, device: "mobile", dwellSeconds: 40, maxScroll: scroll, moduleTouched: false, presetChanges: 0, moduleChanges: 0, panelOpened: false, lastSection: 1, events };
}
const facts: ProspectFacts[] = [];
const start = Date.parse("2026-11-09T08:00:00Z");
for (let i = 0; i < 1797; i++) {
  const sentAt = new Date(start + Math.floor((i * 18.5 * DAY) / 1797));
  const opened = i < 328;
  const half = i < 221; // 221 half-scrolled …
  const offer = (i >= 192 && i < 221) || (i >= 221 && i < 224); // … 32 touched the offer, 3 of them without scrolling half-way
  const visits: Visit[] = [];
  if (opened) {
    visits.push(visit(`v${i}a`, new Date(sentAt.getTime() + 3_600_000), half ? 60 : 20, offer));
    if (i % 8 === 0 && i < 320) visits.push(visit(`v${i}b`, new Date(sentAt.getTime() + 2 * DAY), 30, false)); // 40 returners
  }
  const mailTracked = i >= 1797 - 184; // the open measurement ran for the last 184 letters
  facts.push({
    id: `p${i}`, leadId: `l${i}`, leadName: `Szállás ${i}`, segment: "nincs_honlap", channel: "email", style: "x", template: "x",
    sentAt, sentHour: 10, country: "HU", timeZone: "Europe/Budapest", visits,
    openedAt: visits[0]?.startedAt ?? null, deepAt: half ? visits[0]!.startedAt : null,
    trialedAt: i === 200 ? new Date(sentAt.getTime() + DAY) : null, orderedAt: null, paidAt: null,
    unsubscribedAt: i >= 1700 && i < 1722 ? new Date(sentAt.getTime() + DAY) : null,
    escalationShown: false, escalationCta: false, escalationDismiss: false, device: opened ? "mobile" : "unknown",
    exitReason: null, exitConfidence: null, stated: null, replied: i >= 1000 && i < 1044,
    mailDomain: i % 1797 < 1086 ? "gmail" : "other", mailTracked, mailOpenedAt: null,
  });
}
// 184 tracked letters (the last ones), 69 of them opened by a person.
const tracked = facts.filter((p) => p.mailTracked);
tracked.slice(0, 69).forEach((p, j) => { tracked[j] = { ...p, mailOpenedAt: new Date(p.sentAt.getTime() + 600_000) }; });
const trackedIds = new Map(tracked.map((p) => [p.id, p]));
const all = facts.map((p) => trackedIds.get(p.id) ?? p);
// The halfViewedAt / offerAt / visitDays facts the loader derives (treeVisitFacts) — here from the visits.
const { treeVisitFacts } = await import("../src/console/reportData.ts");
const everyone: ProspectFacts[] = all.map((p) => ({ ...p, ...treeVisitFacts(p.visits, "Europe/Budapest") }));

const tasks: TreeTasksLoad = {
  unavailable: false,
  tasks: [
    { id: "t-wait", node: "6-7", leverId: "pricequestion", owner: "Lánc-SUB", startedAt: new Date("2026-11-20T00:00:00Z"), beforeRate: 14.3, note: null },
    { id: "t-done", node: "5-6", leverId: "render_gate_rules", owner: "Render-SUB", startedAt: new Date("2026-11-10T00:00:00Z"), beforeRate: 70, note: null },
    { id: "t-blind", node: "1-2", leverId: "bounce", owner: "Kontakt-SUB", startedAt: new Date("2026-11-15T00:00:00Z"), beforeRate: null, note: null },
  ],
};
const period = reportPeriod(null, "2026-11-09", "2026-11-28", NOW);
const fold = (mailbox: "all" | "gmail" | "other", country = "all", t: TreeTasksLoad = tasks) =>
  foldReport(everyone, DEFAULT_TARGETS, [], period, "segment", NOW, "all", country, { mailbox, tasks: t });

console.log("① a fold");
const d = fold("all");
const c = d.tree!.counts;
check("1797 → 328 → 224 → 32 → 1 → 0", [c.sent, c.s5, c.s6, c.s7, c.s8, c.s9].join(" ") === "1797 328 224 32 1 0", [c.sent, c.s5, c.s6, c.s7, c.s8, c.s9].join(" "));
check("a 7-be jutó, félig nem görgető lead a 6-ban is számít (nincs felfelé folyó sáv)", c.s6 >= c.s7 && c.s6 === 224);
check("oldalkijárat: válasz 44, leiratkozás 22, visszatérő 40", c.replied === 44 && c.unsubscribed === 22 && c.returned === 40, `${c.replied}/${c.unsubscribed}/${c.returned}`);
check("levélnyitás: 69 / 184 követett levél", c.mailOpened === 69 && c.mailTracked === 184, `${c.mailOpened}/${c.mailTracked}`);
const g = fold("gmail").tree!.counts;
const o = fold("other").tree!.counts;
check("postafiók-szűrő: Gmail 1086 + Egyéb 711 = Mind", g.sent === 1086 && o.sent === 711 && g.s5 + o.s5 === c.s5, `${g.sent}+${o.sent}`);
check("a lap többi panelje ugyanabból a fold-ból: Tölcsér „megnyitva” = fa 5", d.counts.opened === c.s5, `${d.counts.opened} vs ${c.s5}`);

console.log("② vakfolt sosem nulla");
check("0, 2, 3, 10 → nincs szám (null), a 4 részben (null az állapot-számban)", [0, 2, 3, 4, 10].every((n) => treeStateCount(c, n) === null));

console.log("③ „után” csak mért kohorsz után");
const rows = new Map(d.tree!.tasks.map((x) => [x.id, x]));
check("11-20-án indult kar: „fut, még nincs” (a kohorsz még nem érett)", rows.get("t-wait")!.after === "wait", JSON.stringify(rows.get("t-wait")!.after));
const done = rows.get("t-done")!.after;
check("11-10-én indult kar: szám a mért kohorszon", typeof done === "object" && done.from >= 30, JSON.stringify(done));
check("vakfolt átmeneten futó kar: „vakfolt”, nem szám", rows.get("t-blind")!.after === "blind");

console.log("④ a szekció");
const html = reportFunnelPage(d, "2026-11-28");
check(
  "csukva egy sor: 1797 kiküldve → 328 tervet nyitott → 32 ajánlathoz nyúlt → 1 próba → 0 fizetett · legnagyobb mért esés: 6→7",
  html.includes("1797 kiküldve → 328 tervet nyitott → 32 ajánlathoz nyúlt → 1 próba → 0 fizetett · legnagyobb mért esés: 6→7"),
);
check("alapból a legnagyobb mért esés ága nyitva (6→7), a többi rejtve", /data-kf-panel="6-7" id="kf-p-6-7">/.test(html) && /data-kf-panel="5-6" id="kf-p-5-6" hidden>/.test(html));
check("a szekció a Tölcsér lap TETEJÉN, a kérdés-kártyák előtt", html.indexOf('id="kf"') > 0 && html.indexOf('id="kf"') < html.indexOf("rp-hyp"));
check("asztali (vízszintes) és mobil (függőleges) folyam is a lapon", html.includes("kf-sk--h") && html.includes("kf-sk--v"));
check("1→5 közös ág 2·3·4 jelölővel", (html.match(/class="kf-hm"/g) ?? []).length === 6);
check("a feladat a karon, gazdával és előtte-aránnyal", html.includes("Lánc-SUB") && html.includes("előtte 14,3%"));
check("Feladatok nézet: „fut, még nincs” és a mért szám", html.includes("fut, még nincs") && html.includes("vakfolt — előbb mérni kell"));

console.log("⑤ üres állapot, hiányzó tábla");
const empty = fold("all", "HR");
const ehtml = reportFunnelPage(empty, "2026-11-28");
check("ország, ahová nem ment levél: „Ebben a szűrésben nem ment ki levél”, nincs nulla-folyam", empty.tree!.counts.sent === 0 && ehtml.includes("Ebben a szűrésben nem ment ki levél") && !ehtml.includes("kf-sk--h"));
const noTable = fold("all", "all", { unavailable: true, tasks: [] });
check("a feladat-tábla még nincs felvéve → kimondja", reportFunnelPage(noTable, "2026-11-28", { sel: null, view: "tasks" }).includes("0163-as migráció"));

console.log("⑥ nincs animáció");
const css = readFileSync(path.resolve(import.meta.dirname, "../public/assets/ui/citui-console.css"), "utf8");
const block = css.slice(css.indexOf("Riport → Tölcsér: Konverziós mechanizmusfa"));
const end = block.indexOf("\n/* ──", 10);
const kf = end > 0 ? block.slice(0, end) : block;
check("a szekció CSS-ében nincs transition / animation / @keyframes", !/\btransition\s*:|\banimation\s*:|@keyframes/.test(kf.replace(/\/\*[\s\S]*?\*\//g, "")));
check("a szkriptben nincs smooth scroll", !html.includes("smooth"));

if (process.env.REP_SHOT_DIR) {
  const assets = pathToFileURL(path.resolve(import.meta.dirname, "../public/assets")).href;
  const fix = (h: string): string => h.replaceAll('href="/assets/', `href="${assets}/`).replaceAll('src="/assets/', `src="${assets}/`);
  await mkdir(process.env.REP_SHOT_DIR, { recursive: true });
  await writeFile(path.join(process.env.REP_SHOT_DIR, "kf-fa.html"), fix(html));
  await writeFile(path.join(process.env.REP_SHOT_DIR, "kf-feladatok.html"), fix(reportFunnelPage(d, "2026-11-28", { sel: null, view: "tasks" })));
  await writeFile(path.join(process.env.REP_SHOT_DIR, "kf-ures.html"), fix(ehtml));
  console.log(`  → oldalak: ${process.env.REP_SHOT_DIR}`);
}

if (failed) {
  console.error(`⛔ conversion-tree-fold-check: ${failed} hiba`);
  process.exit(1);
}
console.log("✅ conversion-tree-fold-check: a fa szekció a terv szerint számol és rajzol");
process.exit(0);
