## ADR-0325 — Neo az Inas: digitális kurátor-munkatárs saját Chrome-mal; a sablont indoklással ő választja (ADR-0028 módosítása)

- **Tulaj-döntés (2026-10-04):** „Nem lehet olyan munkatársat készíteni, mint amilyen Marika a
  MineRealban, akinek a fő célja az lenne, hogy kurátori előkészítői feladatokat lásson el a
  böngészőben az admin oldalon?” — majd a tervre: „Mehet így! Neo az Inas, ez a neve.”
  Hatókör: **generálásig + jelentés**; a sablont **ő választja, indoklással**; **rögtön élesen**,
  szűk felhatalmazással.
- **A lényeg — perszóna, nem pipeline:** az első tervem a meglévő konzol-végpontok
  láncolása volt (újradúsítás, Places, keresés-API, vision-pontozás). A tulaj elutasította:
  „Ő feladatot lát el … fölmegy a Chrome-jába, végigkattingatja ugyanúgy, mint egy hús-vér
  ember … Nála van az ontológia.” Ezért Neo egy **saját, tartós RC-sessionben** élő
  munkatárs, **saját tartós Chrome-profillal** (chrome-devtools MCP, `~/neo/chrome-profile`),
  **saját éles konzol-fiókkal** (`neo`), és a felületen dolgozik: olvas, keres (Google egy
  böngészőfülön — nem fizetős API), néz, dönt. Charter: `neo/charter/CHARTER.md` +
  `RUNBOOK.md`; működési memória a fán kívül: `~/neo/`.
- **ADR-0028 módosítása:** a sablon-választás eddig kizárólag a kurátoré volt („egyelőre ezt
  nem bízhatjuk AI-ra”). Mostantól **Neo is választhat**, kötelező írásos indoklással a
  jelentésében; a tulaj felülbírálhatja. Az ADR-0028 többi része (a kurátori prompt csak
  hangot vezérel, tényt nem adhat hozzá — §B.17) változatlan, és Neóra is áll.
- **Éles felhatalmazás — mire szól és mire NEM:** Neo írásai a konzol **rendeltetésszerű
  kurátori kezelése** (kontakt rögzítése, nyitókép-választás, sablon + prompt, generálás,
  szöveg-újraírás / -szerkesztés), pontosan az, amit egy emberi kurátor tesz. Ez nem a
  CLAUDE.md §0 szerinti deploy vagy kódon/DB-n át történő éles mutáció; arra Neo NEM kap
  felhatalmazást (nincs SSH, DB, kód). ⛔ Tilos neki: kiküldés (e-mail/SMS/MMS/link),
  kurátori jóváhagyás/elutasítás, törlés, árazás/kedvezmény/számlázás/fizetés/tenant/
  domain/beállítás, operátor-fiók, fizetős gombok (Places-fotó, újradúsítás / újra-scrape).
- **Ismert gyengeség (vállalt, a nagy deployig):** a konzol ma nem ellenőrzi az
  `operator_user.role`-t — a `neo` fiók technikailag teljes jogú, a határt CSAK a charter
  tartja. Nyomkövetés: a `lead_hero_override.actor` rögzíti, ki választott nyitóképet, de a
  `curator_decision.decided_by` mindig `"console"`, és általános operátor-műveleti napló
  nincs. **Következő lépés a nagy deployjal:** kurátor-szerepkör szerver-oldali
  írás-kapuval (kiküldés / jóváhagyás / törlés / pénzügy nélkül) + operátor-műveleti napló.
  A MineREAL-ben (Marika) a határt a szerver ACL-je húzza meg — ez a cél itt is.
- **Visszafordíthatóság:** 🔄 könnyű — a `neo` fiók jelszó-cserével letiltható, a session
  archiválható; Neo minden döntését a jelentése rögzíti.
- **Státusz:** ELFOGADVA (tulaj, 2026-10-04).
