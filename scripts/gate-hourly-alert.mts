// The hourly browser-gate run went red → alert the house (ADR-0446).
//
// Called by scripts/gate-hourly.sh, once per distinct set of red gates (the script dedupes), through
// the SAME channel the ADR-0276 unit alerts use: alertHouse() → app_setting alert_email, via the
// existing mail sender. E-mail only — a red browser gate on origin/main is a fault to fix in working
// hours, not a night SMS.
//
//   npx tsx scripts/gate-hourly-alert.mts <log-file> <range> <red gates, one per line>
//   npx tsx scripts/gate-hourly-alert.mts --dry <log-file> <range> <red gates>   (prints, sends nothing)
//
// Exit 0 = at least one channel carried it; 1 = nothing went out (the caller retries next hour).

import { readFileSync } from "node:fs";
import { alertHouse } from "../src/console/houseAlert.js";

const args = process.argv.slice(2);
const dry = args[0] === "--dry";
if (dry) args.shift();
const [logFile, range, red] = args;
if (!logFile || !range || !red) {
  console.error("használat: npx tsx scripts/gate-hourly-alert.mts [--dry] <napló> <tartomány> <piros kapuk>");
  process.exit(2);
}

let tail = "";
try {
  tail = readFileSync(logFile, "utf8").trim().split("\n").slice(-80).join("\n");
} catch (e) {
  tail = `(a napló nem olvasható: ${e instanceof Error ? e.message : String(e)})`;
}
const gates = red.split("\n").filter(Boolean);
const subject = `Citoviso: óránkénti böngészős kapu PIROS az origin/main-en — ${gates.length} kapu`;
const text =
  `Az óránkénti kapufutás (scripts/gate-hourly.sh) a landolt commitokon (${range}) piros.\n` +
  `Ezek a böngészős kapuk a landot már nem blokkolják (ADR-0446), ezért itt kell észrevenni őket.\n\n` +
  `Piros kapuk:\n${gates.map((g) => `  · ${g}`).join("\n")}\n\n` +
  `Mit jelent: vagy egy landolt változás tört el egy felületet, vagy a kapu maga terhelés-érzékeny.\n` +
  `A futtató minden bukó kaput egyszer már újrafuttatott, tehát ez kétszer egymás után piros volt.\n` +
  `Teendő: a kapu gazdája (a kapu-fájl utolsó commitjának sessionje) nézze meg; a teljes napló: ${logFile}\n` +
  `Kézi újrafuttatás: bash scripts/gate-hourly.sh --base <sha>\n` +
  `Ugyanerre a piros halmazra nem jön több levél; a következő zöld óra törli a jelet.\n\n` +
  `A napló vége:\n\n${tail}\n`;

if (dry) {
  console.log(`[gate-hourly-alert --dry]\nTárgy: ${subject}\n\n${text}`);
  process.exit(0);
}
const ok = await alertHouse({ tag: "gate-hourly", subject, text });
process.exit(ok ? 0 : 1);
