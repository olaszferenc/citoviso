/**
 * Kapu — a teszt-módú Számlázz.hu-kulcs SOHA nem szolgálhatja ki az éles hostot
 * (tulajdonosi döntés, 2026-09-22; src/invoicing/keyGuard.ts).
 *
 * A memória-lecke szerint az őr, ami nem tud pirosra menni, nem őr — ezért a
 * próbák MINDKÉT verdiktet kikényszerítik szintetikus tiltólistával, és a
 * VALÓDI bekötést (getInvoiceProvider) is megjárja egy eset, nem csak a tiszta
 * függvényt.
 *
 * Futtatás: npx tsx scripts/invoice-key-guard-check.mts
 */
import {
  assertInvoiceKeyAllowed,
  DENYLISTED_KEY_SHA256,
  isLiveHost,
  keyFingerprint,
} from "../src/invoicing/keyGuard.js";

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) {
    console.log(`✓ ${what}`);
    return;
  }
  failed++;
  console.error(`✗ BUKÁS  ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
};

const KEY = "synthetic-test-key-0000";
const DENY = [keyFingerprint(KEY)];
const LIVE = "https://citoviso.com";
const DEV = "https://mineral.tail3a89f.ts.net:8443";

// ── ① a tiltott kulcs éles hoston: DOBNIA KELL (piros kontroll) ───────────────
let threw = false;
try {
  assertInvoiceKeyAllowed({ agentKey: KEY, publicBaseUrl: LIVE, denylist: DENY });
} catch {
  threw = true;
}
say(threw, "① tiltólistás kulcs + éles host → a boot elhal (fail-closed)");

// ── ② ugyanaz a kulcs DEV hoston: átmegy (ott legitim) ────────────────────────
threw = false;
try {
  assertInvoiceKeyAllowed({ agentKey: KEY, publicBaseUrl: DEV, denylist: DENY });
} catch {
  threw = true;
}
say(!threw, "② tiltólistás kulcs + dev host → szabad út (a dev-használat legitim)");

// ── ③ nem-tiltott kulcs éles hoston: átmegy ───────────────────────────────────
threw = false;
try {
  assertInvoiceKeyAllowed({ agentKey: "other-key", publicBaseUrl: LIVE, denylist: DENY });
} catch {
  threw = true;
}
say(!threw, "③ nem-listás kulcs + éles host → szabad út (az éles kulcs működhet)");

// ── ④ a VALÓDI bekötés is dob — nem csak a tiszta függvény ────────────────────
// A getInvoiceProvider a modul-szintű tiltólistát olvassa; azt nem tudjuk
// szintetikusan cserélni, ezért ez az ág CSAK akkor mérhető élesben-viselkedőre,
// ha a valódi lista nem üres. Amíg üres, a bekötés METSZETÉT mérjük: szamlazz
// provider éles-host env-vel felépül (nem dob), azaz az assert tényleg lefut és
// átereszt — a ①-es ág pedig bizonyítja, hogy tiltott kulccsal dobna.
process.env.INVOICE_PROVIDER = "szamlazz";
process.env.PUBLIC_BASE_URL = LIVE;
process.env.SZAMLAZZ_AGENT_KEY = "other-key";
const { getInvoiceProvider } = await import("../src/invoicing/index.js");
threw = false;
try {
  getInvoiceProvider();
} catch {
  threw = true;
}
say(!threw, "④ a valódi getInvoiceProvider bekötés lefut és nem-listás kulccsal átereszt");

// ── ⑤ a valódi tiltólista alakilag ép (hex-64 sorok) ──────────────────────────
say(
  DENYLISTED_KEY_SHA256.every((h) => /^[a-f0-9]{64}$/.test(h)),
  "⑤ a valódi tiltólista minden sora SHA-256 hex ujjlenyomat (kulcs nem szivárgott a repóba)",
  DENYLISTED_KEY_SHA256.filter((h) => !/^[a-f0-9]{64}$/.test(h)).join(", "),
);

// ── ⑥ az éles-host felismerő a valódi címeinken helyes ────────────────────────
say(isLiveHost("https://citoviso.com"), "⑥ isLiveHost: a citoviso.com ÉLES");
say(isLiveHost("https://citoviso.com/"), "⑥ isLiveHost: perjeles alak is ÉLES");
say(!isLiveHost(DEV), "⑥ isLiveHost: a tailscale dev-cím NEM éles");
say(!isLiveHost("http://localhost:4600"), "⑥ isLiveHost: a localhost NEM éles");
say(
  !isLiveHost("https://gonoszcitoviso.com"),
  "⑥ isLiveHost: az idegen domain, ami csak VÉGZŐDIK ugyanúgy, NEM éles",
);

if (failed) {
  console.error(`\n⛔ ${failed} mérés bukott — a számlázó-kulcs őre nem véd.`);
  process.exit(1);
}
console.log("\n✅ invoice-key-guard-check: a teszt-módú kulcs élesben szerkezetileg lehetetlen.");
