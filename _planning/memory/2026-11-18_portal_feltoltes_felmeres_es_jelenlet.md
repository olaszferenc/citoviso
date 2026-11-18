# 2026-11-18 — Portál-feltöltés felmérés + a 368 megnyitó portál-jelenléte

**Brief:** `~/rc-briefs/port-l-felt-lt-s-20261113-090252.md` (tulaj: fel tudjuk-e tenni a szállást a portálokra a tenant helyett; TOP 5 hazai + Booking + Airbnb), majd riport-kérés: „kinek hol van még hirdetése, külön azokra akik megnyitották a linknünket”, végül „Nézzük végig a 368at”.

## Elvégzett munka
- Felmérés: `_planning/RESEARCH-2026-11-13-portal-feltoltes.md` (TOP 5: Szállás.hu, Hovamenjek, Zimmerinfo, Apartman.hu, KiadóApartman; Booking Connectivity API szünetel, Airbnb API zárt; meghatalmazott hozzáférés: Booking Extranet-felhasználó, Airbnb társházigazda).
- A tulaj döntései (11-16): ADR-0448 — ÁSZF-kockázat vállalva; fiók nélkül mi hozzuk létre az adataival; árazás most nem téma; első kör csak felderítés.
- Portál-riport (HTML+CSV) a 1501 kiküldött leadről, megnyitók külön; utána mind a 368 megnyitó végigkeresve (szállásonként egy webes keresés + Booking nyilvános hu-sitemap, 20 456 slug, szigorú név+település egyezés). Eredmény: legalább egy portálon 297 (81%) · Szállás.hu 220 · Booking 193 · Airbnb 21 · egyiken sem 71. A tulajnak elküldve 11-16/17.
- Korlát: WebSearch session-keret 200 (óránként ~100 töltődik) → 5 körben, óránkénti saját ütemezéssel futott; a Szállás.hu Cloudflare-rel blokkolja a fejetlen Chrome-ot és a curlt (nem kerültük meg).

## Módosított fájlok
- `_planning/RESEARCH-2026-11-13-portal-feltoltes.md` (új)
- `_planning/decisions/0448-portal-feltoltes-a-tenant-helyett-digitalis.md` (új), `_planning/DECISIONS.md` (generált)
- `MEMORY.md` (Tények és döntések: 3 sor; Nyitott kérdések: 1 sor)
- Riport a fán kívül: `~/rc-briefs/portal-riport-20261113/`, `~/rc-briefs/portal-riport-20261116/`

## Nyitott
- Felajánlva, nem kérve: a 220 Szállás.hu-s megnyitó hirdetésének állapot-felmérése (csak keresési találatokból).
