// Guard gate: no message may leave for an IANA-reserved test domain.
//
// WHAT THIS MEASURES AND WHY. The local .env holds the real Zoho credentials, so
// every gate that exercises a real flow (review-flow-check, module-config-check…)
// posts real mail — and its fixtures write to fictional guests at example.com,
// a domain published with a Null MX record (RFC 7505). Result, measured on
// 2026-08-26: a "556 5.7.27" bounce into the owner's inbox on every commit, and
// a permanent-bounce rate on the exact domain the cold outreach deliverability
// rests on. The block belongs to the sender, so this gate measures the sender.
//
// It is deliberately checked in BOTH directions. A guard that blocks everything
// would pass a one-sided test and silently kill the real mail: the allow list
// below is the red half, and it contains the near misses (example.hu,
// invalid-domain.hu) that a sloppier rule would swallow.
//
//   npx tsx scripts/email-guard-check.mts

import type { EmailMessage, EmailSender, SendResult } from "../src/email/sender.js";

// The wiring assertion at the bottom builds the SMTP adapter, which demands both
// values at construction. Set them before importing config (dotenv does not
// override what is already in the environment) so the gate runs on a bare clone.
process.env.EMAIL_PROVIDER = "smtp";
process.env.SMTP_URL ??= "smtp://user:pass@localhost:587";
process.env.OUTREACH_FROM ??= "hello@citoviso.com";

const { ReservedRecipientGuard, getEmailSender, isReservedAddress } = await import(
  "../src/email/sender.js"
);

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** Records what it was handed instead of sending anything. */
class SpySender implements EmailSender {
  readonly seen: string[] = [];
  constructor(private readonly tag: "wire" | "outbox") {}
  async send(msg: EmailMessage): Promise<SendResult> {
    this.seen.push(msg.to);
    return { id: `${this.tag}-${this.seen.length}`, provider: "mock" };
  }
}

const MSG = { subject: "Teszt", text: "Teszt" };

/** Addresses that must NEVER reach the wire. */
const BLOCKED = [
  "vendeg@example.com",
  "info@example.net",
  "Teszt Vendég <t@example.org>",
  "anna@mail.example.com",
  "teszt@example.invalid",
  "x@foo.invalid",
  "y@localhost",
  "z@nas.local",
  "w@fixture.test",
  "v@demo.example",
  "UPPER@Example.COM",
  "trailing@example.com.",
  "a@valodi.hu, b@example.com", // one reserved recipient poisons the whole message
];

/** Addresses that must still go out — the guard may not over-block. */
const ALLOWED = [
  "olaszferenc@gmail.com",
  "olasz.ferenc@citoviso.com",
  "info@example.hu",
  "kapcsolat@examples.com",
  "foglalas@invalid-domain.hu",
  "iroda@local.hu",
  "penzio@testdomain.hu",
  "Nagy Béla <bela@panzio.hu>",
  "a@valodi.hu, b@masik.hu",
];

console.log("E-mail foglalt-domain őr (RFC 2606/6761):\n");

for (const to of BLOCKED) {
  const wire = new SpySender("wire");
  const outbox = new SpySender("outbox");
  const res = await new ReservedRecipientGuard(wire, outbox).send({ ...MSG, to });
  check(`BLOKKOLT: ${to}`, wire.seen.length === 0 && res.provider === "blocked", {
    wire: wire.seen,
    outbox: outbox.seen,
    provider: res.provider,
  });
}

console.log("");

for (const to of ALLOWED) {
  const wire = new SpySender("wire");
  const outbox = new SpySender("outbox");
  const res = await new ReservedRecipientGuard(wire, outbox).send({ ...MSG, to });
  check(`ÁTMEGY: ${to}`, wire.seen.length === 1 && outbox.seen.length === 0, {
    wire: wire.seen,
    outbox: outbox.seen,
    provider: res.provider,
  });
}

console.log("");

// Self-check: the two lists above prove the rule, this proves the rule is ARMED.
// Without it the guard could be correct and simply not wired into the sender the
// application actually uses.
check(
  "⭐ a valódi getEmailSender() az őrbe csomagolja az SMTP-küldőt",
  getEmailSender() instanceof ReservedRecipientGuard,
);
check("⭐ a predikátum exportált és egyetért a blokk-listával", isReservedAddress("x@example.com"));

console.log("");
if (failures > 0) {
  console.error(`${failures} hiba — foglalt teszt-domainre menne ki levél.`);
  process.exit(1);
}
console.log("Minden rendben: foglalt teszt-domainre nem megy ki levél.");
