// The guided booking setup ("Foglalás beállítása", ADR-XXXX, approved plan
// assets/design-refs/tenant-admin/foglalas-kerdezz-felelek/ — variant B, owner 2026-10-13).
//
// ONE checklist over the three modules a bookable stay needs: rooms (site_unit), prices
// (unit_price + the pricing module config) and the booking rules (the booking module config).
// It is a second FRONT DOOR, not a second store: every save goes through the same write
// functions the existing screens use (units.ts, prices.ts, siteModuleConfig.ts), so the
// "Haladó beállítások" screens and this page can never disagree about a value.
//
// The silent blockers (a "csak az időszakokban" room without a season, a season minimum
// longer than the longest stay, nights with no price) are computed HERE, from the same
// predicates the guest path uses (unitPriceStatus → priceOn), and shown on the page.

import { db } from "../db/client.js";
import { T } from "../i18n/mail.js";
import { MODULE_CONFIG_REGISTRY, type ModuleConfigValues } from "../moduleConfig.js";
import { setSiteModuleConfig } from "./siteModuleConfig.js";
import {
  addSeasonPrice,
  deletePrice,
  getSitePrices,
  normMonthDay,
  setBasePrice,
  unitPriceStatus,
  type UnitPrice,
} from "./prices.js";
import {
  createUnit,
  DEFAULT_UNIT_NAME,
  ensureUnits,
  setUnitPriceOnRequest,
  setUnitSeasonalOnly,
  setWholeProperty,
  settleFormerWhole,
  updateUnit,
  type Unit,
} from "./units.js";
import { todayForSite } from "./timeZone.js";

export type SetupMode = "single" | "rooms" | "both";
export type TaxState = "amount" | "none" | "unknown";

export interface SetupSeason {
  readonly id: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly min: number | null;
}

export interface SetupUnit {
  readonly id: string;
  readonly name: string;
  readonly cap: number | null;
  /** This unit stands for the whole place (ADR-0114/0256). */
  readonly whole: boolean;
  readonly base: number | null;
  readonly por: boolean;
  readonly seasonalOnly: boolean;
  /** Recurring seasons — what this page lists and edits. */
  readonly seasons: SetupSeason[];
  /** Year-bound / dated rows: edited on the Árak screen only; counted so the page can say so. */
  readonly otherRows: number;
}

export interface SetupBlocker {
  /** The question that fixes it. */
  readonly q: string;
  readonly sev: "bad" | "warn";
  readonly t: string;
}

export interface SetupState {
  readonly mode: SetupMode;
  readonly units: SetupUnit[];
  readonly currency: string;
  readonly priceUnit: string;
  /** null when the owner's bookable units disagree (set per room on the Árak screen). */
  readonly seasonalOnly: boolean | null;
  readonly minNights: number;
  readonly maxNights: number;
  readonly horizon: number;
  readonly lead: number;
  readonly taxState: TaxState | null;
  readonly tax: string;
  readonly includes: string;
  readonly notify: string;
  readonly expiry: number;
  /** Which questions the owner has answered at least once (a stored key, not a default). */
  readonly answered: Record<string, boolean>;
  readonly accountEmail: string;
  readonly blockers: SetupBlocker[];
}

/** The raw stored config (only the keys the owner saved — defaults are NOT answers). */
async function storedConfig(siteId: string, moduleId: string): Promise<ModuleConfigValues> {
  const row = await db
    .selectFrom("site_module_config")
    .select("config")
    .where("site_id", "=", siteId)
    .where("module", "=", moduleId)
    .executeTakeFirst();
  return ((row?.config ?? {}) as ModuleConfigValues) || {};
}

/** The unit that stands for the whole place, if any. A lone unit always does. */
function wholeUnitOf(units: readonly Unit[]): Unit | null {
  if (units.length === 1) return units[0]!;
  return units.find((u) => u.representsWhole) ?? units.find((u) => u.isWholeProperty) ?? null;
}

/** How the owner lets the place, read from the units — never stored separately. */
export function deriveMode(units: readonly Unit[]): SetupMode {
  const whole = wholeUnitOf(units);
  const rooms = units.filter((u) => u !== whole);
  if (!rooms.length) return "single";
  if (whole && whole.isWholeProperty) return whole.wholeOnly ? "single" : "both";
  return "rooms";
}

/** The units the questions price and the trial books — the same split the client uses. */
export function setupBookable<T extends { whole: boolean }>(mode: SetupMode, units: readonly T[]): T[] {
  return units.filter((u) => (mode === "single" ? u.whole : mode === "rooms" ? !u.whole : true));
}

function isRecurringSeason(p: UnitPrice): boolean {
  return !p.isBase && !p.parentId && !p.validFrom && !p.validTo && Boolean(p.from && p.to);
}

function toSetupUnit(u: Unit, whole: boolean, prices: readonly UnitPrice[]): SetupUnit {
  const base = prices.find((p) => p.isBase && !p.validFrom && !p.validTo);
  const seasons = prices.filter(isRecurringSeason);
  return {
    id: u.id,
    name: u.name,
    cap: u.capacity,
    whole,
    base: base ? base.amount : null,
    por: u.priceOnRequest,
    seasonalOnly: u.seasonalOnly,
    seasons: seasons.map((p) => ({
      id: p.id,
      label: p.label,
      from: p.from!,
      to: p.to!,
      amount: p.amount,
      min: p.minNights,
    })),
    otherRows: prices.filter((p) => p !== base && !isRecurringSeason(p)).length,
  };
}

function taxStateOf(stored: ModuleConfigValues): { state: TaxState | null; tax: string } {
  if (!("touristTaxPerPersonNight" in stored)) return { state: null, tax: "" };
  const v = stored.touristTaxPerPersonNight;
  if (v === "" || v === null || v === undefined || !Number.isFinite(Number(v))) return { state: "unknown", tax: "" };
  const n = Math.max(0, Math.round(Number(v)));
  return n === 0 ? { state: "none", tax: "" } : { state: "amount", tax: String(n) };
}

/** Everything the page shows, read from the database. */
export async function loadBookingSetup(siteId: string, accountEmail: string, lang: string): Promise<SetupState> {
  const units = await ensureUnits(siteId);
  const whole = wholeUnitOf(units);
  const mode = deriveMode(units);
  const priceMap = await getSitePrices(siteId);
  const setupUnits = [...units]
    .sort((a, b) => (a === whole ? -1 : b === whole ? 1 : a.sortOrder - b.sortOrder))
    .map((u) => toSetupUnit(u, u === whole, priceMap.get(u.id) ?? []));

  const pricingStored = await storedConfig(siteId, "pricing");
  const bookingStored = await storedConfig(siteId, "booking");
  const pdef = MODULE_CONFIG_REGISTRY.pricing!.defaults;
  const bdef = MODULE_CONFIG_REGISTRY.booking!.defaults;
  const b = { ...bdef, ...bookingStored };
  const tax = taxStateOf(bookingStored);

  const bookable = setupBookable(mode, setupUnits);
  const flags = new Set(bookable.map((u) => u.seasonalOnly));
  const seasonalOnly = flags.size === 1 ? [...flags][0]! : null;

  const has = (k: string) => k in bookingStored;
  const state: Omit<SetupState, "blockers"> = {
    mode,
    units: setupUnits,
    currency: String(pricingStored.currency ?? pdef.currency ?? "HUF"),
    priceUnit: String(pricingStored.unit ?? pdef.unit ?? "per_night"),
    seasonalOnly,
    minNights: Number(b.minNights ?? 1),
    maxNights: Number(b.maxNights ?? 30),
    horizon: Number(b.horizonMonths ?? 12),
    lead: Number(b.leadTimeDays ?? 0),
    taxState: tax.state,
    tax: tax.tax,
    includes: String(b.priceIncludes ?? ""),
    notify: String(b.notifyEmail ?? ""),
    expiry: Number(b.autoDeclineHours ?? 48),
    answered: {
      unit: "unit" in pricingStored,
      stay: has("minNights") || has("maxNights"),
      ahead: has("horizonMonths") || has("leadTimeDays"),
      tax: has("touristTaxPerPersonNight"),
      includes: has("priceIncludes"),
      notify: has("notifyEmail") || has("autoDeclineHours"),
    },
    accountEmail,
  };
  return { ...state, blockers: await setupBlockers(siteId, state, priceMap, units, lang) };
}

/**
 * The silent blockers, made loud. Each names the room and the question that fixes it.
 * "bad" = no guest can book that (part of the) stay; "warn" = the guest can send a request,
 * but without a total (ADR-0208: a quote request).
 */
async function setupBlockers(
  siteId: string,
  s: Omit<SetupState, "blockers">,
  priceMap: Map<string, UnitPrice[]>,
  units: readonly Unit[],
  lang: string,
): Promise<SetupBlocker[]> {
  const out: SetupBlocker[] = [];
  const today = await todayForSite(siteId);
  for (const u of setupBookable(s.mode, s.units)) {
    const unit = units.find((x) => x.id === u.id)!;
    const prices = priceMap.get(u.id) ?? [];
    const anySeason = prices.some((p) => !p.isBase && p.from && p.to);
    if (u.seasonalOnly && !anySeason) {
      out.push({
        q: "seasonal",
        sev: "bad",
        t: T(lang, "{name}: egyetlen napra sem lehet foglalni — csak az időszakokban adja ki, de nincs időszaka.", { name: u.name }),
      });
    }
    const status = unitPriceStatus(prices, unit, today);
    if (!u.seasonalOnly && (status === "none" || status === "partial") && u.base === null) {
      out.push({
        q: "base",
        sev: "warn",
        t: T(lang, "{name}: az időszakokon kívüli éjszakáknak nincs ára. A vendég nem lát végösszeget, ajánlatot kér.", { name: u.name }),
      });
    }
    for (const sz of u.seasons) {
      if (sz.min && sz.min > s.maxNights) {
        out.push({
          q: "stay",
          sev: "bad",
          t: T(lang, "{name} · {season}: legalább {min} éj kell, de a leghosszabb foglalás {max} éj — erre az időszakra senki nem tud foglalni.", {
            name: u.name,
            season: sz.label,
            min: sz.min,
            max: s.maxNights,
          }),
        });
      }
    }
  }
  return out;
}

export interface SaveResult {
  readonly ok: boolean;
  readonly errors: string[];
  /** true when what the guest sees changed (units / prices) — the caller re-renders the site. */
  readonly rerender: boolean;
}

const ok = (rerender: boolean): SaveResult => ({ ok: true, errors: [], rerender });
const fail = (errors: string[]): SaveResult => ({ ok: false, errors, rerender: false });

/** A whole number in [min, max], or null for an empty/invalid input. */
function intIn(v: unknown, min: number, max: number): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[\s.]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** A price amount the way the owner types it ("28 000", "28.000", "28000"). */
function amountOf(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Math.round(Number(String(v).replace(/[\s.]/g, "").replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Merge changed keys into the stored config — the stored row is replaced on save, so never send a partial one. */
async function mergeConfig(
  siteId: string,
  moduleId: string,
  patch: ModuleConfigValues,
  userId: string,
): Promise<string[]> {
  const stored = await storedConfig(siteId, moduleId);
  const r = await setSiteModuleConfig(siteId, moduleId, { ...stored, ...patch }, userId);
  return r.ok ? [] : r.errors;
}

/** ① Szállás és szobák: how the place is let, the rooms and their capacity. */
async function saveRooms(siteId: string, body: Record<string, unknown>, lang: string): Promise<SaveResult> {
  const mode = body.mode;
  if (mode !== "single" && mode !== "rooms" && mode !== "both") {
    return fail([T(lang, "Válassza ki, hogyan adja ki a szállását.")]);
  }
  const rows = Array.isArray(body.units) ? (body.units as Record<string, unknown>[]) : [];
  const units = await ensureUnits(siteId);
  const whole = wholeUnitOf(units);
  const errors: string[] = [];
  const parsed = rows.map((r) => {
    const cap = r.cap === "" || r.cap === null || r.cap === undefined ? null : intIn(r.cap, 1, 50);
    if (cap === null && !(r.cap === "" || r.cap === null || r.cap === undefined)) {
      errors.push(T(lang, "A férőhely 1 és 50 fő között lehet."));
    }
    const name = String(r.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const known = typeof r.id === "string" ? units.find((u) => u.id === r.id) ?? null : null;
    return { whole: r.whole === true, name, cap, known };
  });
  const rooms = parsed.filter((r) => !r.whole);
  if (mode !== "single") {
    if (!rooms.length) errors.push(T(lang, "Adjon meg legalább egy szobát."));
    if (rooms.some((r) => !r.name)) errors.push(T(lang, "Adjon nevet minden szobának."));
  }
  if (errors.length) return fail([...new Set(errors)]);

  const wholeRow = parsed.find((r) => r.whole);
  // The whole place: kept when it exists (a lone unit IS it), created only when the owner
  // says the place is let as one and there is none.
  let wholeId = whole?.id ?? null;
  const ensureWhole = async (): Promise<string> => {
    if (wholeId) {
      if (!whole!.representsWhole) await settleFormerWhole(siteId, wholeId, "egesz", "");
      return wholeId;
    }
    const id = await createUnit(siteId, DEFAULT_UNIT_NAME, wholeRow?.cap ?? null, null);
    if (!id) throw new Error("bookingSetup: the whole-place unit could not be created");
    await settleFormerWhole(siteId, id, "egesz", "");
    wholeId = id;
    return id;
  };

  if (mode !== "single") {
    for (const r of rooms) {
      if (r.known && r.known.id !== whole?.id) {
        await updateUnit(siteId, r.known.id, r.name, r.cap, r.known.description);
      } else if (!r.known) {
        await createUnit(siteId, r.name, r.cap, null);
      }
    }
  }
  const roomCount = (await ensureUnits(siteId)).filter((u) => u.id !== wholeId).length;
  if (mode === "single") {
    const id = await ensureWhole();
    // ADR-0257: rooms that exist stay as presentation — the place is let ONLY as one.
    await setWholeProperty(siteId, id, roomCount > 0);
  } else if (mode === "both") {
    const id = await ensureWhole();
    await setWholeProperty(siteId, id, false);
  } else if (wholeId) {
    // ADR-0256 "rejt": the place is not let as one — the whole unit stays (nothing is
    // deleted: its calendar and prices come back if "egyben is" is switched on again).
    await settleFormerWhole(siteId, wholeId, "rejt", "");
  }
  if (wholeId && wholeRow) {
    const w = (await ensureUnits(siteId)).find((u) => u.id === wholeId)!;
    await updateUnit(siteId, w.id, w.name, wholeRow.cap, w.description);
  }
  return ok(true);
}

/** ② Árak: what the price is for, the base price per room, and "csak az időszakokban". */
async function savePrices(siteId: string, body: Record<string, unknown>, userId: string, lang: string): Promise<SaveResult> {
  const errors: string[] = [];
  const unitOpts = new Set(["per_night", "per_person_night", "per_stay"]);
  const priceUnit = String(body.priceUnit ?? "");
  const currency = String(body.currency ?? "");
  if (!unitOpts.has(priceUnit)) errors.push(T(lang, "Válassza ki, mire szól az ára."));
  if (currency !== "HUF" && currency !== "EUR") errors.push(T(lang, "Válassza ki, mire szól az ára."));
  const units = await ensureUnits(siteId);
  const rows = Array.isArray(body.units) ? (body.units as Record<string, unknown>[]) : [];
  const targets: { unit: Unit; base: number | null; por: boolean }[] = [];
  for (const r of rows) {
    const unit = units.find((u) => u.id === r.id);
    if (!unit) continue; // not this site's — ignored, never written (admin-foreign-object)
    const raw = r.base;
    const base = amountOf(raw);
    if (base === null && raw !== "" && raw !== null && raw !== undefined) {
      errors.push(T(lang, "{name}: az ár csak pozitív egész szám lehet.", { name: unit.name }));
    }
    targets.push({ unit, base, por: r.por === true });
  }
  if (errors.length) return fail([...new Set(errors)]);
  const cfgErrs = await mergeConfig(siteId, "pricing", { currency, unit: priceUnit }, userId);
  if (cfgErrs.length) return fail(cfgErrs);
  for (const t of targets) {
    await setBasePrice(t.unit.id, t.base);
    await setUnitPriceOnRequest(t.unit.id, t.por);
    if (body.seasonalOnly === true || body.seasonalOnly === false) {
      await setUnitSeasonalOnly(t.unit.id, body.seasonalOnly);
    }
  }
  return ok(true);
}

/** ③ Foglalás szabályai: shortest / longest stay, how far ahead, earliest arrival. */
async function saveRules(siteId: string, body: Record<string, unknown>, userId: string, lang: string): Promise<SaveResult> {
  const errors: string[] = [];
  const min = intIn(body.minNights, 1, 30);
  const max = intIn(body.maxNights, 1, 365);
  const horizon = intIn(body.horizon, 1, 24);
  const lead = intIn(body.lead, 0, 60);
  if (min === null) errors.push(T(lang, "A legrövidebb foglalás 1 és 30 éj között lehet."));
  if (max === null) errors.push(T(lang, "A leghosszabb foglalás 1 és 365 éj között lehet."));
  if (horizon === null) errors.push(T(lang, "Előre 1 és 24 hónap között lehet foglalni."));
  if (lead === null) errors.push(T(lang, "A legkorábbi érkezés 0 és 60 nap között lehet."));
  if (errors.length) return fail(errors);
  const e = await mergeConfig(siteId, "booking", { minNights: min!, maxNights: max!, horizonMonths: horizon!, leadTimeDays: lead! }, userId);
  return e.length ? fail(e) : ok(true);
}

/** ④ Amit a vendég lát: tourist tax (three states) and what the price includes. */
async function saveGuest(siteId: string, body: Record<string, unknown>, userId: string, lang: string): Promise<SaveResult> {
  const state = body.taxState;
  let tax: number | "" = "";
  if (state === "amount") {
    const n = intIn(body.tax, 1, 100000);
    if (n === null) return fail([T(lang, "Az idegenforgalmi adó 1 és 100 000 Ft között lehet.")]);
    tax = n;
  } else if (state === "none") tax = 0;
  else if (state !== "unknown") return fail([T(lang, "Válassza ki, kér-e idegenforgalmi adót.")]);
  const includes = String(body.includes ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const e = await mergeConfig(siteId, "booking", { touristTaxPerPersonNight: tax, priceIncludes: includes }, userId);
  return e.length ? fail(e) : ok(true);
}

/** The addresses that are not e-mail addresses — the booking mail silently drops them, so say so here. */
export function badNotifyAddresses(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

/** ⑤ Értesítés: where requests go, and when an unanswered one expires. */
async function saveNotify(siteId: string, body: Record<string, unknown>, userId: string, lang: string): Promise<SaveResult> {
  const notify = String(body.notify ?? "").trim().slice(0, 400);
  const bad = badNotifyAddresses(notify);
  const errors: string[] = [];
  if (bad.length) errors.push(T(lang, "Ez nem tűnik e-mail címnek: {list}", { list: bad.join(", ") }));
  const expiry = intIn(body.expiry, 0, 336);
  if (expiry === null) errors.push(T(lang, "A lejárat 0 és 336 óra között lehet."));
  if (errors.length) return fail(errors);
  const e = await mergeConfig(siteId, "booking", { notifyEmail: notify, autoDeclineHours: expiry! }, userId);
  return e.length ? fail(e) : ok(true);
}

export async function saveBookingSetupSection(
  siteId: string,
  section: string,
  body: Record<string, unknown>,
  userId: string,
  lang: string,
): Promise<SaveResult> {
  switch (section) {
    case "rooms":
      return saveRooms(siteId, body, lang);
    case "prices":
      return savePrices(siteId, body, userId, lang);
    case "rules":
      return saveRules(siteId, body, userId, lang);
    case "guest":
      return saveGuest(siteId, body, userId, lang);
    case "notify":
      return saveNotify(siteId, body, userId, lang);
  }
  return fail([]);
}

/**
 * Add a recurring season to one room or to every room the guest can book, or delete one.
 * Messages are the Árak screen's (addSeasonPrice) — with several rooms each is prefixed
 * by the room's name, because a duplicate name may hit only one of them.
 */
export async function seasonOp(siteId: string, body: Record<string, unknown>, lang: string): Promise<SaveResult> {
  const units = await ensureUnits(siteId);
  if (body.op === "delete") {
    await deletePrice(siteId, String(body.priceId ?? "")); // ownership checked inside
    return ok(true);
  }
  if (body.op !== "add") return fail([]);
  const ids = Array.isArray(body.unitIds) ? body.unitIds.map(String) : [];
  const targets = units.filter((u) => ids.includes(u.id));
  if (!targets.length) return fail([]);
  const label = String(body.label ?? "").trim().slice(0, 80);
  const from = String(body.from ?? "");
  const to = String(body.to ?? "");
  const amount = amountOf(body.amount) ?? Number.NaN;
  const minRaw = body.min;
  const min = minRaw === "" || minRaw === null || minRaw === undefined ? null : intIn(minRaw, 1, 60);
  if (min === null && !(minRaw === "" || minRaw === null || minRaw === undefined)) {
    return fail([T(lang, "A minimum 1 és 60 éj között lehet.")]);
  }
  // A missing name, a date that does not parse, a missing price: the same for every room —
  // one message, and nothing is tried. Only a duplicate name can hit just one of them.
  if (!label || !normMonthDay(from) || !normMonthDay(to) || !(amount > 0)) {
    const r = await addSeasonPrice(targets[0]!.id, label, from, to, amount, min);
    return fail(r.errors);
  }
  const errors: string[] = [];
  for (const u of targets) {
    const r = await addSeasonPrice(u.id, label, from, to, amount, min);
    for (const e of r.errors) errors.push(targets.length > 1 ? `${u.name}: ${e}` : e);
  }
  return errors.length ? { ok: false, errors, rerender: true } : ok(true);
}
