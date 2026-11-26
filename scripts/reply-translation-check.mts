// ACCEPTANCE — the replies block in the operator's console language + the lead's country chip
// (plan assets/design-refs/console/orszag-szuro-forditas/, owner 2026-11-26 „2.B · 3 igen”), in a
// SCRATCH database (never the shared dev DB, never production). Nothing is translated by code
// (ADR-0412): the check plays Bábel by laying translations down through saveTranslation.
//
//   ① fingerprint: sourceHash ignores surrounding whitespace; a translation binds to ITS source;
//   ② Bábel's ticket feed: a Croatian reply owes body + ours + suggestion for every operator
//      console language other than hr (hu, en here); a Hungarian reply owes nothing for hu;
//      a reply with an unknown language (lang NULL) owes nothing;
//   ③ saveTranslation refuses an unknown part, the conversation's own language, an empty text and
//      a stale fingerprint; a good one stores and leaves the feed; Poe rewriting his suggestion
//      makes it owed again (and the old translation stops showing);
//   ④ the dashboard: the ISO chip in the list and the head, the country's name, „Fordítás (horvát)”
//      + the dimmed original, the suggestion's original marked as what goes out, the list excerpt
//      from the translation; in a language without a translation „Bábel fordítja …” + the original;
//      a same-language reply shows no translation mark; Bábel's form only with translateForm.
//
//   npx tsx scripts/reply-translation-check.mts [--shot]
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_reply_tr";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.I18N_BOOT_TOPUP = "0";
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY"]) process.env[k] = "";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const { db } = await import("../src/db/client.js");
const { refreshCountries } = await import("../src/country.js");
const tr = await import("../src/replies/translation.js");
const { getRepliesBlock } = await import("../src/replies/store.js");
const { repliesBlockHtml } = await import("../src/console/views.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

try {
  await refreshCountries();
  console.log("① ujjlenyomat");
  check("a környező szóköz nem számít", tr.sourceHash("  Bok!\n") === tr.sourceHash("Bok!"));
  check("más szöveg = más ujjlenyomat", tr.sourceHash("Bok!") !== tr.sourceHash("Bok."));
  const st = { hu: { text: "Szia!", hash: tr.sourceHash("Bok!"), by: "Bábel" } };
  check("a fordítás a SAJÁT forrásához köt", tr.translationOf(st, "Bok!", "hr", "hu")?.text === "Szia!");
  check("megváltozott forrásnál nincs fordítás", tr.translationOf(st, "Bok, hvala!", "hr", "hu") === null);
  check("saját nyelven nincs mit fordítani", !tr.needsTranslation("Szia", "hu", "hu") && tr.translationOf(st, "Bok!", "hu", "hu") === null);
  check("ismeretlen nyelven nincs mit fordítani", !tr.needsTranslation("Bok!", null, "hu"));

  // Fixtures: one HR and one HU area, a lead in each, three operators (hu, en, babel=hu).
  const def = async (country: string) =>
    (await db.insertInto("scraper_definition").values({ label: `e2e ${country}`, country, region: "e2e", industry: "lodging" } as never).returning("id").executeTakeFirstOrThrow()).id;
  const run = async (defId: string) =>
    (await db.insertInto("scrape_run").values({ scraper_definition_id: defId } as never).returning("id").executeTakeFirstOrThrow()).id;
  const lead = async (runId: string, name: string, country: string) =>
    (await db.insertInto("lead").values({ scrape_run_id: runId, name, raw: JSON.stringify({ country }) } as never).returning("id").executeTakeFirstOrThrow()).id;
  const hrLead = await lead(await run(await def("HR")), "Apartmani Marija (e2e)", "HR");
  const huLead = await lead(await run(await def("HU")), "Villa Eszter (e2e)", "HU");
  for (const [username, lang] of [["anna", "hu"], ["john", "en"], ["babel", "hu"]] as const)
    await db.insertInto("operator_user").values({ username, display_name: username === "babel" ? "Bábel" : username, password_hash: "x:y", lang } as never).execute();
  const now = new Date();
  const reply = async (leadId: string, lang: string | null, body: string, ours: string, sug: string | null) =>
    (
      await db
        .insertInto("outreach_reply")
        .values({ lead_id: leadId, channel: "email", sender: `${leadId.slice(0, 6)}@example.test`, received_at: now, body, source_key: `e2e-${leadId}-${lang}`, lang, ours_text: ours, suggestion_text: sug, suggestion_at: sug ? now : null, suggestion_by: sug ? "Poe" : null } as never)
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const HR_BODY = "Poštovani,\nhvala na prijedlogu. Koliko košta godišnje?\nMarija";
  const HR_OURS = "Poštovana gospođo Marija, izradili smo prijedlog web stranice.";
  const HR_SUG = "Poštovana gospođo Marija, cijena je 7 € mjesečno.";
  const hrReply = await reply(hrLead, "hr", HR_BODY, HR_OURS, HR_SUG);
  await reply(huLead, "hu", "Köszönjük, érdekel.", "Tisztelt Villa Eszter!", null);
  const unknownReply = await reply(hrLead, null, "Hello?", "", null);

  console.log("② Bábel jegy-forrása");
  const owed = await tr.repliesNeedingTranslation();
  const hrOwed = owed.find((o) => o.id === hrReply);
  const keys = (hrOwed?.items ?? []).map((i) => `${i.part}:${i.target}`).sort();
  check("HR válasz: body+ours+suggestion × hu,en", JSON.stringify(keys) === JSON.stringify(["body:en", "body:hu", "ours:en", "ours:hu", "suggestion:en", "suggestion:hu"]), keys.join(","));
  check("a jegy a forrás ujjlenyomatát viszi", hrOwed?.items.find((i) => i.part === "body")?.hash === tr.sourceHash(HR_BODY));
  check("HU válasz: csak az angol konzolnak kell", owed.filter((o) => o.lang === "hu").every((o) => o.items.every((i) => i.target === "en")));
  check("ismeretlen nyelvű válasz nincs a sorban", !owed.some((o) => o.id === unknownReply));

  console.log("③ letétel");
  const hashBody = tr.sourceHash(HR_BODY);
  check("ismeretlen rész → elutasítva", (await tr.saveTranslation(hrReply, { part: "x", lang: "hu", hash: hashBody, text: "a" }, "Bábel")) !== null);
  check("a beszélgetés saját nyelvére → elutasítva", (await tr.saveTranslation(hrReply, { part: "body", lang: "hr", hash: hashBody, text: "a" }, "Bábel")) !== null);
  check("üres fordítás → elutasítva", (await tr.saveTranslation(hrReply, { part: "body", lang: "hu", hash: hashBody, text: "  " }, "Bábel")) !== null);
  check("elavult ujjlenyomat → elutasítva", (await tr.saveTranslation(hrReply, { part: "body", lang: "hu", hash: "0000000000000000", text: "a" }, "Bábel")) !== null);
  const HU_BODY = "Tisztelt Címzett!\nKöszönöm az ajánlatot. Mennyibe kerül évente?\nMarija";
  check("jó letétel → tárolva", (await tr.saveTranslation(hrReply, { part: "body", lang: "hu", hash: hashBody, text: HU_BODY }, "Bábel")) === null);
  check("jó letétel (javaslat)", (await tr.saveTranslation(hrReply, { part: "suggestion", lang: "hu", hash: tr.sourceHash(HR_SUG), text: "Tisztelt Marija asszony! Az ár havi 7 €." }, "Bábel")) === null);
  const owed2 = (await tr.repliesNeedingTranslation()).find((o) => o.id === hrReply);
  const keys2 = (owed2?.items ?? []).map((i) => `${i.part}:${i.target}`).sort();
  check("a letett részek kikerültek a sorból", JSON.stringify(keys2) === JSON.stringify(["body:en", "ours:en", "ours:hu", "suggestion:en"]), keys2.join(","));

  console.log("④ irányítópult");
  const block = await getRepliesBlock();
  const q = { filter: "all" as const, reply: hrReply };
  const hu = repliesBlockHtml(block, q, "hu");
  check("ISO-chip a listában és a fejlécben", (hu.match(/class="con-rep__iso" title="Horvátország">HR</g) ?? []).length >= 2);
  check("az ország neve a fejlécben", /con-rep__who">Horvátország/.test(hu));
  check("„Fordítás (horvát) · Bábel” + a fordítás", hu.includes("Fordítás (horvát) · Bábel") && hu.includes("Köszönöm az ajánlatot"));
  check("az eredeti alatta, halványan", hu.includes("Eredeti · horvát") && hu.includes("hvala na prijedlogu"));
  check("Poe javaslatánál az eredeti „ez megy ki”", hu.includes("Eredeti · horvát — ez megy ki") && hu.includes("Az ár havi 7 €"));
  check("a még le nem fordított rész: „Bábel fordítja…” + eredeti", hu.includes("Bábel fordítja (magyar)… addig az eredeti (horvát)") && hu.includes("izradili smo prijedlog"));
  check("lista-kivonat a fordításból + „fordítva: horvát”", /con-rep__ex">Tisztelt Címzett!/.test(hu) && hu.includes("fordítva: horvát"));
  const huOnly = repliesBlockHtml({ ...block, replies: block.replies.filter((r) => r.lang === "hu") }, { filter: "all", reply: null }, "hu");
  check("saját nyelvű válasznál nincs fordítás-jel", !/con-rep__(trh|trw|trtag|orig)"/.test(huOnly));
  const en = repliesBlockHtml(block, q, "en");
  check("angol konzolon, fordítás nélkül: várakozás-jel + eredeti", /con-rep__trw/.test(en) && en.includes("hvala na prijedlogu"));
  check("Bábel űrlapja csak translateForm mellett", !hu.includes("/translate\"") && repliesBlockHtml(block, { ...q, translateForm: true }, "hu").includes(`action="/replies/${hrReply}/translate"`));

  console.log("③b Poe átírja a javaslatát");
  await db.updateTable("outreach_reply").set({ suggestion_text: "Poštovana gospođo Marija, cijena je 8 € mjesečno." }).where("id", "=", hrReply).execute();
  const owed3 = (await tr.repliesNeedingTranslation()).find((o) => o.id === hrReply);
  check("az új javaslat újra Bábelé", (owed3?.items ?? []).some((i) => i.part === "suggestion" && i.target === "hu"));
  const hu2 = repliesBlockHtml(await getRepliesBlock(), q, "hu");
  check("a régi fordítás nem látszik az új javaslat mellett", !hu2.includes("Az ár havi 7 €"));
  // --shot: the dashboard of this scratch world at 390px + desktop (ui-shot on the same DB), for the eye.
  if (process.argv.includes("--shot")) {
    execFileSync("npx", ["tsx", "scripts/ui-shot.mts", `/?replies=all&reply=${hrReply}`, "--out=reply-translation"], { env: process.env, stdio: "inherit" });
  }
} finally {
  await db.destroy();
}
console.log(fails ? `\n✗ ${fails} hiba` : "\n✓ minden ellenőrzés zöld");
process.exit(fails ? 1 : 0);
