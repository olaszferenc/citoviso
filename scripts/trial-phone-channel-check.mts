// Gate: the free-trial form asks for a phone number only where we can use it (ADR-0498, found in the
// 2026-11-27 HR live run): an e-mail-only country (HR — owner 2026-11-19 „HR = csak e-mail”) never gets
// an SMS (src/sms/countryChannel.ts), yet the form required a number and promised „SMS-ben is szólunk”.
//
// What it pins:
//   ① the pure rule trialPhoneRequired: no country row → required (the Hungarian rule); a row whose
//      outreach channels carry SMS → required; an e-mail-only row → optional
//   ② the server: validate() returns phone null for an empty number only when not required, and
//      still reads (and refuses) a given number
//   ③ the page: configurator.ts flags the optional phone per the same rule; the runtime drops the
//      phone hint and the SMS promise, and accepts an empty number, only under that flag
//
//   npx tsx scripts/trial-phone-channel-check.mts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { trialPhoneRequired } from "../src/trial/start.js";
import type { CountryConfig } from "../src/country.js";

const ROOT = resolve(import.meta.dirname, "..");
let fails = 0;
const check = (name: string, ok: boolean): void => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  if (!ok) fails++;
};
const row = (channels: string[]): CountryConfig => ({ outreachChannels: channels }) as unknown as CountryConfig;

console.log("① a szabály");
check("nincs ország-sor → kötelező (magyar szabály)", trialPhoneRequired(null) === true);
check("SMS-t is vivő sor (HU) → kötelező", trialPhoneRequired(row(["email", "sms", "mms"])) === true);
check("csak e-mailes sor (HR) → nem kötelező", trialPhoneRequired(row(["email"])) === false);

const src = (p: string): string => readFileSync(resolve(ROOT, p), "utf8");
console.log("② a szerver");
const start = src("src/trial/start.ts");
check("üres szám csak nem kötelező esetben null", /if \(rawPhone\.trim\(\) \|\| trialPhoneRequired\(phoneRules\)\) \{\s*phone = [^;]+;\s*if \(!phone\) return "invalid_phone";/.test(start));
console.log("③ a lap");
const cfg = src("src/generator/configurator.ts");
check("configurator.ts ugyanazzal a szabállyal jelöl", /trialPhoneRequired\(row\) \? "" : `window\.CIT_TRIAL_PHONE_OPTIONAL=true;`/.test(cfg));
const js = src("assets/runtime/cit-configurator.js");
check("a futtató a jelzőt olvassa", /var PHONE_OPTIONAL = window\.CIT_TRIAL_PHONE_OPTIONAL === true;/.test(js));
check("súgósor csak kötelező számnál", /PHONE_OPTIONAL \? "" : '<small class="cit-cfg-thint">' \+ esc\(tr\("A próba vége előtt itt is szólunk\."\)\)/.test(js));
check("SMS-ígéret csak kötelező számnál", /PHONE_OPTIONAL \? "" : '<p class="cit-cfg-tnote cit-cfg-tokwarn">'/.test(js));
check("üres szám elfogadva a jelzővel", /if \(!pv && PHONE_OPTIONAL\) \{\s*setErr\("phone", ""\);/.test(js));

console.log(fails ? `\n✗ ${fails} hiba` : "\n✓ minden rendben");
process.exit(fails ? 1 : 0);
