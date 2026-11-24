// Run the rendered-mock quality gate (src/outreach/mockRenderGate.ts) and print the verdicts.
//
//   npx tsx scripts/mock-render-gate.mts <mock.html>…        judge files (no DB write)
//   npx tsx scripts/mock-render-gate.mts --artifact <id>…    judge artifacts (stores the verdict)
//
// Exit code 1 if any mock fails — usable as a pre-send batch check.

import path from "node:path";
import { auditMockFile, renderGateFor } from "../src/outreach/mockRenderGate.js";

const args = process.argv.slice(2);
const byArtifact = args[0] === "--artifact";
const targets = byArtifact ? args.slice(1) : args;
if (!targets.length) {
  console.error("usage: mock-render-gate.mts <mock.html>… | --artifact <id>…");
  process.exit(2);
}

let failed = 0;
for (const t of targets) {
  const r = byArtifact ? await renderGateFor(t) : await auditMockFile(path.resolve(t));
  if (r.verdict === "fail") failed++;
  console.log(`${r.verdict.toUpperCase()}\t${path.basename(t)}\tslots=${r.slots}`);
  for (const f of r.findings) console.log(`   ${f.code}\t${f.detail}`);
}
console.log(`\n${targets.length - failed}/${targets.length} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
