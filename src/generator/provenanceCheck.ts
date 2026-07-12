// Provenance / demo-framing gate — enforces DOMAIN 03-INVARIANTS §A (MOCK/DEMO
// phase). A generated mock uses public-source photos (Places/Street View/portal),
// which is only legitimate because the mock declares itself a PRELIMINARY PLAN and
// never poses as the owner's official, live site. This is the one provenance rule
// with a real code surface today (the owner-only LIVE gate is DEFERRED until the
// conversion pipeline exists). Deterministic, no API — a cheap, always-on check.
// Verdict is recorded on the artifact; a FLAG routes the mock to curation (§G.20).

import { htmlToVisibleText } from "./factCheck.js";

export interface DemoFramingVerdict {
  readonly verdict: "pass" | "flag";
  /** Does the mock carry the required "preliminary plan" framing marker? */
  readonly hasFramingMarker: boolean;
  /** Misleading owner/official-site claims found in the visible text. */
  readonly misleadingClaims: string[];
  readonly reason?: string;
}

// Required framing: the mock must declare itself a preliminary plan (footer).
const FRAMING_MARKERS: readonly RegExp[] = [
  /előzetes terv/iu,
  /készült a citoviso/iu,
];

// Forbidden: claims that the mock IS the owner's official/live site or that the
// photos are the owner's property — the mock must never misrepresent itself.
const MISLEADING_CLAIMS: readonly RegExp[] = [
  /hivatalos\s+(?:weboldal|oldal|honlap)\w*/giu,
  /(?:az ön|az önök|a te|a ti)\b[^.?!]{0,40}(?:oldala|weboldala|honlapja)\b[^.?!]{0,30}(?:elkészült|kész|él\b|éles)/giu,
  /(?:éles|élő)\s+oldala?\b/giu,
];

/**
 * Verify a generated mock's demo framing (§A, MOCK/DEMO phase). PASS iff a framing
 * marker is present AND no misleading owner/official-site claim appears.
 */
export function checkDemoFraming(html: string): DemoFramingVerdict {
  const visible = htmlToVisibleText(html);
  const hasFramingMarker = FRAMING_MARKERS.some((re) => re.test(visible));
  const misleadingClaims = new Set<string>();
  for (const re of MISLEADING_CLAIMS) {
    for (const m of visible.matchAll(re)) {
      const t = m[0].trim().replace(/\s+/g, " ");
      if (t) misleadingClaims.add(t);
    }
  }
  const claims = [...misleadingClaims];
  const ok = hasFramingMarker && claims.length === 0;
  return {
    verdict: ok ? "pass" : "flag",
    hasFramingMarker,
    misleadingClaims: claims,
    reason: ok
      ? undefined
      : !hasFramingMarker
        ? "hiányzik a demo-framing (előzetes terv jelölés)"
        : `félrevezető tulaj/hivatalos-oldal állítás: ${claims.join(", ")}`,
  };
}
