# 2026-09-07 — Külső dizájn-beszerzés: brief külső designernek és külső AI-nak (ADR-0105)

**Státusz:** ✅ LEZÁRVA, LANDOLVA (`cc0327f` + a zárás commitja). Élesítés nem releváns
(docs-only, nincs futó felülete).

---

## Miből indult

Tulajdonosi kérés: *„Szeretnék még új mockfile arculat-típusokat is generáltatni más
mesterséges intelligenciákkal, illetve designerekkel. Írj egy olyan promptot, leírót, amivel
képbe kerülnek, hogy mivel foglalkozik a cég, és milyen design kell nekünk."*

Vagyis: **önhordó brief**, amit a kódbázis átadása nélkül be lehet másolni bármelyik AI-nak,
vagy elküldeni egy embernek.

## Amit csináltam

### 1. Tény-kinyerés a kódból (nem emlékezetből)

A brief minden állítása mérésből jött, nem feltételezésből:

| állítás | forrás |
|---|---|
| 16 art-template, ID + címke + kurált skinek | `src/engine/templates/*.ts`, `templates.ts` |
| 19 skin | `skins.ts:31–408` |
| 11 `--cit-*` token | `skins.ts:38–49` (a `Skin.tokens` rekord) |
| 9 szekció-típus | `recipe.ts:9–18` (`SectionKind`) |
| minta-adat | `scripts/template-shots.ts:17–86` |

⚠️ **Két csapdát fogott a kód-ellenőrzés**, amit emlékezetből elrontottam volna:
- A **template-ID ≠ archetípus-ID**: `editorial` / `fullbleed` (sablon) vs. `editorial-press` /
  `fullbleed-glass` (archetípus). Egy Explore-ügynök az archetípus-neveket adta vissza
  sablon-névként; a `templates.ts` regisztere írta felül.
- A `--citui-*` **nem** a generált vendég-oldalé (az a mi saját konzol/tenant-admin felületünké,
  CLAUDE.md §4). A vendég-oldal `--cit-*`-ot használ. Ezt a briefben elrontani azt jelentette
  volna, hogy minden beérkező terv rossz változó-készletet ad ki.

### 2. A tulaj dörgedelme és a javítás — ez a nap érdemi része

Az első változatba bemásoltam az `editorial-warm` skin 11 hex-értékét, mintha az volna az
előírás. Tulaj-reakció:

> *„Miért van fixált design token a kurva mock file-hoz? Hát nem ez korlátozza a WOW hatást és
> lesz teljesen gépies minden kibaszott mock?"*

**Jogos — a leírásomra, nem a rendszerre.** Így megfogalmazva minden beérkező terv ugyanabban a
barna-krém palettában született volna.

**Mielőtt vitatkoztam volna, megmértem**, mit engednek meg valójában a saját sablonjaink:

```
scrapbook   4 gradiens · 1 textúra           · 30× color-mix
artdeco     3 gradiens · 9 textúra/SVG       · 23× color-mix
aurora      –          · 7 textúra · 3 animáció · 21× color-mix
brutalism   1 gradiens · 3 textúra · 1 animáció · 11× color-mix
```

→ a **karakter a sablon saját CSS-ében** él, a 11 token csak a **palettát** adja.
És fordítva: az `--cit-accent` a szállás **saját fotóiból** mintázódik futásidőben, tehát a
beégetett hex az, ami uniformizálna (több ezer oldal a designer színeivel).

A javítás a briefben: a `:root` **üres szerep-lista** lett; új blokk sorolja fel, mi
KIFEJEZETTEN szabad (gradiens, textúra, zaj, blend, SVG-minta, maszk, filter, animáció,
parallax, saját változók, egyedi formák, duotone/szemcse fotó-kezelés); az egyetlen tiltás a
tokenből nem derivált beégetett hex.

**A döntés → ADR-0105** (a token-készlet marad 11 szerep; a bővítést a külső kör méri ki).

### 3. A wow-karok kimondva

A tulaj célja a maximális „wow", ezért bekerült egy §8.0: ① fotó-kezelés (a gyenge kép a fő
ellenség — duotone, szemcse, scrim-dramaturgia) ② tipográfiai bátorság — és **kimondva, hogy az
eddigi hero-számok alsó küszöbök, nem plafonok** (`clamp(48px,12vw,160px)`-ig bátran)
③ mozgás és mélység.

---

## 📁 Fájlok

**Új:**
- `docs/design-brief-external.md` — magyar mester-brief, 11 szakasz
- `docs/design-brief-external.en.md` — szerkezetileg 1:1 angol (25–25 szakasz, kereszthivatkozva)
- `docs/design-brief-sample-data.json` — SiteData minta: **dús** + `_starvedVariant` (adathiányos)

**Módosított (zárás):**
- `_planning/DECISIONS.md` — ADR-0105
- `_planning/memory/INDEX.md`, `MEMORY.md`, ez a jegyzet

## A brief tartalma dióhéjban

§0 feladat (önhordó HTML, nem kép) · §1 mi a cég + **miért a mock maga az értékesítési ajánlat**
(hideg lead, 3 mp) · §2 két közönség (tulaj telefonon / vendég gépen) · §3 átadandók · §4
kontraktus (11 szerep · 9 szekció · `data-cit-module` · no-JS · 390+1440) · §5 dramaturgia
(§B.19: csábítás→ajánlat→bizalom→konverzió; **teljes foglaló-űrlap az első képernyőn tilos**) ·
§6 tiltások · §7 a négy bukás-ok (tényhűség §B.17, generikus töltelék, **adathiányos ág**) ·
§8 wow-karok + alap-mérce · §9 a 16 foglalt irány + 8 javasolt szabad irány · §10 elfogadási
checklista · §11 jogi jelölő-sáv

## ⚠️ Nyitott / következő

1. **A mérés fut:** a brief kötelező átadandóként kéri, *mit nem tudott a tervező kifejezni a 11
   szerep alatt*. **2+ független terv ugyanabban a falban = ADR-trigger** a token-szótár
   bővítésére (várhatóan: második akcent-szín). Addig nem nyúlunk a `skins.ts`-hez.
2. **Próbakör ajánlott, mielőtt fizetős designernek megy:** 2-3 különböző AI-nak bemásolni,
   és a visszajövő HTML-eken mérni, hogy a brief érthető-e. Ingyen, és a briefet is csiszolja.
3. **A beérkező terv nem mehet egyenesen a motorba:** §2b terv-jóváhagyási kapu (ADR-0065/0081)
   érvényes rá — a külső HTML javaslat, nem kontraktus.
4. **Nem az én munkámból:** a landolás jelezte, hogy a **fő fában commitolatlan változás van**,
   ezért a közös `:4600` tesztfelület nem húzta be a mai main-t (ADR-0052 — ott nem fejlesztünk).
   Rendezendő, mielőtt bárki ott tesztel.

## Tanulság (a gépi memóriába is)

**A példa-érték a briefben ELŐÍRÁSKÉNT olvasódik.** Egy szerep-alapú kontraktust nem lehet
kitöltött példával átadni — a kitöltés lesz a specifikáció az olvasó fejében. Ha szerepet adsz
át, hagyd üresen. (Ugyanaz az osztály, mint a `feedback_check_the_prompt_before_the_guard`:
előbb nézd meg, mit KÉRTÉL, mielőtt a kimenetet hibáztatod.)
