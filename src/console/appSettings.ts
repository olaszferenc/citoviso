// Platform-level settings (0052, ADR-0098/c) — the console /settings page
// edits these; the matching env var stays the machine-level fallback so the
// DB value wins WITHOUT a deploy. Thin by design: two helpers + one typed
// reader per setting group, no cache (the daily tick and a settings page are
// the only readers — a cache would only add staleness).

import { config } from "../config.js";
import { db } from "../db/client.js";

export async function getSetting(key: string): Promise<string | null> {
  const row = await db
    .selectFrom("app_setting")
    .select("value")
    .where("key", "=", key)
    .executeTakeFirst();
  return row?.value ?? null;
}

/** Empty/whitespace value deletes the row → the env fallback takes over again. */
export async function setSetting(key: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) {
    await db.deleteFrom("app_setting").where("key", "=", key).execute();
    return;
  }
  await db
    .insertInto("app_setting")
    .values({ key, value: v })
    .onConflict((oc) =>
      oc.column("key").doUpdateSet({ value: v, updated_at: new Date() }),
    )
    .execute();
}

export interface AlertRecipients {
  /** E.164 phone for alert SMS, or null = SMS channel off. */
  readonly phone: string | null;
  /** Address for alert email, or null = email channel off. */
  readonly email: string | null;
  /** True where the value came from the DB (settings page), not the env. */
  readonly phoneFromDb: boolean;
  readonly emailFromDb: boolean;
}

/** Alert recipients: DB value first, env fallback (phone only — email has no
 *  env twin, it was born on the settings page). */
export async function getAlertRecipients(): Promise<AlertRecipients> {
  const [phone, email] = await Promise.all([
    getSetting("alert_phone"),
    getSetting("alert_email"),
  ]);
  return {
    phone: phone ?? config.ownerAlertPhone ?? null,
    email: email ?? null,
    phoneFromDb: phone !== null,
    emailFromDb: email !== null,
  };
}
