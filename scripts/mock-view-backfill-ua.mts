// mock_view visszamenőleges UA-kinyerés + nyers-oszlop ürítés (ADR-0322 ③).
//
// A 0087 előtt a mock_view a NYERS User-Agentet és a TELJES referrert tárolta. Az új írások
// már csak a kinyert mezőket (device/os/browser) és a referrer HOSTJÁT írják; ez a szkript a
// régi sorokra ugyanazt a szabályt futtatja (src/analytics/userAgent.ts — egy szabály, egy hely).
//
// ⛔ SORREND (az ADR szerint): ELŐBB kinyerés, AZTÁN ürítés — soronként, EGY UPDATE-ben: a
// kinyert mezők és a NULL-ra állított nyers oszlopok ugyanabban az utasításban íródnak, így
// nincs olyan pillanat, amikor a nyers adat már eltűnt, de a kinyert még nincs meg. Egy
// megszakított futás után a maradék sorokra újra lefuttatható (csak a még nyers sorokat nézi).
//
// Száraz futás ALAPBÓL (csak összesít). Írás: `--go`.
//   npx tsx scripts/mock-view-backfill-ua.mts          # mit csinálna
//   npx tsx scripts/mock-view-backfill-ua.mts --go     # végrehajtja
// ⚠️ Élesen NEM ez a session futtatja — a koordinátor, a nagy deployjal.

import { db } from "../src/db/client.js";
import { parseUserAgent, referrerHost } from "../src/analytics/userAgent.js";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--go");
if (unknown.length) {
  // A „--dry” és társai NE kapcsolják ki némán a szárazfuttatást (feedback_near_miss_on_safety_switch).
  console.error(`ismeretlen kapcsoló: ${unknown.join(" ")} — csak a --go létezik (alapból száraz futás)`);
  process.exit(2);
}
const GO = args.includes("--go");

const rows = await db
  .selectFrom("mock_view")
  .select(["id", "user_agent", "referrer", "device", "referrer_host"])
  .where((eb) => eb.or([eb("user_agent", "is not", null), eb("referrer", "is not", null)]))
  .execute();

const tally = new Map<string, number>();
let hosts = 0;
for (const r of rows) {
  const ua = parseUserAgent(r.user_agent);
  const host = referrerHost(r.referrer);
  if (host) hosts++;
  const k = `${ua.device} · ${ua.os ?? "—"} · ${ua.browser ?? "—"}`;
  tally.set(k, (tally.get(k) ?? 0) + 1);
  if (!GO) continue;
  await db
    .updateTable("mock_view")
    .set({
      // A már kinyert mezőt nem írjuk felül (pl. egy 0087 utáni sor, ha valaha nyers is maradt).
      device: r.device ?? ua.device,
      os: r.device ? undefined : ua.os,
      browser: r.device ? undefined : ua.browser,
      referrer_host: r.referrer_host ?? host,
      user_agent: null,
      referrer: null,
    })
    .where("id", "=", r.id)
    .execute();
}

console.log(`${GO ? "VÉGREHAJTVA" : "SZÁRAZ FUTÁS (írás: --go)"} — ${rows.length} mock_view sor nyers UA/referrerrel`);
for (const [k, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
console.log(`  referrer → host: ${hosts} sorban lett host (a többi üres vagy nem URL volt)`);
if (GO) {
  const left = await db
    .selectFrom("mock_view")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where((eb) => eb.or([eb("user_agent", "is not", null), eb("referrer", "is not", null)]))
    .executeTakeFirstOrThrow();
  console.log(`  visszaellenőrzés: nyers UA/referrer maradt ${left.n} sorban`);
  if (Number(left.n) !== 0) process.exitCode = 1;
}
await db.destroy();
