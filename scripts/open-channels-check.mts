// open-channels-check — the dashboard „Megnyitás csatornánként” card (owner 2026-11-13;
// frozen plan: assets/design-refs/console/csatorna-megnyitas/, „B”) on synthetic data, no DB:
//   ① got = the channel's first send in the period; opened = clicked FROM that channel
//      (an e-mail lead who opened from the SMS is an SMS open, not an e-mail one)
//   ② the period edge: a send before the window does not count in it, „Összes” counts all
//   ③ „Nem eldönthető”: leads touched in the period with an unattributed open
//   ④ the rate: one decimal with a comma, whole numbers bare, nothing sent → „—”
//   ⑤ the card: four tiles in order, the 7-day rate is the big number, a tile links to
//      /report?days=7#os-<channel>, „nem ment ki” when nothing went out
//   ⑥ the Riport panel carries the targets: id="honnan", a row id="os-<channel>", and the
//      script unfolds the row named by the hash
//
//   npx tsx scripts/open-channels-check.mts              → the rules
//   npx tsx scripts/open-channels-check.mts --self-test  → a broken fold MUST fail
import { foldOpenChannels, OPEN_CHANNELS, type OpenChannelsPeriod } from "../src/console/openChannels.js";
import { openChannelsCard, openRate } from "../src/console/openChannelsViews.js";
import { DEFAULT_TARGETS, foldReport, reportPeriod, type ProspectFacts, type Visit } from "../src/console/reportData.js";
import { reportFunnelPage } from "../src/console/reportViews.js";

type Fold = typeof foldOpenChannels;
const D = (iso: string): Date => new Date(iso);
const NOW = D("2026-11-13T15:00:00Z");

function visit(id: string, at: Date, source: Visit["openSource"]): Visit {
  return { id, startedAt: at, device: "mobile", dwellSeconds: 30, maxScroll: 40, moduleTouched: false, presetChanges: 0, moduleChanges: 0, panelOpened: false, lastSection: 1, events: [], openSource: source, openSourceSure: true };
}
function fact(id: string, touches: ProspectFacts["touches"], visits: Visit[]): ProspectFacts {
  return {
    id, leadId: `l-${id}`, leadName: `Teszt ${id}`, segment: "nincs_honlap", channel: "email_sms", style: "coastal-fresh", template: "parallax",
    sentAt: D("2026-11-01T09:00:00Z"), sentHour: 10, visits, openedAt: visits[0]?.startedAt ?? null, deepAt: null, trialedAt: null,
    orderedAt: null, touches, paidAt: null, unsubscribedAt: null, escalationShown: false, escalationCta: false, escalationDismiss: false,
    device: visits[0]?.device ?? "unknown", exitReason: null, exitConfidence: null, stated: null, replied: false,
  } as ProspectFacts;
}

function run(fold: Fold): string[] {
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string): void => {
    if (!cond) failures.push(msg);
  };
  const facts = [
    // today: e-mail + SMS, opened from the SMS
    fact("a", { email: D("2026-11-13T08:10:00Z"), sms: D("2026-11-13T08:20:00Z") }, [visit("v1", D("2026-11-13T09:00:00Z"), "sms")]),
    // 3 days ago: e-mail, opened from the e-mail
    fact("b", { email: D("2026-11-10T09:00:00Z") }, [visit("v2", D("2026-11-10T12:00:00Z"), "email")]),
    // 3 days ago: Viber, never opened
    fact("c", { viber: D("2026-11-10T09:00:00Z") }, []),
    // a month ago: e-mail + SMS, an open no channel could be named for
    fact("d", { email: D("2026-10-10T09:00:00Z"), sms: D("2026-10-10T09:05:00Z") }, [visit("v3", D("2026-10-11T09:00:00Z"), "unknown")]),
  ];
  const today = fold(facts, reportPeriod("today", null, null, NOW));
  const week = fold(facts, reportPeriod("7", null, null, NOW));
  const all = fold(facts, reportPeriod("0", null, null, NOW));

  // ①
  ok(today.cells.sms.got === 1 && today.cells.sms.opened === 1, "① today: SMS got 1, opened 1");
  ok(today.cells.email.got === 1 && today.cells.email.opened === 0, "① today: the e-mail lead opened from the SMS — no e-mail open");
  ok(week.cells.viber.got === 1 && week.cells.viber.opened === 0, "① 7 days: Viber got 1, opened 0");
  // ②
  ok(week.cells.email.got === 2 && week.cells.email.opened === 1, "② 7 days: e-mail got 2 (a, b), opened 1 (b)");
  ok(all.cells.email.got === 3 && all.cells.sms.got === 2, "② Összes: e-mail 3, SMS 2 (the month-old send counts)");
  ok(week.cells.whatsapp.got === 0 && all.cells.whatsapp.got === 0, "② WhatsApp: nothing went out");
  // ③
  ok(week.unknown === 0 && all.unknown === 1, "③ „Nem eldönthető”: 0 in 7 days, 1 overall");
  // ④
  ok(openRate({ got: 390, opened: 79 }) === "20,3%", "④ 79/390 → 20,3%");
  ok(openRate({ got: 55, opened: 0 }) === "0%", "④ 0/55 → 0%");
  ok(openRate({ got: 4, opened: 1 }) === "25%", "④ 1/4 → 25%");
  ok(openRate({ got: 0, opened: 0 }) === "—", "④ nothing sent → —");
  // ⑤
  const html = openChannelsCard({ today, "7": week, "0": all }, "", "hu");
  const order = OPEN_CHANNELS.map((ch) => html.indexOf(`data-oc="${ch}"`));
  ok(order.every((i) => i >= 0) && order.every((i, k) => k === 0 || i > order[k - 1]!), "⑤ four tiles in the order E-mail · SMS / MMS · Viber · WhatsApp");
  ok(html.includes('href="/report?days=7#os-viber"'), "⑤ a tile links to the Riport row");
  ok(html.includes("Megnyitás csatornánként") && html.includes("SMS / MMS"), "⑤ the binding labels render");
  ok(/data-oc="whatsapp"[\s\S]*?nem ment ki/.test(html), "⑤ the WhatsApp tile says „nem ment ki”");
  ok(/data-oc="email"[\s\S]*?oc-hero">50%/.test(html), "⑤ the e-mail tile's big number is the 7-day rate (1/2 = 50%)");
  // ⑥
  const d = foldReport(facts, DEFAULT_TARGETS, [], 0, "segment", NOW);
  const page = reportFunnelPage(d, "2026-11-13");
  ok(page.includes('id="honnan"') && page.includes('id="os-email"'), "⑥ the Riport panel carries id=honnan and the row ids");
  ok(page.includes("location.hash") && page.includes("#os-("), "⑥ the panel script unfolds the row named by the hash");
  return failures;
}

if (process.argv.includes("--self-test")) {
  // A fold that credits any open to every channel the lead got — the bug the card must not have.
  const broken: Fold = (facts, period) => {
    const good = foldOpenChannels(facts, period);
    const cells = { ...good.cells } as Record<string, { got: number; opened: number }>;
    for (const ch of OPEN_CHANNELS) {
      const touched = facts.filter((p) => p.touches?.[ch] && p.touches[ch]!.getTime() >= period.fromMs && p.touches[ch]!.getTime() <= period.toMs);
      cells[ch] = { got: touched.length, opened: touched.filter((p) => p.visits.length > 0).length };
    }
    return { ...good, cells } as OpenChannelsPeriod;
  };
  const f = run(broken);
  if (!f.length) {
    console.error("❌ open-channels-check --self-test: a törött összesítésre is ZÖLD — az őr vak.");
    process.exit(1);
  }
  console.log(`✅ open-channels-check --self-test: a törött összesítés ${f.length} ponton bukik.`);
} else {
  const f = run(foldOpenChannels);
  if (f.length) {
    console.error("❌ open-channels-check:\n  " + f.join("\n  "));
    process.exit(1);
  }
  console.log("✅ open-channels-check: a csatornánkénti megnyitás-kártya szabályai rendben.");
}
