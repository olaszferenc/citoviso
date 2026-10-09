// ADR-XXXX — the RETROACTIVE trial campaign runner: "{name}: 14 napig ingyen, élesben" once to
// every lead the cold outreach reached (mail; SMS for the mobile-only ones).
//
// ⛔ DRY BY DEFAULT. Without `--go` nothing is claimed and nothing is sent: the run prints the
// target counts (total / mail / SMS / excluded by reason) and a sample. The campaign starts
// after the big deploy, on the owner's separate "mehet" — `--go` is for THAT run only.
//
//   npx tsx scripts/trial-campaign.mts                      dry run: counts + sample
//   npx tsx scripts/trial-campaign.mts --kapuk              … and every target through its
//                                                           gates (§C on the real text), no send
//   npx tsx scripts/trial-campaign.mts --go [--limit N]     REAL send, weekday 9–16 Budapest,
//        [--sms-koz 95] [--level-koz 20] [--naplo <path>]   one at a time (SMS ≥ 90 s apart)
//   npx tsx scripts/trial-campaign.mts --kizar <prospectId|leadId> --ok "<reason>"
//                                                           persistent operator exclusion
//   npx tsx scripts/trial-campaign.mts --render             sample letter + SMS rendered into
//                                                           assets/design-refs/_drafts/proba-E2/
//
// The send path, the gates and the one-shot claim live in src/outreach/trialCampaign.ts.

import { appendFile, copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { db } from "../src/db/client.js";
import { buildTrialCampaignEmail, buildTrialCampaignSmsText, renderTrialCampaignLetter } from "../src/email/trialCampaignEmail.js";
import { prepareMailLang } from "../src/i18n/mail.js";
import { LOGO_CID, LOGO_PATH } from "../src/email/platformLayout.js";
import { advertiserIdentity, senderParts } from "../src/outreach/draft.js";
import {
  EXCLUSION_LABEL,
  excludeFromTrialCampaign,
  listTrialCampaignCandidates,
  sendTrialCampaign,
  trialCampaignNumbers,
  type TrialCampaignCandidate,
  type TrialCampaignExclusion,
} from "../src/outreach/trialCampaign.js";
import { smsEncoding } from "../src/sms/encoding.js";
import { mockOutreachWindowBlocks } from "../src/sms/sendWindow.js";

const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(name);
const opt = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : null;
};
const num = (name: string, def: number): number => {
  const v = opt(name);
  const n = v === null ? def : Number(v);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`⛔ ${name}: nem szám (${v})`);
    process.exit(2);
  }
  return n;
};

const LOG = path.resolve(opt("--naplo") ?? "tmp/trial-campaign.log");
async function log(line: string): Promise<void> {
  const row = `${new Date().toISOString()} ${line}`;
  console.log(row);
  await mkdir(path.dirname(LOG), { recursive: true });
  await appendFile(LOG, row + "\n");
}

const day = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "—");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function render(): Promise<void> {
  const out = path.resolve("assets/design-refs/_drafts/proba-E2");
  await mkdir(out, { recursive: true });
  const lang = await prepareMailLang("hu");
  const n = await trialCampaignNumbers();
  // Sample links in the PRODUCTION shape (the dev base is a tailnet host).
  const base = "https://citoviso.com";
  const token = "Xk3mintatokenmintatoken0";
  const host = "roze-fogado.citoviso.com";
  const cta = `https://${host}`;
  const letter = renderTrialCampaignLetter({
    lang,
    leadName: "Rozé Fogadó",
    sentIso: "2026-09-24",
    days: n.days,
    host,
    retentionDays: n.retentionDays,
    coupon: n.coupon,
    sender: senderParts(),
    identity: advertiserIdentity(lang),
    links: { cta, unsub: `${base}/p/roze-fogado/${token}/unsubscribe`, privacy: `${base}/privacy` },
  });
  const hero = path.resolve("assets/design-refs/_drafts/proba-E/hero.png");
  const hasHero = existsSync(hero);
  if (hasHero) await copyFile(hero, path.join(out, "hero.png"));
  const msg = buildTrialCampaignEmail(letter, "minta@example.invalid", { heroShotPath: hasHero ? hero : null, lang });
  if (existsSync(LOGO_PATH)) await copyFile(LOGO_PATH, path.join(out, "logo.png"));
  const html = (msg.html as string).replace(/cid:hero-terv/g, "hero.png").split(`cid:${LOGO_CID}`).join("logo.png");
  await writeFile(path.join(out, "level.html"), html);
  await writeFile(path.join(out, "level.txt"), `Tárgy: ${letter.subject}\n\n${letter.body}\n`);

  const sms = buildTrialCampaignSmsText({ lang, leadName: "Rozé Fogadó", sentIso: "2026-09-24", days: n.days, link: cta });
  const enc = smsEncoding(sms.text);
  const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  await writeFile(
    path.join(out, "sms.html"),
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Próba-kampány SMS</title><style>body{margin:0;background:#eef2f6;font:15px/1.45 system-ui,sans-serif;color:#10243a}` +
      `.w{max-width:600px;margin:0 auto;padding:22px 16px}.from{font-size:13px;color:#5a6d82;margin:0 0 10px}` +
      `.b{background:#fff;border:1px solid rgba(14,42,71,.12);border-radius:18px 18px 18px 4px;padding:12px 14px;max-width:320px;word-break:break-word}` +
      `.b a{color:#10697a}.m{font-size:12px;color:#5a6d82;margin:8px 0 0}</style></head><body><div class="w">` +
      `<p class="from">SMS — a csak-mobilos leadeknek (a modem SIM-ről)</p>` +
      `<div class="b">${esc(sms.text).replace(esc(cta), `<a href="${esc(cta)}">${esc(cta)}</a>`)}</div>` +
      `<p class="m">${enc.length} karakter · ${enc.gsm7 ? "GSM-7 (ékezet nélkül)" : "UCS-2!"} · ${enc.segments} szelet (plafon: 2)</p>` +
      `</div></body></html>`,
  );
  console.log(`✅ renderelve: ${path.relative(process.cwd(), out)}/level.html · level.txt · sms.html`);
  console.log(`   SMS: ${enc.length} karakter, ${enc.segments} szelet, ${enc.gsm7 ? "GSM-7" : "UCS-2"}`);
}

async function main(): Promise<void> {
  if (flag("--render")) return render();

  const kizar = opt("--kizar");
  if (kizar) {
    const r = await excludeFromTrialCampaign(kizar, opt("--ok") ?? "");
    if (!r.ok) {
      console.error(`⛔ ${r.message}`);
      process.exitCode = 1;
      return;
    }
    await log(`KIZÁRVA ${r.leadName} (lead ${r.leadId}) — ${opt("--ok")}`);
    return;
  }

  const all = await listTrialCampaignCandidates();
  const targets = all.filter((c) => !c.excluded);
  const byReason = new Map<TrialCampaignExclusion, number>();
  for (const c of all) if (c.excluded) byReason.set(c.excluded, (byReason.get(c.excluded) ?? 0) + 1);
  const mail = targets.filter((c) => c.channel === "email").length;
  const sms = targets.filter((c) => c.channel === "sms").length;
  console.log(`Megkeresett lead (kiment a hideg levél vagy SMS): ${all.length}`);
  for (const [k, v] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  − ${EXCLUSION_LABEL[k]}: ${v}`);
  console.log(`Célcsoport: ${targets.length}  (levél: ${mail} · SMS: ${sms})`);
  const sample = (c: TrialCampaignCandidate): string =>
    `  · ${c.leadName} — ${c.channel === "sms" ? "SMS" : "levél"} → ${c.address} (hideg megkeresés: ${day(c.sentAt)})`;
  if (targets.length) {
    console.log("Minta:");
    for (const c of targets.slice(0, 8)) console.log(sample(c));
  }
  const operator = all.filter((c) => c.excluded === "operator");
  if (operator.length) {
    console.log("Operátori kizárások:");
    for (const c of operator) console.log(`  · ${c.leadName} — ${c.note ?? ""}`);
  }

  if (flag("--kapuk") && !flag("--go")) {
    console.log("\nKapuk (száraz futás — nem foglal, nem küld; a hálózati kép-mérés kimarad):");
    let pass = 0;
    for (const c of targets) {
      const r = await sendTrialCampaign(c, { dryRun: true, offline: true });
      if (r.kind === "dry-run") pass++;
      else console.log(`  ✗ ${c.leadName}: ${r.kind === "skipped" ? r.reason : r.kind}`);
    }
    console.log(`  ${pass}/${targets.length} átment a kapukon`);
  }

  if (!flag("--go")) {
    console.log("\nSZÁRAZ FUTÁS — semmi nem ment ki. Élesen: --go (csak a tulaj „mehet”-je után).");
    return;
  }

  // ── REAL SEND ────────────────────────────────────────────────────────────────
  const block = mockOutreachWindowBlocks(new Date());
  if (block) {
    console.error(`⛔ ${block}`);
    process.exitCode = 1;
    return;
  }
  const limit = num("--limit", Infinity);
  const smsGapMs = Math.max(90, num("--sms-koz", 95)) * 1000;
  const mailGapMs = num("--level-koz", 20) * 1000;
  await log(`INDUL — célcsoport ${targets.length} (levél ${mail} · SMS ${sms}), limit ${limit}`);
  let sent = 0;
  let lastSms = 0;
  for (const c of targets) {
    if (sent >= limit) break;
    // The window is re-judged per message: a run that crosses 16:00 stops there.
    const w = mockOutreachWindowBlocks(new Date());
    if (w) {
      await log(`MEGÁLL — ${w}`);
      break;
    }
    if (c.channel === "sms" && lastSms) {
      const wait = smsGapMs - (Date.now() - lastSms);
      if (wait > 0) await sleep(wait);
    }
    const r = await sendTrialCampaign(c);
    if (r.kind === "sent") {
      sent++;
      await log(`KIMENT ${c.channel} · ${c.leadName} · ${r.detail}`);
      if (c.channel === "sms") lastSms = Date.now();
      else await sleep(mailGapMs);
    } else {
      await log(`KIHAGYVA ${c.channel} · ${c.leadName} · ${r.kind === "skipped" ? r.reason : r.kind}`);
    }
  }
  await log(`VÉGE — kiment ${sent}`);
}

try {
  await main();
} finally {
  await db.destroy();
}
