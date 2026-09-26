// DEV-ONLY: tracked links (/p/<token>) for EVERY mock of the given leads — WITHOUT
// sending anything (Elek FK-009, the lead's first open on a phone).
//
// WHY: the mobile-first measurement needs the page the LEAD gets — the console's
// /p/<token> route (framing bar + configurator + legal footer + consent bar), not
// the bare artifact file. That page exists only for a prospect, and the two dev
// leads with all 19 styles had none (measured 2026-09-26). The product's own
// get-or-create (createProspect, one identity per lead+mock) mints the tokens;
// no e-mail, SMS or MMS is touched — the send button is a separate, operator
// action that this script never calls.
//
//   npx tsx scripts/seed-elek-lead-mobile-links.mts [<leadId> …]
//
// Default leads: the two 19-style dev leads (Ifjúsági Szállás Tihany, Laguna
// Panzió). Output: a table on stdout + assets/design-refs/_drafts/lead-mobile/
// links.json (gitignored, INSIDE the worktree so the owner can open it from RC).
//
// contact_email is set to elek@citoviso.com on purpose: should anyone press
// "send" on these prospects on the shared :4600 console, the e-mail leg can only
// go to Elek's own mailbox (the lead's real address is never copied onto the row).
// ⚠️ The SMS/MMS leg keys on the LEAD's phone, not on this row — do not send.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, pool } from "../src/db/client.js";
import { config } from "../src/config.js";
import { createProspect } from "../src/console/data.js";

const dsn = config.databaseUrl ?? process.env.DATABASE_URL ?? "";
if (dsn && !/@?(localhost|127\.0\.0\.1)|\/tmp|\.pgdata/.test(dsn)) {
  console.error("⛔ Ez a script CSAK helyi adatbázison futhat."); // i18n-exempt: operator log
  process.exit(1);
}

const DEFAULT_LEADS = [
  "d6fb61fc-6c7a-45f5-a3a2-025ec4f974c1", // Ifjúsági Szállás Tihany
  "de9bcca7-7e18-4d27-aff8-e6db2df00845", // Laguna Panzió
];
const leadIds = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const LEADS = leadIds.length ? leadIds : DEFAULT_LEADS;
const ELEK_EMAIL = "elek@citoviso.com";

export interface LeadMobileLink {
  leadId: string;
  leadName: string;
  leadSlug: string;
  style: string;
  artifactId: string;
  artifactPath: string;
  token: string;
  path: string;
  /** Runner env key, e.g. ELEK_P_TIHANY_ARCH_FRAMES (scenario: `út: ${…}`). */
  envKey: string;
}

/** Short, stable lead handle for env keys: last word of the slug family. */
function leadHandle(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ");
  // "ifjusagi szallas tihany" → TIHANY, "laguna panzio" → LAGUNA
  const generic = new Set(["panzio", "szallas", "vendeghaz", "hotel", "apartman", "haz", "ifjusagi"]);
  const pick = slug.filter((w) => !generic.has(w));
  return (pick[pick.length - 1] ?? slug[0] ?? "lead").toUpperCase();
}

function styleOf(artifactPath: string, inputs: unknown): string {
  const t = (inputs as { recipe?: { template?: string } } | null)?.recipe?.template;
  if (t) return t;
  const m = /^mock-.+-([a-z]+(?:-[a-z]+)*)-[0-9a-f]{8}\.html$/.exec(path.basename(artifactPath));
  return m?.[1] ?? "unknown";
}

try {
  const links: LeadMobileLink[] = [];
  for (const leadId of LEADS) {
    const lead = await db.selectFrom("lead").select(["id", "name"]).where("id", "=", leadId).executeTakeFirst();
    if (!lead) {
      console.error(`⛔ nincs ilyen lead: ${leadId}`);
      process.exit(1);
    }
    const artifacts = await db
      .selectFrom("mock_artifact")
      .select(["id", "path", "inputs"])
      .where("lead_id", "=", leadId)
      .orderBy("generated_at", "asc")
      .execute();
    const handle = leadHandle(lead.name);
    for (const a of artifacts) {
      if (!a.path) continue;
      const style = styleOf(a.path, a.inputs);
      const p = await createProspect({ leadId, artifactId: a.id, contactEmail: ELEK_EMAIL });
      if (!p) throw new Error(`createProspect null: ${leadId}/${a.id}`);
      links.push({
        leadId,
        leadName: lead.name,
        leadSlug: handle.toLowerCase(),
        style,
        artifactId: a.id,
        artifactPath: a.path,
        token: p.token,
        path: `/p/${p.token}`,
        envKey: `ELEK_P_${handle}_${style.toUpperCase().replace(/-/g, "_")}`,
      });
    }
  }
  const outDir = path.resolve(import.meta.dirname, "../assets/design-refs/_drafts/lead-mobile");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "links.json"), JSON.stringify({ generatedAt: new Date().toISOString(), links }, null, 2));
  for (const l of links) console.log(`${l.leadSlug.padEnd(8)} ${l.style.padEnd(15)} ${l.path}   ${l.envKey}`);
  console.log(`\n✅ ${links.length} követett link (küldés nélkül) → ${path.relative(process.cwd(), outDir)}/links.json`);
} finally {
  await pool.end();
}
