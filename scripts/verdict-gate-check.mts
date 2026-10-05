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
  copyHashOf,
  reviewFormErrors,
  reviewStateOf,
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

// ── ADR-XXXX: Vera's review replaces the AI guards on the curator path ──────────
{
  const recipe = { sections: [{ kind: "hero", copy: { lead: "Kert a part mellett" } }] };
  const siteData = { tagline: "Csend", intro: "Bevezető", highlights: ["Kert"] };
  const base = { recipe, siteData };
  const hash = copyHashOf(base)!;
  const reviewed = (verdict: "pass" | "flag", copyHash: string | null = hash) => ({
    ...base,
    reviewVerdict: verdict,
    review: { verdict, by: "Vera", at: "2026-10-05T18:00:00.000Z", ref: "jelentesek/x.md", note: "A15 „Hungary”", copyHash },
    reviewReason: verdict === "flag" ? "A15 „Hungary” (jelentesek/x.md)" : null,
  });
  const pend = blockingVerdicts({ ...base, reviewVerdict: "pending" });
  check("⛔ A HIÁNYZÓ Vera-ítélet blokkol (nem úgy, mint a hiányzó kulcs)", pend.length === 1 && pend[0]!.value === "pending", JSON.stringify(pend));
  check(
    "⛔ A hiányzó ítélet SEMMILYEN vállalással nem nyugtázható",
    !ackCoversVerdicts(ack({ reviewVerdict: "pending" }), pend),
    "a pending-re adott ack átengedte",
  );
  check("A hiányzó ítélet sora kimondja", /NINCS ellenőrző ítélet/.test(verdictReasonLine(pend[0]!)), verdictReasonLine(pend[0]!));
  check("A PASS átenged", blockingVerdicts(reviewed("pass")).length === 0, JSON.stringify(blockingVerdicts(reviewed("pass"))));
  const flag = blockingVerdicts(reviewed("flag"));
  check("A FLAG blokkol, Vera megjegyzésével", flag.length === 1 && flag[0]!.value === "flag" && flag[0]!.reason.includes("Hungary"), JSON.stringify(flag));
  check("A FLAG a meglévő vállalással küldhető", ackCoversVerdicts(ack({ reviewVerdict: "flag" }), flag), "nem fedett");
  // The safety belt: a verdict given on OTHER words is no verdict.
  const changed = { ...reviewed("pass"), siteData: { ...siteData, tagline: "Más szöveg" } };
  check("⛔ Szöveg-változás után a régi PASS „hiányzik”", reviewStateOf(changed) === "pending", String(reviewStateOf(changed)));
  check("⛔ …és blokkol", blockingVerdicts(changed).length === 1, JSON.stringify(blockingVerdicts(changed)));
  check("⛔ Ítélet-objektum nélküli „pass” = hiányzik", reviewStateOf({ ...base, reviewVerdict: "pass" }) === "pending", "átment");
  check("Nem kurátori mock: nincs Vera-kapu", reviewStateOf(base) === null && blockingVerdicts(base).length === 0, "kapu jelent meg");
  check("Az űrlap: üres mentés hibát ad", Object.keys(reviewFormErrors({ verdict: "", ref: " ", note: "" })).length === 2, "nem 2 hiba");
  check("Az űrlap: FLAG megjegyzés nélkül hibás", !!reviewFormErrors({ verdict: "flag", ref: "j.md", note: "rövid" }).note, "elfogadta");
  check("Az űrlap: 200 karakter fölött hibás", !!reviewFormErrors({ verdict: "pass", ref: "x".repeat(201), note: "" }).ref, "elfogadta");
  check("Az űrlap: érvényes PASS megjegyzés nélkül", Object.keys(reviewFormErrors({ verdict: "pass", ref: "j.md", note: "" })).length === 0, "hibát adott");
  // Wiring: the hand edit runs no AI guard and asks for a review; the AI rewrite drops it.
  const manual = readFileSync(new URL("../src/generator/copyManual.ts", import.meta.url), "utf8");
  check("⛔ A kézi mentés NEM futtat AI-őrt", !/verifyFactuality\(|verifyMarketRelevance\(|judgeGuestCopy\(/.test(manual), "AI-őr hívás maradt");
  check("⛔ A kézi mentés „pending”-re állít", /reviewVerdict: "pending"/.test(manual), "nincs pending");
  check("⛔ A kézi mentés eldobja a régi ítéletet és a vállalást", /"review", "reviewReason", "verdictAck"/.test(manual), "a régi review/ack megmarad");
  const recopy = readFileSync(new URL("../src/generator/recopy.ts", import.meta.url), "utf8");
  check("⛔ Az AI-újraírás eldobja a Vera-ítéletet", /\["review", "reviewVerdict", "reviewReason"\]/.test(recopy), "a review megmarad az új szöveg alatt");
  const consoleRoutes = readFileSync(new URL("../src/console/server.ts", import.meta.url), "utf8");
  check(
    "⛔ A küldés-megerősítés hiányzó ítéletnél NEM rögzít vállalást",
    /form\.get\("confirmVerdicts"\) !== "1" \|\| hasPendingReview\(need\.blocking\)/.test(consoleRoutes),
    "a confirmVerdicts=1 átvinné",
  );
}

console.log(`\nverdict-gate-check: ${pass} zöld, ${failures.length} bukás`);
if (failures.length) {
  for (const f of failures) console.error(`  ⛔ ${f}`);
  process.exit(1);
}
