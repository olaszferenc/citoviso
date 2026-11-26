// ORSZÁG-RÉTEG 3/8 (ADR-0460) — NYITÁS ELŐTTI TELJESSÉG: is a country ready to OPEN, and if
// not, what is missing? ONE function, read by:
//   · the market gate (src/markets.ts marketGate → every cold-outreach, trial, pay-link,
//     go-live and configurator entry): a market is open = the owner approved it AND it is
//     complete here — an approved country that loses a condition (a price removed, a pack
//     outdated) shuts again until it is fixed;
//   · the approve action (/settings/markets): refused unless complete;
//   · the console's „Országok” lap: the matrix, the cards, the steps, the live check of an
//     unsaved draft;
//   · scripts/country-layer-check.mts ⑫ (no second completeness logic anywhere).
//
// Each item is computed by the SAME function the runtime path that depends on it calls — never
// a re-implementation: the money path (payment/providers.ts marketOpenGaps over pricing.ts
// regionPriceGaps), the language (i18n/packs.ts missingBuyerPackStrings — also the measure of
// both cold-outreach send gates), the legal pack (legalPack.ts legalPackStatus — the pack must
// be in the row's language), the mobile channel (outreach/countryOutreach.ts modemPairBlocks),
// the row itself (countryRules.ts validateCountryDraft) and the holidays (holidayYearCovered).
//
// ⛔ HU stays what it was: its row is valid, its region prices, Hungarian needs no pack, its
// legal pack is the source, it has e-mail; its empty holiday list is shown as a WARNING that
// does not gate (the Budapest clock has never had holidays — ADR-0455 ⑩), so the home market
// is open exactly when it was before (approved).
import { countryConfig, type CountryConfig } from "./country.js";
import {
  blankDraft,
  draftFromConfig,
  holidayYearCovered,
  MOBILE_CHANNELS,
  validateCountryDraft,
  type CountryDraft,
} from "./countryRules.js";
import { draftAsConfig } from "./countryRules.js";
import { isTaxableBuyerCountry } from "./billing/taxCounters.js";
import { countryLexicon } from "./countryLexicon.js";
import { db } from "./db/client.js";
import { T } from "./i18n/mail.js";
import { buyerCatalog, missingBuyerPackStrings } from "./i18n/packs.js";
import { consumerAdrValue, legalPackStatus, type LegalPackStatus } from "./legalPack.js";
import { LEGAL_LOCAL } from "./legal.js";
import { channelEnabled, modemPairBlocks } from "./outreach/countryOutreach.js";
import { marketOpenGaps, paymentProviderIds, walletGap } from "./payment/providers.js";
import { loadPricing, pricingRegions, regionPriceGaps } from "./pricing.js";

/** The home market (markets.ts HOME_MARKET — repeated: markets.ts imports this module). */
const HOME = "HU";

export type ReadinessKey = "data" | "lexicon" | "prices" | "wallet" | "babel" | "legal" | "adr" | "holidays" | "channel";
export type ReadinessState = "ok" | "bad" | "warn";

export interface ReadinessItem {
  readonly key: ReadinessKey;
  readonly state: ReadinessState;
  /** false = shown, but does not block the opening (a warning). */
  readonly gating: boolean;
  /** Console-language title / one-line detail. */
  readonly title: string;
  readonly detail: string;
  /** Progress where it is a count (language, legal units), 0–100. */
  readonly pct?: number;
}

export interface CountryReadiness {
  readonly country: string | null;
  /** A country row exists (a draft check counts as a row). */
  readonly hasRow: boolean;
  readonly items: readonly ReadinessItem[];
  /** Every gating item is satisfied — the approve action may run. */
  readonly complete: boolean;
  /** The owner's approval (market.legal_status = 'approved'). */
  readonly approved: boolean;
  /** approved AND complete — THE market gate. */
  readonly open: boolean;
  /** Hungarian operator reasons why it is shut (empty when open). */
  readonly reasons: readonly string[];
  /** The legal-pack status the „Jog” item came from (markets.ts reports packComplete from it). */
  readonly legal: LegalPackStatus | null;
}

export interface ReadinessOpts {
  /** Console language of the item texts (default Hungarian — the gate's reasons). */
  readonly lang?: string;
  /** Evaluate this UNSAVED draft instead of the stored row (the live check of the lap). */
  readonly draft?: CountryDraft;
  /** "now" — decides which two years the holidays must cover. */
  readonly now?: Date;
}

/** ISO-2 upper case or null (markets.ts normalizeCountryCode — same rule, no import cycle). */
function cc2(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * TEST-ONLY: ISO 3166 user-assigned codes (XA…XZ) a guard declares EU members for THIS process
 * (market-gate-check's throwaway country). Real codes are never accepted here; production never
 * sets it (country-layer-check ⑪ measures .env).
 */
function fixtureEu(cc: string): boolean {
  if (!/^X[A-Z]$/.test(cc)) return false;
  return (process.env.CIT_READINESS_EU_FIXTURE ?? "").split(",").map((s) => s.trim()).includes(cc);
}

const fmt = (n: number): string => n.toLocaleString("hu-HU");

/** The year of `now` in the country's zone (the holiday window: this year and the next). */
function yearIn(now: Date, tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en", { timeZone: tz, year: "numeric" }).format(now));
  } catch {
    return now.getUTCFullYear();
  }
}

/** THE readiness of a country (stored row, or `opts.draft`). Never writes. */
export async function countryReadiness(country: string | null | undefined, opts: ReadinessOpts = {}): Promise<CountryReadiness> {
  const lang = opts.lang ?? "hu";
  const cc = cc2(opts.draft?.iso2 ?? country);
  const approved = cc ? await isApproved(cc) : false;
  if (!cc) {
    const why = T(lang, "ismeretlen ország");
    return { country: null, hasRow: false, items: [], complete: false, approved: false, open: false, reasons: [why], legal: null };
  }
  const stored = opts.draft ? null : await countryConfig(cc);
  const cfg: CountryConfig | null = opts.draft ? draftAsConfig(opts.draft) : stored;
  const home = cc === HOME;
  const items: ReadinessItem[] = [];

  // ── the row itself ──────────────────────────────────────────────────────────────────────
  await loadPricing();
  const regions = pricingRegions().map((s) => s.region);
  const draft = opts.draft ?? (stored ? draftFromConfig(stored) : blankDraft(cc));
  const errs = cfg ? validateCountryDraft(draft, { lang, regions, providers: paymentProviderIds() }) : {};
  const nErr = Object.keys(errs).length;
  items.push({
    key: "data",
    gating: true,
    title: T(lang, "Ország-adatok"),
    state: !cfg || nErr ? "bad" : "ok",
    detail: !cfg
      ? T(lang, "nincs ország-sor — vedd fel az országot")
      : nErr
        ? T(lang, "{n} mező hibás vagy üres", { n: nErr })
        : T(lang, "minden kötelező mező helyes"),
  });

  // ── ① price sheet + money path (marketOpenGaps: EU, provider ↔ currency, region gaps) ─────
  const money = cfg
    ? marketOpenGaps(cc, { row: () => cfg, regionGaps: regionPriceGaps, isEu: (x) => isTaxableBuyerCountry(x) || fixtureEu(x) })
    : [T(lang, "nincs ország-sor")];
  items.push({
    key: "prices",
    gating: true,
    title: T(lang, "Ársor és fizetés"),
    state: money.length ? "bad" : "ok",
    detail: money.length
      ? money.join(" · ")
      : T(lang, "„{region}” ár-régió teljes, {ccy} — a fizetési szolgáltató ({provider}) fogadja", {
          region: cfg!.pricingRegion,
          ccy: cfg!.currency,
          provider: cfg!.paymentProvider,
        }),
  });

  // ── ①b the wallet (NEMZETKÖZI C): the provider takes the currency, but can WE receive it? ──
  const walletMissing = cfg ? walletGap(cfg.paymentProvider, cfg.currency) : null;
  items.push({
    key: "wallet",
    gating: true,
    title: T(lang, "Fizetési tárca"),
    state: !cfg || walletMissing ? "bad" : "ok",
    detail: !cfg
      ? T(lang, "nincs ország-sor")
      : walletMissing
        ? T(lang, "nincs {ccy} pénztárca a {provider} fiókban — {ccy} fizetés addig nem fogadható; a tárca nyitása a tulaj döntése", {
            ccy: cfg.currency,
            provider: cfg.paymentProvider,
          })
        : T(lang, "{ccy} pénztárca megvan ({provider})", { ccy: cfg.currency, provider: cfg.paymentProvider }),
  });

  // ── ①c the collection chain's lexicon (piacnyitás 2026-11-26): an opened market is walked by the
  //    chain (discovery → contact → own-site gate) with NO human step — and every one of those steps reads
  //    the country's lexicon (src/countryLexicon/<iso>.json: its areas, its words). Without it the chain
  //    skips the country's leads silently. Shown BEFORE the opening as a warning (not gating: the market
  //    gate also opens inbound trials and payments, which need no lexicon — the owner decides). ──
  const lex = countryLexicon(cc);
  const areas = lex?.subdivisions?.length ?? 0;
  items.push({
    key: "lexicon",
    gating: false,
    title: T(lang, "Gyűjtő-lánc szótára"),
    state: lex && areas > 0 ? "ok" : "warn",
    detail: !lex
      ? T(lang, "nincs országszótár ({file}) — a felderítés és a kontaktkereső nem tud ezen az országon dolgozni", {
          file: `src/countryLexicon/${cc.toLowerCase()}.json`,
        })
      : areas === 0
        ? T(lang, "a szótárban nincs terület (subdivisions) — a felderítés nem tudja, mit járjon be")
        : T(lang, "{n} terület a felderítéshez", { n: areas }),
  });

  // ── ② the language pack, buyer-side ───────────────────────────────────────────────────────
  // NOT GATING (ADR-0488, owner rule 2026-11-25 — a missing translation never blocks; Hungarian fallback, Bábel
  // after): a new buyer-side string landing must not shut an OPEN market for the chain, the incoming trial or
  // the payment (2026-11-26: hr 4270/4293 shut HR for the whole chain). The protection lives on the MESSAGE:
  // a letter / SMS / mock whose OWN text has an untranslated part is held („Bábelre vár”, sendBatch.ts,
  // sendOutreachSms.ts, nonOpenerFollowup.ts, mockVerdictGate.ts langVerdict, outreachCheck.ts). Only a
  // country with no default language at all stays gating.
  const plang = cfg?.defaultLang ?? "";
  const scope = (await buyerCatalog()).length;
  const okLang = /^[a-z]{2,3}$/.test(plang);
  const missing = okLang ? (await missingBuyerPackStrings(plang, { withSeed: true })).length : scope;
  items.push({
    key: "babel",
    gating: !okLang,
    title: T(lang, "Nyelvi csomag (Bábel)"),
    state: !okLang ? "bad" : missing === 0 ? "ok" : "warn",
    detail: !okLang
      ? T(lang, "nincs alapnyelv megadva")
      : plang === "hu"
        ? T(lang, "magyar — a forrásnyelv, nincs mit fordítani")
        : missing
          ? T(lang, "{lang}: {done} / {total} vevő-oldali felirat lefordítva — Bábelre vár", {
              lang: plang,
              done: fmt(scope - missing),
              total: fmt(scope),
            })
          : T(lang, "{lang}: mind a {total} vevő-oldali felirat lefordítva", { lang: plang, total: fmt(scope) }),
    pct: scope ? Math.round(((scope - missing) / scope) * 100) : 100,
  });

  // ── ③ the legal pack in the row's language (+ the consumer dispute body, FR/PT) ───────────
  const legal = await legalPackStatus(cc, cfg?.defaultLang ?? null);
  items.push({
    key: "legal",
    gating: true,
    title: T(lang, "Jogi csomag"),
    state: legal.complete ? "ok" : "bad",
    detail: legal.complete
      ? home
        ? T(lang, "hazai csomag — a forrás maga")
        : T(lang, "mind a {n} egység {lang} nyelven", { n: legal.total, lang: legal.lang ?? "?" })
      : legal.reasons.join(" · "),
    pct: home || !legal.total ? (legal.complete ? 100 : 0) : Math.round(((legal.total - legal.missing) / legal.total) * 100),
  });
  const adr = consumerAdrValue(cc);
  if (adr !== undefined) {
    const env = LEGAL_LOCAL[cc]?.consumerAdr?.envKey ?? "";
    items.push({
      key: "adr",
      gating: false,
      title: T(lang, "Fogyasztói vitarendező"),
      state: adr ? "ok" : "warn",
      detail: adr
        ? T(lang, "{env} beállítva — a magánszemély-út is nyitva", { env })
        : T(lang, "{env} nincs beállítva — magánszemélynek nem adható el; cégnek igen", { env }),
    });
  }

  // ── ④ public holidays, this year and the next (in the country's zone) ────────────────────
  const days = cfg?.publicHolidays ?? [];
  const y1 = yearIn(opts.now ?? new Date(), cfg?.timeZone ?? "UTC");
  const c1 = holidayYearCovered(days, y1);
  const c2 = holidayYearCovered(days, y1 + 1);
  const hOk = c1 && c2;
  const usesOneOff = days.some((d) => /^\d{4}-/.test(d));
  items.push({
    key: "holidays",
    // HU's Budapest clock has never had holidays: shown, not gating (bitre azonos).
    gating: !home,
    title: T(lang, "Ünnepnapok"),
    state: hOk ? "ok" : home ? "warn" : "bad",
    detail: !days.length
      ? home
        ? T(lang, "nincs megadva — ma a válasz csak hétvégén áll")
        : T(lang, "nincs megadva")
      : !hOk
        ? usesOneOff
          ? T(lang, "hiányzik: {years} (a mozgó ünnepek, pl. húsvét, évenként kellenek)", {
              years: [!c1 ? y1 : null, !c2 ? y1 + 1 : null].filter(Boolean).join(", "),
            })
          : T(lang, "hiányzik: {years}", { years: [!c1 ? y1 : null, !c2 ? y1 + 1 : null].filter(Boolean).join(", ") })
        : T(lang, "{n} nap, {y1} és {y2} lefedve", { n: days.length, y1, y2: y1 + 1 }),
  });

  // ── ⑤ the outreach channel (e-mail gates; a foreign mobile without a provider is TARTVA) ──
  const email = channelEnabled(cfg, "email");
  const mobile = (cfg?.outreachChannels ?? []).filter((c) => MOBILE_CHANNELS.includes(c));
  const pairHold = cfg && mobile.some((c) => c === "sms" || c === "mms") ? modemPairBlocks(cfg) : null;
  let cState: ReadinessState = email ? "ok" : "bad";
  let cDetail = email ? T(lang, "e-mail") : T(lang, "nincs e-mail csatorna — a megkeresés nem tud kimenni");
  if (email && pairHold) {
    cState = "warn";
    cDetail = T(lang, "e-mail rendben; SMS/MMS: nincs helyi mobil-szolgáltató — a csak mobilszámos lead TARTVA");
  } else if (email && !mobile.length && !home) {
    cDetail = T(lang, "e-mail — a csak mobilszámos lead TARTVA (nincs mobil-csatorna)");
  } else if (email && mobile.length) {
    cDetail = T(lang, "e-mail + {channels}", { channels: mobile.join(", ") });
  }
  items.push({ key: "channel", gating: true, title: T(lang, "Kiküldési csatorna"), state: cState, detail: cDetail });

  const complete = items.every((i) => !i.gating || i.state !== "bad");
  const failing = items.filter((i) => i.gating && i.state === "bad").map((i) => `${i.title}: ${i.detail}`);
  const reasons = [...(approved ? [] : [T(lang, "a piacot a tulaj még nem nyitotta meg")]), ...failing];
  return {
    country: cc,
    hasRow: !!cfg,
    items,
    complete,
    approved,
    open: approved && complete,
    reasons: approved && complete ? [] : reasons,
    legal,
  };
}

async function isApproved(cc: string): Promise<boolean> {
  const row = await db.selectFrom("market").select("legal_status").where("country", "=", cc).executeTakeFirst();
  return row?.legal_status === "approved";
}
