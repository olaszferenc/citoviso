# Látogatói nyelvváltó — JÓVÁHAGYOTT TERV (2026-08-29)

`lang-switcher-JOVAHAGYOTT.html` — a tulaj által jóváhagyott, működő mock. Ez a
megvalósítás **KONTRAKTUSA**: nem stílus-javaslat, hanem elvárt viselkedés.

## Amit KÖT

1. **Asztali nézet:** a lenyíló chip (zászló + nyelvnév) a sablon **SAJÁT
   menüsorába** szövődik — nem lebeg fölötte. Ezért nem takarhatja el a menüt vagy
   a Foglalás/Érdeklődés gombot. (Tulaj: „a C a jó irány, csak ne lógjon bele a
   Foglalás gombba.")
2. **Mobil nézet:** külön sáv a lap tetején, mind a választott nyelvvel, **NEM
   sticky** — görgetéskor kimegy. (Tulaj: „mobilon jó a felső sáv, csak görgetésnél
   ne legyen sticky.") Azért sáv és nem chip: 6 sablon mobilon ELREJTI a navot, ott
   a beszőtt chip eltűnne (mérve).
3. **Zászló + NÉV**, nem nyelvkód. A zászlók inline SVG-k (`src/ui/flags.ts`) —
   emoji tilos (§B), és az OS-enként eltérően jelenne meg.
4. **A váltás valódi navigáció** a `/<nyelv>/` statikus változatra; az aktuális
   nyelv jelölve.

## Amit a terv NEM enged

- ⛔ lebegő elem a fejléc fölött (mérve: 5 sablonon takarásba kerül, ill. ráül a
  menüre);
- ⛔ lebegő chip a lap alján (mérve: 6 sablonon ráül az „Érdeklődés küldése" gombra);
- ⛔ csak nyelvkód („DE") név nélkül.

## A bizonyíték

`lang-switcher-collision.json` — mind a **16 sablon × 2 nézet = 32** eset lemérve
(a kapcsoló középpontján tényleg ő van-e felül, és takar-e linket/gombot).
A jóváhagyott megoldás: **32/32 ütközésmentes**.

Az élő felületet EHHEZ mérjük: `scripts/lang-switcher-visibility-check.mts`.
