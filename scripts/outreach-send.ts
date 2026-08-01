// Outreach batch send CLI (B szelet). Always start with --dry-run.
//
//   tsx scripts/outreach-send.ts --dry-run            # gate + list, no send
//   tsx scripts/outreach-send.ts --limit=10           # send up to 10, paced
//   tsx scripts/outreach-send.ts --prospect=<uuid>    # one prospect only
//   tsx scripts/outreach-send.ts --delay-ms=8000      # override pacing
//
// EMAIL_PROVIDER=mock (default) writes to outbox/ — the full pipe is testable
// with zero credentials. EMAIL_PROVIDER=smtp needs SMTP_URL + OUTREACH_FROM.

import { sendOutreachBatch, sendOutreachMail, type SendReport } from "../src/outreach/sendBatch.js";
import { db } from "../src/db/client.js";

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function opt(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}

function printReport(r: SendReport): void {
  const head = `${r.leadName} <${r.to}>`;
  switch (r.outcome.kind) {
    case "sent":
      console.log(`✅ SENT   ${head} · ${r.outcome.provider}:${r.outcome.emailId}`);
      break;
    case "dry-run":
      console.log(`▫️ DRY    ${head} · "${r.outcome.subject}"`);
      break;
    case "flagged":
      console.log(`🚫 FLAG   ${head}`);
      for (const reason of r.outcome.reasons) console.log(`     - ${reason}`);
      break;
    case "skipped":
      console.log(`⏭️ SKIP   ${head} · ${r.outcome.reason}`);
      break;
  }
}

async function main(): Promise<void> {
  const dryRun = flag("dry-run");
  const prospectId = opt("prospect");
  const limit = opt("limit") ? Number(opt("limit")) : undefined;
  const delayMs = opt("delay-ms") ? Number(opt("delay-ms")) : undefined;

  const reports = prospectId
    ? [await sendOutreachMail(prospectId, { dryRun })]
    : await sendOutreachBatch({ dryRun, limit, delayMs });

  console.log("");
  for (const r of reports) printReport(r);

  const n = (k: string) => reports.filter((r) => r.outcome.kind === k).length;
  console.log(
    `\nÖsszesen: ${reports.length} · küldve ${n("sent")} · dry ${n("dry-run")} · ` +
      `FLAG ${n("flagged")} · kihagyva ${n("skipped")}${dryRun ? "  (DRY-RUN — semmi nem változott)" : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
