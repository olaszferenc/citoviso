// Single source of database access — the shared pool + Kysely instance.
// Everything DB-touching imports `db` (or `pool`) from here; never construct a
// second pool (mirrors the MineREAL "use the one shared $db" rule).
//
// Connection: DATABASE_URL wins (prod/managed cloud). With it empty we fall back
// to the local embedded cluster (unix socket) defined in config.pg — so local
// dev needs zero env setup.

import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { config } from "../config.js";
import type { Database } from "./schema.js";

// DATE columns come back as plain 'YYYY-MM-DD' strings — exactly what schema.ts
// declares. Without this the driver parses them into LOCAL-midnight Date objects,
// and every toISOString() lands one day EARLIER (UTC+2): measured 2026-09-06 on
// the Foglalások tab, where a Sept 18 arrival rendered as Sept 17 — and the same
// shift silently reached the guest-facing booking mails. A calendar day is a
// label, not an instant; it must never pass through a timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);

function poolConfig(): pg.PoolConfig {
  if (config.databaseUrl) return { connectionString: config.databaseUrl };
  return {
    host: config.pg.host,
    port: config.pg.port,
    user: config.pg.user,
    password: config.pg.password || undefined,
    database: config.pg.database,
  };
}

export const pool = new pg.Pool(poolConfig());

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
