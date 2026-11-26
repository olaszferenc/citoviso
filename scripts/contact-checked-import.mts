// „Országok / Árazás” 4. fázis (0155): the one-off BACKFILL of lead.contact_checked_at from the file the
// old Debian cron uploaded (/opt/citoviso/checked-ids.txt — one lead id per line, the contact chain's
// done-lists). Run on the box whose DB is meant (prod: at the cutover, by the coordinator, with the
// owner's permission — §0.3). Dry unless --go. After it the chain writes POST /contact-checked itself.
//
//   npx tsx scripts/contact-checked-import.mts <file> [--go]
import { readFileSync } from "node:fs";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const go = process.argv.includes("--go");
if (!file) {
  console.error("használat: npx tsx scripts/contact-checked-import.mts <checked-ids.txt> [--go]");
  process.exit(1);
}
const ids = [...new Set(readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => /^[0-9a-f-]{36}$/i.test(l)))];
const { db } = await import("../src/db/client.js");
try {
  let known = 0;
  let already = 0;
  for (let k = 0; k < ids.length; k += 1000) {
    const rows = await db.selectFrom("lead").select(["id", "contact_checked_at"]).where("id", "in", ids.slice(k, k + 1000)).execute();
    known += rows.length;
    already += rows.filter((r) => r.contact_checked_at !== null).length;
  }
  console.log(`a fájlban ${ids.length} lead-id · ebből a DB-ben ${known} · már jelölt ${already} · új jel ${known - already}`);
  if (!go) {
    console.log("száraz futás — írni: --go");
  } else {
    const { markContactChecked } = await import("../src/outreach/autoApprove.js");
    console.log(`OK: ${await markContactChecked(ids)} lead jelölve (contact_checked_at)`);
  }
} finally {
  await db.destroy();
}
process.exit(0);
