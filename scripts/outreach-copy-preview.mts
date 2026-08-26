// Subject + opening-line variants, shown AS THE LEAD ACTUALLY SEES THEM.
//
// Why (ADR-0069 utóélet): with the Frissítések-tab fixed, the open rate is now
// decided by the only three things a Gmail row shows — sender, subject, first line.
// Measured on the 389 leads that have an address: the current subject puts the
// business name FIRST, and at the MEDIAN name length (16 chars) the actual hook
// ("honlap-tervet") already falls ~20 characters outside the ~38 chars mobile Gmail
// renders. For the long names the lead sees ONLY their own name. Meanwhile the first
// body line — the snippet — is "Tisztelt Vendéglátó!", pure filler.
//
// This script PROPOSES; it changes nothing. The wording is the owner's call
// (draft.ts: "The owner tunes the wording HERE"), so every variant is rendered at
// real truncation widths and run through the §C gate, and the owner picks.
//
// Usage: npx tsx scripts/outreach-copy-preview.mts

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { loadPricing } from "../src/pricing.js";
import { renderDraft, type DraftInput, type OutreachDraft } from "../src/outreach/draft.js";
import { checkOutreachDraft } from "../src/outreach/outreachCheck.js";

/** What mobile Gmail renders before truncating (measured on a 390px viewport). */
const SUBJECT_CHARS = 38;
const SNIPPET_CHARS = 90;

interface Variant {
  readonly key: string;
  readonly title: string;
  readonly why: string;
  readonly subject: (d: DraftInput) => string;
  /** Replaces the greeting + hook paragraphs; the rest of the mail is untouched. */
  readonly opening: (d: DraftInput) => string;
}

function proof(d: DraftInput): string {
  if (!d.rating?.count) return "";
  return `${String(d.rating.value).replace(".", ",")} csillag ${d.rating.count} vélemény alapján`;
}

const VARIANTS: readonly Variant[] = [
  {
    key: "A",
    title: "JELENLEGI (kontroll)",
    why: "Ez megy ma. A név elöl, a lényeg a levágás mögött.",
    subject: (d) => `${d.leadName} – készítettem Önöknek egy honlap-tervet`,
    opening: (d) =>
      `Tisztelt Vendéglátó!\n\nA(z) ${d.leadName} szépen jelen van az interneten, de úgy láttuk, ` +
      `egy saját, modern oldal még hiányzik a képből — pedig a vendégek ott döntenek.`,
  },
  {
    key: "B",
    title: "RÖVID TÁRGY + bizonyíték az első sorban",
    why:
      "A tárgy mediánnál is befér, tehát a „honlap-terv” tényleg LÁTSZIK a telefonon. " +
      "Az első sor nem üdvözlés-töltelék, hanem a saját Google-értékelése — ezt csak az tudja, aki megnézte.",
    subject: (d) => `${d.leadName} – honlap-terv`,
    opening: (d) => {
      const p = proof(d);
      const first = p
        ? `A Google-on ${p} — de saját honlapot nem találtunk a(z) ${d.leadName} mellé.`
        : `Saját honlapot nem találtunk a(z) ${d.leadName} mellé — pedig a vendégek ott döntenek.`;
      return `${first}\n\nTisztelt Vendéglátó! Készítettem egy tervet, hogy lássa, hogyan nézne ki.`;
    },
  },
  {
    key: "C",
    title: "HOROG ELÖL, név utána",
    why:
      "A tárgy első két szava mindig ugyanaz és mindig látszik, a név utána jön. " +
      "Előny: a levágás sosem eszi meg a lényeget. Hátrány: kevésbé hat „nekem szól”-nak első pillantásra.",
    subject: (d) => `Honlap-terv – ${d.leadName}`,
    opening: (d) => {
      const p = proof(d);
      const first = p
        ? `Tisztelt Vendéglátó! A(z) ${d.leadName} a Google-on ${p} — ez egy saját oldalon is látszana.`
        : `Tisztelt Vendéglátó! A(z) ${d.leadName} mellé nem találtunk saját honlapot.`;
      return `${first}\n\nKészítettem egy tervet, hogy ne csak beszéljünk róla.`;
    },
  },
  {
    key: "D",
    title: "KÍVÁNCSISÁG (a terv-szó a törzsben marad)",
    why:
      "A legerősebb megnyitó-horog, mert kérdést hagy nyitva. Kockázat: a tárgyban nincs " +
      "„terv” szó, így első pillantásra ígéretesebbnek hat — a törzs azonnal tisztázza, de ez ízlés kérdése.",
    subject: (d) => `${d.leadName} – így nézne ki egy saját oldal`,
    opening: (d) => {
      const p = proof(d);
      const first = p
        ? `Tisztelt Vendéglátó! ${p} a Google-on — de ezt ma egyetlen saját oldal sem mutatja meg.`
        : `Tisztelt Vendéglátó! A(z) ${d.leadName} ma nem található meg saját honlappal.`;
      return `${first}\n\nEzért készítettem egy előzetes tervet — semmire nem kötelezi.`;
    },
  },
];

/** Splice a variant's subject + opening into an otherwise untouched draft. */
function applyVariant(base: OutreachDraft, v: Variant, d: DraftInput): OutreachDraft {
  const paras = base.body.split(/\n\n+/);
  // paragraphs[0] = greeting, [1] = hook → replaced together by the variant opening.
  const rest = paras.slice(2).join("\n\n");
  return { ...base, subject: v.subject(d), body: `${v.opening(d)}\n\n${rest}` };
}

function cut(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
}

function row(v: Variant, d: DraftInput): { subject: string; snippet: string; verdict: string } {
  const draft = applyVariant(renderDraft(d), v, d);
  const c = checkOutreachDraft(draft, d.leadName, "hu");
  return {
    subject: cut(draft.subject, SUBJECT_CHARS),
    snippet: cut(draft.body, SNIPPET_CHARS),
    verdict: c.verdict === "PASS" ? "✅ §C PASS" : `⛔ §C FLAG — ${c.reasons[0]}`,
  };
}

async function main(): Promise<void> {
  await loadPricing();

  const names = (
    await sql
      .raw(`select name from lead where raw->>'email' is not null order by length(name)`)
      .execute(db)
  ).rows as Array<{ name: string }>;
  const median = names[Math.floor(names.length * 0.5)]!.name;
  const long = names[names.length - 3]!.name;

  // The rating comes from the artifact's A4-gated SiteData, so it exists only for
  // leads whose mock was generated and approved — both branches are real life.
  const withRating = (n: string): DraftInput => ({
    leadName: n,
    region: "gödöllő",
    qualification: null,
    segment: "van_labnyom",
    rating: { value: 4.7, count: 103 },
    token: "elonezetTokenHelye12345",
  });
  const noRating = (n: string): DraftInput => ({ ...withRating(n), rating: null });

  console.log(`\n📱 AMIT A TULAJ LÁT A TELEFONJÁN (tárgy ~${SUBJECT_CHARS}, előnézet ~${SNIPPET_CHARS} karakter)`);
  console.log(`   Példa-lead: „${median}” · értékelés: 4,7 / 103 (illusztratív érték)\n`);

  for (const v of VARIANTS) {
    const r = row(v, withRating(median));
    console.log(`${"─".repeat(78)}`);
    console.log(`${v.key})  ${v.title}   ${r.verdict}`);
    console.log(`     ┌────────────────────────────────────────────────`);
    console.log(`     │ Olasz Ferenc`);
    console.log(`     │ ${r.subject}`);
    console.log(`     │ ${r.snippet}`);
    console.log(`     └────────────────────────────────────────────────`);
    console.log(`     ${v.why}\n`);
  }

  console.log(`\n${"═".repeat(78)}`);
  console.log(`HOSSZÚ NÉV — itt bukik meg a mai tárgy („${long}”, ${long.length} karakter)`);
  console.log(`${"═".repeat(78)}`);
  for (const v of VARIANTS) {
    console.log(`  ${v.key}) ${row(v, withRating(long)).subject}`);
  }

  console.log(`\n${"═".repeat(78)}`);
  console.log(`ÉRTÉKELÉS NÉLKÜLI LEAD (nincs jóváhagyott mock-rating) — az első sor ilyenkor:`);
  console.log(`${"═".repeat(78)}`);
  for (const v of VARIANTS) {
    console.log(`  ${v.key}) ${row(v, noRating(median)).snippet}`);
  }
  console.log();
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
