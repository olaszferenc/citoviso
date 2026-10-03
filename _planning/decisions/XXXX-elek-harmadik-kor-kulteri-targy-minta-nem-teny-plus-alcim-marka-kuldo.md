## ADR-XXXX — Elek 3. kör: a forrás nélküli kültéri tárgy blokkol, a MINTA nem tény, a plus-alcím egy címzett, a márka nem személynév (2026-10-03)

**Dátum:** 2026-10-03 · **Státusz:** elfogadva (hibajavítás mérés alapján + tulaj-döntések „1 igen · 2 Citoviso · 3 igen”;
SUB, koordinátor: CIT „élesi teszt” fő session; brief `~/rc-briefs/javitas-elek-0930/k3-elek3-leletek.md`) ·
**Forrás:** Elek 3. élesi köre (éles = `6179595c`): SZ3-1 (MAGAS), OP3-1 (KÖZEPES), BLK-1/1.11 (plus-alcím), INFO (aláírás) ·
**Kapcsolódó:** ADR-0292, ADR-0309 (vendég-kritikus), §B.17, ADR-0061 (minta-jelölés), ADR-0122 (cím-szintű egy-lövés),
ADR-0130 (§C.2 küldő-azonosítás).

### ① SZ3-1 — a forrás nélküli kültéri TÁRGY blokkol
**Lelet.** Az Erika villa mockján háromszor ment ki: „a házhoz **kerti pihenő és bútorozott terasz** tartozik” (bemutatkozó,
kiemelés, főcím). A forrás csak csendes környéket, strand-közelséget és felszerelt szobát mond; a fotón rendezett kert, egy
virágos pergola és egy erkély egy műanyag székkel. Az ADR-0309 részlet-szabálya (szolgáltatás + hely/minőség) nem sült el,
mert a tagmondatban nem volt szolgáltatás; a kritikus promptja a fizikai tárgyat kifejezetten kivette, a fotó-szűrő pedig
eldobta volna a kifogást.

**Döntés.** Fotón egyértelmű SZERKEZET (medence, kert, udvar, erkély, kilátás, napozóágy, szobabútor) továbbra is a fotó dolga.
A vendég által HASZNÁLNI kívánt kültéri OBJEKTUM (terasz, kerti bútor / „bútorozott”, kerti pihenő / pihenősarok, grill,
bogrács / kemence, jakuzzi / dézsa, szauna, játszótér / hinta / trambulin, függőágy, stég) forrásköteles: kell EGY
forrás-egység, ami megnevezi. Gépi szabály: `lintAddedObject` (blokkoló `tulzas_a_forrashoz`); a bútor csak kültéri főnévvel
egy tagmondatban állítás; a szállás NEVE nem állítás („Kemencés Vendégház”); a „tornác” építészet; a „falusi pihenő”
átvitt értelem. A kritikus és a szövegíró promptja kimondja; a fotó-szűrő ezt a kifogást nem dobja el; a súly-normalizálás
blokkolóra emeli.

**Mérés.** 24 valódi mock kiszállított szövegén: az Erika négy helyen fog, a Muschel forrásolt terasza/grillje nem; további
11 mockon talál a fotóból kikövetkeztetett, forrás nélküli tárgyat (terasz, pavilon, grillsarok, fedett pihenő, stég). Valódi
kritikus-hurok (AI) az Erika és a Muschel kiment szövegén: az Erika első körében mind a négy előfordulás blokkol, a
kiszállított szövegben nincs; a Muschelen a forrásolt terasz és grill megmarad. **Ismert határ:** a forrás-panelben nem
szereplő, csak a hirdetés-prózában álló tárgy a mérésben hamis találatnak látszhat — a kritikus futásidőben a prózát is kapja.

**Őr:** `scripts/guest-critic-check.mts` ⑩ — 9 mutáció, mind piros.

### ② OP3-1 — a MINTA-jelölt blokk nem tény; a verdikt a tétel-listából jön
**Lelet.** A tényhűség-kapu a teljes látható szöveget kapta: az Erika Séta-mock „13 forrás nélküli” FLAG lett, ebből 12 a lap
saját MINTA-blokkjaiból (szoba, szolgáltatás, érkezés, programok). Ugyanaz az adat Szerkesztőin 5 ilyen tétellel PASS, mert a
verdiktet a modell `verdict` mezője adta, nem a saját listája.

**Döntés.** (a) `stripSampleSections`: a kapu bemenetéből kiesik minden minta-jelölt blokk — a legbelső `<section>`, amelyben
`cit-modsec__minta`, `cit-sample-note`, egy sablon saját `<előtag>-sample` jegyzete vagy `data-cit-sample-photo="sample"`
áll, továbbá minden `data-cit-sample-block` konténer és önálló minta-jegyzet. (b) `verdictOfFacts`: forrástalan tétel → flag;
megnevezett tétel nélküli flag → error. (c) A minta-szoba fotó-jelzője `"sample"`, a kölcsönzött fotós VALÓDI szobáé
`"borrowed"` — a valódi szoba állítása a kapu elé kerül. A horizontal és transit minta-szoba konténere `data-cit-sample-block`
attribútumot, az artdeco minta-jegyzete a meglévő `ad-sample` osztályt kapja (nem látható változás, ui-shottal ellenőrizve).

**Mérés** (a négy élesi mock HTML-jén, valódi kapuval): Erika Séta FLAG(13) → PASS, Erika Szerkesztői PASS(5) → PASS,
Muschel mindkettő PASS → PASS. Ugyanaz az adat, sablontól független ítélet.

**Őr:** `scripts/fact-sample-check.mts` (új, pre-commit): minden sablon mock-renderén minta nem marad, valódi szöveg és valódi
szoba igen, a jelölt-halmaz sablonfüggetlen, a verdikt a listából — 11 mutáció, mind piros.

### ③ Plus-alcím = egy címzett (tulaj: „igen”)
**Lelet.** `olasz.ferenc+erika@citoviso.com` második hideg levelet kapott: az egy-lövés zár új címnek vette.
**Döntés.** `recipientKey()` / `recipientKeySql()`: trim + kisbetű + a `+címke` le a helyi részből. Ezt hasonlítja a zár,
az atomi foglalás (advisory lock), a küldhető-lista, a leiratkozás és a visszavonás — a zár és az opt-out nem érthet másként
egyet a címzettről. A TÁROLT cím változatlan (`normalizeEmail`). Gmail-pont továbbra sem vonódik össze.
**Őr:** `scripts/outreach-suppression-check.mts` (szabály, SQL-iker egyezés, szerkezeti iker, olvasó DB-mérés) — 5 mutáció, mind piros.

### ④ A márka mint küldő-név nem személynév (tulaj: „Citoviso”)
**Lelet** (koordinátor mérése, reprodukálva): `OUTREACH_SENDER_NAME=Citoviso` mellett a levél-truth-check ⑥ 3 állítása piros —
a márkát személynévnek vette, így a dev `.env` cseréje minden szál landját blokkolta volna.
**Döntés.** `personalSenderName()` leveszi a márkát (Citoviso / citoviso.com / „A Citoviso csapata”); ami marad, az a személynév.
A legal footer (`LEGAL_ENTITY_*`, „A megkeresés küldője: …”) marad — jogi kötelem.
**Mérés:** a truth-check a mai és a márka-konfiggal is zöld; a küldő-identitást olvasó többi őr márka-konfiggal is zöld.
**A konfig-csere** (dev `.env`, majd az éles a deploy után, a tulaj engedélyével) e land UTÁN, a koordinátor tudtával.

### Nem e landban
L3-1 (eszkaláció különböző napokon) a /pricing feliratát érinti → §2b terv a koordinátornál. L3-2, ADM3-1, L-6, INV-1:
vevő-oldali felirat-változások, §2b alá esnek, döntésre várnak.

**Visszafordíthatóság:** 🔄 — tiszta függvények és egy prompt-sor; a plus-összevonás egy függvényben él.
