// Phone numbers IN A COUNTRY (ADR-0437): the country layer row says which national numbering
// plan a number written without "+CC" belongs to — its dial code, its trunk prefix, its
// mobile ranges and the national number's length.
//
//   · phone_plan 'hu' → the full Hungarian plan in phone.ts (area-code table, per-range
//     lengths, glued-run splitting). The HU row selects it; the result is exactly what
//     normalizePhone() always returned.
//   · phone_plan 'generic' → trunk prefix + national number within [nsn_min, nsn_max] digits
//     → +<dial><nsn>. Coarser than a full plan, but it never invents a number: anything that
//     does not fit the row's shape is refused (null), like phone.ts refuses a bad HU length.
//
// International input ("+CC…", "00CC…") is the same for every country: phone.ts's rules.
import type { CountryConfig } from "../country.js";
import { HU_PHONE_TEXT_PATTERN, isHuMobileE164, normalizePhone, prettyPhone, splitPhones } from "./phone.js";
import { jsonForScript } from "./jsonForScript.js";

export type PhoneRules = Pick<CountryConfig, "dialCode" | "trunkPrefix" | "mobilePrefixes" | "phonePlan" | "phoneNsnMin" | "phoneNsnMax">;

/** One number as written in `cfg`'s country → E.164, or null. No row (cfg null) → only an
 *  internationally written number is accepted — a national one has no country to belong to. */
export function normalizePhoneIn(raw: string, cfg: PhoneRules | null): string | null {
  if (cfg?.phonePlan === "hu") return normalizePhone(raw);
  const c = raw.replace(/[\s\-()./]/g, "");
  if (!/^\+?[0-9]{6,15}$/.test(c)) return null;
  const intl = c.startsWith("+") ? c : c.startsWith("00") && c[2] !== "0" ? `+${c.slice(2)}` : null;
  if (intl) {
    // "+385 (0)91 …": the trunk prefix written in brackets after the dial code is not part
    // of the number (nemzetközi A — common on Croatian pages).
    const t = cfg?.trunkPrefix ? `+${cfg.dialCode}${cfg.trunkPrefix}` : null;
    const fixed = t && intl.startsWith(t) && /\(\s*0\s*\)/.test(raw) ? `+${cfg!.dialCode}${intl.slice(t.length)}` : intl;
    return /^\+[1-9][0-9]{6,14}$/.test(fixed) ? fixed : null;
  }
  if (!cfg) return null;
  // A number already carrying the dial code without "+" ("359888040056").
  let nsn: string | null = null;
  if (cfg.trunkPrefix && c.startsWith(cfg.trunkPrefix)) nsn = c.slice(cfg.trunkPrefix.length);
  else if (c.startsWith(cfg.dialCode) && c.length - cfg.dialCode.length >= cfg.phoneNsnMin) nsn = c.slice(cfg.dialCode.length);
  // ADR-0450: a country WITHOUT a trunk prefix (CZ, PL …) writes its national number bare
  // ("777 123 456") — that IS the national significant number.
  else if (!cfg.trunkPrefix) nsn = c;
  if (nsn === null || nsn.startsWith("0")) return null;
  return nsn.length >= cfg.phoneNsnMin && nsn.length <= cfg.phoneNsnMax ? `+${cfg.dialCode}${nsn}` : null;
}

/** Is this E.164 number a mobile of `cfg`'s country (the SMS/MMS/messenger channels need one)? */
export function isMobileE164In(e164: string, cfg: PhoneRules | null): boolean {
  if (!cfg) return false;
  if (cfg.phonePlan === "hu") return isHuMobileE164(e164);
  const prefix = `+${cfg.dialCode}`;
  if (!e164.startsWith(prefix)) return false;
  const nsn = e164.slice(prefix.length);
  return cfg.mobilePrefixes.some((m) => nsn.startsWith(m));
}

/** Does a number belong to `cfg`'s country? A national-format number carries no country
 *  code at all, so it cannot contradict one. No row → no basis to reject (true). */
export function plausibleInCountry(phone: string, cfg: Pick<CountryConfig, "dialCode"> | null): boolean {
  if (!cfg) return true;
  const digits = phone.replace(/\D/g, "");
  if (!/^(\+|00)/.test(phone.trim()) && !digits.startsWith(cfg.dialCode)) return true;
  return digits.startsWith(cfg.dialCode) || digits.startsWith(`00${cfg.dialCode}`);
}


/**
 * An E.164 number as its country's reader writes it (ADR-0450): the Hungarian plan keeps
 * prettyPhone ("+36 30 123 4567"); another country's number is "+<dial> " and the national
 * number in groups of three ("+420 777 123 456"), the last group taking a leftover digit.
 * A number of another country (or no row) is returned as given — never re-cut wrongly.
 */
export function prettyPhoneIn(e164: string, cfg: PhoneRules | null): string {
  if (!cfg || cfg.phonePlan === "hu") return prettyPhone(e164);
  const prefix = `+${cfg.dialCode}`;
  if (!e164.startsWith(prefix)) return prettyPhone(e164);
  const nsn = e164.slice(prefix.length);
  const groups: string[] = [];
  let i = 0;
  while (nsn.length - i > 4) {
    groups.push(nsn.slice(i, i + 3));
    i += 3;
  }
  groups.push(nsn.slice(i));
  return `${prefix} ${groups.join(" ")}`;
}

/** A sample number in the country's shape, for an error sentence ("+420 712 345 678"). */
export function phoneExampleIn(cfg: PhoneRules): string {
  const lead = cfg.mobilePrefixes[0] ?? "";
  const filler = "123456789012345";
  const nsn = (lead + filler).slice(0, Math.max(cfg.phoneNsnMin, lead.length + 1));
  return prettyPhoneIn(`+${cfg.dialCode}${nsn}`, cfg);
}

/**
 * The browser twin of normalizePhoneIn + prettyPhoneIn for a NON-Hungarian row, as a script
 * fragment that REDEFINES `norm` and `pretty` (function declarations: the later one wins in
 * the same scope). Empty for the Hungarian plan — the HU page keeps PHONE_NORM_JS exactly.
 */
export function phoneRulesJs(cfg: PhoneRules | null): string {
  if (!cfg || cfg.phonePlan === "hu") return "";
  return (
    `var PR=${jsonForScript({ d: cfg.dialCode, t: cfg.trunkPrefix, a: cfg.phoneNsnMin, b: cfg.phoneNsnMax })};` +
    `function norm(raw){var c=String(raw||'').replace(/[\\s\\-()./]/g,'');if(!/^\\+?[0-9]{6,15}$/.test(c))return null;` +
    `var intl=c[0]==='+'?c:(c.indexOf('00')===0&&c[2]!=='0'?'+'+c.slice(2):null);` +
    `if(intl)return /^\\+[1-9][0-9]{6,14}$/.test(intl)?intl:null;var n=null;` +
    `if(PR.t&&c.indexOf(PR.t)===0)n=c.slice(PR.t.length);else if(c.indexOf(PR.d)===0&&c.length-PR.d.length>=PR.a)n=c.slice(PR.d.length);else if(!PR.t)n=c;` +
    `if(n===null||n[0]==='0')return null;return n.length>=PR.a&&n.length<=PR.b?'+'+PR.d+n:null}` +
    `function pretty(e){var p='+'+PR.d;if(!e||e.indexOf(p)!==0)return e;var n=e.slice(p.length),g=[],i=0;` +
    `while(n.length-i>4){g.push(n.slice(i,i+3));i+=3}g.push(n.slice(i));return p+' '+g.join(' ')}`
  );
}

// ── Collection-side helpers (nemzetközi A, ADR-0467): the scrapers' Hungarian-only pieces —
// splitPhones, the digit-key of the de-dup ledgers, the "find a number in page text" regex,
// the loose mobile test — each with the country row deciding. The 'hu' plan delegates to the
// exact Hungarian code it replaces, so a Hungarian lead behaves byte-for-byte as before.

/** Every number in a field, E.164, written order, no duplicates (splitPhones for any row). */
export function splitPhonesIn(raw: string, cfg: PhoneRules | null): string[] {
  if (cfg?.phonePlan === "hu") return splitPhones(raw);
  const out: string[] = [];
  for (const piece of raw.split(/[,;|\n]+|[^\d\s\-()./+]+/)) {
    if (!/\d/.test(piece)) continue;
    const one = normalizePhoneIn(piece, cfg);
    if (one && !out.includes(one)) out.push(one);
  }
  return out;
}

/** The comparable digit key of a number in `cfg`'s country: its national part, whatever
 *  prefix it was written with (+CC, 00CC, CC, trunk). HU = the ledgers' historic rule. */
export function phoneKeyIn(v: string, cfg: Pick<PhoneRules, "dialCode" | "trunkPrefix"> | null): string {
  const d = v.replace(/\D/g, "");
  const dial = cfg?.dialCode ?? "";
  if (!dial) return d;
  if (d.startsWith(`00${dial}`)) return d.slice(2 + dial.length);
  if (d.startsWith(dial) && d.length >= dial.length + 8) return d.slice(dial.length);
  if (cfg?.trunkPrefix && d.startsWith(cfg.trunkPrefix)) return d.slice(cfg.trunkPrefix.length);
  return d;
}

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The pattern that FINDS a number of `cfg`'s country in free text (a snippet, a page): an
 * international prefix (+CC / 00CC) or the trunk prefix, then digit groups. HU = the exact
 * historic PHONE_RE of enrichWebSearch. What it finds is only a candidate — normalizePhoneIn
 * decides whether it is a valid number of that plan.
 */
export function phoneTextPatternIn(cfg: Pick<PhoneRules, "dialCode" | "trunkPrefix" | "phonePlan"> | null): string {
  if (cfg?.phonePlan === "hu") {
    return HU_PHONE_TEXT_PATTERN;
  }
  // No row (unknown country): only an internationally written number has a country of its
  // own — a national one is not guessed into any plan (fail closed, ADR-0437).
  if (!cfg) {
    return String.raw`(?<![\d/.])(?:\+|00)[1-9]\d{0,2}[\s/().-]*\d{1,3}[\s/().-]*\d{2,4}[\s/().-]*\d{2,4}(?:[\s/-]?\d{1,4})?(?!\d)`;
  }
  const pre = [`\\+${cfg.dialCode}`, `00${cfg.dialCode}`, ...(cfg.trunkPrefix ? [escRe(cfg.trunkPrefix)] : [])].join("|");
  return String.raw`(?<![\d/.])(?:` + pre + String.raw`)[\s/().-]*\d{1,3}[\s/().-]*\d{2,4}[\s/().-]*\d{2,4}(?:[\s/-]?\d{1,4})?(?!\d)`;
}

/** phoneTextPatternIn as a RegExp (`flags` e.g. "g"). */
export function phoneTextRegexIn(cfg: Pick<PhoneRules, "dialCode" | "trunkPrefix" | "phonePlan"> | null, flags = ""): RegExp {
  return new RegExp(phoneTextPatternIn(cfg), flags);
}

/** Loose mobile test on a number as WRITTEN (any prefix) — HU keeps enrichContact's rule. */
export function isMobileRawIn(phone: string, cfg: PhoneRules | null): boolean {
  if (!cfg) return false;
  if (cfg.phonePlan === "hu") {
    // enrichContact's historic rule, spelled with the row's codes (HU: 36 / 06): 0036…, 36…,
    // 06…, and a bare "6…" (the trunk without its leading 0) when 9+ digits long.
    const dial = cfg.dialCode;
    const trunk = cfg.trunkPrefix;
    let d = phone.replace(/\D/g, "");
    if (d.startsWith(`00${dial}`)) d = d.slice(2 + dial.length);
    else if (d.startsWith(dial)) d = d.slice(dial.length);
    else if (trunk && d.startsWith(trunk)) d = d.slice(trunk.length);
    else if (trunk.length > 1 && d.startsWith(trunk.slice(1)) && d.length >= 9) d = d.slice(trunk.length - 1);
    return cfg.mobilePrefixes.includes(d.slice(0, 2));
  }
  const e = normalizePhoneIn(phone, cfg);
  return !!e && isMobileE164In(e, cfg);
}
