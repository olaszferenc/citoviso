# 2026-10-04 — Dupla „Foglalás” cím: walk-through, artdeco, brutalism

SUB (koordináló: „mock-összehasonlító / Kapunyitás”, wt/citcad90429). Tulaj-döntés: „Dupla »Foglalás« cím — javítsuk”.

## Mérés (render, mind a 21 sablon × mock / élő+foglalás / élő foglalás nélkül × 1280 / 390)
- **walk-through:** a foglalás-sáv („Foglalás” + „Szabad időpontok megtekintése”) közvetlenül a lapzáró
  naptár-szakasz „Foglalás” `<h2>`-je fölött (köztük csak a „Telefonon is kereshető” sor).
- **artdeco:** a „porta” panel címe „Foglalás”, alatta az alcím, majd a sáv címe újra „Foglalás”.
- **brutalism** (új lelet, a briefben nem szerepelt): a „konzol” címkéje „Foglalás”, közvetlenül alatta a sáv címe.
- Foglalás nélkül (érdeklődés-sáv, „Foglalási igény”) egyik sablon sem dadog. A tilted-gallery Képek utáni
  kártyája és a lapzáró naptár között ~500 px + értékelés-blokk áll — az a booking-card kontraktus ④, nem dadogás.

## Javítás (meglévő minta, nem új kinézeti döntés)
- walk-through: `.wk-enq:has(#cit-booking) .cit-enquiry-bar-inner{display:none}` — betűre a gate-opening szabálya
  (a #cit-enquiry horgony marad; a gomb úgyis a közvetlenül alatta álló naptárra ugrott).
- artdeco / brutalism: a konténer saját címe marad (a sablon kézjegye), a sáv címe rejtve a cta-változatban;
  a gomb a helyén.

## Őr
`scripts/booking-title-stutter-check.mts` (pre-commit, bármely sablon/templateKit/render/moduleSections/runtime
változásra) — két látható, nem-link „Foglalás” cím között ≤ 80 karakter nem-link szöveg és < 360 px = piros.
Negatív kontroll: a három javítás visszavonásával 4–4–4 piros; `--self-test` a walk-through-ba visszatett dadogást fogja.

## Második kör (tulaj: „ok javítsd.”, a koordinátor hozta)
- artdeco: a „Kérjük, adja meg utazásának adatait” alcím csak űrlap fölött (`hasBookingSurface` → elmarad; új szöveg nincs).
- walk-through: a „Telefonon is kereshető” sor `data-cit-booking-lead` jelet kap; a `render.ts` `placeBookingLead()`
  közvetlenül a `#cit-booking` „Foglalás” `<h2>`-je alá teszi. Foglalás nélkül a helyén marad (a sáv alatt).
- Őr-bővítés: `booking-title-stutter-check` ⓐ ⓑ; `--self-test` mindhárom visszarontást (dupla cím, telefonsor
  vissza a cím fölé, alcím vissza a gomb fölé) pirosnak méri.

## Fájlok
src/engine/templates/{walkThrough,artdeco,brutalism}.ts · src/engine/render.ts · scripts/booking-title-stutter-check.mts · hooks/pre-commit ·
assets/design-refs/tenant-site/booking-card/README.md · MEMORY.md
