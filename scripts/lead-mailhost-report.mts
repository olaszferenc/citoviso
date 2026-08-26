// Which mailbox provider will actually receive our cold outreach?
//
// Why this exists (ADR-0069): the "Frissítések"-tab problem is GMAIL-specific, so
// the value of the fix depends on how many leads are really behind Google. The
// address domain alone does not answer that — an @panzio.hu owner is very often on
// Google Workspace or Microsoft 365. So for every non-freemail domain we resolve MX
// and classify by the ACTUAL host, not by the string after the @.
//
// Read-only: touches the lead table and public DNS, writes nothing.
//
// Usage: npx tsx scripts/lead-mailhost-report.mts [--csv]

import { promises as dns } from "node:dns";
import { sql } from "kysely";
import { db } from "../src/db/client.js";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Consumer mailboxes we can classify from the domain alone — no MX needed. */
const FREEMAIL: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(gmail|googlemail)\.com$/, "Gmail (ingyenes)"],
  [/^(outlook|hotmail|live|msn)\.(com|hu|co\.uk|de)$/, "Microsoft (ingyenes)"],
  [/^(yahoo|ymail)\./, "Yahoo"],
  [/^(freemail|citromail|indamail|vipmail)\.hu$/, "Magyar freemail"],
  [/^(t-online|upcmail|invitel|digikabel|chello)\.hu$/, "Magyar szolgáltatói (ISP)"],
  [/^(protonmail\.com|proton\.me|pm\.me)$/, "Proton"],
  [/^(icloud|me)\.com$/, "Apple iCloud"],
];

/** Classify a custom domain by where its MX actually points. */
function classifyMx(hosts: readonly string[]): string {
  const h = hosts.join(" ").toLowerCase();
  if (/aspmx.*google|google\.com$|googlemail\.com|google\.com /.test(h) || /google/.test(h)) {
    return "Google Workspace (saját domain)";
  }
  if (/outlook\.com|protection\.outlook|microsoft/.test(h)) return "Microsoft 365 (saját domain)";
  if (/zoho/.test(h)) return "Zoho";
  if (/yandex/.test(h)) return "Yandex";
  // The long tail is dominated by small Hungarian hosters and their spam filters;
  // lumping them into "other" hid ~30% of the leads behind a useless label.
  if (
    /rackhost|dotroll|nethely|tarhely\.eu|forpsi|websupport|mediacenter|evolutionet|integrity\.hu|szerverzone|hostinger|cpanel|iworx-host|spamzabalo|mailspamprotection|megacp|ininet|netidea|domain\.hu|3in\.hu|bithuszarok|shinden|hostpark|ipglobe|deltasys/.test(
      h,
    )
  ) {
    return "Magyar/EU tárhelyszolgáltató";
  }
  if (!hosts.length) return "Nincs MX (nem fogad levelet?)";
  return "Egyéb / saját levelezőszerver";
}

async function mxFor(domain: string): Promise<string[]> {
  try {
    const rs = await dns.resolveMx(domain);
    return rs.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.toLowerCase());
  } catch {
    return [];
  }
}

/** Resolve with a small concurrency cap — a few hundred domains, be polite. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    }),
  );
  return out;
}

async function main(): Promise<void> {
  const rows = (
    await sql
      .raw(
        `select raw->>'email' as email
           from lead
          where raw->>'email' is not null and raw->>'email' <> ''`,
      )
      .execute(db)
  ).rows as Array<{ email: string | null }>;

  const totalLeads = ((await sql.raw("select count(*)::int n from lead").execute(db)).rows[0] as { n: number }).n;

  // One lead may carry several addresses; count the LEAD once, by its first address.
  const perLeadDomain: string[] = [];
  for (const r of rows) {
    const found = (r.email ?? "").match(EMAIL_RE);
    if (!found?.length) continue;
    const dom = found[0]!.split("@")[1]!.toLowerCase().replace(/\.$/, "");
    perLeadDomain.push(dom);
  }

  const domainCounts = new Map<string, number>();
  for (const d of perLeadDomain) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);

  // Freemail resolves from the name; everything else needs an MX lookup.
  const custom: string[] = [];
  const label = new Map<string, string>();
  for (const d of domainCounts.keys()) {
    const hit = FREEMAIL.find(([re]) => re.test(d));
    if (hit) label.set(d, hit[1]);
    else custom.push(d);
  }

  process.stderr.write(`MX-lekérdezés ${custom.length} saját domainre…\n`);
  const mxs = await mapLimit(custom, 16, mxFor);
  custom.forEach((d, i) => label.set(d, classifyMx(mxs[i]!)));

  const bucket = new Map<string, number>();
  for (const [d, n] of domainCounts) {
    const l = label.get(d) ?? "Ismeretlen";
    bucket.set(l, (bucket.get(l) ?? 0) + n);
  }

  const withEmail = perLeadDomain.length;
  const sorted = [...bucket.entries()].sort((a, b) => b[1] - a[1]);

  if (process.argv.includes("--csv")) {
    console.log("szolgaltato,leadek,arany_szazalek");
    for (const [k, v] of sorted) console.log(`"${k}",${v},${((v / withEmail) * 100).toFixed(1)}`);
    process.exit(0);
  }

  console.log(`\n📊 LEAD-POSTAFIÓKOK — mi fogadja a megkeresésünket?\n`);
  console.log(`   Lead összesen: ${totalLeads} · ebből e-mail címmel: ${withEmail} ` +
    `(${((withEmail / totalLeads) * 100).toFixed(0)}%) · egyedi domain: ${domainCounts.size}\n`);

  const pad = Math.max(...sorted.map(([k]) => k.length));
  for (const [k, v] of sorted) {
    const pct = (v / withEmail) * 100;
    const bar = "█".repeat(Math.round(pct / 2));
    console.log(`   ${k.padEnd(pad)}  ${String(v).padStart(4)}  ${pct.toFixed(1).padStart(5)}%  ${bar}`);
  }

  // The number that decides how much ADR-0069 is worth.
  const google = sorted
    .filter(([k]) => /Gmail|Google/.test(k))
    .reduce((s, [, v]) => s + v, 0);
  const ms = sorted.filter(([k]) => /Microsoft/.test(k)).reduce((s, [, v]) => s + v, 0);
  console.log(`\n   ▸ GOOGLE-fiók (Gmail + Workspace): ${google} lead — ${((google / withEmail) * 100).toFixed(1)}%`);
  console.log(`     Ezekre hat a "Frissítések"-fül probléma (ADR-0069).`);
  console.log(`   ▸ MICROSOFT (ingyenes + 365):      ${ms} lead — ${((ms / withEmail) * 100).toFixed(1)}%`);
  console.log(`     Az Outlooknak NINCS fül-rendszere; ott a Beérkezett/Egyéb (Focused/Other) a kérdés.\n`);

  const top = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`   Leggyakoribb domainek:`);
  for (const [d, n] of top) console.log(`     ${String(n).padStart(4)} × ${d}  → ${label.get(d)}`);
  console.log();
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
