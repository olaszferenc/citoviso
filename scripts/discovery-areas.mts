// FELDERÍTÉSI TERÜLETEK — the chain's discovery walk (~/rc-briefs/uj-lanc/felderito/osszes.sh) asks
// THIS script which countries and areas to walk and gets each area ready (src/scout/discoveryAreas.ts).
// Opening a market on the console is the only human act (brief piacnyitas-kezi-lepes-nelkul-20261126).
//
//   npx tsx scripts/discovery-areas.mts plan                 # JSON: walked countries + areas in order, shut ones + why
//   npx tsx scripts/discovery-areas.mts ensure <region> [--dry]   # region row + root tiles; JSON: tiles, nearest to start first
//   npx tsx scripts/discovery-areas.mts status <ISO>         # JSON: the launch status (marketLaunchStatus)
//   npx tsx scripts/discovery-areas.mts ids                  # "ISO CODE region" for every lexicon area (the Python twin's test)
//
// Runs against whatever DB the app is configured for (prod: /opt/citoviso/app, dev: the main tree).
// Writes only on `ensure` without --dry: one `region` row (when missing) + the root `scout_tile` rows
// (when missing). The bbox comes from public Overpass ($0).
import { db } from "../src/db/client.js";
import { allCountryLexicons } from "../src/countryLexicon.js";
import {
  discoveryAreas,
  discoveryCountries,
  discoveryStart,
  ensureDiscoveryArea,
  marketLaunchStatus,
} from "../src/scout/discoveryAreas.js";

const [cmd, arg] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
const only = (process.env.COUNTRY ?? "").trim().toUpperCase();

async function main(): Promise<number> {
  if (cmd === "ids") {
    for (const lx of allCountryLexicons()) for (const a of discoveryAreas(lx.iso2)) console.log(`${a.iso2} ${a.code} ${a.region}`);
    return 0;
  }
  if (cmd === "status" && arg) {
    console.log(JSON.stringify(await marketLaunchStatus(arg)));
    return 0;
  }
  if (cmd === "plan") {
    const verdicts = await discoveryCountries();
    const walked = verdicts.filter((v) => v.open && (!only || v.iso2 === only));
    console.log(
      JSON.stringify({
        countries: walked.map((v) => ({ iso2: v.iso2, start: discoveryStart(v.iso2), areas: discoveryAreas(v.iso2) })),
        shut: verdicts.filter((v) => !v.open).map((v) => ({ iso2: v.iso2, reasons: v.reasons })),
      }),
    );
    return 0;
  }
  if (cmd === "ensure" && arg) {
    const area = allCountryLexicons().flatMap((lx) => discoveryAreas(lx.iso2)).find((a) => a.region === arg);
    if (!area) {
      console.error(`ismeretlen terület: ${arg} (egyik országszótárban sincs)`); // i18n-exempt: operátori CLI
      return 2;
    }
    const r = await ensureDiscoveryArea(area, { dry });
    console.error(
      `${area.region}: régió ${r.regionCreated ? (dry ? "LÉTREJÖNNE" : "LÉTREHOZVA") : "megvan"}, ` + // i18n-exempt: operátori CLI
        `csempe ${r.tilesCreated ? (dry ? "LÉTREJÖNNE" : `LÉTREHOZVA (${r.tiles.length})`) : `megvan (${r.tiles.length})`}`, // i18n-exempt: operátori CLI
    );
    console.log(JSON.stringify(r.tiles));
    return 0;
  }
  console.error("usage: discovery-areas.mts plan | ensure <region> [--dry] | status <ISO> | ids"); // i18n-exempt: operátori CLI
  return 1;
}

// process.exit() right after console.log cuts a piped stdout at 64 KiB (2026-11-26: the 340 tiles of HR-17,
// „Expecting value: line 1 column 65537” in the chain) — exit only once stdout has drained.
const drained = (): Promise<void> => new Promise((r) => process.stdout.write("", () => r()));

main()
  .then(async (code) => {
    await db.destroy();
    await drained();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(String((err as Error)?.stack ?? err));
    await db.destroy().catch(() => {});
    process.exit(1);
  });
