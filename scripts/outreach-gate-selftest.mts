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

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  renderDraft,
  renderPairSmsDraft,
  renderSmsDraft,
  type DraftInput,
} from "../src/outreach/draft.js";
import {
  checkOutreachDraft,
  checkOutreachIdentity,
  checkOutreachSms,
  identityProblems,
  identityReason,
} from "../src/outreach/outreachCheck.js";

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
// ⚠️ Two reasons are filtered out on purpose, and ONLY these two: both depend on
// what is configured ON THIS MACHINE, not on the wording this test exists to pin.
// Asserting a bare PASS would make the guard red or green for a reason that has
// nothing to do with the letter's text.
//   • pricing — whether the owner has ticked "Árak véglegesek" here;
//   • FELADÓ-AZONOSÍTÁS — the §C.2 identity fields come from the .env, and the DEV
//     .env deliberately holds a self-declaring test entity ("TESZT Szolgáltató e.v.
//     (nem valódi)"). That rule is not weakened by being filtered here: it gets its
//     OWN positive and negative sections below, on injected values, plus a
//     subprocess run that proves the wiring on the real config path.
// Every other reason must be absent.
const MACHINE_CONFIG = /Árazás|árazás|^FELADÓ-AZONOSÍTÁS/;
const notPricing = (rs: readonly string[]): string[] => rs.filter((r) => !MACHINE_CONFIG.test(r));

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

// ── §C.2 FELADÓ-AZONOSÍTÁS — a kapu a KONFIGURÁCIÓT méri ────────────────────
//
// ⛔ Elek FK-004 H2 (mérve 2026-09-13): a TÉNYLEGESEN kiküldött levél lábazata
// „A megkeresés küldője: TESZT Szolgáltató e.v. (nem valódi) · adószám:
// 12345678-1-42" volt, a lap teteje pedig zöld „PASS — küldhető". Egyetlen §C.2
// szabály sem láthatta: mind a SZÖVEGET mérte, a szöveg pedig pontosan azt írta,
// amit a config diktált. Egy éles félrekonfiguráció (üres vagy bemásolt minta-env)
// ugyanígy nézne ki, ugyanígy PASS-szal.
//
// ⚠️ Ez a szakasz korábban csak MEGFIGYELHETTE a szabályt („a config module-load
// kor olvasódik, a tesztnek nem szabad más tesztek környezetét átírni"). A mérés
// most INJEKTÁLT értékeken megy (identityProblems tiszta függvény), a bekötést
// pedig a végén egy alfolyamat igazolja — a valódi config-úton.
console.log("\n── §C.2 feladó-azonosítás: a KONFIG mérése ────────────────────────");

/**
 * The ÉLES values, read from /opt/citoviso/app/.env on 2026-09-13 (read-only
 * diagnostics). ⛔ THIS IS THE HALF THAT MATTERS MOST: this very file's rules have
 * misfired on CORRECT values twice (the `xXx` token 2026-09-09; the valid adószám
 * `12345678-1-42` matching `1234567` on 2026-09-11, ADR-0121), and a false FLAG
 * here does not weaken the gate — it STOPS the business, silently, on the machine
 * nobody runs the tests on. So the prod config is pinned as a positive case.
 */
const PROD_IDENTITY = {
  OUTREACH_SENDER_NAME: "Olasz Ferenc",
  OUTREACH_SENDER_COMPANY: "Olasz Ferenc e.v.",
  OUTREACH_SENDER_EMAIL: "olasz.ferenc@citoviso.com",
  LEGAL_ENTITY_NAME: "Olasz Ferenc e.v.",
  LEGAL_ENTITY_ADDRESS: "2100 Gödöllő, Klebelsberg Kunó utca 6. 2.",
  LEGAL_ENTITY_REG_NUMBER: "62588818",
  LEGAL_ENTITY_TAX_NUMBER: "92227011-1-33",
  LEGAL_ENTITY_PHONE: "+36 30 516 1631",
} as const;

for (const surface of ["mail", "linked-page"] as const) {
  const ps = identityProblems(surface, PROD_IDENTITY);
  say(
    ps.length === 0,
    `ÉLES konfig (${surface}): a kapu NEM ad hamis FLAG-et`,
    ps.map(identityReason).join(" | "),
  );
}

// The adószám rule is a CHECK-DIGIT computation, not a word list — so it must accept
// real registry numbers and reject the documentation sample for a structural reason.
// Independent reference values (public registry data), so the rule is not measured
// with its own assumptions: Magyar Telekom and OTP Bank.
for (const tax of ["92227011-1-33", "10773381-2-44", "10537914-4-44"]) {
  const ps = identityProblems("mail", { ...PROD_IDENTITY, LEGAL_ENTITY_TAX_NUMBER: tax });
  say(ps.length === 0, `valódi adószám elfogadva: ${tax}`, ps.map(identityReason).join(" | "));
}

interface BadIdentity {
  readonly why: string;
  readonly patch: Record<string, string | undefined>;
  readonly expect: RegExp;
  readonly surface?: "mail" | "linked-page";
  readonly samples?: ReadonlyMap<string, string>;
}

const BAD_IDENTITY: readonly BadIdentity[] = [
  {
    // The MEASURED case, verbatim from the dev .env that shipped it.
    why: "a bejegyzett név önmagát érvényteleníti — „(nem valódi)”",
    patch: { LEGAL_ENTITY_NAME: "TESZT Szolgáltató e.v. (nem valódi)" },
    expect: /\[LEGAL_ENTITY_NAME\].*megjegyzést visel/,
  },
  {
    why: "a minta-adószám ellenőrző számjegye hibás (12345678-1-42)",
    patch: { LEGAL_ENTITY_TAX_NUMBER: "12345678-1-42" },
    expect: /\[LEGAL_ENTITY_TAX_NUMBER\].*ELLENŐRZŐ SZÁMJEGYE hibás/,
  },
  {
    why: "a nyilvántartási szám nem szám — „TESZT-00000000”",
    patch: { LEGAL_ENTITY_REG_NUMBER: "TESZT-00000000" },
    expect: /\[LEGAL_ENTITY_REG_NUMBER\].*nem nyilvántartási szám alakú/,
  },
  {
    why: "a nyilvántartási szám csupa nulla (kitöltetlen mező jelölője)",
    patch: { LEGAL_ENTITY_REG_NUMBER: "00000000" },
    expect: /\[LEGAL_ENTITY_REG_NUMBER\].*ismételt számjegyből áll/,
  },
  {
    why: "a válasz-cím fenntartott teszt-domainen van (RFC 2606/6761)",
    patch: { OUTREACH_SENDER_EMAIL: "teszt@example.invalid" },
    expect: /\[OUTREACH_SENDER_EMAIL\].*FENNTARTOTT/,
  },
  {
    why: "a válasz-cím az example.com-on van",
    patch: { OUTREACH_SENDER_EMAIL: "info@example.com" },
    expect: /\[OUTREACH_SENDER_EMAIL\].*FENNTARTOTT/,
  },
  {
    why: "üres LEGAL_ENTITY_NAME (a levél a hangos jelölőt nyomtatná)",
    patch: { LEGAL_ENTITY_NAME: "" },
    expect: /\[LEGAL_ENTITY_NAME\].*nincs beállítva/,
  },
  {
    why: "sem adószám, sem nyilvántartási szám (a címzett nem tud visszakeresni)",
    patch: { LEGAL_ENTITY_REG_NUMBER: "", LEGAL_ENTITY_TAX_NUMBER: "" },
    expect: /sem adószám, sem nyilvántartási szám/,
  },
  {
    why: "a székhely helyén kitöltetlen jelölő áll",
    patch: { LEGAL_ENTITY_ADDRESS: "[KITÖLTENDŐ: székhely]" },
    expect: /\[LEGAL_ENTITY_ADDRESS\]/,
  },
  {
    why: "az aláírásban placeholder-telefonszám (a mező-szintű mérés)",
    patch: { OUTREACH_SENDER_PHONE: "+36 30 000 0000" },
    expect: /\[OUTREACH_SENDER_PHONE\].*azonos számjegy/,
  },
  {
    why: "az aláírásban minta-telefonszám (növekvő sorozat)",
    patch: { OUTREACH_SENDER_PHONE: "+36 30 123 4567" },
    expect: /\[OUTREACH_SENDER_PHONE\].*növekvő számjegy-sorozat/,
  },
  {
    why: "az aláíró neve kitöltetlen jelölő",
    patch: { OUTREACH_SENDER_NAME: "[KÜLDŐ NEVE — OUTREACH_SENDER_NAME]" },
    expect: /\[OUTREACH_SENDER_NAME\].*megjegyzést visel/,
  },
  {
    // Layer ③: not a hand-kept blacklist — the value the env TEMPLATE documents.
    // Exact equality, so a correct value can never collide with it.
    why: "a .env.example minta-értéke maradt a konfigban",
    patch: { LEGAL_ENTITY_NAME: "Példa Szolgáltató e.v." },
    samples: new Map([["LEGAL_ENTITY_NAME", "Példa Szolgáltató e.v."]]),
    expect: /\[LEGAL_ENTITY_NAME\].*\.env\.example minta-értéke/,
  },
  {
    why: "a linkelt oldal hirdetője névtelen (se cég, se név)",
    surface: "linked-page",
    patch: { OUTREACH_SENDER_COMPANY: "", OUTREACH_SENDER_NAME: "" },
    expect: /\[OUTREACH_SENDER_COMPANY\].*EGYETLEN hely/,
  },
];

for (const b of BAD_IDENTITY) {
  const ps = identityProblems(b.surface ?? "mail", { ...PROD_IDENTITY, ...b.patch }, b.samples);
  const hit = ps.some((p) => b.expect.test(identityReason(p)));
  say(hit, `FLAG (azonosítás): ${b.why}`, hit ? "" : `talált okok=[${ps.map(identityReason).join(" | ")}]`);
  // Requirement of the rule, not a nicety: the problem must NAME THE FIELD, or the
  // operator gets a red banner and eight env values to guess between.
  const named = ps.every((p) => p.env && p.label && p.detail);
  say(named, `  ↳ strukturált: minden lelet megnevezi a mezőt (${ps.map((p) => p.env).join(", ")})`);
}

// ── A BEKÖTÉS: a valódi config-úton is FLAG-re megy ─────────────────────────
//
// ⚠️ A tiszta függvény zöld/piros volta MÉG NEM bizonyítja, hogy a kapu tényleg
// olvassa. A config a modul betöltésekor olvasódik (`process.env.X = …` a script
// tetején KÉSŐN fut — az ESM előbb hajtja végre a static importokat), ezért a
// bekötést csak ALFOLYAMAT tudja megmérni: saját env-vel indul, a VALÓDI
// checkOutreachDraft-ot hívja a VALÓDI levélre, és a verdiktet írja ki.
console.log("\n── A bekötés alfolyamatban (valódi config-út) ──────────────────────");
// Absolute specifiers: the probe file lives in the OS temp dir (it must not land in
// the repo), so a relative import would resolve against /tmp.
const SRC = new URL("../src/", import.meta.url).href;
const PROBE = `
import { renderDraft } from ${JSON.stringify(`${SRC}outreach/draft.ts`)};
import { checkOutreachDraft } from ${JSON.stringify(`${SRC}outreach/outreachCheck.ts`)};
const d = renderDraft(${JSON.stringify(INPUT)});
const r = checkOutreachDraft(d, ${JSON.stringify(LEAD)}, "hu");
console.log(JSON.stringify({
  verdict: r.verdict,
  identity: r.identity.map((p) => p.env),
  reasons: r.reasons.filter((x) => x.startsWith("FELADÓ-AZONOSÍTÁS")),
  // §B.17 on ourselves: the letter must not PRINT what the gate rejects silently.
  identityLine: d.parts.identity,
}));
`;
const probePath = path.join(os.tmpdir(), `outreach-identity-probe-${process.pid}.mts`);
writeFileSync(probePath, PROBE);
const runProbe = (env: Record<string, string>): { verdict: string; identity: string[]; reasons: string[]; identityLine: string } => {
  const out = execFileSync("npx", ["tsx", probePath], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out.trim().split("\n").at(-1)!);
};
try {
  // ① PLACEHOLDER env → the gate MUST go red. This is the measured FK-004 letter.
  const bad = runProbe({
    LEGAL_ENTITY_NAME: "TESZT Szolgáltató e.v. (nem valódi)",
    LEGAL_ENTITY_ADDRESS: "8360 Keszthely, Teszt utca 1.",
    LEGAL_ENTITY_REG_NUMBER: "TESZT-00000000",
    LEGAL_ENTITY_TAX_NUMBER: "12345678-1-42",
  });
  say(
    bad.verdict === "FLAG" && bad.identity.length === 3,
    "placeholder env → a VALÓDI kapu FLAG-re megy (nem küldhető)",
    `verdikt=${bad.verdict} mezők=[${bad.identity.join(", ")}]`,
  );
  say(
    bad.identityLine.includes("(nem valódi)"),
    "  ↳ és pont azt a sort fogta meg, amit a levél KINYOMTAT",
    `a levél sora: ${bad.identityLine}`,
  );
  // ② ÉLES-alakú env → PASS az azonosításra. A hamis FLAG is bukás.
  const good = runProbe({ ...PROD_IDENTITY });
  say(
    good.identity.length === 0,
    "éles-alakú env → az azonosításra nincs FLAG (a kapu nem tompa és nem túlérzékeny)",
    good.reasons.join(" | "),
  );
} finally {
  rmSync(probePath, { force: true });
}

// A kapu ezen a GÉPEN mit mondana? Nem bukás-ok (a dev .env szándékosan teszt-
// entitást tart), de a futás kiírja — a §C.2 állapot ne legyen láthatatlan.
const here = checkOutreachIdentity("mail");
console.log(
  here.length === 0
    ? "\nℹ️  Ezen a gépen a §C.2 feladó-azonosítás HIÁNYTALAN."
    : `\nℹ️  Ezen a gépen a §C.2 feladó-azonosítás ${here.length} mezőn bukik (a hideg levél NEM megy ki innen):\n` +
        here.map((p) => `     • ${identityReason(p)}`).join("\n"),
);

if (failed) {
  console.error(`\n⛔ ${failed} ellenőrzés bukott — a kiküldött szöveg vagy a §C-kapu elcsúszott.`);
  process.exit(1);
}
console.log(
  "\n✅ §C-kapu önteszt (levél + SMS): a kiszállított szöveg átmegy, a rontott változatok fennakadnak, és a token nem számít.",
);
