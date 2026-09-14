// ADMIN-LIST-LABELS guard — a lista SOROS mondja meg, MIRŐL szól.
//
//   npx tsx scripts/admin-list-labels-check.mts [--self-test]
//
// Measured 2026-09-12 (Elek FK-001, tenant-admin):
//   E1  18 közel azonos számla-sor (1 149 525 Ft) — szám, dátum, „Kifizetve · AAM”,
//       összeg —, és EGY SZÓ SEM arról, mi a bizonylat tárgya. A dev-parkban mérve
//       a 18 sor valójában KÉT termék volt (11 éves előfizetés + 7 egyszeri
//       többnyelvű díj). Ugyanezt a leírást az ÜZENETEK fül megadta.
//   Z2  Minden üzenet-sor ugyanazt a boríték-ikont viselte; a csatorna csak a
//       SZŰRŐVEL derült ki, pedig a fül bevezetője „e-mailben és SMS-ben”-t ígér.
//   Z1  „Honlapja felfüggesztve” állt egy sorral a „Honlapja újra elérhető” ALATT,
//       miközben a fiók élő és minden számla kifizetve — semmi nem jelezte, hogy
//       az alsók már túlhaladottak.
//
// ⛔ MIÉRT A RENDERELT KIMENETEN MÉR: mindhárom lelet olyan, hogy minden
// egység-teszt zöld maradt volna. A tétel-név LÉTEZETT (az order_intentben), a
// csatorna LÉTEZETT (az oszlopban), a túlhaladottság LEVEZETHETŐ volt — csak épp
// egyikük sem jutott el a sorig. A hiány a SZÁLLÍTOTT HTML-ben él, ezért a
// mérce a `documentsSection()` / `messagesSection()` kimenete.
//
// A fixture hermetikus (se DB, se szerver), hogy friss klónon és pre-commitban is
// fusson, a park állapotától függetlenül.
//
// --self-test a fixture-t olyan állapotba viszi, amit az őrnek EL KELL utasítania
// (tétel-név nélküli sor, csatorna-felirat nélküli sor, jelöletlen túlhaladott
// üzenet). Egy őr, amit sosem láttunk pirosnak, nem bizonyíték
// (feedback_fixture_must_prove_its_own_path).

import {
  documentsSection,
  messagesSection,
  type DocumentsAdminData,
  type MessagesAdminData,
} from "../src/server/adminViews.js";
import {
  INVOICE_ITEM_KEYS,
  invoiceItemKey,
  invoiceItemLabel,
  invoiceItemPeriod,
} from "../src/billing/invoiceItem.js";
import { positionThreads, type ThreadableMessage } from "../src/tenant/messageThreads.js";
import { projectMessages } from "../src/tenant/messages.js";
import type { MessageTopic } from "../src/tenant/messageTopics.js";

const selfTest = process.argv.includes("--self-test");

let fails = 0;
const check = (cond: boolean, msg: string, why = ""): void => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${msg}${cond || !why ? "" : `\n       → ${why}`}`);
};

/** Minden HTML-tag nélkül — a VEVŐ a szöveget olvassa, nem a markupot. */
const text = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Egy sor HTML-je a renderelt listából. */
function rowsOf(html: string, cls: string): string[] {
  const out: string[] = [];
  // ⚠️ Szó-határ KELL: a puszta `adm-inv[^"]*` a sor BELSŐ divjeire is illeszkedik
  // (`adm-inv__ico`, `adm-inv__t`, `adm-inv__r`), és 7 sorból 28-at csinál. Egy
  // ilyen parser-hiba pontosan úgy néz ki, mint egy termék-hiba.
  const open = new RegExp(`<div class="${cls}(?=[\\s"])[^"]*"`, "g");
  let m: RegExpExecArray | null;
  const starts: number[] = [];
  while ((m = open.exec(html))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    out.push(html.slice(starts[i]!, starts[i + 1] ?? html.length));
  }
  return out;
}

/* ══ FIXTURE ═══════════════════════════════════════════════════════════════
   A dev-park VALÓS alakja: kétféle termék, azonos összeggel ismétlődő sorok,
   plusz egy bizonylat nélküli („folyamatban”) sor — mindhárom ág renderelődjön,
   különben a szabályok fele nincs is megmérve. */

const ORDERS: readonly { kind: string; period: string; gross: number; no: string | null }[] = [
  { kind: "initial", period: "annual", gross: 99900, no: "OV-2026-43" },
  { kind: "multilang", period: "monthly", gross: 14900, no: "OV-2026-41" },
  { kind: "initial", period: "annual", gross: 99900, no: "OV-2026-40" },
  { kind: "renewal", period: "annual", gross: 99900, no: "OV-2026-39" },
  { kind: "upsell", period: "monthly", gross: 6900, no: "OV-2026-38" },
  { kind: "domain_settlement", period: "annual", gross: 12000, no: "OV-2026-37" },
  { kind: "initial", period: "annual", gross: 74925, no: null }, // számlázás folyamatban
];

function documentsFixture(broken: boolean): DocumentsAdminData {
  return {
    invoices: ORDERS.map((o, i) => {
      const key = invoiceItemKey(o.kind);
      return {
        id: `inv${i}`,
        invoiceNumber: o.no,
        issuedAt: new Date("2026-09-12T10:00:00+02:00"),
        gross: o.gross,
        currency: "HUF",
        status: o.no ? "issued" : "failed",
        vatTreatment: "aam",
        hasPdf: Boolean(o.no),
        periodStart: null,
        periodEnd: null,
        year: "2026",
        // ⛔ A rontás a NÉZETET célozza, nem a regisztert: a sor olyan kulcsot kap,
        // aminek a címkéje üres — pontosan a bejelentett hiba (szám + összeg, tétel
        // nélkül). Így az őr azt méri, amit a vevő lát.
        itemKey: (broken ? "__nincs__" : key) as never,
        itemPeriod: invoiceItemPeriod(key, o.period),
      };
    }),
    agreements: [],
    sub: "szamlak",
    year: "mind",
    q: "",
    nextRenewal: new Date("2027-09-10T00:00:00+02:00"),
  };
}

/** A park valós dunning-köre + egy foglalás-szál + szálon kívüli sorok. */
const RAW: readonly {
  id: string;
  ch: "email" | "sms";
  kind: ThreadableMessage["kind"];
  subject: string | null;
  body: string;
  at: string;
  rel?: string;
  relId?: string;
}[] = [
  // ⛔ A TÖRZS VALÓDI ALAKJA (src/email/invoiceEmail.ts), nem „…" helyőrző: az E3 lelet
  // ÉPPEN a törzs szerkezetéről szól (a megszólítás áll elöl, az összeg négy sorral
  // lejjebb). Helyőrzővel az előnézet-szabály nem is lenne MEGMÉRVE — a fixture
  // bizonyítsa a saját útját (feedback_fixture_must_prove_its_own_path).
  { id: "m1", ch: "email", kind: "invoice", subject: "Számla OV-2026-43 – Honlap-előfizetés (éves)",
    body: "Kedves Elek Teszt!\n\nKöszönjük az előfizetést. A fizetés megérkezett, a számlát mellékeljük.\n\nSzámla sorszáma: OV-2026-43\nÖsszeg: 99 900 Ft\nTétel: Honlap-előfizetés (éves)",
    at: "11:36", rel: "invoice", relId: "i43" },
  { id: "m2", ch: "email", kind: "booking", subject: "Lejárt egy foglalási kérés", body: "…", at: "10:36", rel: "booking_request", relId: "b1" },
  { id: "m3", ch: "email", kind: "dunning", subject: "Honlapja újra elérhető", body: "A díjat megkaptuk…", at: "10:35" },
  { id: "m4", ch: "email", kind: "dunning", subject: "Honlapja felfüggesztve", body: "A rendezetlen díj miatt…", at: "10:34" },
  { id: "m5", ch: "sms", kind: "dunning", subject: null, body: "Citoviso: honlapja hamarosan felfüggesztésre kerül…", at: "10:33" },
  { id: "m6", ch: "email", kind: "dunning", subject: "Esedékes a honlapdíj", body: "…", at: "10:32" },
  { id: "m7", ch: "email", kind: "booking", subject: "Foglalási kérés: Elek Vendég", body: "…", at: "10:23", rel: "booking_request", relId: "b1" },
  // ── MÁSODIK foglalás-szál (FK-006b HIBA-1) ─────────────────────────────────
  // Ez teszi mérhetővé az AZONOS TÁRGYÚ szálfejek esetét: két külön foglalási
  // kérés két feje egyaránt „foglalási kérés"-t nevez meg, tehát a megnevezés
  // ITT önmagában nem elég — a felülírt üzenetnek is neve kell legyen.
  { id: "m10", ch: "email", kind: "booking", subject: "Lemondta a foglalását: Kis Anna", body: "…", at: "10:20", rel: "booking_request", relId: "b2" },
  { id: "m11", ch: "email", kind: "booking", subject: "Foglalási kérés: Kis Anna", body: "…", at: "10:12", rel: "booking_request", relId: "b2" },
  // Szálon KÍVÜLI sorok: ezek SOHA nem kaphatnak jelölést.
  { id: "m8", ch: "email", kind: "credentials", subject: "Belépési adatai", body: "…", at: "09:14" },
  { id: "m9", ch: "email", kind: "booking", subject: "Érdeklődés érkezett", body: "…", at: "09:10", rel: "enquiry" },
];

function messagesFixture(broken: boolean): MessagesAdminData {
  const threadable: ThreadableMessage[] = RAW.map((r) => ({
    id: r.id,
    kind: r.kind,
    channel: r.ch,
    subject: r.subject,
    bodyText: r.body,
    relatedKind: r.rel ?? null,
    relatedId: r.relId ?? null,
    sentAt: new Date(`2026-09-12T${r.at}:00+02:00`),
  }));
  const pos = positionThreads(threadable);
  // ⚠️ A `scripts/` NINCS típus-ellenőrizve (reference_scripts_are_not_typechecked),
  // ezért a rontott pozíció a TERMÉK alakjából épül: minden mezőt kiírunk, hogy egy
  // új mező hozzáadása ne némán `undefined`-ként érkezzen a nézetbe.
  const EMPTY = {
    supersededBy: null,
    isLatestOfThread: false,
    olderCount: 0,
    subject: null,
    supersedesTitle: null,
  } as const;
  return {
    messages: threadable.map((t) => ({
      id: t.id,
      channel: t.channel,
      // ⚠️ A `scripts/` NINCS típus-ellenőrizve: ez a mező a nézet ELŐNÉZET-szabályához
      // kell (kontraktus ③), és hiánya csak FUTÁSIDŐBEN derült ki
      // (reference_scripts_are_not_typechecked).
      kind: t.kind,
      subject: t.subject,
      bodyText: t.bodyText,
      recipient: "elek@citoviso.com",
      attachmentName: null,
      relatedKind: t.relatedKind,
      relatedId: t.relatedId,
      sentAt: t.sentAt,
      readAt: new Date(),
      // ⛔ A rontás: a nézet nem kapja meg a szál-pozíciót — pontosan a bejelentett
      // állapot, ahol minden sor egyforma súlyú, és a vevő ellentmondást olvas.
      thread: broken ? EMPTY : pos.get(t.id)!,
    })),
    unread: 0,
    topic: "mind",
    channel: "",
    unreadOnly: false,
    q: "",
    total: threadable.length,
    mindCount: threadable.length,
    topicCounts: topicTotals(RAW.map((r) => r.kind)),
    channelCounts: channelTotals(RAW.map((r) => r.ch)),
    unreadCount: 0,
    openId: null,
    openThreads: [],
    confirmRead: false,
  };
}

/* ══ E2 — A TÉMA-SZŰRŐ ═════════════════════════════════════════════════════
   Kontraktus: assets/design-refs/tenant-admin/uzenetek-tema-szuro/README.md.

   ⛔ FÜGGETLEN REFERENCIA: a `kind → téma` leképezést ITT ÍRJUK KI KÉZZEL, és NEM
   a `messageTopics.ts`-ből importáljuk. Az őr ne hívja azt, amit vizsgál — egy
   elrontott regiszter különben önmagával egyezne, és az őr zöld maradna
   (feedback_guard_must_not_borrow_its_subject: a rendezés-ellenőrzés pontosan így
   maradt zöld egy visszarontott komparátoron). */
const REF_TOPIC_OF: Record<string, string> = {
  booking: "foglalas",
  invoice: "szamlazas", dunning: "szamlazas",
  site_live: "honlap", domain: "honlap", multilang: "honlap", review: "honlap", traffic: "honlap",
  credentials: "fiok", other: "fiok",
};
const REF_LABEL: Record<string, string> = {
  foglalas: "Foglalások", szamlazas: "Számlázás", honlap: "A honlapom", fiok: "Fiók",
};
const REF_TOPICS = ["foglalas", "szamlazas", "honlap", "fiok"] as const;

function topicTotals(kinds: readonly string[]): Record<MessageTopic, number> {
  const out = { foglalas: 0, szamlazas: 0, honlap: 0, fiok: 0 } as Record<MessageTopic, number>;
  for (const k of kinds) out[REF_TOPIC_OF[k] as MessageTopic]++;
  return out;
}

/** Ugyanez csatornára — a NAIV (teljes postaládás) szám, amit az önteszt használ. */
function channelTotals(chans: readonly ("email" | "sms")[]): Record<"email" | "sms", number> {
  return {
    email: chans.filter((c) => c === "email").length,
    sms: chans.filter((c) => c === "sms").length,
  };
}

/** A fixture sorai a termelési `projectMessages()` bemeneti alakjában. */
function projectableRows(): Parameters<typeof projectMessages>[0] {
  return RAW.map((r) => ({
    id: r.id,
    channel: r.ch,
    kind: r.kind,
    subject: r.subject,
    bodyText: r.body,
    recipient: "elek@citoviso.com",
    attachmentName: null,
    relatedKind: r.rel ?? null,
    relatedId: r.relId ?? null,
    sentAt: new Date(`2026-09-12T${r.at}:00+02:00`),
    // ⛔ Az olvasatlanok SZÁNDÉKOSAN úgy állnak, hogy a TELJES olvasatlan-szám (4)
    // és a szűrt hatókör száma (Számlázás: 3) KÜLÖNBÖZZÖN. Egyetlen olvasatlannal
    // a „Mind olvasott (1)" és „A szűrt 1 olvasott" ugyanazt a számot adná, tehát a
    // mérés nem tudná megkülönböztetni a hibás ágat — a fixture bizonyítsa a saját
    // útját (feedback_fixture_must_prove_its_own_path).
    // A Foglalások kör MIND olvasott: így mérhető, hogy üres hatókörben eltűnik a gomb
    // úgy is, hogy közben a listában VAN sor.
    readAt: UNREAD_IDS.has(r.id) ? null : new Date("2026-09-12T12:00:00+02:00"),
  }));
}

/** invoice + 2 dunning + credentials — a Foglalások ág szándékosan kimarad. */
const UNREAD_IDS = new Set(["m1", "m3", "m5", "m8"]);

/**
 * ⛔ A GUARD SAJÁT olvasatlan-szabálya (kontraktus ②) — SZÁNDÉKOSAN nem a termék
 * `isUnread()`-je. Egy őr, ami a vizsgálata tárgyát hívja, a visszarontott szabállyal
 * is egyetértene (feedback_guard_must_not_borrow_its_subject: a rendezés-ellenőrzés
 * pontosan így maradt zöld egy elrontott komparátoron).
 *
 * A szabály: olvasatlan = nincs `readAt` ÉS nem túlhaladott. A túlhaladottságot itt a
 * FIXTURE-ből vezetjük le: egy szálon belül minden tag túlhaladott, kivéve a legfrissebbet.
 */
function refSupersededIds(): Set<string> {
  const byThread = new Map<string, typeof RAW[number][]>();
  for (const r of RAW) {
    const key = r.kind === "dunning" || r.kind === "multilang"
      ? `kind:${r.kind}`
      : r.kind === "booking" && r.rel === "booking_request" && r.relId
        ? `booking_request:${r.relId}`
        : null;
    if (!key) continue;
    byThread.set(key, [...(byThread.get(key) ?? []), r]);
  }
  const out = new Set<string>();
  for (const mem of byThread.values()) {
    if (mem.length < 2) continue;
    const sorted = [...mem].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? -1 : 1));
    for (const m of sorted.slice(1)) out.add(m.id);
  }
  return out;
}
const REF_SUPERSEDED = refSupersededIds();
const refUnread = (id: string): boolean => UNREAD_IDS.has(id) && !REF_SUPERSEDED.has(id);

/**
 * A VALÓDI adat-út + a VALÓDI nézet, DB nélkül. A `broken` ág a naiv megvalósítást
 * állítja elő: a chip-számok a TELJES postaládából jönnek, figyelmen kívül hagyva az
 * éppen aktív többi szűrőt — vagyis a chip MÁS kérdésre válaszol, mint amit a
 * kattintás szállít (feedback_label_answers_a_different_question).
 */
function topicView(
  query: { topic?: string; channel?: string; unread?: boolean; q?: string; openThreads?: string[] },
  broken = false,
): MessagesAdminData {
  const res = projectMessages(projectableRows(), query);
  return {
    messages: res.rows,
    // A postaláda-szintű olvasatlan (a nav-jelvény száma). ⚠️ NEM 0: a szűretlen
    // „Mind olvasott" ág EBBŐL számol, mert az az egész postaládát jelöli meg.
    unread: projectableRows().filter((r) => r.readAt === null).length,
    topic: query.topic ?? "mind",
    channel: query.channel ?? "",
    unreadOnly: query.unread ?? false,
    q: query.q ?? "",
    total: res.total,
    mindCount: broken ? res.total : res.mindCount,
    topicCounts: broken ? topicTotals(RAW.map((r) => r.kind)) : res.topicCounts,
    // A csatorna-chip ugyanazt a naiv hibát tudja elkövetni, mint a téma-chip:
    // a TELJES postaládából számolni, az éppen aktív téma-szűrőt figyelmen kívül hagyva.
    channelCounts: broken ? channelTotals(RAW.map((r) => r.ch)) : res.channelCounts,
    unreadCount: broken ? 1 : res.unreadCount,
    openId: null,
    openThreads: query.openThreads ?? [],
    confirmRead: false,
  };
}

/**
 * MINDEN szál kulcsa a fixture-ből. ⛔ Kézzel beírva egy elgépelés némán „nincs
 * kinyitva" állapotot adna, és a sor-szintű állítások üresen zöldülnének.
 */
function allThreadKeys(): string[] {
  const rows = projectableRows();
  const pos = positionThreads(
    rows.map((r) => ({ ...r, subject: r.subject, bodyText: r.bodyText })) as never,
  );
  return [...new Set([...pos.values()].map((p) => p.key).filter((k): k is string => Boolean(k)))];
}

/** A találat-sor első száma: hány ÜZENET felel meg a szűrésnek (nem hány SOR). */
function deliveredCount(html: string): number {
  const m = /(\d+)\s*\/\s*\d+/.exec(text(html));
  return m ? Number(m[1]) : -1;
}

/** Egy chip kirenderelt darabszáma a sávból, felirat szerint. */
function chipCount(html: string, label: string): number | null {
  for (const c of html.match(/<a class="adm-fchip[^]*?<\/a>/g) ?? []) {
    const t = text(c);
    if (!t.startsWith(label)) continue;
    const n = /(\d+)\s*$/.exec(t);
    return n ? Number(n[1]) : null;
  }
  return null;
}

/* ══ A MÉRÉS ═══════════════════════════════════════════════════════════════ */

console.log(
  selfTest
    ? "── ÖNTESZT: a visszarontott nézeten MINDEN alábbinak PIROSNAK kell lennie ──"
    : "── Tenant-admin lista-feliratok (Elek FK-001 E1 / Z1 / Z2) ──",
);

/* ① A regiszter TOTÁLIS: minden order-fajtának van neve, és mind KÜLÖNBÖZŐ.
      Ez a rontástól független szerkezeti állítás — ezért az öntesztben sem bukhat. */
{
  const ORDER_KINDS = ["initial", "upsell", "multilang", "domain_upgrade", "renewal", "domain_settlement"];
  const labels = new Set<string>();
  let allNamed = true;
  for (const k of ORDER_KINDS) {
    const key = invoiceItemKey(k);
    const l = invoiceItemLabel(key, invoiceItemPeriod(key, "annual"));
    if (!l.trim()) allNamed = false;
    labels.add(l);
  }
  const keyLabels = new Set(INVOICE_ITEM_KEYS.map((k) => invoiceItemLabel(k, invoiceItemPeriod(k, "annual"))));
  console.log("\n① A tétel-regiszter");
  check(allNamed, `mind a ${ORDER_KINDS.length} order-fajtának van tétel-neve`);
  check(
    keyLabels.size === INVOICE_ITEM_KEYS.length,
    `a ${INVOICE_ITEM_KEYS.length} kulcs ${keyLabels.size} KÜLÖNBÖZŐ nevet ad`,
    "két termék azonos neve pont azt a megkülönböztethetetlenséget hozná vissza, amit javítunk",
  );
}

/* ② MINDEN számla-soron ott a tétel-megnevezés — a RENDERELT kimeneten. */
{
  const html = documentsSection(documentsFixture(selfTest));
  const rows = rowsOf(html, "adm-inv");
  const known = INVOICE_ITEM_KEYS.map((k) => invoiceItemLabel(k, invoiceItemPeriod(k, "annual")))
    .concat(INVOICE_ITEM_KEYS.map((k) => invoiceItemLabel(k, invoiceItemPeriod(k, "monthly"))));
  const named = rows.filter((r) => known.some((l) => text(r).includes(l)));
  console.log("\n② Dokumentumok — tétel-megnevezés a soron (E1)");
  check(rows.length === ORDERS.length, `mind a ${ORDERS.length} számla-sor kirenderelődött (${rows.length})`);
  check(
    named.length === rows.length,
    `mind a ${rows.length} soron ott a tétel neve (${named.length})`,
    "tétel-név nélkül 18 közel azonos sorból nem lehet kiválasztani a keresettet (Elek FK-001 E1)",
  );
  // A bizonylat nélküli sor is megnevezi, MIRŐL szól — csak nem a főcímben.
  const pending = rows.find((r) => text(r).includes("Számlázás folyamatban"));
  check(
    Boolean(pending && known.some((l) => text(pending).includes(l))),
    "a „Számlázás folyamatban” sor is megnevezi a tételt",
    "ez a sor azért NEM kap főcímbe tételt, mert nincs száma — de a tárgyát akkor is ki kell mondania",
  );
  // A keresés arra is találjon, ami a soron LÁTSZIK (a felirat és a predikátum
  // ugyanaz a mező legyen — feedback_label_must_derive_from_predicate).
  const q = "többnyelvű";
  const hits = rowsOf(documentsSection({ ...documentsFixture(selfTest), q }), "adm-inv");
  check(
    hits.length > 0 && hits.length < rows.length,
    `a soron látható szóra („${q}”) a kereső ${hits.length} sort ad`,
    "ha a tétel-név nem kereshető, a kereső-felirat olyan mezőt ígér, amit a predikátum nem olvas",
  );
}

/* ③ MINDEN üzenet-soron olvasható csatorna-felirat. */
{
  // ⛔ A csatorna-felirat a MARKUPBAN él, nem egy adat-mezőben, ezért egy „rossz
  // adat” fixture nem tudná pirosra vinni. Az öntesztben ezért a FIX ELŐTTI sort
  // állítjuk vissza: kivesszük a csatorna-spant, és pontosan az a lap keletkezik,
  // amit az Elek mért (boríték-ikon, felirat nélkül). Enélkül ez az állítás soha
  // nem lenne piros, tehát nem is lenne bizonyíték.
  // ⛔ A szálak ALAPBÓL CSUKVA állnak (kontraktus ①), tehát a „minden soron" típusú
  // állításokat KINYITOTT ügyekkel kell mérni — különben az őr azt hinné, hogy a
  // lépések eltűntek, holott csak össze vannak csukva.
  const rendered = messagesSection({ ...messagesFixture(selfTest), openThreads: allThreadKeys() });
  const html = selfTest
    ? rendered.replace(/<span class="adm-msg__chan[^>]*>[\s\S]*?<\/span>/g, "")
    : rendered;
  const rows = rowsOf(html, "adm-msg");
  console.log("\n③ Üzenetek — csatorna-jelölés a soron (Z2)");
  check(rows.length === RAW.length, `mind a ${RAW.length} üzenet-sor kirenderelődött (${rows.length})`);
  // ⛔ A SORT AZ AZONOSÍTÓJÁVAL PÁROSÍTJUK, nem a sorrenddel. Az ügy-nézet (kontraktus ①)
  // a szál lépéseit a FEJÜK alá csoportosítja, tehát a renderelt sorrend már NEM a
  // fixture sorrendje — az index-alapú párosítás m5-öt m4 markupjához mérte, és a
  // hibát a TERMÉKRE fogta volna, pedig az őré volt.
  const byId = new Map(rows.map((r) => [/id="uz-([^"]+)"/.exec(r)?.[1] ?? "", r]));
  let right = 0;
  for (const r of RAW) {
    const want = r.ch === "sms" ? "SMS" : "E-mail";
    const other = r.ch === "sms" ? "E-mail" : "SMS";
    const t = text(byId.get(r.id) ?? "");
    // ⚠️ A csatorna-felirat a SORON kell legyen, nem a kinyitott törzs lábában:
    // a fixture csukott sorokat renderel, tehát amit itt látunk, az a lista.
    if (t.includes(want) && !t.includes(other)) right++;
  }
  check(
    right === rows.length,
    `mind a ${rows.length} soron pontosan a saját csatornája áll (${right})`,
    "az ikon nem felirat: 19px-en a boríték és a buborék ugyanaz a folt, és a szűrő nem a sor tulajdonsága",
  );
}

/* ④ A túlhaladott állapot-üzenet jelölve van, ÉS megnevezi a felülíróját. */
{
  const data = { ...messagesFixture(selfTest), openThreads: allThreadKeys() };
  const html = messagesSection(data);
  const rows = rowsOf(html, "adm-msg");
  const byId = new Map(rows.map((r) => [/id="uz-([^"]+)"/.exec(r)?.[1] ?? "", r]));
  const truth = positionThreads(
    RAW.map((r) => ({
      id: r.id,
      kind: r.kind,
      channel: r.ch,
      subject: r.subject,
      bodyText: r.body,
      relatedKind: r.rel ?? null,
      relatedId: r.relId ?? null,
      sentAt: new Date(`2026-09-12T${r.at}:00+02:00`),
    })),
  );
  console.log("\n④ Üzenetek — túlhaladottság jelölése (Z1)");

  const pastIds = [...truth].filter(([, p]) => p.supersededBy).map(([id]) => id);
  const latestIds = [...truth].filter(([, p]) => p.isLatestOfThread).map(([id]) => id);
  const looseIds = [...truth].filter(([, p]) => !p.supersededBy && !p.isLatestOfThread).map(([id]) => id);

  check(
    pastIds.length >= 3 && latestIds.length >= 2 && looseIds.length >= 3,
    `a fixture tényleg kifejezi a hibát: ${pastIds.length} túlhaladott · ${latestIds.length} szálfej · ${looseIds.length} szálon kívüli`,
    "egy olyan fixture, amiben nincs mit jelölni, minden kódon zöld lenne",
  );

  let marked = 0;
  let namedReplacement = 0;
  for (const id of pastIds) {
    const t = text(byId.get(id) ?? "");
    if (t.includes("Túlhaladott")) marked++;
    const by = truth.get(id)!.supersededBy!;
    if (t.includes("Felülírta") && t.includes(by.title)) namedReplacement++;
  }
  check(
    marked === pastIds.length,
    `mind a ${pastIds.length} túlhaladott sor jelölve van (${marked})`,
    "jelölés nélkül a „Honlapja felfüggesztve” ugyanolyan súllyal áll, mint a „Honlapja újra elérhető” — a vevő ellentmondást olvas a fiókja mai állapotáról (§B.17)",
  );
  check(
    namedReplacement === pastIds.length,
    `mind a ${pastIds.length} túlhaladott sor MEGNEVEZI, mi írta felül (${namedReplacement})`,
    "a „ne hidd el” önmagában nem segít: azt is meg kell mondani, mit higgyen helyette",
  );

  const heads = latestIds.filter((id) => text(byId.get(id) ?? "").includes("Ez a legfrissebb"));
  check(heads.length === latestIds.length, `mind a ${latestIds.length} szálfej „Ez a legfrissebb” jelölést kap (${heads.length})`);

  // ⛔ NEGATÍV ÁG: ami nem állapot-szál, az SOHA nem kaphat jelölést. Enélkül egy
  // „mindent megjelölök” implementáció is átmenne — és azzal azt állítanánk egy
  // számláról vagy egy érdeklődésről, hogy túlhaladott.
  const falsePositives = looseIds.filter((id) => {
    const t = text(byId.get(id) ?? "");
    return t.includes("Túlhaladott") || t.includes("Ez a legfrissebb");
  });
  check(
    falsePositives.length === 0,
    `a ${looseIds.length} szálon kívüli sor egyike sem kapott jelölést`,
    `jelölést kapott: ${falsePositives.join(", ")} — egy számla vagy egy külön érdeklődés nem verziója egy másiknak`,
  );
}

/* ⑤ A túlhaladottság a TELJES postaládán dől el, nem a szűrt szeleten.
      Szűrve egy régi SMS különben „legfrissebb”-nek látszana, mert az őt felülíró
      e-mail kiesett a szűrőn — a szűrő termelné a hazugságot. */
{
  console.log("\n⑤ A jelölés szűrésre sem billen át");
  const all: ThreadableMessage[] = RAW.map((r) => ({
    id: r.id,
    kind: r.kind,
    channel: r.ch,
    subject: r.subject,
    bodyText: r.body,
    relatedKind: r.rel ?? null,
    relatedId: r.relId ?? null,
    sentAt: new Date(`2026-09-12T${r.at}:00+02:00`),
  }));
  const full = positionThreads(all);
  const smsOnly = positionThreads(all.filter((m) => m.channel === "sms"));
  const smsId = "m5";
  check(
    Boolean(full.get(smsId)?.supersededBy) && !smsOnly.get(smsId)?.supersededBy,
    "a fixture bizonyítja a veszélyt: SMS-re szűkítve ugyanaz a sor NEM lenne túlhaladott",
    "ha ez nem igaz, a mérés nem is tudja kimutatni a hibát",
  );
  // A termék-úton a nézet a teljes postaládából kapott pozíciót kapja meg —
  // ezt a listTenantMessages() garantálja (szűrés a pozicionálás UTÁN).
  const view = messagesSection({ ...messagesFixture(false), channel: "sms", openThreads: allThreadKeys() });
  const smsRow = rowsOf(view, "adm-msg").find((r) => r.includes(`id="uz-${smsId}"`));
  check(
    Boolean(smsRow && text(smsRow).includes("Túlhaladott")),
    "SMS-szűrőben is túlhaladottként jelenik meg",
  );
}

/* ⑥ A TÉMA-SZŰRŐ (E2): amit a chip ÍGÉR, azt a kattintás SZÁLLÍTJA.
      A mérés a KIRENDERELT sávon és a KIRENDERELT listán fut, a valódi adat-úttal
      (`projectMessages`) — egy egység-teszt a predikátumra zöld maradna akkor is,
      ha a szám és a lista két külön ágból jön. */
{
  console.log("\n⑥ A téma-szűrő: a chip száma = amit szállít");

  // ── a sáv SZERKEZETE: két sor, felirattal, és MIND a négy téma látszik ──────
  // ⛔ Az öntesztben a markupot ELRONTJUK (görgethető sor + hiányzó feliratok). Ez a
  // DETEKTORT bizonyítja, nem a termék-utat: ezek szerkezeti állítások, amiket az
  // adat-fixture nem tud pirosra vinni — egy állítás pedig, amit sosem láttunk
  // pirosnak, nem bizonyíték (feedback_fixture_must_prove_its_own_path).
  {
    const clean = messagesSection(topicView({}));
    const html = selfTest
      ? clean
          .replace(/class="adm-frow"/g, 'class="adm-frow adm-frow--scroll"')
          .replace(/<span class="adm-flab">[^<]*<\/span>/g, "")
          .replace(/>A honlapom</g, ">Egyéb<")
      : clean;
    check(html.includes("adm-frow"), "a szűrő-sáv KÉT SORA kirenderelődik");
    const t = text(html);
    // Kontraktus ⑥: HÁROM kérdés, három sor — a régi „Szűkítés" csatornát és
    // olvasottságot kevert (Elek Z2), ez módosítja az ADR-0127 ② két soros tervét.
    check(
      t.includes("Miről szól") && t.includes("Hogyan jött") && t.includes("Állapot"),
      "mind a HÁROM szűrő-sor viseli a saját feliratát",
      t.slice(0, 200),
    );
    for (const id of REF_TOPICS) {
      check(t.includes(REF_LABEL[id]!), `a „${REF_LABEL[id]}" téma-chip ott van a sávon`);
    }
    // ⛔ Contract ⑥: a téma-sor nem görgethet vízszintesen — egy elrejtett szűrő
    // ugyanaz a hibaosztály, mint a bejelentés, ami létrehozta.
    check(!/adm-frow[^"]*scroll/.test(html), "a téma-sor nem vízszintesen görgetett");
  }

  // ── ⛔ MIÉRT BIZTONSÁGOS a téma-szűrés a szálakra ───────────────────────────
  // A szál kulcsa a `kind`-ból származik, és a téma is a `kind` függvénye, tehát egy
  // szál MINDEN tagja azonos témájú — a téma-szűrés szerkezetileg nem tudja
  // kettévágni a szálat, ahogy a csatorna-szűrés tudná (⑤). Ezt ÁLLÍTÁSKÉNT írjuk
  // ki, nem hallgatólagos feltevésként: ha egy jövőbeli szál-szabály kind-okon
  // ÁTÍVELNE, ez a sor pirosodik, és akkor a ⑤ csapdája a témára is érvényessé válik.
  {
    const byThread = new Map<string, Set<string>>();
    for (const r of RAW) {
      const key = r.relId ? `${r.rel}:${r.relId}` : `kind:${r.kind}`;
      byThread.set(key, new Set([...(byThread.get(key) ?? []), REF_TOPIC_OF[r.kind]!]));
    }
    const mixed = [...byThread].filter(([, s]) => s.size > 1).map(([k]) => k);
    check(
      mixed.length === 0,
      "minden szál egyetlen témába esik → a téma-szűrés nem vághat ketté szálat",
      `több témájú szál: ${mixed.join(", ")}`,
    );
  }

  // ── minden téma: ígéret = szállítás, FÜGGETLENÜL számolt elvárás mellett ────
  for (const id of REF_TOPICS) {
    const want = RAW.filter((r) => REF_TOPIC_OF[r.kind] === id).length;
    const html = messagesSection(topicView({ topic: id }, selfTest));
    // ⛔ ÜZENETET mérünk, nem SORT: a szál-csukás a MEGJELENÍTÉS, nem a halmaz
    // (kontraktus ①). Sorra mérve az őr a csukást hibának olvasná, és a helyes
    // viselkedést jelentené pirosnak.
    const delivered = deliveredCount(html);
    const promised = chipCount(html, REF_LABEL[id]!);
    check(delivered === want, `„${REF_LABEL[id]}" → ${want} sor`, `szállított: ${delivered}`);
    check(promised === delivered, `„${REF_LABEL[id]}" chip-száma (${promised}) = a szállított sorok (${delivered})`);
    check(text(html).includes(`téma: ${REF_LABEL[id]}`), `a találat-sor MEGNEVEZI a témát`, text(html).slice(0, 160));
  }

  // ── a két dimenzió EGYÜTT hat (ez a jóváhagyott „A" változat lényege) ───────
  {
    const want = RAW.filter((r) => REF_TOPIC_OF[r.kind] === "szamlazas" && r.ch === "sms").length;
    const html = messagesSection(topicView({ topic: "szamlazas", channel: "sms" }, selfTest));
    check(deliveredCount(html) === want, `Számlázás ∩ SMS = ${want} üzenet`, `${deliveredCount(html)}`);
    const t = text(html);
    check(t.includes("téma: Számlázás") && t.includes("csatorna: SMS"), "a találat-sor MINDKÉT szűrést kimondja", t.slice(0, 200));
  }

  // ── a chip-szám az AKTÍV másik szűrővel EGYÜTT számol (contract ③) ──────────
  // Ez az a hiba, amit a naiv megvalósítás elkövet: 9 üzenetből 1 az olvasatlan,
  // tehát az „Olvasatlan" mellett a „Számlázás" chipnek 1-et kell mondania, nem 4-et.
  {
    const want = RAW.filter(
      (r) => REF_TOPIC_OF[r.kind] === "szamlazas" && refUnread(r.id),
    ).length;
    const total = topicTotals(RAW.map((r) => r.kind)).szamlazas;
    check(want !== total, "a fixture bizonyítja az utat: a szűrt és a teljes szám KÜLÖNBÖZIK", `${want} vs ${total}`);
    const html = messagesSection(topicView({ unread: true }, selfTest));
    check(
      chipCount(html, "Számlázás") === want,
      `az „Olvasatlan" mellett a „Számlázás" chip ${want}-et mond (nem a teljes postaláda ${total}-át)`,
      `${chipCount(html, "Számlázás")}`,
    );
  }

  // ── a CSATORNA-chipek is számot viselnek (Elek FK-001 Z2) ──────────────────
  // Mérve 2026-09-13: a téma-sor minden chipjén ott állt a szám („Foglalások 0"
  // előre jelezte, hogy üres lesz), az E-mail/SMS chipen viszont NEM — pedig mind
  // a 71 sor e-mail volt, tehát az „SMS" biztosan üres listára vitt. Két sor, két
  // logika; a felület némán engedte bele a tulajt egy zsákutcába, miközben a kártya
  // bevezetője „e-mailben és SMS-ben"-t ígér. Contract ③: MINDEN chip száma ugyanabból
  // az egy predikátumból jön.
  {
    // ① SZERKEZET: a szám ott VAN. Az öntesztben a fix ELŐTTI markupot állítjuk
    //    vissza (kivesszük a két csatorna-chip <em>-jét) — enélkül ez az állítás
    //    sosem lehetne piros, tehát nem is lenne bizonyíték.
    const clean = messagesSection(topicView({}));
    const html = selfTest
      ? clean.replace(
          /(<a class="adm-fchip[^"]*"[^>]*>(?:E-mail|SMS))<em>\d+<\/em>/g,
          "$1",
        )
      : clean;
    for (const label of ["E-mail", "SMS"]) {
      check(
        chipCount(html, label) !== null,
        `a „${label}" chipen OTT a darabszám`,
        "szám nélkül a csatorna-chip nem jelzi előre az üres találatot — ez vitte zsákutcába a tulajt",
      );
    }

    // ② SZEMANTIKA: a szám az AKTÍV téma-szűrővel EGYÜTT számol, és pontosan annyi,
    //    amennyit a kattintás szállít. A fixture bizonyítja a saját útját: a
    //    „Számlázás" körben 4 e-mail van, a teljes postaládában 10 — a naiv
    //    (teljes postaládás) megvalósítás tehát mérhetően más számot mondana.
    const scoped = channelTotals(
      RAW.filter((r) => REF_TOPIC_OF[r.kind] === "szamlazas").map((r) => r.ch),
    );
    const whole = channelTotals(RAW.map((r) => r.ch));
    check(
      scoped.email !== whole.email,
      `a fixture kiélezi az esetet: Számlázás∩E-mail ${scoped.email} ≠ postaláda-szintű ${whole.email}`,
      "azonos számmal a naiv és a helyes ág megkülönböztethetetlen lenne",
    );
    const withTopic = messagesSection(topicView({ topic: "szamlazas" }, selfTest));
    check(
      chipCount(withTopic, "E-mail") === scoped.email,
      `a „Számlázás" mellett az „E-mail" chip ${scoped.email}-et mond (nem a postaláda ${whole.email}-ét)`,
      `${chipCount(withTopic, "E-mail")}`,
    );
    // ÍGÉRET = SZÁLLÍTÁS: amit a chip mond, annyi sort ad a kattintás.
    const delivered = deliveredCount(
      messagesSection(topicView({ topic: "szamlazas", channel: "email" })),
    );
    check(
      delivered === scoped.email,
      `a „Számlázás + E-mail" kattintás ${scoped.email} sort szállít (${delivered})`,
    );

    // ③ A BEJELENTETT ESET: az üres csatorna KIMONDJA, hogy üres — mielőtt
    //    rákattintanának. Ez az a sor, ami a leletet magát zárja le.
    const noSms = channelTotals(
      RAW.filter((r) => REF_TOPIC_OF[r.kind] === "foglalas").map((r) => r.ch),
    );
    check(noSms.sms === 0, "a fixture bizonyítja az utat: a Foglalások körben nincs SMS");
    check(
      chipCount(messagesSection(topicView({ topic: "foglalas" }, selfTest)), "SMS") === 0,
      "üres csatornán a chip ELŐRE 0-t mond (nem néma zsákutca)",
      "ez a lelet maga: a szám nélküli SMS-chip élő választásnak látszott, és semmit nem szállított",
    );
  }

  // ── üres metszet: a sáv MARAD, hogy legyen mit visszakapcsolni (contract ⑦) ──
  {
    const html = messagesSection(topicView({ topic: "foglalas", channel: "sms" }, selfTest));
    check(deliveredCount(html) === 0, "Foglalások ∩ SMS = 0 üzenet");
    check(text(html).includes("Nincs a szűrésnek megfelelő üzenet"), "üres találatnál magyarázó szöveg");
    check(html.includes("adm-frow"), "üres találatnál is LÁTSZIK a szűrő-sáv (van mit visszakapcsolni)");
  }

  // ── ⑦ „Mind olvasott": annyit jelöl, amennyit a lista mutat ────────────────
  // Tulaj-döntés 2026-09-13. Eddig szűrt lista mellett is a TELJES postaládát
  // törölte — a gomb TÖBBET tett, mint amit a képernyő állított. A mérce a
  // FELIRAT és a HATÓKÖR együtt: egy gomb, ami a helyes sorokat jelöli meg, de
  // „Mind olvasott"-at ír, ugyanúgy hazudik.
  {
    // ── kontraktus ⑤: a felirat IGE, és a SAJÁT számát mondja ───────────────
    // ⛔ A RÉGI felirat („Mind olvasott (N)") állítás-alakú volt, ige nélkül, egy
    // SZŰRŐ mellett — ránézésre nem dönthető el, hogy szűrő, kijelzés vagy tömeges
    // művelet (Elek Z4). Az őr KIMONDJA, hogy a régi alak nem térhet vissza.
    const clean = messagesSection(topicView({}, selfTest));
    const wantAll = projectableRows().filter((r) => refUnread(r.id)).length;
    const tc = text(clean);
    check(
      tc.includes("Megjelölöm olvasottként") && tc.includes(`${wantAll} üzenet`),
      `szűrés nélkül a gomb IGÉS és ${wantAll}-et mond`,
      tc.slice(0, 220),
    );
    check(!/Mind olvasott \(/.test(tc), "a régi, ige nélküli „Mind olvasott (N)” felirat NEM tér vissza");

    // szűrve: MEGNEVEZI, hogy csak a szűrtre hat, és a saját számát mondja
    const want = projectableRows().filter(
      (r) => refUnread(r.id) && REF_TOPIC_OF[r.kind] === "szamlazas",
    ).length;
    const filtered = messagesSection(topicView({ topic: "szamlazas" }, selfTest));
    const t = text(filtered);
    check(t.includes(`a szűrt ${want} üzenetet`), `szűrve a gomb „a szűrt ${want} üzenetet”`, t.slice(0, 220));
    // ── kontraktus ⑤: MEGERŐSÍTÉST kér, és a POST CSAK ott áll ──────────────
    check(
      !/action="\/admin\/uzenetek\/olvasott"/.test(filtered),
      "a gomb ELSŐ kattintásra NEM cselekszik (nincs POST a listán, csak megerősítés-link)",
      "egy visszavonhatatlan tömeges művelet nem sülhet el egy koppintásra",
    );
    const confirmed = messagesSection({ ...topicView({ topic: "szamlazas" }, selfTest), confirmRead: true });
    const tcf = text(confirmed);
    check(tcf.includes("Csak a most szűrt listára hat"), "a megerősítés KIMONDJA a szűkített hatókört", tcf.slice(0, 220));
    // ⛔ a POST-nak vinnie KELL a szűrést, különben a szerver az egészet törli
    check(
      /<form method="POST" action="\/admin\/uzenetek\/olvasott"[^]*?name="t" value="szamlazas"/.test(confirmed),
      "a megerősítő POST-űrlap MAGÁVAL VISZI a téma-szűrőt (rejtett mező)",
      "enélkül a szerver a teljes postaládát jelölné olvasottnak",
    );
    const withCh = messagesSection({
      ...topicView({ topic: "szamlazas", channel: "sms" }, selfTest),
      confirmRead: true,
    });
    check(
      /name="c" value="sms"/.test(withCh) && /name="t" value="szamlazas"/.test(withCh),
      "a POST-űrlap MINDEN aktív dimenziót visz (téma + csatorna)",
    );

    // nincs olvasatlan a hatókörben → NINCS gomb (nem kínálunk üres műveletet)
    const none = messagesSection(topicView({ topic: "foglalas" }, selfTest));
    const unreadInScope = projectableRows().filter(
      (r) => r.readAt === null && REF_TOPIC_OF[r.kind] === "foglalas",
    ).length;
    check(unreadInScope === 0, "a fixture bizonyítja az utat: a Foglalások körben nincs olvasatlan");
    check(
      !/action="\/admin\/uzenetek\/olvasott"/.test(none),
      "ha a hatókörben nincs olvasatlan, a gomb el is tűnik",
    );
  }

  // ── a szál-jelölés a téma-szűrőben is ott van (ADR-0125 nem sérült) ─────────
  {
    const html = messagesSection(topicView({ topic: "foglalas", openThreads: allThreadKeys() }, selfTest));
    const row = rowsOf(html, "adm-msg").find((r) => r.includes('id="uz-m7"'));
    check(
      Boolean(row && text(row).includes("Túlhaladott")),
      "a téma-szűrt listán is ott a „Túlhaladott” jelölés (az ADR-0125 sértetlen)",
    );
  }
}

/* ⑦ A „Ez a legfrissebb” jelvény MEGNEVEZI, MINEK a legfrissebbje (FK-006b HIBA-1).
      Mérve 2026-09-13: a feed tetején KÉT sor viselte egyszerre a zöld jelvényt,
      azonos időbélyeggel — egy foglalás-szál és a dunning-létra feje. Egyik állítás
      sem volt hamis, de a jelvény nem nevezett meg halmazt, amiben egyedi, ezért
      egymás alatt ellentmondásnak olvasódott.

      ⛔ FÜGGETLEN REFERENCIA: a `kind → szál-tárgy` leképezést ITT írjuk ki kézzel;
      a `threadSubjectLabel()` importálása azt jelentené, hogy az őr a saját
      vizsgálatának tárgyát hívja (feedback_guard_must_not_borrow_its_subject). */
{
  console.log("\n⑦ A szálfej megnevezi a szálát (FK-006b HIBA-1)");

  const REF_SUBJECT_OF: Record<string, string> = {
    dunning: "előfizetés",
    multilang: "többnyelvű modul",
    booking: "foglalási kérés",
  };
  const kindOf = new Map(RAW.map((r) => [r.id, r.kind as string]));
  const titleOf = new Map(RAW.map((r) => [r.id, r.subject ?? r.body.split("\n")[0]!]));

  // A rontás a JELVÉNYT célozza, nem a szálasítást: a pozíciók megmaradnak, csak a
  // tárgyuk tűnik el — pontosan a bejelentett, fix ELŐTTI állapot. Enélkül ez az
  // állítás sosem lehetne piros (a ④ rontása minden jelvényt eltüntet, és egy
  // „nulla jelvény" nézeten a ⑦ üresen zöld maradna).
  const view = { ...messagesFixture(false), openThreads: allThreadKeys() };
  const rendered = messagesSection(
    selfTest
      ? {
          ...view,
          messages: view.messages.map((m) => ({
            ...m,
            // A fix ELŐTTI jelvény: se tárgy, se „mennyit vált le" — csak a puszta
            // „Ez a legfrissebb". A szálasítás maga érintetlen marad (a
            // „Túlhaladott" sorok itt is állnak), hogy a ⑦ tényleg a JELVÉNYT mérje.
            thread: { ...m.thread, subject: null, supersedesTitle: null, olderCount: 0 },
          })),
        }
      : view,
  );
  const rows = rowsOf(rendered, "adm-msg");
  const rowById = new Map<string, string>();
  for (const r of rows) {
    const id = /id="uz-([^"]+)"/.exec(r)?.[1];
    if (id) rowById.set(id, r);
  }
  const badgeRows = [...rowById].filter(([, html]) => text(html).includes("Ez a legfrissebb"));

  check(
    badgeRows.length >= 3,
    `a fixture a bejelentett helyzetet állítja elő: ${badgeRows.length} sor viseli egyszerre a jelvényt`,
    "egyetlen jelvénnyel a bejelentett ellentmondás meg sem jelenhetne",
  );

  // ① MINDEGYIK megnevezi a szálát — és azt, amelyikben tényleg benne van.
  const named = badgeRows.filter(([id, html]) => {
    const want = REF_SUBJECT_OF[kindOf.get(id) ?? ""] ?? "";
    return want !== "" && text(html).includes(`Ez a legfrissebb — ${want}`);
  });
  check(
    named.length === badgeRows.length,
    `mind a ${badgeRows.length} jelvény megnevezi a szálát (${named.length})`,
    "egy halmazt nem nevező egyediség-állítás két sorra kiadva ellentmondásnak olvasódik — a jelvény mondja meg, MINEK a legfrissebbje",
  );

  // ② AZONOS TÁRGYÚ szálfejek: a `tenant`-szabályú szálakból (előfizetés,
  //    többnyelvű) fiókonként EGY van, a foglalás-szálból viszont sok — két
  //    „foglalási kérés" fej csak akkor különböztethető meg, ha megnevezik a
  //    felülírt üzenetet is.
  const bySubject = new Map<string, string[]>();
  for (const [id] of badgeRows) {
    const s = REF_SUBJECT_OF[kindOf.get(id) ?? ""] ?? "?";
    bySubject.set(s, [...(bySubject.get(s) ?? []), id]);
  }
  const dupSubjects = [...bySubject].filter(([, ids]) => ids.length > 1);
  check(
    dupSubjects.length > 0,
    `a fixture kiélezi az esetet: „${dupSubjects.map(([s, ids]) => `${s}” ×${ids.length}`).join(", ")}`,
    "azonos tárgyú szálfejek nélkül a megkülönböztetés nem mérhető",
  );
  const distinguished = dupSubjects.every(([, ids]) =>
    ids.every((id) => {
      const t = text(rowById.get(id) ?? "");
      // A szál másik (felülírt) tagjának a CÍME álljon a soron.
      const other = RAW.find(
        (r) => r.id !== id && r.relId === RAW.find((x) => x.id === id)?.relId,
      );
      return other ? t.includes(titleOf.get(other.id) ?? "\u0000") : false;
    }),
  );
  check(
    distinguished,
    "az azonos tárgyú szálfejek megnevezik, MELYIK üzenetet írják felül",
    "két egyforma „Ez a legfrissebb — foglalási kérés” jelvény ugyanazt a kétértelműséget termelné újra",
  );

  // ③ A több tagú szál feje SZÁMOT mond (a dunning-létrán 3 korábbi üzenet van) —
  //    egy önkényesen kiválasztott cím ott félrevezetne.
  const ladderHead = [...rowById].find(([id]) => id === "m3");
  check(
    Boolean(ladderHead && /\d+ korábbi üzenetet ír felül/.test(text(ladderHead[1]))),
    "a több tagú szál feje kiírja, hány korábbi üzenetet ír felül",
    "a „Felülírta: …” sor tükre: a fej is mondja meg, mennyit vált le",
  );

  // ④ NEGATÍV: szálon kívüli sor nem kaphat tárgyat sem.
  const strayNamed = [...rowById].filter(
    ([id, html]) =>
      !REF_SUBJECT_OF[kindOf.get(id) ?? ""] && text(html).includes("Ez a legfrissebb"),
  );
  check(
    strayNamed.length === 0,
    "szálon kívüli sor egyáltalán nem visel jelvényt",
    `jelvényt kapott: ${strayNamed.map(([id]) => id).join(", ")}`,
  );
}

/* ⑨ AZ ÜGY A SOR, ÉS SEMMI NEM TŰNIK EL (kontraktus ①, tulaj-döntés 2026-09-14).
      Mérve (Elek FK-001 E1): a 71 soros lista 69%-a ugyanannak az EGY előfizetés-ügynek
      a túlhaladott lépése volt, 9 körben ismételve — 8817px, ≈9 képernyő.

      ⛔ AMI ITT A LEGFONTOSABB: az összecsukás NEM vehet el semmit. Egy „javítás", ami
      valós adatot rejt el, pontosan az a hibaosztály, ami miatt az ADR-0127 ① annak
      idején ELUTASÍTOTTA a szálba csukást. Ezért az őr nem azt méri, hogy kevesebb sor
      lett, hanem hogy a TALÁLAT-SZÁM és a KINYITOTT tartalom hiánytalan. */
{
  console.log("\n⑨ Az ügy a sor — és semmi nem tűnik el (kontraktus ①)");

  const keys = allThreadKeys();
  // ⛔ ÖNTESZT: a fix ELŐTTI állapot — NINCS ügy-csoportosítás, minden üzenet önálló
  // sor, és a soron nincs megnyitó jelzés. Enélkül ez a három állítás sosem lehetne
  // piros, tehát nem is lenne bizonyíték (feedback_fixture_must_prove_its_own_path).
  const revert = (html: string): string =>
    selfTest ? html.replace(/<span class="adm-msg__more">[^<]*<\/span>/g, "") : html;
  const closed = revert(messagesSection(topicView(selfTest ? { openThreads: keys } : {})));
  const opened = revert(messagesSection(topicView({ openThreads: keys })));

  const closedRows = rowsOf(closed, "adm-msg").length;
  const openRows = rowsOf(opened, "adm-msg").length;
  check(keys.length > 0, `a fixture-ben van szál (${keys.length} ügy: ${keys.join(", ")})`);
  check(
    closedRows < openRows,
    `csukva ${closedRows} sor, kinyitva ${openRows} — az ügy tényleg összecsukódik`,
  );
  check(openRows === RAW.length, `kinyitva MIND a ${RAW.length} üzenet ott van (${openRows})`);

  // ⛔ A TALÁLAT-SZÁM VÁLTOZATLAN: a csukás a megjelenítés, nem a halmaz.
  check(
    deliveredCount(closed) === RAW.length && deliveredCount(opened) === RAW.length,
    `a találat-szám mindkét állapotban ${RAW.length} üzenet (nem a sorokat számolja)`,
    `csukva: ${deliveredCount(closed)}, nyitva: ${deliveredCount(opened)}`,
  );

  // A nyitó MEGNEVEZI, hány lépés van mögötte — egy néma háromszög nem mondja meg,
  // mit rejt, és a tulaj nem tudja eldönteni, érdemes-e rákattintani.
  const openerText = text(closed);
  const hidden = RAW.length - closedRows;
  check(
    /Ugyanennek az ügynek a korábbi \d+ lépése/.test(openerText),
    `a nyitó megnevezi a lépések SZÁMÁT (${hidden} sor van összecsukva)`,
    openerText.slice(0, 200),
  );

  // ⛔ A KERESÉS ÁTLÁT A CSUKOTT ÜGYÖN: egy csak a lépésben előforduló szóra is
  // találatot kell adni, különben a csukás elrejtene egy találatot.
  {
    const deep = RAW.find((r) => r.id === "m6")!; // „Esedékes a honlapdíj" — egy LÉPÉS, nem szálfej
    check(REF_SUPERSEDED.has(deep.id), "a fixture bizonyítja az utat: a keresett sor egy ÖSSZECSUKOTT lépés");
    const hit = messagesSection(topicView({ q: "Esedékes" }));
    check(
      deliveredCount(hit) > 0,
      "a keresés a CSUKOTT ügy lépésére is talál",
      `találat: ${deliveredCount(hit)}`,
    );
  }

  // Kontraktus ④: minden soron ott a megnyitó jelzés.
  const rowsClosed = rowsOf(closed, "adm-msg");
  const withMore = rowsClosed.filter((r) => text(r).includes("Megnyitom")).length;
  check(
    withMore === rowsClosed.length,
    `mind a ${rowsClosed.length} soron ott a „Megnyitom ▾" jelzés (${withMore})`,
    "e nélkül a csonkolt előnézet mellett semmi nem jelzi, hogy a kártya kattintható (KK3)",
  );
}

/* ⑩ A TÚLHALADOTT NEM OLVASATLAN (kontraktus ②).
      Mérve (Elek FK-001 E2): a bal menü 71-et riasztott, és abból 49 olyan sor volt,
      amit a RENDSZER MAGA nyilvánított elavultnak. Teendőnek mutattuk azt, amit mi
      magunk zártunk le.

      ⛔ A referencia FÜGGETLEN (refUnread), nem a termék isUnread()-je. */
{
  console.log("\n⑩ A túlhaladott üzenet NEM olvasatlan (kontraktus ②)");

  const wantNew = RAW.filter((r) => refUnread(r.id)).length;
  const wantOld = RAW.filter((r) => UNREAD_IDS.has(r.id)).length;
  check(
    wantNew < wantOld,
    `a fixture kiélezi az esetet: a régi szabállyal ${wantOld}, az újjal ${wantNew} olvasatlan`,
    "azonos számmal a régi és az új szabály megkülönböztethetetlen lenne",
  );

  // ⛔ ÖNTESZT: a RÉGI szabály — a túlhaladott sor is olvasatlanként számít, és a
  // jelölést is megkapja. Pontosan az az állapot, amit az Elek E2 mért.
  const base = topicView({});
  const html = selfTest
    ? messagesSection({ ...base, unreadCount: wantOld }).replace(
        /class="adm-msg( is-past)?/g,
        'class="adm-msg is-unread$1',
      )
    : messagesSection(base);
  check(
    chipCount(html, "Olvasatlan") === wantNew,
    `az „Olvasatlan" chip ${wantNew}-et mond (a túlhaladottak nélkül)`,
    `${chipCount(html, "Olvasatlan")}`,
  );

  // ÍGÉRET = SZÁLLÍTÁS: az „Olvasatlan" szűrő pontosan ennyit ad.
  check(
    deliveredCount(messagesSection(topicView({ unread: true }))) === wantNew,
    `az „Olvasatlan" szűrő ${wantNew} üzenetet szállít`,
  );

  // ⛔ EGY SZABÁLY, EGY FORRÁS: a gomb is ugyanezt a számot mondja.
  check(
    text(html).includes(`${wantNew} üzenet`),
    `a tömeges jelölés gombja UGYANEZT a ${wantNew}-et mondja`,
    text(html).slice(0, 220),
  );

  // NEGATÍV: egyetlen túlhaladott sor sem visel olvasatlan-jelölést.
  const openedRaw = messagesSection(topicView({ openThreads: allThreadKeys() }));
  const opened = selfTest
    ? openedRaw.replace(/class="adm-msg( is-past)?/g, 'class="adm-msg is-unread$1')
    : openedRaw;
  const badRows = rowsOf(opened, "adm-msg").filter(
    (r) => /class="adm-msg[^"]*is-unread/.test(r) && /class="adm-msg[^"]*is-past/.test(r),
  );
  check(
    badRows.length === 0,
    "egyetlen túlhaladott sor sem visel olvasatlan-jelölést",
    `${badRows.length} sor egyszerre túlhaladott ÉS olvasatlan`,
  );
}

/* ⑪ AZ ELŐNÉZET A TARTALMAT MUTATJA, NEM A MEGSZÓLÍTÁST (kontraktus ③).
      Mérve (Elek FK-001 E3): 19 számla-értesítő előnézete betűre azonos volt
      („Kedves Elek Teszt!"), mert a szabály „a törzs első nem-üres sora" volt. */
{
  console.log("\n⑪ Az előnézet a tartalom, nem a megszólítás (kontraktus ③)");

  // ⛔ ÖNTESZT: a RÉGI szabály — az előnézet a törzs ELSŐ nem-üres sora, ami a
  // számla-értesítőknél a MEGSZÓLÍTÁS. Ez állítja vissza a bejelentett állapotot.
  const bodyOf = new Map(RAW.map((r) => [r.id, r.body.split("\n").map((l) => l.trim()).find(Boolean) ?? ""]));
  const rawHtml = messagesSection(topicView({ openThreads: allThreadKeys() }));
  const html = selfTest
    ? rawHtml.replace(
        /(<div class="adm-msg[^"]*" id="uz-([^"]+)">)([^]*?)<span class="pv">[^<]*<\/span>/g,
        (_all, head: string, id: string, mid: string) =>
          `${head}${mid}<span class="pv">${bodyOf.get(id) ?? ""}</span>`,
      )
    : rawHtml;
  const previews = [...html.matchAll(/<span class="pv">([^<]*)<\/span>/g)].map((m) => m[1]!.trim());
  check(previews.length === RAW.length, `mind a ${RAW.length} sor kapott előnézet-helyet (${previews.length})`);
  check(
    !previews.some((p) => /^Kedves|^Tisztelt/.test(p)),
    "egyetlen előnézet sem a megszólítással kezdődik",
    previews.filter((p) => /^Kedves|^Tisztelt/.test(p)).join(" | "),
  );

  // A számla-sor előnézete az ÖSSZEG — az, ami a CÍMBŐL hiányzik.
  const invRow = rowsOf(html, "adm-msg").find((r) => r.includes('id="uz-m1"'))!;
  check(
    text(invRow).includes("Összeg:"),
    "a számla-sor előnézete az ÖSSZEGET mutatja",
    text(invRow).slice(0, 160),
  );

  // ⛔ A SOR EGÉSZE EGYEDI: cím + előnézet együtt azonosítsa a bizonylatot.
  const keysOfRows = rowsOf(html, "adm-msg").map((r) => {
    const t = /<strong>([^<]*)<\/strong>/.exec(r)?.[1] ?? "";
    const p = /<span class="pv">([^<]*)<\/span>/.exec(r)?.[1] ?? "";
    return `${t}|${p}`;
  });
  check(
    new Set(keysOfRows).size === keysOfRows.length,
    `mind a ${keysOfRows.length} SOR egyedi (cím + előnézet együtt)`,
    `${new Set(keysOfRows).size} különböző`,
  );

  // ⛔ AZ ELŐNÉZET NEM VISSZHANG: tárgy nélküli SMS-nél a lista a törzs első sorából
  // címez — mérve, a naiv szabály ugyanazt a sort tette az előnézetbe is, és a
  // kártya mindent kétszer mondott.
  const smsRow = rowsOf(html, "adm-msg").find((r) => r.includes('id="uz-m5"'))!;
  const smsTitle = /<strong>([^<]*)<\/strong>/.exec(smsRow)?.[1] ?? "";
  const smsPv = /<span class="pv">([^<]*)<\/span>/.exec(smsRow)?.[1] ?? "";
  check(
    smsPv === "" || smsPv !== smsTitle,
    "tárgy nélküli SMS-nél az előnézet NEM ismétli meg a címet",
    `cím: „${smsTitle}" · előnézet: „${smsPv}"`,
  );
}

/* ⑧ AZ ÉV-SZŰRŐ NEM KÉR DÖNTÉST, AMIT NEM TUD ELDÖNTENI (Elek FK-001 E6).
      Mérve 2026-09-13: a Dokumentumok keresője mellett `Mind` / `2026` állt, és
      mind a 19 bizonylat 2026-os volt — a két gomb UGYANAZT a 19 sort adta. Egy
      szűrő, ami nem szűr, nem semleges: döntésnek látszik, elveszi a helyet, és a
      tulaj hiába keresi, mi a különbség.

      A SZABÁLY, amit mérünk: KÉT KÜLÖNBÖZŐ ÉV-CHIP NEM SZÁLLÍTHATJA UGYANAZT.
      Ez erősebb, mint a „ha egy év van, ne legyen chip" megvalósítás-részlet — és
      ez az, ami a felhasználó előtt számít. Mindkét ág POZITÍVAN mérve: az egy-éves
      fixture-nek nincs chipje, a két-évesnek van, és ott minden chip mást ad.
      Enélkül az állítás üresen zöld maradna egy olyan fában, ahol chip sincs
      (feedback_fixture_must_prove_its_own_path). */
{
  console.log("\n⑧ Dokumentumok — az év-szűrő tényleg szűr (E6)");

  /** A sávon kirenderelt év-chipek feliratai. */
  const yearChips = (html: string): string[] =>
    (html.match(/<a class="adm-fchip[^]*?<\/a>/g) ?? []).map((c) => text(c)).filter(Boolean);

  // ── EGY év: a fixture pontosan a bejelentett eset (minden bizonylat 2026-os) ──
  {
    const one = documentsFixture(selfTest);
    check(
      new Set(one.invoices.map((i) => i.year)).size === 1,
      "a fixture a bejelentett eset: EGYETLEN év van az adatban",
    );
    const clean = documentsSection(one);
    // ⛔ ÖNTESZT: a fix ELŐTTI markupot állítjuk vissza (visszatesszük a „Mind” és a
    // „2026” gombot a kereső mögé) — enélkül ez az állítás sosem lehetne piros.
    const html = selfTest
      ? clean.replace(
          /(<\/span>)(?=(?:<a class="adm-clearf")|<\/form>)/,
          '$1<a class="adm-fchip is-active" href="/admin?tab=dokumentumok">Mind</a>' +
            '<a class="adm-fchip" href="/admin?tab=dokumentumok&f=2026">2026</a>',
        )
      : clean;
    const chips = yearChips(html);
    check(
      chips.length === 0,
      "egyetlen évnyi adatnál NINCS év-chip (nincs mit szétválasztani)",
      `kirenderelt chipek: ${chips.join(", ") || "—"}`,
    );
    // A szabály maga: ha mégis van chip, egyik sem adhatja ugyanazt, mint a „Mind”.
    const all = rowsOf(documentsSection({ ...one, year: "mind" }), "adm-inv").length;
    const same = chips
      .filter((c) => c !== "Mind")
      .filter((c) => rowsOf(documentsSection({ ...one, year: c }), "adm-inv").length === all);
    check(
      same.length === 0,
      "nincs olyan év-chip, ami ugyanazt szállítja, mint a „Mind”",
      `azonos eredményű: ${same.join(", ")} (mindegyik ${all} sor)`,
    );
  }

  // ── KÉT év: a chipek MEGJELENNEK, és mindegyik MÁST ad ──────────────────────
  // Ez a pozitív kontroll: a javítás nem „kikapcsolta" a szűrőt, csak ott nem
  // kínálja, ahol nincs mit eldönteni.
  {
    const base = documentsFixture(false);
    const two: DocumentsAdminData = {
      ...base,
      invoices: base.invoices.map((inv, i) =>
        i < 3
          ? { ...inv, year: "2025", issuedAt: new Date("2025-09-12T10:00:00+02:00") }
          : inv,
      ),
    };
    const html = documentsSection(two);
    const chips = yearChips(html);
    check(
      chips.includes("Mind") && chips.includes("2025") && chips.includes("2026"),
      "két évnyi adatnál MIND a három gomb ott van (Mind / 2025 / 2026)",
      `kirenderelt: ${chips.join(", ") || "—"}`,
    );
    const delivered = new Map(
      chips.map((c) => [c, rowsOf(documentsSection({ ...two, year: c === "Mind" ? "mind" : c }), "adm-inv").length]),
    );
    check(
      new Set(delivered.values()).size === delivered.size,
      "minden év-chip KÜLÖNBÖZŐ számú sort szállít",
      [...delivered].map(([c, n]) => `${c}: ${n}`).join(" · "),
    );
  }
}

console.log(
  selfTest
    ? fails > 0
      ? `\n✅ ÖNTESZT RENDBEN: a visszarontott nézeten ${fails} sértés — az őr tényleg mér`
      : `\n❌ ÖNTESZT BUKOTT: a visszarontott nézeten NEM talált semmit`
    : fails > 0
      ? `\n❌ ${fails} sértés`
      : `\n✅ minden állítás zöld`,
);
process.exit(selfTest ? (fails > 0 ? 0 : 1) : fails > 0 ? 1 : 0);
