// Újrarendereli egy (vagy minden) tenant statikus pillanatképét a MAI adatból.
//
// Miért kell: a publikus oldal `sites/<tenant>/index.html`, és 2026-09-08-ig több
// admin-mentés (egység, ár, modul-beállítás) csak a DB-t írta — a kiszolgált HTML
// ott maradt, ahol az utolsó renderelő mentés hagyta. A route-ok javítva vannak
// (redirectRerendered + scripts/snapshot-propagation-check.mts), de a MÁR ELCSÚSZOTT
// oldalakat valaminek utol kell érnie: ez az.
//
//   npx tsx scripts/rerender-tenant.mts dencs-apartmanhaz
//   npx tsx scripts/rerender-tenant.mts --all
//   npx tsx scripts/rerender-tenant.mts --all --dry     (csak lista, nem ír)

import { db } from "../src/db/client.js";
import { rerenderTenantSnapshot } from "../src/tenant/editor.js";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const all = args.includes("--all");
const target = args.find((a) => !a.startsWith("--"));

if (!all && !target) {
  console.error("Használat: rerender-tenant.mts <slug|tenantId> | --all [--dry]");
  process.exit(2);
}

// A tenant_id UUID oszlop: nem-UUID szöveggel összehasonlítva a Postgres HIBÁRA fut
// (nem üres találat), ezért a slug- és az id-keresés külön ágon megy.
const isUuid = !!target && /^[0-9a-f-]{36}$/i.test(target);

const rows = await db
  .selectFrom("site")
  .select(["site.tenant_id as tenantId", "site.slug as slug", "site.status as status"])
  .$if(!all, (q) =>
    isUuid ? q.where("site.tenant_id", "=", target!) : q.where("site.slug", "=", target!),
  )
  .execute();

if (!rows.length) {
  console.error(`Nincs ilyen szállás: ${target ?? "(all)"}`);
  process.exit(1);
}

let ok = 0;
for (const r of rows) {
  if (dry) {
    console.log(`· ${r.slug} (${r.status}) — renderelném`);
    continue;
  }
  const done = await rerenderTenantSnapshot(r.tenantId);
  console.log(`${done ? "✅" : "⛔"} ${r.slug} (${r.status})`);
  if (done) ok++;
}
console.log(dry ? `${rows.length} szállás` : `Kész: ${ok}/${rows.length}`);
await db.destroy();
