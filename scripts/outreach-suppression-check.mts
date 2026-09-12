// ⛔ WHO SAID STOP? — the opt-out must match the PERSON, not a spelling.
//
// Measured 2026-09-12. The opt-out is person-level by design (ADR-0053/0122), and the
// MOBILE channel has always compared NORMALISED phone numbers, with a comment spelling
// out why a string equality "would silently miss the match". The E-MAIL channel
// compared raw strings — and held only by accident: every scraper path lowercases what
// it extracts, so all 397 lead addresses were already canonical. The OPERATOR-TYPED
// field was the reachable hole: an address entered as `Info@Panzio.hu` on a second
// tracked link did not match an opt-out stored as `info@panzio.hu`, and we would have
// mailed a person who said stop (Grt./GDPR). Second finding, same measurement: the
// revocation cleared ONE row while the suppression reads the whole address, so it
// reported „a megkeresés újra küldhető" with the send still refused.
//
// WHAT THIS GUARD MEASURES
//   ① the normaliser itself, including what it must NOT fold (the scope is a decision,
//      so it is pinned — silently starting to fold plus-addresses would be a new rule
//      about third-party mailboxes that nobody measured);
//   ② STRUCTURAL twin: no suppression/one-shot comparison may go back to raw string
//      equality on contact_email. A behavioural check alone would pass the day someone
//      adds a fourth comparison site and forgets the rule
//      (feedback_heuristic_guard_needs_structural_twin);
//   ③ the stored data is canonical (the write path's promise), reported per row;
//   ④ --live only: the real DB round-trip — case-variant suppression and the
//      address-wide revocation — with exact restore. Kept behind a flag because the dev
//      DB is SHARED by every worktree: a guard that writes fixtures on every commit
//      corrupts a colleague's measurement.
//
// Usage: npx tsx scripts/outreach-suppression-check.mts [--live]

import { readFileSync } from "node:fs";

import { normalizeEmail, sameMailbox } from "../src/email/address.js";

const LIVE = process.argv.includes("--live");
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`✅ ${what}`);
  else {
    failed++;
    console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
  }
};

// ── ① The normaliser, and its deliberate limits. ─────────────────────────────
console.log("── A normalizáló ─────────────────────────────────────────────────");
say(normalizeEmail("  Info@Panzio.HU  ") === "info@panzio.hu", "körbevágás + kisbetűsítés");
say(normalizeEmail(null) === "" && normalizeEmail(undefined) === "", "null/undefined → üres");
say(sameMailbox("Elek@Citoviso.com", "elek@citoviso.com"), "kis/nagybetűs alak ugyanaz a postafiók");
say(sameMailbox(" a@b.hu", "a@b.hu "), "a szóköz nem tesz különbséget");
say(!sameMailbox("", ""), "az ÜRES cím sosem egyezik (különben mindenkit tiltana)");
say(!sameMailbox("a@b.hu", "a@c.hu"), "különböző domain = különböző postafiók");

// ⛔ The SCOPE is a decision, pinned so it cannot drift silently. Folding these would
// be a claim about third-party mailbox semantics we have not measured — and dot-folding
// is simply false outside Gmail, where it would block a DIFFERENT human.
say(!sameMailbox("a+tag@b.hu", "a@b.hu"), "plus-alcímzést NEM von össze (mért döntés, nem feledékenység)");
say(!sameMailbox("j.doe@gmail.com", "jdoe@gmail.com"), "Gmail-pontot NEM von össze (más szolgáltatónál más ember)");

// ── ② Structural twin: no raw comparison may come back. ──────────────────────
console.log("\n── Szerkezeti iker: nincs nyers összehasonlítás ───────────────────");
const SITES = [
  "src/outreach/sendBatch.ts",
  "src/console/data.ts",
  "src/outreach/escalationFollowup.ts",
] as const;
const RAW_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /\.where\(\s*["']contact_email["']\s*,\s*["']=["']/g, what: `.where("contact_email", "=", …)` },
  { re: /whereRef\(\s*["'][\w.]*contact_email["']\s*,\s*["']=["']/g, what: "whereRef(…contact_email, '=', …)" },
  { re: /where\s+[\w.]*contact_email\s*=\s*(?!lower)/g, what: "SQL: contact_email = … (lower/trim nélkül)" },
];
for (const rel of SITES) {
  const src = readFileSync(`${ROOT}/${rel}`, "utf8");
  const hits: string[] = [];
  for (const { re, what } of RAW_PATTERNS) {
    for (const m of src.matchAll(re)) {
      const line = src.slice(0, m.index).split("\n").length;
      hits.push(`${rel}:${line} — ${what}`);
    }
  }
  say(hits.length === 0, `${rel}: minden cím-összehasonlítás normalizált`, hits.join("\n     "));
}
// The detector must be able to fail, or it is decoration.
const canFail = RAW_PATTERNS[0]!.re.test(`.where("contact_email", "=", email)`);
say(canFail, "önteszt: a nyers-összehasonlítás detektor a mintát ELKAPJA");

// ── ③ + ④ DB. ───────────────────────────────────────────────────────────────
const { db } = await import("../src/db/client.js");

console.log("\n── A tárolt adat kanonikus alakban áll ────────────────────────────");
const dirty = await db
  .selectFrom("prospect")
  .select(["id", "contact_email"])
  .where("contact_email", "is not", null)
  .execute();
const offenders = dirty.filter((r) => r.contact_email !== normalizeEmail(r.contact_email));
say(
  offenders.length === 0,
  `${dirty.length} címes prospect-sor mind kanonikus alakban`,
  offenders.map((r) => `${r.id.slice(0, 8)}: ${JSON.stringify(r.contact_email)}`).join("\n     "),
);

if (!LIVE) {
  console.log(
    "\nℹ️  A DB-kör (kis/nagybetűs tiltás + cím-szintű visszavonás) a --live kapcsolóval fut.\n" +
      "   Ez a futás tehát NEM bizonyítja a viselkedést, csak a szabályt és az adatot — a dev DB\n" +
      "   minden worktree-vel KÖZÖS, és egy commitonként fixture-t író őr más mérését rontaná.",
  );
} else {
  console.log("\n── ÉLŐ DB-kör (bélyegzés → mérés → pontos visszaállítás) ──────────");
  const { isEmailSuppressed } = await import("../src/outreach/sendBatch.js");
  const { resubscribeProspect } = await import("../src/console/data.js");
  // Two rows sharing one address — the shape the bug needs.
  const groups = await db
    .selectFrom("prospect")
    .select(["id", "contact_email", "unsubscribed_at"])
    .where("contact_email", "is not", null)
    .orderBy("created_at", "asc")
    .execute();
  const byAddr = new Map<string, typeof groups>();
  for (const r of groups) {
    const k = normalizeEmail(r.contact_email);
    byAddr.set(k, [...(byAddr.get(k) ?? []), r]);
  }
  const pair = [...byAddr.entries()].find(([, v]) => v.length >= 2);
  if (!pair) {
    console.log(
      "⚠️  NEM ÉRTELMEZHETŐ: nincs két azonos című prospect-sor, tehát ez a futás a hibát ki sem\n" +
        "   tudja fejezni. Ez NEM zöld — csak annyi, hogy nem volt mit mérni.",
    );
  } else {
    const [addr, rows] = pair;
    const before = rows.map((r) => `${r.id}:${r.unsubscribed_at ?? "NULL"}`).join("|");
    try {
      await db.updateTable("prospect").set({ unsubscribed_at: new Date() }).where("id", "=", rows[0]!.id).execute();
      say(await isEmailSuppressed(addr.toUpperCase()), "NAGYBETŰS alakra is tilt (a lyuk zárva)");
      await db.updateTable("prospect").set({ unsubscribed_at: new Date() }).where("id", "=", rows[1]!.id).execute();
      const res = await resubscribeProspect(rows[0]!.id, "outreach-suppression-check", "őr-mérés: cím-szintű visszavonás");
      const stillBlocked = await isEmailSuppressed(addr);
      say(
        res.ok && !stillBlocked,
        `a visszavonás a TELJES címet feloldja, és az üzenet igazat mond ("${res.message}")`,
        stillBlocked ? "a küldés MÉG MINDIG tiltott, miközben a felület küldhetőt ígér" : "",
      );
    } finally {
      for (const r of rows) {
        await db
          .updateTable("prospect")
          .set({ unsubscribed_at: r.unsubscribed_at })
          .where("id", "=", r.id)
          .execute();
      }
      await db.deleteFrom("prospect_optout_log").where("reason", "=", "őr-mérés: cím-szintű visszavonás").execute();
      const now = (
        await db
          .selectFrom("prospect")
          .select(["id", "unsubscribed_at"])
          .where(
            "id",
            "in",
            rows.map((r) => r.id),
          )
          .orderBy("created_at", "asc")
          .execute()
      )
        .map((r) => `${r.id}:${r.unsubscribed_at ?? "NULL"}`)
        .join("|");
      say(now === before, "a park pontosan a kiindulási állapotban maradt", `${before}\n     → ${now}`);
    }
  }
}

console.log(failed === 0 ? "\n🟢 outreach-suppression-check: rendben" : `\n🔴 outreach-suppression-check: ${failed} hiba`);
process.exit(failed === 0 ? 0 : 1);
