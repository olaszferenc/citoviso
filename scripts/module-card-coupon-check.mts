// ŐR: a modul-kártya kupon-ára az ELSŐ díjra szól, és kimondja a tartós díjat (ADM3-1, tulaj-döntés „A”
// 2026-10-03; kontraktus: assets/design-refs/tenant-admin/coupon-first-month/).
//
// A lelet (Elek 3. kör): a meg nem vett modul kártyáján „áthúzott 490 Ft, +367 Ft/hó” állt. A „/hó” tartós
// havidíjat ígért, holott a −25% kupon egyszeri — a kosár ugyanott helyesen „+490 Ft a mostanihoz képest”-et mondott.
//
// Mit tart (se DB, se hálózat): havi és éves fióknál a kedvezményes szám „az első hónapban / évben” áll, a
// tartós díj „utána +…/hó (/év)” alakban mellette; a kedvezményes szám mellett NINCS „/hó”; kupon nélkül a
// kártya változatlan; a bolt kártyája ezt a függvényt hívja.
//
// Futtatás: npx tsx scripts/module-card-coupon-check.mts
import { readFileSync } from "node:fs";
import { couponCardPrice } from "../src/server/adminViews.js";

let failures = 0, pass = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) pass++; else { failures++; console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`); }
};
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/ /g, " ").trim();

const m = couponCardPrice(490, 25, 0, "hu");
check("havi fiók: áthúzott listaár", /<s>490 Ft<\/s>/.test(m.replace(/ /g, " ")), m);
check("⛔ havi fiók: „+367 Ft az első hónapban”", /\+367 Ft az első hónapban/.test(text(m)), text(m));
check("⛔ havi fiók: „utána +490 Ft/hó”", /utána \+490 Ft\/hó/.test(text(m)), text(m));
check("⛔ a kedvezményes szám mellett nincs „/hó” (nem tartós díj)", !/367 Ft\/hó/.test(text(m)), text(m));

const y = couponCardPrice(490, 25, 10, "hu");
check("éves fiók: „az első évben” és „utána +4 900 Ft/év”", /\+3 670 Ft az első évben/.test(text(y)) && /utána \+4 900 Ft\/év/.test(text(y)), text(y));
check("éves fiók: a kedvezményes szám mellett nincs „/év”", !/3 670 Ft\/év/.test(text(y)), text(y));

const src = readFileSync(new URL("../src/server/adminViews.ts", import.meta.url), "utf8");
const shop = src.slice(src.indexOf("const shopPriceChip"), src.indexOf("const shopPriceChip") + 900);
check("a bolt kártyája a couponCardPrice-t hívja", /couponCardPrice\(m\.priceMonthly, coupon\.percent, annualMult, lang\)/.test(shop), "nincs bekötve");
check("kupon nélkül a kártya változatlan (priceForm, „+”)", /if \(!coupon \|\| m\.priceMonthly <= 0\)\s*\n\s*return `<span class="adm-price">\$\{priceForm\(m\.priceMonthly, true\)\}<\/span>`;/.test(shop), "megváltozott");

console.log(`\nmodule-card-coupon-check: ${pass} zöld, ${failures} bukás`);
process.exit(failures ? 1 : 0);
