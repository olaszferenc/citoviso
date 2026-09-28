# 2026-09-28 — ADR-0253 utójavítás: consent-szabályok a telefonos blokkba, tilted-gallery fekvő hero-alja

Brief: `~/rc-briefs/mobile-chrome-followups.md` (a tulaj: „javítható”). Hibajavítás, §2b-kivétel — terv-kör nélkül,
előtte/utána képpel. Jelentés: `~/rc-briefs/mobile-chrome-followups-REPORT.md`.

## 1. `cit-modules.css` — `.cit-rev-f__consent` (2 szabály)
- **Szándék (blame):** a `142b7e98` (ADR-0235 ①, „érintési cél ≥ 44 px telefonon”) írta. A diffben a két sor
  2 szóközzel behúzva, és UTÁNUK áll egy `}` — a lap végi telefonos érintési blokk (`@media (max-width: 559px),
  (max-height: 500px)`) farka volt, amit a `.cit-book__note` mögé commitoltak. Ettől a blokk nyitva maradt, a
  consent-szabály pedig MINDEN szélességen hatott.
- **Javítás:** a két szabály a blokk végére került. A telefon (390 px és a fekvő ≤ 500 px magas) nem változik
  (44 px sor, 22 px-es jelölő, középre igazítva). Asztalon visszaáll az ADR-0110 alap (`moduleSections.ts`): 18 px-es
  jelölő a szöveg első sorához igazítva; a sor 44 → 21–23 px. Mérve tilted-galleryn és fullbleed-en.

## 2. tilted-gallery — fekvő hero-alj
- A `@media(max-height:500px) and (min-width:641px)` blokk a hero aljára `padding-bottom:calc(70px + consent)`-et
  tett a rögzített sávnak. Az ADR-0253 óta a sáv 700 px fölött `display:none` → 844×390-en (a mai telefonok fekvő
  szélessége 844–932) 70 px üres hely maradt, a név fölfelé tolódott (a szöveg alja 242 px-en a 390-ből).
- 641–700 px között (pl. 667×375) a sáv MÉG a hero-n van (a tilted-gallery hero-jának nincs saját foglalás-gombja,
  a runtime az első képernyőtől mutatja) → ott a helyfoglalás jogos, és megmaradt.
- **Javítás:** a padding külön blokkba került `and (max-width:700px)`-zel. 844×390: a szöveg alja 277 px-en, a név a
  hero közepén; 667×375, 390×844, asztal: pixelre változatlan (mért értékek azonosak).
- Nem változtattam: ugyanebben a blokkban a helység-sor (`.t-kick`) és a görgetés-jel is a sávra hivatkozva rejtett
  — 844-en már nincs sáv, amely a helységet kiírná. Ez kinézeti kérdés, nem hiba → nyitott, tulaj dönt.

## Módosított fájlok
- `assets/runtime/cit-modules.css`
- `src/engine/templates/tiltedGallery.ts`
- `MEMORY.md`, ez a jegyzet

## Képek
`~/rc-briefs/mobile-chrome-followups-shots/` — `cmp-*.png` (bal: előtte, jobb: utána), `elotte/`, `utana/` + `report.json`.
