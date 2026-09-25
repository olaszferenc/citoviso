# 2026-09-25 — Az „egész szállás” választható egység (ADR-XXXX) + sidebar-görgető + „Mikor nem kiadó?”

**Session:** cit2d46298c · **Tulaj-bejelentés:** a Boróka-admin képernyőiről (3 kép): stock görgető
a sidebaron; a naptár címe legyen „Mikor nem kiadó?”; az „egész ház” koncepció rossz — átnevezett
„Apartman 1” beleégetve az egész ház, szoba nem törölhető, a felszereltségnél „kavar”.

## Mi történt

1. **Két apró tétel** (§2b-kivétel, a tulaj szavával): a `.adm-nav` vékony, tokenszínű görgetőt kapott
   (`citui-admin.css`); „Mikor van tele?” → „Mikor nem kiadó?” (felület + KB + katalógus + KB-kép;
   a booking-screen kontraktus README-jébe dátumozott megjegyzés).
2. **A premissza tisztázása** (ADR-0209 tanulsága): a tényállást a kódból mértem ki — az
   `ensureUnits()` vissza-jelölte az első egységet egésznek, ezért a két-apartmanos tulajnál az
   Apartman 1 foglalása zárta az Apartman 2-t. A tulaj döntése: VÁLASZTHATÓ egész + a ház-tételek
   a szobánál is kapcsolhatók.
3. **§2b terv:** a jóváhagyott D szoba-szerkesztő `plan.html`-jéből patch-szkripttel származtatott
   vázlat (`_drafts/build-egesz-haz.py`, két modell A/B, két adat Eldorádó/Boróka), 39 állítás × 2
   méret Playwrighttal (`_drafts/check-egesz-haz.mts`), 13 kép → tulaj: **B** (kártya a rács fölött).
   Ár-kérdés: **saját ár, sosem szumma** + tulaj-oldali tájékoztató sor — „igen jó ötlet. Mehet így”.
   Befagyasztva: `assets/design-refs/tenant-admin/whole-property-choice/`.
4. **Kód:** `units.ts` (vissza-jelölés törölve `ensureUnits`/`peekUnits`; `setWholeProperty`; az
   egész törölhető), `public.ts` (`/admin/units/whole`; a 2. egység kérdése a save-ben; törlés
   `back`), `editor.ts` (vendég-kártya `wholeProperty` csak 2+ egységnél), `moduleConfigViews.ts`
   (`wholePropertyCard`, `wholeQuestion`, `roomMeta` multi-tudatos, törlés minden egységen,
   felszereltség-választó: ház-tétel kapcsolható + „a ház egészénél is” címke, `wholeSumHint` az
   Árak lapon), CSS (`.rs-wcard`, `.rs-wq`, a zárolt csempe stílusa törölve).
5. **Őrök:** ÚJ `whole-property-choice-check.mts` (①–⑦, saját fixtúra, HTTP; pre-commit-be kötve);
   `amenity-picker-check` átírva (kapcsolható + jelölt); `whole-property-check` ⑥ átírva (az egész
   törölhető, utána a szobák függetlenek; önteszt zöld). Zöld: room-editor, booking-screen,
   price-on-request, amenities-house-list, unit-subpage, module-dependency.
6. **Súgó:** rooms/booking/pricing entry átírva a valódi feliratokkal, képek regenerálva; kb-check zöld.
   DOMAIN `02-ENTITY-MAP` bekezdés frissítve.

## Tanulság

- A 09-08-i rendelet („az egész szállás mindig van”) a KIZÁRÁSRA vonatkozott — a kényszer és az
  adat szétválasztása tartja meg a védelmet ott, ahol a tulaj tényleg egyben is kiad.
- A kb-shot regenerálása 5 IDEGEN konzol-képet is átírt (nem determinisztikus vagy a fő fa drift-je)
  — kétszer visszaállítottam; csak az érintett entry-k képei mentek be.
- A `block_worktree_ports.sh` hook egy README-heredoc-ra is tüzelt (hamis pozitív) — Write-tal ment.

## Nyitva

- A naptár jelvénye („nincs tele nap” / „N tele nap”) maradt a régi szóval — a tulaj döntése kell,
  ha azt is át akarja írni.
- A B-kártya select-je JS nélkül kikapcsolt állapotban is aktív (a terv tiltotta) — a szerver
  kezeli; JS-rátét később, ha zavar.
- Élesítés: nem történt; verzió-deploy külön engedéllyel (§0.3).
