# 2026-10-02 — Elek M2: fizetés, számla, belépés, konzol (ADR-0303)

**Szál:** SUB `cit93d29d1b` · brief `~/rc-briefs/javitas-elek-0930/m2-fizetes-szamla-konzol.md` · koordinátor: CIT
„élesi teszt” (`~/wt/cit87d3f275`). Élesítés a koordinátoré, a többivel egyben.

## Elvégezve
- **F-2:** `src/payment/{gateway,barion,mock,service}.ts` — `cancelled` webhook-eredmény, naplósor
  (`paymentEndLogLine`); `/pay/done` + `payResultPage` megszakítás-lap; a próba-fizetőlap „Mégsem fizetek most” → `/cancelled`.
- **L-2/F-3:** `offerLabel`/`offerForPage` (`src/payment/offers.ts`); konfigurátor `OFFER.label`; `invoiceComment(…, kind)`;
  tulaj-nyugta `mkind`.
- **F-1/T-4:** `src/billing/prefill.ts` (nincs cím), `findHuTaxNumberInText` (`taxId.ts`) + `validateBuyer`; konfigurátor:
  gombfelirat, név-minta, adószám-figyelő (`huTaxInText`, paritás-őrrel).
- **T-3 (B):** `src/auth/passwordLink.ts`, `src/email/loginEmail.ts`, `src/tenant/credentials.ts`, `tenantAuth.ts`
  (süti-iat), `public.ts` route-ok (`/login/help` GET+POST, `/login/jelszo/<token>` GET+POST), fizetés-siker lap űrlap;
  migráció `0085_tenant_password_link.sql` (`password_set_at`).
- **K-1:** `orderIntentState` + panel (`src/console/views.ts`), `kind` az `OrderIntentView`-ban, route `orderId`.
- KB: `admin-account`, `admin-modules`, `console-settings`, `console-pricing`. Terv: `assets/design-refs/console/elek-m2/`.
- Őrök: `payment-outcome-truth-check`, `offer-name-one-source-check`, `billing-taxid-in-address-check`,
  `password-link-check`, `order-intent-state-check` (+ `billing-checkout-check`, `support-email-check`, `pay-exit-truth-check` igazítva).

## Tanulság
- ⛔ Scratch-DB-s őrben a DB-klienst nyitó import (akár egy NÉZET import) a scratch-beállítás ELŐTT a közös dev DB-be köt.
  Az első futásaim így egy lánc teszt-sort írtak a `citoviso_dev`-be (kézzel törölve). Az őr most `current_database()`-szel
  ellenőrzi, hova ír.

## Nyitott
- Élesen a meglévő (T-3 előtti) tulajok jelszava és sütije él tovább, amíg nem állítanak újat — szándékos.
- A próba-fizetőlapon nincs külön „bank elutasítja” gomb sima fizetésnél (a `/failed` útvonal kapukból él).
- F-4: a kupon-sáv csak akkor látszik, ha van még vehető modul — mind a 11 megvett modulnál rejtve (nem javítva, alacsony).
