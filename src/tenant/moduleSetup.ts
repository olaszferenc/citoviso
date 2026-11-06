// ADR-0429 — THE module setup registry: one entry per setup topic. The first-login wizard,
// the module tiles, the overview strip, the reminder mails and the land gate
// (scripts/module-setup-registry-check.mts) read THIS list and nothing else, so a new
// module reaches every surface by one entry — and cannot land without one.
//
// Approved plan: assets/design-refs/tenant-admin/modul-statusz/ (README = what binds).
//
// ⛔ A STATUS IS NEVER STORED. Every rule reads the real data through the predicates the
// rest of the system already runs (unitPriceStatus, the renderer's own filled-field set,
// the stored module config, calendar_link …) and writes nothing (ADR-0192 ②: a gate that
// writes while it judges). `site_setup_progress` only remembers where the owner stands in
// the questions.

import { db } from "../db/client.js";
import { T } from "../i18n/mail.js";
import { formatNumber } from "../text/money.js";
import { MODULE_CATALOG } from "../modules.js";
import { generatedRoomNames, getTenantContact, getTenantContent, moduleContentFor } from "./editor.js";
import { filledContentFields, getTenantModules, type FilledContentFields } from "./modules.js";
import { getSitePrices, unitPriceStatus, type UnitPrice, type UnitPriceStatus } from "./prices.js";
import { todayForSite } from "./timeZone.js";
import { getUnits, type Unit } from "./units.js";
import { bookableUnits, isWholeOnlySite } from "./unitVisibility.js";

// ── status ───────────────────────────────────────────────────────────────────────────
/** done = Kész · part = Félkész · miss = Hiányzik · decl = Ön döntött így · opt = Nem kötelező. */
export type SetupState = "done" | "part" | "miss" | "decl" | "opt";

export interface TopicStatus {
  readonly st: SetupState;
  /** One plain sentence: what is there, or what is missing. */
  readonly line: string;
}

export const isOpenState = (st: SetupState): boolean => st === "miss" || st === "part";
export const isSettledState = (st: SetupState): boolean => st === "done" || st === "decl";

// ── context: everything the rules read, loaded once per request ─────────────────────
export interface SetupProgressRow {
  readonly step: number;
  readonly draft: Record<string, unknown>;
  readonly skipped: boolean;
  readonly hidden: boolean;
  readonly completed: boolean;
}

export interface SetupCtx {
  readonly tenantId: string;
  readonly siteId: string;
  readonly today: string;
  /** Catalog ids the tenant holds right now (active, incl. trial grants) + the spine. */
  readonly held: ReadonlySet<string>;
  /** Live module prices (HUF / month) — the "what it costs" sentence of a missing module. */
  readonly prices: ReadonlyMap<string, number>;
  readonly units: readonly Unit[];
  readonly unitPrices: ReadonlyMap<string, readonly UnitPrice[]>;
  /** The renderer's own filled content fields (moduleContentFor().data). */
  readonly filled: FilledContentFields;
  /** Only the keys the owner SAVED, per module (defaults are not answers). */
  readonly stored: ReadonlyMap<string, Record<string, unknown>>;
  readonly intro: string;
  readonly photoCount: number;
  readonly ownPhotos: boolean;
  readonly address: string;
  readonly hasGeo: boolean;
  readonly customDomainLive: boolean;
  readonly multilang: "active" | "stale" | null;
  readonly calendar: readonly CalendarLinkFact[];
  readonly progress: ReadonlyMap<string, SetupProgressRow>;
  /** Room names the generated page shows (portal data) — offered as a starting point. */
  readonly suggestedRooms: readonly string[];
}

export interface CalendarLinkFact {
  readonly unitId: string;
  readonly provider: string;
  readonly ok: boolean;
  readonly error: string | null;
  readonly days: number;
}

/** The units a guest can book — the server's own rule (ADR-0393 / ADR-0257). */
export function bookableOf(ctx: SetupCtx): Unit[] {
  return ctx.units.length ? bookableUnits([...ctx.units]) : [];
}
/** The rooms beside the whole house (ADR-0392). */
export function roomsOf(ctx: SetupCtx): Unit[] {
  return ctx.units.length > 1 ? ctx.units.filter((u) => !u.representsWhole) : [];
}
export function houseOf(ctx: SetupCtx): Unit | null {
  return ctx.units.find((u) => u.representsWhole) ?? ctx.units[0] ?? null;
}
/** tenantMultiUnitState counts ALL units (ADR-0192 ④.4). */
export const multiUnit = (ctx: SetupCtx): boolean => ctx.units.length > 1;
export const holds = (ctx: SetupCtx, moduleId: string): boolean => ctx.held.has(moduleId);
const storedOf = (ctx: SetupCtx, moduleId: string): Record<string, unknown> => ctx.stored.get(moduleId) ?? {};

/** The letting mode the DATA shows (or null = never answered). */
export type LettingMode = "whole" | "rooms" | "wholeOnly";
export function lettingMode(ctx: SetupCtx): LettingMode | null {
  const rooms = roomsOf(ctx);
  if (rooms.length) return isWholeOnlySite(ctx.units) ? "wholeOnly" : "rooms";
  const house = houseOf(ctx);
  if (!house) return null;
  // A lone default unit is an unanswered question — unless the owner already worked on it
  // (capacity, a price, "ár kérésre") or answered it in the walk.
  const touched =
    house.capacity !== null || house.priceOnRequest || (ctx.unitPrices.get(house.id)?.length ?? 0) > 0;
  return touched || ctx.progress.get("letting")?.completed ? "whole" : null;
}

// ── requirements ────────────────────────────────────────────────────────────────────
export interface DataPrereq {
  readonly test: (ctx: SetupCtx) => boolean;
  readonly why: (lang: string) => string;
}
/** Registered data preconditions a topic may wait for (the gate checks the names). */
export const DATA_PREREQS: Readonly<Record<string, DataPrereq>> = {
  bookableUnit: {
    test: (ctx) => bookableOf(ctx).length > 0,
    why: (lang) => T(lang, "Előbb hozza létre a szobákat."),
  },
};

export interface TopicRequirement {
  /** Another topic that must be settled (Kész or Ön döntött így). */
  readonly topic?: string;
  /** A registered data precondition (DATA_PREREQS). */
  readonly data?: string;
  /** The locking sentence ("Előbb …"). Required with `topic`. */
  readonly why?: (lang: string) => string;
}

export type TopicSetup =
  | { readonly kind: "steps" }
  | { readonly kind: "page"; readonly href: string; readonly label: (lang: string) => string; readonly returns: boolean };

export interface SetupTopic {
  readonly id: string;
  /** Catalog modules whose ownership brings this topic up; empty = always. modules[0] = its own module. */
  readonly modules: readonly string[];
  readonly group: "booking" | "page";
  readonly title: (lang: string) => string;
  readonly icon: string;
  /** KB entry id (kb/entries/<id>). */
  readonly kb: string;
  readonly requires: readonly TopicRequirement[];
  /** The steps repeat over the bookable units; the status counts per unit. */
  readonly repeat?: "unit";
  /** Plain-language source of the rule (shown to developers, read by nobody else). */
  readonly rule: string;
  readonly status: (ctx: SetupCtx, lang: string) => TopicStatus;
  /** steps = embedded questions (src/server/setupSteps.ts); page = the existing screen, opened from the walk. */
  readonly setup: TopicSetup;
  /** May the reminder name it when it is open? (default: booking topics, or a missing one). */
  readonly remind?: boolean;
  /** Why this topic is legitimately Kész on an empty site (the gate's ③ demands a reason). */
  readonly doneByDefault?: string;
}

const lettingWhy = (lang: string): string => T(lang, "Előbb mondja meg, egészben vagy szobánként adja ki.");
const pricingWhy = (lang: string): string => T(lang, "Előbb az árak — a foglalás összeget mond.");

function perUnit(lang: string, ok: number, total: number, multi: boolean, what: "price" | "cap"): string {
  if (!multi) return what === "price" ? T(lang, "Nincs ár — a vendég nem lát végösszeget") : T(lang, "Nincs megadva, hány fő fér el");
  return what === "price"
    ? T(lang, "{ok}/{n} szobának van ára", { ok, n: total })
    : T(lang, "{ok}/{n} szobának van férőhelye", { ok, n: total });
}


// ── THE REGISTRY ────────────────────────────────────────────────────────────────────
export const SETUP_TOPICS: readonly SetupTopic[] = [
  {
    id: "letting",
    modules: [],
    group: "booking",
    title: (lang) => T(lang, "Hogyan adja ki?"),
    icon: "overview",
    kb: "admin-modules-rooms",
    requires: [],
    rule: "site_unit: 1 egység = egészben · szobák + ház = szobánként · whole_only = egyben, bemutató szobákkal", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const mode = lettingMode(ctx);
      const n = roomsOf(ctx).length;
      if (!mode) return { st: "miss", line: T(lang, "Még nem mondta meg: egészben vagy szobánként adja ki") };
      if (mode === "whole") return { st: "done", line: T(lang, "Egészben adja ki") };
      if (!holds(ctx, "rooms")) return { st: "part", line: T(lang, "{n} szoba — a Szobák modul nélkül nem látszanak az oldalon", { n }) };
      if (mode === "wholeOnly") return { st: "done", line: T(lang, "Csak egyben adja ki · {n} szoba bemutatásként", { n }) };
      return { st: "done", line: T(lang, "{n} szoba + az egész ház (egyben is kivehető)", { n }) };
    },
  },
  {
    id: "capacity",
    modules: ["rooms", "booking"],
    group: "booking",
    title: (lang) => T(lang, "Férőhely"),
    icon: "account",
    kb: "admin-modules-rooms",
    requires: [{ topic: "letting", why: lettingWhy }, { data: "bookableUnit" }],
    repeat: "unit",
    rule: "site_unit.capacity minden foglalható egységen (bookableUnits)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const b = bookableOf(ctx);
      const ok = b.filter((u) => u.capacity).length;
      if (b.length && ok === b.length) {
        return { st: "done", line: b.length === 1 ? T(lang, "{n} fő", { n: b[0]!.capacity! }) : b.map((u) => `${u.name}: ${T(lang, "{n} fő", { n: u.capacity! })}`).join(" · ") };
      }
      return { st: ok ? "part" : "miss", line: perUnit(lang, ok, b.length, b.length > 1, "cap") };
    },
  },
  {
    id: "pricing",
    modules: ["pricing"],
    group: "booking",
    title: (lang) => T(lang, "Árak"),
    icon: "pricing",
    kb: "admin-modules-pricing",
    requires: [{ topic: "letting", why: lettingWhy }, { data: "bookableUnit" }],
    repeat: "unit",
    rule: "unitPriceStatus egységenként: complete · on_request = Ön döntött így · none / partial = hiány", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const b = bookableOf(ctx);
      const sts: UnitPriceStatus[] = b.map((u) => unitPriceStatus([...(ctx.unitPrices.get(u.id) ?? [])], u, ctx.today));
      const ok = sts.filter((s) => s === "complete" || s === "on_request").length;
      if (b.length && sts.every((s) => s === "on_request")) return { st: "decl", line: T(lang, "Ár kérésre — a vendég árajánlatot kér") };
      if (b.length && ok === b.length) {
        const req = sts.filter((x) => x === "on_request").length;
        if (b.length === 1) return { st: "done", line: T(lang, "Az árak megadva") };
        return { st: "done", line: req ? T(lang, "Minden szobánál döntött: {n} árral, {m} ár kérésre", { n: b.length - req, m: req }) : T(lang, "Minden szobának van ára") };
      }
      return { st: ok ? "part" : "miss", line: perUnit(lang, ok, b.length, b.length > 1, "price") };
    },
  },
  {
    id: "calendar",
    modules: ["booking"],
    group: "booking",
    title: (lang) => T(lang, "Naptár-összekötés"),
    icon: "bookings",
    kb: "admin-modules-booking",
    requires: [{ topic: "pricing", why: pricingWhy }, { data: "bookableUnit" }],
    rule: "calendar_link (import: last_ok_at, last_error) + a „hol hirdet még” válasz (site_setup_progress)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const answer = ctx.progress.get("calendar")?.draft ?? {};
      const portals = Array.isArray(answer.portals) ? (answer.portals as string[]) : [];
      const bad = ctx.calendar.find((l) => !l.ok);
      if (bad) return { st: "part", line: T(lang, "{p}: a naptár-link nem működik", { p: bad.provider }) };
      if (answer.none === true) return { st: "done", line: T(lang, "Csak itt hirdet — nincs mit összekötni") };
      const linked = new Set(ctx.calendar.map((l) => l.provider));
      const missing = portals.filter((p) => !linked.has(p));
      if (missing.length) return { st: "part", line: T(lang, "{p}: még nincs összekötve", { p: missing.join(", ") }) };
      if (ctx.calendar.length) {
        const days = ctx.calendar.reduce((a, l) => a + l.days, 0);
        return { st: "done", line: T(lang, "{p} összekötve · {n} foglalt nap", { p: [...linked].join(", "), n: days }) };
      }
      return { st: "miss", line: T(lang, "Még nem mondta meg, hol hirdet még — dupla foglalás jöhet") };
    },
  },
  {
    id: "booking",
    modules: ["booking"],
    group: "booking",
    title: (lang) => T(lang, "Foglalás szabályai"),
    icon: "settings",
    kb: "admin-booking-setup",
    requires: [{ topic: "pricing", why: pricingWhy }],
    rule: "a booking modul tárolt kulcsai: minNights/maxNights (stay) + notifyEmail (notify)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const s = storedOf(ctx, "booking");
      const stay = "minNights" in s || "maxNights" in s;
      const notify = "notifyEmail" in s;
      if (stay && notify) {
        const min = Number(s.minNights) || 1;
        const to = String(s.notifyEmail ?? "").trim();
        return { st: "done", line: to ? T(lang, "Legalább {n} éj · értesítés: {to}", { n: min, to }) : T(lang, "Legalább {n} éj · értesítés a fiókja e-mail címére", { n: min }) };
      }
      return { st: "part", line: T(lang, "Még nem nézte át: legkevesebb éj, kinek szóljunk a kérésről") };
    },
  },
  {
    id: "hours",
    modules: ["hours"],
    group: "page",
    title: (lang) => T(lang, "Érkezés, távozás"),
    icon: "clock",
    kb: "admin-modules-settings",
    requires: [],
    rule: "paidButEmptyModules: hours (checkInFrom/To, checkOutUntil)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      if (!ctx.filled.has("hours")) return { st: "miss", line: T(lang, "Nincs megadva — az oldalon ez a rész most nem jelenik meg") };
      const s = storedOf(ctx, "hours");
      const from = String(s.checkInFrom ?? ""), to = String(s.checkInTo ?? ""), out = String(s.checkOutUntil ?? "");
      return { st: "done", line: from || out ? T(lang, "Érkezés {from}–{to} · távozás {out}-ig", { from, to, out }) : T(lang, "Megadva") };
    },
  },
  {
    id: "amenities",
    modules: ["amenities"],
    group: "page",
    title: (lang) => T(lang, "Felszereltség"),
    icon: "check",
    kb: "admin-modules-amenities",
    requires: [{ topic: "letting", why: (lang) => T(lang, "Előbb mondja meg, egészben vagy szobánként adja ki — szobánként a szobák saját felszereltségét is kérdezzük.") }],
    repeat: "unit",
    // Per-room amenities need rooms AND amenities — ADR-0074 §5.
    rule: "config.items (egész szállás) + site_unit.amenities szobánként, ha rooms ÉS amenities", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      if (!ctx.filled.has("amenities")) return { st: "miss", line: T(lang, "Üres — az oldalon ez a rész most nem jelenik meg") };
      const rooms = holds(ctx, "rooms") ? roomsOf(ctx) : [];
      const items = Array.isArray(storedOf(ctx, "amenities").items) ? (storedOf(ctx, "amenities").items as unknown[]).length : 0;
      const site = items ? T(lang, "{n} tétel az egész szálláson", { n: items }) : T(lang, "Látszik az oldalon");
      if (!rooms.length) return { st: "done", line: site };
      const per = rooms.filter((u) => u.amenities.length).length;
      if (per < rooms.length) return { st: "part", line: `${site} · ${T(lang, "{ok}/{n} szobánál saját felszereltség", { ok: per, n: rooms.length })}` };
      return { st: "done", line: `${site} · ${T(lang, "minden szobánál saját is")}` };
    },
  },
  {
    id: "email",
    modules: ["email"],
    group: "page",
    title: (lang) => T(lang, "Saját e-mail cím"),
    icon: "mail",
    kb: "admin-modules-settings",
    requires: [],
    rule: "config.forwardTo + site.custom_domain_status", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const s = storedOf(ctx, "email");
      const lp = String(s.localPart ?? "info") || "info";
      if (!ctx.customDomainLive) return { st: "opt", line: T(lang, "A saját webcímével együtt indul ({lp}@…)", { lp }) };
      return String(s.forwardTo ?? "").trim()
        ? { st: "done", line: T(lang, "Továbbítás ide: {to}", { to: String(s.forwardTo) }) }
        : { st: "part", line: T(lang, "Hová továbbítsuk a leveleket? — nincs megadva") };
    },
  },
  {
    id: "gallery",
    modules: ["gallery"],
    group: "page",
    title: (lang) => T(lang, "Fotók"),
    icon: "photos",
    kb: "admin-photos",
    requires: [],
    rule: "usingOwnPhotos (bemutató képek = Nem kötelező, tulaj-döntés 2026-10-02)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) =>
      ctx.ownPhotos && ctx.photoCount > 0
        ? { st: "done", line: T(lang, "{n} saját fotó", { n: ctx.photoCount }) }
        : { st: "opt", line: T(lang, "{n} bemutató kép · ha szeretné, feltölthet sajátot", { n: ctx.photoCount }) },
  },
  {
    id: "location",
    modules: ["location"],
    group: "page",
    title: (lang) => T(lang, "Térkép, megközelítés"),
    icon: "pin",
    kb: "admin-contact",
    requires: [],
    rule: "contact.address (+ geo)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) =>
      ctx.address
        ? { st: "done", line: T(lang, "A térkép ezt mutatja: {a}", { a: ctx.address }) }
        : { st: "miss", line: T(lang, "Nincs cím — a térkép nem találja a szállást") },
  },
  {
    id: "usp",
    modules: ["usp"],
    group: "page",
    title: (lang) => T(lang, "„Miért Önt válasszák”"),
    icon: "starf",
    kb: "admin-texts",
    requires: [],
    rule: "config.items (üresen a bemutatkozó szöveg kiemelései látszanak)", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) => {
      const items = storedOf(ctx, "usp").items;
      return Array.isArray(items) && items.length
        ? { st: "done", line: T(lang, "{n} saját előny az oldalon", { n: items.length }) }
        : { st: "opt", line: T(lang, "A bemutatkozó szöveg kiemelései látszanak — sajátot is megadhat") };
    },
  },
  {
    id: "reviews",
    modules: ["reviews"],
    group: "page",
    title: (lang) => T(lang, "Vélemények"),
    icon: "star",
    kb: "admin-modules-reviews",
    requires: [],
    rule: "config.collectEnabled (alapból be) — kikapcsolva = Ön döntött így", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    doneByDefault: "A véleménygyűjtés alapból be van kapcsolva (moduleConfig reviews.defaults.collectEnabled = true) — az üres oldal is gyűjt.", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) =>
      storedOf(ctx, "reviews").collectEnabled === false
        ? { st: "decl", line: T(lang, "Most nem gyűjt véleményt — így döntött") }
        : { st: "done", line: T(lang, "A vendégek írhatnak véleményt — Ön hagyja jóvá") },
  },
  {
    id: "poi",
    modules: ["poi"],
    group: "page",
    title: (lang) => T(lang, "Heti programajánló"),
    icon: "report",
    kb: "admin-modules-programs",
    requires: [],
    rule: "paidButEmptyModules: poi", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "page", href: "/admin?tab=modulok&m=poi", label: (lang) => T(lang, "Programajánló"), returns: true },
    status: (ctx, lang) =>
      ctx.filled.has("poi")
        ? { st: "done", line: T(lang, "A heti programajánló látszik az oldalon") }
        : { st: "miss", line: T(lang, "Üres — az oldalon ez a rész most nem jelenik meg") },
  },
  {
    id: "multilang",
    modules: ["multilang"],
    group: "page",
    title: (lang) => T(lang, "Többnyelvű honlap"),
    icon: "domain",
    kb: "admin-multilang",
    requires: [],
    rule: "site_multilang.status: active → Kész · stale → Félkész", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "page", href: "/admin?tab=modulok&m=multilang", label: (lang) => T(lang, "Többnyelvű honlap"), returns: true },
    status: (ctx, lang) =>
      ctx.multilang === "active"
        ? { st: "done", line: T(lang, "Lefordítva") }
        : ctx.multilang === "stale"
          ? { st: "part", line: T(lang, "A szöveg változott — újrafordítás kell") }
          : { st: "miss", line: T(lang, "Még nincs lefordítva") },
  },
  {
    id: "texts",
    modules: [],
    group: "page",
    title: (lang) => T(lang, "Bemutatkozó szöveg"),
    icon: "texts",
    kb: "admin-texts",
    requires: [],
    rule: "content.intro.length > 40", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
    setup: { kind: "steps" },
    status: (ctx, lang) =>
      ctx.intro.trim().length > 40
        ? { st: "done", line: T(lang, "A bemutatkozó szöveg kész") }
        : { st: "miss", line: T(lang, "Írja meg a bemutatkozó szöveget") },
  },
];

/** Catalog modules that deliberately have NO topic — each with its reason (the gate keeps it alive). */
export const SETUP_EXEMPT: Readonly<Record<string, string>> = {
  enquiry: "Gerinc: minden oldalon él, nincs mit beállítani (az értesítési címet a „Foglalás szabályai” kérdezi).", // i18n-exempt: developer-facing rule text (gate output), never shown to the owner
};

// ── graph ───────────────────────────────────────────────────────────────────────────
/** Topological order (Kahn), ties by registry order — the walk's and the tiles' order. */
export function topoOrder<T extends Pick<SetupTopic, "id" | "requires">>(topics: readonly T[]): T[] {
  const out: T[] = [];
  const left = topics.slice();
  while (left.length) {
    const i = left.findIndex((e) =>
      e.requires.every((r) => !r.topic || out.some((o) => o.id === r.topic) || !left.some((l) => l.id === r.topic)),
    );
    out.push(left.splice(i < 0 ? 0 : i, 1)[0]!);
  }
  return out;
}

export function topicHeld(ctx: SetupCtx, t: SetupTopic): boolean {
  return !t.modules.length || t.modules.some((m) => ctx.held.has(m));
}

/** The topics of THIS site, in the graph's order. */
export function siteTopics(ctx: SetupCtx): SetupTopic[] {
  return topoOrder(SETUP_TOPICS).filter((t) => topicHeld(ctx, t));
}

export interface TopicLock {
  /** Plain sentence shown on the locked topic. */
  readonly why: string;
  /** The topic to do first (a topic lock), if any. */
  readonly first?: string;
  /** Modules to buy first (a module lock). */
  readonly need?: readonly string[];
}

/** Why `t` cannot be done now — an unmet requirement, or a module the catalog requires (ADR-0192). */
export function topicLock(ctx: SetupCtx, t: SetupTopic, lang: string): TopicLock | null {
  for (const r of t.requires) {
    if (r.data) {
      const p = DATA_PREREQS[r.data];
      if (p && !p.test(ctx)) return { why: p.why(lang), first: "letting" };
    }
    if (r.topic) {
      const dep = SETUP_TOPICS.find((x) => x.id === r.topic);
      if (!dep || !topicHeld(ctx, dep)) continue;
      if (!isSettledState(dep.status(ctx, lang).st)) return { why: r.why ? r.why(lang) : dep.title(lang), first: dep.id };
    }
  }
  // The module lock reads the catalog's own requirement — never a copy of it.
  const own = MODULE_CATALOG.find((m) => m.id === t.modules[0]);
  const need = (own?.requires ?? [])
    .filter((r) => (r.when ?? "always") === "always" || multiUnit(ctx))
    .filter((r) => !ctx.held.has(r.id))
    .map((r) => r.id);
  if (need.length) {
    const req = own!.requires!.find((r) => r.id === need[0])!;
    const names = need.map((id) => moduleName(id, lang));
    return { why: T(lang, "Ehhez kell: {m}", { m: names.join(", ") }) + " — " + req.why, need };
  }
  return null;
}

export function moduleName(id: string, lang: string): string {
  const m = MODULE_CATALOG.find((x) => x.id === id);
  return m ? T(lang, m.publicLabel) : id;
}
export function modulePriceText(ctx: SetupCtx, id: string, lang: string): string {
  const p = ctx.prices.get(id);
  return p ? T(lang, "{p} Ft/hó", { p: formatNumber(p, lang) }) : "";
}

export interface TopicView {
  readonly topic: SetupTopic;
  readonly status: TopicStatus;
  readonly lock: TopicLock | null;
}
export function topicViews(ctx: SetupCtx, lang: string): TopicView[] {
  return siteTopics(ctx).map((t) => {
    const status = t.status(ctx, lang);
    return { topic: t, status, lock: isSettledState(status.st) ? null : topicLock(ctx, t, lang) };
  });
}

/** Passed = settled, or an optional topic the owner chose to skip. */
export function topicPassed(ctx: SetupCtx, v: TopicView): boolean {
  return isSettledState(v.status.st) || (v.status.st === "opt" && !!ctx.progress.get(v.topic.id)?.skipped);
}

/** Open topics the reminder may name (registry `remind`, default: booking group or missing). */
export function remindTopics(ctx: SetupCtx, lang: string): TopicView[] {
  return topicViews(ctx, lang).filter(
    (v) => isOpenState(v.status.st) && (v.topic.remind ?? (v.topic.group === "booking" || v.status.st === "miss")),
  );
}

/** "Ön végösszeget lát…" — the one sentence about what the guest can do today. */
export function guestSentence(ctx: SetupCtx, lang: string): string {
  const views = topicViews(ctx, lang);
  const st = (id: string): SetupState | null => views.find((v) => v.topic.id === id)?.status.st ?? null;
  const letting = st("letting");
  if (letting === "miss") return T(lang, "A vendég még nem tudja, a házat vagy egy szobát foglal.");
  if (letting === "part") return T(lang, "A szobái a honlapon még nem látszanak.");
  const cap = st("capacity");
  if (cap && isOpenState(cap)) return T(lang, "A vendég még nem látja, hány fő fér el.");
  const cal = st("calendar");
  const calWarn = cal && isOpenState(cal) ? " " + T(lang, "A portálos foglalások itt még nem látszanak — dupla foglalás jöhet.") : "";
  const price = st("pricing");
  if (!price) return T(lang, "A vendég időpontot kér Öntől.");
  if (isOpenState(price)) return T(lang, "A vendég nem lát végösszeget — foglalás helyett árajánlatot kér.") + calWarn;
  if (price === "decl") return T(lang, "A vendég árajánlatot kér — így döntött (ár kérésre).") + calWarn;
  return T(lang, "A vendég végösszeget lát és foglalni tud.") + calWarn;
}

// ── loading ─────────────────────────────────────────────────────────────────────────
export async function loadSetupProgress(siteId: string): Promise<Map<string, SetupProgressRow>> {
  const rows = await db
    .selectFrom("site_setup_progress")
    .select(["item", "step", "draft", "skipped_at", "hidden_at", "completed_at"])
    .where("site_id", "=", siteId)
    .execute();
  return new Map(
    rows.map((r) => [
      r.item,
      { step: r.step, draft: (r.draft ?? {}) as Record<string, unknown>, skipped: !!r.skipped_at, hidden: !!r.hidden_at, completed: !!r.completed_at },
    ]),
  );
}

/** Everything the rules read, in one go. ⛔ Read-only (getUnits, not ensureUnits). */
export async function loadSetupCtx(tenantId: string, siteId: string): Promise<SetupCtx> {
  const [mv, units, unitPrices, today, content, contact, storedRows, site, ml, links, progress, modContent] = await Promise.all([
    getTenantModules(tenantId),
    getUnits(siteId),
    getSitePrices(siteId),
    todayForSite(siteId),
    getTenantContent(tenantId),
    getTenantContact(tenantId),
    db.selectFrom("site_module_config").select(["module", "config"]).where("site_id", "=", siteId).execute(),
    db.selectFrom("site").select(["custom_domain_status"]).where("id", "=", siteId).executeTakeFirst(),
    db.selectFrom("site_multilang").select(["status"]).where("site_id", "=", siteId).executeTakeFirst(),
    db
      .selectFrom("calendar_link")
      .innerJoin("site_unit", "site_unit.id", "calendar_link.unit_id")
      .select(["calendar_link.unit_id", "calendar_link.provider", "calendar_link.last_error", "calendar_link.last_day_count", "calendar_link.last_ok_at"])
      .where("site_unit.site_id", "=", siteId)
      .where("calendar_link.direction", "=", "import")
      .execute(),
    loadSetupProgress(siteId),
    moduleContentFor(tenantId, siteId),
  ]);
  const suggestedRooms = await generatedRoomNames(tenantId);
  const held = new Set<string>(MODULE_CATALOG.filter((m) => m.spine).map((m) => m.id));
  for (const m of mv.modules) if (m.active) held.add(m.id);
  return {
    tenantId,
    siteId,
    today,
    held,
    prices: new Map(mv.modules.map((m) => [m.id, m.priceMonthly] as const)),
    units,
    unitPrices,
    filled: filledContentFields(modContent.data),
    stored: new Map(storedRows.map((r) => [r.module, (r.config ?? {}) as Record<string, unknown>])),
    intro: content?.intro ?? "",
    photoCount: content?.photos.length ?? 0,
    ownPhotos: !!content?.usingOwnPhotos,
    address: contact?.address ?? "",
    hasGeo: !!contact?.geo,
    customDomainLive: site?.custom_domain_status === "live",
    multilang: (ml?.status as "active" | "stale" | undefined) ?? null,
    calendar: links.map((l) => ({
      unitId: l.unit_id,
      provider: l.provider,
      ok: !l.last_error,
      error: l.last_error,
      days: l.last_day_count ?? 0,
    })),
    progress,
    suggestedRooms,
  };
}
