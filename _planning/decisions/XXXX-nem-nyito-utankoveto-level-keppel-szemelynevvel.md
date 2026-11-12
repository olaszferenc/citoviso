## ADR-XXXX — Nem-nyitó utánkövető levél: egyszer, 14 nappal az utolsó megkeresés után, képpel indul, személynévvel

**Dátum:** 2026-11-12 · **Döntött:** tulaj (brief `email-20261112-141510.md`, két terv-kör után „Az email így már ok”,
„Első körben mehet a nevem”) · **Terv:** `assets/design-refs/console/nem-nyito-level/` (README = a kontraktus)

**Kontextus.** A tulaj szerint az idei ~1459 kiküldésnek csak a negyede nyitotta meg a linket (a „megnyitás” a
link kattintása; a levél megnyitását nem mérjük). Élesen mérve 11-12: 780 e-mailezett lead, 237 nyitó, 535 nem
nyitó, ebből 206 legalább 14 napos. A tulaj első ötlete a FŐ levél tárgyának cseréje volt („szállás neve +
foglalás / érdeklődés”); a session javaslatára a fő levél marad (a megnyitóknál működik), és az új változat
csak azoknak megy, akiket a mostani nem fogott meg.

**Döntés.**
1. **Egy utánkövető levél leadenként**, ha a hideg levele kiment, és az UTOLSÓ bármely csatornás megkeresése
   (levél, SMS/MMS, Viber, WhatsApp, próba-kampány) óta 14 nap eltelt, és egyik linkjét sem nyitotta meg.
   Kizárás: leiratkozott, válaszolt (ADR-0348 felülírt pontja szerint, tulaj 10-26), visszavont kiküldés
   (tulaj 10-09), próbázik / rendelt / vásárolt, ikercím, közös cím, nem jóváhagyott vagy leletes mock, törött képek, hiányos
   nyelvi csomag. Minden ítélet a foglalás előtt újramérve. A próba-kampány levelét kapott lead IS megkapja
   (tulaj 11-12: „kapják meg szarok most már rá” — az a levél „Erről a próbáról több levelet nem küldünk”
   mondatát erre az egy levélre felülírja); a kampány-levél az utolsó megkeresésnek számít.
2. **A levél (terv, README 2–8. pont):** látható feladó és aláírás = SZEMÉLYNÉV (`OUTREACH_FOLLOWUP_SENDER_NAME`,
   első körben a tulaj neve — konfig, nem beégetve; üresen nem megy ki); tárgy „{név} – közvetlen foglalás /
   érdeklődés”; reklám-preheader NINCS, az előnézet a levél saját első sorai; a levél a terv KÉPÉVEL indul (kép
   nélkül nincs levél); a tulaj szövege a portál-jutalékról és a naptár-összehangolásról; egy gomb + nyers URL;
   a hideg levél ár-doboza és jogi lábléce változatlanul.
3. **Egy lövés a sémában:** `nonopener_followup` (migráció 0135) — egy sor leadenként és címenként, foglalás a
   küldés ELŐTT, bukáskor feloldva.
4. **Ütem:** az óránkénti tick (`scripts/offer-followup.mts`) legfeljebb 5 levelet küld, naponta legfeljebb
   `app_setting nonopener_followup_daily_cap` (alap 40; 0 = szünet), csak hétköznap 8–17 (ADR-0334). Sorrend:
   honlap nélküliek elöl (tulaj 10-27), azon belül a legrégebbi utolsó megkeresés.
5. **Mérés:** a link `?f` jelet visz (`mock_view.open_via = 'followup'`); a riport „Honnan nyitották” panelje
   „Utánkövető levél” sorban mutatja (ADR-0435 kiterjesztése).

**Következmény.** Élesítéskor a prod `.env`-be `OUTREACH_FOLLOWUP_SENDER_NAME` kell (enélkül a tick minden leadet
kihagy, és naplózza, miért); a 0135 migráció additív. Csak-olvasó áttekintés: `npx tsx scripts/nonopener-followup.mts
[--gates]`. Őr: `scripts/nonopener-followup-check.mts`.
