// Daily Google API cost report (ADR-0297) — run every morning by
// citoviso-google-cost-report.timer from the MAIN tree, on the dev box only.
//
// Reads yesterday's (Budapest) request counts from Cloud Monitoring, prices them at
// list price (src/ops/googleCostReport.ts holds the ONE price table) and mails the
// owner. When the token or Monitoring fails, the mail STILL goes out and says there
// is no data and why — a silent failure is what let ~600 $/week pass unnoticed.
// It never limits or stops anything.
//
//   npx tsx scripts/google-cost-report.mts                    # yesterday → mail
//   npx tsx scripts/google-cost-report.mts --day 2026-10-01   # a given day → mail
//   npx tsx scripts/google-cost-report.mts --print            # print only, no mail
//
// Recipients: GOOGLE_COST_REPORT_TO, else the console's alert e-mail list (/settings).
// Exit: 0 = mail sent (with or without data), 1 = the mail itself failed, 2 = bad args.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../src/config.js";
import { addIsoDays, budapestIsoDay } from "../src/text/budapestTime.js";
import { runDailyReport } from "../src/ops/googleCostReport.js";

const args = process.argv.slice(2);
let day = addIsoDays(budapestIsoDay(new Date()), -1);
let printOnly = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--print") printOnly = true;
  else if (a === "--day" && /^\d{4}-\d{2}-\d{2}$/.test(args[i + 1] ?? "")) day = args[++i];
  else {
    // A near-miss flag (e.g. "--dry") must not silently fall through to a real send.
    console.error(`google-cost-report: ismeretlen argumentum: ${a}  (használat: [--day YYYY-MM-DD] [--print])`);
    process.exit(2);
  }
}

const run = promisify(execFile);
async function getToken(): Promise<string> {
  const { stdout } = await run(config.gcloudBin, ["auth", "print-access-token"], { timeout: 60_000 });
  return stdout;
}

const report = await runDailyReport({
  day,
  project: config.googleCostProject,
  thresholdUsd: config.googleCostDailyThresholdUsd,
  itemMinUsd: config.googleCostItemMinUsd,
  getToken,
  fetchImpl: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60_000) }),
});

const stamp = new Date().toISOString();
console.log(
  `[${stamp}] google-cost-report ${day}: ${report.hasData ? `~${report.totalUsd.toFixed(2)} $` : "NINCS ADAT"}` +
    (report.flags.length ? ` · ${report.flags.length} kiemelés` : ""),
);

if (printOnly) {
  console.log(`\nTárgy: ${report.subject}\n\n${report.text}`);
  process.exit(0);
}

try {
  let to = config.googleCostReportTo.trim();
  if (!to) {
    const { getAlertRecipients } = await import("../src/console/appSettings.js");
    to = (await getAlertRecipients()).emails.join(", ");
  }
  if (!to) throw new Error("nincs címzett (GOOGLE_COST_REPORT_TO üres, és a konzol riasztási e-mail listája is üres)");
  const { getEmailSender } = await import("../src/email/sender.js");
  const res = await getEmailSender().send({ to, audience: "platform", subject: report.subject, text: report.text });
  console.log(`[${stamp}] levél elküldve (${res.provider}, ${res.id}) → ${to}`);
  if (!report.hasData) console.log(report.text);
  process.exit(0);
} catch (e) {
  console.error(`[${stamp}] ⛔ google-cost-report: a LEVÉL NEM MENT KI — ${e instanceof Error ? e.message : String(e)}`);
  console.error(report.text);
  process.exit(1);
}
