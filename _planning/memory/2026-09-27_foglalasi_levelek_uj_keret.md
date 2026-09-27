# 2026-09-27 — Foglalási levelek: professzionális keret, a szállás elérhetőségével; a tulajé a Foglalások fülre visz

**Kérés (tulaj, Gmailből nézve):** „ez is legyen már professzionális vállalati kinézetű! meg legyen benne a szállás
elérhetőségei a honlappal együtt” (vendég „rögzítettük” levele) · „meg lehessen megnyitni az admin felületet a
foglalások résszel” (tulaj „Foglalási kérés” levele) · aztán: „folytassuk a következő lépésekkel” · „javítsd”.

## Elvégezve
1. **§2b terv-kör:** 3 vendég- (A/B/C) + 2 tulaj-változat (A/B), mobil + asztali. **Jóváhagyva: vendég C + tulaj B**,
   kiegészítés: a vendég üzenete FELIRATTAL. Kontraktus: `assets/design-refs/console/booking-email/`. **ADR-0244.**
2. **Mind a 16 foglalási levél az új kereten** (`src/email/bookingLayout.ts`):
   - vendég (a szállás nevében): rögzítettük/árajánlat-kérés, visszaigazolás, nem szabad, betelt, a szállásadó
     lemondta, lemondás megerősítve, nem érkezett válasz, árajánlat, az ajánlat lejárt — elérhetőség-kártyával;
   - tulaj (Citoviso-keret, „Foglalások megnyitása” → `/admin?tab=foglalasok`): új kérés, a vendég lemondta,
     lejárt kérés, az ajánlat 4 kimenetele. A régi `bookingHtml` megszűnt; a text/plain VÁLTOZATLAN.
3. **Egy elérhetőség-szabály:** `effectiveContact()` + `displayPhone()` (`src/tenant/contact.ts`) — az admin
   `contactOf` és a levelek ugyanazt használják.
4. **`booking-price-clarity-check` dátumfüggő pirosa javítva:** 390 px-en egy hónap látszik, hónap végén <5 szabad
   nap → a teszt most lapoz („Következő hónap”). Ugyanazon a napon piros → zöld.

## Módosított fájlok
`src/email/bookingLayout.ts` (új) · `src/email/platformLayout.ts` · `src/booking/requests.ts` · `src/tenant/contact.ts` ·
`src/tenant/editor.ts` · `src/i18n/catalog.json` · `scripts/i18n-sources.mjs` · `scripts/i18n-scope.mts` ·
`scripts/booking-price-clarity-check.mts` · `assets/design-refs/console/booking-email/*` ·
`_planning/decisions/0244-foglalasi-levelek-a-vendege-a-szallas-neveben.md`

## Tanulságok
- ⛔ A `notifyOwner` / owner-levél függvények **`tenant_message` sort is írnak** (ADR-0084) — előnézet-generáláskor
  a mock postafiók NEM elég, a tenant Üzenetek fülébe duplikátum kerül. Takarítás `related_id` + `sent_at >= t0`.
- A mock e-mail adapter csak a HTML-részt írja az .eml-be — a kapuk `body`-regexei a HTML-t olvassák, ezért a
  HTML-nek is ki kell mondania, amit a text (pl. „Az ajánlott ár:”, booking-offer ⑧).
- `until ! pgrep -f "<minta>"` a SAJÁT parancssorát is illeszti → sosem ér véget (a CLAUDE.md self-pkill csapda testvére).

## Nyitott
- **Camping Carina címe** település nélkül („Ráckevei út 083/2 hrsz”) — a tulaj javítja az admin Elérhetőség fülén.
- Nincs élesítve — a nagy deployjal megy.
