// Gate: a "[TESZT]" lead's orders charge the payment provider's MINIMUM, a real lead's never
// (ADR-0498, owner 2026-11-26 „Végpróba … 7 € helyett 0,10 €”). The owner walks the real production
// chain with a real card; the price sheet must not be rewritten for it, and a real buyer must never
// get the minimum.
//
// What it pins:
//   ① the pure rule: [TESZT] + EUR → 10 (0.10 €), + HUF → 10 (10 Ft); a real name → null;
//      TEST_LEAD_CHARGE_MINOR=off → null; =25 → 25; =3 (below the minimum) → the minimum;
//      an unknown currency → null (priced normally, the provider gate decides)
//   ② WIRING: every order site that mints a price for a tenant/lead applies it — the first
//      purchase (console order request, after the client-price check), the upsell, the renewal,
//      the multilang order — and drops the domain fee / offer derivation for such a charge.
//
//   npx tsx scripts/test-charge-check.mts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { testChargeMinor } from "../src/payment/testCharge.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

console.log("① a szabály");
const saved = process.env.TEST_LEAD_CHARGE_MINOR;
delete process.env.TEST_LEAD_CHARGE_MINOR;
check("[TESZT] + EUR → 10 (0,10 €)", testChargeMinor("[TESZT] Apartmani Malina", "EUR") === 10);
check("[TESZT] + HUF → 10 (10 Ft)", testChargeMinor("[TESZT] Muschel Panzió", "huf") === 10);
check("valódi lead → null", testChargeMinor("Apartmani Malina", "EUR") === null);
check("üres név → null", testChargeMinor(null, "EUR") === null);
check("ismeretlen pénznem → null", testChargeMinor("[TESZT] X", "RON") === null);
process.env.TEST_LEAD_CHARGE_MINOR = "off";
check("TEST_LEAD_CHARGE_MINOR=off → null", testChargeMinor("[TESZT] X", "EUR") === null);
process.env.TEST_LEAD_CHARGE_MINOR = "25";
check("TEST_LEAD_CHARGE_MINOR=25 → 25", testChargeMinor("[TESZT] X", "EUR") === 25);
process.env.TEST_LEAD_CHARGE_MINOR = "3";
check("a minimum alá nem mehet (3 → 10)", testChargeMinor("[TESZT] X", "EUR") === 10);
if (saved === undefined) delete process.env.TEST_LEAD_CHARGE_MINOR;
else process.env.TEST_LEAD_CHARGE_MINOR = saved;

console.log("② bekötés");
const src = (p: string): string => readFileSync(resolve(ROOT, p), "utf8");
const server = src("src/console/server.ts");
const iCheck = server.indexOf("if (clientPrice !== null && clientPrice !== price)");
const iTest = server.indexOf("const testCharge = orderLeadRow ? await testChargeForLead(");
const iRecord = server.indexOf("const rec = twin ?? await recordOrderIntent({");
check("első vásárlás: az ár-ellenőrzés UTÁN, a rögzítés ELŐTT", iCheck > 0 && iTest > iCheck && iRecord > iTest);
const rec = server.slice(iRecord, server.indexOf("[console] CSOMAG-IGÉNY", iRecord));
check("első vásárlás: a rögzített ár a terhelt ár", /price: chargedPrice,/.test(rec));
check("első vásárlás: nincs domain-díj és ajánlat a teszt-terhelésen", /testCharge !== null \? \{ domainFee: null \}/.test(rec) && /offer && testCharge === null/.test(rec));
check("első vásárlás: az ikerrendelés is a terhelt árral keres", /pendingTwinInitialOrder\(\{[\s\S]{0,200}price: chargedPrice,/.test(server));
const upsell = src("src/tenant/moduleUpsell.ts");
check("bővítés: testChargeForTenant + terhelt ár", /testChargeForTenant\(tenantId, money\.currency\)/.test(upsell) && /price: charged,/.test(upsell));
const billing = src("src/payment/billing.ts");
check("megújítás: testChargeForTenant + domain/ajánlat nélkül", /testChargeForTenant\(sub\.tenantId, sub\.currency\)/.test(billing) && /domainDue && testCharge === null/.test(billing));
const ml = src("src/tenant/multilangOrder.ts");
check("többnyelvűség: testChargeForTenant + terhelt ár", /price: testCharge \?\? price,/.test(ml));
const disp = src("src/outreach/autoDispatch.ts");
const iClaim = disp.indexOf('.where("status", "=", "queued")');
const iTestFirst = disp.indexOf("ltrim(tl.name) like '[TESZT]%'))`)", iClaim);
check("kiküldés: a jóváhagyott [TESZT]-sor a sor elején (a valódi prioritás előtt)", iClaim > 0 && iTestFirst > iClaim && disp.indexOf(".orderBy(DISPATCH_PRIORITY)", iClaim) > iTestFirst);
check("másoló: a kapun bukott terv nem „kész”", /failedGate\.length/.test(src("scripts/test-lead-clone.mts")));
const prov = src("src/domains/provisionDomain.ts");
check("domain: [TESZT]-tenantnak nincs beszerzés-sor (startDomainProvisioning)", /export async function startDomainProvisioning[\s\S]{0,200}if \(await isTestTenant\(input\.tenantId\)\)/.test(prov));
check("domain: a regisztrátor-hívás előtt is elutasít", /if \(await isTestTenant\(p\.tenantId\)\) throw new Error[^\n]*\n\s*const reg = await registrar\.register/.test(prov));
check("domain: a [TESZT]-rendelés citoviso_sub, domain-név és elköteleződés nélkül", /const orderDomainType = dropTestDomain \? "citoviso_sub" : effectiveDomainType;/.test(server) && /domainType: orderDomainType,[\s\S]{0,40}domainName: storedDomainName/.test(server) && /const storedDomainName = dropTestDomain \? null/.test(server) && /domainEligible && !dropTestDomain \? getDomainMinCommitmentMonths/.test(server));
const cfgTs = src("src/generator/configurator.ts");
const cfgJs = src("assets/runtime/cit-configurator.js");
check("kijelzés: a terhelt összeg csak [TESZT]-leadnek kerül a lapra", /testChargeMap\(row\?\.name \?\? null\)/.test(cfgTs) && /map \? `<script data-cit-test-charge>/.test(cfgTs));
check("kijelzés: a fejléc-összeg, a gomb és az összesítő a terhelt összeg; megjegyzés a listaárral", /var amt = fmt\(typeof tc === "number" \? tc : currentCharge\(\)\);/.test(cfgJs) && /"\[TESZT\] — terhelés: " \+ fmt\(tc\) \+ ", listaár: "/.test(cfgJs) && /window\.CIT_TEST_CHARGE\[PRICING\.currency\] : firstCharge/.test(cfgJs));
check("kijelzés: a beküldött ár változatlan (a szerver ár-ellenőrzése a listaárat várja)", !/price: *tc\b|price: *window\.CIT_TEST_CHARGE/.test(cfgJs));
check("köszönőoldal: az előnézet az élő kép, különben a megvett terv hero-képe (nem üres színátmenet)", /async function payPreviewImage\(tenantId: string, gatewayRef: string\)[\s\S]{0,900}heroShotState\(planId\)/.test(server) && /shotUrl: \(await payPreviewImage\(previewTenantId, ref\)\)/.test(server) && /const img = await payPreviewImage\(tenantId, ref\);/.test(server));
check("másoló: a lánc által közben felvett sor a másolat sora (nem bukás)", /executeTakeFirst\(\)\)\?\.id;\s*if \(!rowId\)/.test(src("scripts/test-lead-clone.mts")));

console.log(fails ? `\n✗ ${fails} hiba` : "\n✓ minden rendben");
process.exit(fails ? 1 : 0);
