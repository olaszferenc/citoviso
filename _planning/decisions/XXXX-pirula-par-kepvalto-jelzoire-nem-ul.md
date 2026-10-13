## ADR-XXXX — A pirula-pár a hős-képváltó jelzőcsíkjaira sem ül

**Dátum:** 2026-10-13 · **Kontextus:** az ADR-0382 záró megfigyelése (a cinematic hős-képváltó három jelzőcsíkjára a pár a mainen ráér); a tulaj a koordinátoron át: „csináld úgy, hogy jó legyen”. **Kiterjeszti:** ADR-0242 ④ (gomb-kitérés), ADR-0382 ② (két menet). **Megtartja:** ADR-0377 ①② (fekvő: jobb sarok, egymás alatt), ADR-0382 ①③④ (cím-akadály, fejléc-határ, határra állás).

### Kiváltó (mérve a mai mainen, efa76d98, 21 sablon × 844×390 / 390×844 / 1280×800 × nyugalom / süti-sáv)
A `blockingRects` csak a ≥ 100 px széles, ≥ 32 px magas gombot látja akadálynak; a cinematic jelzői szöveg nélküli 44 px-es koppintási felületek (a rajzuk 4 px-es csík). A pár 3 állapotban ült rajtuk: fekvőn nyugalomban, állón nyugalomban, asztalon süti-sávval. Más sablon első képernyőjén nincs képváltó-jelző.

### Döntés
1. **Képváltó-jelző = akadály**, mint egy gomb, mindkét menetben (cím-menet és csak-gomb menet) és a határra állás gomb-próbájában: legalább 2 testvér, szöveg és kép nélküli, látható vezérlő (`button`, `[role=button]`, `[role=tab]`, `a`), egyenként ≤ 60 px; az akadály a sor teljes doboza (csíkok + koppintási felület). Sablon-független felismerés, nem `cn-dots` osztálynév.
2. A pár ugyanúgy kitér, mint gombnál: előbb oldalt, aztán fölfelé (a cím- és fejléc-szabály változatlan).
3. **Oldalválasztás fölfelé lépéskor** (módosítja az ADR-0242 ③-at: eddig mindig az első oldalon lépett fel): ha minden oldal foglalt, a pár egy másik oldalon lép fel, ha oda a hős-cím egyáltalán nem nyúlik be, és ott kevesebbet kell emelkednie. Kiváltó: cinematic 1280×800 süti-sávval — a jobb sarkot a jelzősor foglalta, a közép-oszlop a „Balatonnál” mellé emelte a párt, miközben jobbra, a csíkok fölött üres volt a kép. A „mindig a legkisebb emelés” szabályt mérve elvetettük: a fullbleed, horizontal, artdeco asztalin a párt a cím vagy a bevezető mellé szorította (6 px-re a betűktől), ahol eddig tisztán a cím fölött állt.

### Eredmény (mérve, 21 sablon × 3 méret × nyugalom / süti-sáv = 126 állapot)
Jelzőcsíkon 0 (eddig 3); cím, keretező sáv, hős-gomb 0. Elmozdulás csak a cinematic 3 korábban hibás állapotában: fekvőn nyugalomban a sarokban a csíkok fölé lép (282 → 211 px), állón nyugalomban a cím fölé (782 → 411 px, mint a többi sablonon süti-sávval), asztalon süti-sávval jobbra, a csíkok fölé (659 → 621 px). A többi 123 állapot pixelre azonos.

### Őr
`scripts/mock-trial-overlay-check.mts` ⑪ bővítve: minden sablon × 3 méret × nyugalom / süti-sáv: a pár nem metszi a képváltó-jelzősor dobozát (a runtime-tól független mérő), és a mérő a cinematic jelzősorát látja (vak-őr ellen). `--self-test`: a `cit-cfg-trialfx-pilldots*` / `pillsweep` blokkok kivágásával piros.

### Visszafordíthatóság
🔄 könnyű — kliens-oldali elrendezés (`cit-configurator.js`); adat, séma, pénzút nem változott. Élesre a következő deployjal megy.
