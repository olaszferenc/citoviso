# 2026-09-24 — Rendszerlevelek profi kerete (E4 logó, „Citoviso” feladó, cégadatos lábléc)

**Szál:** a tulaj a belépési és a számla-levelet amatőrnek találta. Döntés: ADR-XXXX.

## Elvégezve
- §2b terv-kör: A/B/C változat, mobil és asztali mérettel → **A** jóváhagyva, az E4 logóval.
- ⛔ **Saját hibám az első körben:** a `public/assets/ui/lockup-gradient.svg`-t (a RÉGI, sötétkék
  C-ívű jelet) vettem, pedig azt az E4 (2026-09-21) felülírta, és az `assets/brand/`-ban él. Ráadásul
  a HTML-t kép nélkül küldtem el, így a tulaj csak az alt-szöveget látta. A logó forrása MINDIG
  az `assets/brand/` + a `design-refs/console/brand-mark/README.md`.
- `src/email/platformLayout.ts`: közös keret (fejléc-logó CID-del, adat-panel, gomb, lábléc,
  `fromName: "Citoviso"`, mobil `@media`). Erre áll át a belépési, a számla-, a 7 díj- és a 3 domain-levél.
- A belépési levél megszólítása az `order_intent.buyer_name` / `buyer_type` mezőkből jön
  (`service.ts` → `issueAndSendTenantLogin` 4. paramétere); a számla a `p.buyerType`-ból.
- Ellenőrzés: mind a 12 levelet a kódból rendereltem 390 px-en és asztalin (logó, lábléc, feladó rendben;
  vízszintes görgetés és JS-hiba nincs); az i18n-, a dizájn-lint és 4 levél-őr zöld; **valódi SMTP-próba** a tulaj
  Gmailjébe (belépés + számla), mindkettő a beérkezőkbe érkezett, a logó `multipart/related` inline részként.

## Módosított fájlok
`src/email/platformLayout.ts` (új) · `src/email/{loginEmail,invoiceEmail,billingEmail,domainEmail}.ts` ·
`src/tenant/credentials.ts` · `src/billing/invoiceDelivery.ts` · `src/payment/service.ts` ·
`src/i18n/catalog.json` · `scripts/i18n-sources.mjs` · `assets/brand/citoviso-logo-email.png` (új) ·
`assets/design-refs/console/platform-email/{platform-emails.html,README.md}` (új)

## Nyitott
- A `formatMoney` sima szóközt tesz az ezresek közé → bekezdésben mobilon „54 / 300 Ft” törés
  (a keret adat-paneljében kivédve). Globális javítás: NBSP a formázóban, külön döntés.
- A lemondás-elszámolás levélben a dátum gépi alakú (`2027-10-31`) — régi hiba.
- A díjlevelek címsora = a tárgy („… — Boróka ház”); ha rövidebb címsor kell, új i18n-kulcsok.
- Nincs élesítve.
