// ADR-0102 guard: "a kikapcsolt modult ÚJ ügyfél nem kapja meg SEHOL, ahol eladás
// indulhat" — measured as BEHAVIOUR, not as the presence of a filter call.
//
// Why it exists: the rule had no test at all, and that is precisely how the
// custom-domain unlock button could quietly offer a non-sellable module for
// months (found 2026-09-08 by the owner asking "what does this button do?").
// A grep for `getDisabledModules()` would have passed the whole time — the call
// existed in the neighbouring code path, just not in the one that offered.
//
// ⚠️ It flips a REAL app_setting row in the shared dev DB, so the original value
// is restored in a finally block. Run: npx tsx scripts/module-sales-check.mts
//   --self-test  → deliberately breaks an expectation, so the suite must go RED.

import { db } from "../src/db/client.js";
import { getDisabledModules, setDisabledModules } from "../src/moduleSales.js";
import { loadPricing, computeMonthly } from "../src/pricing.js";
import {
  MODULE_CATALOG,
  PRESETS,
  applicableRequirements,
  modulesForConversion,
  sellableModuleIds,
  subscriptionModules,
} from "../src/modules.js";
import { buildManifest } from "../src/generator/configurator.js";
import { pricingPage } from "../src/console/views.js";
import { pricingSnapshot, pricingRegions } from "../src/pricing.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  console.log(`${cond ? "✓ " : "✗ FAIL"}  ${label}${detail ? `\n     ↳ ${detail}` : ""}`);
  if (!cond) failed++;
}

// A module that is priced, sellable-by-default and NOT the spine — flipping the
// spine off would be meaningless (it is in the base fee and never optional).
const VICTIM = subscriptionModules().find((m) => !m.spine && m.priceMonthly > 0)!;
const label = (id: string) => MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;

const original = await getDisabledModules();
try {
  await setDisabledModules([...original, VICTIM.id]);
  await loadPricing(true);
  const disabled = await getDisabledModules();
  ok(disabled.has(VICTIM.id), `a kapcsoló fog: „${label(VICTIM.id)}" kikapcsolva`);

  // ── ① PROSPECT CONFIGURATOR — the manifest must not carry it, in any shape ──
  const manifest = await buildManifest("<html></html>", "00000000-0000-0000-0000-000000000000", "Teszt Panzió");
  const offered = manifest.modules.map((m) => m.id);
  ok(
    SELF_TEST ? offered.includes(VICTIM.id) : !offered.includes(VICTIM.id),
    "⭐ a konfigurátor modul-listája NEM kínálja",
    `kínált: ${offered.length} modul`,
  );
  const inPresets = manifest.presets.filter((p) => p.modules.includes(VICTIM.id)).map((p) => p.id);
  ok(inPresets.length === 0, "⭐ egyetlen KÉSZ CSOMAG sem tartalmazza", `érintett: ${inPresets.join(", ") || "—"}`);

  // ── ② CONVERSION ALL-IN fallback (no explicit order) ────────────────────────
  const allIn = modulesForConversion([], disabled);
  ok(!allIn.includes(VICTIM.id), "⭐ a konverzió ALL-IN tartaléka sem adja oda", `${allIn.length} modul`);

  // ⛔ …but an EXPLICIT, already-submitted order KEEPS it (§I: that offer was
  // made to that buyer). This is the line the guard must not blur.
  const explicit = modulesForConversion(
    [{ status: "submitted", modules: [VICTIM.id] }],
    disabled,
  );
  ok(explicit.includes(VICTIM.id), "⭐ a MÁR BEKÜLDÖTT rendelés viszont megtartja (§I)");

  // ── ③ /pricing tier prices — the figure must be what a buyer can actually get ─
  const html = pricingPage(pricingSnapshot("hu"), pricingRegions(), null, disabled, new Map());
  const alap = PRESETS.find((p) => p.id === "alap")!;
  const teljes = PRESETS.find((p) => p.id === "teljes")!;
  const sellableTeljes = teljes.modules.filter((id) => !disabled.has(id));
  const priced = computeMonthly(sellableTeljes, "hu");
  const withVictim = computeMonthly(teljes.modules, "hu");
  ok(priced < withVictim, "a kikapcsolt modul kiesik a csomagárból", `${priced} < ${withVictim}`);
  // ⛔ Compare against the RENDERED figures, not a substring of the whole page:
  // a bare `includes` can hit the same digits somewhere else entirely and go green
  // for the wrong reason.
  const shownPrices = [...html.matchAll(/pr-tier__price">([^<]*)</g)].map((x) => x[1]!.trim());
  const wanted = String(priced).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft";
  ok(
    shownPrices.some((v) => v.replace(/\u00a0/g, " ") === wanted),
    "⭐ a Díjcsomagok blokk a MEGVEHETŐ árat írja ki",
    `várt: „${wanted}" · kiírva: ${shownPrices.join(" | ")}`,
  );
  ok(html.includes("nem eladó"), "a kikapcsolt modul meg is van jelölve a lapon");
  void alap;

  // ── ④ the price a buyer could reach must never include it ───────────────────
  const anyPresetPrice = manifest.presets.map((p) => computeMonthly(p.modules, "hu"));
  ok(
    anyPresetPrice.every((v) => v <= computeMonthly(sellableTeljes, "hu")),
    "egyetlen kínált csomag ára sem lépi túl a megvehető maximumot",
    `max kínált: ${Math.max(...anyPresetPrice)} · megvehető: ${computeMonthly(sellableTeljes, "hu")}`,
  );

  // ── ⑤ ADR-0202: A KIKAPCSOLÁS LEVISZI AZT IS, AMI RÁÉPÜL ────────────────────
  //
  // A fenti blokk `gallery`-t kapcsol ki — arra SEMMI nem épül, ezért a szűk
  // szűrés (`!disabled.has(id)`) és a helyes zárvány (`sellableModuleIds`, ami a
  // ráépülő modulokat is leviszi) UGYANAZT adja. A kapu így éveken át zöld volt
  // egy olyan lyuk fölött, amit a fixture-je soha nem ért el: ez ÜRES KONTROLL.
  //
  // Mérve: `rooms` leállításával a Díjcsomagok kártya MAGASABB árat írt ki, mint
  // amennyit a vevőnek egyáltalán ki lehet számlázni — a lead konfigurátora az
  // `Árak`-at és az `Online foglalás`-t már nem is kínálta.
  {
    const dependedOn = MODULE_CATALOG.map((m) => m.id).find((id) =>
      MODULE_CATALOG.some((x) =>
        applicableRequirements(x.id).some((r) => r.strength === "hard" && r.id === id),
      ),
    );
    if (!dependedOn) {
      ok(false, "⑤ a katalógusban nincs olyan modul, amire más ráépül — az állítás ÜRES volna");
    } else {
      await setDisabledModules([...original, dependedOn]);
      await loadPricing(true);
      const dis2 = await getDisabledModules();
      const teljesIds = teljes.modules;
      const narrow = teljesIds.filter((id) => !dis2.has(id)); // a RÉGI, szűk szűrés
      const closure = sellableModuleIds(teljesIds, dis2); // a helyes zárvány
      const knocked = narrow.filter((id) => !closure.includes(id));

      // ⛔ ELŐBB a kontroll nem-ürességét bizonyítjuk: ha a két halmaz egybeesne,
      // minden alatta lévő állítás igazat mondana egy HIBÁS kódra is.
      ok(
        knocked.length > 0,
        `⑤ a kontroll NEM üres: „${label(dependedOn)}" leállítása magával visz még ${knocked.length} modult`,
        knocked.map(label).join(", ") || "EGYET SEM — az állítás üres",
      );

      const wantMonthly = computeMonthly(closure, "hu");
      const oldMonthly = computeMonthly(narrow, "hu");
      ok(
        wantMonthly < oldMonthly,
        "⑤ …és ez PÉNZBEN is különbség (a régi szűrés többet árazott)",
        `helyes ${wantMonthly} < régi ${oldMonthly}`,
      );

      const html2 = pricingPage(pricingSnapshot("hu"), pricingRegions(), null, dis2, new Map());
      const shown = [...html2.matchAll(/pr-tier__price">([^<]*)</g)].map((x) =>
        x[1]!.trim().replace(/ /g, " "),
      );
      const want = String(SELF_TEST ? oldMonthly : wantMonthly).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft";
      ok(
        shown.some((v) => v === want),
        "⑤⭐ a Díjcsomagok kártya a TÉNYLEG megvehető árat írja ki",
        `várt: „${want}" · kiírva: ${shown.join(" | ")}`,
      );
      ok(
        !shown.some((v) => v === String(oldMonthly).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft"),
        "⑤ …és a régi, túlárazott szám SEHOL nem jelenik meg",
        shown.join(" | "),
      );

      // A FELIRAT ugyanabból a halmazból származzon, mint az ÁR: a magával vitt
      // modul csempéje is viselje a jelölést (feedback_label_must_derive_from_predicate).
      // ⛔ Csempénként mérve, nem a lap egészén: egy lapszintű `includes` a
      // KIKAPCSOLT modul jelölésétől is zöld lenne, a magával vitt nélkül.
      const chips = [...html2.matchAll(/<span class="pr-tier__chip[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map(
        (x) => x[1]!,
      );
      for (const id of knocked) {
        const mine = chips.filter((c) => c.includes(label(id)));
        ok(
          mine.length > 0 && mine.every((c) => /<b>/.test(c)),
          `⑤ „${label(id)}" csempéje is JELÖLVE van (nem csak a kikapcsolt modulé)`,
          mine.length ? `${mine.length} csempe, jelöletlen: ${mine.filter((c) => !/<b>/.test(c)).length}` : "nincs ilyen csempe",
        );
      }
    }
  }
} finally {
  await setDisabledModules([...original]);
  await loadPricing(true);
  const restored = await getDisabledModules();
  console.log(
    `\n↩ visszaállítva: ${restored.size ? [...restored].join(", ") : "(üres)"} ` +
      `— az eredeti állapot ${[...original].join(", ") || "(üres)"}`,
  );
  await db.destroy();
}

if (failed) {
  console.error(`\n⛔ module-sales-check: ${failed} bukás`);
  process.exit(1);
}
console.log("\n✅ module-sales-check: a kikapcsolt modul sehol nem kínálható (ADR-0102).");
