# 2026-10-04 — Foglalás-sáv kártyaként, egy közös szabállyal (arch-frames · tilted-gallery · wordmark-grow)

**Szál:** SUB a CIT koordinátor („mock-összehasonlító / Kapunyitás”) alatt; brief `~/rc-briefs/foglalas-sav-arch-tilted.md`.
**Tulaj-döntés:** „A” (2026-10-04, a koordinátoron át). Kontraktus: `assets/design-refs/tenant-site/booking-card/`.

## Mérés (render, Mandula vendégház mock, 390 + 1440, mind a 21 sablon)
- Hibás: **arch-frames**, **tilted-gallery** — a közös `ENQUIRY_BAR_CSS` csak a régi (primitív) sablonokba jut; a két
  művészi sablon a `bookingSlot()`-ot csupaszon tette le → felirat + gomb x=0-n, közvetlenül a teljes naptár fölött.
- A többi 19 a saját konténerében rendben. Mellék-lelet, NEM javítva (a tulaj nem döntött): walk-through — a sáv a nagy
  „Foglalás” cím fölött (dupla cím); artdeco — konténer-cím + sáv-cím is „Foglalás”. gate-opening szándékosan rejti.

## Elvégezve
- `src/engine/templateKit.ts`: `bookingCardCss(tpl, sectionPad)` — a Névből növő B kártyája betűre, body-osztályra szűkítve.
- `archFrames.ts` / `tiltedGallery.ts`: foglalási felülettel a sáv a gallery-modul után (`bandMid`), a kártya-CSS bekötve.
- `wordmarkGrow.ts`: a saját másolat helyett a közös szabály — a sáv számított stílusa + doboza 390/1440-en bájtra azonos.
- Őr: `scripts/booking-card-check.mts` (+ pre-commit bekötés), két piros önteszttel.
- Eltérés a tervtől: a terv címe `line-height:1.15`-öt viselt, a kód a Névből növő szabályát (nincs ilyen sor) — README-ben rögzítve.

## Nyitva
- walk-through / artdeco dupla „Foglalás” cím — tulaj-döntésre vár (a koordinátornál).
- Menü „Foglalás” link a kártyára visz, nem a naptárra (mint a Névből növő B-ben) — ha másképp kell, külön döntés.
