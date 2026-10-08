// report-mock-check — the Riport „Mock” tab's rules (frozen plan:
// assets/design-refs/console/mock-tab/README.md ④–⑧) on synthetic facts, no DB:
//   ① attractiveness score: the README ⑦ weights, unsubscribe = 0, sum 100
//   ② ladder: opened · ≥1 min (SUMMED dwell) · ≥75 % scroll · ≥2 visits · panel/reply/order
//   ③ Wilson 95 % interval against known values
//   ④ verdict: only templates with ≥ 10 sends are named; overlap → „belefér a véletlenbe”;
//      fewer than two such templates → no comparison; „kevés adat” below 10
//   ⑤ range + channel filter, sort orders, list filter (template + name search)
//   ⑥ the page renders it: verdict sentence, „kevés adat”, formula, empty state
//
//   npx tsx scripts/report-mock-check.mts              → the rules
//   npx tsx scripts/report-mock-check.mts --self-test  → a broken score/verdict MUST fail
import {
  foldMockReport,
  mockRowMatches,
  mockScore,
  mockVerdict,
  sortMockRows,
  wilson,
  type MockCard,
  type MockSignals,
  type ProspectFacts,
  type Visit,
} from "../src/console/reportData.js";
import { reportMockPage } from "../src/console/reportViews.js";

type Impl = { score: (s: MockSignals) => number; verdict: typeof mockVerdict };
const failures: string[] = [];
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures.push(msg);
};

const NOW = new Date("2026-10-08T12:00:00Z");
const DAY = 86_400_000;
const LABELS = { "gate-opening": "Kapunyitás — sötét, esti hangulat", fullbleed: "Fullbleed — teljes-képernyős hero", parallax: "Parallax — immerzív" };
const visit = (id: string, dwell: number, scroll: number, panel = false): Visit => ({
  id, startedAt: new Date(NOW.getTime() - DAY), device: "mobile", dwellSeconds: dwell, maxScroll: scroll,
  moduleTouched: false, presetChanges: 0, moduleChanges: 0, panelOpened: panel, lastSection: 0, events: [],
});
let seq = 0;
function fact(template: string, visits: Visit[], o: Partial<ProspectFacts> = {}): ProspectFacts {
  const i = seq++;
  const sentAt = new Date(NOW.getTime() - 2 * DAY);
  return {
    id: `p${i}`, leadId: `l${i}`, leadName: `Minta ${i}`, segment: "nincs_honlap", channel: "email", style: "coastal-fresh", template,
    sentAt, sentHour: 9, visits, openedAt: visits[0] ? new Date(sentAt.getTime() + 3 * 3_600_000) : null, deepAt: null, orderedAt: null,
    paidAt: null, unsubscribedAt: null, escalationShown: false, escalationCta: false, escalationDismiss: false, device: "mobile",
    exitReason: null, exitConfidence: null, stated: null, replied: false, ...o,
  };
}
const SIG0: MockSignals = { opened: false, returned: false, min1: false, full: false, panel: false, replied: false, ordered: false, unsubscribed: false };

function run(impl: Impl): void {
  // ① score
  const all: MockSignals = { opened: true, returned: true, min1: true, full: true, panel: true, replied: true, ordered: true, unsubscribed: false };
  ok(impl.score(all) === 100, "① minden jel = 100 pont");
  ok(impl.score(SIG0) === 0, "① semmi = 0 pont");
  ok(impl.score({ ...SIG0, opened: true }) === 20, "① megnyitotta = 20");
  ok(impl.score({ ...SIG0, returned: true }) === 15 && impl.score({ ...SIG0, min1: true }) === 15, "① visszatért / ≥1 perc = 15");
  ok(impl.score({ ...SIG0, full: true }) === 15 && impl.score({ ...SIG0, panel: true }) === 15, "① végiggörgette / panel = 15");
  ok(impl.score({ ...SIG0, replied: true }) === 10 && impl.score({ ...SIG0, ordered: true }) === 10, "① válasz / rendelés = 10");
  ok(impl.score({ ...all, unsubscribed: true }) === 0, "① leiratkozás = 0 pont");

  // ② ladder via the fold — dwell is SUMMED over the visits (40 + 30 s = ≥1 perc)
  seq = 0;
  const two = foldMockReport([fact("parallax", [visit("a", 40, 80), visit("b", 30, 10)])], LABELS, 0, "all", NOW);
  const r = two.rows[0]!;
  ok(r.opened && r.returned && r.min1 && r.full && !r.panel, "② két látogatás 40+30 mp, 80% → megnyitotta, visszatért, ≥1 perc, végiggörgette");
  ok(r.dwellSeconds === 70 && r.maxScroll === 80, "② idő = összeg (70), görgetés = maximum (80)");
  ok(r.templateLabel === "Parallax", "② a sablon felirata a „ — ” előtti rész");
  ok(r.score === impl.score(r), "② a sor pontja a pont-függvényé");

  // ③ Wilson
  const w = wilson(8, 20)!;
  ok(Math.abs(w[0] - 0.2188) < 0.001 && Math.abs(w[1] - 0.6134) < 0.001, `③ Wilson(8/20) ≈ 21,9–61,3% (kapott ${w.map((x) => x.toFixed(4)).join("–")})`);
  ok(wilson(0, 0) === null, "③ Wilson(0/0) = nincs");

  // ④ verdict
  const card = (key: string, opened: number, sent: number): MockCard => ({
    key, label: key, sent, opened, few: sent < 10, steps: [Math.round((opened / sent) * 100), 0, 0, 0, 0], openDelta: 0, avgScore: 0, ci: null,
  });
  const v1 = impl.verdict([card("A", 8, 20), card("B", 5, 20), card("C", 9, 9)], 30);
  ok(v1.kind === "compare" && v1.top.key === "A" && v1.bottom.key === "B", "④ a 10 alatti sablont (C, 100%) nem nevezi meg; A a legjobb, B a leggyengébb");
  ok(v1.kind === "compare" && v1.overlap, "④ 8/20 vs 5/20 → a tartományok átfednek");
  const v2 = impl.verdict([card("A", 45, 50), card("B", 5, 50)], 50);
  ok(v2.kind === "compare" && !v2.overlap, "④ 45/50 vs 5/50 → már nem véletlen");
  ok(impl.verdict([card("A", 8, 20), card("C", 9, 9)], 30).kind === "none", "④ egy ≥10-es sablon → nincs összevetés");

  seq = 0;
  const facts = [
    ...Array.from({ length: 10 }, (_, i) => fact("gate-opening", i < 6 ? [visit(`g${i}`, 90, 90)] : [])),
    ...Array.from({ length: 12 }, (_, i) => fact("fullbleed", i < 2 ? [visit(`f${i}`, 10, 20)] : [], { channel: i % 2 ? "mms" : "email" })),
    fact("parallax", [visit("p", 5, 5)], { unsubscribedAt: NOW, sentAt: new Date(NOW.getTime() - 20 * DAY) }),
  ];
  const m = foldMockReport(facts, LABELS, 0, "all", NOW);
  ok(m.all.sent === 23 && m.cards.length === 3 && m.cards[0]!.key === "fullbleed", "④ kártyák: Minden sablon + sablononként, legtöbb kiküldés elöl");
  ok(m.cards.find((c) => c.key === "parallax")!.few && !m.cards.find((c) => c.key === "gate-opening")!.few, "④ kevés adat: <10 kiküldés (1 igen, 10 nem)");
  ok(m.verdict.kind === "compare" && m.verdict.top.key === "gate-opening" && m.verdict.bottom.key === "fullbleed", "④ ítélet a fold-ban: Kapunyitás vs Fullbleed");
  const g = m.cards.find((c) => c.key === "gate-opening")!;
  ok(g.steps[0] === 60 && g.openDelta === 60 - m.all.steps[0]!, "④ megnyitás az átlaghoz képest = sablon% − összes%");
  ok(m.rows.find((x) => x.template === "parallax")!.score === 0, "① a leiratkozott mock 0 pont a listán is");

  // ⑤ filters + sorting
  ok(foldMockReport(facts, LABELS, 7, "all", NOW).all.sent === 22, "⑤ 7 nap: a 20 napos kiküldés kiesik");
  ok(foldMockReport(facts, LABELS, 0, "mobile", NOW).all.sent === 6, "⑤ MMS / SMS csatorna: csak a mobil kiküldés");
  ok(foldMockReport(facts, LABELS, 0, "email", NOW).all.sent === 17, "⑤ E-mail csatorna");
  const byScore = sortMockRows(m.rows, "score");
  ok(byScore.every((x, i) => i === 0 || byScore[i - 1]!.score >= x.score), "⑤ Legvonzóbb: pont szerint csökkenő");
  const byDwell = sortMockRows(m.rows, "dwell");
  ok(byDwell.every((x, i) => i === 0 || byDwell[i - 1]!.dwellSeconds >= x.dwellSeconds), "⑤ Leghosszabb idő: idő szerint csökkenő");
  ok(m.rows.filter((x) => mockRowMatches(x, "gate-opening", "")).length === 10, "⑤ kártya-szűrés: a sablon mockjai");
  ok(m.rows.filter((x) => mockRowMatches(x, null, "MINTA 1")).length > 0, "⑤ kereső: kis-nagybetű nem számít");

  // ⑥ the page
  const html = reportMockPage(m, { tpl: null, q: "", sort: "score", n: 25 });
  ok(html.includes("Legtöbben a <b>Kapunyitás</b> mockot nyitották meg"), "⑥ az ítélet-mondat a lapon");
  ok(html.includes("kevés adat") && html.includes("Leiratkozás = 0 pont"), "⑥ kevés-adat jel + a képlet a lapon");
  ok((html.match(/class="rpm-row"(?! hidden)/g) ?? []).length === 23, "⑥ 23 sor, mind látszik (≤25)");
  const empty = reportMockPage(foldMockReport([], LABELS, 0, "all", NOW), { tpl: null, q: "", sort: "score", n: 25 });
  ok(empty.includes("Nincs kiküldött mock ebben a szűrésben.") && !/NaN/.test(empty), "⑥ üres állapot: érthető üzenet, NaN nélkül");
}

const selfTest = process.argv.includes("--self-test");
if (selfTest) {
  // A score with the panel/scroll weights swapped and a verdict that names the < 10 template.
  run({
    score: (s) => (s.unsubscribed ? 0 : mockScore({ ...s, unsubscribed: false }) - (s.full ? 5 : 0) + (s.panel ? 5 : 0)),
    verdict: (cards, avg) => mockVerdict(cards.map((c) => ({ ...c, sent: Math.max(c.sent, 10) })), avg),
  });
  if (failures.length < 2) {
    console.error(`❌ report-mock-check --self-test: a hibás pont/ítélet csak ${failures.length} bukást adott — az őr vak.`);
    process.exit(1);
  }
  console.log(`✅ report-mock-check --self-test: a hibás változat ${failures.length} ponton bukik.`);
  process.exit(0);
}
run({ score: mockScore, verdict: mockVerdict });
if (failures.length) {
  console.error(`❌ report-mock-check: ${failures.length} szabály sérül:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
console.log("✅ report-mock-check: vonzóság-pont, lépcső, Wilson, ítélet, szűrők, lap — rendben.");
