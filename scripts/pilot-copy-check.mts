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
//   ④ OWN VIEW (2026-10-05): the copies' /p/ links carry ?sajat=1, so the owner
//      opening his copy is never the lead's visit; the e-mail with a tracked link
//      gets a SEPARATE marked copy instead of a byte-identical Bcc
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
process.env.EMAIL_PROVIDER = "mock";
process.env.EMAIL_BCC = "masolat@citoviso.com";
delete process.env.ELEK_RUN;

const { pilotCopyPhone, copyOutreachSms, copyOutreachMms } = await import(
  "../src/outreach/pilotCopy.js"
);

const { markOwnViewLinks } = await import("../src/console/prospectPath.js");
const { getEmailSender, pilotOwnViewCopy } = await import("../src/email/sender.js");

const TOK = "R2_0JxabkQMEZ8PSk-OA6l05";
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

  console.log("④ saját megnyitás: a másolat linkje ?sajat=1 (2026-10-05)");
  ok(markOwnViewLinks(`https://citoviso.com/p/${TOK}`) === `https://citoviso.com/p/${TOK}?sajat=1`, "csupasz /p/<t> → jelölve");
  ok(
    markOwnViewLinks(`<a href="https://citoviso.com/p/napfeny-villa/${TOK}">`) === `<a href="https://citoviso.com/p/napfeny-villa/${TOK}?sajat=1">`,
    "sluggal, HTML-attribútumban → jelölve",
  );
  ok(markOwnViewLinks(`https://citoviso.com/p/kaldenecker-apartman/${TOK}/unsubscribe`) === `https://citoviso.com/p/kaldenecker-apartman/${TOK}/unsubscribe`, "a leiratkozó al-útvonal érintetlen");
  ok(markOwnViewLinks(`https://citoviso.com/p/${TOK}/feedback`) === `https://citoviso.com/p/${TOK}/feedback`, "a visszajelzés al-útvonal érintetlen");
  ok(markOwnViewLinks(`https://citoviso.com/p/${TOK}?sajat=1`) === `https://citoviso.com/p/${TOK}?sajat=1`, "már jelölt link nem duplázódik");
  ok(markOwnViewLinks(`Nézze meg: https://citoviso.com/p/x/${TOK}.`) === `Nézze meg: https://citoviso.com/p/x/${TOK}?sajat=1.`, "mondatvégi pont előtt is jelöl");
  await copyOutreachSms("Napfény Vendégház", "+36701234567", `Itt a terve: https://citoviso.com/p/napfeny-villa/${TOK}`);
  const sms2Name = (await readdir(path.join(work, "outbox-sms"))).sort().find((f) => f !== smsFiles[0]);
  const sms2 = sms2Name ? await readFile(path.join(work, "outbox-sms", sms2Name), "utf8") : "";
  ok(sms2.includes(`/p/napfeny-villa/${TOK}?sajat=1`), "az SMS-másolat linkje jelölt", sms2.slice(0, 200));
  // The later steps count outbox-sms/ files: this probe's copy must not shift them.
  if (sms2Name) await rm(path.join(work, "outbox-sms", sms2Name));

  // E-mail: the lead's message stays untouched, the copy is a SEPARATE marked mail.
  const leadMail = {
    to: "lead@vendeghaz.hu",
    audience: "platform" as const,
    subject: "Elkészült a weboldal-terve",
    text: `Nézze meg: https://citoviso.com/p/napfeny-villa/${TOK}`,
    html: `<a href="https://citoviso.com/p/napfeny-villa/${TOK}">terv</a> <a href="https://citoviso.com/p/napfeny-villa/${TOK}/unsubscribe">le</a>`,
    headers: { "List-Unsubscribe": `<https://citoviso.com/p/${TOK}/unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "X-Keep": "1" },
  };
  const mailCopy = pilotOwnViewCopy(leadMail);
  ok(mailCopy?.to === "masolat@citoviso.com", "követett linkes levél → külön másolat az EMAIL_BCC címre", String(mailCopy?.to));
  ok(Boolean(mailCopy?.html?.includes(`/p/napfeny-villa/${TOK}?sajat=1"`)) && Boolean(mailCopy?.text.includes(`${TOK}?sajat=1`)), "a másolat HTML- és szöveg-linkje jelölt");
  ok(Boolean(mailCopy?.html?.includes(`${TOK}/unsubscribe"`)), "a másolat leiratkozó linkje érintetlen");
  ok(!Object.keys(mailCopy?.headers ?? {}).some((k) => /^list-unsubscribe/i.test(k)) && mailCopy?.headers?.["X-Keep"] === "1", "a másolatról a List-Unsubscribe fejlécek lekerülnek (a tulaj postafiókja nem iratkoztathatja le a leadet)");
  ok(pilotOwnViewCopy({ ...leadMail, audience: "guest" }) === null, "vendég-levélről nincs másolat");
  ok(pilotOwnViewCopy({ ...leadMail, text: "számla", html: "<p>számla</p>" }) === null, "követett link nélkül nincs külön másolat (marad a Bcc)");
  await getEmailSender().send(leadMail);
  const emls = await readdir(path.join(work, "outbox")).catch(() => [] as string[]);
  const bodies = await Promise.all(emls.map((f) => readFile(path.join(work, "outbox", f), "utf8")));
  const toLead = bodies.find((b) => b.includes("To: lead@vendeghaz.hu")) ?? "";
  const toCopy = bodies.find((b) => b.includes("To: masolat@citoviso.com")) ?? "";
  ok(emls.length === 2, "valódi küldés: a lead levele + egy külön másolat", `${emls.length} db`);
  ok(Boolean(toLead) && !toLead.includes("Bcc:") && !toLead.includes("sajat=1"), "a lead levele jelöletlen, és nincs rajta Bcc");
  ok(toCopy.includes(`${TOK}?sajat=1`) && toCopy.includes("[Másolat → lead@vendeghaz.hu]"), "a másolat jelölt linkkel, megnevezett címzettel");

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
