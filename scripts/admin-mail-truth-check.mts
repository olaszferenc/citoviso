// ADMIN-MAIL-TRUTH őr — három apró hazugság a tulaj felé (Elek 2. kör #21 #23 #24-From).
//
//   npx tsx scripts/admin-mail-truth-check.mts [--self-test]
//
//  #21 Az Áttekintés „Üzenetek" widgetje az SMS-sort cím NÉLKÜL mutatta (csak pötty +
//      dátum): `messagePreview(m, "")` üres címmel MINDEN sort „visszhangnak" lát, és
//      üreset ad. Az Üzenetek fül a törzs első sorából címez. A widget most
//      `messageTitle()`-t hív, és az őr a VALÓDI fül-render (`messagesSection()`)
//      kimenetén méri, hogy ugyanazt a címet adja.
//  #23 A számla-levél „csatoltuk / mellékletében" mondatot írt akkor is, amikor NEM
//      volt PDF (mock számlázó, vagy a valódi szolgáltató hibája). A levél nem ígérhet
//      mellékletet, ami nincs ott.
//  #24 A mock outbox From-sora `"Citoviso" <Citoviso <x@y>>` volt — a mock nem azt
//      mutatta, amit az SMTP küld. `formatFrom()` a csupasz címet teszi a név mellé.
//
// Hermetikus: nincs DB, nincs szerver — tiszta függvényhívások.
//
// --self-test a fixtúrákat a JAVÍTÁS ELŐTTI állapotra fordítja (régi widget-cím, régi
// From-formázás, a PDF-es/PDF-nélküli eset felcserélve) — az őrnek pirosra kell mennie.

import { messagePreview, messageTitle } from "../src/tenant/messagePreview.js";
import { buildInvoiceEmail } from "../src/email/invoiceEmail.js";
import { formatFrom } from "../src/email/sender.js";
import { messagesSection } from "../src/server/adminViews.js";
import { positionThreads } from "../src/tenant/messageThreads.js";

const selfTest = process.argv.includes("--self-test");

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ⛔ ${msg}`);
};
const pass = (msg: string) => console.log(`  ✔ ${msg}`);

// ── #21: az SMS-sor címe a widgetben ─────────────────────────────────────────
{
  console.log("#21 — Áttekintés/Üzenetek widget: az SMS-nek is van címe");
  const sms = {
    kind: "sms" as const,
    subject: null,
    bodyText: "Új foglalási kérés érkezett: 2026-10-12 – 2026-10-14, 2 fő.\nNézze meg az adminban.",
  };
  // Pre-fix widget rule (public.ts before Elek2 #21).
  const widgetTitle = selfTest
    ? (sms.subject ?? messagePreview(sms as never, "", "hu"))
    : messageTitle(sms);
  const firstLine = sms.bodyText.split("\n")[0]!;
  if (!widgetTitle.trim()) fail("az SMS widget-címe ÜRES (csak pötty + dátum látszik)");
  else pass(`az SMS widget-címe nem üres: „${widgetTitle}”`);
  if (widgetTitle !== firstLine.slice(0, 90)) fail("a widget-cím nem a törzs első sora");
  else pass("a widget-cím = a törzs első sora");

  // The widget title must be the one the REAL Üzenetek tab renders for the same row —
  // measured on messagesSection()'s output, not on a hand-copied rule.
  const sentAt = new Date("2026-10-09T10:00:00+02:00");
  const pos = positionThreads([
    { id: "s1", kind: sms.kind, channel: "sms", subject: null, bodyText: sms.bodyText, relatedKind: null, relatedId: null, sentAt },
  ] as never);
  const tab = messagesSection(
    {
      messages: [
        {
          id: "s1",
          channel: "sms",
          kind: sms.kind,
          subject: null,
          bodyText: sms.bodyText,
          recipient: "+36301234567",
          attachmentName: null,
          relatedKind: null,
          relatedId: null,
          sentAt,
          readAt: sentAt,
          thread: pos.get("s1")!,
        },
      ],
      unread: 0,
      topic: "mind",
      channel: "",
      unreadOnly: false,
      q: "",
      total: 1,
      mindCount: 1,
      topicCounts: { foglalas: 0, szamlazas: 0, honlap: 0, fiok: 0 },
      channelCounts: { email: 0, sms: 1 },
      unreadCount: 0,
      openId: null,
      openThreads: [],
      confirmRead: false,
    } as never,
    "hu",
  );
  const escHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  if (!widgetTitle || !tab.includes(`>${escHtml(widgetTitle)}<`)) fail("a widget-cím nem az, amit az Üzenetek fül ugyanarra a sorra kiír");
  else pass("a widget-cím = az Üzenetek fül renderelt címe");
  const mail = { kind: "invoice" as const, subject: "Számla OV-1 – Honlap", bodyText: "Kedves X!" };
  if (messageTitle(mail) !== mail.subject) fail("tárgyas üzenetnél a cím nem a tárgy");
  else pass("tárgyas üzenetnél a cím a tárgy");
}

// ── #23: a számla-levél nem ígér nem létező mellékletet ──────────────────────
{
  console.log("#23 — számla-levél: melléklet-ígéret csak valódi melléklettel");
  const claim = /csatol|mellék/i;
  const base = {
    to: "vevo@example.com",
    buyerName: "Teszt Elek",
    buyerIsPerson: true,
    siteName: "Teszt Vendégház",
    invoiceNumber: "OV-2026-1",
    gross: 14900,
    currency: "HUF",
    period: "annual" as const,
    lang: "hu",
  };
  // platformMail may add its own inline (cid) images — only a PDF counts here.
  const pdfs = (m: { attachments?: readonly { contentType?: string }[] }) =>
    (m.attachments ?? []).filter((a) => a.contentType === "application/pdf").length;
  const pdf = Buffer.from("%PDF-1.4 fixture").toString("base64");
  // Self-test swaps the two fixtures: the "no PDF" case gets a PDF and vice versa.
  const noPdf = buildInvoiceEmail({ ...base, pdfBase64: selfTest ? pdf : null });
  const withPdf = buildInvoiceEmail({ ...base, pdfBase64: selfTest ? null : pdf });

  for (const period of ["annual", "monthly", "once"] as const) {
    const m = period === "annual" ? noPdf : buildInvoiceEmail({ ...base, period, pdfBase64: selfTest ? pdf : null });
    const hits = [m.text, m.html ?? ""].join("\n").split("\n").filter((l) => claim.test(l));
    if (hits.length) fail(`PDF nélkül (${period}) a levél mellékletet állít: „${hits[0]!.trim().slice(0, 120)}”`);
    else pass(`PDF nélkül (${period}) nincs „csatol/mellék” állítás`);
    if (pdfs(m)) fail(`PDF nélkül (${period}) mégis van melléklet`);
  }

  if (!pdfs(withPdf)) fail("PDF-fel NINCS melléklet");
  else pass("PDF-fel a melléklet megvan");
  if (!claim.test(withPdf.text)) fail("PDF-fel a szöveges rész nem mondja ki a mellékletet");
  else pass("PDF-fel a szöveges rész kimondja a mellékletet");
  if (!claim.test(withPdf.html ?? "")) fail("PDF-fel a HTML-rész nem mondja ki a mellékletet");
  else pass("PDF-fel a HTML-rész kimondja a mellékletet");
}

// ── #24: a mock From-sora = amit az SMTP küld ────────────────────────────────
{
  console.log("#24 — mock outbox From: egy mailbox, nem kettő egymásba");
  // Pre-fix mock rule (sender.ts MockEmailSender before Elek2 #24).
  const fmt = selfTest
    ? (name: string | null, addr: string) => (name ? `"${name}" <${addr}>` : addr)
    : formatFrom;
  const cases: [string | null, string, string][] = [
    ["Citoviso", "Citoviso <olasz.ferenc@citoviso.com>", '"Citoviso" <olasz.ferenc@citoviso.com>'],
    ["Citoviso", "hello@citoviso.com", '"Citoviso" <hello@citoviso.com>'],
    [null, "Citoviso <a@b.hu>", "Citoviso <a@b.hu>"],
  ];
  for (const [name, addr, want] of cases) {
    const got = fmt(name, addr);
    if (got !== want) fail(`formatFrom(${JSON.stringify(name)}, ${JSON.stringify(addr)}) = ${got} (várt: ${want})`);
    else pass(`formatFrom(${JSON.stringify(name)}, „${addr}”) → ${got}`);
  }
}

if (selfTest) {
  if (failures === 0) {
    console.error("\n⛔ ÖNTESZT: a javítás előtti fixtúra ZÖLD maradt — az őr vak.");
    process.exit(1);
  }
  console.log(`\n✔ ÖNTESZT: a javítás előtti állapot ${failures} hibát adott — az őr lát.`);
  process.exit(0);
}
if (failures) {
  console.error(`\n⛔ admin-mail-truth-check: ${failures} hiba.`);
  process.exit(1);
}
console.log("\n✔ admin-mail-truth-check: zöld.");
