## ADR-0105 — Külső dizájn-beszerzés: a token-készlet 11 SZEREP, nem paletta; a bővítést a külső kör MÉRI ki

**Dátum:** 2026-09-07 · **Státusz:** elfogadva (tulaj) · **Kapcsolódik:** ADR-0016 (kompozíciós
motor), ADR-0017 (skin-passz), ADR-0027 (template-first), 06-UI-CONTRACT (token-kontraktus)

### Kontextus

A tulaj új mock-arculatokat (template-eket) akar rendelni **külső designerektől és külső
AI-októl**, a kódbázis átadása nélkül. Ehhez brief kellett.

A brief első változatában a token-szakaszba **egy konkrét palettát** másoltam be — az
`editorial-warm` skin 11 hex-értékét (`skins.ts:31`) —, mintha az volna az előírás, és mellé
csak annyit írtam, hogy „nyers hex tilos". A tulaj ezt azonnal elkapta:

> *„Miért van fixált design token a mock file-hoz? Hát nem ez korlátozza a WOW hatást és lesz
> teljesen gépies minden kibaszott mock?"*

**A kifogás jogos volt** — nem a rendszerre, hanem a leírásomra. Így megfogalmazva minden
beérkező terv ugyanabban a barna-krém palettában született volna.

### Mérés (nem vélemény)

A saját karakteres sablonjaink megmérve, hogy mit engednek meg valójában:

| sablon | gradiens | textúra / SVG-háttér / blend | animáció | tokenből derivált szín |
|---|---|---|---|---|
| `scrapbook` | 4 | 1 | – | 30× `color-mix` |
| `artdeco` | 3 | **9** | – | 23× |
| `aurora` | – | 7 | 3 | 21× |
| `brutalism` | 1 | 3 | 1 | 11× |

**Következtetés:** a karakter (deco-ornamens, papír-textúra, marquee, aurora-glow) a sablon
SAJÁT CSS-ében él; a 11 token csak a **palettát** adja neki. A token-készlet tehát nem
korlátozza a textúrát, a mélységet vagy a mozgást.

**És a fordítottja:** az `--cit-accent` futásidőben a szállás **saját fotóiból** mintázódik
(`palette.ts` `harmonizeAccent`). Ha egy külső terv beégeti a hexet, akkor több ezer szállás
oldala a designer színeivel megy ki, egyformán. **A token nem uniformizál — az akadályozza meg
az uniformitást.**

**Ami viszont VALÓS korlát:** egy akcent-szín van. Nincs második akcent, gradiens-token,
textúra-slot. A sablonok ezt `color-mix`-szel kerülik meg (egy színből származtatnak
árnyalatokat) — de egy „két erős szín egymás ellen" terv ezt megérzi.

### Döntés

1. **A token-készlet marad 11 szerep.** Nem bővítünk spekulatívan: a bővítés ára 19 skin
   kiegészítése + a fotó-mintázó megtanítása két *harmonizáló* színre + 16 sablon
   felülvizsgálata. Bizonyíték nélkül ez ugyanaz a hiba lenne, mint őrt élesíteni azelőtt,
   hogy megnéznénk, mit kértünk (lásd ADR-0091 tanulsága).
2. **A külső brief SZEREP-NEVEKET ad át, nem értékeket.** A `:root` blokk üres szerep-listaként
   szerepel; a paletta a tervezőé. Kimondva: *„a §4 kontraktus nem a designt köti meg, hanem
   azt, hogy a designod átszínezhető és adatból tölthető legyen."*
3. **A brief KIFEJEZETTEN megengedi** (és kéri) a gradienst, textúrát, zajt, `mix-blend-mode`-ot,
   SVG-mintát, maszkot, `filter`-t, animációt, parallaxot, saját CSS-változókat, egyedi formákat
   és fotó-kezelést (duotone, szemcse, maszkolt forma). **Egyetlen tiltás:** tokenből nem
   derivált, nem semleges beégetett hex.
4. **A bővítés kérdését a külső kör MÉRI KI.** A brief kötelező átadandóként kéri:
   *„sorold fel, mit NEM tudtál kifejezni a 11 szerep alatt."* **Ha 2+ független terv ugyanabba
   a falba ütközik** (várhatóan: második akcent-szín), **az az ADR-trigger a szótár bővítésére**
   — valós indoklással, nem sejtésből.
5. **A wow-karok kimondva a briefben**, mert nagyobb tételek a token-vitánál: ① fotó-kezelés
   (a gyenge kép a fő ellenség) ② tipográfiai bátorság — a hero-számok **alsó küszöbök, nem
   plafonok** ③ mozgás és mélység (`prefers-reduced-motion` mellett).

### Következmények

- Artefaktumok: `docs/design-brief-external.md` (HU mester), `docs/design-brief-external.en.md`
  (szerkezetileg 1:1 angol), `docs/design-brief-sample-data.json` (a `template-shots.ts` demó
  SiteData-ja **dús** és **adathiányos** csomagban).
- **Az adathiányos változat kötelező átadandó** (ADR-0097 következménye: a leadek ~85%-a ilyen).
  A brief kimondja: ha a formanyelv csak 6 fotóval és 3 szobával működik, használhatatlan.
- A minta-adat **magyar marad** — az angolra fordított minta hamis képet adna a valós
  szöveghosszakról (a fordítások 30–40%-kal hosszabbak, és pont ez töri szét a szűk elrendezést).
  Helyette angol mezőnév-szótár van a briefben.
- A beérkező terv nem kerülhet a motorba §2b terv-jóváhagyási kapu nélkül (ADR-0065/0081):
  a külső HTML **javaslat**, nem kontraktus.

### Tanulság (általánosítható)

**A példa-érték a briefben ELŐÍRÁSKÉNT olvasódik.** Egy szerep-alapú kontraktust nem lehet
kitöltött példával átadni — a kitöltés lesz a specifikáció az olvasó fejében. Ha szerepet adsz
át, hagyd üresen.
