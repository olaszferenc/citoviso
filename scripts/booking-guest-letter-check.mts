// Vendég-levelek (Elek-foglaló F-4 · F-7, 2026-10-14):
//   F-4 az elutasító levél mindig „A kért időpont sajnos nem szabad”-ot írt, akkor is, ha a
//       szállásadó más indokot adott (pl. férőhely) — indokkal a levél NEM állít foglaltságot,
//       hanem a szállásadó indokát mutatja; indok nélkül marad a régi mondat (negatív kontroll).
//   F-7 a visszaigazoló levél SZÖVEGES részéből hiányzott a szállás címe (és a hivatkozás).
// Futtatás: npx tsx scripts/booking-guest-letter-check.mts
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setBasePrice } = await import("../src/tenant/prices.js");
const { createUnit } = await import("../src/tenant/units.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { createBookingRequest, decideRequest } = await import("../src/booking/requests.js");

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 300)}`}`);
  if (!c) fail++;
};
const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};
// The mock outbox keeps only the HTML part — the TEXT part (what Elek's real mail showed) is
// captured at the sender, the same object every letter goes through.
const { getEmailSender } = await import("../src/email/sender.js");
const sent: { to: string; subject: string; text: string; html: string }[] = [];
{
  const sender = getEmailSender();
  const orig = sender.send.bind(sender);
  sender.send = async (m) => {
    sent.push({ to: m.to, subject: m.subject, text: m.text, html: m.html ?? "" });
    return orig(m);
  };
}
async function letterTo(who: string, subject: RegExp): Promise<{ subject: string; text: string; html: string } | null> {
  await new Promise((r) => setTimeout(r, 900));
  return [...sent].reverse().find((m) => m.to.includes(who) && subject.test(m.subject)) ?? null;
}

const ids: Record<string, string> = {};
try {
  const stamp = Date.now().toString(36);
  ids.stamp = stamp;
  const def = await db.insertInto("scraper_definition").values({ label: "_bgl", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_bgl lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Levél Teszt Vendégház" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id, preview_token: `bgl_${stamp}`, slug: `bgl-${stamp}`,
      edited_site_data: JSON.stringify({ name: "Levél Teszt Vendégház", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Levél u. 7.", phone: "+36 30 111 2222", email: `info-${stamp}@example.com` }, businessType: "accommodation" }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;
  await setTenantModules(tenant.id, ["booking", "pricing"]);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: `owner-${stamp}@example.com` }, "test");
  const unit = (await createUnit(site.id, "Vendégház", 4, null))!;
  await setBasePrice(unit, 20000);
  const ask = async (who: string, off: number) => {
    const r = await createBookingRequest(
      { siteId: site.id, unitId: unit, guestName: "Teszt Vendég", guestEmail: who, guestPhone: "+36301112222", dateFrom: iso(off), dateTo: iso(off + 3), guests: 2 },
      null,
    );
    if (!r.ok) throw new Error(`kérés: ${r.errors?.join("; ")}`);
    return (await db.selectFrom("booking_request").select(["action_token", "id"]).where("id", "=", r.id!).executeTakeFirstOrThrow());
  };

  console.log("\nF-4 · elutasítás indokkal");
  {
    const who = `dec-note-${stamp}@example.com`;
    const row = await ask(who, 30);
    await decideRequest(row.action_token, "declined", null, "Sajnos 4 főnél többet nem tudunk fogadni.");
    const m = await letterTo(who, /./);
    check("a levél megjött", Boolean(m));
    check("⭐ a tárgy nem állít foglaltságot", Boolean(m) && !/nem szabad/.test(m!.subject) && /nem tudja fogadni/.test(m!.subject), m?.subject);
    check("⭐ a szöveg nem állítja, hogy az időpont nem szabad", Boolean(m) && !/nem szabad/.test(m!.text), m?.text);
    check("⭐ a szállásadó indoka ott van, magyar záró idézőjellel", Boolean(m) && m!.text.includes("„Sajnos 4 főnél többet nem tudunk fogadni.”"), m?.text);
    check("⭐ a hivatkozás (FG-…) a szövegben", Boolean(m) && /Hivatkozás: FG-[0-9A-F]{6}/.test(m!.text), m?.text);
  }
  console.log("\nF-4 · elutasítás indok nélkül (negatív kontroll)");
  {
    const who = `dec-plain-${stamp}@example.com`;
    const row = await ask(who, 40);
    await decideRequest(row.action_token, "declined", null, null);
    const m = await letterTo(who, /./);
    check("indok nélkül marad: „A kért időpont sajnos nem szabad”", Boolean(m) && /A kért időpont sajnos nem szabad/.test(m!.subject), m?.subject);
  }
  console.log("\nF-7 · a visszaigazoló levél szövegében a szállás címe");
  {
    const who = `acc-${stamp}@example.com`;
    const row = await ask(who, 50);
    await decideRequest(row.action_token, "accepted", null);
    const m = await letterTo(who, /Visszaigazolt foglalás/);
    check("a levél megjött", Boolean(m));
    check("⭐ a szövegben a cím", Boolean(m) && /Cím: 8600 Siófok, Levél u\. 7\./.test(m!.text), m?.text);
    check("⭐ a szövegben a telefon", Boolean(m) && /Telefon: \+36 30 111 2222/.test(m!.text), m?.text);
    check("⭐ a szövegben a hivatkozás", Boolean(m) && /Hivatkozás: FG-[0-9A-F]{6}/.test(m!.text), m?.text);
    check("⭐ a HTML-kártyán is a cím", Boolean(m) && m!.html.includes("8600 Siófok, Levél u. 7."));
  }
  console.log("\nF-7 · az oldalon nincs cím, a leadnek van (Elek-eset: az .ics vitte, a levél nem)");
  {
    await db.updateTable("site").set({ edited_site_data: JSON.stringify({ name: "Levél Teszt Vendégház", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { phone: "+36 30 111 2222" }, businessType: "accommodation" }) }).where("id", "=", ids.siteId!).execute();
    await db.updateTable("lead").set({ address: "8630 Balatonboglár, Lead u. 3." }).where("id", "=", ids.leadId!).execute();
    const who = `acc2-${stamp}@example.com`;
    const row = await ask(who, 60);
    await decideRequest(row.action_token, "accepted", null);
    const m = await letterTo(who, /Visszaigazolt foglalás/);
    check("⭐ a lead címe a szövegben és a kártyán", Boolean(m) && /Cím: 8630 Balatonboglár, Lead u\. 3\./.test(m!.text) && m!.html.includes("8630 Balatonboglár, Lead u. 3."), m?.text);
  }
} finally {
  if (ids.siteId) {
    await db.deleteFrom("availability_day").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("unit_price").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config_history").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ BOOKING-GUEST-LETTER: ${fail} bukás` : "\n🟢 BOOKING-GUEST-LETTER: az elutasítás a szállásadó indokát mondja, a visszaigazolás szövegében ott a cím és a hivatkozás");
process.exit(fail ? 1 : 0);
