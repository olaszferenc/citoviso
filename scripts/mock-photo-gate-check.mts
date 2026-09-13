// MOCK-PHOTO-GATE őr — törött képes mock NEM hagyható jóvá és NEM küldhető ki.
//
//   npx tsx scripts/mock-photo-gate-check.mts [--self-test] [--sweep]
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

const WORK = path.resolve(process.cwd(), "sites/_photo-gate-check");
const FIXTURE_LEAD = "ŐR-photo-gate";

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
    region: "Balaton északi part",
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

  const brokenFile = path.join(WORK, "mock-or-photo-gate-broken.html");
  const healthyFile = path.join(WORK, "mock-or-photo-gate-healthy.html");
  await writeFile(brokenFile, brokenHtml, "utf8");
  await writeFile(healthyFile, healthyHtml, "utf8");

  const { extractImageRefs, probeImageRefs, photoGateBlocks } = await import(
    "../src/outreach/mockPhotoHealth.js"
  );

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
  const ack = (urls: string[]) => ({ at: "2026-09-13T00:00:00Z", by: "console", urls });
  check(!photoGateBlocks(h("ok", []), null), "ép lap ack nélkül is átmegy");
  check(photoGateBlocks(h("broken", [DEAD(1)]), null), "törött lap ack NÉLKÜL blokkol");
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

  // ── ⑤ A KAPU A VALÓDI ÚTON: DB-sor + konzol-szerver + HTTP ───────────────────
  console.log("\n④ A kapu a VALÓDI konzol-úton (HTTP, DB-sor, renderelt fájl)");
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
    const run = await db
      .selectFrom("scrape_run")
      .select("id")
      .orderBy("id")
      .limit(1)
      .executeTakeFirst();
    if (!run) {
      skip("a HTTP-úti kapu-próba", "nincs egyetlen scrape_run sem a DB-ben (üres park)");
    } else {
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
    const src = await readFile(path.resolve(process.cwd(), file), "utf8");
    const gateAt = src.indexOf("photoGateBlocks(");
    const sendAt = src.indexOf(sendMarker);
    check(gateAt > 0, `${file}: meghívja a kép-kaput`);
    check(
      gateAt > 0 && sendAt > 0 && gateAt < sendAt,
      `${file}: a kapu a tényleges küldés ELŐTT fut`,
      `kapu@${gateAt} · küldés@${sendAt}`,
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
  const { assessMockPhotos, brokenPhotoAckOf, photoGateBlocks } = await import(
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
    const blocks = photoGateBlocks(health, brokenPhotoAckOf(r.inputs));
    sweepMeasured++;
    check(
      !blocks,
      `${r.leadName} — ${health.checked} kép, ${health.broken.length} törött`,
      health.broken.map((b) => `${b.url} — ${b.reason}`).join("\n         "),
    );
  }
  await db.destroy();
}

console.log(`MOCK-PHOTO-GATE őr${selfTest ? " — ÖNTESZT (a lapot meggyógyítottuk)" : ""}`);
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
console.log("\n✅ mock-photo-gate: törött képes mock nem hagyható jóvá és nem küldhető ki.");
process.exit(0);
