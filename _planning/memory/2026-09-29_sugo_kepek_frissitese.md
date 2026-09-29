# A 10 elavult súgó-kép újragyártva a nagy deploy előtt (2026-09-29)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/sugo-kepek-frissitese.md` · ok: a
`deploy-prod.sh` GATE 1c/kép (ADR-0220) megállította volna a nagy deployt.

## Mérés

`kb-shot --check-committed` a main `cb900054`-en: 50-ből **10 elavult**, mind tenant-admin. Egyik sem
felület-HIBA — a felület változott, a képeket nem gyártották újra:

| kép | miért változott |
|---|---|
| admin-modules-rooms/screen | f4dc1972: a „Kiadom egyben is” pipa helyett háromállású választó (Nem adom ki egyben / Egyben is kiadom / Csak egyben adom ki); „Új egység” → „Új szoba felvétele” (27c156b4) |
| admin-modules-rooms/picker | 27c156b4: „egység” → „szoba” a képtár-szövegekben és a „Szoba törlése” gombon |
| admin-modules-rooms/arak-gomb | 27c156b4: „ugyanezeket az egységeket” → „a szobákat” |
| admin-modules-pricing/szobak-gomb | 27c156b4: „egységenként” → „szobánként” |
| admin-modules-pricing/nincs-ar | 27c156b4 (price-where-2): a „Nincs ára.” sor új félkövér mondata („A honlapon a szobakártyáján nem lesz ár…”) |
| admin-modules-booking/screen | „Másik egység foglalása” → „Másik szoba foglalása” a jelmagyarázatban |
| admin-modules-pricing/screen, naptar, ev-naptar | tartalom azonos, 1–2 px függőleges eltolódás (közös admin-CSS, 20f746cf/bfdb444d körül) |
| admin-multilang/screen | tartalom azonos, 2 px eltolódás; a kép tetején 1 px-es szaggatott vonal a fölötte álló elem szegélyéből (kozmetikai, a felvétel elem-dobozának széle) |

A cikkek szövege (admin-modules-rooms/pricing, 2026-09-28) MÁR az új felületet írta le — csak a képek
maradtak le. Egy valódi eltérés: két képaláírás a telefonos képen „mellette”-t írt, a gomb 390 px-en a
bevezető sor ALATT áll (`.mcfg-note--act` @container ≤639px → 100% széles; asztalon mellette) — a képaláírás
„alatta” lett, a törzsszöveg pedig a tudásbázis-őr lelete nyomán szintén (lásd lent).

## Ellenőrzés

`kb-shot --check-committed` → ✅ mind az 50 friss · `--determinism` → ✅ 50/50 pixelre azonos ·
`kb-check` 🟢 39 entry · `kb-freshness` 🟢 · tudásbázis-őr: FLAG → mindkét lelet javítva:
① a törzsszöveg „a bevezető sor mellett” ütközött a telefonos képpel → „a bevezető szöveg alatt (számítógépen
mellette)” (rooms + pricing); ② az admin-modules-booking képaláírása „várakozó kéréssel”-t ígért, a kép (régi és
új is) csak a „Mikor nem kiadó?” naptárat mutatja → a képaláírás a valódi tartalmat írja le (a diff előtti hiba).

## Megfigyelés (nem javítva)

A `--check-committed` „méret eltér: A → B” kiírása FRISS → COMMITOLT sorrendű (a booking-kép 1356→1354
valójában 1354-ről 1356-ra nőtt) — félrevezető irány. A `land.sh` nem futtat súgókép-frissesség kaput, csak a
deploy: egy land utáni felületváltozás így csak a deploy-kapunál derül ki.

## Módosított fájlok

- `kb/entries/admin-modules-booking/assets/hu/screen.png`
- `kb/entries/admin-modules-pricing/assets/hu/{ev-naptar,naptar,nincs-ar,screen,szobak-gomb}.png`
- `kb/entries/admin-modules-rooms/assets/hu/{arak-gomb,picker,screen}.png`
- `kb/entries/admin-multilang/assets/hu/screen.png`
- `kb/entries/admin-modules-pricing/entry.hu.md`, `kb/entries/admin-modules-rooms/entry.hu.md` (képaláírás + „alatt” a törzsben)
- `kb/entries/admin-modules-booking/entry.hu.md` (képaláírás)

## Nyitott

A párhuzamos „3. kör apróságai” szál (`citcc7b83dc`: requests.ts, prices.ts) még nem landolt — a landja
után `kb-shot --check-committed` újra (üzenetben kérve tőle).
