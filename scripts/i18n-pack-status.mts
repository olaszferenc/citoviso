// ADR-0036 pack tracking CLI: which languages have a complete pack, which need generation.
//   npx tsx scripts/i18n-pack-status.mts            → coverage report only (tracking view)
//   npx tsx scripts/i18n-pack-status.mts --ensure   → also GENERATE the missing entries (AI)
import { ensureAllLanguagePacks, packCoverage } from "../src/i18n/packs.js";
import { db } from "../src/db/client.js";

const ensure = process.argv.includes("--ensure");
const rows = ensure ? await ensureAllLanguagePacks() : await packCoverage();

if (!rows.length) {
  console.log("Nincs ismert nem-magyar nyelvterület (nincs csomag és nincs külföldi aktív régió).");
} else {
  for (const r of rows) {
    const state = r.ok ? "✅ TELJES" : ensure ? "⛔ HIÁNYOS (generálás sikertelen?)" : "⚠️ GENERÁLANDÓ";
    const kb = r.kb ? ` · KB ${r.kb.total - r.kb.missing}/${r.kb.total}` : "";
    console.log(`${r.lang}: ${r.total - r.missing}/${r.total}${kb} ${state}${r.missing ? ` — ${r.missing} UI-string hiányzik` : ""}${r.kb?.missing ? ` — ${r.kb.missing} KB-entry hiányzik/elavult` : ""}`);
  }
  if (!ensure && rows.some((r) => !r.ok)) {
    console.log("\nPótlás: npx tsx scripts/i18n-pack-status.mts --ensure (vagy szerver-restart — boot-time self-heal)");
  }
}
await db.destroy();
process.exit(rows.every((r) => r.ok) ? 0 : 1);
