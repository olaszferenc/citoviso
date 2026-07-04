# 02 — ENTITÁS-TÉRKÉP (Vitrino ontológia)

> A domain entitásai és kapcsolataik. A kód igazsága: `src/generate/types.ts`. Ha eltér, a kód nyer — és ezt frissítsd.

## Property (a „mag" adat-objektum)
Egy szálláshely = egy `Property` rekord. Új szállás = új rekord, nem új kód.
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
