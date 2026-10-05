// Gate: the pilot copy of the MOBILE outreach (owner request, 2026-10-05) — every
// cold outreach SMS/MMS a lead receives goes once more to OUTREACH_COPY_PHONE.
//
// Why it exists: the owner reads the copies to see what the machine actually puts
// on a lead's phone during the pilot. A silent break here is invisible (the lead
// still gets the message), and a careless one is harmful: a copy MMS carrying the
// lead's prospectId would take the queue's one-pending-MMS-per-prospect slot and
// its ack would stamp the prospect / start the pair's SMS half a second time.
//
// What it pins:
//   ① the predicate: empty/invalid env → no copy; the lead's own number (any
//      notation) → no copy; otherwise the copy number in E.164
//   ② the REAL copy functions on the mock providers: the SMS copy carries the
//      "[Másolat → lead, phone]" header + the full text to the copy number; the
//      MMS copy carries the image + subject; nothing is sent when the env is empty
//   ③ WIRING: the pair (queue + direct path), the pair's SMS half and the
//      standalone SMS call the copy AFTER their success branch; the MMS copy
//      passes no prospectId; on the direct path the MMS copy comes after the
//      companion SMS (the lead must not wait ~90 s for the link + opt-out)
//
// Runs in a throwaway cwd (the mock providers write outbox-sms/ and outbox-mms/
// there), no database, no network. ~2 s.
//
// Usage: npx tsx scripts/pilot-copy-check.mts

import { mkdtemp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = await mkdtemp(path.join(tmpdir(), "pilot-copy-check-"));
process.chdir(work);
// Set before config is imported: mock transports only, copy number armed.
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.OUTREACH_COPY_PHONE = "06 30 516 1631";
delete process.env.ELEK_RUN;

const { pilotCopyPhone, copyOutreachSms, copyOutreachMms } = await import(
  "../src/outreach/pilotCopy.js"
);

let failures = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

try {
  console.log("① predikátum");
  ok(pilotCopyPhone("+36701234567", "") === null, "üres env → nincs másolat");
  ok(pilotCopyPhone("+36701234567", "nem-szám") === null, "érvénytelen env → nincs másolat");
  ok(pilotCopyPhone("+36701234567", "06305161631") === "+36305161631", "más lead-szám → a másolat-szám E.164-ben");
  ok(pilotCopyPhone("06 30 516 1631", "+36305161631") === null, "a lead száma maga a másolat-szám (06-os írás) → nincs önmásolat");
  ok(pilotCopyPhone("+36305161631", "06305161631") === null, "a lead száma maga a másolat-szám (+36-os írás) → nincs önmásolat");

  console.log("② valódi másolat-küldés mock szolgáltatón");
  await copyOutreachSms("Napfény Vendégház", "+36701234567", "Üdvözöljük! Elkészült a látványterv: https://x.y/p/abc");
  const smsFiles = await readdir(path.join(work, "outbox-sms")).catch(() => [] as string[]);
  ok(smsFiles.length === 1, "pontosan egy SMS-másolat", `${smsFiles.length} db`);
  const sms = smsFiles[0] ? await readFile(path.join(work, "outbox-sms", smsFiles[0]), "utf8") : "";
  ok(sms.startsWith("To: +36305161631\n"), "a másolat a másolat-számra megy", sms.split("\n")[0]);
  ok(sms.includes("[Másolat → Napfény Vendégház, +36701234567]"), "a fejléc megnevezi a leadet és a számát");
  ok(sms.includes("Elkészült a látványterv: https://x.y/p/abc"), "a lead szövege teljes egészében benne van");

  await copyOutreachSms("[TESZT] Saját", "06305161631", "szöveg");
  const smsAfterSelf = await readdir(path.join(work, "outbox-sms"));
  ok(smsAfterSelf.length === 1, "a tulaj saját számára menő SMS-ről nincs másolat", `${smsAfterSelf.length} db`);

  const jpeg = path.join(work, "hero.mms.jpg");
  await writeFile(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]));
  await copyOutreachMms("Napfény Vendégház", "+36701234567", jpeg, "Citoviso latvanyterv - Napfeny");
  const mmsFiles = await readdir(path.join(work, "outbox-mms")).catch(() => [] as string[]);
  const manifest = mmsFiles.find((f) => f.endsWith(".txt"));
  ok(Boolean(manifest) && mmsFiles.some((f) => f.endsWith(".jpg")), "MMS-másolat: kép + manifeszt", mmsFiles.join(","));
  const mms = manifest ? await readFile(path.join(work, "outbox-mms", manifest), "utf8") : "";
  ok(mms.includes("To: +36305161631") && mms.includes("Subject: Citoviso latvanyterv - Napfeny"), "MMS-másolat a másolat-számra, a lead tárgyával");

  console.log("③ bekötés");
  const src = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
  const pair = src("src/outreach/sendOutreachPair.ts");
  const single = src("src/outreach/sendOutreachSms.ts");
  const copy = src("src/outreach/pilotCopy.ts");

  const queueBranch = pair.slice(pair.indexOf("if (queueMode) {\n    // Enqueue only"), pair.indexOf("// Atomic CLAIM"));
  ok(/if \(!mms\.ok\) return[^\n]*\n[\s\S]*copyOutreachMms\(/.test(queueBranch), "sor-mód: az MMS-másolat a sikeres sorba-tétel UTÁN");
  const directJob = pair.slice(pair.indexOf("void (async () => {"), pair.indexOf("})();"));
  const iHalf = directJob.indexOf("await sendPairSmsHalf(");
  const iCopy = directJob.indexOf("copyOutreachMms(");
  ok(iHalf > 0 && iCopy > iHalf, "közvetlen mód: az MMS-másolat a kísérő SMS UTÁN (a lead nem vár 90 mp-et)");
  const half = pair.slice(pair.indexOf("export async function sendPairSmsHalf"));
  ok(
    half.indexOf("copyOutreachSms(") > half.indexOf('result.provider === "blocked"'),
    "a pár SMS-fele: a másolat a sikertelen ág UTÁN",
  );
  ok(
    single.indexOf("copyOutreachSms(") > single.indexOf('result.provider === "blocked"') &&
      single.indexOf("copyOutreachSms(") > 0,
    "önálló SMS: a másolat a sikertelen ág UTÁN",
  );
  const mmsCall = copy.slice(copy.indexOf("await sendMms("), copy.indexOf("await sendMms(") + 60);
  ok(!/prospectId/.test(mmsCall), "az MMS-másolat NEM visz prospectId-t (a lead sorhelye és ackja érintetlen)", mmsCall);

  console.log("② (folyt.) kikapcsolt env");
  process.env.OUTREACH_COPY_PHONE = "";
  const { config } = await import("../src/config.js");
  (config as { outreachCopyPhone: string }).outreachCopyPhone = "";
  await copyOutreachSms("Napfény Vendégház", "+36701234567", "x");
  ok((await readdir(path.join(work, "outbox-sms"))).length === 1, "üres OUTREACH_COPY_PHONE → semmi nem megy ki");
} finally {
  process.chdir(ROOT);
  await rm(work, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n🔴 pilot-copy-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ pilot-copy-check: a mobil-megkeresés másolata a tulaj számára megy, a lead küldését nem érinti.");
