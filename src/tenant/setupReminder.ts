// ADR-0429 — the weekly setup reminder AFTER the first login (before it, ADR-0417 speaks).
// Approved plan: assets/design-refs/tenant-admin/modul-statusz/ README §6.
//
// It names the open setup topics the registry allows (src/tenant/moduleSetup.ts remindTopics)
// and leads to the walk („Folytatom a beállítást”). Nothing open → nothing goes out.
// The episode lives on site_setup_progress item "_remind" (draft.since / draft.last), so no
// new column: ① a site with something open starts an episode; ② after 7 days, and 7 days after
// the last mail, ONE mail is claimed and sent; ③ nothing open → the episode ends.
//
// ⛔ Never to a „ne keressük” lead (ADR-0421). ⛔ Not when the weekly price-gap mail goes to the
// same site (that mail carries the same list — one letter, not two).

import { config } from "../config.js";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "./messages.js";
import { loadSetupCtx, remindTopics } from "./moduleSetup.js";

const DAY_MS = 86_400_000;
export const SETUP_REMIND_DAYS = 7;

/** The list + the way back, as the price-gap mail appends it (one source for both letters). */
export async function setupReminderLines(tenantId: string, siteId: string, lang: string): Promise<{ lines: string[]; url: string }> {
  const ctx = await loadSetupCtx(tenantId, siteId);
  return {
    lines: remindTopics(ctx, lang).map((v) => `• ${v.topic.title(lang)} — ${v.status.line}`),
    url: `${config.publicSiteUrl.replace(/\/$/, "")}/admin/beallitas`,
  };
}

export async function maintainSetupReminders(
  now: Date = new Date(),
  opts: { readonly onlySiteId?: string } = {},
): Promise<{ started: number; ended: number; reminded: number }> {
  const sites = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .leftJoin("lead", "lead.id", "tenant.lead_id")
    .select(["site.id", "site.tenant_id", "site.price_gap_since", "lead.contact_block_at"])
    .where("site.status", "=", "live")
    .$if(Boolean(opts.onlySiteId), (q) => q.where("site.id", "=", opts.onlySiteId!))
    .execute();
  let started = 0;
  let ended = 0;
  let reminded = 0;
  for (const s of sites) {
    // After the first login only: before it the ADR-0417 login reminder speaks.
    const loggedIn = await db
      .selectFrom("tenant_user")
      .select("id")
      .where("tenant_id", "=", s.tenant_id)
      .where((eb) => eb.or([eb("last_login_at", "is not", null), eb("password_set_at", "is not", null)]))
      .executeTakeFirst();
    const row = await db
      .selectFrom("site_setup_progress")
      .select(["draft"])
      .where("site_id", "=", s.id)
      .where("item", "=", "_remind")
      .executeTakeFirst();
    const ep = (row?.draft ?? {}) as { since?: string | null; last?: string | null };
    const lang = await prepareMailLang(await langForTenant(s.tenant_id));
    const { lines, url } = await setupReminderLines(s.tenant_id, s.id, lang);
    const save = async (draft: Record<string, unknown>): Promise<void> => {
      await db
        .insertInto("site_setup_progress")
        .values({ site_id: s.id, item: "_remind", draft: JSON.stringify(draft) })
        .onConflict((oc) => oc.columns(["site_id", "item"]).doUpdateSet({ draft: JSON.stringify(draft), updated_at: now }))
        .execute();
    };
    if (!lines.length || !loggedIn || s.contact_block_at) {
      if (ep.since) {
        await save({ since: null, last: null });
        ended++;
      }
      continue;
    }
    if (!ep.since) {
      await save({ since: now.toISOString(), last: null });
      started++;
      continue;
    }
    if (now.getTime() - new Date(ep.since).getTime() < SETUP_REMIND_DAYS * DAY_MS) continue;
    if (ep.last && now.getTime() - new Date(ep.last).getTime() < SETUP_REMIND_DAYS * DAY_MS) continue;
    // The price-gap mail of this week carries the same list — one letter, not two.
    if (s.price_gap_since) continue;
    await save({ since: ep.since, last: now.toISOString() });
    try {
      await sendSetupReminder(s.tenant_id, lines, url);
      reminded++;
    } catch (err) {
      console.error(`[setup-remind] az emlékeztető NEM ment ki (${s.id}):`, err); // i18n-exempt: operátori napló
    }
  }
  return { started, ended, reminded };
}

async function sendSetupReminder(tenantId: string, lines: readonly string[], url: string): Promise<void> {
  const user = await db.selectFrom("tenant_user").select(["contact_email"]).where("tenant_id", "=", tenantId).executeTakeFirst();
  if (!user?.contact_email) return;
  const lang = await prepareMailLang(await langForTenant(tenantId));
  const subject = T(lang, "Még {n} dolog hiányzik a honlapja beállításából", { n: lines.length });
  const text =
    T(lang, "Kedves Partnerünk!") +
    "\n\n" +
    T(lang, "A honlapja él, de ezek még nincsenek beállítva:") +
    `\n\n${lines.join("\n")}\n\n` +
    T(lang, "Lépésről lépésre végigvezetjük, ott folytathatja, ahol abbahagyta:") +
    `\n${url}\n\n` +
    T(lang, "Hetente emlékeztetjük, amíg minden be nem állít. Ami nem kötelező, azt a beállításban kihagyhatja.") +
    "\n\n" +
    T(lang, "Üdvözlettel,") +
    "\nCitoviso";
  await getEmailSender().send({ to: user.contact_email, audience: "platform", subject, text });
  await logTenantMessage({ tenantId, channel: "email", kind: "booking", subject, bodyText: text, recipient: user.contact_email });
}
