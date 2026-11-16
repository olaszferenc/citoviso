// p-lap-vegleges (ADR-0453, owner 2026-11-16: „1)B 2B) kell, az előnézeti kártyák. 3.A De le ne vedd
// a rendlési lehetőséget” + „ha a lap alján a másik tervre kattint, akkor ugorjon a lap tetejére az új
// designnal”) — the cold lead page's final layout, measured on the REAL /p chain (in-process console,
// own fixture: two plans rendered from two real templates, shared dev DB, every row dropped on exit).
// Frozen plan: assets/design-refs/prospect-page/p-lap-vegleges/.
//
// What this proves, at 390 and 1280 px:
//   ① server: a multi-plan page's manifest carries `plans` (2, the plan on screen, samePrice), the
//      „Tetszett?” block folded into the end block's cards (no #cit-plans-end); a single-plan page
//      carries no `plans`;
//   ② the first screen is the plan alone: the floating bar is NOT on it; mid-plan it is, with
//      „Kérdése van?” · „Megrendelem” · „Indítsa el · 1. terv”; the price card + „Kérdése van?”
//      (#ar, #kerdes) sit AFTER the plan in the Citoviso block; there the bar steps aside;
//   ③ the end block's card of the OTHER plan loads that plan (/v/2) at the TOP of the page, and
//      there the picked plan = the plan on screen (no mismatch line);
//   ④ the launch sheet picks IN PLACE: plan 2 picked on plan 1's page → mismatch line, the start
//      POSTs plan 2, and the trial site is built from PLAN 2's artifact;
//   ⑤ the order panel picks in place: plan 2 picked on plan 1's page → order_intent.plan_artifact_id
//      = plan 2;
//   ⑥ a plan number the link does not have (or not a number at all) is refused — trial and order —
//      and nothing is written;
//   ⑦ JS errors 0.
//
// --self-test: the browser drops `plan` from the trial / order POST (the old contract: the page's
// address decides) — ④ and ⑤ must go red, or the guard is blind.
// --shots <dir>: also renders the plans' hero shots (the cards' pictures) and saves screenshots.
//
// Run: npx tsx scripts/p-lap-check.mts [--self-test] [--shots <dir>]
// (it forces the mock mail / SMS / gateway / invoice providers itself: the dev .env has
// SMS_PROVIDER=gammu, and a trial start sends the login SMS — measured 2026-11-16, 4 real SMS.)

// ── providers FIRST, before any import that reads config ──────────────────────────────────
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";
process.env.CONSOLE_PORT = "0";
process.env.CIT_SHOT = "1";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
  console.error(`⛔ p-lap-check: EMAIL=${config.emailProvider} SMS=${config.smsProvider} — csak mock postával fut`);
  process.exit(2);
}
const { db } = await import("../src/db/client.js");
const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { renderSite } = await import("../src/engine/render.js");
const { TEMPLATES } = await import("../src/engine/templates.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { ensureHeroShot } = await import("../src/outreach/heroShot.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

const SELF_TEST = process.argv.includes("--self-test");
const shotsAt = process.argv.indexOf("--shots");
const SHOTS = shotsAt > 0 ? path.resolve(process.argv[shotsAt + 1] ?? "") : null;
const stamp = Date.now().toString(36);
let failures = 0;
const failed: string[] = [];
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) {
    failures++;
    failed.push(label);
  }
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/** A 2×2 PNG — a photo that always paints, with no network. */
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";
const site = (tag: string): Record<string, unknown> => ({
  name: `Plap Panzió ${tag}`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral és diófás kerttel, a belvárostól tíz percre.",
  highlights: ["Saját parkoló", "Diófás kert"],
  photos: [1, 2, 3, 4, 5].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" })),
  contact: { email: "info@example.invalid", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
});
const TPL = ["parallax", "wordmark-grow"];
const recipe = (template: string): Record<string, unknown> => ({
  template,
  skin: TEMPLATES[template]!.skins[0]!,
  archetype: "stacked",
  sections: [],
});
const MOCK_REL = (tag: string, n: number) => `sites/_plap_${stamp}_${tag}${n}.html`;

const parent = await createFixtureParent(db as never, "plap");
const leads: string[] = [];
const mockFiles: string[] = [];
let closeConsole: (() => void) | null = null;

async function fixture(tag: string, planCount: number): Promise<{ leadId: string; token: string; arts: string[] }> {
  const data = site(tag);
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: parent.runId,
      name: data.name,
      address: "8360 Keszthely, Fő utca 1.",
      raw: JSON.stringify({ phone: "+36 30 123 4567" }),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const arts: string[] = [];
  for (let i = 1; i <= planCount; i++) {
    const rel = MOCK_REL(tag, i);
    const rc = recipe(TPL[i - 1]!);
    await writeFile(path.resolve(process.cwd(), rel), await injectRuntime(renderSite(rc as never, data as never, { phase: "mock" })));
    mockFiles.push(rel);
    const a = await db
      .insertInto("mock_artifact")
      .values({
        lead_id: lead.id,
        path: rel,
        status: i === 1 ? "approved" : "generated",
        inputs: JSON.stringify({ engine: "composition", recipe: rc, siteData: data }),
      } as never)
      .returning("id")
      .executeTakeFirstOrThrow();
    arts.push(a.id);
  }
  const token = `plap${stamp}${tag}xxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const pr = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      mock_artifact_id: arts[0]!,
      token,
      status: "sent",
      sent_at: new Date(),
      contact_email: `plap-${tag}-${stamp}@example.invalid`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  for (let i = 1; i < arts.length; i++) {
    await db.insertInto("prospect_variant").values({ prospect_id: pr.id, mock_artifact_id: arts[i]!, position: i + 1 }).execute();
  }
  return { leadId: lead.id, token, arts };
}

const siteSource = async (leadId: string): Promise<string | null> =>
  (
    await db
      .selectFrom("site")
      .innerJoin("tenant", "tenant.id", "site.tenant_id")
      .select("site.source_artifact_id")
      .where("tenant.lead_id", "=", leadId)
      .executeTakeFirst()
  )?.source_artifact_id ?? null;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  const { server: consoleServer } = await import("../src/console/server.js");
  closeConsole = () => {
    consoleServer.closeAllConnections();
    consoleServer.close();
  };
  if (!consoleServer.listening) await new Promise((r) => consoleServer.once("listening", r));
  const base = `http://127.0.0.1:${(consoleServer.address() as { port: number }).port}`;
  const getPage = async (p: string): Promise<{ html: string; manifest: Record<string, unknown> | null }> => {
    const r = await fetch(`${base}${p}`, { redirect: "manual" });
    const html = r.status === 200 ? await r.text() : "";
    const m = /<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(html);
    return { html, manifest: m ? JSON.parse(m[1]!) : null };
  };
  const post = async (p: string, body: object): Promise<{ status: number; json: Record<string, unknown> }> => {
    const r = await fetch(`${base}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  };

  const a = await fixture("a", 2); // trial
  const o = await fixture("o", 2); // order
  const v = await fixture("v", 2); // look (end block, layout, shots)
  const solo = await fixture("s", 1);
  if (SHOTS) for (const id of [...v.arts, ...a.arts]) await ensureHeroShot(id);

  console.log("① szerver: a manifest a tervlistát viszi, a „Tetszett?” blokk beleolvadt");
  const pa = await getPage(`/p/${v.token}`);
  const plans = pa.manifest?.plans as { current?: number; list?: { n: number; href: string }[]; samePrice?: boolean } | undefined;
  check("többtervű lap: plans = 2 terv, a nézett az 1., azonos ár", plans?.current === 1 && plans?.list?.length === 2 && plans?.samePrice === true, JSON.stringify(plans));
  check("…a 2. terv címe /v/2", /\/v\/2(\?|$)/.test(plans?.list?.[1]?.href ?? ""), String(plans?.list?.[1]?.href));
  check("…nincs külön „Tetszett?” blokk (#cit-plans-end)", !/id="cit-plans-end"/.test(pa.html));
  const ps = await getPage(`/p/${solo.token}`);
  check("egytervű lap: nincs plans", !!ps.manifest && !("plans" in ps.manifest));

  console.log("⑥ idegen / hibás tervszám: elutasítva, semmi nem íródik");
  const FORM = { name: "Teszt Elek", email: `plap-x-${stamp}@example.invalid`, phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true, clickwrap: true };
  const t3 = await post(`/p/${solo.token}/trial`, { ...FORM, plan: 2 });
  const tx = await post(`/p/${solo.token}/trial`, { ...FORM, plan: "2" });
  const r3 = await post(`/p/${solo.token}/request`, { plan: 3, modules: [] });
  const soloRows = await db.selectFrom("free_trial").select("id").where("lead_id", "=", solo.leadId).execute();
  const soloOrders = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select("order_intent.id")
    .where("prospect.lead_id", "=", solo.leadId)
    .execute();
  check("próba: a linken nem létező 2. terv → 404", t3.status === 404, `${t3.status} ${JSON.stringify(t3.json)}`);
  check("próba: nem szám tervszám → 404", tx.status === 404, `${tx.status}`);
  check("rendelés: nem létező 3. terv → 404", r3.status === 404, `${r3.status}`);
  check("…egyik sem írt próba- vagy rendelés-sort", soloRows.length === 0 && soloOrders.length === 0, `${soloRows.length} · ${soloOrders.length}`);

  const pages: Page[] = [];
  const open = async (w: number, url: string, errs: string[]): Promise<Page> => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 860 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    pages.push(p);
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error" && !/net::|Failed to load resource/.test(m.text())) errs.push(m.text());
    });
    await p.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== base) return route.fulfill({ status: 204, body: "" }); // no network
      if (SELF_TEST && route.request().method() === "POST" && /\/(trial|request)$/.test(u.pathname)) {
        const b = JSON.parse(route.request().postData() || "{}");
        delete b.plan; // sabotage: the old contract — the address decides
        return route.continue({ postData: JSON.stringify(b) });
      }
      return route.continue();
    });
    await p.goto(`${base}${url}`);
    await p.waitForTimeout(1500);
    return p;
  };
  const ev = <R,>(p: Page, js: string) => p.evaluate(js) as Promise<R>;
  const barOn = (p: Page) =>
    ev<boolean>(p, `(function(){var b=document.querySelector('.cit-pbar');if(!b)return false;var r=b.getBoundingClientRect();return !b.classList.contains('cit-pbar--off')&&r.top<innerHeight&&getComputedStyle(b).visibility!=='hidden';})()`);
  const toY = async (p: Page, y: number) => {
    await ev(p, `window.scrollTo({top:${y},behavior:'instant'})`);
    await p.waitForTimeout(900);
  };
  const midY = (p: Page) => ev<number>(p, `Math.round(Math.min(document.querySelector('.cit-pend').getBoundingClientRect().top+scrollY-innerHeight*1.6, innerHeight*2.2))`);
  const toEnd = async (p: Page, sel = ".cit-pend") => {
    await ev(p, `document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'start',behavior:'instant'})`);
    await p.waitForTimeout(900);
  };
  const shot = async (p: Page, name: string) => {
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  };
  if (SHOTS) await mkdir(SHOTS, { recursive: true });

  for (const w of [390, 1280]) {
    const tag = w === 390 ? "mobil" : "asztali";
    console.log(`② ③ elrendezés + lezáró blokk (${tag})`);
    const errs: string[] = [];
    let p = await open(w, `/p/${v.token}`, errs);
    await shot(p, `${tag}-01-elso-kepernyo`);
    check(`${tag}: első képernyő — nincs sáv`, !(await barOn(p)));
    await toY(p, await midY(p));
    check(`${tag}: a terv közepén a sáv kint`, await barOn(p));
    const bar = await ev<{ txt: string; over: boolean }>(p, `(function(){var b=document.querySelector('.cit-pbar__in'),over=false;b.querySelectorAll('button').forEach(function(x){var q=x.getBoundingClientRect();if(q.left<0||q.right>innerWidth+0.5||x.scrollWidth>x.clientWidth+1)over=true;});return {txt:b.innerText.replace(/\\s+/g,' '),over:over};})()`);
    check(`${tag}: sáv = Kérdése van? · Megrendelem · Indítsa el · 1. terv`, /Kérdése van\?/.test(bar.txt) && /Megrendelem/.test(bar.txt) && /Indítsa el · 1\. terv/.test(bar.txt), bar.txt);
    check(`${tag}: a sáv elemei nem lógnak ki`, !bar.over);
    await shot(p, `${tag}-02-terv-kozepe-sav`);
    const place = await ev<{ inEnd: boolean; after: boolean; seam: string }>(p, `(function(){var e=document.querySelector('.cit-pend');var ar=document.getElementById('ar');var k=document.getElementById('kerdes');var top=document.getElementById('top');return {inEnd:!!e&&e.contains(ar)&&e.contains(k),after:!!top&&!!e&&(top.compareDocumentPosition(e)&4)>0&&!e.querySelector('#top'),seam:(document.querySelector('.cit-pend__seam')||{}).textContent||''};})()`);
    check(`${tag}: #ar és #kerdes a terv UTÁN, a Citoviso-blokkban`, place.inEnd && place.after && /A honlap-terv vége/.test(place.seam), JSON.stringify(place));
    await toEnd(p);
    check(`${tag}: a lezáró blokknál a sáv félreáll`, !(await barOn(p)));
    check(`${tag}: lezáró blokk — nincs eltérés-sor`, !(await ev<boolean>(p, `!!document.querySelector('.cit-pend .cit-pk-mm')`)));
    await shot(p, `${tag}-03-lezaro-blokk-eleje`);
    await ev(p, `document.querySelector('#ar .cit-ask__card').scrollIntoView({block:'center',behavior:'instant'})`);
    await p.waitForTimeout(500);
    const card = await ev<string>(p, `document.querySelector('#ar .cit-ask__card').innerText.replace(/\\s+/g,' ')`);
    check(`${tag}: árkártya — „Az Ön választása 1. terv”, „Indítsa el”, egyenrangú „Megrendelem most / 1. terv · próba nélkül”`,
      /Az Ön választása 1\. terv/.test(card) && /1\. terv · 14 nap ingyen/.test(card) && /Megrendelem most 1\. terv · próba nélkül/.test(card), card.slice(0, 200));
    await shot(p, `${tag}-05-arkartya`);
    await toEnd(p, ".cit-pk-pick");
    await p.click('.cit-pend [data-pk-pick="2"]');
    await p.waitForURL(/\/v\/2/, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const y = await ev<number>(p, "window.scrollY");
    check(`${tag}: lezáró blokk kártya → a 2. terv töltődik be, a lap TETEJÉN`, /\/v\/2(\?|$)/.test(p.url()) && y < 40, `${p.url()} scrollY=${y}`);
    await shot(p, `${tag}-04-lezaro-kartya-2-terv-teteje`);
    await toEnd(p, ".cit-pk-pick");
    const st = await ev<{ mm: boolean; checked: string }>(p, `(function(){var c=document.querySelector('.cit-pend [aria-checked=true]');return {mm:!!document.querySelector('.cit-pend .cit-pk-mm'),checked:c?c.getAttribute('data-pk-pick'):''};})()`);
    check(`${tag}: a 2. terv lezáró blokkjában a kijelölt = a nézett (2.), eltérés-sor nincs`, !st.mm && st.checked === "2", JSON.stringify(st));
    await shot(p, `${tag}-12-2-terv-lezaro-blokk`);
    check(`${tag}: JS-hiba 0`, errs.length === 0, errs.join(" | "));
    await p.context().close();

    console.log(`④ indító lap: a kártya helyben jelöl, a próba a KIJELÖLT tervből indul (${tag})`);
    if (w === 390) {
      const errs2: string[] = [];
      p = await open(w, `/p/${a.token}`, errs2);
      await toY(p, await midY(p));
      await p.click('.cit-pbar [data-pbar="go"]');
      await p.waitForTimeout(900);
      const sh0 = await ev<string>(p, `(function(){var c=document.querySelector('.cit-cfg-tsheet .cit-pk-tpick [aria-checked=true]');return c?c.getAttribute('data-pk-pick'):''})()`);
      check(`${tag}: indító lap — kártyák, a nézett (1.) terv kijelölve`, sh0 === "1", sh0);
      check(`${tag}: nyitott indító lapnál a sáv félreáll`, !(await barOn(p)));
      await p.click('.cit-cfg-tsheet [data-pk-pick="2"]');
      await p.waitForTimeout(500);
      const sh = await ev<string>(p, `document.querySelector('.cit-cfg-tsheet').innerText.replace(/\\s+/g,' ')`);
      check(`${tag}: helyben jelölt (nincs navigálás) + eltérés-sor`, !/\/v\/2/.test(p.url()) && /A lapon most az 1\. tervet látja, de a 2\. terv van kiválasztva/.test(sh), sh.slice(0, 160));
      check(`${tag}: indító gomb: „2. terv · 14 nap ingyen”`, /2\. terv · 14 nap ingyen · kártya nélkül/.test(sh));
      await shot(p, `${tag}-08-indito-lap-2-terv`);
      const reqP = p.waitForRequest((r) => r.method() === "POST" && /\/trial$/.test(r.url()), { timeout: 15000 });
      await p.locator(".cit-cfg-tsheet .cit-cfg-tsubmit").click();
      const req = await reqP.catch(() => null);
      await p.waitForTimeout(3500);
      const sent = req ? (JSON.parse(req.postData() || "{}") as { plan?: number }).plan : undefined;
      check(`${tag}: a próba-kérés a kijelölt 2. tervet viszi`, sent === 2 || SELF_TEST, String(sent));
      const done = await ev<string>(p, `document.querySelector('.cit-cfg-tsheet').innerText.replace(/\\s+/g,' ')`);
      check(`${tag}: „Ezzel a tervvel indult: 2. terv”`, /Ezzel a tervvel indult: 2\. terv/.test(done), done.slice(0, 200));
      await shot(p, `${tag}-09-elindult`);
      const src = await siteSource(a.leadId);
      check("a próba-site a 2. terv artifactjából épült", src === a.arts[1], `forrás ${src} · 2. terv ${a.arts[1]}`);
      check(`${tag}: JS-hiba 0`, errs2.length === 0, errs2.join(" | "));
      await p.context().close();
    }

    console.log(`⑤ rendelő panel: a kártya helyben jelöl, a rendelés a KIJELÖLT tervet viszi (${tag})`);
    const errs3: string[] = [];
    p = await open(w, `/p/${o.token}`, errs3);
    await toY(p, await midY(p));
    await p.click('.cit-pbar [data-pbar="order"]');
    await p.waitForTimeout(900);
    check(`${tag}: „Megrendelem” → rendelő panel, elöl a terv-kártyák`, await ev<boolean>(p, `!!document.querySelector('.cit-cfg-panel .cit-pk-opick .cit-pk-card')`));
    check(`${tag}: nyitott panelnél a sáv félreáll`, !(await barOn(p)));
    const head = await ev<string>(p, `(document.querySelector('.cit-cfg-panel .cit-cfg-progtxt')||{}).textContent||''`);
    check(`${tag}: panel-fejléc „1. / 3 — Terv és csomag”`, /1\. \/ 3 — Terv és csomag/.test(head), head);
    await p.click('.cit-cfg-panel [data-pk-pick="2"]');
    await p.waitForTimeout(500);
    const pt = await ev<string>(p, `document.querySelector('.cit-cfg-panel').innerText.replace(/\\s+/g,' ')`);
    check(`${tag}: eltérés-sor + „Ezt rendeli meg: 2. terv”`, /A lapon most az 1\. tervet látja, de a 2\. terv/.test(pt) && /Ezt rendeli meg: 2\. terv/.test(pt), pt.slice(0, 220));
    check(`${tag}: „2. Milyen legyen az oldala?”`, /2\. Milyen legyen az oldala\?/.test(pt));
    await shot(p, `${tag}-10-rendelo-panel`);
    if (w === 1280) {
      await p.locator(".cit-cfg-next").click();
      await p.waitForTimeout(300);
      await p.locator(".cit-cfg-next:not([disabled])").click();
      await p.waitForTimeout(400);
      await p.locator(".cit-cfg-rights").check();
      await p.locator('.cit-cfg-bt[data-btype="individual"]').click();
      await ev(p, `(function(){
        var put=function(f,v){var i=document.querySelector('.cit-cfg-i[data-f="'+f+'"]');if(i&&!i.value){i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));}};
        put('buyer_name','Teszt Elek');put('buyer_zip','8360');put('buyer_city','Keszthely');put('buyer_address','Fő utca 1.');put('buyer_email','plap-o-${stamp}@example.invalid');
        var rows=document.querySelectorAll('.cit-cfg-co-act .cit-cfg-consent');
        for(var i=0;i<rows.length;i++){if(rows[i].hasAttribute('hidden'))continue;var b=rows[i].querySelector('input[type="checkbox"]');if(b&&!b.checked){b.checked=true;b.dispatchEvent(new Event('change',{bubbles:true}));}}
      })()`);
      await p.waitForTimeout(300);
      const oreq = p.waitForRequest((r) => r.method() === "POST" && /\/request$/.test(r.url()), { timeout: 15000 });
      await p.locator(".cit-cfg-pay").click();
      const or = await oreq.catch(() => null);
      await p.waitForTimeout(2500);
      const osent = or ? (JSON.parse(or.postData() || "{}") as { plan?: number }).plan : undefined;
      check(`${tag}: a rendelés-kérés a kijelölt 2. tervet viszi`, osent === 2 || SELF_TEST, String(osent));
      const oi = await db
        .selectFrom("order_intent")
        .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
        .select(["order_intent.plan_artifact_id"])
        .where("prospect.lead_id", "=", o.leadId)
        .orderBy("order_intent.created_at", "desc")
        .executeTakeFirst();
      check("order_intent.plan_artifact_id = a panelen kijelölt 2. terv", oi?.plan_artifact_id === o.arts[1], `${oi?.plan_artifact_id} · 2. terv ${o.arts[1]}`);
    }
    check(`${tag}: JS-hiba 0`, errs3.length === 0, errs3.join(" | "));
    await p.context().close();
  }
} finally {
  await browser.close().catch(() => {});
  closeConsole?.();
  overrideFreeTrialConfigInProcess(null);
  for (const f of mockFiles) await rm(path.resolve(process.cwd(), f), { force: true });
  for (const l of leads) {
    const tIds = (await db.selectFrom("tenant").select("id").where("lead_id", "=", l).execute()).map((r) => r.id);
    for (const t of tIds) {
      await db.deleteFrom("tenant_user").where("tenant_id", "=", t).execute().catch(() => {});
      await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
    }
  }
  await parent.drop();
  await db.destroy();
}

if (SELF_TEST) {
  const red = (p: string) => failed.some((l) => l.startsWith(p));
  const blind = !red("a próba-site a 2. terv") || !red("order_intent.plan_artifact_id");
  if (blind) {
    console.error(`\n⛔ p-lap-check --self-test: a szabotázs nem vitte pirosra a ④/⑤ lábat — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ p-lap-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ p-lap-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ p-lap-check: minden zöld");
  process.exit(0);
}
