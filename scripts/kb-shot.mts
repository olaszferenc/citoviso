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
//   npx tsx scripts/kb-shot.mts --self-test   # csak az ÉP-ŐR piros próbája, NEM fényképez
//
// ⛔ ÉP-ŐR (2026-09-15, tudásbázis-őr verdikt). Ez a szkript NÉMÁN ki tudta ürí­teni egy
// súgó-kép tartalmát: a `legend.png` 640×2020 / 305 kB-ról 640×126 / 12 kB-ra esett, vagyis
// a teljes oszlop-magyarázat kiesett a súgóból, miközben a képaláírás továbbra is azt írta,
// hogy „a jelmagyarázat kinyitva". Sem a `kb-check`, sem a `kb-freshness` nem fogta meg:
// EGYIK SEM NÉZI, VAN-E TARTALOM A KÉPEN. Ezért minden felvétel után összevetjük a kép
// magasságát az ELŐZŐ változatéval, és a beomlás PIROS.

import { chromium } from "playwright-core";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import {
  adminDashboard,
  domainSettlementSection,
  type MultilangAdminData,
} from "../src/server/adminViews.js";
import { multilangCatalogView } from "../src/tenant/multilangCard.js";
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
import { isUnread } from "../src/tenant/messages.js";
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
  // ⛔ A TERMÉK predikátumával (isUnread), nem egy másolatával: a túlhaladott sor
  // 2026-09-14 óta NEM olvasatlan, és egy súgó-kép, ami a régi szabállyal számol,
  // pont azt a számot tanítaná meg, amit épp javítottunk (kontraktus ②).
  unread: messagesFixtureRows.filter((m) => isUnread(m, messagesThreadPositions.get(m.id))).length,
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
  channelCounts: {
    email: messagesFixtureRows.filter((m) => m.channel === "email").length,
    sms: messagesFixtureRows.filter((m) => m.channel === "sms").length,
  },
  unreadCount: messagesFixtureRows.filter((m) => isUnread(m, messagesThreadPositions.get(m.id))).length,
  openId: null,
  openThreads: [],
  confirmRead: false,
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
    // ADR-0198: a szoba-szerkesztő a HOZZÁRENDELT képekből és a BORÍTÓBÓL dolgozik —
    // a fixture ugyanazt mondja, amit a fenti `content.photos` (egy kép tartozik ide,
    // a másik kettő a képtárban halványan áll). Egy kitalált darabszám itt épp azt a
    // képet adná, amit a termék nem tud előállítani.
    photoCount: 1,
    photoUrls: ["/assets/ui/tpl-organic.jpg"],
    coverUrl: "/assets/ui/tpl-organic.jpg",
  },
  {
    id: "u2",
    name: "Padlásszoba",
    capacity: 2,
    description: null,
    slug: "padlasszoba",
    amenities: [],
    photoCount: 1,
    photoUrls: ["/assets/ui/tpl-watercolor.jpg"],
    coverUrl: "/assets/ui/tpl-watercolor.jpg",
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
      // ADR-0198: a KÖZÖS képtár a szerkesztő magja — e nélkül a felugró Képek füle
      // „még nincs kép"-et mutatna, miközben a szócikk a képtárról beszél.
      photoLibrary: (content.photos ?? []) as never,
      // A második kép tárgya: a NYITOTT felugró Képek füle (a `:target` a hash-ből jön).
      roomsView: { openUnitId: "u1", tab: "kep" },
    });
  if (entryId === "admin-modules-pricing")
    return moduleSettingsSection("pricing", {
      ...common,
      values: effectiveModuleConfig("pricing", null, null),
      pricing: {
        units: editorUnits.map((u) => ({ ...u })),
        currency: "HUF",
        // Said out loud: the screen differs with and without booking, and scripts/ is not
        // type-checked, so a missing field would silently shoot the no-booking state.
        bookingActive: true,
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


// ─────────────────────────────────────────────────────────────────────────────
// ÉP-ŐR: egy súgó-kép ne tudjon NÉMÁN kiürülni
// ─────────────────────────────────────────────────────────────────────────────

/** PNG méret az IHDR-ből (a 16–24. bájt), fájl-olvasás nélküli dekódolás helyett. */
async function pngSize(file: string): Promise<{ w: number; h: number } | null> {
  try {
    const buf = await readFile(file);
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/**
 * Beomlott-e a kép? ⚠️ KÜLÖN FÜGGVÉNY, hogy a `--self-test` MEG TUDJA SZÓLALTATNI a
 * szkript lefényképezése nélkül — egy őr, amit sosem láttunk pirosan, nem bizonyíték.
 *
 * A küszöb NEM „bármilyen csökkenés": egy súgó-kép jogosan rövidül, ha egy sor kikerül a
 * felületről. A NAGYSÁGRENDI esés az, ami tartalom-vesztést jelent — a mért valódi hiba
 * 2020 → 126 px volt (6 %). Ezért: az új magasság a régi HARMADA alatt van, ÉS a régi kép
 * érdemi magasságú volt (különben egy 30 px-es csík 10 px-re zsugorodása is riasztana).
 */
export function captureCollapsed(
  prev: { w: number; h: number } | null,
  next: { w: number; h: number } | null,
): boolean {
  if (!prev || !next) return false;
  return prev.h >= 300 && next.h * 3 < prev.h;
}

interface CaptureStat {
  readonly rel: string;
  readonly prev: { w: number; h: number } | null;
  readonly next: { w: number; h: number } | null;
}
const captures: CaptureStat[] = [];

/**
 * MINDEN felvétel ezen az egy úton megy ki — ez a lényeg. Ha a hat `screenshot()`
 * hívóhely külön-külön írna, egy új hívóhely NÉMÁN kimaradna az ellenőrzésből
 * (`feedback_narrow_recognizer_is_a_false_green`), és a záró összesítő zölden hallgatna.
 */
async function snap(
  target: { screenshot(o: { path: string }): Promise<Buffer> },
  outPath: string,
): Promise<void> {
  const prev = await pngSize(outPath);
  await target.screenshot({ path: outPath });
  const next = await pngSize(outPath);
  captures.push({ rel: path.relative(ROOT, outPath), prev, next });
}

// ── --self-test: az ÉP-ŐR piros próbája, fényképezés NÉLKÜL ─────────────────
// Egy őr, amit sosem láttunk pirosan, nem bizonyíték. A teljes kb-shot-futás ehhez
// túl drága (böngésző + ~40 felvétel), ezért a PREDIKÁTUMOT szólaltatjuk meg —
// és pozitív kontroll is van, hogy a „nem omlott be" ág se legyen vakon zöld.
if (process.argv.includes("--self-test")) {
  const cases: ReadonlyArray<{ why: string; prev: { w: number; h: number } | null; next: { w: number; h: number } | null; want: boolean }> = [
    { why: "A VALÓDI hiba: legend.png 2020 → 126 px", prev: { w: 640, h: 2020 }, next: { w: 640, h: 126 }, want: true },
    { why: "beomlás a küszöb alatt (900 → 200)", prev: { w: 640, h: 900 }, next: { w: 640, h: 200 }, want: true },
    { why: "jogos rövidülés (egy sor kikerült): 2020 → 1800", prev: { w: 640, h: 2020 }, next: { w: 640, h: 1800 }, want: false },
    { why: "határeset: pont a harmada, tehát MÉG nem beomlás", prev: { w: 640, h: 900 }, next: { w: 640, h: 300 }, want: false },
    { why: "eleve apró csík zsugorodása nem riaszt (200 → 10)", prev: { w: 640, h: 200 }, next: { w: 640, h: 10 }, want: false },
    { why: "nincs előző kép → nincs mihez mérni", prev: null, next: { w: 640, h: 126 }, want: false },
    { why: "olvashatatlan új kép → nem ez a szabály dolga", prev: { w: 640, h: 2020 }, next: null, want: false },
  ];
  let bad = 0;
  for (const c of cases) {
    const got = captureCollapsed(c.prev, c.next);
    const ok = got === c.want;
    if (!ok) bad++;
    console.log(`  ${ok ? "✅" : "⛔"} ${c.why} → ${got ? "BEOMLOTT" : "rendben"} (várt: ${c.want ? "BEOMLOTT" : "rendben"})`);
  }
  // ⚠️ Nem elég, hogy „minden eset stimmel": ha a predikátum MINDIG false-t adna, a
  // negatív esetek zöldek lennének, és a zöld összesítő elfedné a halott szabályt.
  const firedCount = cases.filter((c) => c.want).length;
  if (!firedCount) {
    console.error("⛔ önteszt: egyetlen PIROS esetet sem tűztünk ki — ez nem próba.");
    process.exit(1);
  }
  if (bad) {
    console.error(`\n❌ kb-shot ép-őr önteszt: ${bad} eset nem a várt eredményt adta.`);
    process.exit(1);
  }
  // ── SZERKEZETI PRÓBA: elkerülheti-e VALAKI az ép-őrt? ─────────────────────
  // ⛔ A predikátum hibátlansága semmit nem ér, ha egy ÚJ felvételi hívóhely megkerüli.
  // Ezért a szkript a SAJÁT forrását méri: pontosan EGY `screenshot({ path: … })`
  // hívás létezhet, és annak a `snap()`-en belül kell lennie. Ez az az állítás, ami a
  // „minden kép ellenőrizve" mondatot igazzá teszi (`feedback_narrow_recognizer_is_a_false_green`).
  const src = await readFile(new URL(import.meta.url), "utf8");
  const sites = [...src.matchAll(/\.screenshot\(\{\s*path:/g)].length;
  const insideSnap = /async function snap\([\s\S]*?await target\.screenshot\(\{ path: outPath \}\);/.test(src);
  if (sites !== 1 || !insideSnap) {
    console.error(
      `\n❌ SZERKEZETI BUKÁS: ${sites} db screenshot-hívóhely van (várt: 1, a snap()-ben; ` +
        `snap-en belül: ${insideSnap}). Egy új felvételi út MEGKERÜLNÉ az ép-őrt, és a ` +
        `záró „egyetlen kép sem omlott be" sor hazudna.`,
    );
    process.exit(1);
  }
  console.log(`  ✅ szerkezeti próba: mind a felvétel EGYETLEN úton megy ki (snap()).`);

  console.log(
    `\n✅ kb-shot ép-őr önteszt: ${cases.length} eset, ebből ${firedCount} PIROSRA ment — ` +
      `a szabály képes megszólalni, a jogos rövidülést átengedi, és a felvételi út nem kerülhető meg.`,
  );
  console.log("ℹ️ Az önteszt NEM fényképezett — a súgó-képek érintetlenek.");
  process.exit(0);
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
  /** Multilang card fixture — the ADR-0128 tier card is shot from this. */
  multilang?: MultilangAdminData,
  /** Element capture with the card's sticky price bar unpinned (see below). */
  viewportAt?: string,
  /** ADR-0198: a szoba-szerkesztő felugrója `:target`-tel nyílik (nulla JS), tehát a
   *  KÉP is a valódi úton készül — a horgonnyal együtt töltjük be a lapot. */
  hash?: string,
): Promise<void> {
  const html = adminDashboard(session, content, {
    ...(multilang ? { multilang } : {}),
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
    // Az Áttekintés súgója a „kifizette, de üres" teendő-sorról is beszél, ezért a
    // KÉPNEK tartalmaznia kell egyet — különben a szöveg olyasmit magyaráz, amit a
    // saját képe nem mutat (ez a hibaosztály vitte el a lapozós súgó-képet is).
    // Az előfizetés is kell hozzá: a sor a fiók ütemében árazza a modult.
    // ⚠️ `rooms`, mert a fixtúra-vendégház ÉPP EZT birtokolja (OWNED_IN_SHOT) ÉS
    // üresíthető. Egy nem-birtokolt modul (pl. poi) üres listát adott volna, és a
    // kép változatlan maradt volna — mérve: 0 px magasság-növekmény, miközben a
    // szöveg már a sorról beszélt.
    ...(tab === "attekintes"
      ? { subscription: sub, paidEmpty: mods.modules.filter((m) => m.id === "rooms") }
      : {}),
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
  await page.goto(pathToFileURL(file).href + (hash ?? ""));
  await page.waitForTimeout(300);
  // A guide image must show what its entry describes — when the subject sits
  // below the fold (the room card's amenity picker), capture THAT element:
  // deterministic, no scroll-timing races.
  // ⚠️ STICKY ELEM MELLETT AZ ELEM-CAPTURE HAZUDIK (2026-09-13): a Többnyelvű kártya
  // mobil ár-sávja `position:sticky;bottom:0`, és egy nála magasabb elem capture-jén a
  // capture aljára tapad — vagyis a kép KÖZEPÉRE, a nyelv-rácsot átvágva, ahol a
  // valóságban soha nincs. Görgetés + viewport-kép sem jó (mérve: a kártya teteje kilóg,
  // az alsó fül-nav elviszi a kép harmadát). A hű megoldás: elem-capture a TELJES
  // kártyáról, a sáv pinelése feloldva — így az a kártya alján, a természetes helyén
  // jelenik meg, a tapadást pedig az entry szövege mondja el.
  if (viewportAt) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await page.addStyleTag({
      content: ".adm-side{display:none !important}.adm-mlbar{position:static !important;margin:0 0 14px !important}",
    });
    await snap(page.locator(viewportAt).first(), outPath);
    console.log(`  ✓ ${path.relative(ROOT, outPath)} (elem, sticky feloldva: ${viewportAt})`);
    return;
  }
  if (scrollTo) {
    await mkdir(path.dirname(outPath), { recursive: true });
    // The phone layout pins the tab bar to the bottom of the viewport (.adm-side),
    // and it lies ON TOP of an element capture — on the legal panel it covered the
    // two links the guide points at. Hide it for the shot only; the panel itself is
    // captured exactly as it renders.
    await page.addStyleTag({ content: ".adm-side{display:none !important}" });
    await snap(page.locator(scrollTo).first(), outPath);
    console.log(`  ✓ ${path.relative(ROOT, outPath)} (elem: ${scrollTo})`);
    return;
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  // Viewport shot, NOT fullPage: a full-page capture paints the fixed bottom nav
  // mid-image, and the guide should show what the owner first sees on the tab.
  await snap(page, outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

for (const [tab, entryId] of TAB_TO_ENTRY) {
  await shoot(
    tab,
    path.join(ROOT, "kb/entries", entryId, "assets", LANG, "screen.png"),
    undefined,
    undefined,
    // ⛔ Az Áttekintés KÁRTYÁT lőjük, nem a viewportot: a „kifizette, de üres" teendő-sor
    // magasabb a többinél (ár + magyarázat + két gomb), és 390×844-en a fix alsó navigáció
    // GLIFÁK KÖZEPÉN vágta ketté — a magyarázó mondat és MINDKÉT gomb lemaradt a képről,
    // miközben a szócikk épp azokon vezeti végig a tulajt (tudásbázis-őr verdikt,
    // 2026-09-21: „a kép nem mutatja, amit a szöveg magyaráz").
    // ⚠️ `.adm-card` — MÉRT kompromisszum, nem hanyagság. A 390×844 viewport a
    // „kifizette, de üres" sort glifák közepén vágta ketté (a magyarázat és mindkét
    // gomb lemaradt). A befoglaló `.adm-main__inner` visszahozná a lap fejlécét is, de
    // MÉRVE 2344 px magas — a szkript saját szabálya szerint 2000 px fölött a kép a
    // telefonos súgóban olvashatatlan. A kártya 1644 px, és a szakasz tárgya — a teljes
    // teendő-sor — hiánytalanul rajta van; a fejléc „Oldal megtekintése" gombját a
    // szócikk szövege helyezi el („a lap tetején lévő").
    entryId === "admin-overview" ? ".adm-card" : undefined,
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
// ADR-0128 / tudásbázis-őr lelete (2026-09-13): a Többnyelvű kártya három sávra épült át
// (sáv-dobozok, régió-fejlécek zászlós csempékkel, sapka-sor, tapadó mobil ár-sáv), az
// entry viszont NULLA képet viselt — pont annál a vásárlásnál, ami 30 000 Ft-ig mér. A
// kép ELEM-capture a kártyára (`#tobbnyelvu`): a viewport-kép a modul-kapcsolók listáját
// fotózná, a kártya ugyanis a fül alján ül.
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries", "admin-multilang", "assets", LANG, "screen.png"),
  undefined,
  undefined,
  undefined,
  undefined,
  subscriptionFixture,
  modules,
  {
    // MÉG NEM VETT állapot: ezt írja le az entry 1-2. lépése (sáv-választás + pipálás).
    // A `multilangCatalogView` a VALÓDI katalógusból épít (29 nyelv, régiók, sávok) —
    // fixture-be másolt nyelvlista némán elavulna a következő bővítésnél.
    ...multilangCatalogView(LANG),
    price: 14900,
    count: 3,
    primaryLangName: "magyar",
    state: null,
    generating: false,
    failedError: null,
    langUrls: [],
  },
  "#tobbnyelvu",
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
    entryId === "admin-modules-booking"
      ? "details#cit-naptar"
      : // ADR-0198: a szoba-entry TÁRGYA a kártyarács, az pedig a 390×844 viewport
        // HAJTÁSA ALATT kezdődik (a modul-fejléc és a magyarázó sáv fölötte ül) —
        // mérve: a viewport-képen egyetlen szoba-kártya sem látszott egészben.
        entryId === "admin-modules-rooms"
        ? ".rs-wrap"
        : undefined,
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
// ADR-0198 — a szoba-entry MÁSODIK képe: a megnyitott szerkesztő „Képek" füle, mert a
// szócikk törzse a borítóképről, a feltöltésről és a közös képtárról szól, az pedig a
// rácsról készült képen egyáltalán nem látszik (a felugró alapból csukva van).
// A felugró `:target`-tel nyílik → a kép a VALÓDI úton készül, a horgonnyal.
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries", "admin-modules-rooms", "assets", LANG, "picker.png"),
  undefined,
  moduleShotHtml("admin-modules-rooms"),
  // ⚠️ A felugróból HÁROM van a lapon (egy egységenként), és csak a megcélzott
  // látszik — a puszta `.rs-pop` az ELSŐT (a rejtettet) fogná meg, és a kép 30 mp
  // után némán elhasalna.
  "#szoba-u1 .rs-pop",
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  "#szoba-u1",
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
  // A FELMÉRVE oszlop a lista rendezésének alapja („legutóbb felmért elöl"), ezért a
  // fixture NEM adhat minden sorra azonos dátumot: a képen épp az a bizonyítandó, hogy
  // a sorrend látszik. Az id-ből származtatjuk, hogy stabil legyen (se Date.now, se
  // véletlen — a kép reprodukálható), és mégis szóródjon.
  surveyedAt: `2026-09-${String(4 + (id.charCodeAt(id.length - 1) % 9)).padStart(2, "0")}T08:00:00Z`,
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
// A wider stock for the LIST shot: a 3-row fixture proves nothing about a list that shows
// EVERY record in one scrolling table (ADR-0188) — the shot has to look like the real thing
// the entry talks about (tudásbázis-őr, 2026-09-11).
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
// A futás-lista NÉGY történetet tud elmondani (fut · lefutott · megszakadt ·
// hibára futott), és a súgó mind a négyet magyarázza — ezért a KÉP is mutassa
// mindet. Egy csak-„completed" fixture olyan képet adna, amin a leírás fele nem
// látszik (§J: a súgó a valós gombfeliratokkal vezessen).
const scrapeRuns = [
  {
    id: "r0",
    regionLabel: "Balaton-Kelet",
    status: "running",
    startedAt: new Date("2026-08-21T06:40:00Z"),
    finishedAt: null,
    heartbeatAt: new Date("2026-08-21T06:47:30Z"),
    stats: {
      phase: 'Presence-check: verifying 13 "no own site" leads (domain-guess + geo-verify)…',
    },
    error: null,
  },
  {
    id: "r1",
    regionLabel: "Keszthely és környéke",
    status: "completed",
    startedAt: new Date("2026-08-20T09:00:00Z"),
    finishedAt: new Date("2026-08-20T10:00:00Z"),
    heartbeatAt: new Date("2026-08-20T10:00:00Z"),
    stats: { players: 111, leads: 42 },
    error: null,
  },
  {
    id: "r2",
    regionLabel: "Badacsony",
    status: "failed",
    startedAt: new Date("2026-08-19T08:49:59Z"),
    finishedAt: new Date("2026-08-19T08:52:53Z"),
    heartbeatAt: new Date("2026-08-19T08:52:00Z"),
    stats: { interrupted: true, phase: "Portál-adatlapok olvasása…" },
    // A szöveg SZÓ SZERINT az, amit a reaper ír (persist.ts) — az időpont is az
    // operátor óráján, mint a felette lévő „Indult" cella. Egy fixture, ami más
    // formátumot mutat, a súgóban HAMIS képet ad a termékről.
    error:
      "Megszakadt — A futás 2026. 08. 19. 10:52:00 óta nem adott életjelet, ezért nem fut " +
      "tovább. Ez akkor következik be, ha a folyamatot kívülről állítják le: a scrape a konzol " +
      "gyerekfolyamata, így a konzol újraindítása (deploy, összeomlás, szerver-újraindítás) " +
      "magával viszi. Utolsó fázis: Portál-adatlapok olvasása…",
  },
  {
    id: "r3",
    regionLabel: "Tihany",
    status: "failed",
    startedAt: new Date("2026-08-18T07:10:00Z"),
    finishedAt: new Date("2026-08-18T07:11:20Z"),
    heartbeatAt: new Date("2026-08-18T07:11:20Z"),
    stats: {},
    error: "Places API 403 PERMISSION_DENIED — a kulcs nem jogosult a Places hívásra.",
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
  /**
   * KATTINTS erre a vezérlőre a KÉP ELŐTT — és a felvétel csak akkor készül el, ha a
   * felugró tényleg megnyílt.
   *
   * ⛔ MÉRT HIBA (2026-09-15): a `legend.png` a CSUKOTT sávot mutatta, és a teljes
   * oszlop-magyarázat némán kiesett a súgóból — miközben a képaláírás azt írja, hogy „a
   * jelmagyarázat kinyitva". A régi megoldás a SZERVER HTML-jében cserélt sztringet,
   * ami némán nem illeszkedett; a rákövetkező a DOM-on állított `open` attribútumot,
   * ami viszont a gomb megkerülésével hazudhat: egy elromlott nyitó-gomb mellett is
   * szép képet adott volna.
   *
   * ADR-0188 óta a jelmagyarázat FELUGRÓ, a nyitás pedig JS-t futtat — ezért a kép a
   * VALÓDI úton készül: rákattintunk a „?" gombra, mint az operátor. Ha a gomb nem nyit,
   * a felvétel HANGOSAN elhasal, nem üres képet ad.
   */
  clickToOpen?: string,
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
  if (clickToOpen) {
    const btn = page.locator(clickToOpen).first();
    if ((await btn.count()) === 0) {
      throw new Error(
        `kb-shot: a(z) "${clickToOpen}" nyitó-vezérlő NINCS a lapon a(z) ` +
          `${path.relative(ROOT, outPath)} felvételéhez — elavult szelektor?`,
      );
    }
    await btn.click();
    await page.waitForTimeout(250);
    // ⛔ A NÉMA KIHAGYÁS A HIBA MAGA: ha a kattintás nem nyitott, azt HANGOSAN mondjuk ki,
    // különben megint egy üres kép kerül a kézikönyvbe.
    if (scrollTo) {
      const shown = await page.locator(scrollTo).first().isVisible();
      if (!shown) {
        throw new Error(
          `kb-shot: a(z) "${clickToOpen}" kattintás UTÁN sem látszik a(z) "${scrollTo}" — ` +
            `a ${path.relative(ROOT, outPath)} üres lenne.`,
        );
      }
    }
    await page.waitForTimeout(150); // az elrendezés álljon be a nyitás után
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  // ⛔ A VÉGTELEN ANIMÁCIÓ MEGÖLI AZ ELEM-FELVÉTELT. A konzolon több végtelen
  // `conPulse` fut (élő-jelző pötty, futó-jelzés); a Playwright elem-capture-je
  // stabil dobozt vár, ezért a mock-fül felvétele 30 s után „element is not
  // stable"-lel HALT MEG (mérve 2026-09-20, a mock-kártyák bevezetése után). A
  // mozgás kikapcsolása nem szépít: a kézikönyvbe úgyis állókép kerül.
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none !important;transition:none !important}",
  });
  // …és a KETYEGŐ időzítők is. A lead-lap egy `setInterval(tick, 1000)`-rel írja az
  // eltelt-idő számlálót (`data-cit-elapsed`), ami minden másodpercben megváltoztatja
  // a szöveget — az elem-capture ettől VÉGTELENSÉGIG „nem stabil"-t mér. A számláló
  // értéke egy kézikönyv-képen úgysem jelent semmit; a lap többi tartalma áll.
  await page.evaluate(`(() => {
    const top = setInterval(() => {}, 100000);
    for (let i = 0; i <= top; i++) { clearInterval(i); clearTimeout(i); }
  })()`);
  if (hash === "#ls-mocks") {
    // The source panel sits below the fold on the mocks tab — an ELEMENT shot
    // captures exactly the panel. The sticky topbar/tab-bar would overlay the
    // capture region mid-panel, so they are hidden for this one shot.
    await page.addStyleTag({ content: ".con-top,.con-ltabs__bar{visibility:hidden}" });
    await snap(page.locator("#sp-panel"), outPath);
  } else if (scrollTo) {
    // Ugyanaz a csapda, mint a #ls-mocks ágon: az elem-capture a lapot az elemhez
    // görgeti, és a TAPADÓ fejléc/fül-sáv ráúszik a felvételi területre. A legend.png-n
    // ez pont a két új sort (Felmérve, Terület) takarta el — vagyis a kép azt NEM
    // mutatta, amit az entry bizonyítékul hoz rá (tudásbázis-őr, 2026-09-14).
    await page.addStyleTag({ content: ".con-top,.con-ltabs__bar{visibility:hidden}" });
    // ⛔ A LEVÁGOTT ELŐNÉZET MINDIG A VÉGÉT VESZI EL. Ha a felvett elem SAJÁT MAGA görget
    // (a jelmagyarázat-felugró `max-height: 82vh`), az elem-capture csak a látható részt
    // veszi: mérve 16 sorból 8 került a képre — a kézikönyv így olyan képre hivatkozna,
    // amiről a fele hiányzik (`feedback_truncated_preview_hides_the_legal_end`).
    await page.addStyleTag({
      content: `${scrollTo}{max-height:none !important;overflow:visible !important}`,
    });
    await page.waitForTimeout(120);
    await snap(page.locator(scrollTo).first(), outPath);
    console.log(`  ✓ ${path.relative(ROOT, outPath)} (elem: ${scrollTo})`);
    return;
  } else {
    await snap(page, outPath);
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
// ⛔ A LAPOZÓ-KÉP MEGSZŰNT (ADR-0188): nincs lapozó, tehát nincs mit lefotózni — és egy
// olyan képernyőelemről szóló kép, ami nem létezik, a kézikönyv legrosszabb fajta hazugsága.
// A jelmagyarázat a VALÓDI úton nyílik: rákattintunk a „?" gombra, és a FELUGRÓ DOBOZÁT
// vesszük (a `.con-legend` maga teljes képernyős, félig átlátszó háttér).
await shootConsole(
  leadsPage(buildLeadListResult(leadRowsPaged, defaultLeadQuery()), defaultLeadQuery()),
  path.join(ROOT, "kb/entries", "console-leads", "assets", "hu", "legend.png"),
  undefined,
  ".con-legend__box",
  "#leadLegendBtn",
);
await shootConsole(leadPage(leadDetail), conOut("console-lead"));
// The "Honnan tudjuk?" source panel (ADR-0106 ⑥) sits on the mocks tab — its own
// capture, referenced by the entry's dedicated section.
//
// ⛔ MÉRT ELAVULÁS (2026-09-20, deploy-kapu KB-verdikt): az ADR-0189 óta a mock-kártyák
// állnak a fül ELEJÉN, a forrás-panel pedig egy CSUKOTT <details> mögé került. A kép így
// a kártya-rácsot mutatta egy „forrás-panel" nevű fájlban, és a puszta `#ls-mocks`
// horgonnyal újragenerálva SEM jött volna elő a panel. Ezért most a VALÓDI úton készül:
// rákattintunk a nyitó sorra, mint az operátor, és a panelre görgetünk. Ha a nyitás nem
// működik, a felvétel HANGOSAN elhasal (a legend.png tanulsága, ADR-0183).
await shootConsole(
  leadPage(leadDetail),
  path.join(ROOT, "kb/entries", "console-lead", "assets", "hu", "source-panel.png"),
  "#ls-mocks",
  "#sp-panel",
  ".con-mkgen > summary",
);
await shootConsole(
  scrapePage(scrapeIdle, scrapeRuns, [{ id: "keszthely", label: "Keszthely és környéke" }]),
  conOut("console-scrape"),
);
// A státusz-szótárt (fut · lefutott · megszakadt · hibára futott) a súgó szövege
// magyarázza — a lap tetejét mutató kép alatt viszont a fele a hajtás alá esik.
// Ezért a futás-lista panelje KÜLÖN képet kap, amin mind a négy sor látszik.
await shootConsole(
  scrapePage(scrapeIdle, scrapeRuns, [{ id: "keszthely", label: "Keszthely és környéke" }]),
  path.join(ROOT, "kb/entries", "console-scrape", "assets", "hu", "runs.png"),
  undefined,
  ".panel:nth-of-type(2)",
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
    // ⛔ The guide calls this „a legfelső sor" — a fixture that omits the argument would
    // teach a screen that does not exist (a KB image is only worth what it really shows).
    // The happy path matches the PASS verdict above: every gate green, the mail may go.
    { sendable: true, reason: null, gateBlocked: false, needsConfirm: false, gate: null, reasons: [] },
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

// ─────────────────────────────────────────────────────────────────────────────
// ÉP-ŐR — ZÁRÓ MÉRLEG
// ─────────────────────────────────────────────────────────────────────────────
// ⛔ Ez a szakasz azért van a futás VÉGÉN és nem a felvételek közben, mert a
// `kb-shot` egyben MINDENT újragenerál: egy futás közbeni `throw` a képek felét
// frissen, felét régiben hagyná. Itt viszont a bukás visszafordíthatatlanul
// látszik, és a hívó (ember vagy CI) nem hiheti, hogy sikerült.
{
  const collapsed = captures.filter((c) => captureCollapsed(c.prev, c.next));
  const fresh = captures.filter((c) => !c.prev);
  const compared = captures.filter((c) => c.prev && c.next).length;
  const unreadable = captures.filter((c) => !c.next);

  console.log(
    `\nép-őr: ${captures.length} felvétel · ${compared} összevetve az előzővel · ` +
      `${fresh.length} új (nincs mihez mérni)`,
  );
  // ⚠️ Amit KIHAGYUNK, azt HANGOSAN hagyjuk ki — egy néma kihagyás pont úgy néz ki,
  // mint egy sikeres ellenőrzés (`feedback_debug_flag_manufactured_a_false_failure`).
  for (const c of fresh) console.log(`   ℹ️ új kép, nincs összevetés: ${c.rel}`);
  for (const c of unreadable) console.log(`   ⚠️ nem olvasható PNG: ${c.rel}`);

  if (collapsed.length) {
    console.error(`\n⛔ ${collapsed.length} súgó-kép BEOMLOTT — tartalom veszett el:`);
    for (const c of collapsed) {
      console.error(
        `   ${c.rel}: ${c.prev!.w}×${c.prev!.h} → ${c.next!.w}×${c.next!.h} ` +
          `(a magasság ${Math.round((c.next!.h / c.prev!.h) * 100)}%-ra esett)`,
      );
    }
    console.error(
      `\n   Ez pontosan az a hiba, amitől a legend.png 2020→126 px-re esett: a kép a\n` +
        `   CSUKOTT állapotot mutatta, a súgó szövege meg a nyitottat ígérte. Nézd meg a\n` +
        `   képet a szemeddel, mielőtt commitolod — a kb-check és a kb-freshness NEM\n` +
        `   nézi, van-e tartalom a képen.`,
    );
    process.exit(1);
  }
  // ⛔ UTÓ-FELTÉTEL: ha a `snap()` mellett valaki új felvételi utat nyitna, a mérleg
  // NÉMÁN kevesebbet mérne, és ez a zöld sor hazudna.
  if (!captures.length) {
    console.error("⛔ ép-őr: NULLA felvételt mértünk — a mérés maga romlott el.");
    process.exit(1);
  }
  console.log("✅ ép-őr: egyetlen kép sem omlott be.");
}

console.log(`kb-shot: kész (${LANG})`);
