# A 3. telefonos ellenőrző kör (Ifjúsági Szállás Tihany) — a mai javítások együtt működnek

Dátum: 2026-09-29 este · SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/ellenorzo-kor-harmadik.md`

## Mit bizonyít

Az FK-011→016 lánc EGY futásban, egy friss alanyon (Ifjúsági Szállás Tihany, arch-frames): a tulaj
feltöltése = a vendég látványa (saját nyitókép a hős, 11 saját fotó a galériában, saját árak, saját
cím, saját program, kitett vélemény). DB: foglalás 56 000 Ft → accepted → cancelled; árajánlat
90 000 Ft/éj → accepted, 180 000 Ft; **az egész szállás árlistája az ajánlat után is üres** (ADR-0267);
vélemény published. ADR-0274 (sáv, jelvény, Teendők, megerősítő névvel + Mégsem, Felhívom/Írok neki,
naptár a kért hónapon), ADR-0270 (lemondó lap elérhetőséggel, vendég-naptár a kért hónapon,
„Az ajánlat elfogadásáról Ön dönt”), ADR-0259/0262 (galéria 1/11, hős, „4,3 / 5”, nincs „Minta”)
a valódi úton látszik. Új termékhiba nincs. Gépi: 7 pass · 2 fail · 107 kézi · 0 blokkolt.

## Alany — nem volt tiszta, és a „nincs is sehol mock” félreértés

Minden jóváhagyott mockos lead már vásárolt. A tenant nélküli leadeknek VAN mockjuk, de mind
`generated`: a Tihany 19 mockja egy gépi minden-sablon söprés (2026-09-25, 41 mp), a 19 prospectje a
`seed-elek-lead-mobile-links.mts` terméke. A konzolon a lead-lapon és a Leadek „legenerálva” pirulájában
látszanak; az egyetlen mock nevű menüpont („Jóváhagyott mockok”) csak az approved-ot szűri — ezért látta
a tulaj úgy, hogy „nincs is sehol mock”. A tulaj igenje után a konzol kurátori útján hagytam jóvá
(`POST /artifact/<id>/curate`, a képegészség-kapun át). ⚠️ A Tihany ezzel elhasználódott (vásárolt,
foglalás, ajánlat, vélemény); a Laguna Panzió és az Alig-vár Tanya ugyanilyen 19-mockos jelölt.

## Mérőeszköz-javítások

- `run-night.mts`: több prospectes leadnél a JÓVÁHAGYOTT mock prospectjét nyitja (a Tihanynál a legfrissebb
  sor egy jóvá nem hagyott sablon volt); a lead valódi címe → `ELEK_NIGHT_ADDRESS` (FK-013 ⑧).
- FK-013/014: a Három Huszárra szóló fix szövegek (nádfedeles ház, Balaton 12 km, 71-es út) alany-függetlenek.
- FK-015: új ⓪ lépés (sáv + Teendők), a levél és a kártya „Mégsem”-je TÉNYLEG megnyomva és mérve, tel:/mailto:,
  naptár hónapja. Két saját hiba javítva: a `.bk-cf__q` a kártyán kétszer van (a NYITOTTAT kell számolni), és a
  runner a `várd`-okat a `tedd`-ek UTÁN értékeli — a küldés előtti állítás a küldő lépésben a nyugtát méri.
  ⚠️ Ez a két javított állítás NEM futott újra (a döntött kérés nem ismételhető) — a következő alanyon.
- FK-014: „Az ajánlat elfogadásáról Ön dönt” (`[data-cit-trust-confirm]`); FK-016: lemondó lap elérhetősége.

## Tanulság

- A teljes-lapos képen egy `position:fixed` + `translate(-50%)` ablak BALRA kilógni látszik (a modul-kosár
  megerősítője, x≈−170…192) — viewportban mérve középen van (16–374). Képről ilyet leletnek mondani tilos;
  mérd a `getBoundingClientRect`-et valódi viewportban.
- „Képek a portáról” (porta = udvar) — elsőre „portálról”-nak olvastam; idézés előtt a forrást nézd.

## Döntési anyag (gitignore-olt, a fában)

`elek/runs/NIGHT-2026-09-29T18-09-14/itelet/` — `ITELET.md` ((A) gépi · (B) érthetőség · (C) a javítások
tételenként) + 21 kép.

## Módosított fájlok

`elek/bin/run-night.mts` · `elek/scenarios/FK-013-owner-fill-everything-mobile.md` ·
`elek/scenarios/FK-014-guest-live-mobile.md` · `elek/scenarios/FK-015-owner-aftermath-mobile.md` ·
`elek/scenarios/FK-016-guest-aftermath-mobile.md`

## Nyitott

- Nem mérve: ADR-0270 „Online foglalás csak foglalható egységgel” és ADR-0257 „csak egyben adom ki” ág.
- Apró leletek (ITELET.md alja): rendelő-pirula a hős-címen, görgessen-pirula a számla-mezőkön, árajánlat-kérés
  létszáma 2 fő, „Alapár:” az egyedi ajánlaton.
