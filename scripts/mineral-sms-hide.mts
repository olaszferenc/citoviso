// Hide Citoviso's SMS traffic from MineREAL's SMS console (owner brief 2026-11-25,
// `sms-ek-inaktiv-l-sa-20261125-143241.md`).
//
// WHY: the GSM SIM (+36 30 120 0971, in the Galaxy S10 behind gammu-smsd) was shared:
// Citoviso's outreach / operator alerts / reply-acks AND MineREAL's own SMS went
// through the SAME gammu SQL store (`minereal_sms`). From 2026-11-25 the SIM belongs to
// MineREAL (its dispatcher goes live the week after), Citoviso stops sending through it
// (the local relays are disabled), but MineREAL's console (routing/modules/sms) lists
// every inbox/sentitems row — 1300+ Citoviso messages and the leads' replies among them.
//
// HOW (no MineREAL code change needed): the console already hides every row that has
// `is_deleted = 1` in its side table `minereal_dev.sms_msg_meta` (lists AND counters,
// see sms.api.php `inbox_list` / `sent_list` / `status`). This script writes such rows
// for Citoviso's messages, marked `updated_by = 'citoviso-szuro'`, so the hiding is
// auditable and reversible with one command (--undo). A row MineREAL itself already
// wrote (saved / deleted by a user) is never touched.
//
// WHAT COUNTS AS CITOVISO'S (gammu rows carry no sender tag — CreatorID is the same
// "Gammu 1.42.0" for both entities, measured 2026-11-25):
//   · a "Citoviso number" = a destination that got at least one message mentioning
//     "citoviso" (every outreach SMS carries a *.citoviso.com link) — EXCEPT the shared
//     numbers (the owner's phone and the SIM's own number), which both entities use;
//   · sentitems: to a Citoviso number, or to a shared number with a Citoviso text
//     (CIT_TEXT: "citoviso", the early pilot copies "…honlap-látványterv…" and
//     "[Másolat → …]", the "S10-híd" test) — and ONLY before CUTOFF (after it Citoviso sends
//     nothing, so every newer outgoing row is MineREAL's own);
//   · inbox: from a Citoviso number (a lead replying, now or later) — except numbers
//     MineREAL saved as its own recipient (sms_recipient) or texted after CUTOFF.
//     Messages from the shared numbers stay visible, except Citoviso's own WhatsApp
//     registration code (the account lives on this SIM's number).
//
// Runs from the MAIN tree, user crontab, every 5 minutes (idempotent):
//   */5 * * * * cd /home/citoviso/citoviso && npx tsx scripts/mineral-sms-hide.mts >> ~/.claude/mineral-sms-hide.log 2>&1
//
//   tsx scripts/mineral-sms-hide.mts [--dry] [--undo]
// Env: GAMMU_DB_* (main-tree .env, the same user the relays use; it has ALL on
// minereal_sms and minereal_dev), OWNER_ALERT_PHONE, MINERAL_SMS_SHARED (extra
// comma-separated shared numbers).

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../src/config.js";
import { normalizePhone } from "../src/text/phone.js";

const execFileP = promisify(execFile);

/** The moment Citoviso's relays were switched off (local time, as gammu stores it). */
const CUTOFF = "2026-11-25 14:40:00";
/** The SIM's own number (docs/mms-send.md) — the S10 texts itself in tests. */
const SIM_NUMBER = "+36301200971";
const MARK = "citoviso-szuro";
const META = "minereal_dev.sms_msg_meta";
// minereal_sms is utf8mb4_uca1400_ai_ci, minereal_dev utf8mb4_unicode_ci: every
// cross-database comparison names its collation (else ERROR 1267).

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const UNDO = args.includes("--undo");

const c = config.gammuDb;
if (!c.user) {
  console.error("[mineral-sms-hide] GAMMU_DB_USER nincs beállítva — nincs teendő.");
  process.exit(0);
}

async function sql(query: string): Promise<string[][]> {
  const { stdout } = await execFileP("mysql", ["-h", c.host, "-u", c.user, "-N", "-B", c.name, "-e", query], {
    env: { ...process.env, MYSQL_PWD: c.password },
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => l.split("\t"));
}

function sharedNumbers(): string[] {
  const raw = [SIM_NUMBER, process.env.OWNER_ALERT_PHONE ?? "", ...(process.env.MINERAL_SMS_SHARED ?? "").split(",")];
  try {
    const conf = JSON.parse(readFileSync(path.join(os.homedir(), ".config/citoviso/cfm-relay.json"), "utf8")) as { ownerPhone?: string };
    if (conf.ownerPhone) raw.push(conf.ownerPhone);
  } catch {
    // no cfm-relay config on this box — the env numbers are enough
  }
  const out = new Set<string>();
  for (const r of raw) {
    const n = normalizePhone(r.trim());
    if (n && /^\+\d{8,15}$/.test(n)) out.add(n);
  }
  return [...out];
}

if (UNDO) {
  const [[n]] = await sql(`SELECT COUNT(*) FROM ${META} WHERE updated_by = '${MARK}'`);
  if (!DRY) await sql(`DELETE FROM ${META} WHERE updated_by = '${MARK}'`);
  console.log(`[mineral-sms-hide] --undo${DRY ? " (dry)" : ""}: ${n} rejtés-sor ${DRY ? "törlődne" : "törölve"}, a MineREAL-konzol ismét mindent mutat.`);
  process.exit(0);
}

const shared = sharedNumbers();
const sharedList = shared.map((n) => `'${n}'`).join(",");

// One session, so the temporary table lives across the statements.
const citNumbers =
  `CREATE TEMPORARY TABLE cit_num (d VARCHAR(32) COLLATE utf8mb4_uca1400_ai_ci PRIMARY KEY) AS ` +
  `SELECT DestinationNumber AS d FROM sentitems GROUP BY DestinationNumber ` +
  `HAVING SUM(LOWER(IFNULL(TextDecoded,'')) LIKE '%citoviso%') > 0; ` +
  `DELETE FROM cit_num WHERE d IN (${sharedList}); ` +
  // MineREAL's own relationship wins: a saved recipient or a number it texted after the cutoff.
  `DELETE FROM cit_num WHERE d IN (SELECT telefon COLLATE utf8mb4_uca1400_ai_ci FROM minereal_dev.sms_recipient); ` +
  `DELETE FROM cit_num WHERE d IN (SELECT DestinationNumber FROM sentitems WHERE SendingDateTime >= '${CUTOFF}'); `;

/** A message text that is Citoviso's even on a shared number (measured 2026-11-25). */
const CIT_TEXT =
  `(LOWER(IFNULL(TextDecoded,'')) LIKE '%citoviso%' OR IFNULL(TextDecoded,'') LIKE 'S10-h%' ` +
  `OR IFNULL(TextDecoded,'') LIKE '%honlap-látványterv%' OR IFNULL(TextDecoded,'') LIKE '[Másolat →%')`;

const sentSel =
  `SELECT DISTINCT 'sentitems' AS t, s.ID FROM sentitems s ` +
  `WHERE s.SendingDateTime < '${CUTOFF}' AND (s.DestinationNumber IN (SELECT d FROM cit_num) ` +
  `OR s.ID IN (SELECT ID FROM sentitems WHERE DestinationNumber IN (${sharedList}) ` +
  `AND ${CIT_TEXT}))`;
const inboxSel =
  `SELECT 'inbox' AS t, i.ID FROM inbox i WHERE i.SenderNumber IN (SELECT d FROM cit_num) ` +
  `OR IFNULL(i.TextDecoded,'') LIKE '%WhatsApp-kod%'`;
const missing = (sel: string): string =>
  `SELECT x.t, x.ID FROM (${sel}) x LEFT JOIN ${META} m ON m.gammu_tabla = x.t COLLATE utf8mb4_unicode_ci AND m.gammu_id = x.ID WHERE m.id IS NULL`;

const rows = await sql(
  citNumbers +
    `SELECT 'numbers', COUNT(*) FROM cit_num; ` +
    `SELECT CONCAT('new-', t), COUNT(*) FROM (${missing(sentSel)} UNION ALL ${missing(inboxSel)}) y GROUP BY t; ` +
    (DRY
      ? ""
      : `INSERT INTO ${META} (gammu_tabla, gammu_id, is_saved, is_deleted, updated_by) ` +
        `SELECT y.t, y.ID, 0, 1, '${MARK}' FROM (${missing(sentSel)} UNION ALL ${missing(inboxSel)}) y; `) +
    `SELECT CONCAT('hidden-', gammu_tabla), COUNT(*) FROM ${META} WHERE updated_by = '${MARK}' GROUP BY gammu_tabla;`,
);
const stat = Object.fromEntries(rows.map(([k, v]) => [k, Number(v)]));
const fresh = (stat["new-sentitems"] ?? 0) + (stat["new-inbox"] ?? 0);
if (fresh > 0 || DRY || process.stdout.isTTY) {
  console.log(
    `[mineral-sms-hide] ${new Date().toISOString()}${DRY ? " (dry)" : ""} · Citoviso-szám ${stat.numbers ?? 0} · ` +
      `új rejtés: elküldött ${stat["new-sentitems"] ?? 0}, beérkezett ${stat["new-inbox"] ?? 0} · ` +
      `összesen rejtve: elküldött ${stat["hidden-sentitems"] ?? 0}, beérkezett ${stat["hidden-inbox"] ?? 0}`,
  );
}
