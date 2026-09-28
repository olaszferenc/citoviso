// ÉJSZAKAI KÖR — Elek végigviszi a teljes ívet TELEFONON: megveszi a honlapot, minden
// modult megvesz és feltölt, majd vendégként rátalál és foglal, végül mindkét oldalon
// végigkövetjük a foglalás utóéletét.
//
//   npx tsx elek/bin/run-night.mts                 # a teljes lánc
//   npx tsx elek/bin/run-night.mts FK-013 FK-014   # csak a megadott körök
//
// ⛔ A TULAJ KÉRÉSE (2026-09-27): „ha megakad valahol mert gáz van jegyezzük, nézzünk
// meg több variációt, de ne fagyjunk be azon a helyen." Ezért ez a vezénylő SOHA nem áll
// meg egy bukott körön: minden kör lefut, amelyiknek a bemenete megvan, a hiányzó bemenet
// pedig KIMONDOTT kihagyás (nem néma átlépés — a néma kihagyás hamis zöldet gyárt).
//
// A lánc bemenetei körönként a DB-ből derülnek ki (a park-doktrína szerint mérve, nem
// feltételezve): a vásárlás után a bérlő + belépés, a vendég-kör után a foglalás
// lemondó-tokenje, a tulaj-kör után az ajánlat tokenje.
process.env.CIT_SHOT = "1";

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/** A kör alanya: bőséges, jóváhagyott mockkal bíró, MÉG NEM VÁSÁROLT lead. */
const SUBJECT_LEAD = process.env.ELEK_NIGHT_LEAD ?? "Három Huszár Apartments";

const CHAIN = ["FK-011", "FK-012", "FK-013", "FK-014", "FK-015", "FK-016"] as const;
const rounds = args.length ? CHAIN.filter((c) => args.includes(c)) : [...CHAIN];

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(ROOT, "elek", "runs", `NIGHT-${stamp}`);
mkdirSync(outDir, { recursive: true });
const logPath = path.join(outDir, "NIGHT.md");
const lines: string[] = [`# Éjszakai kör — ${stamp}`, "", `alany: **${SUBJECT_LEAD}**`, ""];
function log(s: string): void {
  lines.push(s);
  writeFileSync(logPath, lines.join("\n") + "\n");
  console.log(s);
}

const env: Record<string, string> = { ...process.env } as Record<string, string>;
env.ELEK_NIGHT_NAME = SUBJECT_LEAD;

// A tulaj SAJÁT fotói: a lead portál-képei, letöltve (tulajdonosi döntés 2026-09-27 —
// valódi méret és tájolás, mert a konvertálás útját is próbára teszi). Két adag: 12 (a
// megengedett maximum egyszerre) + 6, hogy a második feltöltés is mérve legyen.
// ⛔ Hiányzó könyvtár = HANGOS hiba: a fotó-szakasz néma kihagyása azt a hamis zöldet
// adná, hogy a feltöltés rendben van.
const photoDir = process.env.ELEK_NIGHT_PHOTO_DIR ?? path.join(ROOT, "elek", "runs", "_night-photos");
const photos = existsSync(photoDir)
  ? readdirSync(photoDir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => (Number(a.replace(/\D/g, "")) || 0) - (Number(b.replace(/\D/g, "")) || 0))
      .map((f) => path.join(photoDir, f))
  : [];
if (photos.length >= 18) {
  env.ELEK_NIGHT_PHOTOS_A = photos.slice(0, 12).join(",");
  env.ELEK_NIGHT_PHOTOS_B = photos.slice(12, 18).join(",");
} else {
  console.log(`⚠️ ${photoDir}: csak ${photos.length} fotó (18 kell) — az FK-013 fotó-szakasza kihagyásra kerül`);
}

const { db, pool } = await import("../../src/db/client.js");

async function leadId(): Promise<string> {
  const row = await db.selectFrom("lead").select("id").where("name", "=", SUBJECT_LEAD).executeTakeFirst();
  if (!row) throw new Error(`nincs ilyen lead a dev DB-ben: ${SUBJECT_LEAD}`);
  return row.id;
}

/** Amit a lánc következő köre megkövetel — mérve, nem feltételezve. */
async function refreshFacts(): Promise<void> {
  const lid = await leadId();

  const prospect = await db
    .selectFrom("prospect")
    .select(["token", "contact_email"])
    .where("lead_id", "=", lid)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (prospect) env.ELEK_NIGHT_PROSPECT_PATH = `/p/${prospect.token}`;

  const tenant = await db.selectFrom("tenant").select(["id"]).where("lead_id", "=", lid).executeTakeFirst();
  if (tenant) {
    env.ELEK_NIGHT_TENANT_ID = tenant.id;
    const site = await db
      .selectFrom("site")
      .select(["slug"])
      .where("tenant_id", "=", tenant.id)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    if (site?.slug) env.ELEK_NIGHT_SLUG = site.slug;
    const tu = await db
      .selectFrom("tenant_user")
      .select(["username"])
      .where("tenant_id", "=", tenant.id)
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    if (tu) env.ELEK_NIGHT_USER = tu.username;
  }

  // A foglalás lemondó-tokenje + az árajánlat tokenje: a vendég-kör, illetve a tulaj-kör
  // termékei. ⚠️ A lemondó link CSAK visszaigazolt foglaláson él (függő kérésen a lap azt
  // mondja: „A link már nem él" — mérve FK-008), ezért a visszaigazolt sort keressük
  // ELŐBB, és ha csak függő van, azt a jelentés kimondja. A jelszó hash-elve tárolódik,
  // ezért azt nem lehet innen kiolvasni — a belépést a vezénylő adja ki (ensureLogin).
  if (env.ELEK_NIGHT_TENANT_ID) {
    const sites = await db
      .selectFrom("site")
      .select(["id"])
      .where("tenant_id", "=", env.ELEK_NIGHT_TENANT_ID)
      .execute();
    const siteIds = sites.map((s) => s.id);
    if (siteIds.length) {
      const reqs = await db
        .selectFrom("booking_request")
        .select(["action_token", "offer_token", "status", "guest_name", "created_at"])
        .where("site_id", "in", siteIds)
        .orderBy("created_at", "desc")
        .execute();
      const confirmed = reqs.find((r) => r.status === "accepted");
      const forCancel = confirmed ?? reqs[0];
      if (forCancel?.action_token) {
        env.ELEK_NIGHT_CANCEL_PATH = `/foglalas/${forCancel.action_token}/lemondom`;
        if (!confirmed) log(`  ⚠️ nincs VISSZAIGAZOLT (accepted) foglalás — a lemondó link egy \`${forCancel.status}\` kérésre mutat`);
      }
      const offered = reqs.find((r) => r.offer_token);
      if (offered?.offer_token) env.ELEK_NIGHT_OFFER_PATH = `/ajanlat/${offered.offer_token}`;
    }
  }
}

/** A belépés: a vásárlás levélben adja ki, a hash-t nem lehet visszaolvasni. */
async function ensureLogin(): Promise<void> {
  if (!env.ELEK_NIGHT_TENANT_ID || env.ELEK_NIGHT_PASSWORD) return;
  const { issueTenantLogin } = await import("../../src/tenant/credentials.js");
  const login = await issueTenantLogin(env.ELEK_NIGHT_TENANT_ID, SUBJECT_LEAD, "elek@citoviso.com");
  env.ELEK_NIGHT_USER = login.username;
  env.ELEK_NIGHT_PASSWORD = login.password;
  log(`  belépés kiadva a vezénylőtől: \`${login.username}\` — ⚠️ a LEVÉLBŐL érkező belépés útja ezzel NEM mérve`);
}

/** Amit egy kör megkövetel. Hiányzó bemenet = KIMONDOTT kihagyás. */
const NEEDS: Record<string, string[]> = {
  "FK-011": ["ELEK_NIGHT_PROSPECT_PATH"],
  "FK-012": ["ELEK_NIGHT_USER", "ELEK_NIGHT_PASSWORD"],
  "FK-013": ["ELEK_NIGHT_USER", "ELEK_NIGHT_PASSWORD", "ELEK_NIGHT_PHOTOS_A", "ELEK_NIGHT_PHOTOS_B"],
  "FK-014": ["ELEK_NIGHT_SLUG"],
  "FK-015": ["ELEK_NIGHT_USER", "ELEK_NIGHT_PASSWORD"],
  "FK-016": ["ELEK_NIGHT_SLUG", "ELEK_NIGHT_CANCEL_PATH", "ELEK_NIGHT_OFFER_PATH"],
};

interface Outcome { fk: string; pass: number; fail: number; manual: number; blocked: number; dir: string; skipped?: string }
const outcomes: Outcome[] = [];

function runRound(fk: string): Promise<Outcome> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "elek/bin/runner.mts", fk], {
      cwd: ROOT,
      env: { ...env, ELEK_RUN_TAG: `NIGHT-${stamp}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); process.stdout.write(d); });
    child.stderr.on("data", (d: Buffer) => { out += d.toString(); process.stderr.write(d); });
    // ⛔ Nincs korlát nélküli várakozás: egy beragadt kör az EGÉSZ éjszakát elvinné.
    const killer = setTimeout(() => { child.kill("SIGKILL"); }, 45 * 60 * 1000);
    child.on("close", () => {
      clearTimeout(killer);
      // A runner összegző sora `pass=0 fail=5 manual=3 blocked=7` alakú — a korábbi
      // `(\d+) pass` minta erre NEM illeszkedett, és minden kört 0/0/0/0-nak jelentett
      // volna (néma hamis zöld a jelentésben).
      const num = (re: RegExp): number => Number(re.exec(out)?.[1] ?? 0);
      const dir = /elek\/runs\/([^\s]+)/.exec(out)?.[1] ?? "";
      resolve({
        fk,
        pass: num(/pass=(\d+)/),
        fail: num(/fail=(\d+)/),
        manual: num(/manual=(\d+)/),
        blocked: num(/blocked=(\d+)/),
        dir,
      });
    });
  });
}

log(`## Lánc: ${rounds.join(" → ")}`);
log("");

for (const fk of rounds) {
  await refreshFacts();
  if (fk === "FK-012" || fk === "FK-013" || fk === "FK-015") await ensureLogin();
  const missing = (NEEDS[fk] ?? []).filter((k) => !env[k]);
  if (missing.length) {
    const why = `hiányzó bemenet: ${missing.join(", ")}`;
    log(`### ${fk} — ⛔ KIHAGYVA (${why})`);
    log("");
    outcomes.push({ fk, pass: 0, fail: 0, manual: 0, blocked: 0, dir: "", skipped: why });
    continue;
  }
  log(`### ${fk} — indul`);
  for (const k of NEEDS[fk] ?? []) log(`  ${k}=${k.includes("PASSWORD") ? "***" : env[k]}`);
  const o = await runRound(fk);
  outcomes.push(o);
  log(`  → ${o.pass} pass · ${o.fail} fail · ${o.manual} kézi · ${o.blocked} blokkolt${o.dir ? ` · \`${o.dir}\`` : ""}`);
  log("");
}

log("## Összegzés");
log("");
log("| kör | pass | fail | kézi | blokkolt | futás |");
log("|---|---|---|---|---|---|");
for (const o of outcomes) {
  log(`| ${o.fk} | ${o.skipped ? "—" : o.pass} | ${o.skipped ? "—" : o.fail} | ${o.skipped ? "—" : o.manual} | ${o.skipped ? "—" : o.blocked} | ${o.skipped ? `KIHAGYVA: ${o.skipped}` : o.dir} |`);
}
log("");
log(`napló: \`${path.relative(ROOT, logPath)}\``);

await pool.end();
