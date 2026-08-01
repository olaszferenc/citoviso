// Create or reset an internal console operator (control-plane realm, 0014).
//   npx tsx scripts/operator-user.ts <username> "<Display Name>"
// Generates a memorable password (same style as tenant logins), upserts the
// user, and prints the credentials ONCE — only the scrypt hash is stored.

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { generateMemorablePassword, hashPassword } from "../src/auth/tenantAuth.js";

async function main(): Promise<void> {
  const [username, displayName] = process.argv.slice(2);
  if (!username) {
    console.error('Használat: tsx scripts/operator-user.ts <felhasznalonev> "<Megjelenő név>"');
    process.exit(1);
  }
  const password = generateMemorablePassword();
  const password_hash = hashPassword(password);
  const existing = await db
    .selectFrom("operator_user")
    .select("id")
    .where(sql<boolean>`lower(username) = ${username.toLowerCase()}`)
    .executeTakeFirst();
  if (existing) {
    await db
      .updateTable("operator_user")
      .set({ password_hash, ...(displayName ? { display_name: displayName } : {}) })
      .where("id", "=", existing.id)
      .execute();
    console.log(`Operátor frissítve: ${username}`);
  } else {
    await db
      .insertInto("operator_user")
      .values({ username, display_name: displayName ?? username, password_hash })
      .execute();
    console.log(`Operátor létrehozva: ${username}`);
  }
  console.log(`  Belépés: http://<konzol>/belepes`);
  console.log(`  Felhasználónév: ${username}`);
  console.log(`  Jelszó: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
