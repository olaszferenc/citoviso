// KB screenshot generator (ADR-0045, §J.26): REPRODUCIBLE, language-parametric
// captures for the knowledge base — the guide images regenerate from the real views
// whenever the UI changes, instead of rotting as hand-made screenshots.
//
// Shoots every admin tab at phone width (the owner's real device) with representative
// fixture data and writes the capture straight into the owning entry's assets/<lang>/.
// Also drops verification shots of the Súgó tab itself into the CWD (not embedded).
// No server, no login: the views are pure functions (shot-module-config minta).
//
//   npx tsx scripts/kb-shot.mts

import { chromium } from "playwright-core";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { adminDashboard, domainSettlementSection } from "../src/server/adminViews.js";
import type { DomainAdminData } from "../src/domains/domainAdmin.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import {
  dashboardPage,
  duplicatesPage,
  helpPage,
  leadPage,
  leadsPage,
  outreachDraftPage,
  pricingPage,
  reportPage,
  scrapePage,
  settingsPage,
} from "../src/console/views.js";
import { testLogPage } from "../src/console/testLogViews.js";
import { findScenario } from "../src/elek/fkParse.js";
import type { FunnelCounts, FunnelReport, LeadDetail, LeadListRow } from "../src/console/data.js";
import { buildLeadListResult, defaultLeadQuery } from "../src/console/data.js";
import type { PricingSnapshot } from "../src/pricing.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";
import { loadKbEntries, renderKbBody } from "../src/kb/kb.js";
import { getTenantModules } from "../src/tenant/modules.js";
import { positionThreads } from "../src/tenant/messageThreads.js";
import { MESSAGE_TOPICS, topicOfKind, type MessageTopic } from "../src/tenant/messageTopics.js";
import type { MonthView } from "../src/tenant/availability.js";

const ROOT = path.resolve(import.meta.dirname, "..");
// Language of the shot UI. Today the admin renders Hungarian; when the admin surface
// gets language packs, this drives per-language captures of the same fixtures.
const LANG = process.env.KB_SHOT_LANG ?? "hu";

const session = {
  tenantId: "demo",
  tenantUserId: "demo-user",
  username: "kovacs.jozsef",
  displayName: "Nyugalom Vendégház",
  contactEmail: "kovacs.jozsef@gmail.com",
} as unknown as Parameters<typeof adminDashboard>[0];

// Photos come from the repo's own template thumbnails so the capture needs no
// network and no tenant data — representative, never personal.
const content = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro:
    "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal várjuk. " +
    "Nálunk a reggeli kakukkfű-illatú, a esték tücsökszóval telnek.",
  highlights: ["Saját parkoló", "Kutyabarát", "Zárt kerékpártároló"],
  photos: [
    { url: "/assets/ui/tpl-organic.jpg", alt: "A kert nyáron", units: ["u1"] },
    { url: "/assets/ui/tpl-editorial.jpg", alt: "", units: [] },
    { url: "/assets/ui/tpl-watercolor.jpg", alt: "A terasz", units: ["u2"] },
  ],
  usingOwnPhotos: true,
  status: "live",
  previewPath: null,
} as unknown as Parameters<typeof adminDashboard>[1];

const units = [
  { id: "u1", name: "Kertre néző apartman" },
  { id: "u2", name: "Padlásszoba" },
];

const modules = await getTenantModules("00000000-0000-0000-0000-000000000000").catch(() => null);

// ⛔ 2026-09-12: a demo tenantnak EGYETLEN aktív fizetős modulja sincs (csak a spine
// „Időpontkérés"), tehát az „Az én moduljaim" lista minden eddigi KB-képen üres volt —
// és az árazás-szakasz képe az „az árban" címkét fotózta volna, miközben a szöveg a
// havi/éves árcímkéről beszél. A fixture-nek BIZONYÍTANIA kell, hogy azt rendereli,
// amiről a szöveg szól (feedback_fixture_must_prove_its_own_path).
// A három modul SZÁNDÉKOSAN az, ami a subscriptionFixture tételsorában áll:
// 3 900 alapdíj + 490 + 690 + 990 = 6 070 Ft/hó = 60 700 Ft/év — a kép így önmagával
// is konzisztens, nem csak a szöveggel.
const OWNED_IN_SHOT = new Set(["gallery", "rooms", "booking"]);
const modulesOwned = modules
  ? {
      ...modules,
      modules: modules.modules.map((m) =>
        OWNED_IN_SHOT.has(m.id) ? { ...m, active: true } : m,
      ),
      totalMonthly:
        modules.baseMonthly +
        modules.modules
          .filter((m) => OWNED_IN_SHOT.has(m.id))
          .reduce((sum, m) => sum + m.priceMonthly, 0),
    }
  : null;

// ADR-0088 §8: the subscription card with the annual-switch savings box — the
// admin-subscription guide's picture. Representative numbers (base 3 900 +
// three modules), monthly cadence so the NEW switch offer is visible.
const subscriptionFixture = {
  status: "active" as const,
  periodEnd: "2026-09-28",
  renewDay: 28,
  nextInvoiceTotal: 6070,
  nextInvoiceItems: [
    { label: "Fotógaléria", price: 490, isNew: false },
    { label: "Szobák és árak", price: 690, isNew: false },
    { label: "Online foglalás", price: 990, isNew: true },
  ],
  payUrl: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly" as const,
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 60700,
  annualSavings: 12140,
  annualFreeMonths: 2,
  // ADR-0088 ⑨: the guide shows the mandate block ON and a live coupon — those
  // are the states the text walks the owner through.
  autoCharge: true,
  coupon: { percent: 25, expiresAt: "2026-11-30" },
};

// The SAME tab, an ANNUAL account — because the two entries document two different
// things on it. admin-subscription needs the MONTHLY cadence (that is the only state
// in which the "switch to annual" savings box exists at all); admin-modules documents
// how a module is PRICED, and on an annual plan the chip carries both periods and the
// summary totals in years. One shared monthly fixture would have left the modules
// guide describing something its own picture does not show
// (assets/design-refs/console/modules-annual-pricing/).
const subscriptionAnnualFixture = {
  ...subscriptionFixture,
  billingPeriod: "annual" as const,
};

// ADR-0110 legal-panel fixture. The registry number is deliberately absent: the
// entry explains the "hiányzó kötelező adat" warning, so the picture must contain it.
const legalFixture = {
  who: {
    legalName: "Nyugalom Vendégház Kft.",
    address: "8625 Szólád, Kossuth Lajos utca 12.",
    taxNumber: "12345678-2-41",
    regNumber: null,
    ntakId: "SZ26001234",
    email: "info@nyugalomvendeghaz.hu",
    phone: "+36 30 123 4567",
  },
  missing: ["Nyilvántartási szám"],
  privacyUrl: "https://nyugalom-vendeghaz.citoviso.com/adatvedelem",
  imprintUrl: "https://nyugalom-vendeghaz.citoviso.com/impresszum",
};

// ADR-0108: a Forgalom fül képéhez REPREZENTATÍV fixture — az entry a
// „minden N. látogatóból lesz megkeresés" mondatot és a hoszt-bontást is
// elmagyarázza, tehát a képen MINDKETTŐNEK rajta kell lennie.
const trafficFixture = {
  days: 30,
  visitors: 143,
  views: 188,
  contacts: 7,
  fromGooglePct: 61,
  mobilePct: 78,
  hostSplit: { domain: "nyugalomvendeghaz.hu", custom: 96, slug: 47 },
  visitorsPerContact: 20,
  isEmpty: false,
};

// tab id → the KB entry that embeds this capture.
const TAB_TO_ENTRY: readonly [tab: string, entryId: string][] = [
  ["attekintes", "admin-overview"],
  ["szovegek", "admin-texts"],
  ["fotok", "admin-photos"],
  ["modulok", "admin-modules"],
  ["modulok", "admin-subscription"],
  ["dokumentumok", "admin-documents"],
  ["uzenetek", "admin-messages"],
  ["fiok", "admin-account"],
  ["foglalasok", "admin-bookings"],
];

// ADR-0084 fixtures. Representative, never personal: an invented guesthouse's own
// invoices and our own service notices. The FAILED row is here on purpose — the
// guide explains that state, so the picture has to contain it.
const dt = (s: string): Date => new Date(`${s}T10:00:00Z`);
const documentsFixture = {
  invoices: [
    { id: "f1", itemKey: "subscription" as const, itemPeriod: "monthly" as const,
      invoiceNumber: "OV-2026-5", issuedAt: dt("2026-08-28"), gross: 7240,
      currency: "HUF", status: "issued", vatTreatment: "aam", hasPdf: true,
      periodStart: dt("2026-08-28"), periodEnd: dt("2026-09-27"), year: "2026" },
    { id: "f2", itemKey: "multilang" as const, itemPeriod: "once" as const,
      invoiceNumber: null, issuedAt: dt("2026-08-28"), gross: 14900,
      currency: "HUF", status: "failed", vatTreatment: null, hasPdf: false,
      periodStart: null, periodEnd: null, year: "2026" },
    { id: "f3", itemKey: "subscription_renewal" as const, itemPeriod: "monthly" as const,
      invoiceNumber: "OV-2026-4", issuedAt: dt("2026-07-28"), gross: 7240,
      currency: "HUF", status: "issued", vatTreatment: "aam", hasPdf: true,
      periodStart: dt("2026-07-28"), periodEnd: dt("2026-08-27"), year: "2026" },
  ],
  agreements: [
    { key: "terms", acceptedAt: dt("2026-06-28"), year: "2026", text: null, facts: [] },
    { key: "photo_rights", acceptedAt: dt("2026-06-28"), year: "2026",
      text: "Kijelentem, hogy a honlapon megjelenő képek felhasználására jogosult vagyok.",
      facts: [] },
  ],
  sub: "szamlak",
  year: "mind",
  q: "",
  nextRenewal: dt("2026-09-28"),
};
// ⛔ 2026-09-12: ez a fixture NÉMÁN elavult. Az FK-001 szál a sor-típust kötelező
// `thread` mezővel bővítette, a fixture nem követte, és a `tsc` nem fogta meg, mert a
// tsconfig include-ja csak `src/**/*.ts` — a scripts/ fa LÁTHATATLAN a típusellenőrzőnek.
// Így a kb-shot az Üzenetek fülnél futásidőben elszállt, és onnantól EGYETLEN további
// KB-kép sem generálódott újra: pontosan az a képrothadás, amit a §J frissesség-kör
// megelőzni hivatott. Ezért a szál-pozíciót most a VALÓDI függvény számolja a fixture
// üzeneteiből (ugyanaz, amit az éles út hív) — kézzel írt `thread` blokk újra elavulna.
const messagesFixtureRows = [
    { id: "m1", kind: "dunning" as const, channel: "email" as const,
      subject: "Utolsó figyelmeztetés — 3 nap múlva felfüggesztés",
      bodyText: "Tisztelt Ügyfelünk!\n\nA 2026.08.28-i esedékességű díj még nem érkezett meg.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: null,
      relatedKind: null, relatedId: null, sentAt: dt("2026-08-29"), readAt: null },
    { id: "m2", kind: "dunning" as const, channel: "sms" as const, subject: null,
      bodyText: "Citoviso: a 2026.08.28-i díj még nem érkezett meg. Rendezés: citoviso.com/admin",
      recipient: "+36 30 123 4567", attachmentName: null,
      relatedKind: null, relatedId: null, sentAt: dt("2026-08-29"), readAt: null },
    { id: "m3", kind: "invoice" as const, channel: "email" as const, subject: "Számla — OV-2026-5 (7 240 Ft)",
      bodyText: "Mellékelten küldjük a 2026.08.28.–2026.09.27. időszakra vonatkozó számlát.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: "szamla-OV-2026-5.pdf",
      relatedKind: "invoice", relatedId: "f1", sentAt: dt("2026-08-28"), readAt: dt("2026-08-28") },
    { id: "m4", kind: "site_live" as const, channel: "email" as const, subject: "Elkészült a honlapja",
      bodyText: "Gratulálunk! Honlapja elérhető a nyugalom-vendeghaz.citoviso.com címen.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: null,
      relatedKind: null, relatedId: null, sentAt: dt("2026-06-28"), readAt: dt("2026-06-28") },
    // ⚠️ A „Foglalások" téma-chip 0-t mutatott, pedig az entry-nek EGÉSZ SZAKASZA szól
    // a vendég-érdeklődésről — a súgó-kép nem mutatta azt, amit a szöveg tanít. Az új
    // darabszámok tették láthatóvá ezt a régi rést (feedback_fixture_must_prove_its_own_path).
    { id: "m5", kind: "booking" as const, channel: "email" as const,
      subject: "Foglalási érdeklődés: Tóth Márta, 2026. 09. 20.–2026. 09. 22.",
      bodyText: "Új foglalási érdeklődés érkezett az oldaláról.\n\nNév: Tóth Márta\nÉrkezés: 2026. 09. 20.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: null,
      relatedKind: "enquiry", relatedId: null, sentAt: dt("2026-08-30"), readAt: dt("2026-08-30") },
];
const messagesThreadPositions = positionThreads(messagesFixtureRows);
const messagesFixture = {
  messages: messagesFixtureRows.map((m) => ({
    ...m,
    thread: messagesThreadPositions.get(m.id)!,
  })),
  // A nav-jelvény száma is a fixture-ből SZÁMOL — a kézzel írt 2 elcsúszott volna,
  // amint a sorok listája változik, és a súgó-kép hazudna egy darabszámot.
  unread: messagesFixtureRows.filter((m) => m.readAt === null).length,
  // A jóváhagyott „A" terv három független dimenziója (2026-09-13). A számlálók a
  // fixture-ből SZÁMOLNAK, nem kézzel írt konstansok: egy kézzel beírt szám a
  // súgó-képen pontosan úgy néz ki, mint egy valódi darabszám.
  topic: "mind",
  channel: "",
  unreadOnly: false,
  q: "",
  total: messagesFixtureRows.length,
  mindCount: messagesFixtureRows.length,
  topicCounts: MESSAGE_TOPICS.reduce(
    (acc, t) => ({ ...acc, [t]: messagesFixtureRows.filter((m) => topicOfKind(m.kind) === t).length }),
    {} as Record<MessageTopic, number>,
  ),
  unreadCount: messagesFixtureRows.filter((m) => m.readAt === null).length,
  openId: null,
};

// Representative month for the booking calendar (shot-module-config minta):
// hand-blocked and portal days both present, so the legend is exercised.
function monthFixture(): MonthView {
  const month = "2026-09";
  const manual = new Set([11, 26, 27]);
  // ⛔ 2026-09-09: portál-nap NINCS a fixture-ben. A portál-naptár összekötés felülete
  // ki van kapcsolva (PORTAL_SYNC_UI = false), tehát a tulaj ilyen napot nem tud
  // előállítani — a súgó szövegéből is ezért került ki. Egy képen megmutatni olyan
  // állapotot, amit a szöveg nem magyaráz és a felhasználó nem tud létrehozni, pont az
  // a hiba, amit a tudásbázis-őr ezen a körön elkapott.
  const portal = new Set<number>();
  // A guest booking and a night held by the WHOLE place (ADR-0114): the guide has to
  // show what the owner actually meets, including the day card behind a taken night.
  const booked = new Set([12, 13]);
  const linked = new Set([19, 20]);
  const guest = {
    id: "b1",
    guestName: "Kovács Anna",
    guestEmail: "anna@example.com",
    guestPhone: "+36 30 123 4567",
    from: `${month}-12`,
    to: `${month}-14`,
    nights: 2,
    guests: 2,
    amount: "48 000 Ft",
    message: "Kutyával érkeznénk, ha lehetséges.",
    status: "accepted",
  };
  const cells = Array.from({ length: 30 }, (_, i) => {
    const dom = i + 1;
    const isPortal = portal.has(dom);
    const isBooked = booked.has(dom);
    const isLinked = linked.has(dom);
    const blocked = manual.has(dom) || isPortal || isBooked || isLinked;
    const source = isPortal
      ? ("ical" as const)
      : isBooked
        ? ("booking" as const)
        : isLinked
          ? ("linked" as const)
          : blocked
            ? ("manual" as const)
            : null;
    const detail =
      source === "booking"
        ? { kind: "booking" as const, otherUnitId: "u1", otherUnitName: "Kertre néző apartman", booking: guest }
        : source === "linked"
          ? { kind: "manual" as const, otherUnitId: "u0", otherUnitName: "A szállás egésze" }
          : source === "ical"
            ? { kind: "ical" as const, otherUnitId: "u1", provider: "Booking.com" }
            : source === "manual"
              ? { kind: "manual" as const, otherUnitId: "u1", otherUnitName: "Kertre néző apartman" }
              : null;
    return {
      day: `${month}-${String(dom).padStart(2, "0")}`,
      dom,
      blocked,
      source,
      editable: source === null || source === "manual",
      past: false,
      detail,
    };
  });
  return {
    month,
    label: "2026. szeptember",
    prevMonth: "2026-08",
    nextMonth: "2026-10",
    leadingBlanks: 1,
    cells,
    blockedCount: manual.size + portal.size + booked.size + linked.size,
    importedCount: portal.size,
  };
}

const editorUnits = [
  {
    id: "u0",
    name: "A szállás egésze",
    capacity: 6,
    description: null,
    slug: "a-szallas-egesze",
    amenities: [],
    photoCount: 0,
    isWholeProperty: true,
  },
  {
    id: "u1",
    name: "Kertre néző apartman",
    capacity: 4,
    description: "Tágas, világos apartman a kertre néző terasszal.",
    slug: "kertre-nezo-apartman",
    amenities: ["Saját fürdőszoba", "Erkély", "Klíma"],
    photoCount: 2,
  },
  {
    id: "u2",
    name: "Padlásszoba",
    capacity: 2,
    description: null,
    slug: "padlasszoba",
    amenities: [],
    photoCount: 0,
  },
];

// A Foglalások fül fixture-je. A súgó három dolgot magyaráz — döntésre váró kérés,
// elfogadott foglalás és lemondott sor —, ezért mindhárom állapot szerepel benne;
// egy csupa-pending lista pont azt nem mutatná meg, amiről az entry szól.
// A nevek/címek kitaláltak (§J: reprezentatív, sosem személyes adat).
const bookingRequestsFixture = [
  {
    id: "r1", unitName: "Padlásszoba", guestName: "Kovács Anna",
    guestEmail: "anna@example.com", guestPhone: "+36 30 123 4567",
    dateFrom: "2026-09-22", dateTo: "2026-09-24", guests: 2,
    message: "Kutyával érkeznénk, ha lehetséges.", status: "pending", token: "tok1",
    createdAt: dt("2026-09-08"), decidedAt: null, decidedBy: null, decisionNote: null,
    seen: false, quotedTotal: 48000, quotedCurrency: "HUF",
  },
  {
    id: "r2", unitName: "Kertre néző apartman", guestName: "Nagy Péter",
    guestEmail: "peter@example.com", guestPhone: null,
    dateFrom: "2026-09-12", dateTo: "2026-09-14", guests: 2,
    message: null, status: "accepted", token: "tok2",
    createdAt: dt("2026-09-05"), decidedAt: dt("2026-09-06"), decidedBy: "owner",
    decisionNote: null, seen: true, quotedTotal: 52000, quotedCurrency: "HUF",
  },
  {
    id: "r3", unitName: "Padlásszoba", guestName: "Szabó Réka",
    guestEmail: "reka@example.com", guestPhone: null,
    dateFrom: "2026-08-30", dateTo: "2026-08-31", guests: 1,
    message: null, status: "declined", token: "tok3",
    createdAt: dt("2026-08-20"), decidedAt: dt("2026-08-21"), decidedBy: "owner",
    decisionNote: "Aznap zárva tartunk.", seen: true, quotedTotal: null, quotedCurrency: null,
  },
];

const bookingsFixture = {
  units: editorUnits.map((u) => ({ id: u.id, name: u.name })),
  unitId: "u1",
  month: monthFixture(),
  // ⛔ A naptár CSUKVA: nyitva elviszi a teljes telefon-képernyőt, és a fül FŐ munkája —
  // a döntésre váró kérések és a három összegző csempe — lemarad a képről, pedig az entry
  // első két szakasza pont arról szól (tudásbázis-őr, 2026-09-09). Csukva a fejléc-sor
  // úgyis kiírja a hónap összegzését, tehát a naptár sem tűnik el nyomtalanul.
  calendarOpen: false,
  openDay: null,
  openDayBooking: null,
  panel: null,
  requests: bookingRequestsFixture,
  yearAccepted: 7,
};

// Module settings screens → the KB entry that embeds each capture.
function moduleShotHtml(entryId: string): string {
  const common = { canRestore: true, priceMonthly: 990 };
  if (entryId === "admin-modules-booking")
    return moduleSettingsSection("booking", {
      ...common,
      values: effectiveModuleConfig("booking", null, null),
      booking: {
        month: monthFixture(),
        units: editorUnits.map((u) => ({ ...u })),
        unitId: "u1",
        links: [],
        exportUrl: null,
        requests: [
          {
            id: "r1",
            unitName: "Padlásszoba",
            guestName: "Kovács Anna",
            guestEmail: "anna@example.com",
            guestPhone: "+36 30 123 4567",
            dateFrom: "2026-09-10",
            dateTo: "2026-09-12",
            guests: 2,
            message: "Kutyával érkeznénk, ha lehetséges.",
            status: "pending",
            token: "tok1",
          },
        ],
      },
    });
  if (entryId === "admin-modules-amenities")
    return moduleSettingsSection("amenities", {
      ...common,
      // A believable mid-edit state: a few picks + one free line, so the shot
      // shows checked tiles, the chip row and the Egyéb box in one screen.
      values: { items: ["Ingyenes Wi‑Fi", "Medence", "Kert", "Ingyenes parkolás", "házi szörp a teraszon"] },
    });
  if (entryId === "admin-modules-rooms")
    return moduleSettingsSection("rooms", {
      ...common,
      values: effectiveModuleConfig("rooms", null, null),
      units: editorUnits.map((u) => ({ ...u })),
      // Plan F: the screenshot must show what the entry describes — the icon
      // picker with a couple of site-wide picks inherited (greyed) on the card.
      unitAmenities: { active: true, siteSelected: ["Medence", "Ingyenes Wi‑Fi"] },
    });
  if (entryId === "admin-modules-pricing")
    return moduleSettingsSection("pricing", {
      ...common,
      values: effectiveModuleConfig("pricing", null, null),
      pricing: {
        units: editorUnits.map((u) => ({ ...u })),
        currency: "HUF",
        prices: {
          u1: [
            { id: "p1", label: "Alapár", from: null, to: null, amount: 24000, isBase: true },
            { id: "p2", label: "Főszezon", from: "06-15", to: "08-31", amount: 32000, isBase: false },
          ],
          u2: [{ id: "p3", label: "Alapár", from: null, to: null, amount: 16000, isBase: true }],
        },
      },
    });
  // Generic fields form — the hours module is the representative screen.
  return moduleSettingsSection("hours", {
    ...common,
    values: effectiveModuleConfig("hours", null, null),
  });
}

const MODULE_SHOT_ENTRIES = [
  "admin-modules-amenities",
  "admin-modules-booking",
  "admin-modules-rooms",
  "admin-modules-pricing",
  "admin-modules-settings",
] as const;

function helpFixture(topic?: string) {
  const entries = loadKbEntries().filter((e) => e.audience === "tenant");
  const open = topic ? (entries.find((e) => e.id === topic) ?? null) : null;
  // Images resolve to the repo files directly so the verification shot shows them.
  const assetBase = open
    ? `${pathToFileURL(path.join(ROOT, "kb/entries", open.id)).href}/`
    : "";
  return {
    topics: entries.map((e) => ({ id: e.id, title: e.title, snippet: e.snippet })),
    open: open
      ? { title: open.title, html: renderKbBody(open.body, assetBase), updated: open.updated }
      : null,
    query: "",
  };
}

const tmp = await mkdtemp(path.join(tmpdir(), "kbshot-"));
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});

async function shoot(
  tab: string,
  outPath: string,
  topic?: string,
  moduleSettingsHtml?: string,
  scrollTo?: string,
  /** Webcím tab fixture — adminDashboard renders the domain section from these. */
  domain?: DomainAdminData,
  /** Which cadence the Modulok tab is shot in (see subscriptionAnnualFixture). */
  sub: typeof subscriptionFixture | typeof subscriptionAnnualFixture = subscriptionFixture,
  /** Module view override — the pricing shots need OWNED modules to show a price. */
  mods: typeof modules = modules,
): Promise<void> {
  const html = adminDashboard(session, content, {
    tab,
    modules: mods,
    siteUrl: "https://nyugalom-vendeghaz.citoviso.com",
    previewToken: "demo",
    units,
    ...(moduleSettingsHtml ? { moduleSettingsHtml } : {}),
    ...(tab === "sugo" ? { help: helpFixture(topic) } : {}),
    // ADR-0084: the two document/message tabs need their own fixtures, and the
    // unread badge must show on EVERY capture — it lives in the nav, not the tab.
    ...(tab === "modulok" ? { subscription: sub } : {}),
    ...(tab === "dokumentumok" ? { documents: documentsFixture } : {}),
    ...(tab === "uzenetek" ? { messages: messagesFixture } : {}),
    ...(tab === "fiok" ? { legal: legalFixture } : {}),
    ...(domain ? { domain, domainView: {} } : {}),
    ...(tab === "forgalom" ? { traffic: trafficFixture } : {}),
    // ⛔ 2026-09-09, tudásbázis-őr lelete: a Foglalások fül képe eddig KÉZI capture volt,
    // valós teszt-tenant adataival a képre égve — és mivel semmilyen generátor nem
    // érintette, egy UI-változás SOSEM frissítette (az ADR-0114 csíkos napja már úgy
    // került a szövegbe, hogy a képen nem is látszott). ⚠️ Fixture NÉLKÜL ez a fül az
    // ÜRES állapotot fotózza („a foglalások akkor jelennek meg…"), mert a shot-tenanthoz
    // nincs bekapcsolt Foglalás modul — mérve, az első két próbálkozásomon.
    ...(tab === "foglalasok" ? { bookings: bookingsFixture } : {}),
    unreadMessages: messagesFixture.unread,
  })
    // Design core + fixture photos straight off disk instead of through the server.
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
    .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const file = path.join(tmp, `${tab}-${topic ?? "x"}-${path.basename(outPath, ".png")}.html`);
  await writeFile(file, html, "utf8");
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(300);
  // A guide image must show what its entry describes — when the subject sits
  // below the fold (the room card's amenity picker), capture THAT element:
  // deterministic, no scroll-timing races.
  if (scrollTo) {
    await mkdir(path.dirname(outPath), { recursive: true });
    // The phone layout pins the tab bar to the bottom of the viewport (.adm-side),
    // and it lies ON TOP of an element capture — on the legal panel it covered the
    // two links the guide points at. Hide it for the shot only; the panel itself is
    // captured exactly as it renders.
    await page.addStyleTag({ content: ".adm-side{display:none !important}" });
    await page.locator(scrollTo).first().screenshot({ path: outPath });
    console.log(`  ✓ ${path.relative(ROOT, outPath)} (elem: ${scrollTo})`);
    return;
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  // Viewport shot, NOT fullPage: a full-page capture paints the fixed bottom nav
  // mid-image, and the guide should show what the owner first sees on the tab.
  await page.screenshot({ path: outPath });
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

for (const [tab, entryId] of TAB_TO_ENTRY) {
  await shoot(
    tab,
    path.join(ROOT, "kb/entries", entryId, "assets", LANG, "screen.png"),
    undefined,
    undefined,
    undefined,
    undefined,
    // The modules guide is shot on an ANNUAL account so its picture shows the
    // per-module annual conversion and the annual summary it describes.
    entryId === "admin-modules" ? subscriptionAnnualFixture : subscriptionFixture,
    // Mindhárom modul-állapotot mutató entry a BIRTOKOLT készlettel: enélkül az
    // admin-subscription képén három tétel szerepelne a számlán, alatta pedig ÜRES
    // modul-lista, az Áttekintés csempéje meg „0 számlázott"-at írna. A fixture-
    // vendégház három modult vett meg — minden képnek ezt kell mondania.
    ["admin-modules", "admin-subscription", "admin-overview"].includes(entryId)
      ? modulesOwned
      : modules,
  );
}
// Két KIS kép az admin-modules ÁRAZÁS szakaszához. A fül-képe az ELSŐ képernyőt
// mutatja, az árcímke és a végösszeg viszont jóval a hajtás alatt van — a szöveg
// különben olyasmiről beszélne, amit a saját képe nem mutat meg.
// ⚠️ Az egész kártya capture-je 2000 px fölé nőtt (12 modul-sor): egy ilyen kép a
// telefonos súgóban olvashatatlan. Két szűk elem-capture helyette, éves fiókkal.
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries/admin-modules/assets", LANG, "arcimke.png"),
  undefined,
  undefined,
  ".adm-mine__row",
  undefined,
  subscriptionAnnualFixture,
  modulesOwned,
);
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries/admin-modules/assets", LANG, "arak.png"),
  undefined,
  undefined,
  ".adm-sumbar",
  undefined,
  subscriptionAnnualFixture,
  modulesOwned,
);
// ADR-0045 §J.24/§J.26: the domain entry describes the highest-stakes self-serve
// flow the tenant has (real money) and had NO image at all. The suggestion list is
// the step the entry opens with, so that is what the guide shows — rendered from the
// real view via adminDashboard's own domain opts, no view change needed.
await shoot(
  "webcim",
  path.join(ROOT, "kb/entries", "admin-domain", "assets", LANG, "screen.png"),
  undefined,
  undefined,
  // Element shot: a viewport capture cuts off the "Tovább" button and two of the
  // three availability states — the very things the entry's step 1 instructs on.
  ".adm-card",
  {
    currentHost: "nyugalom-vendeghaz.citoviso.com",
    customDomain: null,
    status: "none",
    error: null,
    failedDomain: null,
    // All three states on one image — the entry explains all three.
    suggestions: [
      { domain: "nyugalomvendeghaz.hu", availability: "probably_free" },
      { domain: "nyugalom-vendeghaz.hu", availability: "probably_free" },
      { domain: "nyugalomvendeghaz.com", availability: "taken" },
      { domain: "nyugalomvendeghaz.eu", availability: "unknown" },
    ],
    priceYearly: 9900,
    currency: "HUF",
    commitmentMonths: 24,
    mockMode: false,
  },
);
// Elem-fotó: a viewport-kép a hajtásnál elvágja az arány-mondatot és a
// hoszt-bontást — pont azt a kettőt, amit az entry elmagyaráz.
await shoot(
  "forgalom",
  path.join(ROOT, "kb/entries", "admin-traffic", "assets", LANG, "screen.png"),
  undefined,
  undefined,
  ".adm-card",
);
for (const entryId of MODULE_SHOT_ENTRIES) {
  await shoot(
    "modulok",
    path.join(ROOT, "kb/entries", entryId, "assets", LANG, "screen.png"),
    undefined,
    moduleShotHtml(entryId),
    // A foglalás-entry TÖRZSE a naptárról szól (csukható fejléc, jelvény, nap-fajták,
    // jelmagyarázat) — az viszont a hajtás ALATT van, tehát a viewport-kép semmit nem
    // mutatna belőle (tudásbázis-őr, 2026-09-08). Az elem-capture a naptár-kártyát viszi.
    entryId === "admin-modules-booking" ? "details#cit-naptar" : undefined,
  );
}
// ADR-0094 ②: the settlement page (approved plan B) — the SAME representative
// numbers the frozen plan mock uses (12/5/7 months, 8 000 floor, 20 000 buyout),
// so the guide image and the contract tell one story.
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries", "admin-settlement", "assets", LANG, "screen.png"),
  undefined,
  domainSettlementSection(
    {
      domainName: "nyugalomvendeghaz.hu",
      monthsTotal: 12,
      monthsElapsed: 5,
      monthsRemaining: 7,
      penaltyBase: 8000,
      penaltyTotal: 56000,
      buyoutPrice: 20000,
      accessEndDate: "2026-09-28",
      done: null,
      error: null,
    },
    LANG,
  ),
);
// The rooms entry's second image: the amenity picker itself, which lives below
// the fold on the room card (kb guard finding, 2026-08-26).
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries", "admin-modules-rooms", "assets", LANG, "picker.png"),
  undefined,
  moduleShotHtml("admin-modules-rooms"),
  ".ampick",
);
// Verification-only shots (mobile nav with the Súgó tab + an open guide) — CWD.
await shoot("sugo", path.join(process.cwd(), "kb-shot-sugo-list.png"));
await shoot(
  "fiok",
  path.join(ROOT, "kb/entries", "admin-legal", "assets", LANG, "screen.png"),
  undefined,
  undefined,
  "#jogi-adatok",
);

await shoot("sugo", path.join(process.cwd(), "kb-shot-sugo-open.png"), "admin-photos");

// ── Operator console screens (ADR-0045/e) ───────────────────────────────────
// The console views are pure functions too — representative fixtures, no DB, no
// login. Hungarian only: operator guides do not translate (the console renders
// Hungarian; widen when the console gets language packs).

const fc = (
  prospects: number,
  sent: number,
  opened: number,
  returned: number,
  moduleTouched: number,
  orderIntent: number,
  converted: number,
): FunnelCounts => ({
  prospects,
  sent,
  opened,
  returned,
  moduleTouched,
  orderIntent,
  converted,
  unsubscribed: 0,
  openedOfSent: opened,
  orderIntentOfSent: orderIntent,
});
const funnel: FunnelReport = {
  total: fc(24, 20, 11, 5, 4, 2, 1),
  segments: [
    { segment: "nincs_honlap", ...fc(14, 12, 8, 4, 3, 2, 1) },
    { segment: "elavult_honlap", ...fc(10, 8, 3, 1, 1, 0, 0) },
  ] as unknown as FunnelReport["segments"],
  leadTotals: { players: 419, leads: 111, mocks: 30, approved: 9 },
};

const leadRow = (
  id: string,
  name: string,
  qualification: string,
  city: string,
  photos: number,
  contact: string,
  artifact: { id: string; status: string } | null,
): LeadListRow => ({
  id,
  name,
  qualification,
  matchConfidence: 0.92,
  region: "keszthely",
  regionLabel: "Keszthely és környéke",
  regionKnown: true,
  country: "HU",
  city,
  photos,
  streetView: true,
  material: photos + 1,
  contact,
  lifecycle: "qualified",
  latestArtifact: artifact,
  outreachSentAt: artifact?.status === "approved" ? "2026-08-20T09:00:00Z" : null,
});
const leadRows: LeadListRow[] = [
  leadRow("l1", "Nyugalom Vendégház", "no_site", "Keszthely", 11, "email", {
    id: "a1",
    status: "approved",
  }),
  leadRow("l2", "Fenyves Apartman", "no_site", "Hévíz", 6, "email", {
    id: "a2",
    status: "generated",
  }),
  leadRow("l3", "Borostyán Panzió", "outdated", "Gyenesdiás", 4, "sms", null),
];
// A wider stock for the LIST shot: the entry describes a "1–50 / N sor megjelenítve"
// counter and a pager, and a 3-row fixture proves neither (tudásbázis-őr, 2026-09-11).
// Same rows, enough of them that the real LEAD_PAGE_SIZE actually pages.
const leadRowsPaged: LeadListRow[] = Array.from({ length: 64 }, (_, i) =>
  leadRow(
    `lp${i}`,
    ["Nyugalom Vendégház", "Fenyves Apartman", "Borostyán Panzió", "Tópart Villa"][i % 4]!,
    i % 3 === 2 ? "outdated" : "no_site",
    ["Keszthely", "Hévíz", "Gyenesdiás", "Vonyarcvashegy"][i % 4]!,
    i % 5,
    ["email", "sms", "voice"][i % 3]!,
    i % 7 === 0 ? { id: `ap${i}`, status: "approved" } : null,
  ),
);

const leadDetail: LeadDetail = {
  id: "l1",
  name: "Nyugalom Vendégház",
  qualification: "no_site",
  lifecycle: "qualified",
  matchConfidence: 0.92,
  address: "Keszthely, Fő út 12.",
  region: "keszthely",
  raw: {
    country: "HU",
    city: "Keszthely",
    phone: "+36 30 123 4567",
    email: "info@example.com",
  },
  provenance: [
    { field: "name", value: "Nyugalom Vendégház", source: "google_places", confidence: 0.95 },
    { field: "phone", value: "+36 30 123 4567", source: "web_search", confidence: 0.8 },
  ],
  artifacts: [
    {
      id: "a1",
      status: "approved",
      path: "sites/mock/a1/index.html",
      // Representative generation snapshot so the KB shot shows the copy panel
      // AND the "Honnan tudjuk?" source panel (ADR-0106 ⑥) as the operator sees them.
      inputs: {
        template: "fullbleed-glass",
        lang: "hu",
        recipe: {
          sections: [
            { kind: "hero", copy: { lead: "Medence és szauna a csendes kertben" } },
          ],
        },
        siteData: {
          tagline: "Keszthely szívében, mégis nyugalomban",
          intro:
            "A Nyugalom Vendégház zárt kertjében medence és szauna várja a pihenni vágyókat. " +
            "A vendégek visszatérően dicsérik a házigazda kedvességét.",
          highlights: ["Kültéri medence", "Szauna", "Zárt parkoló"],
        },
        marketFactsNamed: ["Medence", "Szauna", "Zárt parkoló"],
        marketMissed: ["kerti grillező"],
        marketAmenityTotal: 6,
        factUnsourced: [],
        sourcePanel: {
          portals: [{ host: "szallasok.hu", band: "high", amenities: 18, photos: 9, descChars: 1240 }],
          guestReviews: { count: 4, sources: ["google_places"] },
          ownerIntro: false,
          photosByProvenance: { portal: 9, places: 3 },
          facts: [
            {
              label: "medence",
              source: "szallasok.hu",
              quote: "a kertben medence és szauna várja vendégeinket",
            },
            {
              label: "szauna",
              source: "szallasok.hu",
              quote: "a kertben medence és szauna várja vendégeinket",
            },
            {
              label: "házigazda kedvessége",
              source: "google_places",
              quote: "a házigazda kedvessége tette igazán különlegessé az ott töltött hétvégét",
            },
            { label: "zárt parkoló", source: "szallasok.hu" },
          ],
        },
      },
      generatedAt: "2026-08-20T08:30:00Z",
      decisions: [
        {
          decision: "approve",
          notes: "Rendben, mehet.",
          decidedBy: "olaszferenc",
          decidedAt: "2026-08-20T09:00:00Z",
        },
      ],
    },
  ],
};

const huPricing: PricingSnapshot = {
  region: "hu",
  currency: "HUF",
  baseMonthly: 4990,
  annualFreeMonths: 2,
  customDomainYearly: 9900,
  domainMaxPriceEur: 15,
  domainMinCommitmentMonths: 12,
  domainFreeMinMonthly: 8000,
  domainBuyoutPrice: 20000,
  pricingConfirmed: true,
  modulePrices: new Map([["booking", 990]]),
};
const globalPricing: PricingSnapshot = { ...huPricing, region: "global", currency: "EUR", baseMonthly: 10, customDomainYearly: 25 };

const scrapeIdle = {
  running: false,
  regionId: null,
  cap: null,
  startedAt: null,
  finishedAt: new Date("2026-08-20T10:00:00Z"),
  exitCode: 0,
  log: ["[scrape] keszthely — 111 szereplő, 42 új lead", "[scrape] kész (exit 0)"],
};
const scrapeRuns = [
  {
    id: "r1",
    regionLabel: "Keszthely és környéke",
    status: "completed",
    startedAt: new Date("2026-08-20T09:00:00Z"),
    finishedAt: new Date("2026-08-20T10:00:00Z"),
    stats: { players: 111, leads: 42 },
    error: null,
  },
];

const dupClusters = [
  {
    id: "c1",
    signals: ["phone", "proximity"],
    maxDistanceM: 120,
    pairs: [{ a: "l1", b: "l4" }],
    leads: [
      {
        id: "l1",
        name: "Nyugalom Vendégház",
        city: "Keszthely",
        qualification: "no_site",
        email: "info@example.com",
        phone: "+36 30 123 4567",
        website: null,
      },
      {
        id: "l4",
        name: "Nyugalom Apartman",
        city: "Keszthely",
        qualification: "no_site",
        email: null,
        phone: "+36 30 123 4567",
        website: null,
      },
    ],
  },
];

/**
 * Console page HTML → 390px viewport capture (same pipeline as the admin shots).
 *
 * Two ways to capture below the fold, because two entries need it:
 *  - `hash` — navigate to an anchor first (ADR-0106: the lead page's tab switcher
 *    activates the addressed tab, and the source panel lives on the mocks tab).
 *  - `scrollTo` — capture THAT element instead of the viewport. The pricing screen
 *    needs it: the module-sales switches sit under the price fields, so a viewport
 *    shot ends at the domain block and the guide image would show none of what its
 *    text describes (found by the tudásbázis-őr, 2026-09-07).
 */
async function shootConsole(
  html: string,
  outPath: string,
  hash?: string,
  scrollTo?: string,
): Promise<void> {
  const patched = html
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
    .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const file = path.join(tmp, `con-${path.basename(outPath, ".png")}.html`);
  await writeFile(file, patched, "utf8");
  // Optional #hash: the lead page's tab switcher activates the addressed tab,
  // and the shot scrolls the addressed element into view — the KB captures are
  // viewport-height, so without the scroll the panel below the fold is missed
  // (ADR-0106: the source panel lives on the mocks tab).
  await page.goto(pathToFileURL(file).href + (hash ?? ""));
  await page.waitForTimeout(300);
  await mkdir(path.dirname(outPath), { recursive: true });
  if (hash === "#ls-mocks") {
    // The source panel sits below the fold on the mocks tab — an ELEMENT shot
    // captures exactly the panel. The sticky topbar/tab-bar would overlay the
    // capture region mid-panel, so they are hidden for this one shot.
    await page.addStyleTag({ content: ".con-top,.con-ltabs__bar{visibility:hidden}" });
    await page.locator("#sp-panel").screenshot({ path: outPath });
  } else if (scrollTo) {
    await page.locator(scrollTo).first().screenshot({ path: outPath });
    console.log(`  ✓ ${path.relative(ROOT, outPath)} (elem: ${scrollTo})`);
    return;
  } else {
    await page.screenshot({ path: outPath });
  }
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

const conOut = (entryId: string): string =>
  path.join(ROOT, "kb/entries", entryId, "assets", "hu", "screen.png");
// Finance chips/hub counters (the dashboard is a hub since the 2026-08-23 redesign).
const finCounts = { docs: 12, open: 3, overdue: 1, partners: 7 };
// ADR-0102: the sales badge and the per-module switches must be VISIBLE in the guide
// images — captures taken with the defaults show the feature as if it did not exist,
// and the entry that describes it would point at a picture without it. The fixtures
// mirror the seed (the e-mail module is not sellable) plus a couple of live
// subscriptions, so the "N élő" chip that warns before switching a module off shows too.
const salesDisabled = new Set(["email"]);
const salesLive = new Map([
  ["booking", 3],
  ["gallery", 7],
]);
await shootConsole(
  dashboardPage(funnel, false, "Ferenc", finCounts, { on: 13, all: 14 }),
  conOut("console-dashboard"),
);
// The handbook's shot must show the list as the operator MEETS it: the default
// filter in force, so the named counts and the honest "Anyag: legalább 1" line are
// on the picture the entry refers to.
await shootConsole(
  leadsPage(buildLeadListResult(leadRowsPaged, defaultLeadQuery()), defaultLeadQuery()),
  conOut("console-leads"),
);
// The pager and the legend sit BELOW a 50-row table, so a viewport shot never reaches
// them. Element captures, so the entry's claims about both have a picture behind them.
await shootConsole(
  leadsPage(buildLeadListResult(leadRowsPaged, defaultLeadQuery()), defaultLeadQuery()),
  path.join(ROOT, "kb/entries", "console-leads", "assets", "hu", "pager.png"),
  undefined,
  ".con-pager",
);
await shootConsole(
  leadsPage(buildLeadListResult(leadRowsPaged, { ...defaultLeadQuery(), pageSize: 0 }), {
    ...defaultLeadQuery(),
    pageSize: 0,
  }).replace('<details class="con-legend">', '<details class="con-legend" open>'),
  path.join(ROOT, "kb/entries", "console-leads", "assets", "hu", "legend.png"),
  undefined,
  ".con-legend",
);
await shootConsole(leadPage(leadDetail), conOut("console-lead"));
// The "Honnan tudjuk?" source panel (ADR-0106 ⑥) sits on the mocks tab — its own
// capture, referenced by the entry's dedicated section.
await shootConsole(
  leadPage(leadDetail),
  path.join(ROOT, "kb/entries", "console-lead", "assets", "hu", "source-panel.png"),
  "#ls-mocks",
);
await shootConsole(
  scrapePage(scrapeIdle, scrapeRuns, [{ id: "keszthely", label: "Keszthely és környéke" }]),
  conOut("console-scrape"),
);
await shootConsole(duplicatesPage(dupClusters), conOut("console-duplicates"));
await shootConsole(reportPage(funnel), conOut("console-report"));
// The entry documents the sales switches, so the image must SHOW them: capture the
// panel element, not the viewport that stops above the module grid.
await shootConsole(
  pricingPage(huPricing, [huPricing, globalPricing], null, salesDisabled, salesLive),
  conOut("console-pricing"),
  undefined,
  ".panel",
);
await shootConsole(
  settingsPage({ username: "olaszferenc", displayName: "Olasz Ferenc", role: "admin" }),
  conOut("console-settings"),
);
// ADR-0111 markets panel. The fixture deliberately shows BOTH states — an open home
// market with its decision line, and a closed one with the (collapsed) opening form —
// because the guide explains exactly that difference.
await shootConsole(
  settingsPage(
    { username: "olaszferenc", displayName: "Olasz Ferenc", role: "admin" },
    null,
    { phone: "", email: "", envPhone: "" },
    null,
    [
      {
        country: "HU",
        approved: true,
        approvedBy: "system",
        approvedAt: new Date("2026-09-08T10:04:00Z"),
        note: "Hazai piac: a teljes jogi csomag magyar jogra készült.",
        home: true,
        log: [],
      },
      {
        country: "AT",
        approved: false,
        approvedBy: null,
        approvedAt: null,
        note: null,
        home: false,
        log: [
          {
            action: "revoke",
            actor: "olaszferenc",
            reason: "osztrák jogi csomag felülvizsgálat alatt",
            at: new Date("2026-09-08T09:30:00Z"),
          },
        ],
      },
    ],
    null,
  ),
  conOut("console-markets"),
  undefined,
  ".panel:nth-of-type(3)",
);
// Test-log journal — rendered from the real FK-000 smoke scenario so the guide
// image regenerates together with the scenario it documents.
{
  const fk000 = findScenario("FK-000");
  if (!fk000) throw new Error("kb-shot: FK-000 hiányzik (elek/scenarios)");
  await shootConsole(
    testLogPage(fk000, {
      currentUser: "olaszferenc",
      viewUser: null,
      save: {
        user: "olaszferenc",
        fkId: fk000.id,
        ts: "2026-09-04T10:12:00.000Z",
        checks: [true, true, false, false, false],
        comments: ["", "A leadek lista rendben; a súgót még nem néztem."],
        summary: "",
      },
      saves: [{ user: "olaszferenc", ts: "2026-09-04T10:12:00.000Z", done: 2, total: 5 }],
    }),
    conOut("console-test-log"),
  );
}
// Outreach draft screen (§C gate + channel picker) — the workflow's legal gate.
await shootConsole(
  outreachDraftPage(
    "p1",
    { leadName: "Nyugalom Vendégház", segment: "nincs_honlap" },
    {
      subject: "Elkészítettük a vendégháza honlap-tervét",
      body:
        "Kedves Vendéglátó!\n\nElkészítettük a Nyugalom Vendégház honlap-tervét — " +
        "egy kattintással megnézheti: https://citoviso.com/p/demo\n\nÜdvözlettel,\nCitoviso",
      link: "https://citoviso.com/p/demo",
    },
    { verdict: "PASS", reasons: [] },
    "info@example.com",
    null,
    {
      sms: { text: "Elkészítettük a honlap-tervét: https://citoviso.com/p/demo — Citoviso" },
      phone: "+36 30 123 4567",
    },
    "l1",
  ),
  conOut("console-outreach-draft"),
);
// Verification-only: the console Súgó page itself (list state) — CWD.
await shootConsole(
  helpPage({
    operatorTopics: [
      { id: "console-lead", title: "Lead-lap — a munkafolyamat", snippet: "Mock-generálás, kuráció, megkeresés, konverzió" },
    ],
    tenantTopics: [
      { id: "admin-photos", title: "Fotók kezelése — feltöltés, sorrend, nyitókép", snippet: "Saját fotók, sorrend, képaláírás" },
    ],
    open: null,
    query: "",
  }),
  path.join(process.cwd(), "kb-shot-console-help.png"),
);

await browser.close();
console.log(`kb-shot: kész (${LANG})`);
