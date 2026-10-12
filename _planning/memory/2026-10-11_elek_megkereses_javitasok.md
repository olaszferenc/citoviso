# 2026-10-11 — Elek megkeresés-kör javításai (B1 · B2 · K1 · K2), ADR-0366

**Szál:** SUB a „Elek-teszt koordinátor” alatt (brief `~/rc-briefs/megkereses-javitasok-elek-20261011.md`), fa `~/wt/cit542145eb`.

## Elvégezve
- **B1a — nincs csendes visszaesés:** a rendelés-kezelő domain-elutasításra (`domain_refused`: no_name · tld_not_offered · below_threshold) és kliens≠szerver árra (`price_changed`) 409-et ad, `order_intent` és pay-link nélkül. A konfigurátor a `showDepNotice`-mintán kimondja az okot, hogy fizetés nem indult, és az új összeget; ingyenes címre / friss ajánlatra áll, visszalép a tervhez. A régi „lista-árat mutató kliens is becsületes” kivétel megszűnt.
- **B1b — dev = éles nginx:** `src/server/edgeRoutes.ts` (`CONSOLE_EDGE_PREFIXES`: /p/ /configure/ /pay/ /privacy /mock/ /site/); `deploy/nginx/` az éles két fájl OLVASOTT másolata; a public a lead előnézeti hostján ezeket a konzolra adja tovább (élesen elérhetetlen ág). Élesen a domain-választó eddig is működött (nginx), a 404 a dev-emuláció hibája volt.
- **B2:** `activate()` → `prospect.contact_email`, ennek hiányában `order_intent.buyer_email`. Sikerlap belépés nélkül: „még nem tudtuk kiadni … írjon nekünk”, „Belépek” gomb nélkül. Élesről olvasva: 0 fizetett vásárlás, 0 próba → érintett vevő nincs. A próba saját kötelező e-mailre ad belépést (nem érintett).
- **K1:** „Mit tartalmaz?” lista: „Saját domainnév (.hu)” tétel-sor B állapotban (pipa a lefedő csomagnál, X a többinél); A-ban nincs sor.
- **K2:** kísérő SMS GSM-7 (toGsm7, a link a hajtogatás után kerül be), ≤2 szelet, hosszú névnél a név rövidül. §C SMS-kapu: C3 ékezet-független (`SmsDraft.name`), C4/keretezés/ár-szabály ékezet nélküli ikre is fut.
- **Elek 5. kör (koordinátori kiegészítés):** K2 — két egyidejű beküldés → egy `order_intent`, egy pay-link (leadenkénti zár + `pendingTwinInitialOrder`: azonos, 30 percen belüli, nem lezárt első rendelés újrahasznosul; más tartalom saját linket kap). K3 — lejárt kupon: a `price_changed` ág fedi (a vevő a pénztár előtt az új összeggel dönt).
- **Őrök (bekötve):** `order-double-submit-check`, `order-silent-fallback-check`, `edge-routing-check`, `mobile-buyer-login-check`, `pair-sms-gsm7-check`, `package-domain-row-check`; `outreach-gate-selftest` a hajtogatott párhoz igazítva.
- **Elek szkriptjei újrafuttatva** (scratch `citoviso_megkfix_10111926` + `_a`/`_b`, portok 4723/4923, CFG_TO_CONSOLE NÉLKÜL): B1 — 6 430 Ft kiírva = terhelve, a domainnév a rendelésben; B2 — L2 belépője a pénztári címre ment; K1 — sor a kártyán; K2 — 2×GSM-7, 2 szelet.

## Nem csináltam (döntés kell — a koordinátornak jelentve)
- A1 (pirula a hős-alcímen, mobil) — tulaj már döntött: pilot UTÁN (memória `project_after_pilot_order_pill_placement`).
- A2 (süti-sáv a panel alján, mobil) — a próbalapon nem reprodukálódott (a panel a sáv fölött ér véget, 0 px átfedés).
- A3 (levél „2 925 Ft/hó-tól” vs. legolcsóbb csomag 3 660) — ár-/szöveg-döntés.
- A4 (eszkalációs alsó lap 34%) — Elek is KÉZI ítéletnek jelölte.
- A5 (két felugró egymás után) — UX-döntés.
- „Most nem találtunk javaslatot — a megrendeléskor beállíthatja.” — hamis ígéret maradt (szöveg-döntés).
- Mock terv-lapon a csomag-tartalom domain sora — ADR-0360 „Nyitva” terv-köre.

## Fájlok
`src/console/server.ts` · `src/console/data.ts` · `assets/runtime/cit-configurator.js` · `src/console/views.ts` · `src/server/public.ts` · `src/server/edgeRoutes.ts` · `src/payment/service.ts` · `src/outreach/draft.ts` · `src/outreach/outreachCheck.ts` · `src/i18n/catalog.json` · `deploy/nginx/*` · `hooks/pre-commit` · `scripts/{order-silent-fallback,edge-routing,mobile-buyer-login,pair-sms-gsm7,package-domain-row}-check.mts` · `scripts/outreach-gate-selftest.mts` · `_planning/decisions/XXXX-rendeles-nem-esik-csendben-vissza-elek-1011-javitasok.md`

## Nyitott
Élesítés: a nagy deployjal (külön kimondott utasítás).
