// gate-lane: own-fixture-only
//   ↑ ÍGÉRET (ADR-0229): ez a kapu CSAK a saját, futásonként bélyegzett fixture-ét írja és olvassa
//   vissza. A park mérése (hány lead érintett) NEM ennek a kapunak a dolga — az ADR-ben rögzítve.
/**
 * A LEAD NYILVÁNOS ELÉRHETŐSÉGÉNEK ŐRE (ADR-0316): a szállás címe/országa nem lehet egy vevő
 * számlázási adata.
 *
 * ⛔ MIÉRT (mérve 2026-10-03, dev park): 7 lead `raw.address`-ében a tesztelő SAJÁT számlázási
 * címe állt („Ráckevei út 083/2 hrsz., 24393470213" — utca + 11 jegyű, adószám-formájú szám),
 * az országban „MAGYARORSZÁG", és ez minden mockra/sablonra kiment (hős, fejléc, lábléc, térkép).
 * Az út: a konzol „Adatok" űrlapja (`saveLeadEdits`, POST /lead/:id/data) — `name="address|
 * country|…"` mezők, amiket a böngésző cím-automatikus kitöltése a gépelő SAJÁT profiljából tölt
 * (ugyanez a sztring ül az order_intent.buyer_address-ben, a pénztár-űrlapot is ez töltötte).
 *
 *   ① szabály (leadContactRules.ts): a mért szennyezett értékek elutasítva, a valódi címek
 *     (hrsz.-szal, irányítószámmal, házszámmal) átmennek, az ország ISO-2-re fordul;
 *   ② mentés (saveLeadEdits, saját fixture-lead): az autofill-csomag MINDENT-VAGY-SEMMIT
 *     elutasítva — a DB-ben semmi nem változik; egy jó mentés átmegy, az ország „HU"-ként áll.
 *   ③ az űrlap (leadPage): a form `autocomplete="off"`, és a cím/ország/telefon/e-mail/város mező
 *     nem szabványos autocomplete-tokent visel (a Chrome ezt nem tölti; tulaj-engedély 2026-10-03).
 *
 * TÖBB E-MAIL-CÍM (ADR-0321, tulaj 2026-10-04: „lehessen több emailcímet menteni!”):
 *   ④ szabály (leadEmails.ts): a tulaj sora („a; b”) két címre bomlik; ugyanaz a postafiók
 *     (kis/nagybetű, +címke) kétszer elutasítva; a mai formátum marad (pont nélküli domain
 *     ÁTMEGY — tulaj: „ne legyen” szigorúbb); szemét elutasítva; entitás nem vág ketté;
 *   ⑤ mentés (saját fixture): lista → raw.email (elsődleges) + raw.otherEmails; egy hibás cím =
 *     SEMMI nem íródik (a többi mező sem); üres lista mindkettőt törli; az űrlap soronként mutatja;
 *   ⑥ kurátori e-mail (curatorEmail.ts): az újragyűjtés nem írja felül / nem törli / nem tölti
 *     újra a kurátor címét, a soha nem szerkesztett hiányt viszont pótolhatja; az OSM „a;b” bontva.
 *   ⑦ „Követett link készítése” (tulaj 2026-10-04: „igen töltse elő”, 4.: „Nem autofill ha van több
 *     email”): egycímes leadnél a címzett-mező az elsődleges címmel indul, többcímesnél és cím
 *     nélkül ÜRES — a renderelt lead-lapon mérve.
 *
 * Negatív kontroll: a régi kódon a ② piros (a mentés elfogadta és beírta az autofill-csomagot),
 * a ③ piros (nincs autocomplete-tiltás).
 *
 *   npx tsx scripts/lead-contact-guard-check.mts
 */
(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
process.env.CIT_SHOT = "1";

const { db, pool } = await import("../src/db/client.js");
const { saveLeadEdits } = await import("../src/console/data.js");
const { checkLeadContact } = await import("../src/console/leadContactRules.js");
const { leadPage } = await import("../src/console/views.js");
const { checkEmailList, leadEmails, splitEmailList } = await import("../src/email/leadEmails.js");
const { curatorOwnsEmail, keepCuratorEmail } = await import("../src/scraper/curatorEmail.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

let fails = 0;
function ok(cond: boolean, msg: string, detail = ""): void {
  console.log(`${cond ? "  ok " : "  FAIL"} ${msg}${!cond && detail ? `  — ${detail}` : ""}`);
  if (!cond) fails++;
}

// ── ① szabály ────────────────────────────────────────────────────────────────
console.log("① szabály (leadContactRules.ts)");
const polluted = [
  "Ráckevei út 083/2 hrsz., 24393470213",
  "24393470213",
  "Fő utca 1., 24393470-2-13",
  "Fő utca 1., 06 20 375 9440",
  "Kossuth u. 3, +36305161631",
];
for (const a of polluted) {
  const v = checkLeadContact({ address: a });
  ok(!v.ok, `elutasítva: „${a}"`, JSON.stringify(v));
}
const clean = [
  "8274 Köveskál, Fő u. 24.",
  "Zamárdi, Szent István u. 3512 hrsz, 8621 Hungary",
  "Ráckevei út 083/2 hrsz. 083/2",
  "8621 Zamárdi, Petőfi Sándor utca 120/B",
  "1051 Budapest, Október 6. utca 12. 3/14",
];
for (const a of clean) {
  const v = checkLeadContact({ address: a });
  ok(v.ok, `átmegy: „${a}"`, JSON.stringify(v));
}
for (const [inp, out] of [["Magyarország", "HU"], ["MAGYARORSZÁG", "HU"], ["hu", "HU"], ["HU", "HU"], ["at", "AT"]] as const) {
  const v = checkLeadContact({ country: inp });
  ok(v.ok && v.country === out, `ország „${inp}" → ${out}`, JSON.stringify(v));
}
ok(!checkLeadContact({ country: "Hungaryy" }).ok, "ismeretlen, nem ISO-2 ország elutasítva");
ok(checkLeadContact({}).ok && checkLeadContact({ address: "", country: "" }).ok, "üres mezők (törlés) átmennek");

// ── ② mentés, saját fixture-ön ───────────────────────────────────────────────
console.log("② saveLeadEdits — mindent-vagy-semmit");
const parent = await createFixtureParent(db, "leadcontact");
try {
  const original = { name: "Őr-teszt Vendégház", city: "Köveskál", country: "HU", phone: "06 70 000 0000" };
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: parent.runId,
      name: original.name,
      address: null,
      raw: JSON.stringify(original),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const read = async () =>
    db.selectFrom("lead").select(["address", "raw"]).where("id", "=", lead.id).executeTakeFirstOrThrow();

  // The exact package the browser autofill wrote on 2026-09-26 (Három Huszár).
  const autofill = {
    phone: "06 30 000 0001",
    emails: ["tesztelo@example.com"],
    country: "Magyarország",
    address: "Ráckevei út 083/2 hrsz., 24393470213",
  };
  const r1 = (await saveLeadEdits(lead.id, autofill, new Date())) as { ok?: boolean } | undefined;
  const after1 = await read();
  const raw1 = after1.raw as Record<string, unknown>;
  ok(r1?.ok === false, "az autofill-csomag mentése ELUTASÍTVA", JSON.stringify(r1));
  ok(after1.address === null && raw1.address === undefined, "a cím NEM íródott be", String(after1.address ?? raw1.address));
  ok(raw1.phone === original.phone && raw1.email === undefined, "telefon/e-mail sem (mindent-vagy-semmit)", JSON.stringify(raw1));
  ok(raw1.curatorEditedAt === undefined && raw1.scrapedContact === undefined, "nincs szerkesztés-bélyeg", JSON.stringify(raw1));

  const r2 = (await saveLeadEdits(
    lead.id,
    { address: "8274 Köveskál, Fő u. 24.", country: "magyarország" },
    new Date(),
  )) as { ok?: boolean } | undefined;
  const after2 = await read();
  const raw2 = after2.raw as Record<string, unknown>;
  ok(r2?.ok === true, "jó cím mentése átmegy", JSON.stringify(r2));
  ok(after2.address === "8274 Köveskál, Fő u. 24." && raw2.address === "8274 Köveskál, Fő u. 24.", "a cím oszlopban és raw-ban is", JSON.stringify(after2));
  ok(raw2.country === "HU", "az ország ISO-2-ként áll (nem „MAGYARORSZÁG”)", String(raw2.country));

  // ⑤ e-mail list (ADR-0321)
  console.log("⑤ e-mail-lista mentése — elsődleges + további, mindent-vagy-semmit");
  const r3 = await saveLeadEdits(lead.id, { emails: ["agrogere@gmail.com", "ezustnyar@outlook.hu; info@ezustnyar.hu"] }, new Date());
  const raw3 = (await read()).raw as Record<string, unknown>;
  ok(r3.ok === true, "érvényes lista mentése átmegy", JSON.stringify(r3));
  ok(raw3.email === "agrogere@gmail.com", "az ELSŐ cím az elsődleges (raw.email)", String(raw3.email));
  ok(JSON.stringify(raw3.otherEmails) === JSON.stringify(["ezustnyar@outlook.hu", "info@ezustnyar.hu"]), "a többi raw.otherEmails, sorrendben (egy sorba beillesztett lista is bomlik)", JSON.stringify(raw3.otherEmails));
  const r4 = await saveLeadEdits(lead.id, { emails: ["uj@ezustnyar.hu", "rossz@cím"], city: "Tihany" }, new Date());
  const raw4 = (await read()).raw as Record<string, unknown>;
  ok(r4.ok === false, "egy hibás cím → a mentés ELUTASÍTVA", JSON.stringify(r4));
  ok(raw4.email === "agrogere@gmail.com" && raw4.city === "Köveskál", "semmi nem íródott (sem a lista, sem a város)", JSON.stringify(raw4));
  const r5 = await saveLeadEdits(lead.id, { emails: ["Info@EzustNyar.hu", "info+x@ezustnyar.hu"] }, new Date());
  ok(r5.ok === false, "ugyanaz a postafiók kétszer (kisbetű, +címke) → elutasítva", JSON.stringify(r5));
  {
    const html = leadPage({
      id: lead.id, name: original.name, qualification: null, lifecycle: "new", matchConfidence: 0.9,
      address: null, region: "teszt", raw: raw3, provenance: [], artifacts: [], heroScores: {},
    } as unknown as Parameters<typeof leadPage>[0]);
    // The <template> row is the page script's blueprint for "+ További e-mail" — inert,
    // never submitted — so it is cut before measuring what the form carries.
    const live = html.replace(/<template>[\s\S]*?<\/template>/gu, "");
    const vals = [...live.matchAll(/<input[^>]*\bname="email"[^>]*\bvalue="([^"]*)"/gu)].map((m) => m[1]);
    ok(JSON.stringify(vals) === JSON.stringify(["agrogere@gmail.com", "ezustnyar@outlook.hu", "info@ezustnyar.hu"]), "az űrlap soronként mutatja, az elsődleges elöl", JSON.stringify(vals));
    ok(/name="emailPrimary" value="0" checked/u.test(html), "az első sor a „Megkeresés ide”", "");
    ok(/con-band-more[^>]*>\+2</u.test(html), "a fejléc-sáv: elsődleges + „+2”", "");
  }
  const r6 = await saveLeadEdits(lead.id, { emails: [""] }, new Date());
  const raw6 = (await read()).raw as Record<string, unknown>;
  ok(r6.ok === true && raw6.email === undefined && raw6.otherEmails === undefined, "üres lista mindkét mezőt törli", JSON.stringify(raw6));
  ok(typeof raw6.emailCuratedAt === "string" && curatorOwnsEmail(raw6), "a kiürítés kurátori döntésként bélyegzett (az újragyűjtés nem tölti vissza)", JSON.stringify(raw6));
} finally {
  await parent.drop();
}

// ── ④ e-mail szabály ─────────────────────────────────────────────────────────
console.log("④ e-mail-szabály (leadEmails.ts) — a mai formátum, címenként");
{
  const v = checkEmailList(["ezustnyar@outlook.hu; agrogere@gmail.com"]);
  ok(v.ok && v.emails.length === 2, "a tulaj sora („a; b”) két cím", JSON.stringify(v));
  ok(checkEmailList(["foglalas@ezustnyar"]).ok, "pont nélküli domain ÁTMEGY (mai szabály; tulaj: nincs szigorúbb formátum)");
  for (const bad of ["rossz.cim.hu", "a@@b.hu", "${t}@${e}`,y=()=", "rossz@cím.hu"]) {
    ok(!checkEmailList([bad]).ok, `elutasítva: „${bad}”`, JSON.stringify(checkEmailList([bad])));
  }
  ok(!checkEmailList(["info@a.hu", "INFO+x@A.hu"]).ok, "ugyanaz a postafiók kétszer elutasítva");
  ok(JSON.stringify(splitEmailList("info@erdodibirtok.hu&quot;")) === JSON.stringify(["info@erdodibirtok.hu"]), "a HTML-entitás „;”-je nem vágja ketté a címet", JSON.stringify(splitEmailList("info@erdodibirtok.hu&quot;")));
  ok(JSON.stringify(leadEmails({ email: "a@x.hu", otherEmails: ["A@x.hu", "b@x.hu"] })) === JSON.stringify(["a@x.hu", "b@x.hu"]), "leadEmails: elsődleges elöl, postafiók egyszer");
}

// ── ⑥ kurátori e-mail ────────────────────────────────────────────────────────
console.log("⑥ az újragyűjtés nem írja felül a kurátori e-mailt (curatorEmail.ts)");
{
  const cur = { email: "tulaj@gmail.com", otherEmails: ["b@x.hu"], contactChannel: "email", curatorEditedAt: "2026-10-04T00:00:00Z", scrapedContact: { email: "regi@x.hu" } };
  const swapped = keepCuratorEmail(cur, { ...cur, email: "info@talalt.hu", otherEmails: undefined, contactChannel: "email" });
  ok(swapped.email === "tulaj@gmail.com" && JSON.stringify(swapped.otherEmails) === '["b@x.hu"]', "csere/törlés visszaáll a kurátor listájára", JSON.stringify(swapped));
  const cleared = { curatorEditedAt: "2026-10-04T00:00:00Z", scrapedContact: { email: "regi@x.hu" }, contactChannel: "sms", phone: "06301234567" };
  ok(curatorOwnsEmail(cleared) && keepCuratorEmail(cleared, { ...cleared, email: "regi@x.hu", contactChannel: "email" }).email === undefined, "a kurátor által TÖRÖLT címet nem tölti vissza");
  const gap = { curatorEditedAt: "2026-10-04T00:00:00Z", scrapedContact: { email: null } };
  ok(!curatorOwnsEmail(gap) && keepCuratorEmail(gap, { ...gap, email: "uj@x.hu" }).email === "uj@x.hu", "soha nem volt címe → a hiányt pótolhatja");
  ok(!curatorOwnsEmail({ email: "s@x.hu" }), "kurátor nélküli lead: a scraper dolga marad");
  // KB-őr lelete (2026-10-04): cím nélkül gyűjtött lead, a kurátor beírt, majd kiürített egy címet.
  const clearedLater = { curatorEditedAt: "2026-10-04T00:00:00Z", emailCuratedAt: "2026-10-04T01:00:00Z", scrapedContact: { email: null } };
  ok(keepCuratorEmail(clearedLater, { ...clearedLater, email: "talalt@x.hu" }).email === undefined, "a kurátor kiürítése (eredetileg cím nélküli lead) sem töltődik vissza");
}

// ── ⑦ követett link: előtöltés csak egycímes leadnél ───────────────────────────
console.log("⑦ „Követett link készítése” — előtöltés csak egycímes leadnél");
{
  const page = (raw: Record<string, unknown>) =>
    leadPage({
      id: "11111111-2222-3333-4444-555555555555", name: "Őr-teszt Vendégház", qualification: "no_site",
      lifecycle: "mock_curation", matchConfidence: 0.9, address: null, region: "teszt", raw, provenance: [],
      artifacts: [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", status: "approved", path: null, inputs: {}, generatedAt: "2026-10-04T08:00:00Z", decisions: [] }],
      heroScores: {},
    } as unknown as Parameters<typeof leadPage>[0]);
  const recipient = (html: string): string | null => {
    const form = /<form[^>]*action="\/lead\/[^"]+\/prospect"[^>]*>([\s\S]*?)<\/form>/u.exec(html);
    if (!form) return null;
    const input = /<input[^>]*\bname="email"[^>]*>/u.exec(form[1] ?? "")?.[0] ?? "";
    return /\bvalue="([^"]*)"/u.exec(input)?.[1] ?? "";
  };
  const one = recipient(page({ email: "tulaj@ezustnyar.hu" }));
  ok(one !== null, "a követett-link űrlap a lapon van (különben a mérés üres halmazon állna)");
  ok(one === "tulaj@ezustnyar.hu", "egycímes lead: a címzett ELŐTÖLTVE az elsődlegessel", String(one));
  const many = recipient(page({ email: "tulaj@ezustnyar.hu", otherEmails: ["foglalas@ezustnyar.hu"] }));
  ok(many === "", "többcímes lead: a címzett ÜRES (az operátor választ)", String(many));
  const none = recipient(page({}));
  ok(none === "", "cím nélküli lead: a címzett üres", String(none));
}

// ── ③ az űrlap ───────────────────────────────────────────────────────────────
console.log("③ „Adatok” űrlap — nincs böngésző-kitöltés");
{
  const html = leadPage({
    id: "11111111-2222-3333-4444-555555555555",
    name: "Őr-teszt Vendégház",
    qualification: null,
    lifecycle: "new",
    matchConfidence: 0.9,
    address: "Teszt utca 1.",
    region: "teszt",
    raw: {},
    provenance: [],
    artifacts: [],
    heroScores: {},
  } as unknown as Parameters<typeof leadPage>[0]);
  const form = /<form[^>]*action="\/lead\/[^"]+\/data"[^>]*>([\s\S]*?)<\/form>/u.exec(html);
  ok(Boolean(form), "az adat-űrlap a lapon van (különben a mérés üres halmazon állna)");
  const tag = form ? form[0].slice(0, form[0].indexOf(">") + 1) : "";
  ok(/\bautocomplete="off"/u.test(tag), "a form autocomplete=\"off\"", tag);
  const STANDARD = /^(on|name|email|tel|tel-national|street-address|address-line\d|country|country-name|postal-code|address-level\d|organization|url)$/u;
  for (const f of ["address", "country", "phone", "email", "city"]) {
    const input = new RegExp(`<input[^>]*\\bname="${f}"[^>]*>`, "u").exec(form?.[1] ?? "")?.[0] ?? "";
    const ac = /\bautocomplete="([^"]*)"/u.exec(input)?.[1];
    ok(Boolean(input) && Boolean(ac) && !STANDARD.test(ac ?? ""), `„${f}” mező: nem szabványos autocomplete-token`, input || "nincs mező");
  }
}

await pool.end();
if (fails) {
  console.log(`\n⛔ ${fails} hiba — a lead nyilvános elérhetősége (cím, ország, e-mail-lista) hibásan menthető, vagy az újragyűjtés felülírja a kurátorét.`);
  process.exit(1);
}
console.log("\n✅ lead-elérhetőség őr: zöld");
