// Tiny migration runner — no third-party migration tool by design.
// Applies migrations/*.sql in filename order, each in its own transaction, and
// records applied files in schema_migrations. Idempotent: already-applied files
// are skipped. The SQL files are the schema's source of truth.
//
// Run: npm run db:migrate

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./client.js";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations",
    );
    const applied = new Set(rows.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.log(`  apply  ${file}`);
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(
          `Migration ${file} failed: ${(err as Error).message}`,
        );
      }
    }
    console.log(ran === 0 ? "Up to date." : `Applied ${ran} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
