// Owner mails of the portal calendar sync (ADR-0367, Elek 2026-10-11 K1 · K7).
//
// Both go out in the existing owner-letter frame (ownerLetter: the platform frame,
// the property's name, the Foglalások button) and are logged to the tenant's message
// list, like every other owner-facing booking mail.
//
//   K1 — a portal sold a night an ACCEPTED booking of ours already holds. We decide for
//        neither guest (nothing is deleted); the owner hears it once per conflict.
//   K7 — a link has been failing for a day: new portal bookings no longer reach us,
//        and the owner would only learn it by opening the admin.

import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { mailDetails, mailNote, mailPara } from "../email/platformLayout.js";
import { mailLabel } from "../email/bookingLayout.js";
import { T } from "../i18n/mail.js";
import { huArticle, huArticleLower } from "../hu.js";
import { logTenantMessage } from "../tenant/messages.js";
import { footerReasonForTenant } from "../trial/footer.js";
import type { CalendarLinkRow, SyncConflict } from "../tenant/availability.js";
import { esc, huDate, ownerLetter, siteMailContext } from "./requests.js";

interface LinkContext {
  readonly siteId: string;
  readonly unitName: string;
  readonly provider: string;
}

async function linkContext(linkId: string): Promise<LinkContext | null> {
  const row = await db
    .selectFrom("calendar_link")
    .innerJoin("site_unit", "site_unit.id", "calendar_link.unit_id")
    .select(["site_unit.site_id as siteId", "site_unit.name as unitName", "calendar_link.provider as provider"])
    .where("calendar_link.id", "=", linkId)
    .executeTakeFirst();
  return row ?? null;
}

/** K1: "a portál egy már elfogadott éjszakát is hozott" — which night, which guest. */
export async function sendOwnerSyncConflict(linkId: string, conflicts: readonly SyncConflict[]): Promise<void> {
  const lc = await linkContext(linkId);
  if (!lc || !conflicts.length) return;
  const ctx = await siteMailContext(lc.siteId);
  const lang = ctx.lang;
  if (!ctx.notifyList.length) {
    console.warn(`[booking:sync] nincs értesítési cím — az ütközés (${linkId}) CSAK a kártyán látszik`);
    return;
  }
  const ids = [...new Set(conflicts.map((c) => c.holder.replace(/^booking:/, "")))].filter((x) =>
    /^[0-9a-f-]{36}$/i.test(x),
  );
  const guests = ids.length
    ? await db.selectFrom("booking_request").select(["id", "guest_name"]).where("id", "in", ids).execute()
    : [];
  const guestOf = new Map(guests.map((g) => [g.id, g.guest_name]));
  const rows = conflicts.map((c) => ({
    label: huDate(c.day),
    value: guestOf.get(c.holder.replace(/^booking:/, "")) ?? T(lang, "elfogadott foglalás"),
  }));

  const subject = T(lang, "Ütközés a naptárban: {art} {portal} egy nálunk már foglalt éjszakát hozott ({unit})", {
    art: huArticleLower(lc.provider),
    portal: lc.provider,
    unit: lc.unitName,
  });
  const lead = T(
    lang,
    "{Art} {portal} naptára olyan éjszakát jelez foglaltnak, amelyre Ön nálunk már elfogadott egy foglalást ({unit}). Ugyanarra az éjszakára most két vendége lehet.",
    { Art: huArticle(lc.provider), portal: lc.provider, unit: lc.unitName },
  );
  const notDeleted = T(
    lang,
    "Egyik foglalást sem töröltük — Ön dönti el, melyik vendéget tudja fogadni, és a másikkal a portálon vagy itt rendezi.",
  );
  const once = T(lang, "Erről az ütközésről csak egyszer írunk; a foglalási modul portál-kártyáján addig látszik, amíg fennáll.");
  const text =
    `${lead}\n\n` +
    conflicts.map((c, i) => `- ${rows[i]!.label} ${rows[i]!.value}`).join("\n") +
    `\n\n${notDeleted}\n\n${once}\n\n${ctx.hostName}\n`;

  await getEmailSender().send(
    ownerLetter({
      to: ctx.notifyList.join(", "),
      footerReason: await footerReasonForTenant(ctx.tenantId),
      subject,
      text,
      lang,
      hostName: ctx.hostName,
      kicker: mailLabel(T(lang, "Naptár-ütközés"), "wait"),
      heading: T(lang, "Ütközés a naptárban"),
      blocks: [mailPara(esc(lead)), mailDetails(rows), mailPara(esc(notDeleted)), mailNote(esc(once))],
    }),
  );
  if (ctx.tenantId) {
    await logTenantMessage({
      tenantId: ctx.tenantId,
      channel: "email",
      kind: "booking",
      subject,
      bodyText: text,
      recipient: ctx.notifyList.join(", "),
      relatedKind: "calendar_link",
      relatedId: linkId,
    });
  }
}

/** K7: "a Booking.com naptára egy napja nem frissül" — once per failure streak. */
export async function sendOwnerSyncFailing(link: CalendarLinkRow): Promise<void> {
  const lc = await linkContext(link.id);
  if (!lc) return;
  const ctx = await siteMailContext(lc.siteId);
  const lang = ctx.lang;
  if (!ctx.notifyList.length) {
    console.warn(`[booking:sync] nincs értesítési cím — a tartós hiba (${link.id}) CSAK a kártyán látszik`);
    return;
  }
  const subject = T(lang, "Nem frissül {art} {portal} naptára ({unit})", { art: huArticleLower(lc.provider), portal: lc.provider, unit: lc.unitName });
  const lead = T(
    lang,
    "Egy napja nem tudjuk beolvasni {art} {portal} naptárát ({unit}). Az azóta a portálon érkezett foglalások nem jutnak át az Ön oldalára.",
    { art: huArticleLower(lc.provider), portal: lc.provider, unit: lc.unitName },
  );
  const kept =
    link.lastDayCount !== null
      ? T(lang, "A korábban áthozott {n} foglalt nap érvényben marad.", { n: link.lastDayCount })
      : "";
  const why = link.lastError ? T(lang, "Amit a link válaszol: {err}", { err: link.lastError }) : "";
  const todo = T(
    lang,
    "Ellenőrizze a linket a Modulok › Online foglalás képernyőn, a portál kártyáján. Ha a portálon új linket kapott, válassza le a régit, és kösse össze az újjal.",
  );
  const once = T(lang, "Erről csak egyszer írunk; ha a link újra működik, és később megint elakad, újra szólunk.");
  const text = [lead, kept, why, todo, once, ctx.hostName].filter(Boolean).join("\n\n") + "\n";

  await getEmailSender().send(
    ownerLetter({
      to: ctx.notifyList.join(", "),
      footerReason: await footerReasonForTenant(ctx.tenantId),
      subject,
      text,
      lang,
      hostName: ctx.hostName,
      kicker: mailLabel(T(lang, "Naptár-szinkron"), "wait"),
      heading: T(lang, "Nem frissül a portál naptára"),
      blocks: [
        mailPara(esc(lead)),
        ...(kept ? [mailPara(esc(kept))] : []),
        ...(why ? [mailPara(esc(why))] : []),
        mailPara(esc(todo)),
        mailNote(esc(once)),
      ],
    }),
  );
  if (ctx.tenantId) {
    await logTenantMessage({
      tenantId: ctx.tenantId,
      channel: "email",
      kind: "booking",
      subject,
      bodyText: text,
      recipient: ctx.notifyList.join(", "),
      relatedKind: "calendar_link",
      relatedId: link.id,
    });
  }
}
