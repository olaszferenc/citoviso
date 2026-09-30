// Login hardening guard (ADR-0277) — both realms, on the REAL servers.
//
//   ① Secure session cookie: present over HTTPS (X-Forwarded-Proto: https from nginx,
//      CF-Visitor from Cloudflare), ABSENT over plain HTTP — dev runs on http://, and a
//      Secure cookie there would kill every login. Measured on the Set-Cookie the real
//      /logout routes emit (same setCookie as the login), tenant :4800 AND operator :4600.
//   ② Failed-login throttle: LOGIN_FAIL_LIMIT wrong passwords from one IP → the next
//      POST /login is a 429 with the throttle message, BEFORE the password is checked;
//      another IP and the other realm are untouched. Unknown usernames only — no DB write.
//   ③ The brakes key on `clientIp()` (ADR-XXXX): X-Real-IP (nginx OVERWRITES it), else the
//      socket address; behind a Cloudflare edge CF-Connecting-IP (trusted only from an
//      edge) — NEVER X-Forwarded-For (nginx APPENDS to the client's value). Negative
//      control: a fresh X-Forwarded-For on every request must NOT reset the login brake nor
//      the public booking/enquiry throttle (real server, /t/<slug>/api/erdeklodes with an
//      empty form — throttled before validation, 400 without a DB write).
//
// Run:  npx tsx scripts/login-hardening-check.mts
//       npx tsx scripts/login-hardening-check.mts --self-test   (must go RED — proves it measures)

process.env.PUBLIC_PORT = "0";
process.env.CONSOLE_PORT = "0";
// Never trigger AI language-pack top-ups or DB writes from a guard run.
process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { request as httpReq } from "node:http";

const SELF_TEST = process.argv.includes("--self-test");

const { server } = await import("../src/server/public.js");
const { server: consoleServer } = await import("../src/console/server.js");
const { db } = await import("../src/db/client.js");
const guard = await import("../src/auth/loginGuard.js");

let failed = 0;
const check = (ok: boolean, what: string, detail = ""): boolean => {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failed++;
    console.error(`  ✗ ${what}${detail ? ` — ${detail}` : ""}`);
  }
  return ok;
};

if (!server.listening) await once(server, "listening");
if (!consoleServer.listening) await once(consoleServer, "listening");
const PUB = (server.address() as { port: number }).port;
const CON = (consoleServer.address() as { port: number }).port;

interface Reply {
  status: number;
  setCookie: string[];
  body: string;
}
function call(port: number, method: string, path: string, headers: Record<string, string>, body = ""): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const r = httpReq(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...headers,
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let b = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (b += c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, setCookie: [res.headers["set-cookie"] ?? []].flat(), body: b }),
        );
      },
    );
    r.on("error", reject);
    r.end(body);
  });
}
const hasSecure = (r: Reply): boolean => r.setCookie.some((c) => /;\s*Secure(\s*;|\s*$)/i.test(c));

// ── ① Secure cookie, both realms, both branches ────────────────────────────────
console.log("\n── ① Secure süti (csak HTTPS-en) ──");
const realms = [
  { name: "tenant (:4800 /logout)", port: PUB },
  { name: "operátor (:4600 /logout)", port: CON },
];
for (const { name, port } of realms) {
  const plain = await call(port, "GET", "/logout", {});
  check(plain.setCookie.length > 0, `${name}: a /logout sütit állít (van mit mérni)`, `status=${plain.status}`);
  check(!hasSecure(plain), `${name}: sima HTTP → NINCS Secure (dev-belépés él)`, plain.setCookie.join(" | "));
  const xfp = await call(port, "GET", "/logout", { "X-Forwarded-Proto": "https" });
  check(hasSecure(xfp), `${name}: X-Forwarded-Proto: https (nginx) → Secure`, xfp.setCookie.join(" | "));
  const cf = await call(port, "GET", "/logout", { "CF-Visitor": '{"scheme":"https"}' });
  check(hasSecure(cf), `${name}: CF-Visitor https (Cloudflare) → Secure`, cf.setCookie.join(" | "));
  const xfpHttp = await call(port, "GET", "/logout", { "X-Forwarded-Proto": "http" });
  check(!hasSecure(xfpHttp), `${name}: X-Forwarded-Proto: http → NINCS Secure`, xfpHttp.setCookie.join(" | "));
  for (const attr of ["HttpOnly", "SameSite=Lax", "Path=/"]) {
    check(xfp.setCookie.some((c) => c.includes(attr)), `${name}: a ${attr} megmaradt`);
  }
}

// ── ② Failed-login throttle ────────────────────────────────────────────────────
console.log(`\n── ② Belépési fék (${guard.LOGIN_FAIL_LIMIT} hibás próba / ${guard.LOGIN_FAIL_WINDOW_MS / 60_000} perc / IP) ──`);
guard.resetLoginThrottle();
// A nonexistent user: authenticate() returns null without writing anything.
const BAD = `username=${encodeURIComponent(`login-guard-nobody-${process.pid}`)}&password=wrong`;
const THROTTLE_HU = /Túl sok sikertelen belépési kísérlet/;

for (const { name, port, ipA, ipB } of [
  { name: "tenant /login", port: PUB, ipA: "203.0.113.10", ipB: "203.0.113.11" },
  { name: "operátor /login", port: CON, ipA: "203.0.113.20", ipB: "203.0.113.21" },
]) {
  const statuses: number[] = [];
  for (let i = 0; i < guard.LOGIN_FAIL_LIMIT; i++) {
    statuses.push((await call(port, "POST", "/login", { "X-Real-IP": ipA }, BAD)).status);
  }
  check(
    statuses.every((s) => s !== 429),
    `${name}: az első ${guard.LOGIN_FAIL_LIMIT} hibás próba még NEM 429`,
    statuses.join(","),
  );
  const locked = await call(port, "POST", "/login", { "X-Real-IP": ipA }, BAD);
  check(locked.status === 429, `${name}: a ${guard.LOGIN_FAIL_LIMIT + 1}. próba 429`, `status=${locked.status}`);
  check(THROTTLE_HU.test(locked.body), `${name}: a 429 kimondja, mi történt (felhasználói üzenet)`);
  check(locked.setCookie.length === 0, `${name}: a letiltott próba nem ad munkamenet-sütit`);
  const other = await call(port, "POST", "/login", { "X-Real-IP": ipB }, BAD);
  check(other.status !== 429, `${name}: MÁSIK IP (X-Real-IP) nincs letiltva`, `status=${other.status}`);
}
guard.resetLoginThrottle();

// ── ③ The key: X-Real-IP / socket, never X-Forwarded-For (ADR-XXXX) ─────────────
console.log("\n── ③ A fék kulcsa: X-Real-IP / socket, SOHA nem az X-Forwarded-For ──");
// A client-invented X-Forwarded-For, fresh on every request (what nginx would pass on
// in front of its own appended address).
const spoof = (i: number): string => `198.18.${(i >> 8) & 255}.${i & 255}`;
for (const { name, port } of [
  { name: "tenant /login", port: PUB },
  { name: "operátor /login", port: CON },
]) {
  const statuses: number[] = [];
  for (let i = 0; i <= guard.LOGIN_FAIL_LIMIT; i++) {
    statuses.push((await call(port, "POST", "/login", { "X-Forwarded-For": spoof(i) }, BAD)).status);
  }
  check(
    statuses.at(-1) === 429,
    `${name}: kérésenként ÚJ X-Forwarded-For mellett is lezár (a socket-cím számít)`,
    statuses.join(","),
  );
  const behindNginx = await call(port, "POST", "/login", { "X-Real-IP": "203.0.113.30", "X-Forwarded-For": spoof(999) }, BAD);
  check(behindNginx.status !== 429, `${name}: X-Real-IP-vel külön kliens = külön számláló`, `status=${behindNginx.status}`);
  // A direct-to-origin client inventing a fresh CF-Connecting-IP per request: still ONE key.
  const cfSpoof: number[] = [];
  for (let i = 0; i <= guard.LOGIN_FAIL_LIMIT; i++) {
    cfSpoof.push((await call(port, "POST", "/login", { "X-Real-IP": "203.0.113.31", "CF-Connecting-IP": spoof(i) }, BAD)).status);
  }
  check(cfSpoof.at(-1) === 429, `${name}: nem-CF társtól kérésenként ÚJ CF-Connecting-IP mellett is lezár`, cfSpoof.join(","));
  // Two guests behind the SAME Cloudflare edge: separate counters (one locked, one free).
  for (let i = 0; i <= guard.LOGIN_FAIL_LIMIT; i++) {
    await call(port, "POST", "/login", { "X-Real-IP": "162.159.114.119", "CF-Connecting-IP": "203.0.113.32" }, BAD);
  }
  const guestB = await call(port, "POST", "/login", { "X-Real-IP": "162.159.114.119", "CF-Connecting-IP": "203.0.113.33" }, BAD);
  check(guestB.status !== 429, `${name}: ugyanazon CF-él mögötti MÁSIK vendég nincs letiltva`, `status=${guestB.status}`);
}
guard.resetLoginThrottle();

// The public booking/enquiry throttle (public.ts `throttled`, 5 / 10 min) on the real server.
{
  const row = await db
    .selectFrom("site")
    .select("slug")
    .where("status", "=", "live")
    .where("slug", "is not", null)
    .orderBy("slug")
    .executeTakeFirst();
  if (check(Boolean(row?.slug), "foglalási fék: van élő dev-oldal, amin mérhető (/t/<slug>/)")) {
    const path = `/t/${row!.slug}/api/erdeklodes`;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await call(PUB, "POST", path, { "X-Forwarded-For": spoof(i) }, "x=1")).status);
    check(
      statuses.slice(0, 5).every((s) => s === 400) && statuses[5] === 429,
      "foglalási fék: kérésenként ÚJ X-Forwarded-For mellett a 6. kérés 429",
      statuses.join(","),
    );
    const realA = await call(PUB, "POST", path, { "X-Real-IP": "203.0.113.40", "X-Forwarded-For": spoof(5) }, "x=1");
    check(realA.status === 400, "foglalási fék: X-Real-IP-vel külön kliens = külön számláló", `status=${realA.status}`);
    // Behind one Cloudflare edge: guest A uses up the limit, guest B still gets through.
    const edge = { "X-Real-IP": "104.23.248.217" };
    const aStatuses: number[] = [];
    for (let i = 0; i < 6; i++) aStatuses.push((await call(PUB, "POST", path, { ...edge, "CF-Connecting-IP": "203.0.113.41" }, "x=1")).status);
    const guestB = await call(PUB, "POST", path, { ...edge, "CF-Connecting-IP": "203.0.113.42" }, "x=1");
    check(
      aStatuses[5] === 429 && guestB.status === 400,
      "foglalási fék: ugyanazon CF-él mögött az A vendég lezár, a B vendég átjut",
      `A=${aStatuses.join(",")} B=${guestB.status}`,
    );
  }
}

// The helper itself, and that no brake reads X-Forwarded-For on its own again.
{
  const { clientIp } = await import("../src/server/clientIp.js");
  const req = (headers: Record<string, string | string[]>, remoteAddress = "10.0.0.1") =>
    ({ headers, socket: { remoteAddress } }) as never;
  check(clientIp(req({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "1.2.3.4" })) === "203.0.113.5", "clientIp: X-Real-IP nyer");
  check(clientIp(req({ "x-forwarded-for": "1.2.3.4" })) === "10.0.0.1", "clientIp: X-Forwarded-For-ot NEM olvas (socket)");
  check(clientIp(req({ "x-real-ip": "  " })) === "10.0.0.1", "clientIp: üres X-Real-IP → socket");
  // Prod runs behind Cloudflare: the nginx peer is the EDGE, the client is CF-Connecting-IP —
  // trusted only from an edge (IPv4, IPv6 and the IPv4-mapped socket form).
  check(clientIp(req({ "x-real-ip": "162.159.114.119", "cf-connecting-ip": "203.0.113.7" })) === "203.0.113.7", "clientIp: CF-él (IPv4) mögött a CF-Connecting-IP a kliens");
  check(clientIp(req({ "x-real-ip": "2606:4700:3031::1", "cf-connecting-ip": "2001:db8::7" })) === "2001:db8::7", "clientIp: CF-él (IPv6) mögött a CF-Connecting-IP a kliens");
  check(clientIp(req({ "cf-connecting-ip": "203.0.113.8" }, "::ffff:104.23.248.217")) === "203.0.113.8", "clientIp: CF-él socket-címe (::ffff:) is él");
  check(clientIp(req({ "x-real-ip": "198.51.100.9", "cf-connecting-ip": "203.0.113.9" })) === "198.51.100.9", "clientIp: NEM CF-társtól a CF-Connecting-IP-t figyelmen kívül hagyja (közvetlen origin-hívás)");
  check(clientIp(req({ "x-real-ip": "162.159.114.119" })) === "162.159.114.119", "clientIp: CF-él CF-Connecting-IP nélkül → a társ címe");
  const { readFileSync } = await import("node:fs");
  for (const f of ["src/server/public.ts", "src/auth/loginGuard.ts", "src/console/server.ts"]) {
    check(!/x-forwarded-for/i.test(readFileSync(f, "utf8")), `${f}: nem olvassa az X-Forwarded-For-t (egy szabály: clientIp)`);
  }
}

// Realm isolation + window expiry + "checked before the password", on the module itself.
{
  const fake = (ip: string) => ({ headers: { "x-real-ip": ip }, socket: {} }) as never;
  const t0 = 1_000_000;
  for (let i = 0; i < guard.LOGIN_FAIL_LIMIT; i++) guard.recordLoginFailure("tenant", fake("198.51.100.1"), t0);
  check(guard.loginLocked("tenant", fake("198.51.100.1"), t0 + 1), "modul: limit után zárva");
  check(!guard.loginLocked("operator", fake("198.51.100.1"), t0 + 1), "modul: a másik birodalom (operátor) független");
  check(
    !guard.loginLocked("tenant", fake("198.51.100.1"), t0 + guard.LOGIN_FAIL_WINDOW_MS + 1),
    "modul: az ablak lejárta után újra próbálhat",
  );
  guard.resetLoginThrottle();
}

// Source wiring: the lock is checked BEFORE authenticate, and only failures are counted
// (a successful login never adds to the counter — the gates log in many times).
{
  const { readFileSync } = await import("node:fs");
  const pub = readFileSync("src/server/public.ts", "utf8");
  const con = readFileSync("src/console/server.ts", "utf8");
  const pubBlock = pub.slice(pub.indexOf('pathname === "/login") {\n    const form'), pub.indexOf("setSession(res, uid);"));
  const conBlock = con.slice(con.indexOf('if (path === "/login") {'), con.indexOf("setOperatorSession(res, id);"));
  for (const [name, block, realm, auth] of [
    ["tenant", pubBlock, "tenant", "authenticate("],
    ["operátor", conBlock, "operator", "authenticateOperator("],
  ] as const) {
    const lockAt = block.indexOf(`loginLocked("${realm}"`);
    const authAt = block.indexOf(auth);
    const recAt = block.indexOf(`recordLoginFailure("${realm}"`);
    check(lockAt >= 0 && authAt > lockAt, `${name}: a fék a jelszó-ellenőrzés ELŐTT fut`);
    check(recAt > authAt, `${name}: csak a sikertelen próbát számolja (a sikeres ág előtt, a !id ágban)`);
  }
}

// ── Self-test: the assertions must bite ────────────────────────────────────────
if (SELF_TEST) {
  console.log("\n── ÖNELLENŐRZÉS (szándékos rontás — PIROSNAK kell lennie) ──");
  const bites = (name: string, red: boolean): void => {
    console.log(red ? `  ✓ ${name} → PIROS` : `  ✗ FAIL ${name} → átment (vak az őr)`);
    if (!red) failed++;
  };
  // Unconditional Secure (the dev-killer) must be caught by the plain-HTTP branch.
  bites("feltétel nélküli Secure", hasSecure({ status: 200, body: "", setCookie: ["cit_s=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0"] }));
  // A cookie missing Secure behind nginx must be caught by the HTTPS branch.
  bites("hiányzó Secure HTTPS mögött", !hasSecure({ status: 200, body: "", setCookie: ["cit_s=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"] }));
  // "SecureX"/"Secured" in a value must not count as the attribute.
  bites("Secure-szerű érték nem attribútum", !hasSecure({ status: 200, body: "", setCookie: ["x=Secured; HttpOnly"] }));
  // A throttle that never locks: after LIMIT failures, not locked → the ② assertion is red.
  const fake = { headers: { "x-real-ip": "192.0.2.99" }, socket: {} } as never;
  for (let i = 0; i < guard.LOGIN_FAIL_LIMIT - 1; i++) guard.recordLoginFailure("tenant", fake);
  bites("limit alatt nincs zár (LIMIT-1 próba)", !guard.loginLocked("tenant", fake));
  guard.resetLoginThrottle();
  // The old key (first X-Forwarded-For element): the ③ negative control must see it
  // as a DIFFERENT client per request, i.e. the brake would never close.
  const oldKey = (xff: string) => xff.split(",")[0]!.trim();
  bites("régi kulcs (XFF első eleme): kérésenként új kliens", oldKey(`${spoof(1)}, 10.0.0.1`) !== oldKey(`${spoof(2)}, 10.0.0.1`));
  // A naive "always trust CF-Connecting-IP" key: a direct-to-origin client picks its own.
  const { isCloudflareEdge } = await import("../src/server/clientIp.js");
  bites("CF-Connecting-IP feltétel nélkül: nem-CF társ is választ kulcsot", !isCloudflareEdge("203.0.113.31"));
  // A key that ignores Cloudflare: every guest of a PoP shares the edge's counter.
  bites("CF-él = egy kliens: a PoP összes vendége egy számlálón", isCloudflareEdge("162.159.114.119"));
}

server.close();
consoleServer.close();
await db.destroy();
if (failed) {
  console.error(`\n⛔ login-hardening-check: ${failed} ellenőrzés bukott (ADR-0277, ADR-XXXX).`);
  process.exit(1);
}
console.log("\n✅ login-hardening-check: Secure süti csak HTTPS-en, belépési fék mindkét birodalomban.");
process.exit(0);
