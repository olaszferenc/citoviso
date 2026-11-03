// One-time setup of the platform Search Console property sc-domain:citoviso.com (ADR-0415).
// The tick (scripts/search-console-tick.mts) never verifies citoviso.com itself — it waits
// for this script's DB row. Run it ON THE HOST whose DB the tick uses (the live VPS for prod).
//
//   npx tsx scripts/search-console-setup.mts status
//       Prints the service account, the key, the DB row, and the TXT record citoviso.com
//       needs (Site Verification getToken — read-only at Google, writes nothing anywhere).
//
//   npx tsx scripts/search-console-setup.mts add-txt --go
//       ⛔ LIVE DNS: adds that TXT to the citoviso.com zone on Cloudflare (CLOUDFLARE_API_TOKEN).
//       Additive only — no existing record is changed or removed. Needs the owner's/coordinator's
//       explicit permission (CLAUDE.md §0). Without --go: prints what it would do.
//
//   npx tsx scripts/search-console-setup.mts verify
//       Either path ends here:
//         A) the TXT is in DNS → Site Verification insert (the service account becomes a
//            verified owner; SEARCH_CONSOLE_OWNER_EMAILS are recorded as co-owners);
//         B) the owner already added the service account as an owner in the Search Console UI
//            → sites.get answers siteOwner, nothing to verify.
//       Then sites.add, and the property row is written → the tick starts submitting.
//
// Off the live host the recording mock answers (dev: marks the dev DB row, no Google call).

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { isLiveHost } from "../src/invoicing/keyGuard.js";
import { googleClient, loadServiceAccountKey, mockClient, type SearchConsoleClient } from "../src/visibility/googleSearchConsole.js";

const [cmd, ...rest] = process.argv.slice(2);
const go = rest.includes("--go");
const property = config.searchConsolePlatformProperty;
const domain = property.replace(/^sc-domain:/, "");
const live = isLiveHost(config.publicBaseUrl);

async function client(): Promise<{ c: SearchConsoleClient; email: string }> {
  const key = await loadServiceAccountKey(config.searchConsoleKeyFile);
  if (!key) {
    console.error(`⛔ nincs service-account kulcs: ${config.searchConsoleKeyFile}`);
    process.exit(1);
  }
  // getToken is read-only, so `status` may ask the real API from dev as well; everything
  // that changes state at Google runs through the live gate.
  const real = googleClient(key);
  return { c: live || cmd === "status" || cmd === "add-txt" ? real : mockClient(), email: key.client_email };
}

async function cloudflare(path: string, init?: RequestInit): Promise<{ success: boolean; result: unknown; errors?: unknown }> {
  const token = config.domains.cloudflare.apiToken;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN hiányzik");
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as { success: boolean; result: unknown; errors?: unknown };
}

async function token(c: SearchConsoleClient): Promise<string> {
  const row = await db.selectFrom("search_console_property").select("verify_token").where("property", "=", property).executeTakeFirst();
  if (row?.verify_token) return row.verify_token;
  const t = await c.getDomainToken(domain);
  if (!t.ok || !t.token) {
    console.error(`⛔ getToken: HTTP ${t.status} ${t.detail}`);
    process.exit(1);
  }
  await db
    .insertInto("search_console_property")
    .values({ property, kind: "platform", verify_token: t.token })
    .onConflict((oc) => oc.column("property").doUpdateSet({ verify_token: t.token, updated_at: new Date() }))
    .execute();
  return t.token;
}

if (cmd === "status") {
  const { c, email } = await client();
  const row = await db.selectFrom("search_console_property").selectAll().where("property", "=", property).executeTakeFirst();
  console.log(`hoszt:            ${live ? "ÉLES" : "dev (a verify a mockon fut)"}`);
  console.log(`service account:  ${email}`);
  console.log(`tulajdon:         ${property}`);
  console.log(`DB-sor:           ${row ? `ellenőrizve: ${row.verified_at ?? "—"} · hozzáadva: ${row.added_at ?? "—"}` : "nincs"}`);
  const g = await c.getSite(property);
  console.log(`Search Console:   ${g.ok ? `a service account jogosultsága: ${g.permission}` : `a service account nem látja (HTTP ${g.status})`}`);
  console.log(`szükséges TXT:    ${domain}  TXT  "${await token(c)}"`);
} else if (cmd === "add-txt") {
  const { c } = await client();
  const content = await token(c);
  const zones = await cloudflare(`/zones?name=${encodeURIComponent(domain)}`);
  const zone = (zones.result as { id: string }[] | null)?.[0];
  if (!zones.success || !zone) {
    console.error(`⛔ Cloudflare: a(z) ${domain} zóna nem található (${JSON.stringify(zones.errors)})`);
    process.exit(1);
  }
  const existing = await cloudflare(`/zones/${zone.id}/dns_records?type=TXT&name=${encodeURIComponent(domain)}`);
  const has = ((existing.result as { content: string }[] | null) ?? []).some((r) => r.content.replace(/^"+|"+$/g, "") === content);
  if (has) {
    console.log(`✓ a TXT már a zónában van — jöhet a verify`);
  } else if (!go) {
    console.log(`(száraz futás) felvenném: ${domain} TXT "${content}" (Cloudflare zóna ${zone.id}) — élesítéshez: --go`);
  } else {
    const r = await cloudflare(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify({ type: "TXT", name: domain, content, ttl: 300, comment: "Google Search Console (Citoviso ADR-0415)" }),
    });
    if (!r.success) {
      console.error(`⛔ Cloudflare TXT: ${JSON.stringify(r.errors)}`);
      process.exit(1);
    }
    console.log(`✓ TXT felvéve — pár perc múlva: npx tsx scripts/search-console-setup.mts verify`);
  }
} else if (cmd === "verify") {
  const { c } = await client();
  const owners = config.searchConsoleOwnerEmails.split(",").map((s) => s.trim()).filter(Boolean);
  const now = new Date();
  const already = await c.getSite(property);
  if (already.ok && already.permission === "siteOwner") {
    console.log(`✓ a service account már tulajdonos (B út: a tulaj vette fel)`);
  } else {
    await token(c);
    const v = await c.verifyDomain(domain, owners);
    if (!v.ok) {
      console.error(`⛔ verify: HTTP ${v.status} ${v.detail}\n   (A TXT még nem terjedt el, vagy nincs a zónában — status / add-txt.)`);
      process.exit(1);
    }
    console.log(`✓ ellenőrizve (A út: DNS TXT)${owners.length ? ` · társtulajdonos: ${owners.join(", ")}` : ""}`);
  }
  const a = await c.addSite(property);
  if (!a.ok) {
    console.error(`⛔ sites.add: HTTP ${a.status} ${a.detail}`);
    process.exit(1);
  }
  await db
    .insertInto("search_console_property")
    .values({ property, kind: "platform", verified_at: now, added_at: now })
    .onConflict((oc) => oc.column("property").doUpdateSet({ verified_at: now, added_at: now, last_error: null, updated_at: now }))
    .execute();
  console.log(`✓ ${property} kész${c.live ? "" : " (MOCK — dev DB)"} — az időzítő a következő futásnál beküld`);
} else {
  console.error("használat: search-console-setup.mts status | add-txt [--go] | verify");
  process.exit(2);
}
await db.destroy();
