## ADR-XXXX — A Piac-kapu a Vendég-kritikusnak alárendelve; a leírás szava csak állításként tény (2026-10-05)

**Dátum:** 2026-10-05 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; brief:
`~/rc-briefs/piac-vk-precedence-20261005.md`) · **Tulajdonosi döntés (2026-10-05, a koordinátor kérdésére):**
vékony forrásnál a **Vendég-kritikus (tényhűség) az irányadó**, nem a Piac · **Kapcsolódó:** §B.17 (tényhűség),
ADR-0292 (Vendég-kritikus; „parkoló ≠ saját parkoló”), ADR-0324 (lírai nyitás), a marketing-őr (`marketCheck.ts`).

**A lelet (Poe-pilot, 1. nap, 5 lead — `~/poe/ugyek.md` 1–2.).**
1. **Ellentmondó kérések.** A Piac-kapu a portál-lista tételeit (parkoló ×2 lead, babafelszerelés, vélemény-tartalom)
   kérte eladási pontként; a Vendég-kritikus (VK) ugyanazokat a sorokat túlzásnak ítélte. A kurátor két egymást
   kizáró kérést kapott, és egyiket sem teljesíthette a másik megsértése nélkül.
2. **Szóegyezésből „igazolt szolgáltatás”.** A `descriptionSellingPoints` puszta részszó-egyezéssel címkézett, és a
   Piac ezeket a címkéket kérte számon (valódi forrásmondatok, élesen olvasva):
   - „Garázs: nincs” → Garázs (Csopaki Apartman, 74e7629a) — tagadás;
   - „reggeli után azonnal megmártózzon” → Reggeli (Csopak) — napszak, nem felszolgált étkezés;
   - „a Kolostorökból és Kertekből” → Kert (Betérő, 94e7c8fe) — egy hely NEVÉNEK része;
   - „terasz, kilátással a kertre” → Panoráma (Gólyásház, d7b42817) — kilátás az udvarra;
   - „4 km-re … az Ábrahámhegyi strandtól” → Strand (Gólyásház) — kilométerekre lévő látnivaló.

**Döntés.**
1. **A leírás szava csak akkor tény, ha a tagmondat ÁLLÍTJA** (`proseAffirms`, `marketCheck.ts`). Kiesik az
   előfordulás, ha (a) tagadott (`nincs`, `nem …`, `nélkül` — előtte vagy közvetlenül utána); (b) idő-névutó követi
   (`után`, `előtt`, `közben` …); (c) mondat közepi nagybetűs szó része (név; kivétel a strand: a „Platán Strand” is
   strand); (d) a szó egy MÁS szó belseje (`állatkert`, `halászkert` — a kert, strand, reggeli, panoráma … szó elején
   kell álljon), vagy `kertváros`; (e) a kilátás közeli tárgyra szól (`kilátással a kertre / udvarra / utcára`);
   (f) a tagmondat ≥ 1 km-es távolságot mér (távoli látnivaló, nem a ház adottsága). A vizsgálat tagmondatonként
   (vesszőig) fut, így a „homokos strandtól 700 m-re” megmarad akkor is, ha a mondat másik fele kilométert mér.
   Ugyanez a szabály dönti el, hogy a marketing-bíró „hiányzik” tétele forrásolt-e (`isSourcedMiss`), és a tagadott
   lista-tétel („Háziállat nem engedélyezett”) nem erős eladási pont (súlya 0).
2. **A VK nyer** (`subordinateToCritic`). Amit a VK ugyanazon a szövegen forrás-alapon kifogásolt
   (`tulzas_a_forrashoz`, `forrastalan_igeret`, `velemeny_mint_szolgaltatas`, `hangulat_forras_nelkul`), az a Piac
   `missed` listájáról lekerül — a Piac nem kérheti eladási pontként. Ha a Piac-FLAG CSAK hiányzó eladási pontra
   épült (a strukturális „egy igazolt szolgáltatást sem nevez” réteg, vagy a bíró csak-3.-szabályos bukása — a verdikt
   új `demand` mezője jelzi), és a vétó után nem marad hiányolható tétel, a verdikt PASS, indoklásában „a
   Vendég-kritikus nyer”. Más okú Piac-FLAG (üres vagy leltár-főcím, építőanyag, félrevezető állítás) változatlan: abban
   a két kapu egyetért. A vétó a tétel döntési szaván illeszt („parkol”), nem mellékszón („ingyenes”).
   Bekötve mindhárom szöveg-úton, a VK UTÁN: `generateEngine` (generált és kurátori mód), `recopy`, `copyManual`.

**Őr.** `scripts/market-vk-precedence-check.mts` (pre-commit, ön-triggerrel; se AI, se DB): az öt szóegyezés mint
regressziós teszt, pozitív kontrollok (700 m-es strand, Platán Strand, Kerthelyiség, Kijelölt külön parkoló, Fűtött
medence, „Reggelit kérésre”, „panorámás terasz”), a tagadott lista-tétel, a VK-vétó négy ága és a bekötés. `--self-test`:
a régi részszó-szabály piros.

**Nem része.** A VK nem-determinisztikussága (ugyanaz a sor egyszer átmegy, egyszer nem — `ugyek.md` 10.) és a
Rooms-modul forráson kívüli adata (3.) külön ügy. Élesre csak a nagy deployjal megy.

**Visszafordíthatóság:** 🔄 — tiszta függvények; a `subordinateToCriticInputs` hívás kivétele visszaállítja a régi
viselkedést.
