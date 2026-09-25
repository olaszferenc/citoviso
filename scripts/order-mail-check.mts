// Regression gate: the two buyer letters of the link-payment path (owner's
// decision, 2026-09-25 — src/email/orderEmail.ts, src/console/orderMail.ts).
//
//   A) THE LETTER — both builders: the E4 logo rides as a CID attachment that
//      exists on disk (the owner flagged the logo explicitly: "pont most volt
//      ezzel gond"), Reply-To is the support address (the letter says "reply to
//      this letter"), the amount is formatted, no {placeholder} survives, and the
//      pay-link is in the button AND the plain-text body.
//   B) THE WIRING — the letters are only worth anything if something sends them:
//      the no-pay-link branch of handleOrderRequest sends ①, and the operator's
//      „Fizetési kérés küldése" route sends ② with the payment it just issued.
//
// Run:  npx tsx scripts/order-mail-check.mts
//       npx tsx scripts/order-mail-check.mts --self-test   (must go RED)

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { buildOrderPayLinkEmail, buildOrderReceivedEmail } from "../src/email/orderEmail.js";
import { LOGO_CID } from "../src/email/platformLayout.js";
import { config } from "../src/config.js";
import type { EmailMessage } from "../src/email/sender.js";

const SELF_TEST = process.argv.includes("--self-test");
const PAY_URL = "https://secure.test.barion.com/Pay?Id=00000000000000000000000000000000";

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

const base = {
  to: "vevo@pelda.hu",
  siteName: "Éden üdülőház",
  buyerName: "Teszt Elek",
  buyerIsPerson: true,
  amount: 5130,
  currency: "HUF",
  billingPeriod: "monthly" as const,
  lang: "hu",
};

function auditLetter(name: string, m: EmailMessage): void {
  const html = m.html ?? "";
  const logo = (m.attachments ?? []).find((a) => a.cid === LOGO_CID);
  check(html.includes(`src="cid:${LOGO_CID}"`), `${name}: a fejléc a CID-logót hivatkozza`);
  check(
    !!logo && typeof logo.path === "string" && existsSync(logo.path),
    `${name}: a logó mellékletként megy, és a fájl létezik (${logo?.path ?? "—"})`,
  );
  check(m.replyTo === config.supportEmail, `${name}: Reply-To = ${config.supportEmail} (mért: ${m.replyTo ?? "—"})`);
  check(m.audience === "platform", `${name}: platform-levél (pilot-BCC érvényes)`);
  check(/5\s130\sFt/.test(m.text) && /5\s130\sFt/.test(html), `${name}: az összeg formázva (5 130 Ft) szövegben és HTML-ben`);
  check(!/\{[a-z]+\}/.test(m.text + html + m.subject), `${name}: nem maradt {helyőrző}`);
  check(m.subject.includes(base.siteName), `${name}: a tárgy megnevezi a honlapot`);
  check(m.text.includes(config.supportEmail), `${name}: a szöveges törzs megadja az elérhetőséget`);
}

const received = buildOrderReceivedEmail(base);
let payLink = buildOrderPayLinkEmail({ ...base, payUrl: PAY_URL });
if (SELF_TEST) {
  // Deliberate regression: the letter loses its Reply-To and its logo.
  payLink = { ...payLink, replyTo: undefined, attachments: [] };
}
auditLetter("① visszaigazoló", received);
auditLetter("② fizetési link", payLink);
check(
  (payLink.html ?? "").includes(`href="${PAY_URL}"`) && payLink.text.includes(PAY_URL),
  "② a fizetési link a gombban ÉS a szöveges törzsben",
);
check(!received.text.includes("Pay?Id="), "① nem ígér és nem mutat fizetési linket");

// ── B) wiring ───────────────────────────────────────────────────────────────
const server = await readFile("src/console/server.ts", "utf8");
const handler = server.slice(
  server.indexOf("async function handleOrderRequest("),
  server.indexOf("/** Neutral page after unsubscribe"),
);
const noLink = handler.slice(handler.indexOf("if (!payUrl) {"));
check(
  /sendOrderReceivedMail\(rec\.orderIntentId\)/.test(noLink.slice(0, 1500)),
  "a pay-link nélküli ág elküldi a vevőnek az ① visszaigazolót",
);
const route = server.slice(server.indexOf("const reqPayMatch"), server.indexOf('path === "/pay/done"'));
check(
  /const pay = await requestPayment\(oi\.id\);[\s\S]*sendOrderPayLinkMail\(oi\.id, pay\.paymentId\)/.test(route),
  "a „Fizetési kérés küldése” útvonal e-mailben kiküldi a kiadott linket",
);

console.log(notes.join("\n"));
if (failures.length) {
  console.error(`\n⛔ order-mail-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
  if (SELF_TEST) {
    console.log("\n✅ self-test: a szándékos regresszió PIROS lett, ahogy kell.");
    process.exit(0);
  }
  process.exit(1);
}
if (SELF_TEST) {
  console.error("\n⛔ self-test: a szándékos regresszió ZÖLD maradt — az őr vak.");
  process.exit(1);
}
console.log(`\n✅ order-mail-check: ${notes.length} állítás zöld`);
process.exit(0);
