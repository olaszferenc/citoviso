// Guard for the generation-time guard-verdict gate (src/outreach/mockVerdictGate.ts).
//
// Why this exists (measured 2026-09-16/17 on the Myrna Haus outreach): a curator-APPROVED
// mock could not be sent, the screen said only „FLAG (designVerdict)", and there was no
// operation that could clear it. The fix made the finding visible and let the curator send
// anyway on a second, explicit click (owner's ruling: „max figyelmeztessen, de ha utána is
// tovább kattint, menjen ki").
//
// The dangerous direction here is the FALSE PASS: an override that covers more than the
// curator actually saw. So the positive controls below are the point — an ack must NOT
// survive a new finding, a changed severity, or a missing subject.
//
// ⛔ Pure functions only, NO database: the park is shared by ~10 parallel sessions, and a
// guard that writes it would break other threads' measurements (measured repeatedly).
//
// Run: npx tsx scripts/verdict-gate-check.mts
import { readFileSync } from "node:fs";
import {
  ackCoversVerdicts,
  blockingVerdicts,
  GUARD_VERDICT_KEYS,
  VERDICT_LABEL,
  verdictAckOf,
  verdictReasonLine,
  type BlockingVerdict,
  type VerdictAck,
} from "../src/outreach/mockVerdictGate.js";

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  if (ok) pass++;
  else failures.push(`${name} — ${detail}`);
};

const ack = (verdicts: Record<string, string>, reason = "vállalom"): VerdictAck => ({
  at: "2026-09-17T09:00:00.000Z",
  by: "console",
  reason,
  verdicts,
});

// ── Which verdicts block ────────────────────────────────────────────────────────
{
  const b = blockingVerdicts({ designVerdict: "flag", factVerdict: "pass" });
  check("A flag blokkol, a pass nem", b.length === 1 && b[0]!.key === "designVerdict", `${JSON.stringify(b.map((x) => x.key))}`);
}
{
  const b = blockingVerdicts({ factVerdict: "error" });
  check("Az error (ellenőrizetlen) is blokkol", b.length === 1 && b[0]!.value === "error", `${JSON.stringify(b)}`);
}
{
  // The deterministic paths legitimately never run some verifiers — absence must pass,
  // or every engine-built mock would sit in curation forever.
  const b = blockingVerdicts({ designVerdict: "pass" });
  check("A HIÁNYZÓ kulcs átmegy (a determinisztikus út nem futtat minden verifiert)", b.length === 0, `${JSON.stringify(b)}`);
}
{
  check("Üres/null inputs nem blokkol", blockingVerdicts(null).length === 0 && blockingVerdicts({}).length === 0, "nem üres");
}

// ── The finding must be NAMED, not just flagged ─────────────────────────────────
{
  const b = blockingVerdicts({ designVerdict: "flag", designReason: "emoji: ⛔ ⚠" });
  check("A design-indok bekerül a leletbe", b[0]?.reason === "emoji: ⛔ ⚠", `reason="${b[0]?.reason}"`);
  check("A sor KIMONDJA, mit talált", verdictReasonLine(b[0]!).includes("emoji: ⛔ ⚠"), verdictReasonLine(b[0]!));
}
{
  // factUnsourced is an ARRAY — it must be joined, not printed as "[object Object]".
  const b = blockingVerdicts({ factVerdict: "flag", factUnsourced: ["Klíma", "Reggeli"] });
  check("A tényhűség-lelet listája olvashatóan jelenik meg", b[0]?.reason === "Klíma · Reggeli", `reason="${b[0]?.reason}"`);
}
{
  // ⛔ A missing reason must SAY it is missing (old artifacts stored only the verdict).
  const line = verdictReasonLine(blockingVerdicts({ designVerdict: "flag" })[0]!);
  check("Indok nélkül a sor KIMONDJA, hogy nincs eltárolva", /nincs eltárolva/.test(line), line);
  check("Az indok nélküli sor nem tesz úgy, mintha tudná", !/emoji|undefined|null/.test(line), line);
}

// ── The override covers ONLY what the curator saw ───────────────────────────────
const two = blockingVerdicts({ designVerdict: "flag", factVerdict: "flag" });
{
  check("A pontosan egyező vállalás fed", ackCoversVerdicts(ack({ designVerdict: "flag", factVerdict: "flag" }), two), "nem fedett");
}
{
  // The whole point: regenerate → a NEW guard flags → the old promise must not stretch.
  const three = blockingVerdicts({ designVerdict: "flag", factVerdict: "flag", marketVerdict: "flag" });
  check(
    "⛔ ÚJ lelet NEM fér be a régi vállalás alá",
    !ackCoversVerdicts(ack({ designVerdict: "flag", factVerdict: "flag" }), three),
    "a régi vállalás lefedte az újat is",
  );
}
{
  check(
    "⛔ A SÚLYOSSÁG változása sem fér be (flag → error)",
    !ackCoversVerdicts(ack({ designVerdict: "flag" }), blockingVerdicts({ designVerdict: "error" })),
    "a flag-re adott vállalás lefedte az error-t",
  );
}
{
  check("Hiányzó vállalás semmit nem fed", !ackCoversVerdicts(null, two), "null ack fedett");
  check("Üres lelethez nincs mit fedni", !ackCoversVerdicts(ack({}), []), "üres leletre igazat adott");
}

// ── Reading the ack back ────────────────────────────────────────────────────────
{
  check("A vállalás kiolvasható", verdictAckOf({ verdictAck: ack({ designVerdict: "flag" }) }) !== null, "nem olvasható");
  // The owner made the REASON optional here (unlike the photo gate) — but the SUBJECT
  // (which finding) and the AUTHOR must be there, or the log answers nothing.
  check(
    "Indoklás NÉLKÜL is érvényes (tulajdonosi döntés) — de naplózva",
    verdictAckOf({ verdictAck: ack({ designVerdict: "flag" }, "") }) !== null,
    "az üres indoklás érvénytelenné tette",
  );
  check(
    "⛔ TÁRGY nélküli pipa érvénytelen (bármit lefedne)",
    verdictAckOf({ verdictAck: { at: "x", by: "console", reason: "ok" } as unknown as VerdictAck }) === null,
    "a verdicts nélküli ack érvényes lett",
  );
  check(
    "⛔ SZERZŐ nélküli pipa érvénytelen (a napló nem mondaná meg, ki vállalta)",
    verdictAckOf({ verdictAck: { at: "x", by: "", reason: "ok", verdicts: { designVerdict: "flag" } } }) === null,
    "a by nélküli ack érvényes lett",
  );
  check("Hiányzó ack → null", verdictAckOf({}) === null && verdictAckOf(null) === null, "nem null");
}

// ── ONE NAME PER GATE: this module and the console's label table must agree ──────
// (mockVerdictGate.VERDICT_LABEL vs. views.ts mockInputLabel — two copies of the same
// human name would put two truths on one screen; this binds them.)
{
  const views = readFileSync(new URL("../src/console/views.ts", import.meta.url), "utf8");
  for (const key of GUARD_VERDICT_KEYS) {
    const m = new RegExp(`case "${key}":\\s*return T\\(lang, "([^"]+)"\\)`).exec(views);
    if (!m) {
      // demoFraming has no console label today — say so, don't silently skip.
      check(`Névegyezés: ${key}`, key === "demoFraming", `a views.ts mockInputLabel nem nevezi meg (és nem is a kivétel)`);
      continue;
    }
    check(
      `Névegyezés: ${key} ugyanazt hívja mindkét helyen`,
      m[1] === VERDICT_LABEL[key],
      `views.ts="${m[1]}" ≠ mockVerdictGate="${VERDICT_LABEL[key]}"`,
    );
  }
}

// ── The send paths must not carry their own copy of the key list ────────────────
// (The rule lived in TWO places and had to be fixed twice; this keeps them merged.)
for (const f of ["../src/outreach/sendBatch.ts", "../src/outreach/sendOutreachSms.ts"]) {
  const src = readFileSync(new URL(f, import.meta.url), "utf8");
  check(
    `${f.split("/").pop()} a KÖZÖS modulból olvassa a leletet`,
    src.includes("blockingVerdicts("),
    "nem hívja a blockingVerdicts-et",
  );
  check(
    `⛔ ${f.split("/").pop()} nem tart SAJÁT kulcslistát`,
    !/\["designVerdict",\s*"demoFraming"/.test(src),
    "beégetett kulcslista maradt benne",
  );
}

// ── The gate must run in the PROBE too, not only in the real send ───────────────
// (It sat below the dryRun return, so the screen said „kiküldhető" on a mock the
// button then refused — the badge answered a different question.)
{
  const src = readFileSync(new URL("../src/outreach/sendBatch.ts", import.meta.url), "utf8");
  const gateAt = src.indexOf("const blocking = blockingVerdicts(");
  const dryAt = src.indexOf("if (opts.dryRun)");
  check(
    "⛔ A verdikt-kapu a dry-run VISSZATÉRÉS ELŐTT fut (a próba ugyanazt méri, amit a gomb)",
    gateAt > 0 && dryAt > 0 && gateAt < dryAt,
    `verdikt-kapu@${gateAt} vs dryRun@${dryAt} — a próba nem látná a kaput`,
  );
}

console.log(`\nverdict-gate-check: ${pass} zöld, ${failures.length} bukás`);
if (failures.length) {
  for (const f of failures) console.error(`  ⛔ ${f}`);
  process.exit(1);
}
