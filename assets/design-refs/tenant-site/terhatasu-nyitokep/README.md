# Tenant-oldal / mock — térhatású nyitókép (JÓVÁHAGYOTT, 2026-11-23)

**Státusz:** a tulaj jóváhagyta · **Kapu:** CLAUDE.md §2b · **Döntés:** ADR-XXXX ·
**Megvalósítás:** `src/engine/depthHero.ts` · **Őr:** `scripts/depth-hero-check.mts`

- Terv (kattintható, a valódi futtatóval): `terhatas-JOVAHAGYOTT.html` · képek: `terhatas-{mobile,desktop}.png`

**Ez a fájl KONTRAKTUS.** A jóváhagyás valódi oldalakon született (a vázlatok a land után
törlődnek, újragyárthatók a `~/.cache/citoviso-depth/` eszközeivel):
- parallax: Vénusz Apartman, Vaszary Apartman, Főnix de Lux Apartman (2026-11-23-án kiküldött mockok);
- gate-opening: Szamos-Lak; wordmark-grow: Erika Vendégház (ki nem küldött mockok).

## Amit köt
- **Paraméterek:** sebesség 1,5×, erősség 2× az első vázlathoz képest (14 mp-es ciklus,
  0,022-es eltolás). Tulaj: „1,5 és 2 az indexek”. 3×-os erősségnél a vékony tárgyak szellemképesek.
- **A mozgás:** lassú, oldalirányú ingás + enyhe közelítés; a közeli tárgyak jobban mozdulnak,
  mint a távoliak. Asztali gépen az egér is mozdítja a nézőpontot.
- **Indulás:** 1,5 mp alatt fokozatosan, az állóképből (nincs ugrás). parallax: azonnal;
  gate-opening: a kapuszárnyak MÖGÖTT, a kapu megnyugvása után (2,4 mp); wordmark-grow: a
  belépő animáció UTÁN (kiküldött mockon nincs belépő, ott azonnal).
- **Rétegrend:** a vászon a hero-kép helyén van; minden, ami fölötte volt (sötétítés, cím,
  gombok, kapuszárnyak), fölötte marad.
- **Állókép marad:** csökkentett mozgás, `data-cit-no-motion`, nincs WebGL, olvashatatlan
  (CORS nélküli) textúra, nincs vagy elavult mélységkép.
- A **már kiküldött mockok nem kapnak** utólag térhatást; az új kiküldésekben **kísérletként**.
