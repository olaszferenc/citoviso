## ADR-0204 — A kontraszt-őr gradiens-vakfoltja: a sötét sávok feliratai kimaradtak a mérésből (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0021 ① (dizájn-token
doktrína), a 2026-09-15-i szemantikus-kontraszt döntés (`--citui-*-ink` feliratszínek).

**Tulajdonosi bejelentés:** „itt a header zöld betűje szinte nem is látszik."

### ① A lelet

A lead-lap fül-sorának INAKTÍV feliratai (`Mock és generálás`, `Megkeresés`, …) a navy gradiens
sávon `--citui-link-ink` (#10697a) színnel festődtek: **pixelből mérve 2,22:1** (a küszöb 4,5).
Az ok specificitás-ütközés — a konzol általános link-szabálya, `.con a` (0,1,1), **veri** a fül
saját fehér színét, `.con-ltab` (0,1,0). Árulkodó nyom: a `:hover` és az `.on` ág már `.con`
prefixszel íródott (tehát valaki ebbe már belefutott), csak az ALAPÁLLAPOT maradt ki. Javítás:
`.con a.con-ltab` (0,2,1) → **8,33:1**, mindkét méreten mérve.

### ② A vakfolt, ami engedte

A `console-contrast-check.mts` 9733 szöveg-elemre mondott ZÖLDET — miközben a bejelentett hiba a
lapon ült. A háttér-feloldás gradiens ősnél `null`-lal adta fel („azt nem tudjuk kiszámolni"),
és a hívó az ilyen elemeket NÉMÁN kihagyta: a konzol **minden sötét sávja** (lead-fejléc,
fül-sor, ragadó fejlécek) kívül esett a mérésen. A zöld tehát nem tévedett — **más halmazról**
állított valamit, mint amit a neve ígért.

### ③ A döntés

1. **A gradiens mérhető**: a stop-színek kiolvashatók, és a felirat a sáv MINDEN pontján
   olvasható kell legyen → minden stopra megoldjuk, és a **legrosszabbat** vesszük. Konzervatív:
   a köztes átmenet-értékek a szélsők közé esnek, tehát ez az ág nem tud hamis ZÖLDET adni.
   Mérve: +302 felirat került be a mérésbe (9733 → 10035).
2. **Ami így sem mérhető** (kép-háttér, féligátlátszó gradiens): a riport MEGSZÁMOLJA és KIÍRJA
   (36 elem) — nem néma kihagyás. Amiről nem tudunk állítani, arról ki is mondjuk.
3. **Külön állítás a lefedettségre**: ha a gradiens-ág nullát mér, az BUKÁS — a konzolnak vannak
   sötét sávjai, a nulla tehát nem „nincs ilyen", hanem „elromlott a feloldás".
4. **Negatív kontroll az öntesztben**: az önteszt visszaállítja EZT a hibát (link-tinta a fül
   feliratán), és megköveteli, hogy a bukók között **legyen gradiens hátterű**. ⚠️ A sorrend
   kötött: a kontroll a token-csere ELŐTT fut, mert a csere a link-tintát ciánra írja, ami a
   sötét sávon már átmenne (~5,5) — fordított sorrendben a kontroll némán elgyengülne, és a
   gradiens-ág halottan is „bizonyítottnak" látszana. Mérve: 2 → **14** gradiens-lelet.

### ④ Amit ez a hibaosztály tanít

A puszta „piros lett" nem önteszt. A token-csere sima hátterű feliratokat ront el, azok maguktól
pirosra viszik a futást — és közben egy egész ág lehet halott. Az öntesztnek arra az ÁGRA kell
állítást tennie, amit bizonyítani akar.
