# 2026-10-26 — Minta-kártya: „Az egész szállás” több egységes szállásnál

Koordinátor (citdcb3daea); Vera2 J-lelete: Barackvirág 00660191, B mock 278c11a1 (a 57a96970 deploy után is). Lokál javítás, élesen NINCS.

## Ok
A `sampleRooms` szám és név nélkül egyetlen „Az egész szállás” kártyát ad — ez a szállás egészben kiadását állítja. A Barackvirág leírása szerint „Apartmanok és kétágyas szobák igényelhetők” (panzió). Az ADR-0404 a számot és a nevet kezelte, ezt az esetet nem.

## Javítás (ADR-0404 8. pont)
- `unitKindOf(descriptions, leadName)` → `rooms | apartments | both | null`; `sampleHintsOf` → `siteData.sampleUnitKind` (a csak-egész ház kivétel); a kártya neve „Szobák és apartmanok” / „Szobák” / „Apartmanok”.
- `rerender-mock --resample` az új jelzést is cseréli.
- Teszt: `sample-from-source-check` (Barackvirág valós szöveg, hotel-név, Noémi, ház-ellenpróba, Szömörce-ellenpróba, kártyanév).
- Élesen mérve: 562 „egész szállás”-kártyás leadből 170 kap fajtát (146 szoba, 20 apartman, 4 mindkettő); szúrópróba (Kenese-Völgye villahotel, Oekotel hotel, Noémi „apartmanok … kiadók”, Csopaki, Krémer-Ház, Mézes) mind valódi több egység.

## Deploy után
`--resample` kell (a jelzés a siteData-ban él): legegyszerűbb mind az éles mockra (`rerender-mock.mts <id> --resample`), AI nélkül.
