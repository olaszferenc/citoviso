// A vendég-végpontok fékje (Elek-foglaló F-5, 2026-10-14): a foglalási POST korlátja IP-nként
// 5 kérés / 10 perc volt, a HIBÁS próbálkozás is beleszámított, és a keret minden tenantra és
// mindhárom végpontra (foglalás, érdeklődés, vélemény) KÖZÖS volt. Most:
//   ① a hibás (validációs) próbálkozás nem fogy a 5-ös keretből — csak a létrejött kérés;
//   ② a nyers plafon (30) a dörömbölést továbbra is megállítja;
//   ③ tenantonként és végpontonként külön keret;
//   ④ az ablak lejártával újra lehet (hamis órával mérve);
//   ⑤ a public.ts tényleg így köti be (forrás-ellenőrzés).
// Futtatás: npx tsx scripts/request-brake-check.mts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brakeKey, RequestBrake } from "../src/server/requestBrake.js";

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${JSON.stringify(d)}`}`);
  if (!c) fail++;
};
const W = 10 * 60_000;
let t = 1_000_000;
const clock = { now: () => t };

/** The booking POST as public.ts runs it: raw ceiling, created-limit check, count on success. */
function post(b: RequestBrake, tenant: string, ip: string, valid: boolean): number {
  const created = brakeKey("foglalas", tenant, ip);
  if (b.hit(brakeKey("foglalas-raw", tenant, ip), 30, W) || b.over(created, 5)) return 429;
  if (!valid) return 400;
  b.add(created, W);
  return 200;
}

console.log("\n① hibás próbálkozás nem fogy a keretből");
{
  const b = new RequestBrake(clock);
  const fails = Array.from({ length: 6 }, () => post(b, "T1", "1.1.1.1", false));
  check("6 hibás próbálkozás → mind 400 (nem 429)", fails.every((s) => s === 400), fails);
  const oks = Array.from({ length: 5 }, () => post(b, "T1", "1.1.1.1", true));
  check("⭐ utána még 5 kérés létrejöhet", oks.every((s) => s === 200), oks);
  check("⭐ a 6. létrejövő kérés → 429", post(b, "T1", "1.1.1.1", true) === 429);
}
console.log("\n② nyers plafon");
{
  const b = new RequestBrake(clock);
  const r = Array.from({ length: 31 }, () => post(b, "T1", "2.2.2.2", false));
  check("⭐ a 31. hibás próbálkozás → 429 (a dörömbölés megáll)", r[30] === 429 && r.slice(0, 30).every((s) => s === 400), r.slice(28));
}
console.log("\n③ tenantonként és végpontonként külön");
{
  const b = new RequestBrake(clock);
  for (let i = 0; i < 5; i++) post(b, "T1", "3.3.3.3", true);
  check("T1-en betelt", post(b, "T1", "3.3.3.3", true) === 429);
  check("⭐ ugyanarról az IP-ről T2-n még lehet", post(b, "T2", "3.3.3.3", true) === 200);
  check("⭐ más végpont (vélemény) kulcsa független", !b.over(brakeKey("velemeny", "T1", "3.3.3.3"), 3));
}
console.log("\n④ az ablak lejár");
{
  const b = new RequestBrake(clock);
  for (let i = 0; i < 5; i++) post(b, "T1", "4.4.4.4", true);
  check("betelt", post(b, "T1", "4.4.4.4", true) === 429);
  t += W + 1;
  check("⭐ 10 perc múlva újra lehet", post(b, "T1", "4.4.4.4", true) === 200);
}
console.log("\n⑤ a public.ts bekötése");
{
  const src = await readFile(path.resolve(import.meta.dirname, "../src/server/public.ts"), "utf8");
  const i = src.indexOf('pathname === "/api/foglalas"');
  const block = src.slice(i, src.indexOf("return sendJson(res, result.ok ? 200 : 400, result);", i) + 80);
  check("a foglalás kulcsa tenantot is tartalmaz", /brakeKey\("foglalas", site\.tenantId, clientIp\(req\)\)/.test(block));
  check("⭐ a nyers plafon és a létrejött-keret együtt", /throttled\(req, "foglalas-raw", site\.tenantId, 30,/.test(block) && /guestBrake\.over\(createdKey, 5\)/.test(block));
  check("⭐ csak sikeres kérés számít", /if \(result\.ok\) guestBrake\.add\(createdKey/.test(block));
  check("nincs több tenant nélküli, közös IP-számláló", !/throttled\(req, \d/.test(src) && !/bookingHits/.test(src));
}
console.log(fail ? `\n⛔ REQUEST-BRAKE: ${fail} bukás` : "\n🟢 REQUEST-BRAKE: a hibás próbálkozás nem fogy, tenantonként külön keret, a dörömbölés megáll");
process.exit(fail ? 1 : 0);
