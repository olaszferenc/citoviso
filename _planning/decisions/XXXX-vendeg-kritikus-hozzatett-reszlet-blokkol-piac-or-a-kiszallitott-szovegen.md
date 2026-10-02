## ADR-XXXX — Vendég-kritikus: a forrásban nem álló hely-/minőség-részlet blokkol; a piac-őr a kiszállított szövegről ítél (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (hibajavítás, mérés alapján; SUB, koordinátor: CIT „élesi teszt” fő session;
brief `~/rc-briefs/javitas-elek-0930/k2-kritikus-seta-indoklas.md`) · **Forrás:** Elek 2. élesi köre, SZ2-1 (MAGAS) és OP-1 (KÖZEPES) ·
**Kapcsolódó:** ADR-0292 (vendég-kritikus, B-szabály), ADR-0304 ⑥ („Kontinentális reggeli a kertben”), §B.17.

**A lelet.** A Muschel élesi mockján (0dbcdc91) kiment: „Grillezési lehetőség a **fedett** teraszon”, „a fedett terasz alatt
grillezési lehetőséggel”, „Medence a kertben, **reggeli a teraszon**”. A forrás: „cozy terrace where there are also barbecue
facilities”, „breakfast”. A szolgáltatás igaz volt, a hozzá ragasztott HELY/MINŐSÉG kitalált. A kritikus a „fedett”-et maga is
kifogásolta (`forrastalan_igeret`), de „javítandó” szinten — a verdikt PASS lett, „3 kör, blokkoló kifogás nincs”, a kártyán semmi.
Ugyanazon a kártyán a piac-kapu indoklása „bérelhető bicikli”-t idézett, amit a kritikus már kivett: a piac-őr a kritikus ELŐTT futott.

**Mérve, hogy melyik őr fut a kritikus előtt** (`generateEngine` és `recopy` is): **csak a piac-őr**. A tényhűség és a dizájn a
renderelt HTML-en fut, a kritikus után — azok a kiszállított szövegről szólnak.

**Döntés.**
1. **Gépi szabály: hozzátett részlet** (`lintAddedDetail`). Ha egy tagmondat szolgáltatást nevez meg (grill, reggeli, vacsora,
   kávé, parkoló, kerékpár, wifi) ÉS hely-/minőség-részletet (fedett, terasz, kilátás, saját/privát, fűtött, őrzött/zárt,
   svédasztalos; étel mellett a kert/udvar is), akkor kell EGY forrás-mondat, ami a kettőt együtt mondja — különben BLOKKOLÓ
   `tulzas_a_forrashoz`. Fotón nem látható minőség (saját, fűtött, őrzött) dolog mellett forrás nélkül szolgáltatás nélkül is
   blokkol. Kétnyelvű tövek (a vélemények többsége angol). A vélemény-tény CÍMKÉJE nem bizonyíték (gépi fordítás), csak az idézete.
2. **A kritikus súlyozása a saját szabálykönyvéhez igazodik** (`normalizeSeverity`): a mindig-blokkoló fajták (`forrastalan_igeret`,
   `velemeny_mint_szolgaltatas`, `nem_letezo_fogalom`, `al_idezet`) „javítandó” jelölése blokkolóra emelkedik; a túlzás akkor
   blokkoló, ha szolgáltatást vagy hely-/minőség-részletet fúj fel. A `megszolitas` NEM emelkedik: a regiszter a gépi iker dolga
   (mérve: a modell a magázó „Amit itt kap”-ot megszólítás-hibának ítélte). A prompt is kimondja a hozzátett részletet.
3. **Ami javítandóként kimegy, az látszik** (`minorTail`): a verdikt-indoklás felsorolja („… · 2 javítandó maradt (nem blokkol,
   nézd át): …”), ez a konzol mock-adatlapján a „Vendég-kritikus indoklása” sorban áll.
4. **OP-1: a piac-őr a kritikus UTÁN újraítél** a kiszállított szövegen (újragenerálás nélkül), mindkét úton. Ha ez az ítélet
   elbukik, `error` lesz (a kapu blokkol) — sem az elavult verdikt nem marad, sem némán nem tűnik el.

**Mérés** (6 mock, a kiment szövegből indítva, régi vs. új kód, `_drafts/k2-kritikus/elotte-utana.html`): a régi kóddal a Muschel
séta-mockon a „Fedett terasz grillezési lehetőséggel” és „a fedett, kőfalú terasz alatt” PASS-szal maradt; az újjal mind a négy
Muschel-lelet az első körben blokkoló, és egyik sem marad meg. Artemisz „Tágas saját parkoló” és Laguna „Saját parkoló az
udvarban” (forrás nélkül) a gépi szabályra kiesik; Három Huszár „Kontinentális reggeli a kertben” → „Kontinentális reggeli”.

**Ismert határ.** A szabály mondat-szinten méri az együttállást: Három Huszár forrása „A szállás kerttel reggelente kontinentális
reggelit szolgál fel” — a kert a szállásé, mégis egy mondatban áll a reggelivel, így a gépi szabály ezt nem fogja meg (a kritikus
modell igen, blokkolóként). A modell futásonként szór; a gépi szabály a padló.

**Őr.** `scripts/guest-critic-check.mts` ⑦–⑨ (pre-commit): a Muschel valódi forrásán a három lelet blokkol, a forrás erejéig álló
„Grillezős terasz”, a „Fedett medence” és a hirdetésben álló „Saját parkoló” nem; a súly-normalizálás; a javítandó-farok; és
mindkét úton a piac-őr utolsó ítélete a kritikus után fut, a perzisztált indoklás azé. Mutációval igazolva (7 mutáció, mind piros).

**Visszafordíthatóság:** 🔄 — tiszta függvények + egy újraítélés-hívás utanként.
