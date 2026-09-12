// ⚠️ DOES THE COLD LETTER LINK TO US? (Elek FK-004 ④.)
//
// Every link the outreach mail carries — the tracked preview, the unsubscribe, the
// privacy notice — comes from ONE value, `PUBLIC_BASE_URL`. Elek measured a letter
// signed "Citoviso" whose every link pointed at `mineral.tail3a89f.ts.net:8443`.
// On this dev box that is correct and expected. The finding is what it REVEALS:
// nothing connected the letter's link host to the identity the letter claims, so the
// same letter would go out unremarked if a production .env carried a staging host, an
// expired domain, or a partner's URL. The existing §C rule only asks whether the
// recipient CAN LOAD the link, not whether the link is ours — and a public HTTPS host
// that is not ours passes it.
//
// This guard measures an ENVIRONMENT FILE, which is why it is not a §C draft rule:
// the answer is a property of the deployment, not of the wording, and a rule that is
// permanently red on every developer's machine is a rule everyone learns to skip.
//
// Usage:
//   npx tsx scripts/outreach-link-host-check.mts                 # this machine's config
//   npx tsx scripts/outreach-link-host-check.mts --env=<path>    # any .env (e.g. a
//                                                                 # prod copy) — CI/deploy
//   npx tsx scripts/outreach-link-host-check.mts --strict        # mismatch = exit 1
//   npx tsx scripts/outreach-link-host-check.mts --self-test     # negative control

import { readFileSync } from "node:fs";

import { checkOutreachLinkHost } from "../src/outreach/linkHost.js";

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const SELF_TEST = args.includes("--self-test");
const envPath = (args.find((a) => a.startsWith("--env=")) ?? "").split("=")[1] ?? "";

/** Read the two values we care about out of a dotenv file, without importing it. */
function readEnvFile(file: string): { base: string; sender: string } {
  const text = readFileSync(file, "utf8");
  const pick = (key: string): string => {
    const m = new RegExp(`^${key}=(.*)$`, "m").exec(text);
    return m ? m[1]!.trim().replace(/^["']|["']$/g, "") : "";
  };
  return {
    base: pick("PUBLIC_BASE_URL"),
    sender: pick("OUTREACH_SENDER_EMAIL") || pick("OUTREACH_FROM"),
  };
}

if (SELF_TEST) {
  // NEGATIVE CONTROL: a deliberately foreign host must be reported as a mismatch.
  // Without this, a verdict function that always returned `mismatch:false` would make
  // this script permanently, silently green.
  const bad = checkOutreachLinkHost("https://staging.example.org");
  if (!bad) {
    console.error("❌ önteszt: nincs verdikt (hiányzó feladó-cím?) — az őr nem tud mérni");
    process.exit(1);
  }
  if (!bad.mismatch) {
    console.error(
      `❌ önteszt: idegen gazdagépet (${bad.linkHost}) NEM jelzett eltérésnek a ${bad.senderDomain} feladó mellett — VAK`,
    );
    process.exit(1);
  }
  const good = checkOutreachLinkHost(`https://${bad.senderDomain}`);
  if (good?.mismatch) {
    console.error(`❌ önteszt: a SAJÁT domainünket (${good.linkHost}) eltérésnek jelezte — hamis riasztás`);
    process.exit(1);
  }
  console.log(`✅ önteszt: idegen gazdagép → eltérés, saját domain → rendben (${bad.senderDomain})`);
  process.exit(0);
}

let verdict = checkOutreachLinkHost();
let source = "e gép futó konfigurációja";

if (envPath) {
  const { base, sender } = readEnvFile(envPath);
  if (!base || !sender) {
    console.error(`❌ ${envPath}: PUBLIC_BASE_URL vagy feladó-cím hiányzik — nem mérhető`);
    process.exit(1);
  }
  // Measure the FILE's pair, not this process's config.
  process.env.OUTREACH_SENDER_EMAIL = sender;
  verdict = checkOutreachLinkHost(base);
  source = envPath;
}

if (!verdict) {
  console.error("❌ nincs verdikt: PUBLIC_BASE_URL vagy OUTREACH_SENDER_EMAIL/OUTREACH_FROM üres");
  process.exit(1);
}

console.log(`forrás: ${source}`);
console.log(`  a levél linkjei ide mutatnak : ${verdict.linkHost}  (domain: ${verdict.linkDomain})`);
console.log(`  a levél feladójának domainje : ${verdict.senderDomain}`);

if (!verdict.mismatch) {
  console.log("\n🟢 a levél a SAJÁT domainünkre linkel");
  process.exit(0);
}

console.error(
  `\n${STRICT ? "🔴" : "⚠️ "} ELTÉRÉS: a levél ${verdict.senderDomain} néven ír, de ${verdict.linkDomain} címre linkel.\n` +
    `   Élesben ez a címzett szemében phishing-alak, és a leiratkozás is idegen gazdagépre mutat.\n` +
    `   Javítás: PUBLIC_BASE_URL a saját domainünkre (${verdict.senderDomain}).`,
);
process.exit(STRICT ? 1 : 0);
