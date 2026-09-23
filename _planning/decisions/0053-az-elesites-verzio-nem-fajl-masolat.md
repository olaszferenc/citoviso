## ADR-0053 — Az élesítés VERZIÓ, nem fájl-másolat

- **Kiváltó (tulaj, 2026-08-22):** *„akkor azon is változtatni kell, hogy ha azt mondom élesre
  mehet, az ne csupán file másolás legyen?"*

**Amit a mérés mutatott (2026-08-22, olvasás az éles gépről):** az `/opt/citoviso/app` **nem
git-checkout**. Fájlonként visszakeresve a git-történetben: **122 fájl kint, 142 a `main`-en** →
**20 fájl soha nem ment ki** (booking, reviews, tudásbázis, modul-konfig, egységek/árak, a teljes
portál-scraper réteg); **47 fájl tartalmilag eltér**; **0 fájl van élesben, ami ne lenne a gitben**
(kézzel senki nem szerkesztett élesben — ez a jó hír). A kint lévő fájlok viszont **8 különböző
dátumból** valók (2026-07-06-tól 08-21-ig).

**Vagyis az éles egy olyan fájl-kombináció, ami egyetlen commitban sem létezett soha** — tehát
olyan állapotot futtat, amit sehol nem teszteltünk. Most éppen konzisztens (mindkét service aktív,
24 óra alatt 0 hiba, nincs hiányzó modul-hivatkozás), de ez szerencse, nem garancia.

**A gyökérok:** a §0.2 „push = csak a módosított fájlok" szabály ezt **termeli**. Minden deploy
néhány fájlt másol a saját munkafájából, a többi ott marad, ahol volt. Minden egyes deploy
külön-külön helyesnek látszik; a kollázs a sokadikból áll össze.

**Döntés**

1. **Élesre egy MEGNEVEZETT COMMIT megy, nem fájlok.** A deploy = `git fetch` + a felcímkézett
   commit kicsekkolása. A „mi fut élesen?" innentől egyetlen parancs, és nem állhat elő olyan
   kombináció, amit sehol nem teszteltünk.
2. **A verzió fel van írva az éles gépre** (tag/commit-hash), hogy a kérdés a gépről is
   megválaszolható legyen, ne csak a deploy-naplóból.
3. **A §0.2 felülírva.** Az eredeti szabály célja — ne söpörjük le az élest, legyen látható, mi
   megy ki — egy átnézett, felcímkézett commit kicsekkolásával **jobban** teljesül, nem rosszabbul:
   a diff a két tag között pontosan az, ami változik, és visszagördíthető. A §0 többi pontja
   (lokál először; élesre CSAK az aktuális turn-ben adott, scope-olt engedéllyel; élesi olvasás
   szabad) **változatlanul érvényes**.
4. **Az engedély-kapu nem lazul.** Az „élesre mehet" továbbra is a tulaj külön, kimondott
   utasítása, egyetlen műveletre. A változás az, hogy MI megy ki (verzió), nem az, hogy KI dönt.

**Visszafordíthatóság:** 🔄 az első checkout előtt az `/opt/citoviso/app` teljes mentése; a
visszaállás egy korábbi tag kicsekkolása.

**Nyitott (implementáció):** a git-hozzáférés módja az éles gépen (deploy key vs. artefakt),
a `.env` és a `sites/` kezelése a checkouton kívül, a service-újraindítás sorrendje, és az első
szinkron (az éles jelenleg 20 fájllal kevesebbet futtat, mint a `main` — ez nem sima checkout,
hanem egy átnézendő, nagy ugrás).
