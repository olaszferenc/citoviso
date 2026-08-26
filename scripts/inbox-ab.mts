// Gmail TAB-PLACEMENT lab (2×2) — why does the outreach mail land in "Frissítések"?
//
// Measured evidence that motivated this tool (2026-08-25, olaszferenc@gmail.com):
//   category:updates → 3 hits, ALL of them outreach mails.
//   category:primary → 8 hits, EVERY other citoviso mail (invoice, credentials,
//                      stale-language notice, plain tests).
// Same sender, same Zoho SMTP, same SPF/DKIM — so it is NOT authentication and
// NOT domain reputation. The two candidate causes left are the RFC-2369
// List-Unsubscribe header (only outreachEmail.ts sets it) and the CID hero image
// (only the outreach mail carries one). A forwarded copy of an outreach mail —
// same 497 KB image, but the original headers stripped — landed in PRIMARY,
// which points at the header; one data point is not proof, hence this 2×2.
//
// This tool sends the FOUR combinations to ONE mailbox and does nothing else.
// It deliberately bypasses sendBatch: no prospect row is read, claimed, marked
// sent, or mutated in any way. It is a lab instrument, not an outreach path.
//
// ⛔ The lead fixtures below are INVENTED (names, ratings). That is safe only
// because the recipient is our own test mailbox. Sending these to a real lead
// would fabricate facts about their business (§B.17), so the tool refuses to
// send to any address that appears as a prospect contact e-mail.
//
// Usage:
//   PUBLIC_BASE_URL=https://citoviso.com EMAIL_PROVIDER=smtp \
//     npx tsx scripts/inbox-ab.mts <to-address> [--delay-ms=120000] [--dry-run]

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { loadPricing } from "../src/pricing.js";
import { renderDraft, type DraftInput } from "../src/outreach/draft.js";
import { buildOutreachEmail } from "../src/email/outreachEmail.js";
import { getEmailSender, type EmailMessage } from "../src/email/sender.js";

const MANIFEST_DIR = path.resolve("sites/_inbox-ab");

/** A hero screenshot that already exists locally — the real mails embed one of these. */
const HERO_SHOT = path.resolve(
  "sites/_outreach-shots/b799970a-1bd7-41a0-a0a5-8bf731e53091-1787666810-v2.png",
);

interface Variant {
  readonly key: string;
  readonly label: string;
  /** Embed the CID hero screenshot (as today's outreach mail does). */
  readonly image: boolean;
  /**
   * The unsubscribe headers to send, or null for none. Round 1 proved the header
   * is what tabs the mail; round 2 asks WHICH PART of it — if the plain RFC-2369
   * List-Unsubscribe survives in Primary and only the RFC-8058 one-click Post is
   * the bulk signal, we can keep a header-level opt-out AND reach the inbox.
   */
  readonly headers: ((unsubscribeLink: string) => Record<string, string>) | null | "config";
  readonly lead: DraftInput;
}

const FULL = (u: string) => ({
  "List-Unsubscribe": `<${u}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});
const NO_ONE_CLICK = (u: string) => ({ "List-Unsubscribe": `<${u}>` });
const MAILTO_ONLY = () => ({
  "List-Unsubscribe": `<mailto:${config.outreachSender.email ?? ""}?subject=Leiratkozas>`,
});

// Distinct lead names so the four mails do not collapse into one Gmail thread.
// Everything else (segment, hook shape, rating presence) is held constant, so the
// only deliberate differences across variants are `image` and `header`.
const LEADS: ReadonlyArray<{ name: string; token: string }> = [
  { name: "Napfény Panzió", token: "abtestNapfenyPanzio01xQ" },
  { name: "Tópart Vendégház", token: "abtestTopartVendeghaz2" },
  { name: "Szilvás Fogadó", token: "abtestSzilvasFogado03z" },
  { name: "Kőrisfa Vendégház", token: "abtestKorisfaVendegh04" },
  { name: "Aranyhíd Fogadó", token: "abtestAranyhidFogado05" },
  { name: "Diófa Vendégház", token: "abtestDiofaVendeghaz06" },
  { name: "Nyárfa Panzió", token: "abtestNyarfaPanzio07ab" },
];

function lead(i: number): DraftInput {
  return {
    leadName: LEADS[i]!.name,
    region: "gödöllő",
    qualification: null,
    segment: "van_labnyom",
    rating: { value: 4.6, count: 91 },
    token: LEADS[i]!.token,
  };
}

/**
 * Round 1 (2×2: image × header) — MEASURED 2026-08-25, olaszferenc@gmail.com:
 *   A kép + fejléc     → FRISSÍTÉSEK
 *   B kép, nincs fejléc → ELSŐDLEGES
 *   C nincs kép + fejléc → FRISSÍTÉSEK
 *   D nincs kép, nincs fejléc → ELSŐDLEGES
 * The image explains none of it; the List-Unsubscribe header explains all of it.
 */
const ROUND_1: readonly Variant[] = [
  { key: "A", label: "kép + List-Unsubscribe (KONTROLL = a mai levél)", image: true, headers: FULL, lead: lead(0) },
  { key: "B", label: "kép, NINCS List-Unsubscribe", image: true, headers: null, lead: lead(1) },
  { key: "C", label: "NINCS kép + List-Unsubscribe", image: false, headers: FULL, lead: lead(2) },
  { key: "D", label: "NINCS kép, NINCS List-Unsubscribe", image: false, headers: null, lead: lead(3) },
];

/**
 * Round 3 — the ACCEPTANCE run. Rounds 1–2 overrode the headers by hand, which proves
 * the hypothesis but not the wiring. Here nothing is overridden: the mail is whatever
 * buildOutreachEmail produces from OUTREACH_LIST_UNSUBSCRIBE, with the hero image on.
 * This is the exact shape a lead now receives, so a Primary verdict here is the real
 * end-to-end proof (config → code → mailbox), not a restatement of round 1.
 */
const ROUND_3: readonly Variant[] = [
  {
    key: "G",
    label: "kép + a fejléc a KONFIGURÁCIÓBÓL (ez megy ma a leadnek)",
    image: true,
    headers: "config",
    lead: lead(6),
  },
];

/** Round 2 — WHICH PART of the header tabs the mail? Image stays on (proven neutral). */
const ROUND_2: readonly Variant[] = [
  {
    key: "E",
    label: "kép + List-Unsubscribe, NINCS one-click Post (RFC 2369 önmagában)",
    image: true,
    headers: NO_ONE_CLICK,
    lead: lead(4),
  },
  {
    key: "F",
    label: "kép + List-Unsubscribe mailto:-val (nem https), nincs Post",
    image: true,
    headers: MAILTO_ONLY,
    lead: lead(5),
  },
];

/**
 * Refuse to aim the lab at a real lead — the fixtures above invent facts (§B.17).
 *
 * Our OWN mailbox is the one legitimate exception: it routinely appears as a
 * prospect contact because that is exactly what we test with. Anything else that
 * matches a prospect row is a real business owner and must never receive these
 * invented ratings. (Verified red: the first run of this guard correctly blocked
 * our own address, which is why the sender-address carve-out below exists.)
 */
async function assertSafeRecipient(to: string): Promise<void> {
  const own = (config.outreachSender.email ?? "").trim().toLowerCase();
  if (own && to.trim().toLowerCase() === own) return;

  const hit = await db
    .selectFrom("prospect")
    .select("id")
    .where("contact_email", "=", to)
    .executeTakeFirst();
  if (hit) {
    throw new Error(
      `A(z) ${to} cím egy VALÓDI prospect kapcsolattartója (prospect.id=${hit.id}), ` +
        `és nem a sajátunk (OUTREACH_SENDER_EMAIL=${own || "nincs beállítva"}). ` +
        "Ez a script kitalált lead-adatokkal dolgozik, így erre a címre nem küldhet.",
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const to = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const delayMs = Number(
    (args.find((a) => a.startsWith("--delay-ms=")) ?? "--delay-ms=120000").split("=")[1],
  );

  if (!to || !to.includes("@")) {
    console.error("Használat: npx tsx scripts/inbox-ab.mts <to-address> [--delay-ms=N] [--dry-run]");
    process.exit(2);
  }

  const base = config.publicBaseUrl.replace(/\/+$/, "");
  if (!/^https:\/\//.test(base) || /\.ts\.net|localhost|127\.0\.0\.1/.test(base)) {
    // The tab verdict must be measured on the link a real lead would receive.
    // A Tailscale host on port 8443 is itself a phishing-shaped signal.
    throw new Error(
      `PUBLIC_BASE_URL=${base || "(üres)"} — a teszthez az ÉLES alap kell. ` +
        "Indítsd így: PUBLIC_BASE_URL=https://citoviso.com npx tsx scripts/inbox-ab.mts …",
    );
  }

  await assertSafeRecipient(to);
  await loadPricing();

  const round = args.includes("--round=3") ? 3 : args.includes("--round=2") ? 2 : 1;
  const variants = round === 3 ? ROUND_3 : round === 2 ? ROUND_2 : ROUND_1;

  const sender = getEmailSender();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const manifest: Array<Record<string, unknown>> = [];

  console.log(`\n📬 Gmail fül-kísérlet (${round}. kör) → ${to}`);
  console.log(`   alap: ${base} · adapter: ${config.emailProvider} · szünet: ${delayMs} ms\n`);

  for (const [i, v] of variants.entries()) {
    const draft = renderDraft(v.lead);
    const msg: EmailMessage = buildOutreachEmail(draft, to, {
      heroShotPath: v.image ? HERO_SHOT : null,
    });
    // The experiment's second axis. The IN-BODY opt-out link stays in every
    // variant, so all of them remain lawful (§C.1) whatever the headers say.
    const hdrs =
      v.headers === "config"
        ? msg.headers // untouched: exactly what the config produced
        : v.headers
          ? v.headers(draft.unsubscribeLink)
          : undefined;
    const toSend: EmailMessage = { ...msg, headers: hdrs };

    console.log(`  ${v.key}) ${v.label}`);
    console.log(`     tárgy: ${draft.subject}`);
    console.log(`     kép: ${v.image ? "van" : "nincs"} · fejléc: ${hdrs ? Object.keys(hdrs).join(", ") : "nincs"}`);

    const row = {
      variant: v.key,
      label: v.label,
      subject: draft.subject,
      image: v.image,
      headers: hdrs ?? null,
    };
    if (!dryRun) {
      const res = await sender.send(toSend);
      manifest.push({ ...row, sendId: res.id, sentAt: new Date().toISOString() });
    } else {
      manifest.push({ ...row, sendId: null, sentAt: null });
    }

    if (!dryRun && i < variants.length - 1) {
      console.log(`     … ${Math.round(delayMs / 1000)} mp szünet\n`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  await mkdir(MANIFEST_DIR, { recursive: true });
  const file = path.join(MANIFEST_DIR, `manifest-${stamp}.json`);
  await writeFile(file, JSON.stringify({ to, base, dryRun, variants: manifest }, null, 2), "utf8");
  console.log(`\n📁 Manifest: ${file}`);
  console.log(
    "\nKiértékelés (Gmail): a négy tárgyra `category:updates` vs `category:primary`.\n",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
