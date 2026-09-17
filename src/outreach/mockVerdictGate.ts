// A GENERÁLÁSKORI őr-verdiktek kapuja — olvasás, indoklás, kurátori feloldás.
//
// ⛔⛔ MIÉRT LETT EBBŐL KÜLÖN MODUL (mérve 2026-09-16, Myrna Haus megkeresés):
// a kapu a `mock_artifact.inputs`-ban tárolt `designVerdict`/`factVerdict` értéket
// olvasta, és FLAG esetén megtagadta a küldést azzal, hogy „kurátor-rendezésig nem
// küldhető" — miközben ① a képernyő SEHOL nem mondta meg, MIT talált az őr (a
// `designReason` a composition-úton el sem volt mentve), és ② a kurátori rendezésre
// EGYETLEN felületi művelet sem létezett. A kurátor jóváhagyta a mockot
// (`status='approved'`), a kapu mégis blokkolt, kiút nélkül: beragadt állapot.
//
// A fotó-kapu (mockPhotoHealth.ts) ugyanezt a problémát már megoldotta — ez a modul
// ANNAK a mintáját követi: kötelező indoklás, naplózott tudomásulvétel, és az ack
// csak a MOSTANI leletre érvényes.
import { sql } from "kysely";
import { db } from "../db/client.js";
import { isUsableAckReason, MIN_ACK_REASON_CHARS } from "./mockPhotoHealth.js";

export { MIN_ACK_REASON_CHARS, isUsableAckReason };

/** A generáláskor rögzített őr-verdiktek, amelyek a kiküldést blokkolhatják. */
export const GUARD_VERDICT_KEYS = [
  "designVerdict",
  "demoFraming",
  "factVerdict",
  "marketVerdict",
] as const;
export type GuardVerdictKey = (typeof GUARD_VERDICT_KEYS)[number];

/** Melyik `inputs` mező hordozza az adott verdikt EMBERI indokát. */
const REASON_KEY: Record<GuardVerdictKey, string> = {
  designVerdict: "designReason",
  demoFraming: "demoFramingReason",
  factVerdict: "factUnsourced",
  marketVerdict: "marketReason",
};

/**
 * Emberi megnevezés — a kulcsnév („designVerdict") az operátornak nem mond semmit.
 *
 * ⛔ EZ A NÉV MÁSODIK PÉLDÁNY: a konzol `mockInputLabel()`-je (views.ts) ugyanezeket a
 * kulcsokat nevezi meg az artifact-adatlapon. Két név ugyanarra a kapura = két igazság
 * egy képernyőn, ezért SZÁNDÉKOSAN bájtra ugyanazok a szavak, és a
 * `scripts/verdict-gate-guard.mts` állítása köti össze a kettőt. Ha itt átírod, ott is
 * át kell — az őr hangosan megbukik, nem csendben csúszik szét.
 */
export const VERDICT_LABEL: Record<GuardVerdictKey, string> = {
  designVerdict: "Dizájn-kapu",
  demoFraming: "Demó-keretezés",
  factVerdict: "Tényhűség-kapu",
  marketVerdict: "Piac-kapu",
};

export interface BlockingVerdict {
  readonly key: GuardVerdictKey;
  /** "flag" = az őr sértést talált; "error" = az őr nem tudott ítélni. */
  readonly value: "flag" | "error";
  /** Emberi megnevezés (pl. „Tényhűség"). */
  readonly label: string;
  /**
   * Amit az őr TALÁLT, ha rögzítettük. ⛔ Üres string = az indok nincs eltárolva;
   * a hívó ezt MONDJA KI, ne csendben hagyja el (ez volt az eredeti hiba).
   */
  readonly reason: string;
}

function readReason(inputs: Record<string, unknown>, key: GuardVerdictKey): string {
  const raw = inputs[REASON_KEY[key]];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string").join(" · ");
  return typeof raw === "string" ? raw : "";
}

/**
 * A blokkoló verdiktek listája. A HIÁNYZÓ kulcs átmegy: a determinisztikus utak
 * jogosan nem futtatnak minden verifiert — csak a KIMONDOTT "flag"/"error" blokkol.
 */
export function blockingVerdicts(inputs: unknown): BlockingVerdict[] {
  const obj = (inputs ?? {}) as Record<string, unknown>;
  const out: BlockingVerdict[] = [];
  for (const key of GUARD_VERDICT_KEYS) {
    const v = obj[key];
    if (v !== "flag" && v !== "error") continue;
    out.push({ key, value: v, label: VERDICT_LABEL[key], reason: readReason(obj, key) });
  }
  return out;
}

/** Kurátori tudomásulvétel a generáláskori őr-verdiktekre. */
export interface VerdictAck {
  readonly at: string;
  readonly by: string;
  readonly reason: string;
  /**
   * MIRE szólt a tudomásulvétel: kulcs → az AKKORI érték. ⛔ Ez teszi
   * szűkké az engedélyt — egy újragenerálás utáni ÚJ lelet nincs lefedve.
   */
  readonly verdicts: Record<string, string>;
}

/**
 * A tudomásulvétel kiolvasása.
 *
 * ⚠️ AZ INDOKLÁS ITT NEM KÖTELEZŐ — szándékosan más, mint a fotó-kapunál (tulajdonosi
 * döntés, 2026-09-17: „max figyelmeztessen, de ha utána is továbbkattint, menjen ki").
 * A GARANCIA nem a szöveg, hanem hogy a megerősítés KIMONDOTT, MÁSODIK kattintás a
 * lelet ismeretében, és hogy naplózzuk (ki, mikor, MIRE). Amit követelünk, az a
 * `verdicts` névsor: enélkül a pipa tárgy nélküli lenne, és bármit lefedne.
 */
export function verdictAckOf(inputs: unknown): VerdictAck | null {
  const ack = (inputs as { verdictAck?: VerdictAck } | null)?.verdictAck;
  if (!ack || typeof ack.verdicts !== "object" || ack.verdicts === null) return null;
  return typeof ack.by === "string" && ack.by.length > 0 ? ack : null;
}

/**
 * Fedezi-e a korábbi tudomásulvétel a MOSTANI leletet?
 *
 * ⛔⛔ CSAK akkor, ha MINDEN mostani blokkoló verdiktre KIMONDOTTAN szólt, UGYANAZZAL
 * az értékkel. A tulajdonságot a fotó-kaputól örököljük (ADR-0150): ha a mock
 * újragenerálódik és egy ÚJ őr flagel — vagy ugyanaz a kulcs „flag"-ről „error"-ra
 * vált —, a régi engedély NEM nyúlik át rá. A kurátor egy KONKRÉT leletet vállalt,
 * nem a jövőt.
 */
export function ackCoversVerdicts(ack: VerdictAck | null, blocking: readonly BlockingVerdict[]): boolean {
  if (!ack || blocking.length === 0) return false;
  return blocking.every((b) => ack.verdicts[b.key] === b.value);
}

/**
 * A tudomásulvétel rögzítése — célzott `jsonb_set`, nem teljes visszaírás: az
 * `inputs`-ba a `heroOverride` és a `recopy` is ír, egy objektum-visszaírás
 * elnyelné a közben született `siteData`-t (a fotó-kapu ugyanezt a csapdát kerüli).
 */
export async function recordVerdictAck(
  artifactId: string,
  by: string,
  reason: string,
  blocking: readonly BlockingVerdict[],
  now = new Date(),
): Promise<void> {
  const verdicts: Record<string, string> = {};
  for (const b of blocking) verdicts[b.key] = b.value;
  const ack: VerdictAck = {
    at: now.toISOString(),
    by,
    reason: reason.trim().slice(0, 500),
    verdicts,
  };
  await db
    .updateTable("mock_artifact")
    .set({
      inputs: sql`jsonb_set(coalesce(inputs, '{}'::jsonb), '{verdictAck}', ${JSON.stringify(
        ack,
      )}::jsonb, true)` as never,
    })
    .where("id", "=", artifactId)
    .execute();
}

/**
 * Az operátornak mutatott sor EGY verdiktről. Kimondja, mit talált az őr — és ha
 * nem rögzítettük, azt is kimondja, hogy nem tudjuk (a néma „FLAG (designVerdict)"
 * volt az eredeti hiba).
 */
export function verdictReasonLine(b: BlockingVerdict): string {
  const head =
    b.value === "flag"
      ? `${b.label}: a generáláskori őr SÉRTÉST talált`
      : `${b.label}: az őr NEM TUDTA ellenőrizni (ellenőrizetlen mock)`;
  const detail = b.reason
    ? ` — ${b.reason}`
    : " — ⚠️ az indok nincs eltárolva ehhez az artifacthoz (régi generálás); generáld újra, hogy látszódjon, mit talált";
  return `${head}${detail}`;
}
