# 2026-09-13 — A néma hiba pirosra visz; és kimenő kép nélkül nincs páros-indítás

**ADR:** ADR-0131 · **Kiváltó:** Elek FK-004 kör (2026-09-13), H1 lelet
**Ág:** `wt/mms404` · **Kontraktus:** `assets/design-refs/console/mobile-pair-outreach/` (ADR-0083)

## Amit a lelet mondott

A `result.jsonl` KÉTSZER rögzítette ugyanazt — `404 …/prospect/9ee2604d…/mms-preview.jpg`,
konzol- ÉS HTTP-hibaként, a 4. és a 7. lépésen. **Mindkét lépés `pass` lett.** A hibát nem a
mérőeszköz találta meg, hanem egy friss szemű kiértékelő, aki elolvasta a naplót.

## ① A termék-hiba — mérve, nem feltételezve

A kiváltó ok NEM hiányzó generálás és nem rossz útvonal volt:

```
[heroShot] 92f94d25…: first-screen image failed to load (attempt 1/2 és 2/2):
https://hovamenjek.hu/upload/places/11235_…/main/balatonboglar-erzsebet-vendeglo-fogado3.jpg
→ ensureHeroShot → null → a route 404
curl ugyanerre az URL-re: 404 (permanens, a portálon)
```

A `heroShot` tehát **helyesen** tagadta meg a cache-elést (üres hero-képpel már ment ki MMS
2026-08-30-án). A hiba a FELÜLETEN volt: a lap feltétel nélkül linkelte a képet, és a törött-kép
ikon alatt ott állt az **élő „Páros indítása" gomb** — valódi SIM, visszavonhatatlan MMS.
A küldés maga fail-closed volt (`sendOutreachPair` kép nélkül megtagadja): **csak a képernyő
hallgatott.** Ez az ADR-0082 tanulsága fordítva — az állapotot a kattintás ELŐTT kell kimondani.

**Szállítva:** `heroShotState()` (DB-sor + két `stat()`, böngésző nélkül — elég olcsó minden
rendereléshez); `<img>` CSAK `ready` állapotban; egyébként kimondott ok (a törött URL-lel),
`disabled` gomb „(nincs kép)" felirattal, eltűnő egygombos sáv; a `/mms-preview.jpg` route
**csak cache-ből** szolgál ki (eddig egy `<img>`-kérésen belül futtatott 2×30 mp Chromiumot);
háttér-render + állapot-POLL (nem időzített teljes újratöltés — az letörölné a `?kuldes=`
visszaigazolást); bukás után csak kimondott „Kép előállítása újra" gomb (**mérve: 3 lapmegnyitás
= 1 render**, nincs 40 mp-es Chromium minden nézetre).

## ② A mérőeszköz-hiba

A runner GYŰJTÖTTE a konzol-/HTTP-hibákat, majd az ítéletnél eldobta őket. Mostantól:
egy lépés nem lehet zöld, ha hiba keletkezett rajta. Jogos hiba létezik (a fagyasztott honlap
ADR-0080 szerint SZÁNDÉKOSAN 503-at ad) → `tűrt-hiba: <minta> — <indok>`, **kötelező indoklással**
(indok nélkül a parser dob; a puszta minta néma bukás-engedély lenne). Az átengedett hiba a
naplóban marad az indokkal (`tolerated_errors`), a semmire nem illeszkedő minta kiíródik
(`tolerated_unused`).

**Mért mellékhatás a készleten:** 20 korábbi futás átnézve — összesen 3 helyen volt zaj: a
FK-004 404-e (valódi hiba), az FK-006a 503-a (jogos → ez lett az egyetlen kivétel), és egy régi
FK-004b elavult tokene (a friss futásban már nincs). A szabály tehát **nem árasztja el pirossal
a készletet** — pont azt a hármat emeli ki, amit ki kell.

## Amit menet közben MÉRTEM, és nem gondoltam volna

- **A tiltott gomb élőnek NÉZETT KI.** A `.con button[type=submit]` navy gradiense a `disabled`
  állapotra is ráült; a `.con button:disabled` szabály nem létezett, miközben a dizájn-magban
  `.citui-btn:disabled` megvan. Csak a 390px-es képen látszott.
- **A hosszú URL kilógott a piros dobozból** 390px-en: az operátor a bukás okának a felét látta.
  → `overflow-wrap:anywhere` a nyers gépi szöveget hordozó dobozokra.
- **A Playwright `clip` fullPage nélkül a VIEWPORT-ra vág:** az 1151px magasnak kért közeli kép
  390×158-ként született, és „jónak" látszott volna egy futó pillantásra.
- **Az első őr-változatom a token-illesztésen bukott:** a `503 /t/elek-teszt-vendeghaz/` minta
  egyetlen részszövegként SOHA nem illeszkedik, mert a rögzített szövegben a status és az
  útvonal között ott ül az efemer host. Az egyetlen valódi kivételünkön bukott meg — ha nem
  írok rá állítást, a kivétel-mechanizmus élesben lett volna használhatatlan.

## Nyitott

- **Az ELEK-TESZT látványterv nyitóképe halott URL a portálon** — tehát nemcsak az MMS-kép nem
  áll elő, hanem a LEADNEK kiküldött mock nyitóképe is törött. Adat-frissítés, külön feladat.
- Az FK-006a `tűrt-hiba:` sora **nem futott le élesben** (az időutazó tiltott volt ebben a
  szálban); a minta illeszkedését a valódi, rögzített hibaszövegen egység-szinten igazoltam.

## Módosított fájlok

`src/outreach/heroShot.ts` · `src/console/server.ts` · `src/console/views.ts` ·
`public/assets/ui/citui-console.css` · `src/elek/stepVerdict.ts` (új) · `src/elek/fkParse.ts` ·
`elek/bin/runner.mts` · `elek/bin/report-html.mts` · `elek/charter/SCENARIO-FORMAT.md` ·
`elek/scenarios/FK-006a-dunning-frozen.md` · `scripts/mms-preview-gate-check.mts` (új) ·
`scripts/elek-noise-verdict-check.mts` (új) · `hooks/pre-commit` · `_planning/DECISIONS.md`
