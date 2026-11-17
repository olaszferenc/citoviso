// ORSZÁG-RÉTEG 3/5 — the cold outreach in the LEAD's country (ADR-0437 ① Megkeresés, ADR-XXXX).
//
// Until this round every send path assumed a Hungarian lead: a mobile was "+36 20/30/31/50/70",
// the weekday window was read on the Budapest wall clock, the daily cap was one shared 40, and a
// missing translation fell back to Hungarian. Here each of those is read from the lead's COUNTRY
// ROW (country.outreach_channels, mobile_prefixes / dial_code / phone_plan, time_zone,
// public_holidays, daily_quota, default_lang):
//
//   · channels — a channel the row does not list is CLOSED for that country; a mobile-only lead
//     whose country has no usable mobile channel is HELD with a visible reason, never moved to a
//     bare SMS (owner rule: „MMS helyett SMS TILOS”), never sent from the Hungarian modem SIM as
//     an international MMS (docs/mms-send.md: the modem is one Hungarian SIM, ~90 s per message);
//   · the window — Mon–Fri, MOCK_OUTREACH_WINDOW hours, in the lead's zone, not on the row's
//     public holidays; an unknown country cannot be scheduled (fail closed);
//   · the language — the country's default language and nothing else (owner 2026-11-17); a pack
//     with a single missing outreach string HOLDS the whole outreach („Bábelre vár”).
//
// ⛔ The HU row selects exactly the Hungarian behaviour: its zone is Europe/Budapest with no
// holidays, its plan is the full Hungarian plan, its channels are today's full set and its
// modem is local — so every function below returns, for a Hungarian lead, what the
// Budapest-only code returned (scripts/country-layer-check.mts ⑨ sweeps the window; the
// e2e walks HU next to CZ and BG).
//
// Pure over the loaded country snapshot (countryConfigSync); no database, no send.
import type { CountryConfig } from "../country.js";
import { huArticleLower } from "../hu.js";
import { answerWindowOpenIn, nextAnswerWindowStartIn } from "../crm/countryClock.js";
import { MOCK_OUTREACH_WINDOW, SEND_WINDOW_TZ, mockOutreachWindowBlocks } from "../sms/sendWindow.js";
import { isMobileE164In, normalizePhoneIn } from "../text/phoneCountry.js";
import { hhmmIn } from "../text/zoneTime.js";

/** The channels a country row may list (migration 0133: subset of these). */
export type OutreachChannel = "email" | "sms" | "mms" | "viber" | "whatsapp";

/**
 * The dial code of the ONE mobile line we send MMS + SMS on: the SIM800C modem's SIM
 * (docs/mms-send.md — a Hungarian prepaid SIM, the feeder number in §8 of CLAUDE.md). A number
 * of another dial code would be an international MMS from that SIM: not sent. A market that
 * needs its own mobile line is a provider decision (the coordinator's), not a code fallback.
 */
export const LOCAL_MODEM_DIAL_CODE = "36";

/** Does the row list this channel? No row → nothing is enabled. */
export function channelEnabled(cfg: Pick<CountryConfig, "outreachChannels"> | null, ch: OutreachChannel): boolean {
  return !!cfg && cfg.outreachChannels.includes(ch);
}

/** The lead's phone as a MOBILE of its own country (E.164), or null (no row / landline / unreadable). */
export function leadMobileIn(rawPhone: string | null | undefined, cfg: CountryConfig | null): string | null {
  const raw = (rawPhone ?? "").trim();
  if (!raw || !cfg) return null;
  const e164 = normalizePhoneIn(raw, cfg);
  return e164 && isMobileE164In(e164, cfg) ? e164 : null;
}

/**
 * Why the MMS + SMS pair (the modem) may not carry this country's cold outreach, or null when
 * it may. Operator-facing (dispatch note, console) — it never reaches the lead.
 */
export function modemPairBlocks(cfg: CountryConfig | null): string | null {
  if (!cfg) return "a lead országa nincs az ország-rétegben — mobil megkeresés nem küldhető (zárva)"; // i18n-exempt: operátori ok, sosem éri el a leadet
  if (!channelEnabled(cfg, "mms") || !channelEnabled(cfg, "sms")) {
    return `${cfg.name} ország-sorában az MMS+SMS csatorna nincs engedélyezve — a mobil megkeresés TARTVA (SMS-re nem cseréljük)`; // i18n-exempt: operátori ok, sosem éri el a leadet
  }
  if (cfg.dialCode !== LOCAL_MODEM_DIAL_CODE) {
    return `${cfg.name} számára a helyi modem (magyar SIM) nem küld nemzetközi MMS-t — a mobil megkeresés TARTVA, amíg nincs helyi mobil-szolgáltató (koordinátori döntés)`; // i18n-exempt: operátori ok, sosem éri el a leadet
  }
  return null;
}

/** Why a messenger channel (Viber / WhatsApp, sent from our phone) is closed for the country, or null. */
export function messengerBlocks(cfg: CountryConfig | null, ch: "viber" | "whatsapp"): string | null {
  if (!cfg) return "a lead országa nincs az ország-rétegben — messenger-üzenet nem küldhető (zárva)"; // i18n-exempt: operátori ok, sosem éri el a leadet
  if (!channelEnabled(cfg, ch)) return `${cfg.name} ország-sorában ${huArticleLower(ch)} ${ch} csatorna nincs engedélyezve — TARTVA`; // i18n-exempt: operátori ok, sosem éri el a leadet
  return null;
}

/** Is the country's mobile reachable on at least one channel (pair or messenger)? */
export function anyMobileChannel(cfg: CountryConfig | null): boolean {
  return !modemPairBlocks(cfg) || !messengerBlocks(cfg, "viber") || !messengerBlocks(cfg, "whatsapp");
}

/** The HU row's clock IS the Budapest-only window: same zone, no holidays (ADR-0455 ⑩). */
function isBudapestClock(cfg: Pick<CountryConfig, "timeZone" | "publicHolidays">): boolean {
  return cfg.timeZone === SEND_WINDOW_TZ && cfg.publicHolidays.length === 0;
}

/** Is the mock-outreach window open at `now` in the lead's zone, on its calendar? */
export function outreachWindowOpenIn(now: Date, cfg: CountryConfig | null): boolean {
  return !!cfg && answerWindowOpenIn(now, cfg);
}

/**
 * Why a cold outreach (mail, MMS+SMS pair, cold SMS) to a lead of `cfg` may not START at `now`,
 * or null when it may. The Budapest clock (the HU row) returns mockOutreachWindowBlocks' own
 * sentence, byte for byte. Unknown country → never (fail closed).
 */
export function outreachWindowBlocksIn(now: Date, cfg: CountryConfig | null): string | null {
  if (!cfg) return "a lead országa nincs az ország-rétegben — a megkeresés nem ütemezhető (zárva)"; // i18n-exempt: operátori ok, sosem éri el a leadet
  if (isBudapestClock(cfg)) return mockOutreachWindowBlocks(now);
  if (answerWindowOpenIn(now, cfg)) return null;
  const hhmm = hhmmIn(now, cfg.timeZone);
  const next = nextAnswerWindowStartIn(now, cfg);
  const { fromHour, toHour } = MOCK_OUTREACH_WINDOW;
  return `mock-megkeresés csak ${cfg.name} munkanapjain ${fromHour}:00–${toHour}:00 (${cfg.timeZone}) között megy ki (ott most ${hhmm}) — legközelebb ${next.toISOString()}`; // i18n-exempt: operátori ok, sosem éri el a leadet
}

/** The language a cold outreach to the country is written in: the row's default, nothing else. */
export function outreachLangOf(cfg: Pick<CountryConfig, "defaultLang"> | null): string | null {
  return cfg?.defaultLang ?? null;
}

/** The hold reason when the country's pack lacks strings — the outreach waits for Bábel. */
export function babelHoldReason(lang: string, missing: number): string {
  return `Bábelre vár: ${huArticleLower(lang)} ${lang} nyelvi csomagból ${missing} szöveg hiányzik — a megkeresés TARTVA, magyarul nem megy ki`; // i18n-exempt: operátori ok, sosem éri el a leadet
}

/**
 * The daily cap of the automatic dispatch for a country: the HU cap is the operator's
 * `outreach_auto.dailyCap` (today's 40); another country has its own counter, from the
 * operator's per-country override, else the row's daily_quota.
 */
export function dailyCapFor(
  cfg: Pick<CountryConfig, "iso2" | "dailyQuota">,
  settings: { readonly dailyCap: number; readonly countryCaps?: Readonly<Record<string, number>> },
  homeIso: string,
): number {
  if (cfg.iso2 === homeIso) return settings.dailyCap;
  const own = settings.countryCaps?.[cfg.iso2];
  if (typeof own === "number" && Number.isInteger(own) && own >= 0) return own;
  return Number.isInteger(cfg.dailyQuota) && cfg.dailyQuota >= 0 ? cfg.dailyQuota : 0;
}

/**
 * Languages whose letters GSM-7 cannot carry (Cyrillic, Greek): folding them to GSM-7 would
 * DELETE the text. Their SMS goes out UCS-2 (70 / 67 characters per segment) — the length
 * count follows smsEncoding, which already measures UCS-2 for any non-GSM-7 character.
 */
const NON_LATIN_SMS_LANGS: ReadonlySet<string> = new Set(["bg", "ru", "uk", "mk", "el", "be", "sr"]);

/** May an SMS in `lang` be folded to GSM-7 (accents dropped) without losing its letters? */
export function gsm7FoldableLang(lang: string | undefined): boolean {
  return !NON_LATIN_SMS_LANGS.has((lang ?? "").toLowerCase());
}
