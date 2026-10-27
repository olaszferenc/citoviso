// ADR-0036 pack tracking CLI: which languages have a complete pack, which wait for Bábel.
//   npx tsx scripts/i18n-pack-status.mts            → coverage report only (tracking view)
//   npx tsx scripts/i18n-pack-status.mts --ensure   → also APPLY Bábel's committed seed to the DB
// ⛔ Neither mode translates (owner, 2026-10-27, ADR-XXXX): a gap is Bábel's work —
// `npx tsx scripts/babel-pack.mts export <lang>` / `kb-export <lang>` lists it for his session.
import { ensureAllLanguagePacks, packCoverage } from "../src/i18n/packs.js";
import { db } from "../src/db/client.js";

const ensure = process.argv.includes("--ensure");
const rows = ensure ? await ensureAllLanguagePacks() : await packCoverage();

if (!rows.length) {
  console.log("Nincs ismert nem-magyar nyelvterület (nincs csomag és nincs külföldi aktív régió).");
} else {
  for (const r of rows) {
    const state = r.ok ? "✅ TELJES" : "⛔ HIÁNYOS — Bábelre vár";
    const kb = r.kb ? ` · KB ${r.kb.total - r.kb.missing}/${r.kb.total}` : "";
    console.log(`${r.lang}: ${r.total - r.missing}/${r.total}${kb} ${state}${r.missing ? ` — ${r.missing} UI-string hiányzik` : ""}${r.kb?.missing ? ` — ${r.kb.missing} KB-entry hiányzik/elavult` : ""}`);
  }
  if (rows.some((r) => !r.ok)) {
    console.log(
      "\nPótlás: Bábel fordítja a sessionjében — npx tsx scripts/babel-pack.mts export <nyelv> / kb-export <nyelv>;" +
        "\n        a commitolt magot a deploy (--ensure) vagy a szerver-indulás teszi a DB-be. API-fordítás nincs.",
    );
  }
}
await db.destroy();
process.exit(rows.every((r) => r.ok) ? 0 : 1);
