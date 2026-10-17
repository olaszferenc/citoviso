// The tenant custom domains the edge must serve over HTTPS — one per line, for the ROOT
// certificate job (deploy/tenant-tls/citoviso-tenant-tls.sh, ADR-0394).
//
//   npx tsx scripts/tenant-tls-domains.mts
//
// WHY a separate list: the certificate job runs as root (certbot + nginx reload) and must
// not touch the database itself; the app user prints the names, root only consumes them.
// A name is listed while it NEEDS a certificate (tls_pending: the provisioning waits for
// one) or HAS a live site behind it (custom_domain set — a hand-connected name included).
// Only syntactically clean, non-platform names are printed; a non-zero exit means "the
// list is unknown", and the job then changes nothing (it never reads an error as "empty").
import { sql } from "kysely";
import { db } from "../src/db/client.js";

const NAME = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const pending = await db
  .selectFrom("domain_provisioning")
  .select(sql<string>`lower(domain)`.as("domain"))
  .where("status", "=", "tls_pending")
  .execute();
const live = await db
  .selectFrom("site")
  .select(sql<string>`lower(custom_domain)`.as("domain"))
  .where("custom_domain", "is not", null)
  .execute();

const names = new Set<string>();
for (const r of [...pending, ...live]) {
  const d = (r.domain ?? "").trim().replace(/^www\./, "");
  if (!NAME.test(d) || d === "citoviso.com" || d.endsWith(".citoviso.com")) continue;
  names.add(d);
}
for (const d of [...names].sort()) console.log(d);
await db.destroy();
