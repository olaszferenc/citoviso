// Idegen eredetű állapotváltó kérés tilos (Elek IT S-1, 2026-10-14): a session-sütik SameSite=Lax-ok,
// de a böngészőnek minden *.citoviso.com UGYANAZ a site — egy tenant-aldomain vagy előnézeti címke
// lapja a tulaj sütijével POST-olhatott a citoviso.com/admin/*-ra. Az IT élőben igazolta: idegen
// Origin-fejléces POST átírta az árat. Szabály: nem-GET kérésnél az Origin (különben a Referer)
// hostja (porttal, alapport nélkül, séma NÉLKÜL) = a kérés Host-ja; egyik fejléc sincs → átmegy
// (szerver-szerver: Barion, relay, őrök); Origin: null → tilos; a webhook/relay utak kivételek.
//   ① a szabály táblázatban — a proxy-fejlécekkel (X-Forwarded-Host hamisítva) is;
//   ② a publikus szerver: /admin/* és a vendég-API idegen Origin-nel 403, a sajáttal NEM 403;
//   ③ a konzol: /p/… és /login idegen Origin-nel 403, a sajáttal NEM 403;
//   ④ a kivételek (Barion-webhook, relay) idegen fejléccel sem 403.
// Futtatás: npx tsx scripts/csrf-origin-check.mts
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.CONSOLE_PORT = "0";

import http from "node:http";
import { once } from "node:events";

const { crossOriginRefusal } = await import("../src/server/originGuard.js");

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 200)}`}`);
  if (!c) fail++;
};

console.log("\n① a szabály");
const req = (method: string, headers: Record<string, string>) => ({ method, headers }) as unknown as http.IncomingMessage;
const cases: [string, string, Record<string, string>, string, boolean][] = [
  // [name, method, headers, path, allowed]
  ["saját Origin (https, a node http-t lát — a séma nem számít)", "POST", { host: "citoviso.com", origin: "https://citoviso.com" }, "/admin/prices/base", true],
  ["⭐ testvér-aldomain Origin → tilos (a Lax ezt nem fogta)", "POST", { host: "citoviso.com", origin: "https://masik-tenant.citoviso.com" }, "/admin/prices/base", false],
  ["⭐ idegen Origin, proxy-fejlécekkel — X-Forwarded-Host hamisítva a támadóra → tilos", "POST", { host: "citoviso.com", origin: "https://evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }, "/admin/prices/base", false],
  ["saját Origin, proxy-fejlécekkel (X-Forwarded-Proto: https, X-Real-IP) → átmegy", "POST", { host: "citoviso.com", origin: "https://citoviso.com", "x-forwarded-proto": "https", "x-real-ip": "1.2.3.4" }, "/admin/prices/base", true],
  ["tenant aldomain a saját lapjáról → átmegy", "POST", { host: "bogarka.citoviso.com", origin: "https://bogarka.citoviso.com" }, "/api/foglalas", true],
  ["⭐ saját domaines tenant a saját lapjáról → átmegy", "POST", { host: "www.boglarka-vendeghaz.hu", origin: "https://www.boglarka-vendeghaz.hu" }, "/api/foglalas", true],
  ["⭐ másik tenant lapjáról a tenant API-ra → tilos (a tenant host csak magára érvényes)", "POST", { host: "bogarka.citoviso.com", origin: "https://masik.citoviso.com" }, "/api/foglalas", false],
  ["alapport a Host-ban (citoviso.com:443) = alapport nélküli Origin", "POST", { host: "citoviso.com:443", origin: "https://citoviso.com" }, "/admin/x", true],
  ["dev: IP:port Host = IP:port Origin", "POST", { host: "100.97.188.105:4600", origin: "http://100.97.188.105:4600" }, "/p/x/event", true],
  ["dev: más port → tilos", "POST", { host: "100.97.188.105:4600", origin: "http://100.97.188.105:4800" }, "/p/x/event", false],
  ["Origin nincs, Referer a saját host → átmegy", "POST", { host: "citoviso.com", referer: "https://citoviso.com/admin?tab=modulok" }, "/admin/x", true],
  ["Origin nincs, Referer idegen → tilos", "POST", { host: "citoviso.com", referer: "https://evil.example/x" }, "/admin/x", false],
  ["Origin: null → tilos", "POST", { host: "citoviso.com", origin: "null" }, "/admin/x", false],
  ["egyik fejléc sincs (szerver-szerver / őr) → átmegy", "POST", { host: "citoviso.com" }, "/admin/x", true],
  ["GET idegen Origin-nel → nem állapotváltó, átmegy", "GET", { host: "citoviso.com", origin: "https://evil.example" }, "/admin", true],
  ["Barion-webhook idegen fejléccel is átmegy (kivétel)", "POST", { host: "citoviso.com", origin: "https://evil.example" }, "/pay/webhook/barion", true],
  ["SMS-relay (bearer) idegen fejléccel is átmegy (kivétel)", "POST", { host: "citoviso.com", origin: "https://evil.example" }, "/api/sms-relay/pull", true],
];
for (const [name, method, headers, path, allowed] of cases) {
  const r = crossOriginRefusal(req(method, headers), path);
  check(name, allowed ? r === null : r !== null, r);
}

// ── raw requests: the Host and Origin go out exactly as given (fetch would drop Host) ──
const raw = (port: number, method: string, host: string, path: string, extra: Record<string, string> = {}): Promise<number> =>
  new Promise((resolve, reject) => {
    const body = "x=1";
    const r = http.request(
      { host: "127.0.0.1", port, path, method, headers: { Host: host, "content-type": "application/x-www-form-urlencoded", "content-length": String(body.length), ...extra } },
      (res) => { res.resume(); res.on("end", () => resolve(res.statusCode ?? 0)); },
    );
    r.on("error", reject);
    r.end(body);
  });

const { server: pub } = (await import("../src/server/public.js")) as { server: http.Server };
const { server: con } = (await import("../src/console/server.js")) as { server: http.Server };
if (!pub.listening) await once(pub, "listening");
if (!con.listening) await once(con, "listening");
const pp = (pub.address() as { port: number }).port;
const cp = (con.address() as { port: number }).port;
try {
  console.log("\n② publikus szerver");
  check("⭐ /admin/prices/base idegen (testvér-aldomain) Origin-nel → 403", (await raw(pp, "POST", "citoviso.com", "/admin/prices/base", { origin: "https://masik.citoviso.com" })) === 403);
  const own = await raw(pp, "POST", "citoviso.com", "/admin/prices/base", { origin: "https://citoviso.com" });
  check("negatív kontroll: ugyanez a saját Origin-nel NEM 403 (bejelentkezés nélkül a szokásos válasz)", own !== 403, own);
  check("⭐ /api/foglalas idegen Origin-nel → 403", (await raw(pp, "POST", "nincs-ilyen.citoviso.com", "/api/foglalas", { origin: "https://evil.example" })) === 403);
  const g = await raw(pp, "POST", "nincs-ilyen.citoviso.com", "/api/foglalas", { origin: "https://nincs-ilyen.citoviso.com" });
  check("negatív kontroll: a saját lapjáról NEM 403", g !== 403, g);
  const none = await raw(pp, "POST", "citoviso.com", "/admin/prices/base");
  check("fejléc nélkül (őrök, szerver-szerver) NEM 403", none !== 403, none);

  console.log("\n③ konzol");
  check("⭐ /p/<token>/event idegen Origin-nel → 403", (await raw(cp, "POST", "citoviso.com", "/p/abcdefghijklmnop12/event", { origin: "https://masik.citoviso.com" })) === 403);
  const pe = await raw(cp, "POST", "citoviso.com", "/p/abcdefghijklmnop12/event", { origin: "https://citoviso.com" });
  check("negatív kontroll: saját Origin-nel NEM 403", pe !== 403, pe);
  check("⭐ operátor /login idegen Origin-nel → 403 (login-CSRF)", (await raw(cp, "POST", "admin.citoviso.com", "/login", { origin: "https://evil.example" })) === 403);

  console.log("\n④ kivételek");
  const wh = await raw(cp, "POST", "citoviso.com", "/pay/webhook/barion", { origin: "https://evil.example" });
  check("Barion-webhook idegen fejléccel sem 403", wh !== 403, wh);
} finally {
  pub.close();
  con.close();
  const { pool } = await import("../src/db/client.js");
  await pool.end().catch(() => {});
}
console.log(fail ? `\n⛔ CSRF-ORIGIN: ${fail} bukás` : "\n🟢 CSRF-ORIGIN: idegen eredetű állapotváltó kérés 403; a saját host, a fejléc nélküli és a kivétel-utak átmennek");
process.exit(fail ? 1 : 0);
