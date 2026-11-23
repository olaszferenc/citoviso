# Generátor-javítás — kapunyitás · névből növő · parallax · levélkép (JÓVÁHAGYOTT TERV, 2026-11-23)

**Státusz:** a tulaj jóváhagyta · **Kapu:** CLAUDE.md §2b · **Döntés:** ADR-0474 (generátor-javítás) ·
**Session:** `cite2d1c9b4` · **Hatókör:** `src/engine/templates/gateOpening.ts`,
`src/engine/motion.ts`, `src/engine/templates/wordmarkGrow.ts`, `src/engine/templates/parallax.ts`,
`src/engine/depthHero.ts`, `src/outreach/heroShot.ts`, `src/console/server.ts`

**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A megvalósítást ehhez mérjük.

- Terv (egy fájl, fülekkel és méret-váltóval): `terv-JOVAHAGYOTT.html` → a három valódi lead-oldal:
  `kapu-JOVAHAGYOTT.html` (Krisztina Panzió), `novo-JOVAHAGYOTT.html` (Margaret Apartment),
  `parallax-JOVAHAGYOTT.html` (Hungaria Guesthouse). A lapok alján a váltógombok CSAK a terv részei.
- Képek: `terv-mobile.png`, `terv-desktop.png`

## Amit a terv KÖT

### Kapunyitás (tulaj: „kép, 3,5 mp szerintem tök jó”)
- A szétnyíló szárnyakon **fotó** van, de **más témájú**, mint a nyitókép (amit a kapu mögül
  előjön): homlokzat-nyitókép mögé belső tér / terasz / étkező, nem ugyanannak a háznak egy
  másik szöge. A téma a vision-ítélet `Photo.subject` mezője.
- **Nyitás 3,5 mp** (ma 1,5 mp), a nyitókép utána-ülése ehhez igazodik.
- A B változat (színes deszkás kapu, fotó nélkül) NEM épül meg.

### Névből növő (tulaj: „1. B”)
- **Nagy keret** a névben: asztalon `min(54vh,38vw)` magas, álló képernyőn `min(82vw,54vh)`.
- A keretben **4 fotó** vált, és **egyik sem a nyitókép**; amikor a keret elindul felnőni, a
  nyitókép áttűnik benne (~0,6 s), és a nyitókép nő fel — ami felnő, az nem ugyanaz a kép,
  ami a váltások alatt látszott, és a végén a nyitókép marad (nincs képcsere a végén).

### Parallax (tulaj: „Mehet”)
- Ahol a böngésző nem tud rögzített hátteret (telefon, iOS, keskeny ablak), a panelek fotója
  **szkripttel marad hátul**: görgetéskor a tartalom csúszik át rajta, mint asztalon.
- A mozgó nyitókép (térhatás-vászon) minden méreten ugyanígy hátul marad.

### Térhatás
- Erősség **1,5** (a „finomított animáció”; addig 2).

### Bevezető: levél ↔ mock-oldal (tulaj-helyesbítés 2026-11-23)
- A **levél képe** (heroShot) a bevezető NÉLKÜL készül — a kész nyitókép látszik rajta.
- A **lead mock-oldalán** (`/p/…`) a névből növő bevezető FUT (az ADR-0159 ⑦ félreértés volt:
  a 09-14-i „kapcsold ki” a levél képéről szólt).

## Amit a terv NEM köt
- A pontos easing-görbék, a váltások ütemezése tizedmásodpercre.
