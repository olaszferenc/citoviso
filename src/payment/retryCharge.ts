// Kézi terhelés-újrapróbálás — a freeze-state-v2 ⑤ hiányzó fele.
//
// A jóváhagyott terv mockjában két gomb állt az elakadt kártyaterhelésnél:
// „Újrapróbálom ezzel a kártyával" és „Másik kártyát adok meg". A második
// megvalósult (a fizetési link: a tárolt megbízást csak 3DS-sel megerősített,
// ügyfél-kezdeményezett fizetés adhatja meg újra), az ELSŐ nem — nem volt
// szerver-útvonal, ami egy MIT-terhelést újra megkísérelne, és egy némán semmit
// nem csináló gomb rosszabb a hiánynál. Ez a modul az a hiányzó út.
//
// MIÉRT KELL EGYÁLTALÁN: a leggyakoribb elutasítás a fedezethiány. Ha a tulaj
// közben feltöltötte a kártyát, ma nincs mit tennie — a létra a FAGYÁS UTÁN már
// nem próbálkozik (`offset < FREEZE_OFFSET`), tehát az automata nem jön vissza
// érte. Egy kattintás vs. újra megadni a kártyát a Barionnál: ugyanaz a pénz,
// sokkal kisebb súrlódás.
//
// ⛔ AMI NEM VÁLTOZIK: a terhelés MAGA a meglévő `chargeRenewalWithToken()`.
// Abban már benne van a dupla-terhelés önjavítása (ha a ciklus MÁR fizetve,
// rendez terhelés helyett), a függő MIT-fizetés újrahasználata és az elakadt
// pending lezárása. Második terhelés-utat írni belőle két igazság lenne, és az
// elcsúszás a bankszámlán derülne ki (feedback_one_rule_two_copies).
//
// ⛔ A KORLÁTOK A WHERE-BEN ÜLNEK, nem a hívó jólneveltségén (ADR-0118 ② mintája):
// a claim EGYETLEN feltételes UPDATE, ami egyszerre nézi a várakozási időt és a
// sorozat-korlátot. Két párhuzamos kattintásból pontosan az egyik nyer.

import { sql } from "kysely";

import { db } from "../db/client.js";
import { chargeRenewalWithToken } from "./service.js";
import type { RenewalChargeOutcome } from "./service.js";

/**
 * Hány MIT-terhelés (fizető nélküli, tárolt kártyás) mehet EGY megújulás-orderre
 * összesen. Ebből az ELSŐ az automata létráé (az pontosan egyszer próbál egy
 * orderre), a maradék a tulajé.
 *
 * ⚠️ Nem önkényes szám: a kártyatársaságok korlátozzák egy ELUTASÍTOTT
 * MIT-tranzakció újrapróbálását, és a korlát túllépése a kereskedőt bünteti.
 * Szűken tartjuk; ha a bank harmadszorra is elutasít, nem az ismétlés hiányzik,
 * hanem egy MÁSIK kártya — oda a fizetési link vezet.
 */
export const MAX_MIT_ATTEMPTS_PER_ORDER = 4;

/** Két kézi próba között eltelendő idő. Elég ahhoz, hogy egy feltöltés
 *  megtörténjen, és megakadályozza a gomb püfölését. */
export const RETRY_COOLDOWN_MINUTES = 15;

export type RetryRefusal =
  | "nincs_elofizetes"
  | "nincs_tartozas"
  | "nincs_kartya"
  | "nincs_rendezendo_order"
  | "varakozas"
  | "sorozat_vege";

export type RetryResult =
  | { readonly ok: true; readonly outcome: RenewalChargeOutcome }
  | { readonly ok: false; readonly refusal: RetryRefusal };

/** Beadható terhelés-függvény — az őr így mér valódi átjáró (és valódi pénz) nélkül. */
export type Charger = (
  orderIntentId: string,
  recurrenceToken: string,
  traceId: string | null,
) => Promise<RenewalChargeOutcome>;

/**
 * A tulaj által indított terhelés-újrapróba.
 *
 * Minden előfeltételt A SZERVER mér újra — a gomb megléte nem bizonyíték
 * (`feedback_badge_answered_one_of_nine_gates`: a képernyő mást számolhat, mint
 * amit a művelet predikátuma enged).
 */
export async function retryRenewalCharge(
  tenantId: string,
  deps: { readonly charge?: Charger } = {},
): Promise<RetryResult> {
  const charge = deps.charge ?? chargeRenewalWithToken;

  const sub = await db
    .selectFrom("subscription")
    .select([
      "id",
      "status",
      "payment_method as paymentMethod",
      "recurrence_token as recurrenceToken",
      "recurrence_trace_id as recurrenceTraceId",
      "current_period_end as periodEnd",
    ])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!sub) return { ok: false, refusal: "nincs_elofizetes" };

  // Csak akkor van mit beszedni, amíg a létra fut. Aktív előfizetésen egy
  // „újrapróbálom" gomb terhelést indítana olyasmire, ami nincs is hátralékban.
  if (sub.status !== "frozen" && sub.status !== "past_due") {
    return { ok: false, refusal: "nincs_tartozas" };
  }
  // Tárolt kártya nélkül nincs mit újrapróbálni: ilyenkor a fizetési link az út.
  if (sub.paymentMethod !== "token" || !sub.recurrenceToken) {
    return { ok: false, refusal: "nincs_kartya" };
  }

  // A dunningolt megújulás-order — UGYANAZ a kulcs, amivel a létra és a
  // tartozás-kártya dolgozik (`renewal_period_start = current_period_end`),
  // nem egy újraszámolt hasonmás.
  const order = await db
    .selectFrom("order_intent")
    .select("id")
    .where("kind", "=", "renewal")
    .where("tenant_id", "=", tenantId)
    .where("renewal_period_start", "=", sub.periodEnd)
    .executeTakeFirst();
  if (!order) return { ok: false, refusal: "nincs_rendezendo_order" };

  // ── BIRTOKBAVÉTEL: egyetlen feltételes UPDATE ──────────────────────────────
  // A várakozási idő ÉS a sorozat-korlát is itt van, nem a hívóban. Két
  // párhuzamos kattintásból pontosan az egyik kapja meg a sort, tehát dupla
  // terhelés nem indulhat — és egy elfelejtett előellenőrzés sem tud átengedni.
  //   A darabszám LEVEZETETT: az order MIT-fizetései (`pay_url IS NULL`).
  // Külön számláló-oszlop második igazság lenne, amit minden terhelés-útnak
  // karban kellene tartania.
  const claimed = await db
    .updateTable("order_intent")
    .set({ manual_charge_at: new Date() })
    .where("id", "=", order.id)
    .where(
      sql<boolean>`manual_charge_at is null or manual_charge_at < now() - (${RETRY_COOLDOWN_MINUTES} || ' minutes')::interval`,
    )
    .where(
      sql<boolean>`(select count(*) from payment where order_intent_id = order_intent.id and pay_url is null) < ${MAX_MIT_ATTEMPTS_PER_ORDER}`,
    )
    .returning("id")
    .executeTakeFirst();

  if (!claimed) {
    // Nem vitte el a sort. Két oka lehet, és a kettő MÁS üzenet a tulajnak:
    // vagy még jár a türelmi idő, vagy elfogyott a sorozat. Egy összevont
    // „nem sikerült" itt azt a hibát követné el, amit ez a kör javít: nem
    // mondaná meg, mit tehet.
    const used = await db
      .selectFrom("payment")
      .select(sql<string>`count(*)`.as("n"))
      .where("order_intent_id", "=", order.id)
      .where("pay_url", "is", null)
      .executeTakeFirst();
    const n = Number(used?.n ?? 0);
    return { ok: false, refusal: n >= MAX_MIT_ATTEMPTS_PER_ORDER ? "sorozat_vege" : "varakozas" };
  }

  const outcome = await charge(order.id, sub.recurrenceToken, sub.recurrenceTraceId ?? null);
  return { ok: true, outcome };
}
