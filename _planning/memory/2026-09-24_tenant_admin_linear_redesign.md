# Tenant-admin újratervezés — „Linear” nyelv jóváhagyva (2026-09-24)

**Szál:** a tulaj két képernyőképpel bejelentette, hogy a tenant-admin navigációja és a Fotók
fül elfogadhatatlan (nincs vissza-út, 11-gombos kétsoros mobil alsó sáv, űrlap-halom galéria,
nyers fájlmező). Három §2b kör után az **„A” — Linear + cián akcent + fehér oldalsáv**
jóváhagyva. ADR-XXXX. Kontraktus: `assets/design-refs/tenant-admin/admin-linear/`.

## Elvégzett

- **1. kör (ELVETVE):** 4 mock a mai tokenekből (`admin-ujra-{A,B,C,D}`) — a tulaj: „vicc”,
  „légy drasztikus, mintha nem lenne bázis, csak a logó”.
- **2. kör:** 4 gyökeresen új nyelv (`admin2-{1..4}`: Linear · Bento · Midnight · Enterprise)
  trend-forrásokkal + a tulaj Dribbble-referenciáival; közös motor (`gen2.mjs`), valós adat
  (16 fotó, 3 e-mail, 0 foglalás, 1 látogató/7 nap, éves előfizetés 2027-09-24-ig, 7 modul).
  → **2.1 Linear** lett az alap.
- **3. kör:** Linear + cián akcent + Midnight előfizetés-kártya + Bento nyitókép-mutató +
  világos/sötét váltó (megmarad), két oldalsáv-változat (`admin3-A-cian` / `admin3-B-navy`)
  → **A jóváhagyva.**
- Minden kör Playwrighttal végigkattintva (feltöltés valós szabályokkal, sorrend, nyitókép,
  aláírás, kijelölés+törlés, nagyítás, vissza, téma), mindkét méret, JS-hiba 0.

## Módosított / létrehozott fájlok

- `assets/design-refs/tenant-admin/admin-linear/` — `plan.html`, 8 kép (világos/sötét ×
  mobil/asztali × Áttekintés/Fotók), `plan-menu-mobile.png`, `README.md` (a kontraktus),
  `gen2.mjs` + `gen3.mjs` (a generátor).
- `_planning/decisions/XXXX-tenant-admin-linear-nyelv.md` (a land osztja ki a számot).
- `assets/design-refs/_drafts/` — a 10 vázlat (gitignore-olt; a land takarítja).

## Tanulságok

- ⛔ Az első körben **kitaláltam „1 új foglalási kérés”-t** — a DB-ben 0 volt. A 2. körtől
  minden szám lekérdezett (site_visit, tenant_message, booking_request, subscription).
- „Újragondolás” kérésre a meglévő nyelv átrendezése nem válasz: a tulaj referenciát mutatott
  (Dribbble), és a trendeket kellett megnézni (Linear-minimalizmus, bento, dark-mode-by-default,
  szín csak jelentésre).
- A mockok `container-type` kerete + `let` a `render()` után → TDZ-hiba, ami az egész oldalt
  megölte; a Playwright `pageerror` fogta meg — a képlövés előtt MINDIG hibalista.

## Következő lépés

Megvalósítás a kontraktus szerint, a README „Őr” szakaszával: ① keret + navigáció + téma →
② Áttekintés → ③ Fotók → ④ súgó-képek + KB-idézetek (a „Kiválasztott fotók feltöltése”
felirat megszűnik — grepelni a fogyasztókat). Élesítés NEM része.
