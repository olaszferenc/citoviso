// QA airiness audit (CLI). Thin wrapper over src/generator/qaAiriness.ts — renders
// a mock and prints per-section dead vertical space (soft airiness), for eyeballing
// generator quality and tracking the effect of prompt-budget changes.
//
//   npx tsx scripts/qa-airiness.ts <mock.html> [width]   (default: 390 + 1280)

import path from "node:path";
import { auditAiriness } from "../src/generator/qaAiriness.js";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/qa-airiness.ts <mock.html> [width]");
    process.exit(1);
  }
  const widths = process.argv[3] ? [Number(process.argv[3])] : [390, 1280];
  const report = await auditAiriness(file, { widths });
  for (const w of report.widths) {
    console.log(`\n══ ${path.basename(file)} @ ${w.width}px  (doc ${w.docHeight}px, vh ${w.vh})`);
    console.log(`   össz holt sáv: ${w.totalDead}px  (~${w.deadPct.toFixed(0)}% a doksinak)`);
    console.log("   " + ["szekció".padEnd(22), "H", "fill", "fent", "lent", "belső", "HOLT"].join("\t"));
    for (const b of [...w.sections].sort((a, z) => z.dead - a.dead)) {
      const label = `${b.tag}.${b.cls}`.slice(0, 22).padEnd(22);
      const flag = b.dead > 220 || b.fill < 0.55 ? "  ⚠️" : "";
      console.log(`   ${label}\t${b.height}\t${b.fill}\t${b.topGap}\t${b.bottomGap}\t${b.maxInnerGap}\t${b.dead}${flag}`);
    }
  }
  console.log(`\n   → legrosszabb holt%: ${report.worstDeadPct}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
