// Próba-modulok vásárlás után (Elek-szállásadó P-3, 2026-10-14): Elek a próba alatt csak az
// Alap csomagot vette meg, mégis az Áttekintés azt írta, hogy a Felszereltség (490) és a
// Nyitvatartás (290) modult „kifizette”, a Modulok fül pedig mind a 11 modult áraival „aktív”-nak
// listázta — és sehol nem állt, hogy 8 modul 10-28-án kikapcsol. Vásárlás után a próba állapota
// `converted`, a tenant-szintű „próba fut” jelző hamis — a sornak a modul SAJÁT trial_grant-jét
// kell néznie.
//   ① Modulok fül: a próba-modul „próbában ingyen” (nem ár), és kimondja a kikapcsolás napját;
//   ② Áttekintés: üres próba-modulnál nincs „kifizette”, nincs ár;
// negatív kontrollal (a megvett modul ára és „kifizette” szövege marad).
// Futtatás: npx tsx scripts/trial-grant-truth-check.mts
const { adminDashboard } = await import("../src/server/adminViews.js");
type TenantModuleView = import("../src/tenant/modules.js").TenantModuleView;
type TenantModule = TenantModuleView["modules"][number];

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 300)}`}`);
  if (!c) fail++;
};
const strip = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const mod = (id: string, label: string, price: number, o: Partial<TenantModule> = {}): TenantModule =>
  ({ id, label, publicDesc: "", group: "content", spine: false, active: true, priceMonthly: price, supersededBy: null, cancelAtPeriodEnd: false, awaitingFirstCharge: false, trialGrant: false, ...o }) as TenantModule;
const bought = mod("gallery", "Képek a szállásról", 490);
const trialA = mod("amenities", "Amit kínál (felszereltség)", 490, { trialGrant: true });
const trialH = mod("hours", "Nyitvatartás, érkezés", 290, { trialGrant: true });
const view: TenantModuleView = { modules: [bought, trialA, trialH], baseMonthly: 3900, totalMonthly: 4390, notOrderable: [], trialUntil: "2026-10-28" };

const session = { tenantId: "demo", tenantUserId: "u", username: "elek", displayName: "Őr Vendégház", contactEmail: "a@b.hu" } as never;
const content = { name: "Őr Vendégház", tagline: "", intro: "…", photos: [], highlights: [], usingOwnPhotos: true, status: "live", previewPath: null } as never;
const sub = {
  status: "active", periodEnd: "2026-11-14", renewDay: 14, nextInvoiceTotal: 4390, nextChargeTotal: 4390, nextInvoiceItems: [], payUrl: null, arrears: null,
  closesOn: "2026-12-14", frozenOn: null, restoredOn: null, settled: null, cancelAtPeriodEnd: false, billingPeriod: "monthly", pendingAnnual: false,
  pendingEffectiveDate: null, annualTotal: 43900, annualSavings: 8780, annualFreeMonths: 2, autoCharge: false, cardLabel: null, coupon: null,
};

console.log("\n① Modulok fül");
{
  const raw = adminDashboard(session, content, { tab: "modulok", modules: view, siteUrl: "https://x.citoviso.com", previewToken: "d", units: [], subscription: sub, trial: null } as never);
  const page = strip(raw);
  const ids: Record<string, string> = { "Amit kínál (felszereltség)": "amenities", "Nyitvatartás, érkezés": "hours", "Képek a szállásról": "gallery" };
  // The owned-module row by its own hook — the label also stands in the side menu.
  const row = (label: string): string => {
    const i = raw.indexOf(`data-modrow="${ids[label]}"`);
    return i < 0 ? "" : strip(raw.slice(i, raw.indexOf('class="adm-mine__a"', i)));
  };
  check("⭐ próba-modul: „próbában ingyen”, nem ár", /próbában ingyen/.test(row("Amit kínál (felszereltség)")) && !/490 Ft/.test(row("Amit kínál (felszereltség)")), row("Amit kínál (felszereltség)"));
  check("⭐ kimondja a kikapcsolás napját", /Próba-modul — 2026\. ?10\. ?28\.-ig ingyen él az oldalán, utána kikapcsol/.test(page), row("Nyitvatartás, érkezés"));
  check("negatív kontroll: a megvett modul az árával áll", /490 Ft/.test(row("Képek a szállásról")) && !/próbában ingyen/.test(row("Képek a szállásról")), row("Képek a szállásról"));
}
console.log("\n② Áttekintés (vásárlás után: a próba állapota már converted → trial: null)");
{
  const ov = (paidEmpty: TenantModule[]) =>
    strip(adminDashboard(session, content, { tab: "attekintes", modules: view, siteUrl: "https://x.citoviso.com", previewToken: "d", units: [], subscription: sub, trial: null, paidEmpty } as never));
  const t = ov([trialA, trialH]);
  check("⭐ üres próba-modulnál nincs „kifizette”", !/kifizette/.test(t), t.slice(t.indexOf("Töltse ki"), t.indexOf("Töltse ki") + 300));
  check("⭐ és nincs ára (490 / 290)", !/Töltse ki: Amit kínál[^.]*490/.test(t) && !/Töltse ki: Nyitvatartás[^.]*290/.test(t));
  check("⭐ a próbát mondja", /a próbában be van kapcsolva, de üres/.test(t));
  const b = ov([bought]);
  check("negatív kontroll: a megvett, üres modulnál „kifizette” és ár", /kifizette, de üres/.test(b) && /490/.test(b.slice(b.indexOf("Töltse ki"), b.indexOf("Töltse ki") + 200)));
}
console.log(fail ? `\n⛔ TRIAL-GRANT-TRUTH: ${fail} bukás` : "\n🟢 TRIAL-GRANT-TRUTH: a próba-modul vásárlás után sem „kifizette”, és látszik, mikor kapcsol ki");
process.exit(fail ? 1 : 0);
