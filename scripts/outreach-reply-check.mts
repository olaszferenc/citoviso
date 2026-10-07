// Válaszok a megkeresésekre (ADR-0339) — the reply pipeline's guard.
//
// What it pins down, each a MEASURED way the 2026-10-07 replies could have been lost or
// misattributed (contract: assets/design-refs/console/valaszok/README.md):
//   ① matchReply — only a sender we reached out to counts: a MineREAL number on the shared
//      modem is DROPPED, a message older than our first touch is DROPPED, a number shared by
//      two leads goes to the most recently contacted one; e-mail matches on the bare address.
//   ② assembleInbox — the real gammu shape of inbox ID 10+11: part 1's `TextDecoded` already
//      held the WHOLE message while its `Text` held only part 1, and part 2's `TextDecoded`
//      was EMPTY (the text only in `Text`, UCS-2 hex). Reading `TextDecoded` doubles the
//      message, reading it alone loses part 2 — `Text` first, once per part. The 8bit MMS
//      notification row (ID 9) is not a reply. A part that never arrives holds the message
//      back only for PART_WAIT_SEC, then it goes out `partial`.
//   ③ stripQuoted — the Gmail-HU quote header wraps its date onto the next line
//      („… ezt írta (időpont: 2026. okt. 7., Sze”): our own letter must not become the reply.
//   ④ the IMAP FETCH guard — anything but BODY.PEEK / RFC822.SIZE sets \Seen in the shared
//      mailbox; the reader must refuse it BEFORE a byte is sent.
//   ⑤ auto vs. manual — the Sent-folder automation marks an open reply 'postafiók', but never
//      over a manual „Visszavonás” (answer_undone_at) and never before the reply arrived.
//   ⑥ the dashboard block — under „Megválaszolatlan” an answered reply is hidden, EXCEPT the
//      one being looked at (?reply=<id>), or „Megválaszoltam” would pull the conversation and
//      its „Visszavonás” away under the operator's finger; 0 open → „mind megválaszolva”.
//
//   npx tsx scripts/outreach-reply-check.mts            (the checks)
//   npx tsx scripts/outreach-reply-check.mts --self-test (each check must go RED on a broken input)
//
// ⑤ writes ONE own row (source_key 'selftest:<uuid>') against an existing lead and deletes
// it by id in `finally`; everything else is pure.

import { randomUUID } from "node:crypto";

import { matchReply, markAutoAnswered, AUTO_ANSWERER, type SentContact } from "../src/replies/store.js";
import { assembleInbox, PART_WAIT_SEC, type InboxRow } from "../src/replies/gammu.js";
import { stripQuoted } from "../src/replies/mime.js";
import { ImapReader } from "../src/replies/imap.js";
import { repliesBlockHtml } from "../src/console/views.js";
import type { ReplyView, RepliesBlock } from "../src/replies/store.js";
import { db } from "../src/db/client.js";

const SELF_TEST = process.argv.includes("--self-test");

let failures = 0;
function check(label: string, ok: boolean, detail = ""): boolean {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

/** UCS-2 BE hex, the way gammu stores `Text`. */
function ucs2(s: string): string {
  const b = Buffer.from(s, "utf16le");
  b.swap16();
  return b.toString("hex").toUpperCase();
}

// ---------- ① matcher ----------
const T0 = new Date("2026-10-06T09:00:00Z");
const contacts: SentContact[] = [
  { leadId: "L-old", prospectId: "P-old", firstSentAt: new Date("2026-09-01T09:00:00Z"), phone: "+36301112222", emails: [] },
  { leadId: "L-new", prospectId: "P-new", firstSentAt: T0, phone: "+36301112222", emails: ["info@villa.example"] },
  { leadId: "L-late", prospectId: "P-late", firstSentAt: new Date("2026-10-08T09:00:00Z"), phone: "+36309998888", emails: [] },
];
function matcherCases(match: typeof matchReply): boolean[] {
  const at = "2026-10-07T10:00:00Z";
  return [
    check("① közös szám → a legutóbb megkeresett lead", match({ channel: "sms", from: "06 30 111 2222", receivedAt: at }, contacts)?.leadId === "L-new"),
    check("① ismeretlen (MineREAL) szám → eldobva", match({ channel: "sms", from: "+36205550000", receivedAt: at }, contacts) === null),
    check("① az első megkeresésnél korábbi üzenet → eldobva", match({ channel: "sms", from: "+36309998888", receivedAt: at }, contacts) === null),
    check(
      "① e-mail: a puszta cím számít (név + kisbetű)",
      match({ channel: "email", from: "Villa <INFO@villa.example>", receivedAt: at }, contacts)?.leadId === "L-new",
    ),
    check("① ismeretlen e-mail → eldobva", match({ channel: "email", from: "dmarc@google.com", receivedAt: at }, contacts) === null),
  ];
}

// ---------- ② gammu assembly (shape of the real inbox rows 9, 10, 11 — synthetic text) ----------
const P1 = "Üdvözlöm, érdeklődnék, mennyibe kerülne a weboldal, és van-e további ";
const P2 = "költsége az üzemeltetésnek? Köszönöm!";
const AT = 1791369778;
const realShape: InboxRow[] = [
  { id: 9, at: AT - 500000, sender: "+36301200971", udh: "0605040B840000", coding: "8bit", textDecoded: "", textHex: "000607BEAF84" },
  // Part 1: TextDecoded already carries BOTH parts, Text only part 1.
  { id: 10, at: AT, sender: "+36305550000", udh: "050003310201", coding: "Default_No_Compression", textDecoded: P1 + P2, textHex: ucs2(P1) },
  // Part 2: TextDecoded EMPTY, the text only in Text.
  { id: 11, at: AT, sender: "+36305550000", udh: "050003310202", coding: "Default_No_Compression", textDecoded: "", textHex: ucs2(P2) },
];
function assemblyCases(assemble: typeof assembleInbox): boolean[] {
  const out = assemble(realShape, AT + 60);
  const one = out.length === 1 ? out[0]! : null;
  const lost = assemble(realShape.slice(0, 2), AT + 60);
  const late = assemble(realShape.slice(0, 2), AT + PART_WAIT_SEC + 1);
  return [
    check("② a 10+11-es minta EGY üzenet (a 8bit MMS-értesítő nem válasz)", out.length === 1, `kapott: ${out.length} db`),
    check("② a szöveg pontosan a két rész, duplázás nélkül", one?.text === (P1 + P2).trim(), JSON.stringify(one?.text ?? null)),
    check("② a kulcs a legkisebb ID", one?.key === "sms:10", String(one?.key)),
    check("② hiányzó rész: a várakozási ablakon belül visszatartva", lost.length === 0, `kapott: ${lost.length} db`),
    check("② hiányzó rész: az ablak után partial-ként kimegy", late.length === 1 && late[0]!.partial, JSON.stringify(late)),
  ];
}

// ---------- ③ quoted text ----------
const GMAIL_HU =
  "Tisztelt Ferenc!\n\nKöszönjük, de nem kérünk honlapot.\n\nÜdv.\n\n" +
  "Villa Eszter <info@villa.example> ezt írta (időpont: 2026. okt. 7., Sze\n09:27):\n\n" +
  "> Tisztelt Villa Eszter! Átnéztük a nyilvánosan elérhető adatait.\n> https://villa-eszter.citoviso.com\n";
function quoteCases(strip: typeof stripQuoted): boolean[] {
  const s = strip(GMAIL_HU);
  return [
    check("③ Gmail-HU: a válasz saját szövege megmarad", s.startsWith("Tisztelt Ferenc!") && s.endsWith("Üdv."), JSON.stringify(s)),
    check("③ Gmail-HU: a mi levelünk (idézet + fejléc) levágva", !/ezt írta|citoviso\.com|Átnéztük/.test(s), JSON.stringify(s)),
  ];
}

// ---------- ④ FETCH guard ----------
async function rejects(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "";
  } catch (e) {
    return (e as Error).message;
  }
}
async function fetchCases(reader: Pick<ImapReader, "uidFetch">): Promise<boolean[]> {
  const res: boolean[] = [];
  for (const items of ["BODY[]", "BODY[HEADER.FIELDS (FROM)]", "RFC822", "RFC822.TEXT"]) {
    const m = await rejects(reader.uidFetch([1], items));
    res.push(check(`④ FETCH ${items} → a küldés ELŐTT elutasítva`, /BODY\.PEEK/.test(m), m || "nem dobott"));
  }
  // An allowed item gets past the guard and only then fails on the closed socket.
  for (const items of ["BODY.PEEK[]", "(UID RFC822.SIZE INTERNALDATE)"]) {
    const m = await rejects(reader.uidFetch([1], items));
    res.push(check(`④ FETCH ${items} → átengedve`, !/BODY\.PEEK/.test(m), m));
  }
  return res;
}

// ---------- ⑤ auto vs. manual (one own row in the dev DB) ----------
async function autoCases(markAuto: typeof markAutoAnswered): Promise<boolean[]> {
  // gate-subject-allow: any lead is only the FK target — its content is never read, the row is our own (deleted by id)
  const lead = await db.selectFrom("lead").select("id").limit(1).executeTakeFirst();
  if (!lead) return [check("⑤ van lead a dev DB-ben (FK-cél)", false)];
  const key = `selftest:${randomUUID()}`;
  const received = "2026-10-07T12:00:00.000Z";
  const row = await db
    .insertInto("outreach_reply")
    .values({ source_key: key, channel: "email", lead_id: lead.id, sender: "selftest@example.invalid", received_at: received, body: "önteszt" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const state = () =>
    db.selectFrom("outreach_reply").select(["answered_at", "answered_by"]).where("id", "=", row.id).executeTakeFirstOrThrow();
  const res: boolean[] = [];
  try {
    await markAuto([{ key, at: "2026-10-07T11:00:00.000Z" }]);
    res.push(check("⑤ a válasz ELŐTT küldött levél nem jelöl", (await state()).answered_at === null));
    await db.updateTable("outreach_reply").set({ answer_undone_at: new Date() }).where("id", "=", row.id).execute();
    await markAuto([{ key, at: "2026-10-07T13:00:00.000Z" }]);
    res.push(check("⑤ kézi Visszavonás után az automatika NEM jelöl vissza", (await state()).answered_at === null));
    await db.updateTable("outreach_reply").set({ answer_undone_at: null }).where("id", "=", row.id).execute();
    await markAuto([{ key, at: "2026-10-07T13:00:00.000Z" }]);
    const s = await state();
    res.push(check(`⑤ nyitott válasz + utána küldött levél → „${AUTO_ANSWERER}”`, s.answered_at !== null && s.answered_by === AUTO_ANSWERER, JSON.stringify(s)));
  } finally {
    await db.deleteFrom("outreach_reply").where("id", "=", row.id).execute();
  }
  return res;
}

// ---------- ⑥ the dashboard block ----------
function view(id: string, answered: boolean, mins: number): ReplyView {
  return {
    id,
    channel: "sms",
    leadId: `lead-${id}`,
    leadName: `Szállás ${id}`,
    place: "Siófok",
    sender: "+36305550000",
    senderName: null,
    receivedAt: new Date(Date.UTC(2026, 9, 7, 10, mins)),
    subject: null,
    body: `válasz ${id}`,
    oursAt: null,
    oursSubject: null,
    oursText: "a mi üzenetünk",
    sentMms: true,
    sentSms: true,
    answeredAt: answered ? new Date(Date.UTC(2026, 9, 7, 11, 0)) : null,
    answeredBy: answered ? "Teszt Operátor" : null,
  };
}
const NOW = new Date(Date.UTC(2026, 9, 7, 12, 0));
function blockOf(replies: ReplyView[]): RepliesBlock {
  return { replies, open: replies.filter((r) => !r.answeredAt).length, total: replies.length, checked: { sms: NOW, email: NOW } };
}
const panelShown = (html: string, id: string) => new RegExp(`data-rep-p="${id}"(?! hidden)>`).test(html);
const rowHidden = (html: string, id: string) => new RegExp(`data-rep-id="${id}"[^>]*\\bhidden\\b`).test(html);
function blockCases(render: typeof repliesBlockHtml): boolean[] {
  const b = blockOf([view("a", false, 30), view("b", true, 20)]);
  const open = render(b, { filter: "open", reply: null }, "hu", NOW);
  const openSel = render(b, { filter: "open", reply: "b" }, "hu", NOW);
  const zero = render(blockOf([view("b", true, 20)]), { filter: "open", reply: null }, "hu", NOW);
  return [
    check("⑥ Megválaszolatlan: a nyitott látszik, és az ő beszélgetése nyílik", panelShown(open, "a") && !panelShown(open, "b")),
    check("⑥ Megválaszolatlan: a megválaszolt sor nem listázódik", !open.includes('data-rep-id="b"') || rowHidden(open, "b")),
    check("⑥ ?reply=<megválaszolt> a Megválaszolatlan szűrőn: a beszélgetés LÁTSZIK", panelShown(openSel, "b"), "a Visszavonás eltűnne"),
    check("⑥ a látható megválaszolt panelen ott a Visszavonás", /data-rep-p="b">[\s\S]*?\/replies\/b\/undo/.test(openSel)),
    check("⑥ 0 nyitott → „mind megválaszolva”", zero.includes("mind megválaszolva") && !zero.includes("0 megválaszolatlan")),
  ];
}

// ---------- run ----------
async function runAll(): Promise<void> {
  matcherCases(matchReply);
  assemblyCases(assembleInbox);
  quoteCases(stripQuoted);
  await fetchCases(new ImapReader({ host: "imap.invalid", user: "x", pass: "x" } as never));
  await autoCases(markAutoAnswered);
  blockCases(repliesBlockHtml);
}

/** Every family must go RED on a deliberately broken implementation. */
async function selfTest(): Promise<void> {
  const reds: [string, () => Promise<boolean[]> | boolean[]][] = [
    // First-match instead of most-recent, and no first-touch cut-off.
    ["①", () => matcherCases((r, cs) => cs.find((c) => c.phone && c.phone.slice(-7) === r.from.replace(/\D/g, "").slice(-7)) ?? null)],
    // TextDecoded-first reading: the real shape doubles part 2.
    ["②", () => assemblyCases((rows, now) => assembleInbox(rows.map((r) => (r.textDecoded ? { ...r, textHex: "" } : r)), now))],
    ["③", () => quoteCases((t) => t.trim())],
    ["④", () => fetchCases({ uidFetch: async () => [] })],
    ["⑤", () => autoCases(async () => 0)],
    // A filter that hides every answered reply, the selected one too.
    ["⑥", () => blockCases((b, q, lang, now) => repliesBlockHtml({ ...b, replies: q.filter === "open" ? b.replies.filter((r) => !r.answeredAt) : b.replies }, q, lang, now))],
  ];
  for (const [fam, run] of reds) {
    const before = failures;
    console.log(`önteszt ${fam} (rontott változat — PIROS kell):`);
    const results = await run();
    const red = results.some((ok) => !ok);
    failures = before;
    check(`önteszt ${fam}: a rontott változat PIROSRA megy`, red);
  }
  console.log("valódi futás:");
  await runAll();
}

try {
  if (SELF_TEST) await selfTest();
  else await runAll();
} finally {
  await db.destroy();
}
if (failures) {
  console.error(`\n⛔ outreach-reply-check${SELF_TEST ? " --self-test" : ""}: ${failures} bukás`);
  process.exit(1);
}
console.log(`\n✅ outreach-reply-check${SELF_TEST ? " --self-test" : ""}: zöld`);
