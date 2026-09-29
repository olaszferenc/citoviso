// A systemd unit failed → mail the house (ADR-XXXX).
//
// Invoked by deploy/systemd/citoviso-alert@.service, which every prod service names in
// its `OnFailure=citoviso-alert@%n.service`; the instance name is the failed unit.
// Sends the unit name + its last ~40 journal lines to app_setting.alert_email through
// the existing mail sender (src/console/houseAlert.ts).
//
//   npx tsx scripts/unit-failure-alert.mts citoviso-billing.service
//
// ⛔ A failed alert is only logged (exit 1 → visible in the journal of THIS unit, which
// carries no OnFailure= of its own — no loop).

import { execFileSync } from "node:child_process";
import { alertUnitFailure } from "../src/console/houseAlert.js";
import { db } from "../src/db/client.js";

const JOURNAL_LINES = 40;

const unit = (process.argv[2] ?? "").trim();
// systemd instance names are escaped unit names — reject anything else before it
// reaches a command line.
if (!/^[A-Za-z0-9@._:-]+$/.test(unit)) {
  console.error("használat: npx tsx scripts/unit-failure-alert.mts <unit-név>");
  process.exit(2);
}

let journal = "";
try {
  journal = execFileSync("journalctl", ["-u", unit, "-n", String(JOURNAL_LINES), "--no-pager", "-o", "short-iso"], {
    encoding: "utf8",
    timeout: 20_000,
  }).trim();
} catch (e) {
  journal = `(a journal nem olvasható: ${e instanceof Error ? e.message : String(e)})`;
}

const sent = await alertUnitFailure(unit, journal);
await db.destroy();
process.exit(sent ? 0 : 1);
