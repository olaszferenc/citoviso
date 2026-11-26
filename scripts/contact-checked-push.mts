// „Országok / Árazás” 4. fázis (0155): the contact chain's „mobile checked” marks go to the console
// (POST /contact-checked → lead.contact_checked_at) — the replacement of the Debian crontab line that
// concatenated the chain's done-files and uploaded them over ssh as /opt/citoviso/checked-ids.txt.
// Same login as the chain's apply.mjs (operator `neo`, password file ~/.config/citoviso/<user>-<db>-operator.txt).
// Only the ids not pushed yet are sent (state file next to the done-files). Dry unless --go.
//
//   npx tsx scripts/contact-checked-push.mts [--go] [--base=https://admin.citoviso.com] [--user=neo] [--db=prod]
//        [--dir=~/rc-briefs/uj-lanc/kontakt/out]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const go = process.argv.includes("--go");
const base = arg("base") ?? "https://admin.citoviso.com";
const user = arg("user") ?? "neo";
const dbName = arg("db") ?? "prod";
const dir = arg("dir") ?? path.join(process.env.HOME ?? "", "rc-briefs/uj-lanc/kontakt/out");
const FILES = ["done.txt", "email-google-done.txt", "tomeges-done.txt"];
const STATE = path.join(dir, `contact-checked-pushed-${dbName}.txt`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const read = (f: string): string[] => (existsSync(f) ? readFileSync(f, "utf8").split("\n").map((l) => l.trim()).filter((l) => UUID.test(l)) : []);
const all = [...new Set(FILES.flatMap((f) => read(path.join(dir, f))))];
const pushed = new Set(read(STATE));
const fresh = all.filter((id) => !pushed.has(id));
console.log(`kész-listák: ${all.length} lead · már elküldve: ${pushed.size} · új: ${fresh.length}`);
if (!go || !fresh.length) {
  if (!go) console.log("száraz futás — küldeni: --go");
  process.exit(0);
}

const raw = readFileSync(path.join(process.env.HOME ?? "", `.config/citoviso/${user}-${dbName}-operator.txt`), "utf8");
const pw = (raw.match(/^\s*(?:jelszó|password)\s*:\s*(\S+)\s*$/im)?.[1] ?? raw).trim();
const login = await fetch(`${base}/login`, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", Origin: base },
  body: new URLSearchParams({ username: user, password: pw }).toString(),
});
const cookies = login.headers.getSetCookie?.() ?? [];
if ((login.status !== 302 && login.status !== 303) || !cookies.length) throw new Error(`belépés sikertelen (${login.status})`);
const cookie = cookies.map((c) => c.split(";")[0]).join("; ");

let marked = 0;
for (let k = 0; k < fresh.length; k += 5000) {
  const chunk = fresh.slice(k, k + 5000);
  const r = await fetch(`${base}/contact-checked`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", Origin: base, Cookie: cookie, Accept: "application/json" },
    body: new URLSearchParams({ ids: chunk.join(",") }).toString(),
    signal: AbortSignal.timeout(60_000),
  });
  if (r.status !== 200) throw new Error(`POST /contact-checked: ${r.status} ${(await r.text()).slice(0, 200)}`);
  marked += Number(((await r.json()) as { marked?: number }).marked ?? 0);
  for (const id of chunk) pushed.add(id);
  writeFileSync(STATE, [...pushed].join("\n") + "\n");
}
console.log(`OK: ${fresh.length} id elküldve, ${marked} új jel a DB-ben`);
process.exit(0);
