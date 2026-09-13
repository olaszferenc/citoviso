// ŐR — „a scrape-lista a FUTÁSRÓL mondjon igazat" (tulaj-bejelentés, 2026-09-13).
//
// A MÉRT HIBA (éles): a tulaj 2026-09-11 08:49:59-kor (helyi idő) elindított egy
// Balaton-Kelet scrape-et. Három perccel később egy deploy újraindította a
// citoviso-console szolgáltatást; a unit KillMode=control-group módban öl, a scrape
// pedig a konzol GYEREKFOLYAMATA (scrapeJob.ts spawn) — tehát a systemd a cgrouppal
// együtt kivégezte. A képernyő ebből SEMMIT nem mutatott:
//   · a sor két napig „running" maradt (finished_at NULL, error NULL, 0 lead),
//     mert a failScrapeRun() csak a folyamaton BELÜLI hibát tudja lezárni;
//   · a napló csak a konzol memóriájában élt, így az újraindítással elpárolgott —
//     a rendszernek fizikailag nem volt válasza a „miért?" kérdésre;
//   · az „Indult" oszlop ráadásul 6:49:59-et írt (az éles gép UTC-ben jár), vagyis
//     két órával mást, mint amikor a tulaj a gombot megnyomta.
//
// Amit ez az őr mér:
//   ① a néma („megállt szívű") futás LEZÁRÓDIK, és megszakadtnak minősül
//   ② az életjel NÉLKÜLI, régi (0066 előtti) futást csak a KOR ítéli el — az élő,
//      régi kódú futást nem szabad halottnak mondani
//   ③ a lezárás megnevezi az UTOLSÓ FÁZIST (ez marad az elveszett napló helyett)
//   ④ a lapon a pill „megszakadt"-ot ír, nem nyers „failed"/„running"-ot
//   ⑤ az „Indult" cella az OLVASÓ óráján (Europe/Budapest) áll, nem a szerverén
//   ⑥ a futó sor megmondja, HOL tart és mikor adott utoljára életjelet
//   ⑦ a friss életjelű futást a takarító NEM bántja (nem öl élőt)
//   ⑧ a saját hibájára bukott futás „hibára futott" marad — a két történet nem
//      mosódik össze, mert az operátor következő lépése más
//   ⑨ a deploy-kapu (GATE 4) KÉTSZER fut, és a második a console-restart ELŐTT
//
// Valós DB-n, saját eldobható fixture-rel (a közös parkhoz nem nyúl), és a végén
// mindent visszatakarít.
//
//   npx tsx scripts/scrape-liveness-check.mts
//   npx tsx scripts/scrape-liveness-check.mts --pixel
//     390px-es BÖNGÉSZŐ-mérés: a magyarázó mondat tényleg LÁTSZIK-e. ⚠️ A viewport
//     itt rossz mérce: a táblázat a saját görgető dobozában (.tblwrap) ül, és AZ
//     vág. Az első mérésem a képernyőhöz hasonlított (365 < 390 → „rendben"),
//     miközben a doboz 10 px-t levágott minden sorból — a tudásbázis-őr fogta meg.
//     Ezért a mérce a VÁGÓ ŐS doboza (reference_overflow_ancestor_clips_dropdown).
//   npx tsx scripts/scrape-liveness-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS: ugyanezek a mérések a JAVÍTÁS ELŐTTI viselkedésre — nincs
//     takarítás (a sor „running" marad), és a lista a régi cellákkal renderel (nyers
//     státusz-szó, időzóna nélküli formázás egy UTC-ben járó szerveren). Mindnek
//     PIROSRA kell váltania; ha zöld maradna, az őr nem a szabályt mérné.

process.env.DATABASE_URL = "";

import { db } from "../src/db/client.js";
import { getScrapeRuns, type ScrapeRunView } from "../src/console/data.js";
import { scrapePage } from "../src/console/views.js";
import type { ScrapeJobState } from "../src/console/scrapeJob.js";
import { readFileSync } from "node:fs";

const SELF_TEST = process.argv.includes("--self-test");
const PIXEL = process.argv.includes("--pixel");
const failures: string[] = [];

function inv(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

function fix(name: string, ok: boolean, detail = ""): void {
  const want = SELF_TEST ? !ok : ok;
  if (want) console.log(`  ✅ ${name}${SELF_TEST ? " (helyesen PIROS a régi viselkedésen)" : ""}`);
  else {
    console.log(
      `  ⛔ ${name}${detail ? ` — ${detail}` : ""}${SELF_TEST ? " ← az önteszten ZÖLD maradt: ez a mérés nem mér semmit" : ""}`,
    );
    failures.push(name);
  }
}

/**
 * A JAVÍTÁS ELŐTTI cellák — szó szerint a régi kód (git 7676c27, views.ts):
 *   <span class="pill …">${esc(r.status)}</span>
 *   <td>${new Date(r.startedAt).toLocaleString("hu-HU")}</td>
 * ⚠️ A dátumot NEM a saját gép zónájával rendereljük, hanem UTC-vel: az ÉLES gép
 * jár UTC-ben (timedatectl), és pont az ő formázását kell reprodukálni. Ha a
 * fejlesztőgép zónáját használnánk, az önteszt véletlenül zöldre mehetne
 * (feedback_exact_match_held_only_by_accident).
 */
function preFixRunRow(r: ScrapeRunView): string {
  const s = r.stats as { players?: number; leads?: number };
  const old = new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
  return `<tr><td>${r.regionLabel}</td>
    <td><span class="pill ${r.status === "completed" ? "approved" : r.status === "failed" ? "rejected" : ""}">${r.status}</span></td>
    <td>${r.startedAt ? old.format(new Date(r.startedAt)) : "–"}</td>
    <td>${s.players ?? "–"}</td><td>${s.leads ?? "–"}</td>
    <td class="small mut">${r.error ?? ""}</td></tr>`;
}

const IDLE_JOB: ScrapeJobState = {
  running: false,
  regionId: null,
  cap: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  log: [],
};

/**
 * A futás BLOKKJA a kirenderelt lapból — a mérés a lapon áll, nem az adaton.
 * A magyarázó mondat teljes szélességű al-sorban ül a futás sora ALATT (mobilon a
 * táblázat oldalra görög, ott egy utolsó oszlop olvashatatlan), tehát a blokk a
 * sorból ÉS a hozzá tartozó al-sorból áll — különben az őr pont a mondatot nézné ki.
 */
function rowOf(html: string, label: string): string {
  const i = html.indexOf(`<td>${label}</td>`);
  if (i < 0) return "";
  let end = html.indexOf("</tr>", i);
  if (end < 0) return html.slice(i);
  end += "</tr>".length;
  if (html.slice(end).startsWith('<tr><td colspan="5"')) {
    const noteEnd = html.indexOf("</tr>", end);
    if (noteEnd > 0) end = noteEnd + "</tr>".length;
  }
  return html.slice(i, end);
}

const STAMP = String(Date.now()).slice(-9);
const L = {
  killed: `ŐR-megszakadt-${STAMP}`,
  legacy: `ŐR-régi-${STAMP}`,
  alive: `ŐR-él-${STAMP}`,
  done: `ŐR-kész-${STAMP}`,
  broke: `ŐR-hiba-${STAMP}`,
};
/** A bejelentett futás indulása — ezen az időponton mérjük az időzónát is. */
const STARTED = new Date("2026-09-11T06:49:59.348Z");
const PHASE = "Portál-adatlapok olvasása (szobák, árak, felszereltség, fotók — jogállás: portal)…";

const defIds: string[] = [];
const runIds: string[] = [];

async function openRun(
  label: string,
  row: {
    status: "running" | "completed" | "failed";
    startedAt: Date;
    heartbeatAt: Date | null;
    finishedAt?: Date | null;
    stats: Record<string, unknown>;
    error?: string | null;
  },
): Promise<string> {
  const def = await db
    .insertInto("scraper_definition")
    .values({ label, country: "HU", region: `orchk-${STAMP}`, industry: "accommodation" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  defIds.push(def.id);
  const run = await db
    .insertInto("scrape_run")
    .values({
      scraper_definition_id: def.id,
      status: row.status,
      started_at: row.startedAt,
      heartbeat_at: row.heartbeatAt,
      finished_at: row.finishedAt ?? null,
      stats: JSON.stringify(row.stats),
      error: row.error ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  runIds.push(run.id);
  return run.id;
}

try {
  const now = Date.now();
  // ① a szíve 10 perce megállt — pontosan a bejelentett eset
  const killedId = await openRun(L.killed, {
    status: "running",
    startedAt: STARTED,
    heartbeatAt: new Date(now - 10 * 60_000),
    stats: { phase: PHASE },
  });
  // ② életjel NÉLKÜLI, 3 órája nyitva álló régi futás (0066 előtti kód nyitotta)
  const legacyId = await openRun(L.legacy, {
    status: "running",
    startedAt: new Date(now - 3 * 60 * 60_000),
    heartbeatAt: null,
    stats: {},
  });
  // ③ életjel nélküli, de FIATAL régi futás — ez még dolgozhat, nem szabad bántani
  const youngLegacyId = await openRun(`${L.legacy}-fiatal`, {
    status: "running",
    startedAt: new Date(now - 10 * 60_000),
    heartbeatAt: null,
    stats: {},
  });
  // ④ élő futás: 20 másodperce dobbant
  const aliveId = await openRun(L.alive, {
    status: "running",
    startedAt: new Date(now - 5 * 60_000),
    heartbeatAt: new Date(now - 20_000),
    stats: { phase: PHASE },
  });
  // ⑤ lefutott + ⑥ saját hibájára bukott futás
  const doneId = await openRun(L.done, {
    status: "completed",
    startedAt: new Date(now - 60 * 60_000),
    heartbeatAt: new Date(now - 40 * 60_000),
    finishedAt: new Date(now - 40 * 60_000),
    stats: { players: 419, leads: 194 },
  });
  const brokeId = await openRun(L.broke, {
    status: "failed",
    startedAt: new Date(now - 90 * 60_000),
    heartbeatAt: new Date(now - 89 * 60_000),
    finishedAt: new Date(now - 89 * 60_000),
    stats: {},
    // ⚠️ VALÓS alakú hibaüzenet, URL-lel: a failScrapeRun a kivétel szövegét írja be
    // szó szerint, és abban törhetetlen token van. Az első fixture-öm csupa szép,
    // tördelhető próza volt — a pixel-mérés emiatt zöld maradt, miközben ÉPP a
    // hibaüzenet lógott ki 396 px-t (a tudásbázis-őr fogta meg, nem én).
    error:
      "request to https://maps.googleapis.com/maps/api/place/details/json?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4&fields=name,formatted_phone_number,website failed, reason: getaddrinfo ENOTFOUND maps.googleapis.com",
  });

  // A LISTA lekérése — a rendes úton, ami a takarítást is elvégzi. Az öntesztben a
  // takarítás kimarad: pontosan ez volt a javítás előtti állapot.
  const runs = SELF_TEST
    ? ((await db
        .selectFrom("scrape_run")
        .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
        .select([
          "scrape_run.id as id",
          "scraper_definition.label as regionLabel",
          "scrape_run.status as status",
          "scrape_run.started_at as startedAt",
          "scrape_run.finished_at as finishedAt",
          "scrape_run.heartbeat_at as heartbeatAt",
          "scrape_run.stats as stats",
          "scrape_run.error as error",
        ])
        .orderBy("scrape_run.created_at", "desc")
        .limit(40)
        .execute()) as unknown as ScrapeRunView[])
    : await getScrapeRuns(40);

  const html = SELF_TEST
    ? runs.map(preFixRunRow).join("")
    : scrapePage(IDLE_JOB, runs, [{ id: "badacsony", label: "Badacsony" }]);

  const dbRow = async (id: string) =>
    await db
      .selectFrom("scrape_run")
      .select(["status", "stats", "finished_at", "error"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

  console.log(
    SELF_TEST
      ? "\nÖNTESZT — a javítás ELŐTTI viselkedés (nincs takarítás, régi cellák):"
      : "\nscrape-életjel őr — valós DB-úton:",
  );

  // ① a néma futás lezáródik, és MEGSZAKADT-ként
  const killed = await dbRow(killedId);
  fix(
    "① a 10 perce néma futás LEZÁRÓDIK (nem marad örökre 'running')",
    killed.status === "failed" && killed.finished_at != null,
    `státusz=${killed.status}`,
  );
  fix(
    "① a lezárás MEGSZAKADT-ként áll az adatban (stats.interrupted), nem prózából kiolvasva",
    (killed.stats as { interrupted?: boolean })?.interrupted === true,
  );
  // ③ az utolsó fázis az elveszett napló helyett
  fix(
    "③ a lezárás megnevezi az UTOLSÓ FÁZIST (a memóriabeli napló nem élte túl)",
    typeof killed.error === "string" && killed.error.includes("Portál-adatlapok olvasása"),
    `error=${String(killed.error).slice(0, 60)}…`,
  );
  fix(
    "③ a lezárás megmondja, hogy az OK a kívülről leállítás (konzol-újraindítás)",
    typeof killed.error === "string" &&
      killed.error.includes("életjel") &&
      /konzol|kívülről/.test(killed.error),
  );
  // A magyarázat időpontja ugyanazon az órán álljon, mint felette az „Indult"
  // oszlop — különben a leállás korábbinak látszik, mint az indulás (a KB-őr
  // mérte 2026-09-13: „10:49:59" fölött „08:52:00 UTC").
  fix(
    "③ a lezárás időpontja az OLVASÓ óráján áll (nincs UTC-bélyeg a helyi idő alatt)",
    typeof killed.error === "string" && !killed.error.includes("UTC"),
    `error=${String(killed.error).slice(0, 80)}…`,
  );

  // ② régi, életjel nélküli futás: a kor ítéli el — de csak a régi
  const legacy = await dbRow(legacyId);
  fix(
    "② a 3 órája nyitva álló, életjel NÉLKÜLI (régi) futás is lezáródik",
    legacy.status === "failed",
    `státusz=${legacy.status}`,
  );
  const youngLegacy = await dbRow(youngLegacyId);
  inv(
    "② a 10 perce indult, életjel nélküli RÉGI futást NEM ítéljük halottnak (még dolgozhat)",
    youngLegacy.status === "running",
    `státusz=${youngLegacy.status}`,
  );

  // ⑦ élőt nem ölünk
  const alive = await dbRow(aliveId);
  inv(
    "⑦ a 20 másodperce dobbant futás ÉRINTETLEN marad",
    alive.status === "running" && alive.error === null,
    `státusz=${alive.status}`,
  );

  // ⑧ a lezárt futások érintetlenek
  const done = await dbRow(doneId);
  inv(
    "⑧ a lefutott futás érintetlen (státusz + számok)",
    done.status === "completed" && (done.stats as { players?: number }).players === 419,
  );

  // ④ a lapon a pill mondja ki
  const killedRow = rowOf(html, L.killed);
  fix(
    "④ a megszakadt futás pillje „megszakadt” — nem nyers 'running'/'failed'",
    killedRow.includes(">megszakadt<"),
    `sor=${killedRow.replace(/\s+/g, " ").slice(0, 120)}`,
  );
  fix(
    "④ a megszakadt sorban SEHOL nem szerepel a hazug 'running' szó",
    killedRow !== "" && !killedRow.includes(">running<"),
  );
  const brokeRow = rowOf(html, L.broke);
  fix(
    "⑧ a saját hibájára bukott futás „hibára futott” — a két történet nem mosódik össze",
    brokeRow.includes(">hibára futott<") && !brokeRow.includes(">megszakadt<"),
    `sor=${brokeRow.replace(/\s+/g, " ").slice(0, 120)}`,
  );
  const doneRow = rowOf(html, L.done);
  fix(
    "⑧ a lefutott futás „lefutott”-at ír (magyarul, nem 'completed')",
    doneRow.includes(">lefutott<"),
  );

  // ⑤ időzóna: a bejelentett futás 08:49:59-kor indult a tulaj óráján
  fix(
    "⑤ az „Indult” cella az OLVASÓ óráján áll: 08:49:59 (nem a szerver UTC-je: 06:49:59)",
    killedRow.includes("08:49:59") && !killedRow.includes("06:49:59"),
    `sor=${killedRow.replace(/\s+/g, " ").slice(0, 140)}`,
  );

  // ⑥ a futó sor megmondja, hol tart
  const aliveRow = rowOf(html, L.alive);
  fix(
    "⑥ a FUTÓ sor megmondja, hol tart (fázis a soron)",
    aliveRow.includes("Portál-adatlapok olvasása"),
    `sor=${aliveRow.replace(/\s+/g, " ").slice(0, 140)}`,
  );
  fix(
    "⑥ a FUTÓ sor megmondja, mikor adott utoljára életjelet",
    aliveRow.includes("életjel:"),
  );

  // ⑨ a deploy-kapu ott áll, ahol az ölés történik (szerkezeti mérés a scripten)
  const deploy = readFileSync(new URL("./deploy-prod.sh", import.meta.url), "utf8");
  const calls = [...deploy.matchAll(/^scrape_gate /gm)].map((m) => m.index ?? -1);
  // A VÉGREHAJTÓ sor, nem a róla szóló komment: a kapu indoklása maga is idézi a
  // parancsot, és az idézet korábban áll — erre az őr első vágása rá is bukott.
  const restartAt = deploy.indexOf('$SSH "systemctl restart citoviso-console"');
  inv(
    "⑨ a deploy GATE 4 kétszer fut (a deploy elején és közvetlenül a restart előtt)",
    calls.length === 2,
    `hívások: ${calls.length}`,
  );
  inv(
    "⑨ a második GATE 4 hívás a console-restart ELŐTT áll",
    calls.length === 2 && calls[1]! < restartAt && restartAt > 0,
  );

  // ⑩ PIXEL — a mondat OLVASHATÓ-e 390px-en. Külön kapcsolóra fut (böngészőt indít).
  if (PIXEL) {
    const { chromium } = await import("playwright-core");
    process.env.CIT_SHOT = "1";
    process.env.CONSOLE_PORT = "0";
    const { once } = await import("node:events");
    const { server } = (await import("../src/console/server.js")) as {
      server: import("node:http").Server;
    };
    if (!server.listening) await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
    const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
    const op = await db
      .selectFrom("operator_user")
      .select("id")
      .limit(1)
      .executeTakeFirstOrThrow();
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([
      {
        name: "cit_op_session",
        value: mintOperatorCookieValue(op.id),
        url: `http://localhost:${addr.port}`,
      },
    ]);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${addr.port}/scrape`, { waitUntil: "networkidle" });
    // A MÉRCE a vágó ős doboza, nem a képernyő: a .tblwrap görget, tehát ő vágja.
    const measure = async () =>
      await page.evaluate(() =>
        [...document.querySelectorAll("td.rownote > span")].map((el) => {
          const box = el.getBoundingClientRect();
          const wrap = el.closest(".tblwrap")!.getBoundingClientRect();
          return {
            overRight: Math.round(box.right - wrap.right),
            overLeft: Math.round(wrap.left - box.left),
            textOver: Math.round(
              (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth,
            ),
            text: (el.textContent ?? "").slice(0, 40),
          };
        }),
      );
    const atRest = await measure();
    // ⚠️ ÉS OLDALRA HÚZVA IS. A súgó maga küldi a felhasználót erre (a Szereplő/Lead
    // oszlop csak így látszik), tehát a mondatnak OTT is olvashatónak kell lennie.
    // Mérve: a tapadás a cellán némán hatástalan volt, és teljes húzás után a
    // magyarázat minden sora szó közepén levágódott — nyugalmi helyzetben viszont
    // a mérés zöld maradt (a tudásbázis-őr fogta meg).
    await page.evaluate(() => {
      const w = document.querySelector(".tblwrap")!;
      w.scrollLeft = w.scrollWidth;
    });
    await page.waitForTimeout(150);
    const swiped = await measure();
    await browser.close();
    server.close();
    inv("⑩ van mit mérni (a lapon vannak magyarázó sorok)", atRest.length > 0);
    for (const [i, m] of atRest.entries()) {
      const s = swiped[i]!;
      inv(
        `⑩ 390px: a mondat a LÁTHATÓ dobozon belül van — nyugalomban ÉS oldalra húzva — „${m.text}…”`,
        m.overRight <= 0 && m.textOver <= 0 && s.overRight <= 0 && s.overLeft <= 0,
        `nyugalom: jobbra ${m.overRight}px · húzva: balra ${s.overLeft}px / jobbra ${s.overRight}px · szöveg-túlcsordulás: ${m.textOver}px`,
      );
    }
  }
} finally {
  for (const id of runIds) await db.deleteFrom("scrape_run").where("id", "=", id).execute();
  for (const id of defIds) await db.deleteFrom("scraper_definition").where("id", "=", id).execute();
  await db.destroy();
}

if (failures.length) {
  console.error(`\n⛔ scrape-életjel őr: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: a javítás előtti viselkedésen minden mérés pirosra vált — az őr a szabályt méri."
    : "\n✅ A scrape-lista a futásról mond igazat: a megszakadt futás kimondja magát, a futó megmondja hol tart, és az idő az olvasó óráján áll.",
);
