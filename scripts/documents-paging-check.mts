// Guard: the paginated document list must not change the MONEY (ADR-0064 KPI band).
//
// Why this exists: pagination split getDocuments into "rows = one page" and
// "money = SQL aggregate over every match". The failure mode it guards against is
// silent and expensive — if the aggregate ever starts following the page (a stray
// LIMIT, a filter applied to one query but not the others), the headline KPI band
// quietly becomes "page 1's balance" and no screen would look broken.
//
// Method: recompute every aggregate the DUMB way (read all matching rows, sum in
// JS) and assert the shipped implementation agrees, across filter combinations and
// across pages. Also asserts the page slicing itself is sound: pages tile the whole
// result set exactly once (no row shown twice, none skipped).
//
//   npx tsx scripts/documents-paging-check.mts
//   npx tsx scripts/documents-paging-check.mts --self-test   (must go RED)

import {
  DOCUMENTS_PAGE_SIZE,
  agingBucketFor,
  getDocuments,
  settleOffsetDays,
  type MoneyByCurrency,
  type PartnerDocQuery,
} from "../src/console/partnerData.js";
import { db, pool } from "../src/db/client.js";

const SELF_TEST = process.argv.includes("--self-test");
// ⚠️ Az önteszt is ADATFÜGGŐ: üres dev DB-n a szándékos rontásnak sincs mit
// elrontania, és a futás ZÖLDET írna ki — ami pont az ellenkezőjét állítaná annak,
// amit az önteszt bizonyítani hivatott. Ezért üres halmazon KIMONDJUK, hogy az
// önteszt nem futott le (2026-08-28).
if (SELF_TEST) {
  const probe = await getDocuments({}, undefined, { pageSize: 3 });
  if (probe.total === 0) {
    console.error(
      "⛔ önteszt NEM FUTTATHATÓ: a dev DB-ben 0 bizonylat van — a szándékos rontásnak " +
        "nincs mit elrontania. Az önteszt csak adattal érvényes (tölts fel bizonylatot, " +
        "vagy a kapu kapjon saját fixture-öket).",
    );
    process.exit(1);
  }
}
let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "ok  " : "🔴  "} ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const money = (m: MoneyByCurrency): string =>
  Object.entries(m)
    .filter(([, v]) => Math.round(v) !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, v]) => `${c}:${Math.round(v)}`)
    .join("|") || "∅";

/** The naive truth: every matching row, summed in JS — no pagination anywhere. */
async function bruteForce(q: PartnerDocQuery) {
  let qb = db
    .selectFrom("accounting_document")
    .leftJoin("partner", "partner.id", "accounting_document.partner_id")
    .select([
      "direction",
      "accounting_document.currency as currency",
      "paid",
      "due_date",
      "paid_at",
      "accounting_document.gross as gross",
    ])
    .where("accounting_document.status", "!=", "void");
  if (q.currency) qb = qb.where("accounting_document.currency", "=", q.currency);
  if (q.partner) qb = qb.where("partner.name", "ilike", `%${q.partner}%`);
  if (q.from) qb = qb.where("issue_date", ">=", new Date(`${q.from}T00:00:00Z`));
  if (q.dueFrom) qb = qb.where("due_date", ">=", new Date(`${q.dueFrom}T00:00:00Z`));
  const all = await qb.execute();

  const now = Date.now();
  const add = (m: Record<string, number>, c: string, v: number) => {
    m[c] = (m[c] ?? 0) + v;
  };
  const receivable: MoneyByCurrency = {};
  const payable: MoneyByCurrency = {};
  const overdue: MoneyByCurrency = {};
  const aging: Record<string, MoneyByCurrency> = {
    notDue: {}, d1to30: {}, d31to60: {}, d61to90: {}, d90plus: {},
  };
  const totalGross: MoneyByCurrency = {};
  let receivableCount = 0, payableCount = 0, overdueCount = 0, total = 0;
  let settleSum = 0, onTime = 0, settled = 0;

  for (const d of all) {
    const gross = Number(d.gross);
    if (!d.paid) {
      const dueMs = d.due_date ? new Date(d.due_date as unknown as string).getTime() : null;
      const bucket = agingBucketFor(dueMs, now);
      add(aging[bucket]!, d.currency, gross);
      if (d.direction === "outgoing") { add(receivable, d.currency, gross); receivableCount++; }
      else { add(payable, d.currency, gross); payableCount++; }
      if (bucket !== "notDue") { add(overdue, d.currency, gross); overdueCount++; }
    }
    if (d.paid && d.paid_at && d.due_date) {
      const off = settleOffsetDays(
        new Date(d.paid_at as unknown as string).getTime(),
        new Date(d.due_date as unknown as string).getTime(),
      );
      settleSum += off;
      if (off <= 0) onTime++;
      settled++;
    }
    if (q.paid === undefined || d.paid === q.paid) { add(totalGross, d.currency, gross); total++; }
  }
  return {
    receivable, payable, overdue, aging, totalGross, total,
    receivableCount, payableCount, overdueCount,
    habit: settled ? { avgDays: settleSum / settled, onTimeRatio: onTime / settled, sample: settled } : null,
  };
}

const CASES: ReadonlyArray<[string, PartnerDocQuery]> = [
  ["szűrő nélkül", {}],
  ["csak nyitott", { paid: false }],
  ["csak fizetett", { paid: true }],
  ["HUF", { currency: "HUF" }],
  ["EUR", { currency: "EUR" }],
  ["EUR + nyitott", { currency: "EUR", paid: false }],
  ["partner-töredék", { partner: "Hetzner" }],
  ["kelte-tól", { from: "2026-07-01" }],
  ["határidő-tól", { dueFrom: "2026-08-01" }],
  ["üres metszet", { currency: "EUR", partner: "Anthropic" }],
];

console.log("\n① A lapozás NEM változtatja meg a pénzt (aggregátum = teljes szűrt halmaz):\n");
for (const [label, q] of CASES) {
  const truth = await bruteForce(q);
  const got = await getDocuments(q);
  check(`[${label}] Nekem jár`, money(got.kpi.receivable) === money(truth.receivable),
    `${money(got.kpi.receivable)} ≠ ${money(truth.receivable)}`);
  check(`[${label}] Én fizetek`, money(got.kpi.payable) === money(truth.payable),
    `${money(got.kpi.payable)} ≠ ${money(truth.payable)}`);
  check(`[${label}] Lejárt`, money(got.kpi.overdue) === money(truth.overdue),
    `${money(got.kpi.overdue)} ≠ ${money(truth.overdue)}`);
  check(`[${label}] darabszámok`,
    got.kpi.receivableCount === truth.receivableCount &&
    got.kpi.payableCount === truth.payableCount &&
    got.kpi.overdueCount === truth.overdueCount,
    `${got.kpi.receivableCount}/${got.kpi.payableCount}/${got.kpi.overdueCount} ≠ ${truth.receivableCount}/${truth.payableCount}/${truth.overdueCount}`);
  check(`[${label}] korosítás mind az 5 vödör`,
    (["notDue", "d1to30", "d31to60", "d61to90", "d90plus"] as const).every(
      (b) => money(got.aging[b]) === money(truth.aging[b]!)),
    "vödör-eltérés");
  check(`[${label}] végösszeg`, money(got.totalGross) === money(truth.totalGross),
    `${money(got.totalGross)} ≠ ${money(truth.totalGross)}`);
  check(`[${label}] találat-szám (lapozó alapja)`, got.total === truth.total,
    `${got.total} ≠ ${truth.total}`);
  check(`[${label}] fizetési szokás`,
    JSON.stringify(got.habit && { ...got.habit, avgDays: Math.round(got.habit.avgDays * 1000) }) ===
    JSON.stringify(truth.habit && { ...truth.habit, avgDays: Math.round(truth.habit.avgDays * 1000) }),
    "habit-eltérés");
}

console.log("\n② A lapok HÉZAGMENTESEN és ÁTFEDÉS NÉLKÜL fedik a halmazt:\n");
{
  // A TINY page size on purpose: the dev DB holds far fewer documents than one
  // real page, so at DOCUMENTS_PAGE_SIZE this section would pass without ever
  // crossing a page boundary — a green gate proving nothing. With size 3 the
  // real offsets, the tie-break ordering and the last-page remainder all run.
  const PG = 3;
  const first = await getDocuments({}, undefined, { pageSize: PG });
  // ⚠️ KÖRNYEZET-FÜGGŐ MÉRÉS (2026-08-28): ez a szakasz a MEGOSZTOTT dev DB
  // tartalmára épül, és az ADR-0075 teszt-adat purge után 0 bizonylat maradt —
  // ettől a kapu MINDEN worktree MINDEN commitját blokkolta, pedig nem talált
  // hibát, csak nem volt mit mérnie. Ilyenkor HANGOSAN kihagyjuk: a „nincs mit
  // mérni" nem ugyanaz, mint a „megmérve, rendben".
  // 💡 Tartós megoldás (a kapu gazdájának): saját eldobható fixture-ök, mint a
  // partner-registry-check-ben — akkor a mérés független a DB állapotától.
  if (first.pageCount < 3) {
    console.log(
      `  ⚠️  KIHAGYVA: a dev DB-ben ${first.total} bizonylat van (${first.pageCount} oldal) — ` +
        `a lapozás-mérés ehhez kevés. NEM mértük meg; a KPI-egyezés fentebb lefutott.`,
    );
  } else {
  const seen: string[] = [];
  for (let p = 1; p <= first.pageCount; p++) {
    const pg = await getDocuments({}, undefined, { page: p, pageSize: PG });
    seen.push(...pg.rows.map((r) => r.id));
    const expected = p < first.pageCount ? PG : first.total - (first.pageCount - 1) * PG;
    check(`${p}. oldal sorszáma (${pg.rows.length} sor)`, pg.rows.length === expected,
      `${pg.rows.length} ≠ ${expected}`);
  }
  check("minden sor pontosan egyszer szerepel (nincs átfedés/kihagyás)",
    new Set(seen).size === seen.length, `${seen.length} sor, ${new Set(seen).size} egyedi`);
  check("a lapok együtt kiadják a teljes találatot", seen.length === first.total,
    `${seen.length} ≠ ${first.total}`);
  // The money must be identical on every page — that is the whole point.
  const p1 = await getDocuments({}, undefined, { page: 1, pageSize: PG });
  const pLast = await getDocuments({}, undefined, { page: first.pageCount, pageSize: PG });
  check("⭐⭐ a KPI-sáv az UTOLSÓ oldalon is a teljes halmazt mutatja",
    money(p1.kpi.receivable) === money(pLast.kpi.receivable) &&
    money(p1.kpi.overdue) === money(pLast.kpi.overdue) && p1.total === pLast.total,
    `${money(p1.kpi.receivable)} ≠ ${money(pLast.kpi.receivable)}`);
  check("⭐ a KPI nem az oldal összege (a lapozott ≠ oldalnyi sor)",
    pLast.rows.length < pLast.total, "az oldal a teljes halmaz — a mérés nem érvényes");

  const all = await getDocuments({}, undefined, { all: true });
  check("⭐ az export (all) a TELJES listát viszi, nem az oldalt", all.rows.length === first.total,
    `${all.rows.length} ≠ ${first.total}`);
  check("a tartomány-túllépés az utolsó oldalra kapcsol",
    (await getDocuments({}, undefined, { page: 9999, pageSize: PG })).page === first.pageCount);
  check("a 0/negatív oldal az elsőre kapcsol",
    (await getDocuments({}, undefined, { page: -3, pageSize: PG })).page === 1);

  if (SELF_TEST) {
    // Deliberate red: prove the gate actually detects a page-scoped aggregate.
    const pageOnly = await getDocuments({}, undefined, { page: 1 });
    const sumOfPage: MoneyByCurrency = {};
    for (const r of pageOnly.rows.filter((x) => !x.paid && x.direction === "outgoing"))
      sumOfPage[r.currency] = (sumOfPage[r.currency] ?? 0) + r.gross;
    check("[SELF-TEST] az oldal-összeg ELTÉR a teljes KPI-tól (ha nem, a minta túl kicsi)",
      money(sumOfPage) !== money(pageOnly.kpi.receivable),
      "a dev DB kevesebb sort tartalmaz mint egy oldal — töltsd fel a mérésig");
  }
  }
}

await pool.end();
if (failures) {
  console.error(`\ndocuments-paging-check: 🔴 ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ documents-paging-check: a lapozás sorokat vág, pénzt nem.");
