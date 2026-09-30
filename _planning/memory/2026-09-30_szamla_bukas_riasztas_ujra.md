# Bukott számla: riasztás, napi újrapróba, kézi újrakiadás, Számlázz-oldali idempotencia; a konzol-gomb §2b-re vár (2026-09-30)

SUB-szál (koordinátor: „Deploy-koordinátor”, `citc4db0d86`) · brief: `~/rc-briefs/invoice-failure-retry.md` · ADR-XXXX.

## Kiindulás (élesen mérve, a brief szerint)
A 100 Ft-os éles próbavásárlás fizetve (`payment` `acadc176-1a82-4877-93d8-ac1358de22fd`), a számla
`d1f07194-5d34-4379-b430-0dc63a8b7700` failed: „Számlázz error 378 … NAV Online Számla”. A fiók-beállítás a
tulajé; a kód-hiba: failed sor + `console.error`, se riasztás, se újrapróba, se kézi út.

## Mit csináltam
- `src/invoicing/invoice.ts` + `szamlazz.ts`: `externalId` → `szamlaKulsoAzon` (a `<beallitasok>` végén),
  `orderNumber` → `rendelesSzam` (a `<fejlec>`-ben a `fizetve` előtt, XSD-sorrend).
  **Mérve a Számlázz demo fiókján:** ugyanazzal a `szamlaKulsoAzon`-nal a második kiadás NEM készít új bizonylatot,
  az elsőt adja vissza (TST-2026-819 kétszer); a lekérdezés külső azonosítóra és rendelésszámra is megtalálja
  (ismeretlenre `hibakod 7`). ⚠️ A docs.szamlazz.hu 403-at ad automatikus letöltésre — az XSD-k
  (`/szamla/docs/xsds/...`) elérhetők, a viselkedést a demo fiókon mértem.
- `src/invoicing/mock.ts`: ugyanez az idempotencia; `src/invoicing/index.ts`: `setInvoiceProvider` teszt-varrat.
- `src/payment/service.ts`: `issueInvoiceFor(paymentId, { trigger })` → `InvoiceOutcome`; fizetésenkénti
  `pg_advisory_lock` dedikált kapcsolaton; minden bukás egy `recordFailure`-ön megy át (failed sor + riasztás az első
  bukáskor és EGYSZER a keret kimerülésekor — azt a kézi kattintás is kiválthatja; a keret utáni kattintás csendes). A kézbesítő levél hibája nem számít számla-bukásnak
  (a `deliverInvoiceEmail` nem dob).
- `src/console/houseAlert.ts`: `alertInvoiceFailure` + `INVOICE_AUTO_RETRY_LIMIT = 3`.
- `src/billing/invoiceRetry.ts` (új): `retryFailedInvoices(now, scope)` (napi, ≥20 h térköz, max 3 újrapróba, csak
  paid + nyilatkozattal + issued nélkül), `retryInvoice` (csak paid), `leadIdOfPayment`.
- `scripts/billing-cycle.ts`: új mellék-lépés `invoice-retry`; `scripts/invoice-retry.mts` (CLI, payment.id vagy CIT-ref).
- ⛔ Konzol-gomb NEM landolt: a pre-commit felület-kapu (§2b) megfogta a `views.ts`-t (jóváhagyott terv nélkül), kivételt
  csak a tulaj adhat. Megírva és ellenőrizve: `data.ts` (`PaymentView.paymentId`, `invoiceFailure`), `views.ts` (piros
  „számla: sikertelen (N×)” + hibaszöveg + „Számla újra ▸”), `server.ts` (`POST /payment/:id/invoice-retry`), KB
  console-lead szakasz — patch: `~/rc-briefs/reports/deploy-keszenlet/szamlaretry-ui.patch`, képek ugyanott
  (`szamlaretry-ui-{mobile,desktop}.png`). Addig a kézi út a CLI, a riasztó levél ezt a parancsot írja ki.
- Őr: `scripts/invoice-retry-check.mts` (41 ellenőrzés), bekötve a `hooks/pre-commit`-be. Mutációs próba: zár nélkül
  3 szolgáltató-hívás + hamis failed sor (piros), külső azonosító nélkül 6 hiba (piros).
- KB: `kb/entries/console-settings/entry.hu.md` (riasztás-lista, a levél és a teendő). `_planning/DEPLOY-READY.md` §4b.3 #4 → kész.
- A (várakozó) gomb ellenőrzése: ui-shot 390 px + asztali (in-process konzol, eldobható fixtúra), valódi route-on végigkattintva:
  bukó kattintás → horgony nélkül, piros flash-sáv „A számla most sem készült el (2. kísérlet): …”, a gomb marad;
  sikeres kattintás → `#ls-orders`, a gomb eltűnik, a sorban „· számla: <szám>”; bejelentkezés nélkül → /login.

- `tudasbazis-or` FLAG → javítva: (1) [a patch-ben] a sikertelen gombnyomás horgony NÉLKÜL tér vissza (a `#ls-orders`
  kigörgette volna a flash-sávot; sikernél horgonnyal, flash nélkül — a hős-csere precedensének alakjában, amit a
  `lead-tab-anchor-check` elfogad); (2) a kézi próba is fogyasztja
  a keretet, ezért a kimerülés-levél bárki okozza, egyszer kimegy (új őr-ág ⑨), a KB kimondja.

## Tanulság
- A zár nélküli verseny nem csak dupla hívás: a második `issued` beszúrás az egyedi indexen elhasal, és a catch
  **failed** sort ír egy valójában kiadott számla mellé — a sor-számláló így hazudott volna.
- Dev: `INVOICE_PROVIDER=szamlazz` + dev billing-timer él, de a dev DB-ben 0 újrapróbálható failed sor (mérve), és a
  keyGuard off-live a valódi kulcsot megtagadja — a tick ott nem ad ki semmit.

## Nyitott
- DÖNTÉS: a „Számla újra ▸” konzol-gomb jóváhagyása (§2b) → utána a patch alkalmazása + land.
- SMS-ág a `houseAlert`-ben (DEPLOY-READY §4b.3 #1) — ha megjön, a számla-riasztás is azon megy.
