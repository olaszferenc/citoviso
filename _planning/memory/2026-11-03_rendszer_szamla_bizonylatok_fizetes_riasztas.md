# 2026-11-03 — Rendszer-számlák a Bizonylatokban + riasztás minden sikeres fizetésről (SUB-A, ADR-0414)

**Kiváltó ok:** az első valódi fizető vevő (Duna Vibe House, CITO-2026-7) számlája kiment, de a konzolon semmi nem látszott, és a tulaj nem kapott értesítést.

## Elvégezve
- Tükör: `invoice` → `accounting_document` (`source='system'`, `invoice_id` egyedi, ON DELETE CASCADE). Kiállított = aktív; sztornózott és (fizetésenként a legutolsó) sikertelen = `draft`, listázva, jelölve, a pénz-összegzésekből kihagyva. PDF az `invoice.pdf_base64`-ből. Forrás-szűrő + CSV „Forrás” oszlop. Az ÁAM devizás számlálója is kizárja a tükröt.
- Riasztás: `src/console/paymentAlert.ts`, az `issueInvoiceFor` „payment” triggerén; `alertHouse` csatorna (levél + SMS, csendes óra); `payment_alert` claim → egyszer; megújítás napi összesítő 18:00 után (`offer-followup.mts`).
- Őr: `scripts/payment-alert-check.mts` (57 ellenőrzés, scratch-DB; a bekötés nélkül 36 piros). Az `invoice-retry-check` a fizetés-levelet nem számolja.

## Fájlok
`migrations/0120_invoice_mirror_payment_alert.sql`, `src/billing/invoiceMirror.ts`, `src/console/paymentAlert.ts`, `src/console/partnerData.ts`, `src/console/partnerViews.ts`, `src/console/server.ts`, `src/payment/service.ts`, `src/db/schema.ts`, `scripts/invoice-mirror-backfill.mts`, `scripts/payment-alert-check.mts`, `scripts/invoice-retry-check.mts`, `scripts/offer-followup.mts`, `scripts/i18n-scope.mts`, `hooks/pre-commit`, ADR.

## Élesítéskor
Migráció, majd `npx tsx scripts/invoice-mirror-backfill.mts --go` (idempotens). Javasolt: `CONSOLE_URL` beállítása az éles `.env`-be (ma üres; a levél-link addig az `admin.` aldomainből képződik).
