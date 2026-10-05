// Őr: a konzol több-sablonos generálás-kötege LÉPCSŐZVE indul (src/console/staggeredBatch.ts).
//
// WHY (tulajdonosi döntés, 2026-10-05): a párhuzamosan induló sablonok egymás prompt-cache-ét
// nem látják, mind maguk írják ugyanazt az előtagot. Az első sablon egyedül fut a „copy”
// szakasza végéig (brief + őrök = a cache-író hívások), a többi csak utána indul — így a
// −35–38% a köteg többi tagjára is kiterjed. A lépcső viszont SOSEM akaszthatja meg a köteget.
//
// Ellenőrzi:
//  ① viselkedés: a követők a `warm()` ELŐTT nem indulnak, utána mind egyszerre; a vezető
//     bukása (dobás, elutasítás) is elengedi őket és a köteg allSettled-eredményt ad; a
//     várakozás időkorlátra is kinyit; az eredmények a sablonok sorrendjében jönnek.
//  ② bekötés: a konzol generálás-útja runStaggered-del indít, és a vezető a „render”
//     szakasznál nyit (az utolsó cache-író hívás után).
//
// Se AI, se hálózat, se DB. Futtatás: npx tsx scripts/batch-stagger-check.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runStaggered } from "../src/console/staggeredBatch.js";

const ROOT = new URL("..", import.meta.url).pathname;
const failures: string[] = [];
const fail = (m: string) => failures.push(m);
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// ① behaviour
{
  const started: number[] = [];
  let warmLeader!: () => void;
  let finishLeader!: () => void;
  const batch = runStaggered(3, (i, warm) => {
    started.push(i);
    if (i === 0) {
      warmLeader = warm;
      return new Promise<string>((r) => {
        finishLeader = () => r("a");
      });
    }
    return Promise.resolve(String.fromCharCode(97 + i));
  });
  await tick();
  if (started.join() !== "0") fail(`warm() előtt csak a vezető fut — indult: [${started.join()}]`);
  warmLeader();
  await tick();
  if (started.join() !== "0,1,2") fail(`warm() után mind indul — indult: [${started.join()}]`);
  finishLeader();
  const res = await batch;
  const vals = res.map((r) => (r.status === "fulfilled" ? r.value : "x")).join();
  if (vals !== "a,b,c") fail(`az eredmények sorrendje/tartalma: [${vals}], várt [a,b,c]`);
}
for (const [name, leaderJob] of [
  ["elutasító vezető", () => Promise.reject(new Error("boom"))],
  ["szinkron dobó vezető", () => {
    throw new Error("boom");
  }],
] as const) {
  const res = await runStaggered(2, (i) => (i === 0 ? (leaderJob as () => Promise<string>)() : Promise.resolve("ok")), 60_000);
  if (res[0]?.status !== "rejected" || res[1]?.status !== "fulfilled") {
    fail(`${name}: a köteg nem allSettled-szerűen zárt (${res.map((r) => r.status).join()})`);
  }
}
{
  const t0 = Date.now();
  let leaderDone!: () => void;
  const started: number[] = [];
  const batch = runStaggered(
    2,
    (i) => {
      started.push(i);
      return i === 0 ? new Promise<void>((r) => (leaderDone = r)) : Promise.resolve();
    },
    50,
  );
  await tick(120);
  if (started.join() !== "0,1") fail(`időkorlát: a követő ${Date.now() - t0} ms után sem indult`);
  leaderDone();
  await batch;
}
if ((await runStaggered(0, () => Promise.resolve(1))).length !== 0) fail("0 tagú köteg nem üres eredmény");

// ② wiring
{
  const server = readFileSync(join(ROOT, "src/console/server.ts"), "utf8");
  const at = server.indexOf("const genMatch =");
  const block = at < 0 ? "" : server.slice(at, at + 4000);
  if (!/runStaggered\(\s*picks\.length/.test(block)) {
    fail("src/console/server.ts: a generálás-út nem runStaggered(picks.length, …)-del indítja a köteget.");
  }
  if (!/stage === "render"\)\s*warm\(\)/.test(block)) {
    fail('src/console/server.ts: a vezető nem a „render” szakasznál nyit (if (stage === "render") warm()).');
  }
  if (/Promise\.allSettled\(\s*picks\.map/.test(block)) {
    fail("src/console/server.ts: a köteg újra párhuzamosan indul (Promise.allSettled(picks.map…)).");
  }
}

if (failures.length) {
  console.error(`⛔ batch-stagger-check: ${failures.length} hiba`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("✅ batch-stagger-check: a több-sablonos köteg lépcsőzve indul, és sosem akad el a vezetőn.");
