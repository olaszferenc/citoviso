// ONE canonical form for a phone number — E.164 ("+36301234567"). Pure, no I/O, so
// the scrapers, the console and the SMS/MMS senders can all share it.
//
// ⛔ The tenant contact form carries a CLIENT MIRROR of this rule
// (src/server/contactViews.ts placeScript → norm()). Change both together; the gate
// scripts/phone-normalize-check.mts runs the SAME vectors through both.
//
// What it accepts, measured on the stock (2026-10-05):
//   · separators people write: space, "-", ".", "(", ")", and "/" ("06/30 123 4567",
//     "+36/30/123-4567") — the slash used to make a perfectly good mobile unusable;
//   · prefixes: "+36", "0036", "36", "06"; any other "+CC" / "00CC" stays international;
//   · SEVERAL numbers in one field — a portal's broken tel: link glued three together
//     ("00368734269100363028317760036705331658"); see splitPhones().
//
// What it refuses: a Hungarian number whose length or prefix the numbering plan does
// not allow. That is not pedantry — the web enricher lifted digit runs out of photo
// paths ("…/6590/659069/659069814/…" → "069/6590698"), upload folders
// ("uploads/2023/06/37961736.jpg" → "06/37961736") and GPS coordinates
// ("46.780604614546" → "0604614546"), and most of those are exactly the wrong length.

// Mobile networks: 20 (Yettel), 30 (Telekom), 31 (Vodafone MVNO), 50 (DIGI), 70 (One).
const HU_MOBILE = new Set(["20", "30", "31", "50", "70"]);
// Corporate VoIP: 21 + 7 digits — same length as a mobile, but not one.
const HU_NINE = new Set(["21"]);
// Two-digit geographic area codes + the non-geographic 40 (shared cost) and 80 (toll
// free). Budapest is the one-digit "1". The 90/91 premium ranges are left out on
// purpose: no lodging publishes one, and a photo-id artifact ("069/1806970") used
// to pass as "+36 91 …".
const HU_AREA = new Set([
  "22", "23", "24", "25", "26", "27", "28", "29",
  "32", "33", "34", "35", "36", "37",
  "40", "42", "44", "45", "46", "47", "48", "49",
  "52", "53", "54", "56", "57", "59",
  "62", "63", "66", "68", "69",
  "72", "73", "74", "75", "76", "77", "78", "79",
  "80", "82", "83", "84", "85", "87", "88", "89",
  "92", "93", "94", "95", "96", "99",
]);

/**
 * Length of the Hungarian national number (the part after +36) that starts with
 * `nsn`, or 0 when no number can start like that. Budapest 1+7, mobile and
 * corporate VoIP 2+7, every other area 2+6.
 */
function huNsnLength(nsn: string): number {
  if (nsn.startsWith("1")) return 8;
  const p = nsn.slice(0, 2);
  if (HU_MOBILE.has(p) || HU_NINE.has(p)) return 9;
  if (HU_AREA.has(p)) return 8;
  return 0;
}

function huValid(nsn: string): boolean {
  return /^[0-9]+$/.test(nsn) && huNsnLength(nsn) === nsn.length;
}

/** One number written in any accepted shape → E.164, or null. */
function normalizeOne(raw: string): string | null {
  const c = raw.replace(/[\s\-()./]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(c)) return null;
  let hu: string | null = null;
  if (c.startsWith("+36")) hu = c.slice(3);
  else if (c.startsWith("0036")) hu = c.slice(4);
  else if (c.startsWith("06")) hu = c.slice(2);
  else if (c.startsWith("36")) hu = c.slice(2);
  if (hu !== null) return huValid(hu) ? `+36${hu}` : null;
  if (c.startsWith("+")) return c;
  if (c.startsWith("00") && c[2] !== "0") return `+${c.slice(2)}`;
  return null;
}

/** Hungarian mobile, in the E.164 form normalizePhone() returns. */
export function isHuMobileE164(e164: string): boolean {
  return e164.startsWith("+36") && HU_MOBILE.has(e164.slice(3, 5));
}

/**
 * Every number in a field, E.164, in written order, without duplicates. A field may
 * hold several: split on list punctuation and words ("Tel: …, Mobil: …"), and a
 * glued Hungarian digit run is cut where the numbering plan says a number ends.
 * A piece that is not a valid number is dropped — the result never invents one.
 */
export function splitPhones(raw: string): string[] {
  const out: string[] = [];
  const add = (p: string | null): void => {
    if (p && !out.includes(p)) out.push(p);
  };
  for (const piece of raw.split(/[,;|\n]+|[^\d\s\-()./+]+/)) {
    if (!/\d/.test(piece)) continue;
    const one = normalizeOne(piece);
    if (one) {
      add(one);
      continue;
    }
    // Glued run: walk it prefix by prefix ("0036 87342691 0036 302831776 …").
    // Separators carry no meaning inside the run; a "+" does start a number.
    // Accepted only when the WHOLE run splits into two or more valid numbers with
    // nothing left over — a lone wrong-length number ("069/1806970") must stay
    // refused, not be trimmed into a plausible one.
    const d = piece.replace(/[\s\-()./]/g, "").replace(/\+/g, "00");
    const glued: string[] = [];
    let i = 0;
    while (i < d.length) {
      const prefix = ["0036", "06"].find((p) => d.startsWith(p, i));
      if (!prefix) break;
      const at = i + prefix.length;
      const len = huNsnLength(d.slice(at, at + 2));
      const nsn = d.slice(at, at + len);
      if (!len || !huValid(nsn)) break;
      glued.push(`+36${nsn}`);
      i = at + len;
    }
    if (i === d.length && glued.length >= 2) glued.forEach(add);
  }
  return out;
}

/**
 * Digits + leading '+' only; rejects anything that does not look like a phone.
 * A field holding several numbers yields ONE: the first mobile (every caller of
 * this function texts, calls or files the number as a contact — SMS/MMS need a
 * mobile), else the first number.
 */
export function normalizePhone(raw: string): string | null {
  const one = normalizeOne(raw);
  if (one) return one;
  const all = splitPhones(raw);
  return all.find(isHuMobileE164) ?? all[0] ?? null;
}

/**
 * The CLIENT MIRROR of normalizePhone(), as browser JS: `function norm(raw){…}`.
 * Embedded by src/server/contactViews.ts so the tenant contact form answers before
 * the server re-checks. Same tables, same steps; scripts/phone-normalize-check.mts
 * runs every vector through both and fails on the first disagreement.
 */
export const PHONE_NORM_JS =
  `var PM=${JSON.stringify([...HU_MOBILE])},P9=${JSON.stringify([...HU_NINE])},PA=${JSON.stringify([...HU_AREA])};` +
  `function pLen(n){if(n[0]==='1')return 8;var p=n.slice(0,2);if(PM.indexOf(p)>=0||P9.indexOf(p)>=0)return 9;if(PA.indexOf(p)>=0)return 8;return 0}` +
  `function pOk(n){return /^[0-9]+$/.test(n)&&pLen(n)===n.length}` +
  `function pOne(raw){var c=String(raw).replace(/[\\s\\-()./]/g,'');if(!/^\\+?[0-9]{8,15}$/.test(c))return null;var h=null;` +
  `if(c.indexOf('+36')===0)h=c.slice(3);else if(c.indexOf('0036')===0)h=c.slice(4);else if(c.indexOf('06')===0)h=c.slice(2);else if(c.indexOf('36')===0)h=c.slice(2);` +
  `if(h!==null)return pOk(h)?'+36'+h:null;if(c[0]==='+')return c;if(c.indexOf('00')===0&&c[2]!=='0')return '+'+c.slice(2);return null}` +
  `function pSplit(raw){var out=[];function add(p){if(p&&out.indexOf(p)<0)out.push(p)}` +
  `String(raw).split(/[,;|\\n]+|[^\\d\\s\\-()./+]+/).forEach(function(pc){if(!/\\d/.test(pc))return;var one=pOne(pc);if(one){add(one);return}` +
  `var d=pc.replace(/[\\s\\-()./]/g,'').replace(/\\+/g,'00'),g=[],i=0;` +
  `while(i<d.length){var pre=d.indexOf('0036',i)===i?'0036':d.indexOf('06',i)===i?'06':null;if(!pre)break;var at=i+pre.length,len=pLen(d.slice(at,at+2)),n=d.slice(at,at+len);if(!len||!pOk(n))break;g.push('+36'+n);i=at+len}` +
  `if(i===d.length&&g.length>=2)g.forEach(add)});return out}` +
  `function norm(raw){var s=String(raw||''),one=pOne(s);if(one)return one;var all=pSplit(s);` +
  `for(var k=0;k<all.length;k++){if(all[k].indexOf('+36')===0&&PM.indexOf(all[k].slice(3,5))>=0)return all[k]}return all[0]||null}`;
