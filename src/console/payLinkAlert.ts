// STUCK-ORDER ALERT — a buyer reached the end of the configurator, submitted a real
// order with real billing details, and we could NOT hand them a pay-link.
//
// Why this exists: measured 2026-09-13, that branch was completely silent. The order
// row landed in `order_intent`, no `payment` row was ever created, the buyer's screen
// promised a pay-link "by e-mail" that no code sends, and the only trace was a
// `console.warn` in the server's stdout — which nobody reads. Three submitted orders
// sat that way. Money on the table, and the house did not know.
//
// This is the human-facing half of the fix: the screen now tells the buyer the truth
// (a person will contact them), and THIS makes that sentence true by waking the person.
// Fire-and-forget by design — an alert must never fail the buyer's request — but every
// branch is loud, including "there is nobody to alert".

import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import { getAlertRecipients } from "./appSettings.js";

export interface StuckOrderAlert {
  readonly orderIntentId: string;
  readonly leadName: string | null;
  readonly amountHuf: number | null;
  readonly billingPeriod: "monthly" | "annual";
  readonly buyerEmail: string | null;
  /** Machine reason the pay-link was refused (mock_rejected / gateway_error / …). */
  readonly reason: string;
}

/** Internal operator text — outside the §B.18 customer-facing i18n scope. */
function smsText(a: StuckOrderAlert): string {
  const amount = a.amountHuf == null ? "?" : String(a.amountHuf);
  return (
    `Citoviso: MEGREKEDT RENDELES — ${a.leadName ?? "ismeretlen lead"}, ${amount} Ft. ` +
    `A vevo megrendelt, de fizetesi linket nem kapott (${a.reason}). Teendo a konzolon: ` +
    `rendezd az okot, majd a lead Csomag es fizetes fulen: Fizetesi keres kuldese.`
  );
}

function emailParts(a: StuckOrderAlert): { subject: string; text: string } {
  const amount = a.amountHuf == null ? "ismeretlen összeg" : `${a.amountHuf} Ft`;
  const period = a.billingPeriod === "annual" ? "év" : "hó";
  return {
    subject: `Citoviso — megrekedt rendelés: ${a.leadName ?? "ismeretlen lead"} (${amount})`,
    text:
      `Egy vevő VÉGIGMENT a konfigurátoron és megrendelt, de fizetési linket nem tudtunk ` +
      `kiadni neki. A rendelés rögzült, a pénz NEM.\n\n` +
      `Lead: ${a.leadName ?? "—"}\n` +
      `Összeg: ${amount}/${period}\n` +
      `Vevő e-mail: ${a.buyerEmail ?? "—"}\n` +
      `Rendelés azonosító: ${a.orderIntentId}\n` +
      `Elutasítás oka: ${a.reason}\n\n` +
      `A vevő azt a tájékoztatást kapta, hogy egy kollégánk felveszi vele a kapcsolatot — ` +
      `ez a levél az a kolléga.\n\n` +
      // ⚠️ A gomb VALÓDI felirata és HELYE (console/views.ts: "Fizetési kérés küldése ▸" a
      // lead „Csomag és fizetés" fülén) — kitalált feliratot nevezni meg annyi, mint nem
      // létező gombot kerestetni az operátorral, miközben egy vevő pénzzel a kezében vár.
      // ⛔ A gomb CSAK akkor látszik, ha nincs függőben lévő fizetés-sor (hasPending) —
      // gateway-hiba után épp ezért tűnhet el; a súgó (console-settings) ezt kimondja.
      `Teendő a konzolon: szüntesd meg az okot, majd a lead „Csomag és fizetés" fülén a ` +
      `„Fizetési kérés küldése ▸" gombbal add ki a linket. Ha a gomb nem látszik vagy a ` +
      `mockot elutasították, a súgó „Mit tegyél megrekedt rendelésnél?" szakasza vezet tovább.`,
  };
}

/**
 * Alert the operator about an order that could not be turned into a pay-link.
 * Never throws: the caller is serving the buyer's HTTP request.
 */
export async function alertStuckOrder(a: StuckOrderAlert): Promise<void> {
  try {
    const rcpt = await getAlertRecipients();
    if (!rcpt.phone && !rcpt.email) {
      // The missing-recipient branch must fail VISIBLY — a silent "no recipient"
      // would recreate exactly the blind spot this module was written for.
      console.error(
        `[pay-link] MEGREKEDT RENDELÉS ${a.orderIntentId} (${a.leadName ?? "?"}, ` +
          `${a.amountHuf ?? "?"} Ft, ok: ${a.reason}), de nincs riasztási címzett ` +
          `(konzol /settings vagy OWNER_ALERT_PHONE) — az operátor NEM lett értesítve.`,
      );
      return;
    }
    if (rcpt.email) {
      const { subject, text } = emailParts(a);
      await getEmailSender().send({ to: rcpt.email, audience: "platform", subject, text });
    }
    if (rcpt.phone) await sendSms({ to: rcpt.phone, text: smsText(a) });
    console.log(
      `[pay-link] megrekedt rendelés jelezve (${a.orderIntentId}, ok: ${a.reason}) — ` +
        `${[rcpt.email ? "e-mail" : null, rcpt.phone ? "SMS" : null].filter(Boolean).join(" + ")}`,
    );
  } catch (e) {
    console.error(`[pay-link] a megrekedt-rendelés riasztás elbukott (${a.orderIntentId}):`, e);
  }
}
