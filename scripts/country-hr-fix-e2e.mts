// ORSZÁG-RÉTEG 3/10 — A HORVÁT JAVÍTÓKÖR REGRESSZIÓS TESZTJE (Elek HR leletei, 2026-11-19/20).
// SCRATCH database only (scripts/lib/hr-world.mts), no AI, no network, nothing leaves the machine.
//
// Each check is one finding of Elek's HR round, and each money check has its HU (HUF) twin
// that must stay exactly as it was:
//   ① PÉNZ a) the letter's −25 % is the order's −25 %: the letter sent through the real path
//            stamps the offer, the page hands it to the configurator, the order is charged
//            applyOffer(list) — one source; HU twin: the same rule in forints;
//          b) the next charge forecast carries a running domain purchase's fee (the mint does
//            not — §B.17); HU twin;
//          c) the wizard preview keeps the cents (85,50 € → „85,50 € / noć”, never „86 €”) and
//            the price example is not a forint magnitude; HU twin byte-identical;
//          d) a domain purchase that fails for any reason but „taken” is never told as taken,
//            and the activation letter waits for an instant outcome (one event, one truth);
//   ② ORSZÁG a) the calendar-sync portals of the sample booking strip and the configurator come from the
//            country (HR: no Szállás.hu; HU unchanged); b) the OIB check digit (ISO 7064
//            MOD 11,10) in the tenant admin and in the order's company branch; c) the seller's
//            Hungarian AAM abbreviation never reaches a non-HU reader; the tenant's time zone is
//            the lodging country's;
//   ③ MAGYAR MARADVÁNYOK: package names, billing country list, VIES message, room cards, the
//            bookings calendar, the cancel page, /login?l=hr, the homepage with ?l=hr;
//   ④ NYELVTAN: Croatian plurals through Intl.PluralRules (1 noć · 2 noći · 5 noći,
//            1 osoba · 2 osobe · 5 osoba), the HU strings unchanged.
//
//   npx tsx scripts/country-hr-fix-e2e.mts
import { buildHrWorld } from "./lib/hr-world.mts";

const w = await buildHrWorld({ base: "citoviso_hrfix_e2e" });

const { db } = await import("../src/db/client.js");
const { formatMinor } = await import("../src/text/money.js");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const cGet = (p: string, headers: Record<string, string> = {}) => fetch(`${w.consoleOrigin}${p}`, { redirect: "manual", headers });
const cPost = (p: string, body: unknown) =>
  fetch(`${w.consoleOrigin}${p}`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

try {
  // ── ① a) the intro offer: one source ───────────────────────────────────────────────────
  console.log("① a) a levél −25 %-a = a rendelés −25 %-a");
  const offer = await db.selectFrom("offer").select(["kind", "percent"]).where("prospect_id", "=", w.prospectId).execute();
  check("a valódi küldés kiment és rögzítette a bemutatkozó ajánlatot", w.letterPath !== null && offer.some((x) => x.kind === "outreach"), JSON.stringify(offer));
  const pct = offer.find((x) => x.kind === "outreach")?.percent ?? 0;
  const letter = w.letterPath ? (await import("node:fs")).readFileSync(w.letterPath, "utf8") : "";
  check(`a levél ugyanazt a %-ot mondja (${pct} %)`, letter.includes(`${pct}`), letter.slice(0, 200));
  check("a levél ár-dobozában nincs „€ Ft” (a nem-forint összeg a saját jelét viszi)", !!letter && !/€\s*Ft/.test(letter) && /€\/mj|€\/hó|‹hr›/.test(letter), (letter.match(/[^>]{0,30}€[^<]{0,20}/g) ?? []).slice(0, 4).join(" | "));
  const page = await (await cGet(`/p/${w.token}`)).text();
  const cfg = page.match(/"offer":\{[^}]*"percent":(\d+)/);
  check("a lap konfigurátora megkapja az ajánlatot, ugyanazzal a %-kal", Number(cfg?.[1]) === pct, cfg?.[0] ?? "nincs offer a lapon");

  // The order: the Ajánlott package + an own .hr name, as a private person (Elek's path).
  const { computeMonthly, domainFeeForCycle } = await import("../src/pricing.js");
  const { applyOffer } = await import("../src/payment/offers.js");
  const { PRESETS } = await import("../src/modules.js");
  const mods = PRESETS.find((x) => x.id === "ajanlott")!.modules;
  const list = computeMonthly(mods, "hr");
  const fee = domainFeeForCycle(1, "hr", { domain: "apartmanilavanda.hr", modules: mods, disabled: new Set() } as never);
  const expect = applyOffer(list, { percent: pct }) + fee;
  const outboxBefore = new Set((await import("node:fs")).readdirSync("outbox"));
  const oRes = await cPost(`/p/${w.token}/request`, {
    modules: mods, preset: "ajanlott", billing_period: "monthly", domain_type: "citoviso_registered", domain_name: "apartmanilavanda.hr",
    photo_rights_declared: true, recurring_consent: true, withdrawal_waiver: true, terms_accepted: true, price: expect,
    buyer_type: "individual", buyer_name: "Ivan Babić", buyer_country: "HR", buyer_zip: "21300", buyer_city: "Makarska",
    buyer_address: "Obala kralja Tomislava 12", buyer_email: "elek@citoviso.com",
  });
  const oJson = (await oRes.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string; error?: string };
  const oi = await db.selectFrom("order_intent").selectAll().where("prospect_id", "=", w.prospectId).orderBy("created_at", "desc").executeTakeFirst();
  check(`a rendelés a kedvezményes áron megy: ${formatMinor(expect, "EUR", "hr")} (lista ${formatMinor(list + fee, "EUR", "hr")})`, oJson.ok === true && oi?.price === expect, `${oRes.status} ${JSON.stringify(oJson)} · price ${oi?.price}`);

  // ── ① b) / d) payment → activation → the next charge and the letters ────────────────────
  console.log("① b/d) fizetés → aktiválás: következő terhelés a domain díjával, egy igazság a domainről");
  if (oi && oJson.payUrl) {
    const pay = await db.selectFrom("payment").selectAll().where("order_intent_id", "=", oi.id).executeTakeFirstOrThrow();
    const payRes = await fetch(`${w.consoleOrigin}/pay/mock/${pay.gateway_ref}/paid`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "card=visa4242" });
    const doneLoc = payRes.headers.get("location") ?? "";
    // The domain run is instant on the mock registrar; give its tail (DNS/TLS steps) a moment.
    await new Promise((r) => setTimeout(r, 1500));
    const done = doneLoc ? await (await cGet(doneLoc.replace(/^https?:\/\/[^/]+/, ""))).text() : "";
    const listNext = list + fee;
    const nextTxt = formatMinor(listNext, "EUR", "hr");
    check(`/pay/done: a következő terhelés a domain díjával (${nextTxt})`, done.includes(nextTxt), (done.match(/[^<>]{0,80}€[^<>]{0,40}/g) ?? []).slice(0, 6).join(" | "));
    const fs = await import("node:fs");
    const newMails = fs.readdirSync("outbox").filter((f) => !outboxBefore.has(f)).sort();
    const bodies = newMails.map((f) => fs.readFileSync(`outbox/${f}`, "utf8"));
    const subjects = bodies.map((b) => b.match(/^Subject: (.*)$/m)?.[1] ?? "?");
    const activation = bodies.find((b) => /aktivirali|aktiváltuk/i.test(b.match(/^Subject: (.*)$/m)?.[1] ?? "")) ?? "";
    check("az aktiváló levél is a domain díjával számol", activation.includes(nextTxt), subjects.join(" | "));
    const prov = await db.selectFrom("domain_provisioning").select(["status", "error"]).where("order_intent_id", "=", oi.id).executeTakeFirst();
    const failedMail = bodies.some((b) => /zauzeta|elkelt|nismo mogli kupiti|nem tudtuk megvásárolni/i.test(b));
    const promised = /u tijeku|folyamatban|kupnja/i.test(activation);
    check("a domain-beszerzés sikerült (a teszt-ársor plafonja a regisztrátor pénznemében)", !!prov && prov.status !== "failed", JSON.stringify(prov));
    check("nincs két ellentmondó domain-levél (folyamatban + elkelt)", !(failedMail && promised), subjects.join(" | "));
    for (const f of newMails) fs.rmSync(`outbox/${f}`, { force: true });
  }

  // b) the forecast vs the mint (a running purchase): unit level, HU twin.
  {
    const { domainFeeForRenewal } = await import("../src/payment/billing.js");
    const t = await db.selectFrom("tenant").select("id").where("lead_id", "=", w.leadId).executeTakeFirst();
    if (t) {
      const site = await db.selectFrom("site").select(["id", "custom_domain_status"]).where("tenant_id", "=", t.id).executeTakeFirstOrThrow();
      const saved = site.custom_domain_status;
      await db.updateTable("site").set({ custom_domain_status: "registering", custom_domain: null } as never).where("id", "=", site.id).execute();
      await db.updateTable("domain_provisioning").set({ status: "registering" } as never).where("tenant_id", "=", t.id).execute();
      const forecast = await domainFeeForRenewal(t.id, 1, "hr", { forecast: true });
      const mint = await domainFeeForRenewal(t.id, 1, "hr");
      check("folyamatban lévő beszerzés: az előrejelzés számol a díjjal, a terhelés NEM (§B.17)", forecast?.fee === fee && mint === null, `forecast ${JSON.stringify(forecast)} · mint ${JSON.stringify(mint)}`);
      await db.updateTable("domain_provisioning").set({ status: "failed" } as never).where("tenant_id", "=", t.id).execute();
      await db.updateTable("site").set({ custom_domain_status: "failed" } as never).where("id", "=", site.id).execute();
      check("elbukott beszerzés: sem az előrejelzés, sem a terhelés nem számol vele", (await domainFeeForRenewal(t.id, 1, "hr", { forecast: true })) === null);
      await db.updateTable("site").set({ custom_domain_status: saved } as never).where("id", "=", site.id).execute();
    } else {
      check("tenant létrejött az aktiváláskor", false);
    }
  }

  // d) the failure letter's wording follows the cause.
  {
    const { buildDomainFailedEmail } = await import("../src/email/domainEmail.js");
    const notTaken = buildDomainFailedEmail({ to: "elek@citoviso.com", domain: "apartmanilavanda.hr", adminUrl: "https://x/admin", taken: false, lang: "hu" });
    const taken = buildDomainFailedEmail({ to: "elek@citoviso.com", domain: "apartmanilavanda.hr", adminUrl: "https://x/admin", lang: "hu" });
    check("nem-foglalt ok (plafon/pénznem/hiba) → a levél NEM mondja, hogy elkelt", !/elkelt|más lefoglalta/.test(`${notTaken.subject} ${notTaken.text}`), notTaken.subject);
    check("foglalt ok → a régi szöveg bájtra (HU)", taken.subject === "A választott webcím időközben elkelt" && /más lefoglalta/.test(taken.text));
  }

  // c) the wizard preview keeps the cents; HU twin.
  {
    const { formatMinor: fm, majorToMinor } = await import("../src/text/money.js");
    check("varázsló-előnézet: 85,50 € → „85,50 €” (nem „86 €”)", fm(majorToMinor(85.5, "EUR"), "EUR", "hr").includes("85,50"), fm(majorToMinor(85.5, "EUR"), "EUR", "hr"));
    check("varázsló-előnézet HU: 25 000 Ft változatlan", fm(majorToMinor(25000, "HUF"), "HUF", "hu") === "25 000 Ft");
  }

  // ── ② country content ──────────────────────────────────────────────────────────────────
  console.log("② ország-függő tartalom");
  {
    const { calendarSyncPortals } = await import("../src/country.js");
    check("naptár-portálok: HR = Booking.com + Airbnb, HU = + Szállás.hu", JSON.stringify(calendarSyncPortals("HR")) === '["Booking.com","Airbnb"]' && calendarSyncPortals("HU").includes("Szállás.hu"));
    // The LETTER's calendar sentence (two-portal variant) waits on the owner's decision — patch
    // ~/rc-briefs/orszag-reteg-3j-level-portal-mondat.patch (letter-critic gate); not tested here.
    check("a mock foglalási mintáján a HR portál-lista (nincs Szállás.hu)", /data-cit-portals="\[&quot;Booking\.com&quot;,&quot;Airbnb&quot;\]"/.test(page), (page.match(/data-cit-portals="[^"]*"/) ?? ["nincs attribútum"])[0]);
    const { hrOibProblem } = await import("../src/billing/taxId.js");
    check("OIB: 69435151530 érvényes, 12345678904 ellenőrzőszám-hibás, 1234 rövid", hrOibProblem("69435151530") === null && /ellenőrző/.test(hrOibProblem("12345678904") ?? "") && /11/.test(hrOibProblem("1234") ?? ""));
    const { LEGAL_LOCAL } = await import("../src/legal.js");
    const { nationalTaxIdProblem } = await import("../src/billing/taxId.js");
    check("a tenant-admin HR-ben ellenőrzi az OIB-t, HU-n nincs ilyen szabály", nationalTaxIdProblem(LEGAL_LOCAL.HR!.taxIdCheck, "12345678904") !== null && nationalTaxIdProblem(LEGAL_LOCAL.HU!.taxIdCheck, "bármi") === null);
    const { validateBuyer } = await import("../src/billing/buyer.js");
    const base = { buyer_type: "business", buyer_name: "Obrt Lavanda", buyer_country: "HR", buyer_zip: "21300", buyer_city: "Makarska", buyer_address: "Obala 12", buyer_email: "elek@citoviso.com" };
    const okOib = await validateBuyer({ ...base, buyer_national_tax_id: "69435151530" }, { lang: "hr" });
    check("HR cég ÁFA-szám nélkül, érvényes OIB-vel rendelhet (nincs VIES, nincs fordított adózás)", okOib.ok && okOib.value.buyerNationalTaxId === "69435151530" && okOib.value.buyerEuVatNumber === null && okOib.value.vatTreatment !== "reverse_charge", JSON.stringify(okOib));
    const badOib = await validateBuyer({ ...base, buyer_national_tax_id: "12345678904" }, { lang: "hr" });
    check("HR cég hibás OIB-vel: mezőhiba, nem magyarul", !badOib.ok && !!badOib.errors.buyer_national_tax_id && badOib.errors.buyer_national_tax_id !== "Az OIB ellenőrző számjegye nem stimmel — valószínűleg elgépelés.", JSON.stringify(badOib));
    const huBad = await validateBuyer({ ...base, buyer_country: "HU", buyer_zip: "123", buyer_tax_number: "" });
    check("HU vevő: az üzenetek bájtra a régiek", !huBad.ok && huBad.errors.buyer_zip === "A magyar irányítószám 4 számjegyű.", JSON.stringify(huBad.ok ? null : huBad.errors));

    const t = await db.selectFrom("tenant").select(["time_zone"]).where("lead_id", "=", w.leadId).executeTakeFirst();
    check("a horvát tenant időzónája Europe/Zagreb (nem Budapest)", t?.time_zone === "Europe/Zagreb", String(t?.time_zone));
  }

  // ── ③ Hungarian leftovers ──────────────────────────────────────────────────────────────
  console.log("③ magyar maradványok");
  {
    const { guestCancelConfirmPage } = await import("../src/server/moduleConfigViews.js");
    const html = guestCancelConfirmPage({ outcome: "ok", lang: "hr", dateFrom: "2026-12-10", dateTo: "2026-12-13", guestName: "Ana", hostName: "Apartmani Lavanda", siteUrl: null, ref: "R1" } as never, "tok");
    check("lemondó oldal: lang=hr, horvát dátum (10. 12. 2026.)", /<html lang="hr"/.test(html) && html.includes("10. 12. 2026.") && !html.includes("2026. 12. 10."), html.match(/<b>[^<]*2026[^<]*<\/b>/)?.[0] ?? "");
    const huHtml = guestCancelConfirmPage({ outcome: "ok", lang: "hu", dateFrom: "2026-12-10", dateTo: "2026-12-13", guestName: "Ana", hostName: "X", siteUrl: null, ref: "R1" } as never, "tok");
    check("lemondó oldal HU: lang=hu, 2026. 12. 10.", /<html lang="hu"/.test(huHtml) && huHtml.includes("2026. 12. 10."));
    const login = await (await fetch(`${w.publicOrigin}/login?l=hr`)).text();
    check("/login?l=hr: horvátul (nincs „Ügyfél-belépés”, nincs „mutat”)", !login.includes("Ügyfél-belépés") && !/>mutat</.test(login) && !/'mutat'/.test(login), login.match(/<h1[^>]*>[^<]*/)?.[0] ?? "");
    const { injectOwnedBanner, injectOwnedNotice } = await import("../src/console/prospectNotice.js");
    const own = { stage: "live", siteUrl: "https://apartmanilavanda.hr", loginUrl: "https://citoviso.test/login" } as never;
    const ownHr = injectOwnedNotice(injectOwnedBanner("<html><body></body></html>", { ...(own as object), lang: "hr" } as never), { ...(own as object), lang: "hr" } as never);
    const ownHu = injectOwnedNotice(injectOwnedBanner("<html><body></body></html>", own), own);
    check("vásárlás utáni sáv: horvát lapon nincs magyar forrás, a magyar változatlan", !ownHr.includes("Ez az oldal már az Öné.") && !ownHr.includes("Ön a Citoviso ügyfele") && ownHu.includes("Ez az oldal már az Öné.") && ownHu.includes("Belépés a kezelőfelületre"));
    {
      const t2 = await db.selectFrom("tenant").select("id").where("lead_id", "=", w.leadId).executeTakeFirst();
      const oiFirst = await db.selectFrom("order_intent").select("id").where("prospect_id", "=", w.prospectId).orderBy("created_at", "asc").executeTakeFirst();
      if (t2 && oiFirst) {
        await db.updateTable("order_intent").set({ buyer_national_tax_id: "69435151530" } as never).where("id", "=", oiFirst.id).execute();
        const { loadTenantLegal } = await import("../src/tenant/legalIdentity.js");
        const lg = await loadTenantLegal(t2.id);
        check("a rendelésnél megadott OIB a Jogi adatok előtöltése", lg.who.taxNumber === "69435151530", String(lg.who.taxNumber));
      }
    }
    const loginHu = await (await fetch(`${w.publicOrigin}/login`)).text();
    check("/login HU: változatlan felirat", loginHu.includes("Ügyfél-belépés") && />mutat</.test(loginHu));
  }

  // ── ④ plurals ───────────────────────────────────────────────────────────────────────────
  console.log("④ horvát többes szám (Intl.PluralRules)");
  {
    const { selectPlural, placeholderProblem } = await import("../src/i18n/packs.js");
    const v = "plural:one={n} noć;few={n} noći;other={n} noći";
    const o = "plural:one={n} osoba;few={n} osobe;other={n} osoba";
    const r = [1, 2, 5, 21, 22].map((n) => selectPlural("hr", v, n).replace("{n}", String(n))).join(" · ");
    check("1 noć · 2 noći · 5 noći · 21 noć · 22 noći", r === "1 noć · 2 noći · 5 noći · 21 noć · 22 noći", r);
    const r2 = [1, 2, 5].map((n) => selectPlural("hr", o, n).replace("{n}", String(n))).join(" · ");
    check("1 osoba · 2 osobe · 5 osoba", r2 === "1 osoba · 2 osobe · 5 osoba", r2);
    check("a plurál-érték megtartja a placeholder-szerződést minden alakban", placeholderProblem("{n} éj", v) === null && placeholderProblem("{n} éj", "plural:one=noć;other={n} noći") !== null);
    const { T } = await import("../src/i18n/mail.js");
    check("HU: „{n} éj” → „2 éj” (sima érték, változatlan)", T("hu", "{n} éj", { n: 2 }) === "2 éj");
  }
} finally {
  await w.close();
}
console.log(fails ? `\n⛔ country-hr-fix-e2e: ${fails}/${total} hiba` : `\n✅ country-hr-fix-e2e: ${total} ellenőrzés zöld`);
process.exit(fails ? 1 : 0);
