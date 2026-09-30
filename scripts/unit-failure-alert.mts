// A systemd unit failed → mail the house (ADR-0276).
//
// Invoked by deploy/systemd/citoviso-alert@.service, which every prod service names in
// its `OnFailure=citoviso-alert@%n.service`; the instance name is the failed unit.
// Sends the unit name + its last ~40 journal lines to app_setting.alert_email through
// the existing mail sender (src/console/houseAlert.ts).
//
//   npx tsx scripts/unit-failure-alert.mts citoviso-billing.service
//
// A crash-looping Restart=always service (public/console) fires OnFailure= on EVERY crash
// (measured, systemd 257): unitAlertDue() mails the 1st, 11th, 101st… only — the rest
// is logged here and the unit exits 0.
//
// ⛔ A failed alert is only logged (exit 1 → visible in the journal of THIS unit, which
// carries no OnFailure= of its own — no loop).

import { execFileSync } from "node:child_process";
import { alertUnitFailure, unitAlertDue, type UnitState } from "../src/console/houseAlert.js";
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

// `systemctl show` prints the properties in its OWN order, not the -p order — parse by key.
// Unreadable → state unknown → mail (fail open: an extra mail beats a missed crash).
let state: UnitState | undefined;
try {
  const props = new Map(
    execFileSync("systemctl", ["show", unit, "-p", "SubState", "-p", "NRestarts"], { encoding: "utf8", timeout: 10_000 })
      .split("\n")
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)] as const),
  );
  const n = Number(props.get("NRestarts"));
  if (props.has("SubState") && Number.isInteger(n)) state = { subState: props.get("SubState")!, nRestarts: n };
} catch (e) {
  console.error(`[unit-failure-alert] a(z) ${unit} állapota nem olvasható (${e instanceof Error ? e.message : String(e)}) — küldöm a levelet`);
}
if (state && !unitAlertDue(state)) {
  console.log(`[unit-failure-alert] ${unit}: ${state.nRestarts + 1}. összeomlás crash-hurokban (${state.subState}) — levél most nem megy (1., 11., 101. …)`);
  process.exit(0);
}

const sent = await alertUnitFailure(unit, journal, state);
await db.destroy();
process.exit(sent ? 0 : 1);
