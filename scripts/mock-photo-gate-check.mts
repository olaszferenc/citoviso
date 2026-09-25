// MOCK-PHOTO-GATE őr — törött KÉPES és KÉP NÉLKÜLI mock sem hagyható jóvá, sem
// küldhető ki (ADR-0134 + ADR-0150).
//
//   npx tsx scripts/mock-photo-gate-check.mts [--self-test] [--sweep]
//
// ⛔⛔ MÁSODIK MÉRT HIBA (2026-09-14, Elek FK-004b GY-1): a kapu verdiktje
// `broken.length ? "broken" : "ok"` volt, tehát a NULLA fotós lap „ok"-ot kapott és
// simán kiment volna. A kapu nem tévedett — MÁS KÉRDÉSRE válaszolt: azt mérte, hogy
// a meglévő képek élnek-e, nem azt, hogy VAN-E egyáltalán kép. Az ADR-0136 óta a
// generálás eldobja a halott fotókat, vagyis a „törött" eset helyét egyre inkább a
// „nincs kép" veszi át — pont az, amire vak volt.
//
// ⛔⛔ MÉRT HIBA (2026-09-13, Elek FK-003b L01): a kurátor-lap SAJÁT piros sávja
// kimondta, hogy „4 kép forrása nem érhető el — ezek a képek a LEADNEK kiküldött
// lapon is törötten jelennek meg", mind a négy nyitókép-csempe „nincs kép / 404-et
// ad" volt — és a „Jóváhagyás" akadálytalanul átment, a visszaigazolás egy szót sem
// szólt a képekről, majd a felület azonnal felkínálta a követett linket.
//
// ⚠️ EZ AZ ŐR NEM FIXTURE-ÖN MÉR. A ház visszatérő hibamintája, hogy a kapu a
// fixture-ön mér, nem azon az úton, amin az adat kimegy. Ezért:
//   ① a lapot a TERMÉK renderelője (`src/generator/render.ts`) állítja elő,
//   ② a kép-listát VALÓDI CHROMIUM adja — az őr NEM azzal a `extractImageRefs`-szel
//      méri magát, amit vizsgál (feedback_guard_must_not_borrow_its_subject),
//   ③ a kaput VALÓDI HTTP-n, a VALÓDI konzol-szerveren, VALÓDI DB-soron nyomjuk meg,
//   ④ a `--sweep` a park TÉNYLEGES jóváhagyott artefaktumait nézi meg a lemezen.
//
// A MÉRÉS FORRÁSA egy helyi kép-szerver: `/ok.png` 200 image/png, `/dead.png` 404.
// Valódi HTTP, determinisztikus, hálózat-független — a portál 404-je pontosan ez.
//
// --self-test MEGGYÓGYÍTJA a renderelt lapot (a halott kép helyére élő kerül), és
// az őrnek ettől PIROSRA kell mennie: ha zöld marad, akkor nem a valós kimenetből
// dolgozik, hanem egy beégetett elvárásból.

import http from "node:http";
import { once } from "node:events";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const selfTest = process.argv.includes("--self-test");
const sweepOnly = process.argv.includes("--sweep");

let fails = 0;
let skipped = 0;
const check = (cond: boolean, msg: string, why = ""): void => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${msg}${cond || !why ? "" : `\n       → ${why}`}`);
};
/** ⛔ A kimaradt próba NEM zöld: hangosan kiírjuk, mit NEM mértünk meg. */
const skip = (msg: string, why: string): void => {
  skipped++;
  console.log(`  ⏭️  KIMARADT: ${msg}\n       → ${why}`);
};

// Egy valódi, 1×1 png — a `fetchPhoto` `image/` content-type-ot ÉS képet vár.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * ⛔⛔ A FIXTURE FUTÁSONKÉNT EGYEDI (2026-09-15). A `sites/` és a dev-DB KÖZÖS minden
 * worktree-nek, és a név eddig állandó volt — két párhuzamos futás tehát EGYMÁS sorait
 * és fájljait törölte a `cleanup()`-jában. Mérve: egy commit-körben a 390 px-es rész
 * zölden lefutott, majd az 1280-as ág „nincs kapu-doboz"-t jelentett, mert közben egy
 * MÁSIK fa ugyanezt az őrt futtatta. Egy ingadozó őr rosszabb, mint a hiányzó: a pirosát
 * megszokják. A `pid` a folyamathoz köti a fixture-t, a takarítás pedig CSAK a sajátját
 * viszi. (Rokon: reference_shared_sites_fixture_race.)
 */
const RUN_ID = String(process.pid);
const WORK = path.resolve(process.cwd(), `sites/_photo-gate-check-${RUN_ID}`);
const FIXTURE_LEAD = `ŐR-photo-gate-${RUN_ID}`;

/**
 * ⛔⛔ A SZERKEZETI MÉRÉS A SAJÁT FÁJÁT OLVASSA, nem a cwd-ét (mérve 2026-09-14).
 *
 * Az őr `import`-jai a SCRIPT helyéhez képest oldódnak fel (ez a worktree), a
 * `readFile(path.resolve(process.cwd(), …))` viszont a MUNKAKÖNYVTÁRHOZ — és a
 * `--sweep` miatt az őrt a FŐ FÁBÓL szokás futtatni. Így a szerkezeti állítások a fő
 * fa forrását mérték, miközben a viselkedési részek az enyémet: ugyanaz a hibaosztály,
 * ami egyszer már négy kész javítást jelentett hiányzónak. A mérés tárgya innentől
 * mindig AZ A FA, amelyikből az őr fut.
 */
const SRC_ROOT = path.resolve(import.meta.dirname, "..");

async function main(): Promise<void> {
  // ── Helyi kép-forrás: egy élő és egy halott kép, valódi HTTP-n ───────────────
  const imgSrv = http.createServer((req, res) => {
    if ((req.url ?? "").startsWith("/ok")) {
      res.writeHead(200, { "content-type": "image/png", "content-length": PNG_1X1.length });
      return res.end(PNG_1X1);
    }
    // Pontosan az, amit a hovamenjek.hu ad: 404 + HTML hibalap.
    res.writeHead(404, { "content-type": "text/html;charset=utf-8" });
    res.end("<html><body>Nincs ilyen kép.</body></html>");
  });
  imgSrv.listen(0, "127.0.0.1");
  await once(imgSrv, "listening");
  const imgPort = (imgSrv.address() as { port: number }).port;
  const OK = (n: number): string => `http://127.0.0.1:${imgPort}/ok${n}.png`;
  const DEAD = (n: number): string => `http://127.0.0.1:${imgPort}/dead${n}.png`;

  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });

  // ── ① A TERMÉK renderelője állítja elő a lapot ───────────────────────────────
  const { render } = await import("../src/generator/render.js");
  const mockData = (photos: string[], hero: string) => ({
    name: "ŐR-photo-gate Vendégház",
    // A terület NEVE (0067) — nem partoldal-állítás: a doboz az egész tavat fedi,
    // és a fixture címe Balatonbogláron (DÉLI part) van.
    region: "Balaton",
    regionTagline: "Őr-futás — nem valódi szállás",
    heroImage: hero,
    photos,
    intro: "Ez a lap az őr méréséhez készült, a termék renderelőjével.",
    features: [{ icon: "location" as const, label: "Parton" }],
    phone: "+36 30 000 0000",
    email: "or@example.invalid",
    address: "Balatonboglár, Teszt utca 1.",
  });

  // A TÖRÖTT lap: a nyitókép és két galéria-kép él, KETTŐ halott.
  const brokenHtmlReal = render(mockData([OK(1), DEAD(1), OK(2), DEAD(2)], OK(1)));
  // --self-test: MEGGYÓGYÍTJUK a lapot. Az őrnek ettől pirosra kell mennie.
  const brokenHtml = selfTest
    ? brokenHtmlReal.replace(/dead\d\.png/g, "ok1.png")
    : brokenHtmlReal;
  const healthyHtml = render(mockData([OK(1), OK(2)], OK(1)));
  // ⛔⛔ A NULLA FOTÓS LAP (ADR-0150) — a termék renderelője, üres fotó-halmazzal.
  // --self-test: ADUNK NEKI EGY ÉLŐ KÉPET, amitől a lap „ok" lesz, és az őr minden
  // nulla-fotós állításának PIROSRA kell mennie. Ha zöld marad, nem a valós
  // kimenetből dolgozik.
  const nophotoHtml = selfTest ? render(mockData([OK(1)], OK(1))) : render(mockData([], ""));

  const brokenFile = path.join(WORK, "mock-or-photo-gate-broken.html");
  const healthyFile = path.join(WORK, "mock-or-photo-gate-healthy.html");
  const nophotoFile = path.join(WORK, "mock-or-photo-gate-nophoto.html");
  await writeFile(brokenFile, brokenHtml, "utf8");
  await writeFile(healthyFile, healthyHtml, "utf8");
  await writeFile(nophotoFile, nophotoHtml, "utf8");

  const {
    extractImageRefs,
    probeImageRefs,
    photoGateBlocks,
    noPhotoAckOf,
    isUsableAckReason,
    MIN_ACK_REASON_CHARS,
  } = await import("../src/outreach/mockPhotoHealth.js");

  // ── ② FÜGGETLEN REFERENCIA: mit kér le a VALÓDI böngésző? ────────────────────
  console.log("\n① A kivonat nem vak — valódi Chromium a független referencia");
  const browser = await chromium.launch();
  const requested = new Set<string>();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("request", (r) => {
      if (r.resourceType() === "image") requested.add(r.url());
    });
    await page.goto(`file://${brokenFile}`, { waitUntil: "networkidle", timeout: 30000 });
    // A galéria `loading="lazy"` — ami a képernyőn kívül van, sosem indulna el, és
    // a lead pont azt görgeti le. Előbb eagerré tesszük, aztán végiggörgetünk.
    await page.evaluate(`(() => {
      for (const i of Array.from(document.images)) i.loading = 'eager';
      window.scrollTo(0, document.body.scrollHeight);
    })()`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
  } finally {
    await browser.close();
  }
  const extracted = new Set(extractImageRefs(brokenHtml).map((r) => r.url));
  const missed = [...requested].filter((u) => !extracted.has(u));
  check(
    requested.size >= 3,
    `a böngésző ${requested.size} kép-kérést indított a renderelt lapon`,
    "ha a böngésző nem tölt képet, az egész összevetés értelmetlen",
  );
  check(
    missed.length === 0,
    "a kivonat MINDEN böngésző által lekért képet lát",
    `kimaradt: ${missed.join(" · ")}`,
  );

  // ── ③ A MÉRÉS: melyik kép halott, és MIÉRT ───────────────────────────────────
  console.log("\n② A mérés a valódi HTTP-választ olvassa");
  const refs = extractImageRefs(brokenHtml);
  const broken = await probeImageRefs(refs, "hu");
  check(
    broken.length === 2,
    `a két halott kép pontosan megvan (${broken.length} törött)`,
    `talált: ${broken.map((b) => b.url).join(" · ") || "semmi"}`,
  );
  check(
    broken.every((b) => /404/.test(b.reason)),
    "a mondat a VALÓDI okot közli (404), nem azt, hogy „nem ítélt”",
    broken.map((b) => b.reason).join(" | "),
  );
  const healthyBroken = await probeImageRefs(extractImageRefs(healthyHtml), "hu");
  check(
    healthyBroken.length === 0,
    "az ép lapon NINCS törött kép (az őr nem mindenre mond pirosat)",
    healthyBroken.map((b) => b.url).join(" · "),
  );

  // ── ④ A KAPU-PREDIKÁTUM igazságtáblája ───────────────────────────────────────
  console.log("\n③ Egy predikátum dönt — és a tudomásulvétel NÉVSORRA szól");
  const h = (verdict: string, urls: string[]) =>
    ({
      artifactId: "x",
      verdict,
      checked: urls.length,
      unmeasured: 0,
      broken: urls.map((u) => ({ url: u, reason: "404", where: "img", refs: 1 })),
    }) as never;
  const brokenAck = (urls: string[]) => ({ at: "2026-09-13T00:00:00Z", by: "console", urls });
  const NO_ACKS = { broken: null, noPhoto: null };
  const ack = (urls: string[]) => ({ broken: brokenAck(urls), noPhoto: null });
  check(!photoGateBlocks(h("ok", []), NO_ACKS), "ép lap ack nélkül is átmegy");
  check(photoGateBlocks(h("broken", [DEAD(1)]), NO_ACKS), "törött lap ack NÉLKÜL blokkol");
  check(
    !photoGateBlocks(h("broken", [DEAD(1)]), ack([DEAD(1)])),
    "törött lap a LEFEDŐ tudomásulvétellel átmegy (a kurátor joga megmarad)",
  );
  check(
    photoGateBlocks(h("broken", [DEAD(1), DEAD(2)]), ack([DEAD(1)])),
    "a RÉSZLEGES tudomásulvétel NEM fedez — ami azóta esett ki, arról nem döntött",
  );
  check(
    photoGateBlocks(h("unknown", []), ack([DEAD(1)])),
    "a renderelt fájl HIÁNYA egy régi pipával sem nyugtázható le",
    "különben az üres törött-listán az `every` igazat adna",
  );

  // ── ⛔⛔ A NULLA FOTÓS LAP (ADR-0150) — ez a rés, amit az FK-004b GY-1 talált ──
  console.log("\n③a Kép NÉLKÜLI lap — a kapu nem mondhat rá zöldet");
  const npAck = (reason: string) => ({
    broken: null,
    noPhoto: { at: "2026-09-14T00:00:00Z", by: "console", reason },
  });
  check(
    photoGateBlocks(h("nophoto", []), NO_ACKS),
    "⭐⭐ KÉP NÉLKÜLI lap tudomásulvétel NÉLKÜL BLOKKOL",
    "ez volt a rés: a 0 fotós lap ÉP verdiktet kapott, és a kiküldés-kapu átengedte",
  );
  check(
    photoGateBlocks(h("nophoto", []), ack([DEAD(1)])),
    "a TÖRÖTT-KÉP tudomásulvétel NEM fedezi a kép nélküli lapot",
    "más kérdésre adott válasz — a névsor egy üres lapról semmit nem állít",
  );
  check(
    !photoGateBlocks(h("nophoto", []), npAck("a tulaj a saját képeit tölti majd fel")),
    "INDOKOLT tudomásulvétellel átmegy (nem vak tiltás — a kurátor vállalhatja)",
  );
  check(
    photoGateBlocks(h("nophoto", []), { broken: null, noPhoto: noPhotoAckOf({ noPhotoAck: { at: "x", by: "console", reason: "ok" } }) }),
    "az INDOKLÁS NÉLKÜLI (két betűs) pipa NEM tudomásulvétel — továbbra is blokkol",
    "különben a kötelező mező egy néma pipa második példánya lenne",
  );
  check(
    !isUsableAckReason("") && !isUsableAckReason("   ") && !isUsableAckReason("rövid") &&
      isUsableAckReason("a tulaj a saját képeit tölti fel"),
    `az indoklás-küszöb ${MIN_ACK_REASON_CHARS} karakter, trim után (üres/szóköz/rövid nem elég)`,
  );
  check(
    noPhotoAckOf({ noPhotoAck: { at: "x", by: "console", reason: "a portálon sincs fotója" } }) !== null &&
      noPhotoAckOf({}) === null,
    "a tudomásulvétel az artefaktum `inputs.noPhotoAck` mezőjéből olvasható vissza",
  );

  // ── ⭐ A PREDIKÁTUM ÉRVÉNYESSÉGE: „0 kép-hivatkozás" == „0 szállás-fotó"? ─────
  // A `nophoto` verdikt a kép-hivatkozások SZÁMÁRA néz. Ez csak addig azonos a
  // „nincs szállás-fotó"-val, amíg egyetlen sablon sem tesz dekoratív képet a
  // fotótlan lapra. Ha egy új sablon mégis tenne, a kapu NÉMÁN vakká válna rá —
  // ezért mérjük meg MINDEN sablonon, mindkét fázisban.
  console.log("\n③c A predikátum érvényessége — fotó nélkül egyetlen sablon sem tesz képet a lapra");
  {
    const { renderSite } = await import("../src/engine/render.js");
    const { TEMPLATES } = await import("../src/engine/templates.js");
    const bare = {
      name: "ŐR Vendégház",
      tagline: "Őr-futás",
      intro: "Őr-futás — nem valódi szállás.",
      highlights: ["Kert", "Parkoló"],
      photos: [],
      contact: { email: "or@example.invalid", phone: "+36300000000" },
      rooms: [{ name: "Padlásszoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
      amenities: ["Wifi", "Parkoló"],
      // ADR-0214: programs (title + date + place + source), not typed place lines.
      poi: [{ title: "Szüreti napok", start: "2026-09-26", end: null, settlement: "Révfülöp", distanceKm: null, sourceUrl: "https://example.com/programok", sourceHost: "example.com" }],
      location: { showMap: true, approachNote: "A templomnál jobbra.", parkingNote: "" },
      reviews: [{ quote: "Nagyon jó volt.", author: "Anna" }],
      googleRating: { value: 4.9, count: 143, url: "https://example.com/reviews" },
    } as never;
    const offenders: string[] = [];
    let measured = 0;
    for (const t of Object.keys(TEMPLATES)) {
      const rec = { template: t, skin: "", archetype: "", sections: [] } as never;
      for (const phase of ["live", "mock"] as const) {
        const html = renderSite(rec, bare, phase === "live" ? { phase } : {});
        measured++;
        const n = extractImageRefs(html).length;
        if (n) offenders.push(`${t}/${phase}:${n}`);
      }
    }
    check(
      measured >= 2 * Object.keys(TEMPLATES).length,
      `mind a ${Object.keys(TEMPLATES).length} sablon megmérve, mindkét fázisban (${measured} mérés)`,
    );
    check(
      offenders.length === 0,
      "⭐ fotó nélkül EGYETLEN sablon sem hagy kép-hivatkozást a lapon (a `nophoto` predikátum érvényes)",
      `ha ez pirosra megy, a kapu NEM veszi észre a fotótlan lapot azon a sablonon: ${offenders.join(" · ")}`,
    );
  }
  // ⛔⛔ ADR-0140: a FELÜLÍRT fájl akkor is blokkol, ha a képek ÉPEK — itt nem a képpel
  // van baj, hanem azzal, hogy az artefaktum linkje egy MÁSIK mock tartalmát mutatná.
  const stale = (verdict, urls) => ({
    ...(h(verdict, urls)),
    staleFile: { newerId: "újabb-artefaktum", newerAt: "2026-09-13T20:38:26Z" },
  });
  check(
    photoGateBlocks(stale("ok", []), NO_ACKS),
    "a FELÜLÍRT renderelt fájl ÉP képekkel is blokkol (nem a sajátját szolgálná ki)",
    "ha ez átmenne, a kurátor pipája egy azóta fölé írt tartalomra szólna",
  );
  check(
    photoGateBlocks(stale("ok", []), ack([DEAD(1)])),
    "a felülírt fájl TUDOMÁSUL SEM VEHETŐ",
  );

  // ── EGY ARTEFAKTUM = EGY FÁJL (ADR-0140) ────────────────────────────────────
  // A fájlnév eddig a lead nevéből és a sablonból állt, tehát az ÚJRAGENERÁLÁS
  // felülírta a korábbi artefaktum lapját (mérve: 10 fájlon 29 artefaktum). A név
  // most az AZONOSÍTÓBÓL származik — ez a két állítás ezt szögezi le.
  console.log("\n③b Egy artefaktum = egy fájl");
  const { mockArtifactPath } = await import("../src/generator/persist.js");
  const p1 = mockArtifactPath("Erzsébet Vendéglő", "fullbleed", "11111111-2222-3333-4444-555555555555");
  const p2 = mockArtifactPath("Erzsébet Vendéglő", "fullbleed", "99999999-8888-7777-6666-555555555555");
  check(p1 !== p2, "ugyanaz a lead + sablon KÉT azonosítóval KÉT fájlt ad", `${p1} vs ${p2}`);
  check(
    p1.includes("11111111") && p2.includes("99999999"),
    "a fájlnév az artefaktum AZONOSÍTÓJÁBÓL származik (nem csak a nevéből)",
    `${p1} · ${p2}`,
  );
  // ⛔ SZERKEZETI IKER: a szabály egy helyen éljen. Ha valaki visszateszi a
  // „mock-${...}.html" mintát a generátorba, a név megint nem lesz egyedi — és ez
  // pont az a hiba, amit ez az egész szakasz javít.
  for (const f of ["src/generator/generate.ts", "src/generator/generateEngine.ts"]) {
    const src = await readFile(path.resolve(SRC_ROOT, f), "utf8");
    const handRolled = /`mock-\$\{[^`]*\}\.html`/.test(src);
    check(!handRolled, `${f}: nem épít kézzel mock-fájlnevet (a helperből kéri)`);
    check(src.includes("mockArtifactPath("), `${f}: a közös névadót hívja`);
  }

  // ── ⑤ A KAPU A VALÓDI ÚTON: DB-sor + konzol-szerver + HTTP ───────────────────
  console.log("\n④ A kapu a VALÓDI konzol-úton (HTTP, DB-sor, renderelt fájl)");
  process.env.CIT_SHOT = "1"; // no boot self-heal: no AI top-ups, no writes to the SHARED language packs
  process.env.CONSOLE_PORT = "0";
  const { db } = await import("../src/db/client.js");
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");

  const cleanup = async (): Promise<void> => {
    const ids = await db.selectFrom("lead").select("id").where("name", "=", FIXTURE_LEAD).execute();
    for (const { id } of ids) {
      const arts = await db.selectFrom("mock_artifact").select("id").where("lead_id", "=", id).execute();
      for (const a of arts) {
        await db.deleteFrom("prospect").where("mock_artifact_id", "=", a.id).execute();
        await db.deleteFrom("curator_decision").where("mock_artifact_id", "=", a.id).execute();
      }
      await db.deleteFrom("prospect").where("lead_id", "=", id).execute();
      await db.deleteFrom("mock_artifact").where("lead_id", "=", id).execute();
      await db.deleteFrom("lead").where("id", "=", id).execute();
    }
  };
  // Egy korábbi, megszakadt futás maradéka sosem ülhet bele ebbe a körbe.
  await cleanup();

  try {
    // Own parent instead of a borrowed run (scripts/lib/fixture-parent.mts) — the "üres park"
    // skip is gone with it: the gate always has a parent to seed under.
    const { createFixtureParent } = await import("./lib/fixture-parent.mts");
    const parent = await createFixtureParent(db as never, "mockphoto");
    const run = { id: parent.runId };
    {
      const lead = await db
        .insertInto("lead")
        .values({ scrape_run_id: run.id, name: FIXTURE_LEAD, qualification: "no_site" } as never)
        .returning("id")
        .executeTakeFirstOrThrow();
      const mkArtifact = async (file: string) =>
        (
          await db
            .insertInto("mock_artifact")
            .values({
              lead_id: lead.id,
              // A `path` a cwd-hez képest oldódik fel — ugyanúgy, ahogy a generátor írja.
              path: path.relative(process.cwd(), file),
              status: "generated",
              inputs: JSON.stringify({ engine: "template", photos: 4 }),
            } as never)
            .returning("id")
            .executeTakeFirstOrThrow()
        ).id as string;
      const brokenArt = await mkArtifact(brokenFile);
      const healthyArt = await mkArtifact(healthyFile);
      const nophotoArt = await mkArtifact(nophotoFile);

      const { server } = (await import("../src/console/server.js")) as { server: http.Server };
      if (!server.listening) await once(server, "listening");
      const port = (server.address() as { port: number }).port;
      const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirstOrThrow();
      const cookie = `cit_op_session=${mintOperatorCookieValue(op.id as string)}`;
      const base = `http://127.0.0.1:${port}`;
      const post = async (p: string, body: Record<string, string>): Promise<Response> =>
        fetch(`${base}${p}`, {
          method: "POST",
          redirect: "manual",
          headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded",
            referer: `${base}/lead/${lead.id}`,
          },
          body: new URLSearchParams(body).toString(),
        });
      const statusOf = async (id: string): Promise<string> =>
        ((
          await db.selectFrom("mock_artifact").select("status").where("id", "=", id).executeTakeFirst()
        )?.status ?? "?") as string;

      // (a) Törött lap jóváhagyása — a kapunak meg kell tagadnia.
      const r1 = await post(`/artifact/${brokenArt}/curate`, { decision: "approve" });
      check(
        (await statusOf(brokenArt)) === "generated",
        "törött képes mock jóváhagyása NEM megy át",
        `státusz a kattintás után: ${await statusOf(brokenArt)}`,
      );
      check(
        (r1.headers.get("location") ?? "").includes("photoGate="),
        "a megtagadás a kép-kapu képernyőjére visz (nem néma)",
        r1.headers.get("location") ?? "(nincs Location)",
      );

      // (b) …és a lap KIÍRJA, melyik kép, miért, és mi a következménye.
      const gatePage = await fetch(`${base}/lead/${lead.id}?photoGate=${brokenArt}`, {
        headers: { cookie },
      }).then((r) => r.text());
      check(
        gatePage.includes("A jóváhagyás NEM történt meg"),
        "a képernyő kimondja, hogy a jóváhagyás elmaradt",
      );
      check(
        /kép forrása nem érhető el/.test(gatePage) && /404/.test(gatePage),
        "a képernyő megnevezi a KÖVETKEZMÉNYT és a valódi okot (404)",
      );
      check(
        gatePage.includes("dead1.png") || gatePage.includes("dead2.png"),
        "a képernyő MEGNEVEZI a törött képet (nem csak egy darabszámot mond)",
      );

      // (c) ÉP lap — ugyanez a kapu NEM akadályozhatja. (Egy mindig-blokkoló kapu
      //     ugyanolyan hibás, mint egy mindig-átengedő.)
      await post(`/artifact/${healthyArt}/curate`, { decision: "approve" });
      check(
        (await statusOf(healthyArt)) === "approved",
        "ÉP mock jóváhagyása akadálytalanul átmegy",
        `státusz: ${await statusOf(healthyArt)}`,
      );

      // (d) Követett link a törött mockhoz — a kiküldés-út ugyanazt a kaput viseli.
      //     (Az ép mock épp approved, ezért a link-űrlap ahhoz készülne; itt a
      //     törött artefaktumot adjuk meg kifejezetten, ahogy az űrlap teszi.)
      const prospectsBefore = await db
        .selectFrom("prospect")
        .select("id")
        .where("lead_id", "=", lead.id)
        .execute();
      const r2 = await post(`/lead/${lead.id}/prospect`, {
        artifactId: brokenArt,
        segment: "nincs_honlap",
      });
      const prospectsAfter = await db
        .selectFrom("prospect")
        .select("id")
        .where("lead_id", "=", lead.id)
        .execute();
      check(
        prospectsAfter.length === prospectsBefore.length,
        "törött mockhoz NEM készül követett link",
        `${prospectsBefore.length} → ${prospectsAfter.length} prospect`,
      );
      check(
        (r2.headers.get("location") ?? "").includes("photoGateWhere=prospect"),
        "a megtagadás ott jelenik meg, AHOL a kattintás történt (Megkeresés fül)",
        r2.headers.get("location") ?? "(nincs Location)",
      );

      // (e) Kimondott tudomásulvétel — a kurátor joga megmarad, de nem véletlen.
      await post(`/artifact/${brokenArt}/curate`, { decision: "approve", ackBrokenPhotos: "1" });
      check(
        (await statusOf(brokenArt)) === "approved",
        "a KIMONDOTT tudomásulvétel után a jóváhagyás átmegy",
        `státusz: ${await statusOf(brokenArt)}`,
      );
      const ackRow = (
        await db
          .selectFrom("mock_artifact")
          .select("inputs")
          .where("id", "=", brokenArt)
          .executeTakeFirst()
      )?.inputs as { brokenPhotoAck?: { urls?: string[] } } | undefined;
      check(
        (ackRow?.brokenPhotoAck?.urls ?? []).length === 2,
        "a tudomásulvétel NÉVSORT rögzít az artefaktumra (nem egy üres pipát)",
        JSON.stringify(ackRow?.brokenPhotoAck ?? null),
      );

      // (f) A lap TOVÁBB romlik a jóváhagyás után — a régi pipa nem fedezi.
      await writeFile(
        brokenFile,
        brokenHtml.replace(`${OK(2)}`, `${DEAD(3)}`),
        "utf8",
      );
      const r3 = await post(`/lead/${lead.id}/prospect`, {
        artifactId: brokenArt,
        segment: "nincs_honlap",
      });
      const after2 = await db
        .selectFrom("prospect")
        .select("id")
        .where("lead_id", "=", lead.id)
        .execute();
      check(
        after2.length === prospectsBefore.length &&
          (r3.headers.get("location") ?? "").includes("photoGate="),
        "a jóváhagyás UTÁN kiesett képre a régi tudomásulvétel NEM érvényes",
        `prospect: ${after2.length}, Location: ${r3.headers.get("location") ?? "-"}`,
      );
      await writeFile(brokenFile, brokenHtml, "utf8"); // vissza az eredetire

      // ── ⑦ A KÉP NÉLKÜLI LAP a VALÓDI konzol-úton (ADR-0150) ──────────────
      console.log("\n④b Kép NÉLKÜLI lap a valódi konzol-úton");
      const g1 = await post(`/artifact/${nophotoArt}/curate`, { decision: "approve" });
      check(
        (await statusOf(nophotoArt)) === "generated",
        "⭐⭐ kép NÉLKÜLI mock jóváhagyása NEM megy át",
        `státusz a kattintás után: ${await statusOf(nophotoArt)}`,
      );
      check(
        (g1.headers.get("location") ?? "").includes("photoGate="),
        "a megtagadás a kép-kapu képernyőjére visz (nem néma)",
        g1.headers.get("location") ?? "(nincs Location)",
      );
      const npPage = await fetch(`${base}/lead/${lead.id}?photoGate=${nophotoArt}`, {
        headers: { cookie },
      }).then((r) => r.text());
      check(
        /EGYETLEN szállás-fotó sincs/.test(npPage),
        "a képernyő a SAJÁT kérdésére válaszol (egyetlen fotó sincs), nem a törött-kép mondat 0-s példányával",
      );
      check(
        /FOTÓ NÉLKÜL menne ki/.test(npPage) && !/a mock képei törötten mennének ki[\s\S]{0,400}EGYETLEN szállás-fotó/.test(npPage),
        "a FEJLÉC sem állít törött képet egy kép nélküli lapról (§B.17)",
      );
      check(
        /Mégis kiküldöm fotó nélkül/.test(npPage) && /name="noPhotoReason"/.test(npPage),
        "⭐ a kivétel KÉT LÉPÉS: külön kattintás mögött nyíló, INDOKLÁST kérő űrlap (jóváhagyott B terv)",
      );
      check(
        /<details class="pg-exc"/.test(npPage) && /required minlength="10"/.test(npPage),
        "a kivétel JS NÉLKÜL is működik (details + natív required/minlength)",
      );
      // (g) A pipa INDOKLÁS NÉLKÜL nem elég — és a képernyő MEGMONDJA, mi hiányzik.
      const g2 = await post(`/artifact/${nophotoArt}/curate`, {
        decision: "approve",
        ackNoPhoto: "1",
        noPhotoReason: "  ok  ",
      });
      check(
        (await statusOf(nophotoArt)) === "generated",
        "⭐⭐ INDOKLÁS NÉLKÜLI vállalás NEM hagyja jóvá (a kivétel elszámoltatható)",
        `státusz: ${await statusOf(nophotoArt)}`,
      );
      check(
        (g2.headers.get("location") ?? "").includes("photoGateReason=missing"),
        "a hiányzó indoklás NEM néma elutasítás — a képernyő megnevezi",
        g2.headers.get("location") ?? "(nincs Location)",
      );
      const npErrPage = await fetch(
        `${base}/lead/${lead.id}?photoGate=${nophotoArt}&photoGateReason=missing`,
        { headers: { cookie } },
      ).then((r) => r.text());
      check(
        /Az indoklás kötelező/.test(npErrPage) && /<details class="pg-exc" open>/.test(npErrPage),
        "a visszatérő képernyő KINYITVA mutatja az űrlapot, a hibaüzenettel",
      );
      // (h) Követett link a kép nélküli mockhoz — a kiküldés-út ugyanazt a kaput viseli.
      const npBefore = await db.selectFrom("prospect").select("id").where("lead_id", "=", lead.id).execute();
      const g3 = await post(`/lead/${lead.id}/prospect`, {
        artifactId: nophotoArt,
        segment: "nincs_honlap",
      });
      const npAfter = await db.selectFrom("prospect").select("id").where("lead_id", "=", lead.id).execute();
      check(
        npAfter.length === npBefore.length &&
          (g3.headers.get("location") ?? "").includes("photoGateWhere=prospect"),
        "kép NÉLKÜLI mockhoz NEM készül követett link",
        `${npBefore.length} → ${npAfter.length} prospect · ${g3.headers.get("location") ?? "-"}`,
      );
      // (i) INDOKOLT vállalás — a kurátor joga megmarad, de nyoma van.
      const g4 = await post(`/artifact/${nophotoArt}/curate`, {
        decision: "approve",
        ackNoPhoto: "1",
        noPhotoReason: "a tulaj telefonon azt kérte, a saját képeit ő tölti majd fel",
      });
      check(
        (await statusOf(nophotoArt)) === "approved",
        "INDOKOLT vállalás után a jóváhagyás átmegy (nem vak tiltás)",
        `státusz: ${await statusOf(nophotoArt)} · ${g4.headers.get("location") ?? "-"}`,
      );
      const npRow = (
        await db.selectFrom("mock_artifact").select("inputs").where("id", "=", nophotoArt).executeTakeFirst()
      )?.inputs as { noPhotoAck?: { by?: string; at?: string; reason?: string } } | undefined;
      check(
        (npRow?.noPhotoAck?.reason ?? "").includes("saját képeit") &&
          Boolean(npRow?.noPhotoAck?.by) &&
          Boolean(npRow?.noPhotoAck?.at),
        "⭐ a kivétel NAPLÓZVA: ki · mikor · MIÉRT az artefaktumon",
        JSON.stringify(npRow?.noPhotoAck ?? null),
      );

      // ── ⑦b A SZÁLLÍTOTT FELÜLET valódi böngészőben, MINDKÉT MÉRETEN ──────
      // ⛔ A HTML-ben megtalált `disabled` semmit nem mond arról, hogy a gomb
      // TILTOTTNAK IS LÁTSZIK-E, a rendezésről meg végképp semmit. A tulaj
      // telefonon dolgozik: a 390 px-es elrendezés ÖNÁLLÓ állítás.
      console.log("\n④b2 A megtagadás doboza valódi böngészőben (390 + 1280)");
      {
        const br = await chromium.launch();
        try {
          const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
          await ctx.addCookies([
            { name: "cit_op_session", value: cookie.split("=")[1]!, domain: "127.0.0.1", path: "/" },
          ]);
          for (const w of [390, 1280]) {
            const pg = await ctx.newPage();
            await pg.setViewportSize({ width: w, height: 1000 });
            await pg.goto(
              `${base}/lead/${lead.id}?photoGate=${nophotoArt}#a-${nophotoArt}`,
              { waitUntil: "networkidle" },
            );
            const summary = pg.locator("details.pg-exc summary").first();
            const hasBox = await summary.isVisible().catch(() => false);
            check(hasBox, `@${w}px: a kivétel nyitója LÁTHATÓ a dobozban`);
            // ⛔ HA NINCS OTT, a maradék mérés NEM dobhat kivételt: egy elszálló őr
            // hangosan bukik ugyan, de a TÖBBI állítását sosem mondja ki, és a
            // hibaüzenete egy Playwright-timeout, nem az, hogy MI hiányzik. (Ezt az
            // önteszt buktatta le: a meggyógyított lapon nincs kapu-doboz.)
            if (!hasBox) {
              check(false, `@${w}px: a megtagadás doboza nélkül a felület-mérés nem futtatható`,
                "nincs `details.pg-exc` a lapon — a kapu nem tagadta meg a kép nélküli mockot");
              await pg.close();
              continue;
            }
            await summary.click();
            const btn = pg.locator("[data-np-submit]").first();
            const ta = pg.locator("[data-np-reason]").first();
            const off = await btn.evaluate((e) => ({
              op: Number(getComputedStyle(e).opacity),
              disabled: (e as HTMLButtonElement).disabled,
            }));
            check(
              off.disabled && off.op < 1,
              `@${w}px: az üres indoklásnál a gomb NEM CSAK tiltott, hanem tiltottnak is LÁTSZIK (opacity ${off.op})`,
              "a tiltott gomb, ami aktívnak néz ki, kattintásra néma — pont a bizalom-hiba",
            );
            await ta.fill("a tulaj telefonon azt kérte, a saját képeit ő tölti majd fel");
            await pg.waitForTimeout(150);
            // ⛔⛔ A VÁRT SZÍN A TOKENBŐL SZÁRMAZIK, nem beégetett hexből. Az első
            // változatom `rgb(229, 72, 77)`-et hasonlított — és amikor egy MÁSIK kör a
            // felirat-színt olvashatóbbra vitte (`--citui-bad-ink`), ez az őr pirosra
            // ment egy HELYES javításra. A tű azt méri, amit egyszer már elkaptunk; az
            // állítás SZÁNDÉKA viszont az volt, hogy a `.con button` (0,1,1) ne írja
            // felül az osztály-szintű színt — ezt a token-PROBE mondja ki, nem a szám.
            const on = await btn.evaluate((e) => {
              const probe = document.createElement("span");
              probe.style.color = "var(--citui-bad-ink)";
              e.appendChild(probe);
              const expected = getComputedStyle(probe).color;
              probe.remove();
              return {
                disabled: (e as HTMLButtonElement).disabled,
                color: getComputedStyle(e).color,
                expected,
              };
            });
            check(!on.disabled, `@${w}px: érvényes indoklásra a gomb FELOLDÓDIK`);
            check(
              on.color === on.expected && on.expected !== "rgb(0, 0, 0)",
              `@${w}px: a gomb felirata a SZEMANTIKUS token (a .con button nem írja felül)`,
              `mért: ${on.color} · a --citui-bad-ink értéke: ${on.expected}`,
            );
            const layout = await pg.evaluate(`(() => {
              const f = document.querySelector('.pg-form textarea').getBoundingClientRect();
              const b = document.querySelector('[data-np-submit]').getBoundingClientRect();
              const row = document.querySelector('.pg-form .pg-fields').getBoundingClientRect();
              return { stacked: b.top >= f.bottom - 2, btnW: b.width, rowW: row.width };
            })()`) as { stacked: boolean; btnW: number; rowW: number };
            if (w === 390) {
              check(
                layout.stacked && layout.btnW > layout.rowW * 0.9,
                "@390px: a mező és a gomb EGYMÁS ALATT, a gomb teljes szélességű (hüvelykujj-cél)",
                `stacked=${layout.stacked} · gomb ${Math.round(layout.btnW)} / sor ${Math.round(layout.rowW)}`,
              );
            } else {
              check(
                !layout.stacked,
                "@1280px: a mező és a gomb EGY SORBAN (a szélesebb hely kihasználva)",
                `stacked=${layout.stacked}`,
              );
            }
            await pg.close();
          }
        } finally {
          await br.close();
        }
      }

      // ── ⑧ ADR-0129: a FIZETNI AKARÓ vevőt ez a kapu NEM tagadhatja meg ────
      // A vevő a saját szemével látta a lapot, és pont azt kérte. A kurátori kapu
      // azt őrzi, mit KÜLDÜNK KI — nem a pénztárat. Ha ez pirosra megy, a javításom
      // pont abba a hibába esett, amit az ADR-0129 tilt.
      console.log("\n④c A fizetni akaró vevő útja NEM állhat meg a kép-kapun (ADR-0129)");
      const buyerArt = await mkArtifact(nophotoFile);
      const { approveArtifactForBuyerOrder } = await import("../src/console/data.js");
      const promoted = await approveArtifactForBuyerOrder(buyerArt, "őr-rendelés");
      check(
        promoted.promoted && (await statusOf(buyerArt)) === "approved",
        "⭐⭐ a vevői rendelés kép NÉLKÜLI mockot is jóváhagy (a kapu a kiküldést őrzi, nem a pénztárat)",
        `promoted=${promoted.promoted} · státusz=${await statusOf(buyerArt)}`,
      );
      const src2 = await readFile(path.resolve(SRC_ROOT, "src/console/data.ts"), "utf8");
      check(
        !/photoGateBlocks\(/.test(src2),
        "a `curateArtifact` útján (data.ts) NINCS kép-kapu — a vevői emelés szerkezetileg sem akadhat el",
      );
    }
  } finally {
    await cleanup();
  }

  // ── ⑥ A KÜLDÉS-ÚT szerkezeti ellenőrzése ────────────────────────────────────
  // ⚠️ SZERKEZETI, nem viselkedési: a `sendOutreachMail` viselkedési próbájához a
  // teljes §C-lánc (piac-jóváhagyás, ár-megerősítés, nyelvi csomag, piszkozat)
  // előfeltétel, és egy korábbi kapu elnyelné a mérést — akkor az őr a ROSSZ okból
  // lenne zöld. Amit itt bizonyítunk: mindkét küldő-út MEGHÍVJA a kaput, és a hívás
  // a tényleges küldés ELŐTT van.
  console.log("\n⑤ A küldés-út (levél + SMS) viseli a kaput — szerkezeti mérés");
  for (const [file, sendMarker] of [
    ["src/outreach/sendBatch.ts", "getEmailSender("],
    ["src/outreach/sendOutreachSms.ts", "sendSms("],
  ] as const) {
    const src = await readFile(path.resolve(SRC_ROOT, file), "utf8");
    const gateAt = src.indexOf("photoGateBlocks(");
    const sendAt = src.indexOf(sendMarker);
    check(gateAt > 0, `${file}: meghívja a kép-kaput`);
    check(
      gateAt > 0 && sendAt > 0 && gateAt < sendAt,
      `${file}: a kapu a tényleges küldés ELŐTT fut`,
      `kapu@${gateAt} · küldés@${sendAt}`,
    );
    // ⛔ A KÉP NÉLKÜLI ág SAJÁT indoklást ad (ADR-0150): a törött-kép mondat itt
    // hamis lenne („0 kép forrása nem érhető el"), és az operátor a rossz kiutat
    // keresné. Az ág a küldés ELŐTT áll, mint a másik.
    const npAt = src.indexOf('verdict === "nophoto"');
    check(npAt > 0, `${file}: külön ága van a KÉP NÉLKÜLI lapnak`);
    check(
      npAt > 0 && sendAt > 0 && npAt < sendAt,
      `${file}: a kép nélküli ág is a küldés ELŐTT fut`,
      `nophoto@${npAt} · küldés@${sendAt}`,
    );
    check(
      /EGYETLEN szállás-fotó sincs/.test(src),
      `${file}: az indoklás megnevezi, hogy nincs fotó (nem törött képet emleget)`,
    );
  }

  imgSrv.close();
  await rm(WORK, { recursive: true, force: true });
}

/**
 * A PARK MÉRÉSE: van-e JÓVÁHAGYOTT artefaktum, ami törött képekkel menne ki.
 * Külön mód, mert hálózatot és park-adatot használ — egy pre-commit kapu nem
 * függhet attól, mit hagyott bent egy másik szál.
 */
let sweepMeasured = 0;

async function sweep(): Promise<void> {
  const { db } = await import("../src/db/client.js");
  const { assessMockPhotos, photoAcksOf, photoGateBlocks } = await import(
    "../src/outreach/mockPhotoHealth.js"
  );
  const rows = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select([
      "mock_artifact.id as id",
      "mock_artifact.path as path",
      "mock_artifact.inputs as inputs",
      "lead.name as leadName",
    ])
    .where("mock_artifact.status", "=", "approved")
    .execute();
  console.log(`\n🔎 ${rows.length} jóváhagyott artefaktum a parkban`);
  for (const r of rows) {
    if (!r.path || !existsSync(path.resolve(process.cwd(), r.path))) {
      console.log(`  ⏭️  ${r.leadName} — a renderelt fájl nincs ezen a fán (${r.path ?? "nincs path"})`);
      skipped++;
      continue;
    }
    const health = await assessMockPhotos(r.id as string);
    const blocks = photoGateBlocks(health, photoAcksOf(r.inputs));
    sweepMeasured++;
    check(
      !blocks,
      `${r.leadName} — ${health.checked} kép, ${health.broken.length} törött, verdikt=${health.verdict}`,
      health.verdict === "nophoto"
        ? "a lapon EGYETLEN kép-hivatkozás sincs — a lead kép nélküli oldalt kapna (ADR-0150)"
        : health.broken.map((b) => `${b.url} — ${b.reason}`).join("\n         "),
    );
  }
  await db.destroy();
}

console.log(`MOCK-PHOTO-GATE őr${selfTest ? " — ÖNTESZT (a törött ÉS a fotótlan lapot is meggyógyítottuk)" : ""}`);
await (sweepOnly ? sweep() : main());

if (skipped) console.log(`\n⚠️  ${skipped} próba KIMARADT (fent nevesítve) — ezekről nem állítunk semmit.`);

if (selfTest) {
  if (fails) {
    console.log(`\n✅ önteszt: az őr PIROSRA ment a meggyógyított lapon (${fails} bukás) — a valós kimenetből dolgozik.`);
    process.exit(0);
  }
  console.error("\n⛔ önteszt: az őr ZÖLD maradt egy ÉP lapon, miközben törést vár — nem a renderelt kimenetet méri.");
  process.exit(1);
}
if (fails) {
  console.error(`\n⛔ mock-photo-gate: ${fails} bukás`);
  process.exit(1);
}
// ⛔ A ZÖLD NEM MONDHAT TÖBBET, MINT AMENNYIT MÉRTÜNK. A `--sweep` egy WORKTREE-ből
// futtatva egyetlen artefaktumot sem lát (a `path` a cwd-hez képest oldódik fel, a
// mock-fájlok a fő fában vannak) — az „✅ nem küldhető ki" ott egy nulla mérésre írt
// pipa lenne. Mérve 2026-09-13: a fő fából 3 mérés (1 piros), worktree-ből 0.
if (sweepOnly) {
  if (!sweepMeasured) {
    console.error(
      "\n⛔ mock-photo-gate --sweep: EGYETLEN artefaktumot sem mértem meg (a renderelt fájlok " +
        "nincsenek ezen a fán). Futtasd a fő fából — innen a zöld semmit nem jelentene.",
    );
    process.exit(1);
  }
  console.log(`\n✅ mock-photo-gate --sweep: ${sweepMeasured} jóváhagyott artefaktum megmérve, mind kiküldhető.`);
  process.exit(0);
}
console.log(
  "\n✅ mock-photo-gate: sem a törött képes, sem a KÉP NÉLKÜLI mock nem hagyható jóvá és nem küldhető ki " +
    "— a kivétel kimondott és INDOKOLT, a fizetni akaró vevő útja viszont szabad.",
);
process.exit(0);
