// Booking ENQUIRY (the spine's "Foglalási igény" card) — approved contract:
// assets/design-refs/tenant-site/enquiry-card/README.md (owner decision "B",
// 2026-09-08).
//
// THE HOLE THIS CLOSES (measured 2026-09-08): the card's submit never talked to
// the server — the runtime dispatched an event nobody listened to, then fell
// back to a mailto: link (a dead end on any machine without a mail client), and
// the card collected NO contact data, so even the mailto carried nothing the
// owner could answer. The owner's verdict: "a gomb nem csinál semmit".
//
// Shape: an enquiry is NOT a booking request. There is no unit, no calendar
// hold, no accept/decline machinery — the guest asks "is it free around these
// dates?", the owner simply REPLIES (mail Reply-To is the guest). The record of
// it is the tenant's Üzenetek row; the delivery is the notify e-mail.

import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForSite, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";

export interface EnquiryInput {
  readonly siteId: string;
  /** ISO 'YYYY-MM-DD'. */
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly guests: number;
  readonly guestName: string;
  readonly guestEmail?: string | null;
  readonly guestPhone?: string | null;
}

export interface EnquiryResult {
  readonly ok: boolean;
  readonly errors?: string[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function huDate(iso: string): string {
  return iso.replace(/-/g, ". ") + ".";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Validate + record + notify. Validation mirrors the approved card contract:
 * dates in order, name required, e-mail OR phone required (an enquiry the owner
 * cannot answer is worthless), e-mail well-formed, phone at least 8 digits.
 */
export async function createEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  // ADR-0067: every message lands in front of the GUEST on the tenant's own
  // page — in the page's language, never Hungarian by default.
  const lang = await prepareMailLang(await langForSite(input.siteId));
  const errors: string[] = [];

  if (!ISO_DAY.test(input.dateFrom) || !ISO_DAY.test(input.dateTo)) {
    return { ok: false, errors: [T(lang, "Kérjük, adja meg az érkezés és a távozás napját.")] };
  }
  if (input.dateTo <= input.dateFrom) {
    errors.push(T(lang, "A távozás napja az érkezés után kell legyen."));
  }
  const name = input.guestName.trim();
  if (!name) errors.push(T(lang, "Kérjük, adja meg a nevét."));
  const email = (input.guestEmail ?? "").trim();
  const phoneDigits = (input.guestPhone ?? "").replace(/\D/g, "");
  if (!email && !phoneDigits) {
    errors.push(
      T(lang, "Kérjük, adjon meg e-mail címet vagy telefonszámot — enélkül a szállásadó nem tud válaszolni."),
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.push(T(lang, "Kérjük, adjon meg egy érvényes e-mail címet."));
  }
  if (!email && phoneDigits && phoneDigits.length < 8) {
    errors.push(T(lang, "A telefonszám túl rövid."));
  }
  const guests = Math.max(1, Math.min(50, Math.round(input.guests || 1)));
  if (errors.length) return { ok: false, errors };

  const owner = await db
    .selectFrom("site")
    .leftJoin("tenant_user", "tenant_user.tenant_id", "site.tenant_id")
    .select(["site.tenant_id as tenantId", "tenant_user.contact_email as email"])
    .where("site.id", "=", input.siteId)
    .executeTakeFirst();
  if (!owner?.tenantId) return { ok: false, errors: [T(lang, "Ismeretlen szállás.")] };

  const phone = (input.guestPhone ?? "").trim();
  const subject = T(lang, "Foglalási érdeklődés: {guest}, {from}–{to}", {
    guest: name,
    from: huDate(input.dateFrom),
    to: huDate(input.dateTo),
  });
  const text =
    T(lang, "Új foglalási érdeklődés érkezett az oldaláról.") +
    `\n\n${T(lang, "Vendég:")} ${name}\n` +
    `${T(lang, "Érkezés:")} ${huDate(input.dateFrom)}\n` +
    `${T(lang, "Távozás:")} ${huDate(input.dateTo)}\n` +
    `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: guests })}\n` +
    (email ? `${T(lang, "E-mail:")} ${email}\n` : "") +
    (phone ? `${T(lang, "Telefon:")} ${phone}\n` : "") +
    `\n${T(lang, "Ez előzetes érdeklődés, nem foglalás — elég, ha válaszol a vendégnek.")}`;

  // ⚠️ Ordering is deliberate and DIFFERS from the booking notify: the Üzenetek
  // row is the enquiry's ONLY record (there is no booking_request behind it), so
  // it is written FIRST — a mail outage must not erase the enquiry itself.
  await logTenantMessage({
    tenantId: owner.tenantId,
    channel: "email",
    kind: "booking",
    subject,
    bodyText: text,
    recipient: owner.email ?? "",
    relatedKind: "enquiry",
    relatedId: null,
  });

  if (owner.email) {
    const html =
      `<p style="font-size:17px"><strong>${esc(T(lang, "Új foglalási érdeklődés érkezett az oldaláról."))}</strong></p>` +
      `<p style="font-size:16px;line-height:1.7">` +
      `<strong>${esc(name)}</strong><br>` +
      `${esc(huDate(input.dateFrom))} — ${esc(huDate(input.dateTo))}<br>` +
      `${esc(T(lang, "{n} fő", { n: guests }))}` +
      (email ? `<br>${T(lang, "E-mail:")} ${esc(email)}` : "") +
      (phone ? `<br>${T(lang, "Telefon:")} ${esc(phone)}` : "") +
      `</p>` +
      `<p style="font-size:14px;color:#666">${esc(T(lang, "Ez előzetes érdeklődés, nem foglalás — elég, ha válaszol a vendégnek."))}</p>`;
    // Fire-and-forget (FK-007 lesson: a synchronous send holds the guest's
    // spinner); the enquiry is already recorded above.
    void getEmailSender()
      .send({
        to: owner.email,
        audience: "guest",
        subject,
        text,
        html,
        // The whole point: the owner hits Reply and talks to the guest.
        ...(email ? { replyTo: email } : {}),
      })
      .catch((e) => console.error(`[enquiry] értesítő levél HIBA (tenant ${owner.tenantId}):`, e));
  } else {
    console.warn(`[enquiry] tenant ${owner.tenantId}: nincs kapcsolat-email — az érdeklődés csak az Üzenetekben`);
  }

  return { ok: true };
}
