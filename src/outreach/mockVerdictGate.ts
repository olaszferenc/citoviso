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
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { copyKeysFor, currentCopy } from "../engine/copyFields.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { isUsableAckReason, MIN_ACK_REASON_CHARS } from "./mockPhotoHealth.js";

export { MIN_ACK_REASON_CHARS, isUsableAckReason };

/** A generáláskor rögzített őr-verdiktek, amelyek a kiküldést blokkolhatják. */
export const GUARD_VERDICT_KEYS = [
  "designVerdict",
  "demoFraming",
  "factVerdict",
  "marketVerdict",
  // ADR-0292: the guest-critic's verdict on the wording. Absent on older artifacts and
  // on non-Hungarian pages (the critic does not run there) — absence passes, as for all keys.
  "guestCriticVerdict",
  // ADR-XXXX: on the curator (Poe) path the three AI guards no longer run — Vera's recorded
  // review is the verdict instead. "pending" = no review for the CURRENT text yet, and it
  // BLOCKS (unlike an absent key): the AI guards' absence is only safe because this replaces them.
  "reviewVerdict",
] as const;
export type GuardVerdictKey = (typeof GUARD_VERDICT_KEYS)[number];

/** Melyik `inputs` mező hordozza az adott verdikt EMBERI indokát. */
const REASON_KEY: Record<GuardVerdictKey, string> = {
  designVerdict: "designReason",
  demoFraming: "demoFramingReason",
  factVerdict: "factUnsourced",
  marketVerdict: "marketReason",
  guestCriticVerdict: "guestCriticReason",
  reviewVerdict: "reviewReason",
};

/**
 * Emberi megnevezés — a kulcsnév („designVerdict") az operátornak nem mond semmit.
 *
 * ⛔ EZ A NÉV MÁSODIK PÉLDÁNY: a konzol `mockInputLabel()`-je (views.ts) ugyanezeket a
 * kulcsokat nevezi meg az artifact-adatlapon. Két név ugyanarra a kapura = két igazság
 * egy képernyőn, ezért SZÁNDÉKOSAN bájtra ugyanazok a szavak, és a
 * `scripts/verdict-gate-check.mts` állítása köti össze a kettőt. Ha itt átírod, ott is
 * át kell — az őr hangosan megbukik, nem csendben csúszik szét.
 */
export const VERDICT_LABEL: Record<GuardVerdictKey, string> = {
  designVerdict: "Dizájn-kapu",
  demoFraming: "Demó-keretezés",
  factVerdict: "Tényhűség-kapu",
  marketVerdict: "Piac-kapu",
  guestCriticVerdict: "Vendég-kritikus",
  reviewVerdict: "Vera-ellenőrzés",
};

export interface BlockingVerdict {
  readonly key: GuardVerdictKey;
  /**
   * "flag" = az őr sértést talált; "error" = az őr nem tudott ítélni; "pending" = a
   * kurátori mock MOSTANI szövegére még nincs Vera-ítélet (ADR-XXXX — nem nyugtázható).
   */
  readonly value: "flag" | "error" | "pending";
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

/** Vera's recorded review of a curator mock (ADR-XXXX). */
export interface MockReview {
  readonly verdict: "pass" | "flag";
  /** The logged-in operator who recorded it (displayName || username). */
  readonly by: string;
  readonly at: string;
  /** Where the report lives (free text, e.g. `jelentesek/2026-10-05-02dbb6c2.md`). */
  readonly ref: string;
  readonly note: string;
  /** Hash of the copy the review was given on — see `copyHashOf`. */
  readonly copyHash: string | null;
}

export const REVIEW_REF_MAX = 200;
export const REVIEW_FLAG_NOTE_MIN = 10;

/**
 * Hash of every editable copy field of the mock as it is stored NOW. The review records it,
 * and a mismatch later reads as "pending" — the safety belt for any writer that changes the
 * words without clearing the review (the copy save and the recopy clear it explicitly).
 */
export function copyHashOf(inputs: unknown): string | null {
  const obj = (inputs ?? {}) as Record<string, unknown>;
  const recipe = obj.recipe as Recipe | undefined;
  const data = obj.siteData as SiteData | undefined;
  if (!recipe || !Array.isArray(recipe.sections) || !data) return null;
  const pairs = copyKeysFor(recipe).map((k) => [k, currentCopy(recipe, data, k)]);
  return createHash("sha256").update(JSON.stringify(pairs)).digest("hex").slice(0, 32);
}

export function reviewOf(inputs: unknown): MockReview | null {
  const r = (inputs as { review?: MockReview } | null)?.review;
  if (!r || (r.verdict !== "pass" && r.verdict !== "flag") || typeof r.by !== "string" || !r.by) return null;
  return r;
}

/**
 * The review state of a mock: null = no review needed (not a curator mock, or an older one);
 * "pending" = needed but missing for the CURRENT text; otherwise the recorded verdict.
 * ⛔ A stored "pass"/"flag" whose copy hash no longer matches the text is "pending": the
 * verdict was given on other words (the D2 rule of ADR-0323, kept).
 */
export function reviewStateOf(inputs: unknown): "pending" | "pass" | "flag" | null {
  const obj = (inputs ?? {}) as Record<string, unknown>;
  const v = obj.reviewVerdict;
  if (v === "pending") return "pending";
  if (v !== "pass" && v !== "flag") return null;
  const r = reviewOf(obj);
  if (!r || r.verdict !== v) return "pending";
  const now = copyHashOf(obj);
  if (r.copyHash && now && r.copyHash !== now) return "pending";
  return v;
}

/**
 * A blokkoló verdiktek listája. A HIÁNYZÓ kulcs átmegy: a determinisztikus utak
 * jogosan nem futtatnak minden verifiert — csak a KIMONDOTT "flag"/"error" blokkol.
 * ⛔ Kivétel a `reviewVerdict` "pending" értéke (ADR-XXXX): a kurátori mockon ez helyettesíti
 * a le nem futott AI-őröket, tehát a hiánya NEM mehet át.
 */
export function blockingVerdicts(inputs: unknown): BlockingVerdict[] {
  const obj = (inputs ?? {}) as Record<string, unknown>;
  const out: BlockingVerdict[] = [];
  for (const key of GUARD_VERDICT_KEYS) {
    const v = key === "reviewVerdict" ? reviewStateOf(obj) : obj[key];
    if (v !== "flag" && v !== "error" && !(key === "reviewVerdict" && v === "pending")) continue;
    out.push({
      key,
      value: v as BlockingVerdict["value"],
      label: VERDICT_LABEL[key],
      reason: v === "pending" ? "" : readReason(obj, key),
    });
  }
  return out;
}

/** Is there a missing review among the findings? Then nothing may be acknowledged past it. */
export function hasPendingReview(blocking: readonly BlockingVerdict[]): boolean {
  return blocking.some((b) => b.value === "pending");
}

/**
 * The review form's check — the console route and the card's script say the same thing.
 * Operator-facing Hungarian; empty object = valid.
 */
export function reviewFormErrors(form: { verdict: string; ref: string; note: string }): {
  verdict?: string;
  ref?: string;
  note?: string;
} {
  const e: { verdict?: string; ref?: string; note?: string } = {};
  if (form.verdict !== "pass" && form.verdict !== "flag") e.verdict = "Válaszd ki az ítéletet.";
  const ref = form.ref.trim();
  if (!ref) e.ref = "Add meg a jelentés helyét — az ítélet a jelentésedre hivatkozik.";
  else if (ref.length > REVIEW_REF_MAX) e.ref = `Legfeljebb ${REVIEW_REF_MAX} karakter.`;
  if (form.verdict === "flag" && form.note.trim().length < REVIEW_FLAG_NOTE_MIN) {
    e.note = `FLAG-nél írd le egy mondatban, mi blokkol (legalább ${REVIEW_FLAG_NOTE_MIN} karakter).`;
  }
  return e;
}

/**
 * Record Vera's review. Targeted jsonb merge (the hero pin and the recopy write the same
 * `inputs`). The previous acknowledgement goes: a new verdict is a new finding, and an ack
 * given to an earlier FLAG must not stretch over this one.
 */
export async function recordReview(
  artifactId: string,
  review: { verdict: "pass" | "flag"; by: string; ref: string; note: string },
  now = new Date(),
): Promise<boolean> {
  const row = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", artifactId).executeTakeFirst();
  if (!row) return false;
  const ref = review.ref.trim().slice(0, REVIEW_REF_MAX);
  const note = review.note.trim().slice(0, 500);
  const stored: MockReview = {
    verdict: review.verdict,
    by: review.by,
    at: now.toISOString(),
    ref,
    note,
    copyHash: copyHashOf(row.inputs),
  };
  const patch = {
    reviewVerdict: review.verdict,
    review: stored,
    reviewReason: review.verdict === "flag" ? `${note} (${ref})` : null,
  };
  await db
    .updateTable("mock_artifact")
    .set({
      inputs: sql`(coalesce(inputs, '{}'::jsonb) - 'verdictAck') || ${JSON.stringify(patch)}::jsonb` as never,
    })
    .where("id", "=", artifactId)
    .execute();
  return true;
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
  // ⛔ A missing review is NEVER acknowledged away (owner's ruling, ADR-XXXX): a review is
  // what makes the curator path safe without the AI guards — "send anyway" would skip both.
  if (hasPendingReview(blocking)) return false;
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
  if (b.key === "reviewVerdict") {
    return b.value === "pending"
      ? `${b.label}: erre a szövegre még NINCS ellenőrző ítélet`
      : `${b.label}: Vera SÉRTÉST talált${b.reason ? ` — ${b.reason}` : ""}`;
  }
  const head =
    b.value === "flag"
      ? `${b.label}: a generáláskori őr SÉRTÉST talált`
      : `${b.label}: az őr NEM TUDTA ellenőrizni (ellenőrizetlen mock)`;
  const detail = b.reason
    ? ` — ${b.reason}`
    : " — ⚠️ az indok nincs eltárolva ehhez az artifacthoz (régi generálás); generáld újra, hogy látszódjon, mit talált";
  return `${head}${detail}`;
}
