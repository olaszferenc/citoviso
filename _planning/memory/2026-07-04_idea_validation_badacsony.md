# Ötlet-validáció — Badacsony (2026-07-04)

## Elvi tesztek (mockupok)
A `/home/mineral/mockups/`-ban (a Vitrino repón kívül, scratch) készültek:
- **Irány Badacsony!** — van saját (elavult) oldala → a régi oldal adatai átemelve.
- **Gitta Vendégház** — NINCS saját oldala → Google Maps + foglaló-portál adatokból + valódi portál-fotókból; a képekből gépileg kinyert palettára hangolt arculat.
- **Kati / Lugas / Napsugár** — 3 szállás, egyedi arculat + valódi adat/fotó + saját SVG ikonkészlet (nincs emoji) + szállásonként EGYEDI „mag"-szekció. Generátor: `mockups/gen.py` (közös template + adat-objektum).

## Piac-teszt (proxy)
Badacsonytomaj, 20 szálláshely (zimmerinfo katalógus), saját-domain ellenőrzés:
- **17 / 20 (85%) NINCS saját weboldala** — csak portál/Facebook/Maps.
- A 3 kivétel közül 2 nagyobb vállalkozás része (pincészet, wellness). A „pár szoba / magánszállás" szegmens ~100% honlap nélküli — ez a célszegmens.
- Egy faluban a szallas.hu 76 szállást listáz → 50+ potenciális ügyfél egyetlen településen.
- ⚠️ Proxy, nem 1:1 a Maps „weboldal" mező; 20-as minta, nem reprezentatív.

## Árazás
- Klasszikus (kézi/ügynökség): €1000–3000 egyszeri (EU) / $2000–5000 (US).
- **Vitrino-modell reális:** €0–600 setup + €20–50/hó, VAGY ~100 €/év — a közel nulla marginális költség miatt (gépi generálás) 90%+ margin, **volumen-játék** (pl. 2000 × 100 €/év).
- **A horog nem az ár, hanem a booking-jutalék (15–18%) kiváltása.** A célközönség „ingyenhez" szokott → alacsony/nulla belépő + havidíj konvertál jobban.
- Rejtett költség: support → önkiszolgáló admin kötelező.

## Nyitott kutatás
- Google Maps consent-megkerülés: a bejegyzés kép-URL-jei + teljes adat kiolvasása (sok hasznos adat van ott).
