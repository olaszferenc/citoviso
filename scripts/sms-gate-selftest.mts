// Self-test: the §C SMS gate on the REAL wording we ship.
//
// Why (ADR-0112): the owner's wording moved the opt-out and the legal-basis
// sentence off the message and onto the linked page, so two gate rules were
// relaxed. A relaxed gate is only safe if the rules that REMAIN actually bite —
// and the wording itself must stay inside them. This test pins both ends:
//
//   POSITIVE — the shipped templates (pair SMS + standalone SMS) pass the gate.
//              If a future edit drops the brand signature, the lead's name, or
//              the tracked link, this goes red.
//   NEGATIVE — a deliberately broken variant FLAGs, with the expected reason.
//              A gate that never fails a bad input is decoration (2026-08-29).
//
// Usage: npx tsx scripts/sms-gate-selftest.mts

import { config } from "../src/config.js";
import { renderPairSmsDraft, renderSmsDraft, type DraftInput } from "../src/outreach/draft.js";
import { checkOutreachSms } from "../src/outreach/outreachCheck.js";

const LEAD = "Dencs Apartmanház";

const INPUT: DraftInput = {
  leadName: LEAD,
  region: "Zala",
  qualification: "nincs_honlap",
  segment: null,
  rating: null,
  token: "hWAeKUweNOvCiAAMz6hlqUAA",
  lang: "hu",
};

let failed = 0;
/** Failures go to stderr so the pre-commit hook can silence the green run. */
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) {
    console.log(`✅ ${what}`);
    return;
  }
  failed++;
  console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
};

// ── POSITIVE: what we actually send. ─────────────────────────────────────────
console.log("── Kiszállított sablonok ──────────────────────────────────────────");
for (const [name, sms] of [
  ["MMS+SMS páros kísérő SMS", renderPairSmsDraft(INPUT)],
  ["önálló SMS", renderSmsDraft(INPUT)],
] as const) {
  console.log(`\n[${name}]\n${sms.text}\n`);
  const r = checkOutreachSms(sms, LEAD, "hu");
  say(r.verdict === "PASS", `${name}: §C-kapu PASS`, r.reasons.join(" | "));

  // The wording carries what the relaxed gate still relies on.
  say(sms.text.includes(sms.link), `${name}: a követett link benne van (a jogi kötelezők hordozója)`);
  say(/citoviso/i.test(sms.text), `${name}: a feladó azonosítható (márkanév)`);
  say(sms.text.includes(LEAD), `${name}: személyre szabott (a lead neve)`);
  say(/látványterv|terv/iu.test(sms.text), `${name}: terv-keretezés (§A demo-framing)`);
}

// ── NEGATIVE: each remaining rule must still bite. ───────────────────────────
console.log("\n── Szándékosan rontott változatok (mind FLAG-elendő) ──────────────");
const base = renderPairSmsDraft(INPUT);

interface Bad {
  readonly why: string;
  readonly sms: { text: string; link: string; unsubscribeLink: string };
  readonly expect: RegExp;
  /** Override when the case is about the lead name itself. */
  readonly leadName?: string;
}

// ⚠️ The production link is https://citoviso.com/p/<slug>/<token> — it contains
// BOTH our brand name AND the lead's name. A gate matching on the raw message
// text therefore passes an anonymous mass-text on C2 and C3 (measured by the
// jog/provenance-őr, 2026-09-08: verdict PASS, reasons []). These two cases pin
// that hole shut with the REAL production URL shape, not the dev one — otherwise
// this self-test stays green for the wrong reason.
const PROD_LINK = "https://citoviso.com/p/dencs-apartmanhaz/hWAeKUweNOvCiAAMz6hlqUAA";
const PROD_UNSUB = `${PROD_LINK}/unsubscribe`;

const BAD: readonly Bad[] = [
  {
    why: "névtelen tömeg-szöveg ÉLES linkkel (a márkanév csak az URL-ben van)",
    sms: {
      text: `Készítettünk egy honlap-látványtervet, nézze meg: ${PROD_LINK}`,
      link: PROD_LINK,
      unsubscribeLink: PROD_UNSUB,
    },
    expect: /C2: az SMS nem azonosítja a feladót/,
  },
  {
    // ⚠️ A one-word, unaccented name is the case that actually opens the hole:
    // "Bagolyvar" slugifies to itself, so the raw text contains it via the URL
    // and C3 passed a mass-text (the őr's measurement). "Dencs Apartmanház"
    // would NOT prove anything here — its slug loses the space and the accent.
    why: "tömeg-szöveg, ahol a lead neve CSAK az URL-slugban van (ékezet nélküli, egyszavas név)",
    leadName: "Bagolyvar",
    sms: {
      text: "Készítettünk egy honlap-látványtervet, nézze meg: https://citoviso.com/p/bagolyvar/hWAeKUweNOvCiAAMz6hlqUAA",
      link: "https://citoviso.com/p/bagolyvar/hWAeKUweNOvCiAAMz6hlqUAA",
      unsubscribeLink: "https://citoviso.com/p/bagolyvar/hWAeKUweNOvCiAAMz6hlqUAA/unsubscribe",
    },
    expect: /C3: az SMS nem hivatkozik a lead nevére/,
  },
  {
    why: "nincs benne a link (így SEHOL nincs leiratkozás)",
    sms: { ...base, text: base.text.replace(base.link, "") },
    expect: /LINK: a követett mock-link nincs/,
  },
  {
    why: "elérhetetlen link (privát IP)",
    sms: { ...base, text: base.text.replace(base.link, "http://192.168.0.5/p/x"), link: "http://192.168.0.5/p/x" },
    expect: /LINK: a mock-link a címzett számára elérhetetlen/,
  },
  {
    why: "halott leiratkozó URL a linkelt oldal mögött",
    sms: { ...base, unsubscribeLink: "http://10.0.0.4/p/x/unsubscribe" },
    expect: /C1: a leiratkozó-link a címzett számára elérhetetlen/,
  },
  {
    why: "névtelen feladó (az aláírás kiesett)",
    sms: { ...base, text: base.text.replace(/A Citoviso Csapata/g, "") },
    expect: /C2: az SMS nem azonosítja a feladót/,
  },
  {
    why: "tömeg-szöveg (nincs benne a lead neve)",
    sms: { ...base, text: base.text.replace(LEAD, "Tisztelt Szállásadó") },
    expect: /C3: az SMS nem hivatkozik a lead nevére/,
  },
  {
    why: "kész oldalt állít (§A demo-framing sérül)",
    sms: { ...base, text: base.text.replace(/honlap-látványtervet.*?kötelezettségmentesen!/u, "elkészült az új honlapja!") },
    expect: /C4: félrevezető állítás|C4: hiányzik az explicit terv/,
  },
];

for (const b of BAD) {
  const r = checkOutreachSms(b.sms, b.leadName ?? LEAD, "hu");
  const hit = r.verdict === "FLAG" && r.reasons.some((x) => b.expect.test(x));
  say(hit, `FLAG: ${b.why}`, hit ? "" : `verdikt=${r.verdict} okok=[${r.reasons.join(" | ")}]`);
}

// The country gate is independent of the wording — it must still close.
const foreign = checkOutreachSms(base, LEAD, "de");
say(
  foreign.verdict === "FLAG" && foreign.reasons.some((x) => /C-ORSZÁG/.test(x)),
  "FLAG: nem jóváhagyott nyelvterület (ADR-0036)",
);

// ⚠️ The sender-config rule can only be OBSERVED here, not simulated: config is
// read at module load, and this test must not mutate the environment of a gate
// other tests share. So we assert the two halves that make it meaningful — the
// rule exists in the gate, and this machine's config actually satisfies it.
const senderSet = Boolean(
  (config.outreachSender.company ?? "").trim() || (config.outreachSender.name ?? "").trim(),
);
say(
  senderSet,
  "OUTREACH_SENDER_COMPANY/NAME be van állítva (enélkül a linkelt lábazat névtelen hirdetőt szolgálna ki)",
  "állítsd be a .env-ben — ADR-0112 óta ez az EGYETLEN hely, ahol a címzett megtudja, ki keresi meg",
);

if (failed) {
  console.error(`\n⛔ ${failed} ellenőrzés bukott — az SMS-szöveg vagy a §C-kapu elcsúszott.`);
  process.exit(1);
}
console.log("\n✅ SMS §C-kapu önteszt: a kiszállított szöveg átmegy, a rontott változatok fennakadnak.");
