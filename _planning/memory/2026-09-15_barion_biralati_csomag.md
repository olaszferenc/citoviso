# 2026-09-15 — Barion-bírálati csomag: kutatás → hiánypótlás → éles demó → jegyek beadva

## Mi történt (idő-sorrendben)

1. **Kutatás (2 ügynök, hivatalos források):** a barion.com súgó Playwright-renderrel, a
   docs.barion.com Wayback-ből. Fő leletek: a zárt (belépés mögötti) bolt HIVATALOS útja az
   adatlap „Egyéb adatok" mezője (teszt-belépő); tokenes fizetés = külön Ügyfélközpont-jegy,
   alapból tiltva, sandboxban alapból él; hivatalos átfutás 3–5 munkanap; a Barion-logósor
   hiánya kimondott elutasítási ok. Minden a `_planning/BARION-APPLICATION.md`-ben, forrásokkal.
2. **Mérés a 13 tételes checklist ellen:** 3 bukó tétel — logósor sehol (a főoldali „barion"
   találat csak a Pixel gifje volt), ÁSZF-ből nyilvántartási szám + telefon hiányzik, adatlap
   üres mezői. A logósor-munka KIDERÜLT, hogy kész (5467c16, deploy után született → élesen nem
   volt kint).
3. **Kód:** ÁSZF-bevezető pótlása (`legalViews.ts`, meglévő field()-minta, §2b-kivétel a tulaj
   Igen-jével) + renderelt-lapos őr a `legal-check`-ben (negatív próbával igazolva) +
   **`scripts/demo-prospect.mts`** — a demó-tenant prospectjét köti valódi mock-artifacthoz
   (renderSite mock-fázis + frameDemoMock, AI nélkül), mert getProspectByToken artifactPath
   nélkül 404 (mérve).
4. **Deploy élesre** (tulaj-engedéllyel): `fd4ec5e` = tag `prod/20260915-0927`, 1 migráció
   (0068), GATE 1c-hez tudasbazis-or PASS kellett (lefuttatva, rögzítve kb-gate.mjs-sel).
   Élesen mérve: ÁSZF-mezők kint, logósor + SVG 200.
5. **Demó-seed élesen:** demo-tenant + demo-prospect a prod szerveren (a lokál-őr DSN-trükkje:
   a prod socket `/var/run/postgresql` nem illik a lokál-mintára → `postgres://localhost/...?host=...`
   alakkal futtatva, tulaj-engedéllyel). E2E mérve ÉLESEN: `/p/demo5b0455b4067b` 200 →
   rendelés-POST minden kapuval → `payUrl = secure.test.barion.com/Pay?Id=…`.
6. **Jegyek beadva (tulaj):** 2 észrevétel a `secure.barion.com/Remark/Create`-en
   („Elfogadóhely kezelése"): adatpótlás+próbavásárlás, illetve tokenes fizetés kérelme.
   ⚠️ Mérve: a Leírás-mező 1000 karakterre NÉMÁN csonkol — ezért lett kettő, tömörítve.

## Kulcs-adatok (a bírálat idejére)

- Elfogadóhely: `af0d98fe-d456-42f8-bc89-6b6a8651d2ad`, státusz „Jóváhagyásra vár"
- Bírálói út: `https://citoviso.com/p/demo5b0455b4067b` (belépés nélkül a Barion-átirányításig)
- Tenant-demó belépő: `nyugalom-vendeghaz` / `folyo-kikoto-79` (élesen)
- Prod DB-ben 1 jelölt teszt-rendelés: „CITOVISO PRÓBA (törölhető)" (pending, sandbox)
- Jegy-út újranyitáshoz: Tárca → Ügyfélközpont → `secure.barion.com/Remark/Create`

## Nyitott / következő

- ⚠️ **TULAJ:** tárca-feltöltés banki átutalással a vállalkozói számláról (azonosítás) — enélkül nincs jóváhagyás
- Barion-válasz (3–5 munkanap) → POSKey+Payee jön → prod `.env`: `BARION_URL=api.barion.com` +
  éles POSKey + Payee + `INVOICE_PROVIDER=szamlazz` EGYÜTT (BARION-APPLICATION.md §4–5), külön engedéllyel
- Jóváhagyás után: demó-tenant + prospect + teszt-rendelés kitakarítása a prodból
- Token-jegy sorsa: ha elutasítják, a megújítás kézi fizetésre esik — riasztó tétel

## Módosított fájlok (mind landolva)

- `src/server/legalViews.ts` · `scripts/legal-check.mts` · `scripts/demo-prospect.mts`
- `_planning/BARION-APPLICATION.md` (checklist + kutatási leletek + státusz)
