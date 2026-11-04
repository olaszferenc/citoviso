// GUARD — the /domains page must BEHAVE like the approved hybrid
// (assets/design-refs/console/domain-nyilvantartas/README.md), not merely render. Hermetic:
// fixture records through the real view + the real console CSS, in a real browser.
//
//   ① LAYOUT: desktop (1280) shows the table and no cards; phone (390) shows cards, no table,
//      and the page never scrolls sideways.
//   ② DRAWER: a row (desktop) / a card (phone) opens the drawer with the life-path bar on top
//      and the name's timeline; the URL carries ?open=<id>; ESC and „Bezárás” close it and
//      drop ?open. A deep link ?open=<id> renders the drawer server-side (no JS needed).
//   ③ TIMELINE TRUTH (§B.17): an unmeasured step reads „nincs adat”, never a time; a stored
//      side-event (the .hu confirmation link) sits after the purchase, before the steps to come.
//   ④ FILTER: „Figyelmet kér” lists exactly the rows with an attention reason; the chip counts
//      add up; a lapsing / ended-subscription / stuck row carries the red edge.
//   ⑤ SEARCH: typing narrows rows and the footer count, live.
//   ⑥ HELP: the „?” opens the help box, ESC closes it. JS errors: 0.
//
//   npx tsx scripts/domain-registry-ui-check.mts

process.env.CIT_SHOT = "1";

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const { lifeSteps, attentionOf, domainStats } = await import("../src/console/domainRegistry.js");
const { domainsPage, filterDomains, parseDomainsQuery } = await import("../src/console/domainRegistryViews.js");
type Rec = Parameters<typeof domainStats>[0][number];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-11-04T10:00:00Z");
const DAY = 86_400_000;
const d = (s: string): Date => new Date(s);

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`✅ ${what}`);
  else {
    failed++;
    console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
  }
};

// ── fixtures ─────────────────────────────────────────────────────────────────
let n = 0;
function rec(o: {
  domain: string;
  status: string;
  house?: boolean;
  stuckStage?: number;
  orderedAt?: Date | null;
  paidAt?: Date | null;
  boughtAt?: Date | null;
  confirmLinkAt?: Date | null;
  registryRecordedAt?: Date | null;
  nsActiveAt?: Date | null;
  liveAt?: Date | null;
  waitingSince?: Date | null;
  registrarNote?: string | null;
  expiresAt?: Date | null;
  renewEnd?: Date | null;
  renewProblem?: string | null;
  error?: string | null;
  partnerName?: string | null;
}): Rec {
  n++;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const tld = o.domain.slice(o.domain.lastIndexOf("."));
  const house = !!o.house;
  const steps = lifeSteps({
    status: o.status,
    tld,
    house,
    stuckStage: o.stuckStage ?? 0,
    orderedAt: o.orderedAt ?? null,
    paidAt: o.paidAt ?? null,
    boughtAt: o.boughtAt ?? null,
    confirmLinkAt: o.confirmLinkAt ?? null,
    registryRecordedAt: o.registryRecordedAt ?? null,
    nsActiveAt: o.nsActiveAt ?? null,
    liveAt: o.liveAt ?? null,
    bought: !!o.boughtAt,
  });
  const daysLeft = o.expiresAt ? Math.floor((o.expiresAt.getTime() - NOW.getTime()) / DAY) : null;
  const base = {
    status: o.status,
    stuckStage: o.stuckStage ?? 0,
    registrarNote: o.registrarNote ?? null,
    renewProblem: o.renewProblem ?? null,
    renewEnd: o.renewEnd ?? null,
    house,
  };
  return {
    provisioningId: id,
    siteId: id,
    tenantId: id,
    tenantName: `${o.domain.split(".")[0]} vendégház`,
    tenantStatus: "active",
    slug: o.domain.split(".")[0].replace(/-/g, ""),
    partnerId: o.partnerName === null ? null : id,
    partnerName: o.partnerName === null ? null : (o.partnerName ?? `Partner ${n}`),
    domain: o.domain,
    tld,
    house,
    registrar: "websupport",
    registrarRef: o.boughtAt ? String(22900000 + n) : null,
    serviceRef: null,
    status: o.status,
    error: o.error ?? null,
    orderIntentId: house ? null : id,
    orderKind: house ? null : "initial",
    startedAt: o.orderedAt ?? o.boughtAt ?? NOW,
    steps,
    waitingSince: o.status !== "live" && o.status !== "failed" ? (o.waitingSince ?? o.boughtAt ?? null) : null,
    stuckStage: o.stuckStage ?? 0,
    delayNoticeAt: null,
    registrarNote: o.registrarNote ?? null,
    registrarNoteAt: o.registrarNote ? d("2026-11-03T12:00:00Z") : null,
    confirmLinkAt: o.confirmLinkAt ?? null,
    expiresAt: o.expiresAt ?? null,
    expiryEstimated: false,
    autoRenew: o.status === "live" ? true : null,
    renewEnd: o.renewEnd ?? null,
    renewCheckedAt: o.status === "live" ? d("2026-11-04T04:20:00Z") : null,
    renewProblem: o.renewProblem ?? null,
    cover: house ? "house" : "package",
    monthlyFee: 0,
    feeCurrency: "HUF",
    costNet: 1990,
    costCurrency: "HUF",
    attention: attentionOf(base, daysLeft),
    daysLeft,
  } as Rec;
}

const RUNNING = rec({
  domain: "dunavibehouse.hu",
  status: "dns_pending",
  orderedAt: d("2026-11-04T09:15:48Z"),
  paidAt: d("2026-11-04T09:16:47Z"),
  boughtAt: d("2026-11-04T09:16:57Z"),
  confirmLinkAt: d("2026-11-04T09:20:11Z"),
  expiresAt: d("2027-11-04T09:17:04Z"),
});
const LIVE = rec({
  domain: "overseer.hu",
  status: "live",
  orderedAt: d("2026-10-21T13:47:08Z"),
  paidAt: d("2026-10-21T13:54:42Z"),
  boughtAt: d("2026-10-21T13:54:52Z"),
  nsActiveAt: d("2026-10-23T14:32:47Z"),
  liveAt: d("2026-10-23T14:36:55Z"),
  expiresAt: d("2027-10-21T19:43:40Z"),
});
const HOUSE = rec({ domain: "citoviso.hu", status: "live", house: true, boughtAt: d("2026-10-17T09:16:44Z"), liveAt: d("2026-10-17T09:18:09Z"), expiresAt: d("2027-09-06T19:30:02Z"), partnerName: null });
const STUCK = rec({
  domain: "sasfeszek-lak.hu",
  status: "dns_pending",
  stuckStage: 2,
  orderedAt: d("2026-10-31T08:00:00Z"),
  paidAt: d("2026-10-31T08:01:00Z"),
  boughtAt: d("2026-10-31T08:01:30Z"),
  registrarNote: "a Nyilvántartó dokumentumot kér",
  expiresAt: d("2027-10-31T08:01:30Z"),
});
const LAPSING = rec({
  domain: "borostyan-panzio.hu",
  status: "live",
  orderedAt: d("2025-11-08T09:00:00Z"),
  boughtAt: d("2025-11-08T09:02:00Z"),
  liveAt: d("2025-11-08T11:00:00Z"),
  expiresAt: new Date(NOW.getTime() + 5 * DAY + 3600_000),
  renewProblem: "a regisztrátori egyenleg nem fedezi",
});
const ENDED = rec({
  domain: "patak-haz.hu",
  status: "live",
  orderedAt: d("2026-02-01T09:00:00Z"),
  boughtAt: d("2026-02-01T09:02:00Z"),
  liveAt: d("2026-02-01T10:00:00Z"),
  expiresAt: d("2027-02-01T09:02:00Z"),
  renewEnd: d("2027-02-01T09:02:00Z"),
});
const FAILED = rec({ domain: "napfeny-apartman.com", status: "failed", orderedAt: d("2026-11-02T09:00:00Z"), paidAt: d("2026-11-02T09:01:00Z"), error: "A regisztrátor elutasította: a név foglalt" });
const ALL = [RUNNING, LIVE, HOUSE, STUCK, LAPSING, ENDED, FAILED];
const ATT = new Set([STUCK, LAPSING, ENDED, FAILED].map((r) => r.provisioningId));

// ── ③ ④ pure checks ──────────────────────────────────────────────────────────
const attRows = filterDomains(ALL, { f: "att", sort: "att" });
say(
  attRows.length === ATT.size && attRows.every((r) => ATT.has(r.provisioningId)),
  "„Figyelmet kér”: pontosan az elakadt, a lejáró, a megszűnt előfizetésű és a bukott sor",
  attRows.map((r) => r.domain).join(", "),
);
const def = filterDomains(ALL, { f: "all", sort: "att" });
say(def.slice(0, ATT.size).every((r) => ATT.has(r.provisioningId)), "alap rendezés: a figyelmet kérő sorok elöl");
/** The drawer timeline (<ol class="dm-tl">) of one record's template. */
const tlOf = (h: string, id: string): string => {
  const a = h.indexOf(`id="dm-d-${id}"`);
  const t = h.slice(a, h.indexOf("</template>", a));
  return t.slice(t.indexOf('<ol class="dm-tl">'), t.indexOf("</ol>"));
};
const html = domainsPage(ALL, domainStats(ALL, NOW), parseDomainsQuery(new URL("http://x/domains")), NOW);
const runTpl = tlOf(html, RUNNING.provisioningId);
const order = ["Megvéve a regisztrátornál", "Megerősítő link érkezett", ".hu Nyilvántartó-megerősítés", "Bejegyezve, névszerver aktív"].map((t) => runTpl.indexOf(t));
say(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), "idővonal: a link-esemény a vétel után, a hátralévő lépések előtt", order.join(" < "));
const liveTpl = tlOf(html, LIVE.provisioningId);
const tlsLi = liveTpl.slice(liveTpl.indexOf("TLS-tanúsítvány"), liveTpl.indexOf("</li>", liveTpl.indexOf("TLS-tanúsítvány")));
say(/nincs adat/.test(tlsLi) && !/\d{2}:\d{2}/.test(tlsLi), "a nem mért TLS-időpont „nincs adat”, nem kitalált idő", tlsLi.replace(/<[^>]+>/g, " ").trim());
const chipSum = [...html.matchAll(/data-filter="(att|run|live|exp|all)"[^>]*>[^<]*<b>(\d+)<\/b>/g)].map((m) => [m[1], Number(m[2])] as const);
const chip = Object.fromEntries(chipSum);
say(chip.all === ALL.length && chip.att === ATT.size && chip.run === 2 && chip.live === 4, "szűrő-számok", JSON.stringify(chip));

// ── ① ② ⑤ ⑥ browser ─────────────────────────────────────────────────────────
const MIME: Record<string, string> = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url ?? "/", "http://localhost");
  if (u.pathname.startsWith("/assets/")) {
    const f = path.join(ROOT, "public", u.pathname);
    if (fs.existsSync(f)) {
      res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
      res.end(fs.readFileSync(f));
      return;
    }
    res.writeHead(404).end();
    return;
  }
  if (u.pathname !== "/domains") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(domainsPage(ALL, domainStats(ALL, NOW), parseDomainsQuery(u), NOW));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch();
try {
  for (const [w, label] of [
    [1280, "asztali"],
    [390, "mobil"],
  ] as const) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`${base}/domains`);
    const tableVis = await page.locator(".dm-tw").isVisible();
    const cardVis = await page.locator(".dm-cards").isVisible();
    say(w > 700 ? tableVis && !cardVis : !tableVis && cardVis, `① ${label}: ${w > 700 ? "tábla, kártya nincs" : "kártyák, tábla nincs"}`);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    say(sideways <= 0, `① ${label}: nincs oldalra görgetés`, `${sideways}px`);
    const red = await page.locator(w > 700 ? ".dm-row.is-att" : ".dm-card.is-att").count();
    say(red === ATT.size, `④ ${label}: piros szél a figyelmet kérő sorokon`, String(red));

    // Optional evidence shots (DM_SHOTS=<dir>): the list, then the drawer of the running .hu name.
    const shots = process.env.DM_SHOTS;
    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `domains-lista-${label}.png`), fullPage: true });
    }
    // ② drawer
    const opener = w > 700 ? page.locator(`.dm-row[data-open="${RUNNING.provisioningId}"] td`).nth(1) : page.locator(`.dm-card[data-open="${RUNNING.provisioningId}"]`);
    await opener.click();
    const drawer = page.locator(".dm-drawer");
    await drawer.waitFor({ state: "visible" });
    await page.waitForTimeout(260);
    const box = await drawer.boundingBox();
    say(!!box && Math.round(box.x + box.width) === w && (w > 700 ? box.width <= 560 : box.width >= w - 1), `② ${label}: az oldalfiók jobbról becsúszott`, JSON.stringify(box));
    const dtxt = await drawer.innerText();
    say(dtxt.includes("dunavibehouse.hu") && (await drawer.locator(".dm-dhead .dm-steps").count()) === 1, `② ${label}: a fiók tetején az életút-sáv, alatta a domain`);
    say(page.url().includes(`open=${RUNNING.provisioningId}`), `② ${label}: az URL viszi a megnyitott sort`);
    if (shots) await page.screenshot({ path: path.join(shots, `domains-adatlap-${label}.png`) });
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    say(!page.url().includes("open="), `② ${label}: ESC bezár, az URL tisztul`);
    await opener.click();
    await drawer.waitFor({ state: "visible" });
    await drawer.locator("[data-close]").click();
    await drawer.waitFor({ state: "hidden" });
    say(true, `② ${label}: „Bezárás” bezár`);

    // ⑤ search
    await page.fill("#dm-q", "sasfeszek");
    const visible = await page.locator(w > 700 ? ".dm-row:not([hidden])" : ".dm-card:not([hidden])").count();
    const foot = await page.locator(".dm-foot").innerText();
    say(visible === 1 && foot.startsWith("1 "), `⑤ ${label}: a keresés szűkít, a számláló követi`, `${visible} · ${foot}`);
    await page.fill("#dm-q", "");

    // ⑥ help
    await page.click("[data-help]");
    say(await page.locator("#dm-help").isVisible(), `⑥ ${label}: a súgó megnyílik`);
    await page.keyboard.press("Escape");
    say(!(await page.locator("#dm-help").isVisible()), `⑥ ${label}: ESC bezárja a súgót`);

    // ② deep link, server-side
    await page.goto(`${base}/domains?open=${STUCK.provisioningId}`);
    say((await page.locator(".dm-drawer").isVisible()) && (await page.locator(".dm-drawer").innerText()).includes("sasfeszek-lak.hu"), `② ${label}: a ?open= mélylink nyitott fiókkal tölt`);

    // ④ filter link
    await page.goto(`${base}/domains`);
    await page.click('[data-filter="att"]');
    await page.waitForURL(/f=att/);
    const shown = await page.locator(w > 700 ? ".dm-row" : ".dm-card").count();
    say(shown === ATT.size, `④ ${label}: a „Figyelmet kér” szűrő ${ATT.size} sort hagy`, String(shown));

    say(errors.length === 0, `⑥ ${label}: JS-hiba 0`, errors.join(" | "));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failed) {
  console.error(`\n⛔ ${failed} ellenőrzés bukott — a /domains nem a jóváhagyott terv szerint viselkedik.`);
  process.exit(1);
}
console.log("\n✅ domain-registry-ui-check: elrendezés, oldalfiók, idővonal, szűrő, keresés és súgó a jóváhagyott terv szerint.");
process.exit(0);
