// pricing-packages-check (ADR-XXXX): the package composition, the domain as package content,
// the per-ending table, the 0 = no-threshold rule, the per-ending cost cap and the trial's
// package — the rules the redesigned /pricing page edits and the money paths read.
//
// Process-local: the dev DB is shared, so the pricing state is PINNED in this process
// (overridePricingStateInProcess) and nothing is written. The cost cap runs on the mock
// registrar (REGISTRAR_PROVIDER=mock). ~3 s.
//
// Run: REGISTRAR_PROVIDER=mock npx tsx scripts/pricing-packages-check.mts

process.env.REGISTRAR_PROVIDER = "mock";

const {
  packageAssignmentErrors,
  parsePackageAssignment,
  presetsFrom,
  seedAssignment,
  coversDomainTier,
  tierModules,
  packageableIds,
} = await import("../src/packages.js");
const pricing = await import("../src/pricing.js");
const { assertUnderCostCap, CostCapRefusal, exceedsCostCap } = await import("../src/domains/costCap.js");
const { parseFreeTrialSetting, freeTrialFromForm, freeTrialConfigErrors } = await import("../src/trial/config.js");
const { trialModuleIds } = await import("../src/trial/start.js");

let failures = 0;
function check(label: string, cond: boolean, detail = ""): void {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${detail && !cond ? `\n     ↳ ${detail}` : ""}`);
  if (!cond) failures++;
}
type Tier = "alap" | "ajanlott" | "teljes";
const A = (o: Record<string, Tier>): Map<string, Tier> => new Map(Object.entries(o));

// ① composition rules
const seed = seedAssignment();
check("① a kód-seed érvényes összetétel", packageAssignmentErrors(seed).length === 0, JSON.stringify(packageAssignmentErrors(seed)));
check("① a seed nem tartalmazza a domaint (a mai viselkedés)", !seed.has("domain"));
const depBroken = new Map(seed);
depBroken.set("booking", "alap");
check(
  "① a Foglalás az Alapban az Árak nélkül → függőség-hiba",
  packageAssignmentErrors(depBroken).some((e) => e.kind === "dependency" && e.module === "booking" && e.requires === "pricing"),
);
const depMissing = new Map(seed);
depMissing.delete("rooms");
check(
  "① a Szobák csomagon kívül, az Árak csomagban → függőség-hiba (feltételes él: áll, ha nem tudjuk)",
  packageAssignmentErrors(depMissing).some((e) => e.kind === "dependency" && e.requires === "rooms"),
);
const spine = new Map(seed);
spine.set("enquiry", "ajanlott");
check("① a gerinc nem az Alapban → hiba", packageAssignmentErrors(spine).some((e) => e.kind === "spine"));
check("① egyszeri modul (multilang) nem tehető csomagba", packageAssignmentErrors(A({ ...Object.fromEntries(seed), multilang: "teljes" })).some((e) => e.kind === "unknown" && e.module === "multilang"));
check("① kitalált id → hiba", packageAssignmentErrors(A({ ...Object.fromEntries(seed), xyz: "alap" })).some((e) => e.kind === "unknown"));
check("① a domain csomagba tehető", packageableIds().includes("domain") && packageAssignmentErrors(A({ ...Object.fromEntries(seed), domain: "ajanlott" })).length === 0);

// ② tiers nest by construction
const ps = presetsFrom(A({ ...Object.fromEntries(seed), domain: "ajanlott" }));
const byId = Object.fromEntries(ps.map((p) => [p.id, new Set(p.modules)]));
check("② Alap ⊆ Ajánlott ⊆ Teljes (szerkezetileg)", [...byId.alap!].every((m) => byId.ajanlott!.has(m)) && [...byId.ajanlott!].every((m) => byId.teljes!.has(m)));
check("② a domain ál-modul nem modul a listákban", !byId.teljes!.has("domain"));

// ③ covers the domain tier
const withDom = A({ ...Object.fromEntries(seed), domain: "ajanlott" });
const ajanlott = tierModules(withDom, "ajanlott");
check("③ az Ajánlott teljes listája → csomag-tartalom", coversDomainTier(withDom, ajanlott));
check("③ egy hiányzó modul → nem csomag-tartalom", !coversDomainTier(withDom, ajanlott.filter((m) => m !== "reviews")));
check("③ a hiányzó modul le van állítva → nem számít ellene", coversDomainTier(withDom, ajanlott.filter((m) => m !== "reviews"), new Set(["reviews"])));
check("③ a gerinc nélkül is (mindig benne van)", coversDomainTier(withDom, ajanlott.filter((m) => m !== "enquiry")));
check("③ egyedi összeállítás, ami TÖBB → csomag-tartalom", coversDomainTier(withDom, [...ajanlott, "booking", "pricing"]));

// ④ fee rule (pinned state)
const hu = (o: Partial<import("../src/pricing.js").TldRow> = {}) => ({
  tld: ".hu", offered: true, costNet: 1990, costCurrency: "HUF", costMeasuredAt: "2026-10-11T09:30:00.000Z",
  maxCost: 5000, monthlyFee: 1000, freeInPackage: true, ...o,
});
const com = hu({ tld: ".com", costNet: 4899, maxCost: 8000, monthlyFee: 1500, freeInPackage: false });
pricing.overridePricingStateInProcess({ assignment: withDom, tlds: [hu(), com], domainFreeInPackage: false, domainMinPackageMonthly: 7000 });
const none = new Set<string>();
check("④ kapcsoló KI → a végződés díja (1000)", pricing.domainMonthlyFee("pelda.hu", ajanlott, none) === 1000);
pricing.overridePricingStateInProcess({ tlds: [hu(), com], domainFreeInPackage: true });
check("④ kapcsoló BE + csomag-tartalom + .hu ingyen → 0", pricing.domainMonthlyFee("pelda.hu", ajanlott, none) === 0);
check("④ csomag-tartalom, de a .com nem ingyen → 1500", pricing.domainMonthlyFee("pelda.com", ajanlott, none) === 1500);
check("④ nem csomag-tartalom → díj", pricing.domainMonthlyFee("pelda.hu", ["enquiry", "gallery"], none) === 1000);
check("④ nem kínált végződés → null (nem eladható)", pricing.domainMonthlyFee("pelda.de", ajanlott, none) === null);
check("④ név nélkül az elsődleges végződés", pricing.domainMonthlyFee(null, ["enquiry"], none) === 1000);
check("④ leghosszabb illeszkedés (.co.hu ≠ .hu-nál rövidebb)", pricing.offeredTldOf("a.co.hu")?.tld === ".hu");
check("④ a ciklus díja = havi × hónap (éves, csomag-tartalom: 0)", pricing.domainFeeForCycle(12, undefined, { domain: "x.hu", modules: ajanlott, disabled: none }) === 0);
check("④ a ciklus díja = havi × hónap (éves, felár)", pricing.domainFeeForCycle(12, undefined, { domain: "x.hu", modules: ["enquiry"], disabled: none }) === 12_000);
check("④ getCustomDomainMonthly = az elsődleges végződés díja", pricing.getCustomDomainMonthly() === 1000);

// ⑤ threshold
check("⑤ küszöb alatt, nem csomag-tartalom → nem választható", !pricing.isDomainEligible(5000, undefined, { modules: ["enquiry"], disabled: none }));
check("⑤ küszöb alatt, de csomag-tartalom → választható", pricing.isDomainEligible(5000, undefined, { modules: ajanlott, disabled: none }));
check("⑤ küszöb felett → választható", pricing.isDomainEligible(8000));
pricing.overridePricingStateInProcess({ domainMinPackageMonthly: 0 });
check("⑤ küszöb 0 = nincs küszöb (mindenki választhat)", pricing.isDomainEligible(0));

// ⑥ ending rows
check("⑥ jó sorok → nincs hiba", pricing.tldRowErrors([hu(), com]).length === 0);
check("⑥ mért ár nélkül kínált → hiba", pricing.tldRowErrors([hu({ costNet: null })]).length > 0);
check("⑥ plafon felett kínált → hiba", pricing.tldRowErrors([hu({ maxCost: 1000 })]).length > 0);
check("⑥ plafon felett, de NEM kínált → rendben", pricing.tldRowErrors([hu({ maxCost: 1000, offered: false })]).length === 0);
check("⑥ duplikált végződés → hiba", pricing.tldRowErrors([hu(), hu()]).length > 0);
check("⑥ hibás végződés → hiba", pricing.tldRowErrors([hu({ tld: ".h1" })]).length > 0);
check("⑥ negatív díj → hiba", pricing.tldRowErrors([hu({ monthlyFee: -1 })]).length > 0);

// ⑦ parsers refuse garbage
check("⑦ pkg_json: szemét → null", parsePackageAssignment("[1,2]") === null && parsePackageAssignment("{\"gallery\":\"prémium\"}") === null && parsePackageAssignment("{") === null);
check("⑦ pkg_json: jó → Map", parsePackageAssignment("{\"gallery\":\"alap\"}")?.get("gallery") === "alap");
check("⑦ tld_json: szemét → null", pricing.parseTldRows("{}") === null && pricing.parseTldRows("nope") === null);
const parsed = pricing.parseTldRows(JSON.stringify([{ tld: ".HU", offered: true, costNet: 1990, maxCost: "x", monthlyFee: 1000 }]));
check("⑦ tld_json: típus-hiba a szabály-rétegen bukik (maxCost)", !!parsed && pricing.tldRowErrors(parsed).length > 0 && parsed[0]!.tld === ".hu");

// ⑧ per-ending cost cap on the mock registrar
pricing.overridePricingStateInProcess({ tlds: [hu(), com] });
let ok8 = true;
try { await assertUnderCostCap("pelda.hu"); } catch { ok8 = false; }
check("⑧ olcsó .hu a plafon alatt → vehető", ok8);
let refused: unknown = null;
try { await assertUnderCostCap("premium.hu"); } catch (e) { refused = e; }
check("⑧ prémium név a plafon felett → CostCapRefusal", refused instanceof CostCapRefusal, String(refused));
refused = null;
try { await assertUnderCostCap("pelda.de"); } catch (e) { refused = e; }
check("⑧ nem kínált végződés → CostCapRefusal (fail-closed)", refused instanceof CostCapRefusal, String(refused));
check("⑧ a tanácsadó előszűrő ugyanígy dönt", (await exceedsCostCap("premium.hu")) && !(await exceedsCostCap("pelda.hu")));

// ⑨ trial package
const c9 = parseFreeTrialSetting(JSON.stringify({ enabled: true, days: 14, package: "alap" }));
check("⑨ a tárolt próba-csomag beolvasva", c9?.package === "alap");
check("⑨ régi sor csomag nélkül → nincs csomag (régi viselkedés)", parseFreeTrialSetting(JSON.stringify({ enabled: true, days: 14 }))?.package === undefined);
check("⑨ hibás csomag → a sor érvénytelen", parseFreeTrialSetting(JSON.stringify({ enabled: true, days: 14, package: "arany" })) === null);
const fd = new Map<string, string>([["trial_present", "1"], ["trial_on", "on"], ["trial_days", "10"], ["trial_package", "ajanlott"]]);
const form9 = { get: (k: string) => fd.get(k) ?? null } as unknown as URLSearchParams;
const fromForm = freeTrialFromForm(form9, { enabled: true, days: 14 });
check("⑨ a POST viszi a csomagot", fromForm?.package === "ajanlott" && freeTrialConfigErrors(fromForm).length === 0);
fd.delete("trial_package");
check("⑨ régi fül csomag-mező nélkül → a tárolt marad", freeTrialFromForm(form9, { enabled: true, days: 14, package: "alap" })?.package === "alap");
check("⑩ a próba az Alap csomaggal = az Alap modulok", JSON.stringify(trialModuleIds("alap")) === JSON.stringify(tierModules(withDom, "alap")));
check("⑩ csomag nélkül = a régi „minden modul”", trialModuleIds().length > tierModules(withDom, "teljes").length - 1);

// ⑪ the page renders the plan's binding pieces
const { pricingPage } = await import("../src/console/views.js");
const html = pricingPage(pricing.pricingSnapshot("hu"), pricing.pricingRegions(), null, new Set(["email"]), new Map(), undefined, undefined, undefined, withDom);
for (const lit of ["Figyelmet kér", "Csomagon kívül", "Kötelező platform-cím:", "A próbázó ezt kapja", "Ingyen domain csomagban", 'name="pkg_json"', 'name="tld_json"', 'name="trial_package"', 'name="domain_free_in_package"', 'id="pr2_data"', "pr2-save"])
  check(`⑪ a lap tartalmazza: ${lit}`, html.includes(lit));
check("⑪ a régi „Vissza a vezérlőpultra” link kivezetve (a keret ← gombja viszi)", !html.includes("Vissza a vezérlőpultra"));
const data = JSON.parse(/<script type="application\/json" id="pr2_data">([\s\S]*?)<\/script>/.exec(html)![1]!) as { assign: Record<string, string> };
check("⑪ a lap adata a betöltött összetételt viszi", data.assign.domain === "ajanlott" && data.assign.booking === "teljes");

pricing.overridePricingStateInProcess(null);
if (failures) {
  console.error(`\n⛔ pricing-packages-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ pricing-packages-check: minden zöld");
process.exit(0);
