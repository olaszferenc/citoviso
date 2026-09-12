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
  { id: "m1", ch: "email", kind: "invoice", subject: "Számla OV-2026-43", body: "…", at: "11:36", rel: "invoice", relId: "i43" },
  { id: "m2", ch: "email", kind: "booking", subject: "Lejárt egy foglalási kérés", body: "…", at: "10:36", rel: "booking_request", relId: "b1" },
  { id: "m3", ch: "email", kind: "dunning", subject: "Honlapja újra elérhető", body: "A díjat megkaptuk…", at: "10:35" },
  { id: "m4", ch: "email", kind: "dunning", subject: "Honlapja felfüggesztve", body: "A rendezetlen díj miatt…", at: "10:34" },
  { id: "m5", ch: "sms", kind: "dunning", subject: null, body: "Citoviso: honlapja hamarosan felfüggesztésre kerül…", at: "10:33" },
  { id: "m6", ch: "email", kind: "dunning", subject: "Esedékes a honlapdíj", body: "…", at: "10:32" },
  { id: "m7", ch: "email", kind: "booking", subject: "Foglalási kérés: Elek Vendég", body: "…", at: "10:23", rel: "booking_request", relId: "b1" },
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
  const EMPTY = { supersededBy: null, isLatestOfThread: false, olderCount: 0 } as const;
  return {
    messages: threadable.map((t) => ({
      id: t.id,
      channel: t.channel,
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
    filter: "mind",
    q: "",
    openId: null,
  };
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
  const rendered = messagesSection(messagesFixture(selfTest));
  const html = selfTest
    ? rendered.replace(/<span class="adm-msg__chan[^>]*>[\s\S]*?<\/span>/g, "")
    : rendered;
  const rows = rowsOf(html, "adm-msg");
  console.log("\n③ Üzenetek — csatorna-jelölés a soron (Z2)");
  check(rows.length === RAW.length, `mind a ${RAW.length} üzenet-sor kirenderelődött (${rows.length})`);
  let right = 0;
  for (let i = 0; i < rows.length; i++) {
    const want = RAW[i]!.ch === "sms" ? "SMS" : "E-mail";
    const other = RAW[i]!.ch === "sms" ? "E-mail" : "SMS";
    const t = text(rows[i]!);
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
  const data = messagesFixture(selfTest);
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
  const view = messagesSection({ ...messagesFixture(false), filter: "sms" });
  const smsRow = rowsOf(view, "adm-msg").find((r) => r.includes(`id="uz-${smsId}"`));
  check(
    Boolean(smsRow && text(smsRow).includes("Túlhaladott")),
    "SMS-szűrőben is túlhaladottként jelenik meg",
  );
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
