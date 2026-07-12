# 02 — ENTITÁS-TÉRKÉP (Citoviso ontológia)

> A domain entitásai és kapcsolataik. A kód igazsága: `src/scraper/types.ts` (RawLead/QualifiedLead/LeadMaterial) + `src/generator/` (brief/theme). Ha eltér, a kód nyer — és ezt frissítsd.

## Iparág-agnosztikus közös mag (a régi `Property` utódja)
A Fázis 2 igazolta: **közös, iparág-független mag + specializáció pontosan 3 becsatlakozási ponton (KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ).**
6 mag-entitás (fix, típusos oszlopokkal a közös mezőkre):
- **Vállalkozás-profil** — a konkrét vállalkozás strukturált tényadata (a régi „Property" agnosztikus utódja, az „adat-objektum").
- **Kínálati egység (Offering)** — szoba/apartman ↔ étteremnél menütétel.
- **Ár** — pénznem az Ország-tengelyről.
- **Elérhetőség** — dinamikus állapot (folytonos dátum-tartomány szállásnál ↔ diszkrét idő-slot étteremnél).
- **Foglalás** — az érték-teremtő tranzakció; a jutalék-horog tárgya.
- **Vélemény** — csak VALÓS (lásd 03-INVARIANTS §B.7).

**Hibrid adatmodell (adat-szintű invariáns):** a 6 mag-entitás közös mezői fix, típusos oszlopok (`tenant_id`, név, ár, dátum, státusz — indexelt); a 3 becsatlakozási pont **iparág-specifikus** mezői **strukturált JSONB**, amit az Iparág-definíció sémája ír le/validál. → **Új iparág = új definíció-séma, NEM DB-migráció.**

## Property — szállás-pilot generáló-nézet (történeti, NEM kanonikus adatmodell)
> ⚠️ A `Property` interfész **nincs a kódban** (a valós típusok: `RawLead`/`QualifiedLead`/`LeadMaterial` + `GeneratedBrief`/`ThemeBrief`). Ez a szekció a szállás-pilot generáló-brief mezőit írja le fogalmi szinten; a kanonikus adatmodell a fenti 6-entitásos mag. A `git rm` az ÚJ struktúra scaffoldjakor jön.

Egy szálláshely generáló-nézete a következő mezőkkel (fogalmi, nem 1:1 kód):
- `slug`, `name`, `location`, `headline`, `lead`, `capacity`
- `contact` → **Contact** { phone?, email?, address?, postalCode?, city? }
- `amenities[]` → **Amenity** { icon (SVG-sprite id, NEM emoji), label }
- `images[]` → **PropertyImage** { url, source (owner|guest|portal|generated), role?, alt? }
- `unique` → **UniqueSpotlight** { label, title, body, imageUrl?, chips[] } — a szállásra jellemző EGYEDI szekció
- `review?` { quote, score, source } — csak VALÓS vendégvélemény
- `palette` → **Palette** { primary, primary2, accent, ink, cream, cream2, muted } — a fotókból kinyerve
- `stylePreset` — "rustic" | "modern" | "lakeside" | …

## Kapcsolatok / folyamat
```
Source(1..*) --ingest--> Property(partial) --merge--> Property
Property --analyze--> Palette + stylePreset
Property --generate--> Site (HTML + assets)
Site --outreach--> Owner
Owner --convert--> Tenant (Site + Admin, owner-assetekkel)
```

## Tervezett entitások (még nincs kód)
- **Tenant** — Owner ↔ Site ↔ előfizetés (multi-tenant). Postgres.
- **Booking** — foglalás (a direkt-foglalós motor magja; a jutalék-horog tárgya).
- **Vertical** — vertikum (szállás / étterem) → sablon-készlet + entitás-bővítés (étteremnél Menu/MenuItem).
- **OutreachCampaign** — megkeresés + leiratkozás-állapot (GDPR).

> TODO: étterem-vertikum entitásai (Menu, MenuItem, OpeningHours, Reservation).
