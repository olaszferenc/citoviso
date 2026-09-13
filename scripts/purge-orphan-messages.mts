// Removes tenant_message rows whose anchor record NO LONGER EXISTS.
//
// WHY THIS EXISTS (measured 2026-09-13, ADR-0127): the shared dev park's ELEK
// mailbox held 114 messages, 112 of them written in three days. Every Elek FK-007
// walk seeds fresh booking_requests and the reset drops them again — but the
// message log is not a child of booking_request (no FK: several tables qualify as
// an anchor), so the rows survive their subject. Same for the 9 invoice notices
// whose invoices `reset-elek-billing-clock.mts` removed. The result is a mailbox
// full of rows pointing at nothing, which reads as a product defect on every
// screenshot and skews every measurement taken on the park.
//
// ⛔ WHAT THIS IS NOT: a mailbox trimmer. It deletes ONLY rows whose related_id
// names a record that is gone. A dunning ladder carries NO related_id at all —
// those are valid history and are never touched, however repetitive they look.
// „Sok belőle" is not „árva" (measured: 114 messages, but only 44 orphaned; the
// owner's cleanup request quoted a summary line, and the summary line was wrong).
//
// SAFETY:
//   · SCOPED TO THE ELEK TEST PARK by default. Measured 2026-09-13: the same sweep
//     run DB-wide also matched 2 rows in „Dencs Apartmanház" — a tenant the owner
//     uses himself, not park residue (`reset-elek-billing-clock.mts` lists leaving
//     it alone as a safety property). The cleanup was approved for the park, so the
//     park is what it touches; --all-tenants widens it, and what is skipped is
//     always printed (a silent cap reads as „covered everything").
//   · Only rows with a NON-NULL related_id whose target row is missing. A NULL
//     anchor can never qualify — an unanchored message is not an orphan.
//   · Only related_kinds we can actually RESOLVE to a table. An unknown kind is
//     reported and SKIPPED, never guessed: „nem mérhető → nem állítjuk".
//   · Full JSON backup of every deleted row BEFORE the write, with a sha256 — a
//     restore that cannot detect truncation is not a backup.
//   · One transaction, delete BY ID (the id list is the audited list — a re-run of
//     the predicate inside the DELETE could match rows the backup does not hold).
//   · Dry-run by default; --go performs it. Re-reads to verify.
//
// Run:  npx tsx scripts/purge-orphan-messages.mts                 (dry-run, ELEK park)
//       npx tsx scripts/purge-orphan-messages.mts --go            (élesen)
//       npx tsx scripts/purge-orphan-messages.mts --all-tenants   (minden tenant)

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import { sql } from "kysely";

const GO = process.argv.includes("--go");
const ALL_TENANTS = process.argv.includes("--all-tenants");
const BACKUP_DIR = "_planning/backups";

/**
 * related_kind → the table that must contain related_id.
 * ⛔ Only kinds listed here are ever considered. `logTenantMessage` writes the
 * anchor freely, so an unlisted kind means we cannot prove the target is gone —
 * and an unprovable orphan is not an orphan.
 */
const ANCHOR_TABLE = {
  booking_request: "booking_request",
  invoice: "invoice",
} as const;

type AnchorKind = keyof typeof ANCHOR_TABLE;
const isAnchorKind = (k: string): k is AnchorKind => k in ANCHOR_TABLE;

async function main(): Promise<void> {
  // ── hatókör ────────────────────────────────────────────────────────────────
  let scopeIds: string[] | null = null;
  if (!ALL_TENANTS) {
    const park = await db
      .selectFrom("tenant")
      .select(["id", "display_name"])
      .where("display_name", "like", "ELEK%")
      .execute();
    if (!park.length) {
      console.error("⛔ nincs ELEK-TESZT tenant — hatókör nélkül nem törlök. (--all-tenants tudatosan tágít)");
      process.exit(1);
    }
    scopeIds = park.map((t) => t.id);
    console.log(`hatókör: ${park.map((t) => t.display_name).join(", ")} (--all-tenants tágít)`);
  } else {
    console.log("hatókör: MINDEN tenant (--all-tenants)");
  }

  let q = db.selectFrom("tenant_message").selectAll().where("related_id", "is not", null);
  if (scopeIds) q = q.where("tenant_id", "in", scopeIds);
  const rows = await q.execute();

  // ── what can we even judge? ────────────────────────────────────────────────
  const unknown = new Map<string, number>();
  const judged = rows.filter((r) => {
    const k = r.related_kind ?? "";
    if (isAnchorKind(k)) return true;
    unknown.set(k, (unknown.get(k) ?? 0) + 1);
    return false;
  });
  if (unknown.size) {
    console.log("⚠️  NEM VIZSGÁLT horgony-fajták (nincs feloldható táblájuk — kihagyva):");
    for (const [k, n] of unknown) console.log(`     ${k || "(üres)"} — ${n} sor`);
  }

  // ── which anchors are actually gone? ───────────────────────────────────────
  const orphans: typeof rows = [];
  for (const kind of Object.keys(ANCHOR_TABLE) as AnchorKind[]) {
    const mine = judged.filter((r) => r.related_kind === kind);
    if (!mine.length) continue;
    const ids = [...new Set(mine.map((r) => r.related_id!))];
    const alive = await sql<{ id: string }>`
      select id::text as id from ${sql.table(ANCHOR_TABLE[kind])}
      where id = any(${sql.val(ids)}::uuid[])
    `.execute(db);
    const liveIds = new Set(alive.rows.map((r) => r.id));
    const gone = mine.filter((r) => !liveIds.has(r.related_id!));
    console.log(
      `\n${kind}: ${mine.length} hivatkozó üzenet · ${liveIds.size} élő horgony · ` +
        `${gone.length} ÁRVA`,
    );
    orphans.push(...gone);
  }

  // ── amit a HATÓKÖR miatt kihagyunk, azt KIMONDJUK ──────────────────────────
  // Egy néma korlát úgy olvasódik, mintha mindent lefedtünk volna.
  if (scopeIds) {
    const outside = await db
      .selectFrom("tenant_message as m")
      .innerJoin("tenant as t", "t.id", "m.tenant_id")
      .select(["t.display_name as name", db.fn.countAll().as("n")])
      .where("m.related_id", "is not", null)
      .where("m.tenant_id", "not in", scopeIds)
      .where((eb) =>
        eb.or([
          eb.and([
            eb("m.related_kind", "=", "booking_request"),
            eb.not(eb.exists(
              eb.selectFrom("booking_request as b").select("b.id").whereRef("b.id", "=", "m.related_id"),
            )),
          ]),
          eb.and([
            eb("m.related_kind", "=", "invoice"),
            eb.not(eb.exists(
              eb.selectFrom("invoice as i").select("i.id").whereRef("i.id", "=", "m.related_id"),
            )),
          ]),
        ]),
      )
      .groupBy("t.display_name")
      .execute();
    if (outside.length) {
      console.log("\n⚠️  A HATÓKÖRÖN KÍVÜL is van árva sor — NEM nyúlok hozzá:");
      for (const o of outside) console.log(`     ${o.name}: ${o.n} sor`);
      console.log("     (ha kell: --all-tenants, de az a tulaj tenantjait is érinti)");
    }
  }

  if (!orphans.length) {
    console.log("\n✅ Nincs árva üzenet a hatókörben — nincs mit takarítani.");
    await db.destroy();
    return;
  }

  // ── the audited list, per tenant and per kind ──────────────────────────────
  const byTenant = new Map<string, number>();
  for (const r of orphans) byTenant.set(r.tenant_id, (byTenant.get(r.tenant_id) ?? 0) + 1);
  console.log(`\n── TÖRLENDŐ: ${orphans.length} sor ──`);
  for (const [t, n] of byTenant) console.log(`   tenant ${t}: ${n} sor`);
  const bySubject = new Map<string, number>();
  for (const r of orphans) {
    const s = (r.subject ?? r.body_text.split("\n")[0] ?? "").slice(0, 62);
    bySubject.set(s, (bySubject.get(s) ?? 0) + 1);
  }
  for (const [s, n] of [...bySubject].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)}×  ${s}`);
  }

  // ── ŐRSOR: a törlendő halmaz nem tartalmazhat NEM-árva sort ────────────────
  // Nem a fenti ciklust hiszem el: a listát FÜGGETLENÜL újra megvizsgálom, mielőtt
  // bármit írnék. Egy hibás szűrő pontosan úgy néz ki, mint egy jogos törlés.
  const ids = orphans.map((r) => r.id);
  const recheck = await sql<{ n: string }>`
    select count(*)::text as n from tenant_message m
    where m.id = any(${sql.val(ids)}::uuid[])
      and (
        m.related_id is null
        or (m.related_kind = 'booking_request'
            and exists (select 1 from booking_request b where b.id = m.related_id))
        or (m.related_kind = 'invoice'
            and exists (select 1 from invoice i where i.id = m.related_id))
        or m.related_kind not in ('booking_request', 'invoice')
      )
  `.execute(db);
  const wrong = Number(recheck.rows[0]!.n);
  if (wrong !== 0) {
    console.error(`\n⛔ A törlendő listában ${wrong} NEM árva sor van. Nem írok. Ez hiba a szűrőben.`);
    process.exit(1);
  }
  console.log(`\n✅ őrsor: mind a ${ids.length} sor igazoltan árva (független újravizsgálat).`);

  const payload = {
    reason: "ADR-0127 — árva tenant_message sorok takarítása a KÖZÖS dev parkból",
    counts: { total: orphans.length, byTenant: Object.fromEntries(byTenant) },
    rows: orphans,
  };
  const body = JSON.stringify(payload, null, 2);
  const sha = createHash("sha256").update(body).digest("hex");

  if (!GO) {
    console.log(`\n🔎 DRY-RUN. Írás nem történt. Éles futtatás: --go`);
    await db.destroy();
    return;
  }

  await mkdir(BACKUP_DIR, { recursive: true });
  // A bélyeg a DB órájából jön, nem a processzéből — egy óra az egész rekordnak.
  const stampRow = await sql<{ s: string }>`select to_char(now(), 'YYYY-MM-DD"T"HH24-MI-SS') as s`.execute(db);
  const stamp = stampRow.rows[0]!.s;
  const file = path.join(BACKUP_DIR, `orphan-messages-${stamp}.json`);
  await writeFile(file, body, "utf8");
  await writeFile(`${file}.sha256`, `${sha}  ${path.basename(file)}\n`, "utf8");
  console.log(`\n💾 mentés: ${file}`);
  console.log(`   sha256: ${sha.slice(0, 16)}…  (${orphans.length} sor)`);

  const before = await db
    .selectFrom("tenant_message")
    .select(db.fn.countAll().as("n"))
    .executeTakeFirstOrThrow();

  await db.transaction().execute(async (trx) => {
    // BY ID: a mentés pontosan ezt a listát tartalmazza. A predikátum újrafuttatása
    // a DELETE-ben olyan sort is elvihetne, ami a mentésben nincs benne.
    await trx.deleteFrom("tenant_message").where("id", "in", ids).execute();
  });

  // ── visszaolvasással igazol, nem az írást hiszi el ─────────────────────────
  const after = await db
    .selectFrom("tenant_message")
    .select(db.fn.countAll().as("n"))
    .executeTakeFirstOrThrow();
  const leftover = await db
    .selectFrom("tenant_message")
    .select(db.fn.countAll().as("n"))
    .where("id", "in", ids)
    .executeTakeFirstOrThrow();

  const removed = Number(before.n) - Number(after.n);
  console.log(`\n✅ üzenetek: ${before.n} → ${after.n} (törölve ${removed})`);
  console.log(`   a törlendő listából maradt: ${leftover.n}`);
  if (removed !== orphans.length || Number(leftover.n) !== 0) {
    console.error("⛔ A visszaellenőrzés NEM egyezik a szándékkal.");
    process.exit(1);
  }
  await db.destroy();
}

await main();
