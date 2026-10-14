## ADR-0387 — A pirula-pár az első képernyőn látszó oldalsáv-kártya címére sem ül

**Dátum:** 2026-10-14 · **Kontextus:** az Elek éles teszt 2. köre (2026-10-14), L-1 lelet (`~/wt/cit1cfac043/_elek/JELENTES-2.md`, kép: `shots2/lead-01-open-d-fold.png`). **Kiterjeszti:** ADR-0382 (cím-akadály, fejléc-határ), ADR-0383 (képváltó-jelző). **Megtartja:** ADR-0377 ①② (fekvő: jobb sarok, egymás alatt), ADR-0242 ④ (gomb-kitérés), ADR-0382/0383 minden szabályát.

### Kiváltó (mérve, 21 sablon × 844×390 / 390×844 / 1280×800 / 1366×900 / 1440×900 / 1536×864 / 1920×1080 × nyugalom / süti-sáv = 294 állapot)
Asztalon a „14 nap ingyen” + „Itt rendelheti meg” pár a card-sidebar sablon jobb oldali foglalási kártyájának címére ült: 1366×900-on nyugalomban a „Foglalás”, süti-sávval a kártya neve, 1440×900-on ugyanígy, 1536×864-en nyugalomban a név (5 állapot; Elek valódi oldalán 1366×900-on „[TESZT…” eltakarva). Más sablon első képernyőjén nincs oldalsáv-kártya; 1280×800-on és 1920×1080-on a kártya címe nem esik a pár alá.

### Döntés
1. **Oldalsáv-kártya címe = akadály, de csak az első képernyőn és csak a címe.** Kártya = `aside` / `[role=complementary]` a saját felületünkön kívül (sablon-független, nem osztálynév); címe = az első szöveg-blokkja (név vagy értékelés-sor) és a címsorai (h1–h4, `…title` osztály), betű-szinten, mint a hős-cím. A mezői és a törzsszövege nem. Csak amíg az oldal a tetején áll (görgetés ≤ 4 px): görgetés közben minden más címsor is átúszik a lebegő pár alatt, és ha a kártyát követné, a pár görgetés közben felfelé kúszna, majd visszaugrana.
2. **Kitérés felfelé, ugyanabban az oszlopban — nem oldalra.** A kártya-cím a már kiválasztott helyet módosítja: a pár a cím fölé lép, ha ott semmilyen más akadály (hős-cím, gomb, képváltó-jelző) nincs és a fejléc alatt marad; különben marad, ahol volt. Mérve: ha a kártya-cím a többi akadállyal együtt az oldalválasztásba szólt bele, a pár 1366×900-on a bal sarokba ment a bevezető bekezdésre, 1440×900-on a jobb sarokba a kártya mezőire — mindkettő rosszabb.
3. **Mobilon változatlan:** ott a kártya nem az első képernyőn van.

### Eredmény (294 állapot, a javítás előtt és után ugyanazzal a mérővel)
5 állapot mozdult, mind a fenti hibás: a pár a kártya neve fölé lép (1366×900 nyugalom 828 → 739 px, süti-sáv 759 → 739; 1440×900 ugyanígy; 1536×864 nyugalom 792 → 739). A többi 289 állapot pixelre azonos. Kártya-címen 0 (eddig 5); hős-cím, hős-gomb, képváltó-jelző, keretező sáv 0.

### Megfigyelés, nem ennek a része (L-4, 10-01 óta)
A jobb szélső sötét sáv asztalon **nem a pirula fénye**: a csukott konfigurátor-fiók (`.cit-cfg-panel`, `assets/runtime/cit-configurator.css`) `transform: translateX(100%)`-kal a képernyőn kívül áll, de az árnyéka (`box-shadow: -18px 0 44px rgba(0,0,0,.4)`) csukva is ~60 px-re belóg a jobb szélen, a teljes magasságban. Javítása (pl. csukva `box-shadow: none`) külön döntés.

### Őr
`scripts/mock-trial-overlay-check.mts` ⑪ bővítve: minden sablon × 3 méret × nyugalom / süti-sáv: a pár nem metszi az oldalsáv-kártya címét (a runtime-tól független mérő); új menet 1366×900 és 1536×864 asztali mérettel, mindkét állapotban: kártya-cím, hős-cím, hős-gomb, fejléc; és a mérő látja a card-sidebar kártyáját (vak-őr ellen). `--self-test`: a `cit-cfg-trialfx-pillcard*` blokkok kivágásával piros.

### Visszafordíthatóság
🔄 könnyű — kliens-oldali elrendezés (`cit-configurator.js`); adat, séma, pénzút nem változott. Élesre a következő deployjal; a konfigurátor a `/p/<token>` kiszolgálásakor kerül a lapra, így a már kiküldött mockok is újrarenderelés nélkül megkapják.
