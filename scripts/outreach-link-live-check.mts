// ⛔ EGY LEADHEZ EGY ÉLŐ KÖVETETT LINK — és a lap mondja meg, melyik.
//
// Jóváhagyott terv „A" (assets/design-refs/console/outreach-link-live-archive/README.md,
// tulajdonosi döntés 2026-09-14). A régi panelen KORLÁTLANUL lehetett új követett linket
// gyártani, SEMMI nem jelölte, melyik az élő, és egyetlen archiváló űrlap sem volt — a
// három művelet-gomb (navigáció, navigáció, ÁLLAPOT-ÍRÁS) pedig azonos navy gradienst
// viselt, vagyis a felület nem mondta meg, melyik kattintás ír.
//
// Amit ez az őr a VALÓDI konzolon, valódi lead-sorokon, 390 és 1280 px-en mér:
//   ① PONTOSAN EGY ÉLŐ jelölés — és az a legutóbb létrehozott, NEM archivált link.
//      ⛔ Az elvárt értéket FÜGGETLEN lekérdezésből számoljuk (nyers SQL a prospect
//      táblán), nem a `getProspects` `isLive` mezőjéből: egy őr, ami a vizsgált
//      függvényt hívja, a visszarontást is zöldnek látja (a ház ezt már megfizette
//      egy saját komparátorával mérő rendezés-ellenőrzésen).
//   ② A TÖBBI a „Korábbi linkek" szekcióban ül, összecsukva, és egyik sem ÉLŐ.
//   ③ EGY ELSŐDLEGES (navy) GOMB kártyánként — a navigáció LINK, nem submit-gomb.
//      Számítógépes mérés: a kirajzolt háttér gradiens-e (ez különbözteti meg a
//      konzolban az elsődlegest), nem a class-név.
//   ④ AZ ÚJ LINK ELŐTT a képernyő kimondja, mi lesz a mostanival — állandó sávban
//      (JS nélkül is) ÉS az űrlapon megerősítés-horoggal.
//   ⑤ A CÍMZETT-MEZŐ a KÖVETKEZMÉNYT mondja: a helyőrzőben nincs „opcionális", és a
//      segédsor kimondja, hogy cím nélkül a rendszer nem tud levelet küldeni.
//
// Piros önteszt (`--self-test`): a betöltött lapon előállítjuk a három hibaosztályt
// (nincs ÉLŐ jelölés · KÉT ÉLŐ jelölés · a „Korábbi linkek" nyitva születik), és az őrnek pirosra
// kell mennie. A termék forrásához nem nyúlunk, a KÖZÖS dev-park nem mozdul.
//
// Használat: npx tsx scripts/outreach-link-live-check.mts [--self-test]

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

/**
 * FÜGGETLEN REFERENCIA. Nem a `getProspects`-et hívja: a szabályt itt külön írjuk le
 * (legutóbb létrehozott, NEM archivált), hogy a visszarontás ne tudjon együtt mozogni
 * a mérőeszközzel. Read-only — a közös park nem mozdul egy őr futásától.
 */
async function leadsWithLinks(): Promise<
  { leadId: string; total: number; expectedLiveToken: string | null }[]
> {
  const { db } = await import("../src/db/client.js");
  const rows = await db
    .selectFrom("prospect")
    .select(["id", "lead_id as leadId", "token", "created_at as createdAt", "archived_at as archivedAt"])
    .execute();
  const byLead = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byLead.get(r.leadId) ?? [];
    list.push(r);
    byLead.set(r.leadId, list);
  }
  const out: { leadId: string; total: number; expectedLiveToken: string | null }[] = [];
  for (const [leadId, list] of byLead) {
    const alive = list
      .filter((r) => !r.archivedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    out.push({ leadId, total: list.length, expectedLiveToken: alive[0]?.token ?? null });
  }
  return out;
}

const PANEL_JS = `(() => {
  const panel = document.querySelector("#prospects");
  if (!panel) return { present: false };
  const cards = Array.from(panel.querySelectorAll("[data-cit-link]")).map((c) => {
    const tok = c.querySelector(".con-linkact[href^='/p/'], a[href^='/p/']");
    // ⛔ A GOMB-SÚLYT KIRAJZOLVA mérjük, nem class-névből: a konzolban az elsődlegest
    //    a navy GRADIENS különbözteti meg, és egy class önmagában lehet halott szabály
    //    (a \`ghost\` pontosan ilyen: nincs hozzá szabály, ezért navy marad).
    const primaries = Array.from(c.querySelectorAll("button")).filter((b) => {
      const bg = getComputedStyle(b).backgroundImage;
      return bg && bg !== "none" && bg.indexOf("gradient") >= 0;
    }).map((b) => (b.textContent || "").trim().slice(0, 40));
    return {
      state: c.getAttribute("data-cit-link"),
      live: !!c.querySelector(".con-pill-live"),
      token: tok ? (tok.getAttribute("href") || "").replace("/p/", "") : "",
      primaries: primaries,
      inOldSection: !!c.closest("details.con-oldlinks"),
    };
  });
  const old = panel.querySelector("details.con-oldlinks");
  const email = panel.querySelector('input[type=email]');
  const createForm = panel.querySelector('form[action$="/prospect"]');
  return {
    present: true,
    cards: cards,
    oldSectionOpen: old ? old.hasAttribute("open") : null,
    oldSummary: old ? (old.querySelector("summary").textContent || "").trim() : "",
    warnText: (panel.querySelector(".con-livewarn") || { textContent: "" }).textContent.trim(),
    hasCreateForm: !!createForm,
    createConfirm: createForm ? !!createForm.getAttribute("onsubmit") : false,
    emailPlaceholder: email ? email.placeholder : "",
    panelText: (panel.textContent || "").replace(/\\s+/g, " "),
  };
})()`;

async function measure(
  browser: Browser,
  origin: string,
  cookie: string,
  leadId: string,
  expectedLiveToken: string | null,
  total: number,
  vp: (typeof VIEWPORTS)[number],
  poison: "none" | "no-live" | "two-live" | "old-section-open",
): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies([{ name: "cit_op_session", value: cookie, url: origin }]);
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`${origin}/lead/${leadId}#prospects`, { waitUntil: "networkidle" });
  await page.waitForTimeout(350);

  const label = poison === "none" ? `${vp.tag} · lead ${leadId.slice(0, 8)}` : `${vp.tag} · MÉRGEZETT[${poison}]`;

  if (poison === "no-live") {
    await page.evaluate(`document.querySelectorAll(".con-pill-live").forEach((e) => e.remove())`);
  }
  if (poison === "two-live") {
    await page.evaluate(`(() => {
      const cards = document.querySelectorAll("#prospects [data-cit-link]");
      const pill = document.querySelector(".con-pill-live");
      for (const c of cards) if (!c.querySelector(".con-pill-live") && pill) c.prepend(pill.cloneNode(true));
    })()`);
  }
  if (poison === "old-section-open") {
    // A „Korábbi linkek" szekció ALAPBÓL csukva legyen — ha kinyitva születne, a panel
    // ugyanúgy egy hosszú listát öntene a kurátor elé, mint a régi lap.
    await page.evaluate(`(() => {
      const d = document.querySelector("details.con-oldlinks");
      if (d) d.setAttribute("open", "");
      document.querySelectorAll("details.con-oldlinks .con-pill-live").forEach((e) => e.remove());
    })()`);
  }

  const m = (await page.evaluate(PANEL_JS)) as any;
  say(m.present, `${label}: van Megkeresés-panel`);
  if (!m.present) {
    await ctx.close();
    return;
  }

  // ① pontosan egy ÉLŐ, és az a FÜGGETLENÜL számolt link
  const liveCards = m.cards.filter((c: any) => c.live);
  say(
    liveCards.length === (expectedLiveToken ? 1 : 0),
    `${label}: ① ${expectedLiveToken ? "pontosan EGY" : "NULLA"} ÉLŐ jelölés (${total} link)`,
    `mérve ${liveCards.length}`,
  );
  if (expectedLiveToken) {
    say(
      liveCards.length === 1 && liveCards[0].token === expectedLiveToken,
      `${label}: ① az ÉLŐ a legutóbbi NEM archivált link (független lekérdezésből)`,
      `várt ${expectedLiveToken.slice(0, 10)}… · mért ${(liveCards[0]?.token ?? "—").slice(0, 10)}…`,
    );
  } else {
    say(
      /Most nincs ÉLŐ link/.test(m.panelText),
      `${label}: ① a lap KIMONDJA, hogy nincs élő link`,
    );
  }

  // ② a többi a „Korábbi linkek" szekcióban, összecsukva
  const others = m.cards.filter((c: any) => !c.live);
  if (others.length) {
    say(
      others.every((c: any) => c.inOldSection),
      `${label}: ② minden nem-élő kártya a „Korábbi linkek" szekcióban ül`,
      `${others.filter((c: any) => !c.inOldSection).length} kilóg`,
    );
    say(m.oldSectionOpen === false, `${label}: ② a szekció ALAPBÓL összecsukva`, String(m.oldSectionOpen));
    say(
      /Korábbi linkek/.test(m.oldSummary) && !/Archív/.test(m.oldSummary),
      `${label}: ② a felirat „Korábbi", nem „Archív" (nem minden régi link archivált)`,
      m.oldSummary,
    );
  }

  // ③ egy elsődleges gomb kártyánként
  for (const c of m.cards) {
    say(
      c.primaries.length <= 1,
      `${label}: ③ a(z) „${c.state}" kártyán legfeljebb EGY elsődleges gomb`,
      `${c.primaries.length}: ${c.primaries.join(" | ")}`,
    );
  }

  // ④/⑤ CSAK ott mérhető, ahol VAN létrehozó űrlap. ⛔ Nem néma kihagyás: a létrehozás
  // jóváhagyott mockhoz kötött (a kurátori kapu), és ha az hiányzik, a panel helyesen
  // csak egy magyarázó mondatot ír. Ezt KIMONDJUK, különben a zöld azt sugallná, hogy
  // megmértük — a ház visszatérő hibamintája.
  if (!m.hasCreateForm) {
    console.log(
      `  ℹ️  ${label}: ④/⑤ NEM mérve — ezen a leaden nincs jóváhagyott mock, ezért nincs létrehozó űrlap (helyes viselkedés)`,
    );
  } else {
    if (expectedLiveToken) {
      say(/Már van ÉLŐ link/.test(m.warnText), `${label}: ④ állandó figyelmeztetés új link előtt`, m.warnText.slice(0, 60));
      say(m.createConfirm, `${label}: ④ a létrehozó gomb meg is kérdez`);
    }
    say(
      !/opcionális/i.test(m.emailPlaceholder),
      `${label}: ⑤ a helyőrző NEM „(opcionális)"`,
      m.emailPlaceholder,
    );
    say(
      /nem tud levelet küldeni/.test(m.panelText),
      `${label}: ⑤ a segédsor kimondja a következményt (cím nélkül nincs levél)`,
    );
  }

  say(errs.length === 0, `${label}: nincs JS-hiba`, errs.join(" | "));
  await ctx.close();
}


/**
 * ⛔ A PARK MINDEN LEADJÉN EGY LINK VAN, tehát a feature LÉNYEGE — több link, ÉLŐ +
 * korábbiak, archiválás — élő adaton SOSEM mérődne meg, és az őr zöld lenne a ROSSZ
 * okból. Ezért az őr SAJÁT fixture-t épít: egy megjelölt lead HÁROM követett linkkel,
 * amiből egy archivált. `finally`-ben törli (a prospect FK `ON DELETE CASCADE`), és
 * indulás előtt a korábbi futás maradékát is takarítja.
 * ⚠️ A közös dev-park miatt a név PID-UTÓTAGÚ (két párhuzamos futás nem törli egymás
 * fixture-jét) és beszédes; a fixture-lead sehol máshol nem jelenik meg lead-listaként
 * (nincs scrape-run, nincs mock). Az elárvult (halott pid-ű) maradékot indulás előtt takarítja.
 */
const FIXTURE_BASE = "ŐR-elo-link-check";
const FIXTURE_NAME = `${FIXTURE_BASE}-${process.pid}`;
const TOKEN_SUFFIX = `-${process.pid}`;

/** Is a process with this pid alive? EPERM counts as alive (exists, not ours). */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function dropFixture(): Promise<void> {
  const { db } = await import("../src/db/client.js");
  await db.deleteFrom("lead").where("name", "=", FIXTURE_NAME).execute();
  // Crashed runs' leftovers: same base, a pid that is no longer alive. Live siblings stay.
  const rows = await db.selectFrom("lead").select(["id", "name"]).where("name", "like", `${FIXTURE_BASE}-%`).execute();
  for (const r of rows) {
    const m = /-(\d+)$/.exec(r.name ?? "");
    if (!m) continue;
    const pid = Number(m[1]);
    if (pid === process.pid || pidAlive(pid)) continue;
    await db.deleteFrom("lead").where("id", "=", r.id).execute();
  }
}

async function makeFixture(): Promise<{ leadId: string; expectedLiveToken: string }> {
  const { db } = await import("../src/db/client.js");
  await dropFixture();
  // A `lead.scrape_run_id` NOT NULL — egy MEGLÉVŐ futáshoz kötjük (csak olvassuk), és a
  // fixture-lead másodpercekig él. ⚠️ Kimondott korlát: ezalatt egy párhuzamosan futó
  // lista-őr eggyel több leadet látna abban a futásban; a név ezért beszédes.
  const run = await db.selectFrom("scrape_run").select("id").orderBy("created_at", "desc").limit(1).executeTakeFirst();
  if (!run) throw new Error("nincs scrape_run a dev DB-ben — a fixture nem építhető");
  const lead = await db
    .insertInto("lead")
    .values({ name: FIXTURE_NAME, scrape_run_id: run.id })
    .returning("id")
    .executeTakeFirstOrThrow();
  const base = Date.now();
  const rows = [
    { token: `GUARD-oldest-0001${TOKEN_SUFFIX}`, minutesAgo: 30, archived: false },
    { token: `GUARD-archived-002${TOKEN_SUFFIX}`, minutesAgo: 20, archived: true },  // ÚJABB, de ARCHIVÁLT
    { token: `GUARD-live-0000003${TOKEN_SUFFIX}`, minutesAgo: 25, archived: false },
  ];
  for (const r of rows) {
    await db
      .insertInto("prospect")
      .values({
        lead_id: lead.id,
        token: r.token,
        created_at: new Date(base - r.minutesAgo * 60_000),
        archived_at: r.archived ? new Date() : null,
      })
      .execute();
  }
  // A várt ÉLŐ: a legutóbb létrehozott NEM archivált → GUARD-live-0000003 (25 perce),
  // NEM a 20 perce létrehozott archivált. Ez a fixture LÉNYEGE: az archiválás akkor is
  // kiüti az élő szerepből, ha az a legfrissebb sor.
  return { leadId: lead.id, expectedLiveToken: `GUARD-live-0000003${TOKEN_SUFFIX}` };
}

async function main(): Promise<void> {
  console.log(
    SELF_TEST
      ? "ÉLŐ-LINK ŐR — ÖNTESZT MÓD (a három hibaosztálynak PIROSRA kell vinnie)"
      : "ÉLŐ-LINK ŐR — egy leadhez egy ÉLŐ követett link, és a lap megmondja, melyik",
  );
  const { port, cookie } = await bootConsole();
  const origin = `http://localhost:${port}`;
  const leads = await leadsWithLinks();
  const browser = await chromium.launch({ executablePath: config.chromiumPath });

  if (!SELF_TEST) {
    say(leads.length > 0, `van mérhető lead követett linkkel (${leads.length} db)`);
    for (const l of leads) {
      for (const vp of VIEWPORTS) {
        await measure(browser, origin, cookie, l.leadId, l.expectedLiveToken, l.total, vp, "none");
      }
    }
    // A TÖBB-LINKES eset — a park élő adatán nem fordul elő, ezért saját fixture.
    console.log("\n── saját fixture: 3 link, köztük egy ARCHIVÁLT (ez a feature lényege) ──");
    const fx = await makeFixture();
    try {
      const fresh = (await leadsWithLinks()).find((x) => x.leadId === fx.leadId);
      say(
        fresh?.expectedLiveToken === fx.expectedLiveToken,
        `a független referencia is a nem archivált, legutóbbit mondja élőnek`,
        `várt ${fx.expectedLiveToken} · mért ${fresh?.expectedLiveToken}`,
      );
      for (const vp of VIEWPORTS) {
        await measure(browser, origin, cookie, fx.leadId, fx.expectedLiveToken, 3, vp, "none");
      }
    } finally {
      await dropFixture();
      console.log("  🧹 fixture törölve");
    }
  } else {
    // ⛔ AZ ÖNTESZT A TÖBB-LINKES FIXTURE-ÖN FUT. Az első változatom a park egy
    // EGY-LINKES leadjét használta, ezért a „két ÉLŐ jelölés" mérgezés NO-OP volt
    // (nincs másik kártya, amire a pirulát klónozni lehetne) — az önteszt hármat
    // állított, és csak kettőt mért meg. Pontosan az a hiba, amit az őröknél üldözünk.
    const fx = await makeFixture();
    const before = failed;
    const perPoison: Record<string, number> = {};
    try {
      for (const p of ["no-live", "two-live", "old-section-open"] as const) {
        const b = failed;
        await measure(browser, origin, cookie, fx.leadId, fx.expectedLiveToken, 3, VIEWPORTS[1], p);
        perPoison[p] = failed - b;
      }
    } finally {
      await dropFixture();
      console.log("  🧹 fixture törölve");
    }
    const reds = failed - before;
    failed = 0;
    for (const [p, n] of Object.entries(perPoison)) {
      if (n === 0) {
        failed++;
        console.error(`❌ a(z) „${p}" mérgezés EGYETLEN állítást sem vitt pirosra — vak ág az öntesztben`);
      } else {
        console.log(`  ✅ „${p}": ${n} állítás piros`);
      }
    }
    console.log(`\n⚑ ÖNTESZT: a három mérgezés összesen ${reds} állítást vitt pirosra.`);
    if (reds === 0) {
      failed = 1;
      console.error("❌ AZ ŐR NEM TUD PIROSRA MENNI — ez díszlet, nem őr.");
    } else {
      console.log("✅ az őr képes pirosra menni mindhárom hibaosztályon");
    }
  }

  await browser.close();
  const { db } = await import("../src/db/client.js");
  await db.destroy();

  if (failed) {
    console.error(`\n⛔ outreach-link-live-check: ${failed} bukás.`);
    process.exit(1);
  }
  console.log("\n🟢 outreach-link-live-check: egy ÉLŐ link, a többi korábbi, és a lap ezt ki is mondja.");
  process.exit(0);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
