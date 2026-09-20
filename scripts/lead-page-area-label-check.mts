// LEAD-PAGE AREA GUARD — "does the lead PAGE carry the same meaning the lead LIST does?"
//
// THE BUG IT CLOSES (Elek FK-003b L15, mérve 2026-09-14). ADR-0143 taught the Terület
// COLUMN three things: name itself "Terület" (not "Régió", because the value is the
// scrape box, not the lead's geography), print the human area name, and where no `region`
// record exists print the STATE ("nincs besorolás") with the key demoted to a tooltip.
// It taught them to the LIST only. `getLead()` never resolved a label at all, so the lead
// PAGE went on printing the raw key — measured: ALL 595 lead pages, i.e. the source fix of
// ADR-0143 ① (relabelling `balaton-north` to the truthful "Balaton") NEVER REACHED this
// surface. A Balatonlelle lead (SOUTH shore) still had "balaton-north" under a heading
// that read as its own region, and an unregistered definition printed a flawless-looking
// "Balaton" with no hint that nothing classified it.
//
// ⛔ THE CLASS, not the three strings: one rule with two implementations is two truths on
// two screens. The fix routed the page through the list's own source (`columnLabel`,
// `columnMeaning`, `areaValueHtml`); this guard is what keeps them from drifting apart
// again — because "the list is right" is exactly what was true while the page was wrong.
//
// ⛔ IT DOES NOT BORROW ITS SUBJECT (feedback_guard_must_not_borrow_its_subject): the
// forbidden-key set comes from the FIXTURE's own ids, never from the renderer's helper.
// A guard that asks the checked code what the answer is agrees with the bug.
//
// ⛔ IT MEASURES MACHINE ANCHORS, not Hungarian labels (`data-fact="region"`,
// `data-cit-area`): matching on the printed word would make a rename silently take the
// assertion with it (feedback_label_change_breaks_its_quoters).
//
//   npx tsx scripts/lead-page-area-label-check.mts             # green run
//   npx tsx scripts/lead-page-area-label-check.mts --self-test # RED control
//
// No DB, no network, no server: `leadPage()` is rendered over a fixture and read in a
// real DOM (the attributes and the tooltip only exist once parsed as HTML).

import { chromium } from "playwright-core";

import type { ArtifactView, LeadDetail } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import { columnLabel, columnMeaning, unknownRegionLabel } from "../src/console/leadFilters.js";
import { leadPage } from "../src/console/views.js";

const SELF_TEST = process.argv.includes("--self-test");

const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

// ── Fixture ─────────────────────────────────────────────────────────────────
// Shaped like the corpus at the moment of the finding, and deliberately including the
// nastiest real row: `Balaton` is an UNREGISTERED scrape key that also happens to be the
// legitimate name of the registered lake area. That row is why "does the page contain the
// string 'Balaton'" is NOT the test — the count assertion below carries it instead.
//
// ⚠️ `scripts/` is NOT in the tsconfig include (reference_scripts_are_not_typechecked), so
// the `: LeadDetail` annotation below is NOT enforced by a build. `proveFixture()` asserts
// at RUNTIME that the fixture really renders the two branches it claims to.

function artifact(over: Partial<ArtifactView> = {}): ArtifactView {
  return {
    id: "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa",
    status: "approved",
    path: "sites/mock/x/index.html",
    // The scalar shape the meta line prints, straight from the measured corpus:
    // `region` is the LABEL, `regionId` is the RAW KEY — both were rendered, side by side.
    inputs: {
      template: "fullbleed",
      skin: "sand-cream-airy",
      photos: 10,
      region: "Balaton",
      regionId: "balaton-north",
      recipe: { nested: "objects are filtered out by the view" },
    },
    generatedAt: "2026-09-14T10:00:00",
    decisions: [],
    ...over,
  };
}

function detail(over: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: "11111111-2222-4444-8888-111111111111",
    name: "Teszt Szállás",
    qualification: "modern",
    lifecycle: "active",
    matchConfidence: 0.98,
    address: null,
    region: "balaton-north",
    regionLabel: "Balaton",
    regionKnown: true,
    raw: { country: "HU", city: "Balatonlelle" },
    provenance: [],
    artifacts: [artifact()],
    heroScores: {},
    heroPin: null,
    ...over,
  };
}

/** The four cases that matter, each named by what it is there to prove. */
const CASES = [
  {
    key: "classified",
    why: "besorolt terület (a címkét kell kiírnia, nem a kulcsot)",
    d: detail(),
  },
  {
    key: "unregistered-lookalike",
    why: "besorolatlan kulcs, ami VALÓDI helynévnek látszik (`Balaton`) — ez volt a legmegtévesztőbb éles sor",
    d: detail({
      name: "Nyugalom Vendégház",
      region: "Balaton",
      regionLabel: "Balaton",
      regionKnown: false,
      matchConfidence: null,
      raw: {},
      artifacts: [],
    }),
  },
  {
    key: "unregistered-devkey",
    why: "besorolatlan fejlesztői kulcs (`_test`)",
    d: detail({
      name: "_mcfg_check lead",
      region: "_test",
      regionLabel: "_test",
      regionKnown: false,
      raw: {},
      artifacts: [],
    }),
  },
  {
    key: "unregistered-short",
    why: "besorolatlan rövid kulcs (`bs`)",
    d: detail({
      name: "Foglalás-képernyő teszt",
      region: "bs",
      regionLabel: "bs",
      regionKnown: false,
      raw: {},
      artifacts: [],
    }),
  },
] as const;

/**
 * Raw keys that may NEVER be printed as a value.
 *
 * A key is EXCLUDED when it is also the legitimate label of a classified case — exactly
 * the `Balaton` row. Without this the guard would fail on a page that is behaving
 * correctly, and the honest assertion for that row is the exact COUNT of state phrases.
 */
const classifiedLabels = new Set(CASES.filter((c) => c.d.regionKnown).map((c) => c.d.regionLabel));
const forbiddenKeys = [
  ...new Set(
    CASES.map((c) => c.d.region).filter((id) => !classifiedLabels.has(id)),
  ),
];

function proveFixture(): void {
  const known = CASES.filter((c) => c.d.regionKnown).length;
  const unknown = CASES.length - known;
  check(known >= 1, `a fixture termel BESOROLT esetet (${known} db)`);
  check(unknown >= 3, `a fixture termel BESOROLATLAN esetet (${unknown} db)`);
  check(
    forbiddenKeys.length >= 2,
    `van mérhető tiltott nyers kulcs (${forbiddenKeys.length} db: ${forbiddenKeys.join(", ")}) — enélkül az őr üres halmazt mérne`,
  );
  check(
    CASES.some((c) => !c.d.regionKnown && classifiedLabels.has(c.d.regionLabel)),
    "a fixture tartalmazza a „valódi helynévnek látszó besorolatlan kulcs” sort (ezért nem szó-feketelista az őr)",
  );
  const metaArtifacts = CASES.flatMap((c) => c.d.artifacts).filter(
    (a) => typeof a.inputs.regionId === "string",
  );
  check(
    metaArtifacts.length >= 1,
    `a fixture termel \`regionId\`-t hordozó artefaktumot (${metaArtifacts.length} db) — enélkül a meta-sor állítása vakon zöld`,
  );
}

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  proveFixture();

  const areaWord = columnLabel("region", "hu");
  const stateWord = unknownRegionLabel("hu");

  // ── ① The heading names the collection box, not a region ──────────────────
  // Independent of the renderer AND of `columnLabel`: the shipped word may not be the
  // retired one, whatever the source says today.
  check(
    areaWord !== "Régió" && areaWord.length > 0,
    `a terület-felirat forrása nem a visszavont „Régió” (ma: „${areaWord}”)`,
  );

  for (const c of CASES) {
    // No lang argument: the context defaults to Hungarian outside a request, which is
    // exactly the operator language these assertions are written against.
    const html = runWithConsoleLang(() => leadPage(c.d));
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // The page must actually contain the two anchors — a missing anchor would make
    // every assertion below vacuously green.
    const anchors = await page.evaluate(() => ({
      fact: document.querySelectorAll('[data-fact="region"]').length,
      sub: document.querySelectorAll("[data-cit-area]").length,
    }));
    check(
      anchors.fact === 1 && anchors.sub === 1,
      `[${c.key}] a lapon ott van a terület adat-sor ÉS a fejléc-alcím horgonya (fact=${anchors.fact}, sub=${anchors.sub}) — ${c.why}`,
    );

    if (SELF_TEST) {
      // ⛔ RED CONTROL — put the SHIPPED bug back, and nothing else: the raw key as the
      // value, in both places, under the retired heading. The key comes from the
      // fixture's own row, so the control cannot drift away from the data.
      await page.evaluate((raw) => {
        const dd = document.querySelector('[data-fact="region"] dd');
        if (dd) dd.textContent = raw;
        const dt = document.querySelector('[data-fact="region"] dt');
        if (dt) dt.textContent = "Régió";
        const sub = document.querySelector("[data-cit-area]");
        if (sub) sub.textContent = raw;
        // …and the artifact's own row: the raw key where the NAME belongs, plus the raw
        // key-field back in the developer block. ⚠️ A `.panel .small.mut` sor KIVEZETVE
        // (jóváhagyott terv ⑧) — ha a kontroll ott maradt volna, a ③b piros ága némán
        // nem fut le, és a zöld önteszt „lefedettnek” mutatná a nem mért állítást.
        for (const dd2 of document.querySelectorAll(".panel .con-recipe dd")) dd2.textContent = raw;
        const pre = document.querySelector(".panel .con-rawmeta pre");
        if (pre) pre.textContent = `${pre.textContent} · regionId=${raw}`;
      }, c.d.region);
    }

    // ⚠️ NO named inner function in here: tsx/esbuild rewrites one into a `__name(...)`
    // call that does not exist inside the page, and the evaluate dies with a
    // ReferenceError instead of measuring anything.
    const seen = await page.evaluate(() => ({
      factLabel: (document.querySelector('[data-fact="region"] dt')?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim(),
      factValue: (document.querySelector('[data-fact="region"] dd')?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim(),
      factTip: document.querySelector('[data-fact="region"] dt')?.getAttribute("title") ?? "",
      valueTip: document.querySelector('[data-fact="region"] dd span')?.getAttribute("title") ?? "",
      subtitle: (document.querySelector("[data-cit-area]")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim(),
      // ⚠️ MÁSODSZOR MOZDULT EL ALATTA A SZERKEZET, ÉS EZ AZ ŐR MEGINT MEGFOGTA
      // (mock-cards terv, 2026-09-20): az artefaktum-panel `<div class="panel">`-ből
      // `<article class="con-mk">` csempe lett, tehát a `.panel …` előtag 0 sort talált.
      // A mérhetőség-állítás helyesen PIROSRA ment. A szelektor MINDKÉT szerkezetet
      // olvassa: a recept a lead-lapon máshol is megjelenhet, és egy őr, aminek a
      // hatóköre szűkebb a jelentésnél, üres halmazon mér.
      metaLines: [
        ...document.querySelectorAll(
          ".panel .small.mut, .panel .con-recipe, .panel .con-rawmeta pre," +
            ".con-mk .small.mut, .con-mk .con-recipe, .con-mk .con-rawmeta pre",
        ),
      ].map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()),
      // Az OPERÁTOR ÁLTAL LÁTOTT megnevezett sorok értékei (a `kulcs=érték` felsorolás
      // utódja). Itt van a mérés helye: a nyers blokk fejlesztői adat, nem operátor-felület.
      recipeValues: [
        ...document.querySelectorAll(".panel .con-recipe dd, .con-mk .con-recipe dd"),
      ].map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()),
      // `textContent`, NEM `innerText`: a nyers alak CSUKOTT `<details>`-ben él, és az
      // innerText a csukott tartalmat elhagyja — a szivárgás-vizsgálat pont ott lenne vak,
      // ahol a nyers mezők laknak.
      pageText: (document.body.textContent ?? "").replace(/\s+/g, " "),
    }));

    // ── ② The visible label is the area word, never the retired one ─────────
    check(
      seen.factLabel === areaWord,
      `[${c.key}] az adat-sor felirata a terület-szó („${seen.factLabel}” = „${areaWord}”)`,
    );

    // ── ③ The meaning is SAID, not assumed ─────────────────────────────────
    // The sentence that redirects the geographic question to Ország/Város must be on
    // the page, and it must be the LIST's sentence — one source, or the two screens
    // will explain the same value differently.
    check(
      seen.factTip === columnMeaning("region", "hu"),
      `[${c.key}] az adat-sor elemleírása a LISTA magyarázó mondata (egy forrás)`,
    );

    // ── ③b The artifact's own row is REALLY being read ─────────────────────
    // Without this the leak assertion below is vacuously green: a selector that matches
    // nothing reports zero offenders just like a clean page does
    // (feedback_fixture_must_prove_its_own_path).
    //
    // ⚠️ A SZERKEZET MEGVÁLTOZOTT ALATTA, ÉS EZ AZ ŐR FOGTA MEG (a lead-lap jóváhagyott
    // terve ⑧): a nyers `kulcs=érték` meta-sor helyére MEGNEVEZETT sorok kerültek
    // (`.con-recipe`), a nyers alak pedig kinyitható fejlesztői blokkba (`.con-rawmeta`).
    // Az eredeti szonda (`.panel .small.mut`) így 0 sort talált — a mérhetőség-állítás
    // helyesen PIROSRA ment, a párja (`every(… !includes("regionId="))`) viszont ÜRES
    // HALMAZON igaz lett volna. Ezért az állítás átkerült oda, ahol a jelentés MA van:
    //   ① az OPERÁTOR ÁLTAL LÁTOTT megnevezett sor hordozza a terület NEVÉT, és
    //   ② a nyers kulcs-mező a lapon SEHOL nem jelenik meg — a csukott fejlesztői
    //      blokkban sem, mert a néző kinyithatja (`META_HIDDEN_KEYS` ma ki is szűri).
    // A ② így ERŐSEBB, mint az eredeti „a sorból eltűnt a kulcs-fél": nem egy sorra
    // szorítkozik, hanem a teljes lap szövegére.
    if (c.d.artifacts.some((a) => typeof a.inputs.regionId === "string")) {
      const areaRows = seen.recipeValues.filter((v) => v === c.d.regionLabel);
      check(
        areaRows.length >= 1,
        `[${c.key}] az artefaktum MEGNEVEZETT sora mérhető, és a terület NEVÉT hordozza (${areaRows.length} sor, „${c.d.regionLabel}”)`,
      );
      check(
        !seen.pageText.includes("regionId"),
        `[${c.key}] a nyers kulcs-mező (\`regionId\`) a lapon SEHOL nem jelenik meg — a csukott fejlesztői blokkban sem`,
      );
    }

    // ── ④ No raw scrape key anywhere the operator reads a value ────────────
    const leaks = [
      ...(forbiddenKeys.includes(seen.factValue) ? [`adat-sor: „${seen.factValue}”`] : []),
      ...forbiddenKeys.filter((k) => seen.subtitle.includes(k)).map((k) => `fejléc-alcím: „${k}”`),
      ...forbiddenKeys.flatMap((k) =>
        seen.metaLines.filter((l) => l.includes(`regionId=${k}`)).map(() => `meta-sor: „regionId=${k}”`),
      ),
    ];
    check(
      leaks.length === 0,
      `[${c.key}] a lapon SEHOL nem áll nyers gyűjtési-kulcs értékként (sértő: ${leaks.length}${
        leaks.length ? ` — ${leaks.join(" · ")}` : ""
      })`,
    );

    // ── ⑤ The unclassified branch says the STATE, and keeps the key reachable ──
    if (!c.d.regionKnown) {
      check(
        seen.factValue === stateWord,
        `[${c.key}] a besorolatlan eset az ÁLLAPOTOT írja ki („${seen.factValue}” = „${stateWord}”)`,
      );
      check(
        seen.valueTip.includes(c.d.region),
        `[${c.key}] a belső azonosító („${c.d.region}”) az elemleírásban elérhető, nem feliratként`,
      );
    } else {
      check(
        seen.factValue === c.d.regionLabel,
        `[${c.key}] a besorolt eset a terület NEVÉT írja ki („${seen.factValue}” = „${c.d.regionLabel}”)`,
      );
    }

    // ── ⑥ The header subtitle NAMES what its second value is ───────────────
    // Two unlabelled values joined by "·" read as a geographic hierarchy — that is how
    // "Balatonlelle · balaton-north" claimed a north shore for a south-shore town.
    check(
      seen.subtitle.startsWith(`${areaWord}:`) || seen.subtitle.includes(`· ${areaWord}:`) ||
        seen.subtitle.includes(`${areaWord}:`),
      `[${c.key}] a fejléc-alcím MEGNEVEZI a területet („${seen.subtitle}”)`,
    );
  }
} finally {
  await browser.close();
}

// ── Verdict ─────────────────────────────────────────────────────────────────
for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(
  `\nlead-page-area-label-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`,
);

if (SELF_TEST) {
  if (fails.length === 0) {
    console.error(
      "\n⛔ ÖNTESZT-BUKÁS: a visszarontott lapra az őr ZÖLDET adott — vagyis nem méri azt, amit állít.",
    );
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT RENDBEN: az őr ${fails.length} állításon pirosra ment a visszarontott lapon.`);
  process.exit(0);
}

if (fails.length) process.exit(1);
console.log("✅ a lead-LAP ugyanazt a terület-jelentést hordozza, mint a lista");
