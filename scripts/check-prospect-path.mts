// Gate: the tracked outreach link keeps working in BOTH shapes.
//
// The bare /p/<token> shape is already out in the wild in mails we have sent, so
// the readable /p/<slug>/<token> shape must be additive, never a replacement. This
// check is cheap and deterministic — run it from pre-commit alongside the other
// linters.
//
// Usage: npx tsx scripts/check-prospect-path.mts

import { normalizeProspectPath } from "../src/console/prospectPath.js";

/** A real token shape from a sent mail (24 chars, mixed case, underscore-safe). */
const T = "zk5fv80Z4mMGN6gbQCp45XgU";
const T2 = "0i8CqHKSapzfQUsibt_mv9GS";

interface Case {
  readonly input: string;
  readonly want: string;
  readonly why: string;
}

const CASES: readonly Case[] = [
  // ── Links already sent must be untouched. ──────────────────────────────────
  { input: `/p/${T}`, want: `/p/${T}`, why: "régi link: csupasz token" },
  { input: `/p/${T}/unsubscribe`, want: `/p/${T}/unsubscribe`, why: "régi leiratkozó link" },
  { input: `/p/${T}/event`, want: `/p/${T}/event`, why: "régi event-beacon" },
  { input: `/p/${T}/request`, want: `/p/${T}/request`, why: "régi rendelés-submit" },

  // ── New readable shape normalizes down to the same routes. ─────────────────
  { input: `/p/napfeny-panzio/${T}`, want: `/p/${T}`, why: "új link: slug + token" },
  {
    input: `/p/napfeny-panzio/${T}/unsubscribe`,
    want: `/p/${T}/unsubscribe`,
    why: "új leiratkozó link (RFC 8058 POST is ezen megy)",
  },
  { input: `/p/topart-vendeghaz/${T2}/event`, want: `/p/${T2}/event`, why: "új event-beacon" },
  { input: `/p/korisfa-vendeghaz/${T2}/request`, want: `/p/${T2}/request`, why: "új rendelés-submit" },
  { input: `/p/a/${T}`, want: `/p/${T}`, why: "egykarakteres slug is slug" },

  // ── Must NOT rewrite. ──────────────────────────────────────────────────────
  { input: "/privacy", want: "/privacy", why: "nem /p/ útvonal" },
  { input: "/p/rovid/abc", want: "/p/rovid/abc", why: "a második szegmens nem token (túl rövid)" },
  {
    input: `/p/Nagybetus/${T}`,
    want: `/p/Nagybetus/${T}`,
    why: "a slug csak kisbetűs lehet — nagybetűst nem eszünk meg némán",
  },
  { input: `/p/${T}/valami`, want: `/p/${T}/valami`, why: "ismeretlen alútvonal érintetlen" },
];

let failed = 0;
for (const c of CASES) {
  const got = normalizeProspectPath(c.input);
  if (got !== c.want) {
    failed++;
    console.error(`❌ ${c.why}\n   input: ${c.input}\n   várt:  ${c.want}\n   kapott: ${got}`);
  }
}

if (failed) {
  console.error(`\n${failed}/${CASES.length} eset bukott.\n`);
  process.exit(1);
}
console.log(`✅ prospect-link: ${CASES.length}/${CASES.length} eset rendben (régi + új alak).`);
