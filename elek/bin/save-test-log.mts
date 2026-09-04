// Elek test-log saver — the evaluator agent's ONLY write path to the web test
// log (charter: "a webes teszt-napló kitöltése API-n át, elek app-userként,
// hamisított sessionnel"). Boots the console in-process on an ephemeral port
// (ui-shot pattern), mints the elek operator cookie, POSTs the payload to
// /test-log/<FK>/save — the same route a human's browser would hit.
//
//   npx tsx elek/bin/save-test-log.mts <FK-id> <payload.json>
//
// payload.json: { "checks": [bool, … in document order],
//                 "comments": [string, … one per section],
//                 "summary": "…" }

process.env.CIT_SHOT = "1"; // no AI calls, no DB writes on boot
process.env.ELEK_RUN = "1"; // ADR-0095 ④ transport guard stays armed
process.env.CONSOLE_PORT = "0";

import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { Server } from "node:http";

const [fkId, payloadPath] = process.argv.slice(2);
if (!fkId || !payloadPath) {
  console.error("használat: npx tsx elek/bin/save-test-log.mts <FK-id> <payload.json>");
  process.exit(1);
}
const payload = JSON.parse(readFileSync(payloadPath, "utf8")) as {
  checks?: unknown[];
  comments?: unknown[];
  summary?: unknown;
};

const { server } = (await import("../../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const a = server.address();
if (!a || typeof a === "string") throw new Error("konzol szerver cím nélkül");
const base = `http://127.0.0.1:${a.port}`;

const { db } = await import("../../src/db/client.js");
const { mintOperatorCookieValue } = await import("../../src/auth/operatorAuth.js");
const op = await db
  .selectFrom("operator_user")
  .select("id")
  .where("username", "=", "elek")
  .executeTakeFirst();
if (!op) throw new Error("ELŐFELTÉTEL: nincs `elek` operator_user a dev DB-ben");

const res = await fetch(`${base}/test-log/${encodeURIComponent(fkId)}/save`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `cit_op_session=${mintOperatorCookieValue(op.id)}`,
  },
  body: JSON.stringify(payload),
});
const body = await res.text();
console.log(`${res.status} ${body}`);
process.exit(res.ok ? 0 : 2);
