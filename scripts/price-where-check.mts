// Guard: the Árak screen's „Hol látják a vendégek az árait?" box says what the GUEST PAGE
// does (owner ruling 2026-09-28, approved plan design-refs/tenant-admin/price-where-2).
//
// Why it exists: ADR-0059 §2 leaves the price table off the page when the room cards already
// carry the same numbers. The owner pays for the Árak module and saw nothing — so the admin
// now SAYS where the prices are. A sentence about the page is only worth something while it
// is true, and the rule it describes lives in the renderer; this guard checks the two against
// each other on REAL tenants, not on a fixture that would agree with whatever it was fed.
//
// Per tenant with the pricing module and a site:
//  ① the admin box's verdict (data-cit-price-where = table|cards) == the rendered page HAS a
//     price table (a <table> inside data-cit-module="pricing");
//  ② every price chip in the box is a price line the page's room cards really print;
//  ③ every "nincs ára" unit the box lists has NO price line on its page card, and a unit
//     marked "no price anywhere" is not in the page's price table either;
//  ④ both verdicts must occur across the measured tenants — one branch alone would make
//     ① green for a box that never changes its mind.
// Read-only: GET pages only, nothing is written.
// Run: npx tsx scripts/price-where-check.mts [--self-test]  (self-test flips the verdict → RED)

process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { request } from "node:http";

/** GET through node:http — fetch() drops a hand-set Host header, and the admin lives on the platform host. */
function get(port: number, path: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const r = request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    r.on("error", reject);
    r.end();
  });
}

const SELF_TEST = process.argv.includes("--self-test");
const { server } = await import("../src/server/public.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { db } = await import("../src/db/client.js");
const { effectiveSiteForMultilang } = await import("../src/tenant/editor.js");
const { renderSite } = await import("../src/engine/render.js");
const { PLATFORM_DOMAIN } = await import("../src/domains.js");

let failed = 0;
const ok = (c: boolean, m: string, d = ""): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${m}${d && !c ? `\n     ↳ ${d}` : ""}`);
  if (!c) failed++;
};

if (!server.listening) await once(server, "listening");
const PORT = (server.address() as { port: number }).port;

// Named subjects (ADR-0252): every tenant that has a site, a login and the pricing module on.
const subjects = await db
  .selectFrom("tenant_user as tu")
  .innerJoin("site as s", "s.tenant_id", "tu.tenant_id")
  .innerJoin("module_entitlement as e", "e.tenant_id", "tu.tenant_id")
  .select(["tu.id as userId", "tu.tenant_id as tenantId", "s.slug as slug"])
  .where("e.module", "=", "pricing")
  .where("e.active", "=", true)
  .orderBy("s.slug")
  .execute();

const seen = { table: 0, cards: 0 };
const decode = (x: string): string =>
  x.replace(/&nbsp;| /g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

try {
  for (const sub of subjects) {
    const eff = await effectiveSiteForMultilang(sub.tenantId);
    if (!eff) {
      console.log(`⚠️  ${sub.slug}: nincs lap-adat — KIHAGYVA (hangosan)`);
      continue;
    }
    console.log(`\n── ${sub.slug}`);
    const page = decode(
      renderSite(eff.site.recipe, eff.effective, { phase: "live", hideGallery: eff.hideGallery }),
    );
    const sec = /<section[^>]*data-cit-module="pricing"[\s\S]*?<\/section>/.exec(page)?.[0] ?? "";
    const pageHasTable = /<table/.test(sec);

    const res = await get(PORT, "/admin?tab=modulok&m=pricing", {
      host: PLATFORM_DOMAIN,
      cookie: `cit_session=${mintTenantCookieValue(sub.userId)}`,
    });
    const admin = decode(res.body);
    const box = /<div class="pr-where" data-cit-price-where="(table|cards)">([\s\S]*?)<\/div>\s*(?=<div class="adm-card"|<script|$)/.exec(admin);
    if (!box) {
      ok(false, `${sub.slug}: a doboz megjelent az Árak képernyőn`, `HTTP ${res.status}`);
      continue;
    }
    const says = box[1] === "table";
    seen[says ? "table" : "cards"]++;
    ok(
      SELF_TEST ? says !== pageHasTable : says === pageHasTable,
      `① a doboz szerint ${says ? "VAN" : "NINCS"} ártáblázat — a lapon ${pageHasTable ? "VAN" : "NINCS"}`,
    );

    const chips = [...box[2].matchAll(/<span>([^<]+?) <b>([^<]+)<\/b><\/span>/g)].map((m) => ({ name: m[1]!.trim(), price: m[2]!.trim() }));
    for (const c of chips) {
      ok(page.includes(c.price), `② „${c.name}: ${c.price}” a lap kártyáin is így áll`);
    }

    const rooms = eff.effective.rooms ?? [];
    const tableNames = new Set((eff.effective.pricing?.units ?? []).map((u) => u.name));
    const listed = [...box[2].matchAll(/<a href="#ar-([^"]+)">([^<]+)<\/a>/g)].map((m) => ({ id: m[1]!, name: m[2]! }));
    for (const u of listed) {
      const r = rooms.find((x) => x.unitId === u.id);
      ok(Boolean(r) && !r!.price, `③ „${u.name}” ár nélkülinek mondva — a lap kártyáján tényleg nincs ár-sor`);
      const nowhere = new RegExp(`id="ar-${u.id}"[\\s\\S]*?data-cit-price-nowhere`).test(admin);
      if (nowhere) ok(!tableNames.has(u.name), `③ „${u.name}”: „az ártáblázatban sem szerepel” — a táblában tényleg nincs`);
    }
  }
  ok(seen.table > 0 && seen.cards > 0, `④ mindkét ítélet előfordult (van tábla: ${seen.table} · csak kártyák: ${seen.cards})`,
    "a dev DB-ben az egyik ág nincs képviselve — az ① egyirányú lenne");
} finally {
  server.close();
  await db.destroy();
}

if (failed) {
  console.error(`\n⛔ price-where-check: ${failed} bukás`);
  process.exit(1);
}
console.log(`\n✅ price-where-check: az Árak képernyő tájékoztatása azt mondja, amit a lap csinál (${subjects.length} bérlő).`);
