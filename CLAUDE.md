# Vitrino — Globális Claude Code Konvenciók

⚠️ EZEK A SZABÁLYOK KÖTELEZŐEK. NEM OPCIONÁLISAK. MINDEN SESSIONBEN ÉRVÉNYESEK.

> **Mi ez a projekt?** Weboldal-motor: elavult vendéglátó/szállás honlapok (és Google Maps / foglaló-portál bejegyzések) adataiból és képeiből automatikusan modernizált, reszponzív, foglalható oldalakat generál. Célpiac: standardizált vertikumok (szállások, éttermek). Üzleti horog: hideg mockup-megkeresés → havidíjas, direkt-foglalós oldal (booking-jutalék kiváltása).

---

## 0. DEPLOY DOKTRÍNA (⚠️⚠️ MEGKERÜLHETETLEN — MINDEN MÁS ELŐTT)

Ez a szabály felülír mindent, beleértve a `bypassPermissions` engedély-módot is. A bypass CSAK a lokális, jóváhagyás nélküli munkára vonatkozik — élesre NEM ad felhatalmazást.

1. **Lokál először, mindig.** Minden változtatást ezen a Debian dev-gépen (`/home/mineral/vitrino`) fejlesztek és tesztelek. Élesre semmi nem megy, amíg lokálban nincs leellenőrizve.
2. **Push = csak a módosított fájlok.** Élesre KIZÁRÓLAG a konkrétan megváltozott fájlokat visszük, soha nem a teljes mappát. Listázd a fájlokat push előtt.
3. **Élesre csak külön, scope-olt engedéllyel.** Bármilyen élesi írás (fájl VAGY DB) CSAK a felhasználó explicit, az aktuális turn-ben adott engedélyével. Az engedély EGYETLEN push-műveletre szól, nem marad nyitva a következőre. Minden új élesi művelet előtt ÚJ engedélykérés.
4. **Élesi olvasás szabad** (diagnosztika), élesi mutálás soha engedély nélkül.
5. **Éles infra:** EGYELŐRE NINCS beállítva (a hoszting/deploy-cél későbbi döntés). Amíg nincs, minden „éles" művelet tárgytalan — de a doktrína életbe lép, amint van cél.

> A gépen globális PreToolUse hook (`block_live_deploy.sh`) blokkolja az élesi írást/deploy-t engedély nélkül — ez a repóra is véd. Override CSAK current-turn user-engedéllyel.

---

## 1. SESSION INDÍTÁSA (ELSŐ LÉPÉS — MÁS NEM TÖRTÉNHET ELŐTTE)

1. Olvasd el ezt a fájlt: `/CLAUDE.md`
2. Olvasd el: `/MEMORY.md` (projekt-összefoglaló)
3. Nézd át a `_planning/memory/` indexét (fejlődő vállalati memória)
4. Ha valamelyik nem létezik: jelezd és hozd létre üres sablonnal
5. Foglald össze 3-5 sorban: hol tartunk, mi volt az utolsó feladat
6. Kérdezd meg: min szeretne dolgozni

---

## 2. FELADAT VÉGREHAJTÁS UTÁN (MINDEN EGYES FELADAT UTÁN KÖTELEZŐ)

- [ ] ✅ Kész státusz jelzése
- [ ] 📁 Módosított / létrehozott fájlok listája (teljes útvonallal)
- [ ] 💡 Következő logikus lépés javaslata (ha van)

---

## 3. SESSION ZÁRÁSA (MIELŐTT A FELHASZNÁLÓ ELMEGY)

1. Emlékeztesd a felhasználót: `git add . → git commit -m "..." → git push`
2. Frissítsd a `/MEMORY.md`-t (projekt-összefoglaló)
3. Ha releváns, írj `_planning/memory/`-ba új memória-fájlt (dátum, elvégzett munka, módosított fájlok, nyitott kérdések)

---

## 4. KÓD KONVENCIÓK (SZIGORÚAN KÖTELEZŐ)

- ❌ Soha ne módosíts működő kódot, amit nem kértek
- ❌ Soha ne használj placeholder kommenteket (`// rest of code here`)
- ❌ Soha ne feltételezz DB tábla/mező neveket — mindig kérdezz
- ✅ Mindig teljes, copy-paste kész fájlt adj vissza
- ✅ Ha valami nem világos: előbb kérdezz, aztán csináld
- ✅ TypeScript `strict` mód; ESM (`import`/`export`); relatív útvonalak hordozhatóan
- ✅ Kód kommentek: **angolul**; kommunikáció: **magyarul**

---

## 5. TECHNIKAI KÖRNYEZET

- **Runtime:** Node.js 20+, TypeScript (strict, ESM)
- **Adatgyűjtés:** Playwright (headless Chromium — a gépen már telepítve), portál/Maps scraping
- **Generálás:** template-motor (közös „mag" + szállásonkénti adat-objektum → statikus/dinamikus oldal)
- **DB (tervezett):** PostgreSQL (multi-tenant)
- **Admin (tervezett):** önkiszolgáló felület — a tulaj szerkeszti a képeket/szövegeket (support-minimalizálás)
- **Lokális dev-gép:** Debian 13, `/home/mineral/vitrino`
- **Git repo:** github.com/olaszferenc/vitrino (privát)
- **Éles cél:** TBD (nincs még beállítva)

---

## 6. KOMMUNIKÁCIÓ

- Nyelv: **magyar**
- Stílus: tömör, lényegre törő
- Kód kommentek: angolul

---

## 7. ARCHITEKTÚRA-ELV (a motor „magja")

A rendszer lelke: **egy közös template + szállásonkénti adat-objektum**. Egy új szállás felvétele = egy új adat-rekord, nem új kód. A pipeline lépései:

1. **Ingest** — Google Maps + foglaló-portál (zimmerinfo, hovamenjek, stb.) → strukturált adat + kép-URL-ek + valós, egyedi jellemzők.
2. **Analyze** — képek stílus/paletta-kinyerés (vision) → arculat-preset + akcentszín.
3. **Generate** — template kitöltése az adattal + a szállás EGYEDI „mag"-szekciójával (nincs generikus töltelék; nincs emoji-ikon, saját SVG-készlet).
4. **Outreach** — mockup-link kiküldése a tulajnak (GDPR/Grt. tudatos, leiratkozással).
5. **Convert** — megrendeléskor a tulaj saját (tiszta, jogtiszta) képei + admin-hozzáférés.

⚠️ **Jogi őrszem:** portál/vendég-fotó CSAK demóra; élesre a tulaj saját assetjei vagy engedély. Hideg email = célzott, személyre szabott, leiratkozható (nem tömeg-spam).
