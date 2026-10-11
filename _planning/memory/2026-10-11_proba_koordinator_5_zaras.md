# 2026-10-11 — Ingyenes próba koordinátor (5. folytatás) lezárva: C felület + névváltás + Elek 3. kör, minden landolt

**Szál:** ingyenes próbaidőszak koordinátor (fa `~/wt/citf3e80964`), előd 27a7ea6a. Élesre ebből SEMMI nem ment.

## Elvégezve (mind origin/main-en, szemantikusan ellenőrizve)
- **Próba „C” kedvezmény-elv, felület** (ADR-0354 kiegészítve; terv befagyasztva `assets/design-refs/console/proba-c/`, README köt):
  tulaj-döntések 2026-10-10: 1=A (határidő az ár-sorban, szalag nincs) · 2=„Folytatom” · 3=A (próba-levélből jövőnek nincs felugró kártya) ·
  4=szövegek OK (kampány-levél gombpár „Kipróbálom 14 napig ingyen” + „Megnézem a tervemet”, kampány-SMS %-kal) — `54dbb2f7`, `6b145c2d`
  (nyugta/számla „Próba-kedvezmény (N%)”, a/az névelő a szám kiejtése szerint). Egy forrás: `trialDiscount()` (`src/trial/offer.ts`).
- **Névváltás a próba végén** (ADR-0356, tulaj: A = a régi cím ÖRÖKRE 301 az újra, foglalva marad): `site_slug_alias` (migráció 0104),
  `renameSiteSlug()`, 301 a host-feloldásban — `6013c321`; őr `slug-rename-check`.
- **Elek 2. kör javításai** (ADR-0355, 0357, 0358): szünetel-lap elérhetősége, admin levelek, modulszámok, terv-lap, terv-link saját tartalom.
- **Elek 3. kör** (lokál, scratch-DB): 2 BLOKKOLÓ + 4 KÖZEPES + 9 APRÓ → mind javítva (ADR-0359, `2211493b`…`62f98515`):
  B1 a választott ingyenes aldomain MINDEN vásárlásnál elveszett (`server.ts` csak saját domainnél rögzítette) · B2 a próba azt a %-ot rögzíti,
  amit az űrlap kiírt (forras=proba → nincs eszkaláció) · K1 trial_grant modul nem számlázott · K2 pénztárca éves összeg · K3 T−3 és T−1 mindig
  kimegy (hétvége → előző hétköznap) · K4 próba alatt nincs egyedi modulvétel · A9 a preview-host a KIKÜLDÖTT prospectet nyitja.
- Koordinátori döntések (tulaj nem kérdezve): B1-K2 kérdés az ADR-0354-gyel tárgytalan; névváltás után a felhasználónév MARAD; A3 tájékoztató sor marad.

## Élesítési helyzet (mérve 2026-10-10)
Éles = `4dc8a9d7` (2026-10-09 12:54), a próba ALAPJA benne van; a main ~70+ committal előrébb (C, névváltás, Elek-javítások NINCSENEK élesen).
⚠️ Az aldomain-választás elvesztése (B1) élesen most is él → érdemes hamar élesíteni (`deploy-prod.sh` dry-run → tulaj „mehet”).

## Nyitott / következő
- **Élesítés** a mostani mainnel — tulaj külön engedélye; migráció 0104 is megy.
- Visszamenőleges „14 napig ingyen” kampány (ADR-0348) — élesítés után, tulaj „mehet”, hétköznap 9–16; Melinda Apartman + Gemini `--kizar`.
- **ÚJ TULAJ-ÖTLET (másik session):** aki a 14 napos próba ALATT előfizetési csomagot vesz, annak egy `.hu` domain 1 évig ingyen.
  Előtte visszaolvasandó: ADR-0109 (saját cím 1 000 Ft/hó, 12 hó hűség), ADR-0354 (egy kedvezmény-elv — ütközik-e?), ADR-0356, regisztrátor-kulcsok csak devben.
- Nem sürgős: süti-sáv az adminon (ADR-0145, tulaj szűkítheti) · „Citoviso készítette” lábléc (üzleti) · IT kampány-szélek D-1c/D-5i/D-7f/D-8k ·
  help-collapse-check terhelés alatti flake (kapu-gazda) · `uniqueSiteSlug` `-2` ága túllépheti a 40 karaktert.

## SUB-ok (mind nyugdíjazva)
5503e761 (kampány-javítások) · 6f669883 (Elek2 javítások) · da074c49 → 6fcaf10a → c93f3543 (C) · 6029504c (Elek 3. kör) · 00751066 (Elek3 javítások).
Leletek és képek a koordinátor fájában: `_from-sub/` (gitignore).

## Módosított fájlok (ez a session)
`MEMORY.md`, `_planning/memory/2026-10-11_proba_koordinator_5_zaras.md`, `_planning/memory/INDEX.md` (generált).
