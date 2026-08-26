// Gate: the pilot BCC may never copy a tenant's GUEST data to us.
//
// EMAIL_BCC blind-copies outgoing mail to the owner during the pilot so he can see
// what the machine actually sends. The same adapter, however, also carries the
// tenant's own guest traffic — booking confirmations, review thank-yous, and two
// tenant-facing notices whose every line is guest personal data. For those the
// TENANT is the controller and we are only the processor; siphoning them into our
// mailbox would be a purpose nobody agreed to.
//
// The compiler already forces every send site to declare an audience (EmailMessage
// requires it). This gate checks the other half: that the adapter actually honours
// the declaration, and that the guest-facing sites still declare "guest" — a later
// edit could quietly flip one to "platform" and nothing else would notice.
//
// Usage: npx tsx scripts/check-email-bcc.mts [--self-test]

import { readFile } from "node:fs/promises";
import path from "node:path";

/** Send sites that carry a tenant's guest data. Flipping one to "platform" leaks. */
const GUEST_SITES: ReadonlyArray<readonly [string, string]> = [
  ["src/booking/requests.ts", "a foglalás-kérés értesítő (vendég neve/telefonja)"],
  ["src/booking/requests.ts", "a vendégnek menő visszaigazolás"],
  ["src/reviews/reviews.ts", "a vélemény-értesítő a tulajnak (vendég véleménye)"],
  ["src/reviews/reviews.ts", "a vendégnek menő köszönő levél"],
];

const fails: string[] = [];
const note = (m: string) => fails.push(m);

async function read(rel: string): Promise<string> {
  return readFile(path.resolve(rel), "utf8");
}

/** Count `audience: "guest"` declarations per file. */
function countGuest(src: string): number {
  return (src.match(/audience:\s*"guest"/g) ?? []).length;
}

async function main(): Promise<void> {
  const selfTest = process.argv.includes("--self-test");

  // 1) The adapter must gate on the audience, not just on the address being set.
  const sender = await read("src/email/sender.ts");
  const gate = selfTest
    ? sender.replace(/if \(msg\.audience === "guest"\) return null;\n/, "")
    : sender;
  if (!/if \(msg\.audience === "guest"\) return null;/.test(gate)) {
    note(
      "sender.ts: a BCC-kapu NEM zárja ki a 'guest' közönséget — a tenant vendégeinek " +
        "adata a mi postafiókunkba másolódna.",
    );
  }
  if (!/config\.emailBcc/.test(gate)) {
    note("sender.ts: a BCC nem a konfigurációból jön (EMAIL_BCC), tehát nem kapcsolható ki.");
  }

  // 2) Every guest-facing send site still declares "guest".
  const perFile = new Map<string, number>();
  for (const [file] of GUEST_SITES) perFile.set(file, (perFile.get(file) ?? 0) + 1);
  for (const [file, expected] of perFile) {
    const got = countGuest(await read(file));
    if (got < expected) {
      const why = GUEST_SITES.filter(([f]) => f === file).map(([, w]) => w).join(" · ");
      note(`${file}: ${expected} db 'audience: "guest"' kellene, ${got} van — érintett: ${why}`);
    }
  }

  // 3) The audience must stay REQUIRED; an optional field would default to leaking.
  if (!/readonly audience: EmailAudience;/.test(sender)) {
    note(
      "sender.ts: az 'audience' már nem KÖTELEZŐ mező — így egy új levél némán " +
        "'platform'-nak minősülne, és a vendég-adat kimásolódna.",
    );
  }

  if (selfTest) {
    if (fails.length) {
      console.log(`✅ önteszt: a kapu bukik, ha a 'guest' kizárás eltűnik (${fails.length} ok).`);
      process.exit(0);
    }
    console.error("❌ önteszt: a kapu NEM bukott el szándékos rontásra — hamis zöld.");
    process.exit(1);
  }

  if (fails.length) {
    console.error("⛔ email-BCC kapu:");
    for (const f of fails) console.error(`   · ${f}`);
    process.exit(1);
  }
  console.log(
    `✅ email-BCC: a pilot-másolat csak 'platform' levélre megy; ${GUEST_SITES.length} vendég-adatos küldés védve.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
