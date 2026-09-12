// Self-test: the §C outreach gate on the REAL wording we ship — BOTH channels.
//
// Why (ADR-0112): the owner's wording moved the opt-out and the legal-basis
// sentence off the message and onto the linked page, so two gate rules were
// relaxed. A relaxed gate is only safe if the rules that REMAIN actually bite —
// and the wording itself must stay inside them. This test pins both ends:
//
//   POSITIVE — the shipped templates (mail + pair SMS + standalone SMS) pass the
//              gate. If a future edit drops the brand signature, the lead's name,
//              or the tracked link, this goes red.
//   NEGATIVE — a deliberately broken variant FLAGs, with the expected reason.
//              A gate that never fails a bad input is decoration (2026-08-29).
//
// ⚠️ This file was `sms-gate-selftest.mts` until 2026-09-09, and the MAIL gate had
// no self-test at all — which is exactly why the URL-vs-prose hole that ADR-0112
// closed on the SMS side survived in the letter for another day (measured: an
// anonymous mass mail to a one-word lead scored PASS with no reasons). A guard's
// scope is its file list, so it now spans every channel the doctrine covers.
//
// Usage: npx tsx scripts/outreach-gate-selftest.mts

import { randomBytes } from "node:crypto";

import { config } from "../src/config.js";
import {
  renderDraft,
  renderPairSmsDraft,
  renderSmsDraft,
  type DraftInput,
} from "../src/outreach/draft.js";
import { checkOutreachDraft, checkOutreachSms } from "../src/outreach/outreachCheck.js";

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

// ── POSITIVE: the letter. ────────────────────────────────────────────────────
//
// ⚠️ The pricing reason is filtered out on purpose and ONLY that one: it depends
// on whether the owner has ticked "Árak véglegesek" on this machine, so asserting
// a bare PASS here would make the guard red or green for a reason that has nothing
// to do with the wording. Every other reason must be absent.
const notPricing = (rs: readonly string[]): string[] => rs.filter((r) => !/Árazás|árazás/.test(r));

const mail = renderDraft(INPUT);
const mailCheck = checkOutreachDraft(mail, LEAD, "hu");
say(
  notPricing(mailCheck.reasons).length === 0,
  "kiszállított levél: §C-kapu tiszta (az árazás-kapun kívül)",
  notPricing(mailCheck.reasons).join(" | "),
);

// ── STRUCTURAL: the random token may never change the verdict. ───────────────
//
// This is the property the prose rule guarantees, stated without naming any single
// rule — so it holds even if someone later adds a new one on the raw text. The
// tokens come from the REAL generator (randomBytes(18).base64url), which is what
// made the bug reachable: measured 2026-09-09, 1 in 1637 of them contains an
// "xXx" and tripped the placeholder-contact rule, making that lead unsendable with
// a reason pointing at a sender block that was perfectly fine.
console.log("\n── A token nem befolyásolhatja a verdiktet ────────────────────────");
const TOKEN_SAMPLES = 3000;
const baseline = {
  mail: notPricing(checkOutreachDraft(renderDraft(INPUT), LEAD, "hu").reasons).join("|"),
  pair: checkOutreachSms(renderPairSmsDraft(INPUT), LEAD, "hu").reasons.join("|"),
  solo: checkOutreachSms(renderSmsDraft(INPUT), LEAD, "hu").reasons.join("|"),
};
const drifted: string[] = [];
for (let i = 0; i < TOKEN_SAMPLES && drifted.length < 3; i++) {
  const token = randomBytes(18).toString("base64url");
  const d: DraftInput = { ...INPUT, token };
  const got = {
    mail: notPricing(checkOutreachDraft(renderDraft(d), LEAD, "hu").reasons).join("|"),
    pair: checkOutreachSms(renderPairSmsDraft(d), LEAD, "hu").reasons.join("|"),
    solo: checkOutreachSms(renderSmsDraft(d), LEAD, "hu").reasons.join("|"),
  };
  for (const k of ["mail", "pair", "solo"] as const) {
    if (got[k] !== baseline[k]) drifted.push(`${k} / token=${token} → [${got[k]}]`);
  }
}
say(
  drifted.length === 0,
  `${TOKEN_SAMPLES} valódi tokennel a verdikt változatlan (a link nem üzenet)`,
  drifted.join("\n     "),
);

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
    expect: /FELADÓ: az SMS nem azonosítja, ki ír/,
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
    expect: /SZEMÉLYRE SZABÁS: az SMS nem hivatkozik a lead nevére/,
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
    expect: /LEIRATKOZÁS: a link a címzett számára elérhetetlen/,
  },
  {
    why: "névtelen feladó (az aláírás kiesett)",
    sms: { ...base, text: base.text.replace(/A Citoviso Csapata/g, "") },
    expect: /FELADÓ: az SMS nem azonosítja, ki ír/,
  },
  {
    why: "tömeg-szöveg (nincs benne a lead neve)",
    sms: { ...base, text: base.text.replace(LEAD, "Tisztelt Szállásadó") },
    expect: /SZEMÉLYRE SZABÁS: az SMS nem hivatkozik a lead nevére/,
  },
  {
    why: "kész oldalt állít (§A demo-framing sérül)",
    sms: { ...base, text: base.text.replace(/honlap-látványtervet.*?kötelezettségmentesen!/u, "elkészült az új honlapja!") },
    expect: /FÉLREVEZETÉS: kész\/élő oldalt sugall|KERETEZÉS: hiányzik az explicit terv/,
  },
];

for (const b of BAD) {
  const r = checkOutreachSms(b.sms, b.leadName ?? LEAD, "hu");
  const hit = r.verdict === "FLAG" && r.reasons.some((x) => b.expect.test(x));
  say(hit, `FLAG: ${b.why}`, hit ? "" : `verdikt=${r.verdict} okok=[${r.reasons.join(" | ")}]`);
}

// ── NEGATIVE, the LETTER. ────────────────────────────────────────────────────
//
// The case that was measured PASSING on 2026-09-09: an anonymous mass mail whose
// only personalization and only demo-framing live inside the URL. "Mintaterv" is
// the shape that opens it — one word, no accent, so its slug equals the name, and
// the name itself contains a framing word. 39 of our 595 leads have a one-word
// name. The PRODUCTION link shape is mandatory here: with the dev base URL this
// test would go green for the wrong reason (the ADR-0112 lesson).
console.log("\n── Rontott LEVÉL-változatok (mind FLAG-elendő) ────────────────────");
const MASS_LEAD = "Mintaterv";
const MASS_LINK = `https://citoviso.com/p/mintaterv/${INPUT.token}`;
const MASS_UNSUB = `${MASS_LINK}/unsubscribe`;
const MASS_PRIV = "https://citoviso.com/privacy";
const massBody = [
  "Tisztelt Szállásadó!",
  "",
  "Elkészítettük Önnek. Nézze meg:",
  MASS_LINK,
  "",
  "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:",
  MASS_UNSUB,
  "Jogos érdek — Grt. 6. §. Adatkezelési tájékoztató:",
  MASS_PRIV,
].join("\n");

interface BadMail {
  readonly why: string;
  readonly draft: typeof mail;
  readonly expect: RegExp;
  readonly leadName?: string;
}

const BAD_MAIL: readonly BadMail[] = [
  {
    why: "tömeg-levél, ahol a lead neve CSAK az URL-slugban van (egyszavas, ékezet nélküli név)",
    leadName: MASS_LEAD,
    draft: { ...mail, subject: "Ajánlat", body: massBody, link: MASS_LINK, unsubscribeLink: MASS_UNSUB, privacyLink: MASS_PRIV },
    expect: /SZEMÉLYRE SZABÁS: a levél nem hivatkozik a lead nevére/,
  },
  {
    why: "tömeg-levél, ahol a terv-keretezés CSAK az URL-slugban van",
    leadName: MASS_LEAD,
    draft: { ...mail, subject: "Ajánlat", body: massBody, link: MASS_LINK, unsubscribeLink: MASS_UNSUB, privacyLink: MASS_PRIV },
    expect: /KERETEZÉS: hiányzik az explicit terv/,
  },
  {
    why: "valódi placeholder-telefonszám a feladó-blokkban (a szabály nem tompult el)",
    draft: { ...mail, body: `${mail.body}\nTel.: +36 30 000 0000` },
    expect: /FELADÓ: placeholder-gyanús elérhetőség/,
  },
  {
    why: "kész oldalt állít a levél (§A demo-framing sérül)",
    draft: { ...mail, body: mail.body.replace(/Előzetes látványterv/u, "Elkészült az új honlapja") },
    expect: /FÉLREVEZETÉS: kész\/élő oldalt sugall/,
  },
  {
    why: "kiesett a jogalap-mondat (Grt./GDPR)",
    draft: { ...mail, body: mail.body.replace(/jogos érdek.*$/imu, "").replace(/GDPR/g, "") },
    expect: /JOGALAP: hiányzik a tájékoztatás/,
  },
  {
    why: "halott leiratkozó-link (privát IP)",
    draft: { ...mail, body: mail.body.replace(mail.unsubscribeLink, "http://10.0.0.4/unsub"), unsubscribeLink: "http://10.0.0.4/unsub" },
    expect: /LEIRATKOZÁS: a link a címzett számára elérhetetlen/,
  },
  {
    // Elek FK-004 ⑤: the letter named a person and a brand, but never the LEGAL ENTITY
    // behind the offer — a cold commercial message the recipient cannot trace back.
    why: "kiesett a hirdető cégazonosítása (csak márkanév + személynév marad)",
    draft: { ...mail, body: mail.body.replace(mail.parts.identity, "") },
    expect: /HIRDETŐ: hiányzik a cégazonosítás/,
  },
  {
    why: "kitöltetlen LEGAL_ENTITY_* (placeholder marad a levélben)",
    draft: {
      ...mail,
      body: mail.body.replace(mail.parts.identity, "[CÉGAZONOSÍTÓ — LEGAL_ENTITY_NAME]"),
      parts: { ...mail.parts, identity: "[CÉGAZONOSÍTÓ — LEGAL_ENTITY_NAME]" },
    },
    expect: /HIRDETŐ: a cégazonosítás kitöltetlen/,
  },
];

for (const b of BAD_MAIL) {
  const r = checkOutreachDraft(b.draft, b.leadName ?? LEAD, "hu");
  const hit = r.verdict === "FLAG" && r.reasons.some((x) => b.expect.test(x));
  say(hit, `FLAG (levél): ${b.why}`, hit ? "" : `verdikt=${r.verdict} okok=[${r.reasons.join(" | ")}]`);
}

// The country gate is independent of the wording — it must still close.
const foreign = checkOutreachSms(base, LEAD, "de");
say(
  foreign.verdict === "FLAG" && foreign.reasons.some((x) => /^PIAC:/.test(x)),
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
  console.error(`\n⛔ ${failed} ellenőrzés bukott — a kiküldött szöveg vagy a §C-kapu elcsúszott.`);
  process.exit(1);
}
console.log(
  "\n✅ §C-kapu önteszt (levél + SMS): a kiszállított szöveg átmegy, a rontott változatok fennakadnak, és a token nem számít.",
);
