// HIDEG SMS GSM-7 ŐR — a hideg MMS+SMS pár szöveges fele ÉS az önálló (MMS nélküli) hideg SMS
// GSM-7 és legfeljebb 2 szelet (ADR-0366, Elek 10-11 K2; ADR-XXXX, Elek 10-12 A-új-2: az önálló
// SMS még UCS-2 / 225 karakter / 4 szelet volt; ugyanaz a szabály, mint a kampány-SMS-é, ADR-0344 C2b).
//
//   npx tsx scripts/pair-sms-gsm7-check.mts
//
// ⛔ MIÉRT (mérve 2026-10-11, Elek): a kísérő SMS 224 karakter, UCS-2, 4 szelet volt — a „–”
// gondolatjel és az ékezetek miatt —, miközben a kampány-SMS ékezet nélkül 2 szeletben ment.
// Megkeresésenként kétszeres SMS-költség, és egy régebbi telefon szétesve mutatja.
//
// MIT MÉR (a VALÓDI sablonokon, renderPairSmsDraft és renderSmsDraft):
//   ① rövid, átlagos és nagyon hosszú, ékezetes név, valamint emojis név: GSM-7, ≤ 2 szelet;
//   ② a link BETŰRE benne van (sosem vágjuk, sosem hajtogatjuk);
//   ③ a §C személyre szabás (C3) a hajtogatott/rövidített nevet megtalálja — a kapu nem
//      állítja meg a saját szövegünket;
//   ④ kontroll: a C3 egy MÁS nevű szövegre továbbra is piros (nem vakult meg).
// A régi kódon ① PIROS (UCS-2, 4 szelet).
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://citoviso.com";

const { renderPairSmsDraft, renderSmsDraft, PAIR_SMS_MAX_SEGMENTS } = await import("../src/outreach/draft.js");
const { checkOutreachSms } = await import("../src/outreach/outreachCheck.js");
const { smsEncoding } = await import("../src/sms/encoding.js");
const { prepareMailLang } = await import("../src/i18n/mail.js");
await prepareMailLang("hu");

let failed = 0;
const check = (label: string, ok: boolean, detail = ""): void => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

const PERSONAL = /SZEMÉLYRE SZABÁS/;
const base = { region: "Zala", qualification: "nincs_honlap", segment: null, rating: null, token: "hWAeKUweNOvCiAAMz6hlqUAA", lang: "hu" };
const NAMES = [
  "Bánó Porta Köveskál",
  "ELEK-TESZT Strand Apartman Keszthely",
  "Őrségi Fűzfa Vendégház és Hétvégi Ház — Szalafő, Felsőszer, a Pityerszer szomszédságában, gyönyörű kilátással",
  "Napfény 🌞 Apartman Siófok",
];
const RENDERERS = [
  ["kísérő", renderPairSmsDraft],
  ["önálló", renderSmsDraft],
] as const;
for (const [kind, render] of RENDERERS)
for (const leadName of NAMES) {
  const sms = render({ ...base, leadName } as never);
  const enc = smsEncoding(sms.text);
  const tag = `${kind} · ${leadName.length > 40 ? `${leadName.slice(0, 37)}…` : leadName}`;
  check(`① [${tag}] GSM-7`, enc.gsm7, `${enc.length} karakter`);
  check(`① [${tag}] ≤ ${PAIR_SMS_MAX_SEGMENTS} szelet`, enc.segments <= PAIR_SMS_MAX_SEGMENTS, `${enc.segments} szelet`);
  check(`② [${tag}] a link betűre benne van`, sms.text.includes(sms.link) && sms.link.startsWith("https://"), sms.link);
  const reasons = checkOutreachSms(sms, leadName, "hu").reasons;
  check(`③ [${tag}] a C3 megtalálja a nevet`, !reasons.some((r) => PERSONAL.test(r)), reasons.filter((r) => PERSONAL.test(r)).join(" | "));
}
for (const [kind, render] of RENDERERS) {
  const sms = render({ ...base, leadName: "Bánó Porta Köveskál" } as never);
  const reasons = checkOutreachSms({ text: sms.text, link: sms.link, unsubscribeLink: sms.unsubscribeLink }, "Hegyalja Panzió", "hu").reasons;
  check(`④ [${kind}] kontroll: más név → a C3 PIROS (nem vakult meg)`, reasons.some((r) => PERSONAL.test(r)));
}
console.log(failed ? `\n⛔ pair-sms-gsm7-check: ${failed} bukás` : "\n✅ pair-sms-gsm7-check: a kísérő és az önálló hideg SMS GSM-7, ≤ 2 szelet");
process.exit(failed ? 1 : 0);
