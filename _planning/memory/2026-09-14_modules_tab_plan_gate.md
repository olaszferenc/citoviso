# 2026-09-14 — Modulok fül (Elek FK-002): egy irány-hazugság javítva, 13 lelet a terv-kapunál

**Szál:** `wt/modulokful` (B5) · **Alap:** `origin/main` = `4535965` · **Élesítés: NINCS** (§0.3)

## Mi volt a feladat

Elek FK-002 köre a tenant-admin **Modulok** fülén — 15 lelet. A brief kimondta: ez kinézeti
döntést igénylő felület-munka, tehát a §2b terv-kapu kötelező, **kivéve** a tisztán apró
javításokat. A munka lényege a szétválasztás volt.

## ⛔ A legfontosabb tanulság: a MÉRŐ KERETE is hamisíthat

Az első méréshez a `modulesSection()`-t egy SAJÁT, egyszerű vázba renderelten mértem
(`body > .adm-wrap > .adm-main`). A termék valódi váza viszont `adminPage`-ből jön:
**248 px oldalsáv + `.adm-main__inner{max-width:900px;padding:34px}`**. A különbség nem
kozmetikai: az én vázamban a modul-sor ~1240 px széles volt és **egy sorban elfért**, ezért a
desktop-mérésem azt mondta, hogy a „Kikapcsolom" a sor jobb szélén ül (x=1091). A valódi
kerettel újramérve a gomb **1280 px-en is külön sorba, BALRA törik** (x=377, a Megnézem x=821
alatt). Vagyis egy „csak mobilos" hibának gondolt lelet valójában mindkét méreten él.
**A renderelt felület mérése is csak akkor mérés, ha a KERET is a termék kerete.**

## Amit szállítottam (landolva)

**Az egyetlen tisztán hibajavítás résztétel:** a fül bevezetője „Ami már az Öné, azt **fent**
találja"-t ígért, miközben mérve MINDKÉT blokk ALATTA renderel (390 px: 767 < 1064 < 5029 ·
1280 px: 573 < 717 < 2691). A bekezdés FÖLÖTT csak az Előfizetés-kártya van — a mondat egy nem
létező helyre küldte a tulajt. Javítva mindkét ágon (élő + fagyasztott): „azt **alább** találja;
amit még hozzáadhat, azt **utána**".

**Őr:** `scripts/modules-intro-direction-check.mts` (pre-commit). Nem emlékezetből őriz: az
irány-állítást a RENDERELT sorrendhez köti (bevezető → birtokolt blokk → kirakat), és csak az
ELSŐ tagmondatra tilt visszafelé mutató szót — a bekezdés hátsó fele jogosan hivatkozhat felfelé
(erre külön álpozitív-kontroll fut). Piros iker a két RÉGI mondaton, és a vissza rontott ÉLES
kódon is igazoltan `exit 1` `set -e` alatt.

**A §2b kivételt nem magamnak adtam** (ADR-0068): a brief szó szerint engedi az apró javítást;
a `surface-gate.mjs exception` bejegyzés szűkre szabottan rögzíti, hogy KIZÁRÓLAG erre szól.

## Amit a kapunál hagytam (13 lelet, 3 működő vázlat)

`TERV-KESZ.md` a munkafa gyökerében. Három önhordó, kattintható változat valós ELEK-adattal
(① Csendes lista · ② Számla-nézet · ③ Kártyák), változatonként telefon-keret + telefon teljes
lap + asztali teljes lap kép. Mindegyik a VALÓDI szabállyal számol (éves szorzó `12 −
annualFreeMonths`, számlázott halmaz egy forrásból, időarányos első díj).

⚠️ **A legfontosabb nyitott kérdés ütközik egy JÓVÁHAGYOTT KONTRAKTUSSAL:** a
`modules-annual-pricing` README §1 kimondja, hogy éves fiónál is a HAVI ár az elsődleges — a
szállítás ezt hűen teljesíti (mérve: havi 13,12 px/700/navy, éves 11,84 px/600/halvány). A
„legnagyobb szám az, amit fizet" elv viszont az éves összeget kívánja. Ezt nem dönthetem el
magam; a vázlatok az éves alakot emelik ki, de a kontraktus felülírása tulajdonosi döntés.

## Két hiba, amit a VÁZLAT saját maga termelt (mindkettő javítva)

1. **A termék asztali oldalsávja ráúszott a méret-váltóra.** `position:sticky;top:0;height:100vh`
   — a `container-type` containment a *scrollportot* nem írja felül, így a lap görgetőjéhez
   tapadt. Mérve: a kattintást a „Fotók" link fogta el. Csak az asztali ragadást oldottam fel.
2. **A ragadós sáv NEM tapadt, mert a vázlatban semmi nem görgött.** Egy „mindig látszó
   összegző" ígéret így a képen zöldnek látszana, miközben nem működik
   ([[reference_fullpage_shot_hides_dead_sticky]]). Ezért kapott a mock valódi, görgethető
   **készülék-keretet** (390×844 / 1180×860) és egy „Képernyő / Teljes lap" váltót.
   Ebben lett MÉRHETŐ a ③ változat ára: a sáv (120 px) + a termék mobil fülsávja (186 px)
   **együtt 306 px a 844-ből**, a tartalomnak 538 px marad.
3. ⛔ **A mobil fülsávot nem utánoztam, hanem a valós MAGASSÁGÚ helyfoglalót tettem oda**,
   kimondva: egy 5 elemű, 46 px-es másolat azt hazudta volna, hogy alig takar (a termékben 11
   fül, három sor, 186 px).

## Módosított fájlok

- `src/server/adminViews.ts` (1206–1216: a bevezető két mondata + a mérést rögzítő komment)
- `src/i18n/catalog.json` (2540 string, újragenerálva)
- `scripts/modules-intro-direction-check.mts` (ÚJ őr)
- `hooks/pre-commit` (az őr bekötve)
- `_planning/memory/` + `INDEX.md` + `MEMORY.md`

## Nyitott

- ① A terv-kapu 6 kérdése (`TERV-KESZ.md` §3) — köztük a kontraktus-ütközés (Q1) és a
  személynévre szóló `olasz.ferenc@citoviso.com` a fizetős felületen (Q4, `config.outreachSender`).
- ② A „Gépies „a(z)" ragozás" lelet az **A2 szálhoz** tartozik — szándékosan nem nyúltam hozzá.
- ③ A jóváhagyás után a terv befagy `assets/design-refs/console/…`-ba README-vel, és CSAK
  azután indul a kód.
