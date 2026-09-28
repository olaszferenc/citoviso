# 2026-09-28 — ADR-0253 utójavítás: consent-szabályok a telefonos blokkba, tilted-gallery fekvő hero-alja és helység-sor

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
- **2. kör (tulaj: „Igen, tegyük vissza”):** a helység-sor (`.t-kick`) és a görgetés-jel rejtése is a `≤ 700 px`-es
  fekvő blokkba került (ott a sáv kiírja a helységet, a jel a sáv mögé esne). 844×390 és 932×430: mindkettő újra
  látszik; mérve rövid és hosszú (kétsoros) névvel: nincs ütközés a névvel, a sávval, nincs kilógás, a görgetés-jel
  a szöveg alatt ≥ 36 px-re (hosszú név, 844). 667×375, 390×844, 1280: pixelre azonos. Képek: `cmp-kick-*.png`.
- Mellék-lelet (NEM javítva, a megbízáson kívül): álló 390×844-en a „görgessen” jel a hero-n látszó sáv MÖGÉ esik
  (y 781–809 vs. sáv 774–844) — láthatatlan, nem ütközik látványosan, de halott elem. Tulaj/szál dönt.

## Módosított fájlok
- `assets/runtime/cit-modules.css`
- `src/engine/templates/tiltedGallery.ts`
- `MEMORY.md`, ez a jegyzet

## Képek
`~/rc-briefs/mobile-chrome-followups-shots/` — `cmp-*.png` (bal: előtte, jobb: utána), `elotte/`, `utana/` + `report.json`.

## Útközben (2. kör): `mobile-chrome-check` ④ és a Google Maps-beágyazás
- Futásonként 3–5 véletlen lap bukott `④JS-hiba`-val: „google is not defined” a `maps.gstatic.com` init_embed.js-ben,
  ill. CORS-elutasított `maps.googleapis.com` RPC — harmadik fél versenyhelyzete, a lap nem hat rá. A
  `guest-mobile-check` ⑩ ugyanezt már 2026-09-26 óta kiszűri; ez az őr nem.
- Javítva ugyanazzal a szabállyal: a hibát az EREDETE (első stack-keret / konzol-hely) alapján ismeri fel, nem az üzenet
  alapján. Negatív kontroll: saját `throw new Error("… google is not defined")` és egy „maps.googleapis.com”-ot
  EMLÍTŐ saját `console.error` is piros marad (390 + 1440); a tiszta lap zöld; önteszt zöld; teljes kapu 38×2 zöld.
