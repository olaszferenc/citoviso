// ADR-0118 — a KIFIZETETT, elakadt nyelv-generálás magától induljon újra.
//
// A HIBA, amit zár (mérve a dev-parkon 2026-09-11): a generálás a fizetési webhook
// után DETACHED fut, ezért egy szerver-újraindítás vagy összeomlás elvágja, és a sor
// örökre 'generating'-en marad — a vevő kifizetett egy fordítást, ami soha nem készül
// el. Két ilyen sor élt, az egyik 12 órás; a kártya „csapatunk újraindítja" mondata
// pedig addig üres ígéret volt, mert semmi nem indította újra (§B.17 ránk is áll).
//
// NÉGY SZABÁLY, mind pénz-okból (egy generálás valós LLM-munka):
//
// ① ÉLETJEL, nem óra. A futó generálás nyelvenként frissíti a `heartbeat_at`-ot, és a
//    figyelő EZT nézi. Idő-alapon („20 perce indult") egy LASSÚ, de élő futás mellé
//    indítanánk egy másodikat: dupla költség és versengő írás ugyanazokra a fájlokra.
// ② EGY IGÉNYLŐ. A claim egy FELTÉTELES UPDATE (`status`+`heartbeat_at` a WHERE-ben):
//    a Postgres sor-zárja dönt, tehát két egyszerre futó tick közül pontosan az egyik
//    viszi el a sort. Előbb-olvas-aztán-ír megoldás itt versenyt hagyna.
// ③ VÉGES SOROZAT. `attempts` ≤ MAX_MULTILANG_ATTEMPTS. Egy tartósan bukó generálás
//    különben óránként égetné a pénzt, örökre. A KÉZI (operátori) újraindítás NEM
//    fogyaszt próbálkozást — ugyanaz az elv, mint a 0058 pár-javításnál.
// ④ AKI FELADJA, SZÓL. A sorozat végén EMBER kap riasztást (SMS/e-mail), pontosan
//    egyszer (`alert_at`), és a kártya is abbahagyja az „újraindítjuk" ígéretét.
//    Címzett híján a riasztás HANGOSAN nyom nélkül marad, és a következő tick újra
//    próbálja — így nem vész el csendben (a pairRepair mintája).

import { sql } from "kysely";

import { db } from "../db/client.js";
import { getAlertRecipients } from "../console/appSettings.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import { runMultilangGeneration } from "./multilangGenerate.js";

/**
 * Ennyi ideig nem jelentkező generálás számít HALOTTNAK. Egy nyelv fordítása percek,
 * és az életjel nyelvenként frissül, tehát 10 perc néma csend már nem lassúság.
 */
export const MULTILANG_STALL_MINUTES = 10;

/** Ennyi AUTOMATA próbálkozás után ember kell hozzá. */
export const MAX_MULTILANG_ATTEMPTS = 3;

export interface ResumeCandidate {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly languages: readonly string[];
  readonly status: string;
  readonly attempts: number;
  readonly amount: number | null;
  readonly ref: string | null;
  /** Percek az utolsó életjel (vagy a létrehozás) óta. */
  readonly idleMinutes: number;
}

export interface ResumeResult {
  readonly checked: number;
  readonly resumed: number;
  readonly finished: number;
  readonly gaveUp: number;
  readonly notes: readonly string[];
}

/**
 * KIFIZETETT, be nem fejezett generálások, amelyek megadott ideje nem jelentkeztek.
 * A 'failed' is benne van: a mért bukások egy része átmeneti (kimerült API-egyenleg,
 * hálózat), és pont azokat gyógyítja egy későbbi próba.
 */
export async function stalledGenerations(staleMinutes = MULTILANG_STALL_MINUTES): Promise<ResumeCandidate[]> {
  const rows = await db
    .selectFrom("multilang_generation as g")
    .innerJoin("payment as p", "p.order_intent_id", "g.order_intent_id")
    .innerJoin("tenant as t", "t.id", "g.tenant_id")
    .select([
      "g.id as id",
      "g.tenant_id as tenantId",
      "t.display_name as tenantName",
      "g.languages as languages",
      "g.status as status",
      "g.attempts as attempts",
      "p.amount as amount",
      "p.gateway_ref as ref",
      sql<number>`extract(epoch from (now() - coalesce(g.heartbeat_at, g.created_at))) / 60`.as(
        "idleMinutes",
      ),
    ])
    .where("p.status", "=", "paid")
    .where("g.status", "in", ["paid", "generating", "failed"])
    .where(sql<boolean>`coalesce(g.heartbeat_at, g.created_at) < now() - (${staleMinutes} || ' minutes')::interval`)
    .orderBy("g.created_at", "asc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    languages: (r.languages ?? []) as string[],
    status: r.status,
    attempts: r.attempts,
    amount: r.amount ?? null,
    ref: r.ref ?? null,
    idleMinutes: Math.round(Number(r.idleMinutes)),
  }));
}

/**
 * Megpróbálja BIRTOKBA VENNI a sort. Egyetlen feltételes UPDATE: a `status` és az
 * életjel a WHERE-ben van, tehát két párhuzamos tick közül pontosan az egyik kapja meg.
 * `consumeAttempt=false` a kézi (operátori) újraindításé — az nem fogyaszt sorozatot.
 */
export async function claimGeneration(
  id: string,
  opts: { staleMinutes?: number; consumeAttempt?: boolean; maxAttempts?: number } = {},
): Promise<boolean> {
  const stale = opts.staleMinutes ?? MULTILANG_STALL_MINUTES;
  const consume = opts.consumeAttempt ?? true;
  const max = opts.maxAttempts ?? MAX_MULTILANG_ATTEMPTS;
  let q = db
    .updateTable("multilang_generation")
    .set({
      status: "generating",
      heartbeat_at: new Date(),
      ...(consume ? { attempts: sql<number>`attempts + 1` } : {}),
    })
    .where("id", "=", id)
    .where("status", "in", ["paid", "generating", "failed"])
    .where(sql<boolean>`coalesce(heartbeat_at, created_at) < now() - (${stale} || ' minutes')::interval`);
  // A sorozat-korlát is a WHERE-ben ül, nem a hívó jólneveltségén: így egy kézzel
  // indított extra tick sem tud a negyedik automata próbálkozásba csúszni.
  if (consume) q = q.where("attempts", "<", max);
  const claimed = await q.returning("id").executeTakeFirst();
  return Boolean(claimed);
}

/** A riasztás két csatornája — ugyanaz a kettő, mint az AAM/pár-riasztásnál (ADR-0098). */
async function alertOperator(c: ResumeCandidate, lastError: string): Promise<boolean> {
  const rcpt = await getAlertRecipients();
  if (!rcpt.phone && !rcpt.email) {
    // HANGOSAN és JELÖLETLENÜL: címzett nélkül a riasztás nem mehet ki, ezért nem is
    // jelöljük elküldöttnek — a következő tick újra próbálja (pairRepair mintája).
    console.error(
      `[multilang-resume] FELADVA (${c.tenantName}, ${c.id}), de nincs riasztási címzett ` +
        `(konzol /settings vagy OWNER_ALERT_PHONE) — értesítés NEM ment ki.`,
    );
    return false;
  }
  const langs = c.languages.join(", ");
  // Belső, operátori szöveg — a §B.18 vevő-oldali i18n hatókörén kívül.
  if (rcpt.phone) {
    await sendSms({
      to: rcpt.phone,
      text:
        `Citoviso: KIFIZETETT nyelv-generalas nem keszult el — ${c.tenantName} (${langs}). ` +
        `${MAX_MULTILANG_ATTEMPTS} automata probalkozas utan sem. A vevo fizetett, a termek nincs meg. Kezi beavatkozas kell.`,
    });
  }
  if (rcpt.email) {
    await getEmailSender().send({
      to: rcpt.email,
      audience: "platform",
      subject: `Citoviso: kifizetett nyelv-generálás elakadt — ${c.tenantName} (kézi beavatkozás kell)`,
      text:
        `A(z) "${c.tenantName}" tenant kifizette a Többnyelvű honlap modult ` +
        `(${c.amount ?? "?"} Ft, hivatkozás: ${c.ref ?? "–"}), a generálás viszont ` +
        `${MAX_MULTILANG_ATTEMPTS} automatikus próbálkozás után sem készült el.\n\n` +
        `Nyelvek: ${langs}\nGenerálás azonosítója: ${c.id}\nUtolsó hiba: ${lastError}\n\n` +
        `A vevő kártyáján ez már NEM ígér automatikus újraindítást — a tenant arra vár, ` +
        `hogy megkeressük.\n\n` +
        `Teendő: a hiba okának megnézése, majd kézi újraindítás:\n` +
        `  npx tsx scripts/resume-multilang.mts --force ${c.id}\n`,
    });
  }
  return true;
}

export interface MultilangResumeDeps {
  readonly run: (id: string) => Promise<{ ok: boolean; error?: string }>;
  readonly alert: (c: ResumeCandidate, lastError: string) => Promise<boolean>;
}

const REAL_DEPS: MultilangResumeDeps = {
  run: (id) => runMultilangGeneration(id),
  alert: alertOperator,
};

/**
 * Egy figyelő-tick. Bármilyen ütemezéssel biztonságos: csak azt a sort érinti, amelyik
 * a megadott ideje nem jelentkezett, és a birtokbavétel feltételes UPDATE.
 */
export async function resumeStalledGenerations(
  deps: MultilangResumeDeps = REAL_DEPS,
  staleMinutes = MULTILANG_STALL_MINUTES,
): Promise<ResumeResult> {
  const candidates = await stalledGenerations(staleMinutes);
  const notes: string[] = [];
  let resumed = 0;
  let finished = 0;
  let gaveUp = 0;

  for (const c of candidates) {
    // ── a sorozat elfogyott → EMBER, pontosan egyszer ────────────────────────
    if (c.attempts >= MAX_MULTILANG_ATTEMPTS) {
      const already = await db
        .selectFrom("multilang_generation")
        .select("alert_at")
        .where("id", "=", c.id)
        .executeTakeFirst();
      if (already?.alert_at) continue; // már szóltunk róla, nincs mit tenni
      const last = await db
        .selectFrom("multilang_generation")
        .select("error")
        .where("id", "=", c.id)
        .executeTakeFirst();
      const sent = await deps.alert(c, last?.error ?? "ismeretlen hiba");
      // A sor akkor is VÉGLEGES bukás, ha a riasztás nem ment ki — a felület nem
      // ígérhet tovább automatikus újraindítást, amíg valójában már feladtuk.
      await db
        .updateTable("multilang_generation")
        .set({
          status: "failed",
          error:
            last?.error ??
            `a generálás ${MAX_MULTILANG_ATTEMPTS} automatikus próbálkozás után sem fejeződött be`,
          ...(sent ? { alert_at: new Date() } : {}),
        })
        .where("id", "=", c.id)
        .execute();
      if (sent) {
        gaveUp++;
        notes.push(`⛔ feladva + riasztás: ${c.tenantName} (${c.id})`);
      }
      continue;
    }

    // ── birtokbavétel, majd futtatás ─────────────────────────────────────────
    if (!(await claimGeneration(c.id, { staleMinutes }))) {
      notes.push(`↷ közben más vitte el: ${c.tenantName}`);
      continue;
    }
    resumed++;
    const r = await deps.run(c.id);
    if (r.ok) {
      finished++;
      notes.push(`✅ befejezve: ${c.tenantName} (${c.attempts + 1}. próbálkozás)`);
    } else {
      notes.push(`⚠️ ismét elbukott: ${c.tenantName} — ${r.error ?? "?"}`);
    }
  }

  return { checked: candidates.length, resumed, finished, gaveUp, notes };
}
