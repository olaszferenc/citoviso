## ADR-0184 — A fordítás-kör a KB-szerkesztés UTÁN jár, és ezt kapu kényszeríti ki (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (harmadik független tudásbázis-őr FLAG-verdiktje
az ADR-0182/0183 körére) · **Kapcsolódó:** ADR-0045/§J.25 (nyelvi teljesség), ADR-0152 (a
bekötést kapu kényszeríti ki), ADR-0183 (ugyanez a mintázat képen) ·
**Kapuk:** `scripts/kb-translation-coverage-check.mts`, `scripts/kb-freshness.mts` ④.

**Probléma — és a SORREND volt a hiba, nem a figyelmetlenség.** Módosítottam két súgó-cikket,
lefuttattam a fordítás-kört, majd egy őr-verdikt nyomán **MÉG EGYSZER hozzányúltam** a cikkhez
(a pirula/cím sorrendje és a blokk helye) — és azt már **nem fordíttattam újra**. A
`source_hash` a magyar forrásból származik, tehát a szerkesztés azonnal elavulttá tette a
fordítást.

**⛔ A következmény nem elméleti.** A `kbPacks.ts` kimondja, hogy „a stale translation still
serves" — **magyar fallback NINCS**. A lengyel és a szlovák tulaj ezért **szó szerint a két
frissen javított hibát olvasta tovább**: „pod kartą Abonament" / „pod kartou Predplatné" (a
kártya ALÁ küld, ahol nincs semmi) és „a nad nim tytułem" / „nad ním s nadpisom" (a címet a
pirula FÖLÉ teszi). Vagyis a javítás a magyar olvasónak megtörtént, a lengyelnek nem — és erről
semmi nem szólt.

**⛔⛔ A RÉS SZERKEZETI VOLT.** A `kbCoverage()` **létezett**, és **pontosan ezt mérte** — de
SEHOL nem volt bekötve: sem a pre-commitban, sem a napi söprésben; egyetlen hívója egy
követő-nézet volt. Ugyanaz a mintázat, mint az ADR-0183-nál: **a meglévő kapuk MÁS KÉRDÉSRE
válaszolnak.** A `kb-check` a szerkezetet és a feliratokat méri, a `kb-freshness` a
prod-driftet, a képek korát és a determinisztikus szerkezetet — egyik sem azt, hogy a
MÓDOSÍTOTT cikk eljutott-e minden élő nyelvre.

**① A kapu.** `kb-translation-coverage-check.mts`: minden ÉLŐ nyelvi csomagra megméri a
fordítható (tenant) cikkek friss lefedettségét, és **egyetlen elavult cikk is PIROS**. A hiba
üzenete **megnevezi a nyelvet ÉS a lemaradt cikket**, mert a puszta darabszám nem mondja meg,
mit kell tenni. Bekötve: `hooks/pre-commit` (diff-scope: `kb/entries/**/entry.*.md`) **és**
`kb-freshness` ④. ⚠️ DB-t igényel; elérhetetlen adatbázisnál **hangosan bukik**, mert egy „nem
tudtam megmérni" ág zöldje pontosan az a hamis bizalom, ami idáig vezetett.

**② A javító út VALÓDI.** A kapu `kb-translate.mts`-re küld, és azt meg is írtuk — egy kapu,
ami nem létező parancsot ajánl, hazudik. A kör **korlátos újrapróbálást** végez, mert a
fordítás integritás-ellenőrzésen megy át, és a modell **nemdeterminisztikus**: ugyanazon a
cikken mérve **5 kísérletből 3 elbukott**, majd változatlan bemenettel átment (a diagnózis
külön hívása 29/29 feliratot, 1 képet, 9 alcímet adott vissza — tehát nem a cikk szerkezete a
baj). A kísérletek számát kiírja, és ha marad hiány, **hangosan bukik** — a „majd a következő
trigger megjavítja" hozzáállás termelte újra a hibát.

**⚠️ Amit a mérés a verdikthez képest pontosított.** Mire mértem, az `sk` már friss volt: a
`ensureLanguagePack` termék-folyamatokból (scrape, levél, generálás) is hívódik, és egy
**párhuzamos szál munkája véletlenül meggyógyított 5 nyelvet** a land utáni szerver-újraindítás
környékén. Ez nem cáfolja a leletet — **erősíti**: a lefedettség a szerencsén múlt, nyelvenként
más időpontban, és a `pl` így is lemaradt. Épp ezért kell kapu.

**A bizonyíték.** Önteszt: 4 eset, ebből 2 blokkol, pozitív kontrollal (a teljes lefedettség
átmegy, a „nincs élő nyelvi csomag" nem blokkol). ⭐ **És a VALÓDI feltételen is pirosra
vittem:** egy súgó-cikk forrását megváltoztatva a kapu mind a 6 nyelven jelezte, névvel
(`admin-photos`), majd visszaállítás után újra zöld lett. A `kb-freshness` öntesztje pedig azt
köti ki, hogy a ④ réteg **tényleg meg van hívva** (ADR-0152).

**Visszafordíthatóság:** 🔄 két szkript és két bekötés; nulla séma, nulla adat-mozdulat.
**Élesítés:** NINCS (§0.3).
