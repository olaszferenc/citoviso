## ADR-0157 — A fagyasztott honlap VENDÉG-lapja nem ígér visszatérést, és a vendég nyelvén szól

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás: „B — csak a tény",
renderelt mobil+desktop képek alapján) · **Módosítja:** ADR-0119 ③ (a „nézzen vissza
holnap" szöveget visszavonja) · **Kapcsolódó:** ADR-0080 ⑥ (freeze ≠ eltűnés), ADR-0119 ⑧
(az ÁLLÍTÁST kell mérni, nem a szót), ADR-0063 (kifizetett nyelvi változatok),
03-INVARIANTS §B.17 (tényhűség) · **Kontraktus:** `assets/design-refs/console/freeze-state/`
(az 5. pont átírva) · **Kiváltó:** Elek FK-006a GYANÚ-2 és GYANÚ-4.

**A LELET, ÉS AMI A BEJELENTÉSBEN NEM VOLT IGAZ.** A bejelentés úgy szólt, hogy „az
ADR-0119 megsértve maradt a vendég-oldalon". Megmérve: **nem sértés volt, hanem
HATÁLY.** Az ADR-0119 ③ és a jóváhagyott terv 5. pontja SZÓ SZERINT előírta a
kifogásolt mondatot, tulajdonosi választásként (2026-09-11). Vagyis nem néma
hibajavításról volt szó, hanem egy tulajdonosi döntés felülírásáról — ezért a kód
átírása ELŐTT kérdés ment a tulajhoz, három renderelt változattal, mindkét méretben.
⛔ Ha ezt elmulasztom, pontosan az a hiba születik újra, amit a
„jóváhagyott vázlat a kontraktus" tanulság rögzít: a rendszer szabálya nem írhatja
felül a tervet — az tulaj-kérdés.

**① AMI A LAPON HAMIS VOLT (3 állítás-osztály, mérve a renderelt kimeneten).**
- *„Dolgozunk rajta"* — **nem dolgozunk semmin.** A lap egy nem létező szereplőt talál
  ki, és épp attól tereli el a vendéget, ami segíthet rajta: a szállásadó telefonszámától.
  A fagyás a tulaj fizetésekor oldódik (`applyRenewalPaid` — webhookra, azonnal).
- *„nézzen vissza holnap"* — **időpont, amit nem tartunk kézben.** Egyetlen ágban igaz:
  ha a tulaj 24 órán belül fizet. Erről semmit nem tudunk.
- *„átmenetileg"* és *„Addig is…"* — **visszatérés-ELŐFELTEVÉS.** Ha a fizetés nem
  érkezik meg, a 30. napon az előfizetés lezárul és a honlap **véglegesen** lekerül;
  ekkor visszamenőleg mindkettő hazugság volt.

**② A MÉRCE: ami a lapon áll, maradjon igaz abban az ágban is, ahol a tulaj SOSEM fizet.**
Ez a szabály egy mondatban. A szállított szöveg: *„Ez az oldal jelenleg nem érhető el."*
+ *„A szállás elérhetőségei"* doboz + *„Foglalással, érkezéssel kapcsolatos kérdésével
forduljon közvetlenül a szállásadóhoz a fenti elérhetőségen."* ⛔ Az OKOT továbbra sem
árulja el (ADR-0119 ③ változatlanul él): a „rendezetlen díj" a vendég szeme előtt a
szállásadót járatná le. A `Retry-After: 86400` **marad** — az a KERESŐNEK szóló gépi
jelzés (ne indexeld ki a tenantot), nem a vendégnek tett ígéret; a kettőt a lap
szétválasztja.

**③ A VENDÉG A SAJÁT NYELVÉN KAPJA (GYANÚ-4).** A fagyás-ág a `/<lang>/` útválasztó ELŐTT
futott, ezért MINDEN útvonalat az elsődleges nyelven válaszolt meg: aki 14 900 Ft-ot
fizetett három nyelvért, annak az angol vendége — a könyvjelzőzött vagy indexelt `/en/`
URL-en érkezve — magyarul kapta a lapot, pont abban a pillanatban, amikor a lapnak nincs
más mondandója, csak egy telefonszám. **A fagyás nem veheti vissza azt, amit a tenant
megvett.** A nyelvet az útvonal-előtag dönti el, de CSAK ha a pillanatkép tényleg létezik
(= kifizetett és legenerált nyelv); egyébként elsődleges nyelv, nem kitalált fordítás.

**④ AZ ŐR VAKFOLTJA VOLT A VALÓDI HIBA, NEM A MONDAT.** Az ADR-0119 ⑧ őre
(`frozen-claim-check.mts`) az ÁLLÍTÁST méri, nem a szót — és mégsem fogta ezt meg, mert a
**korpusza a tulaj-admin volt, egyedül.** A fagyás szabálya a VENDÉGRŐL szól, mégis épp a
vendég fele maradt mérés nélkül: három napig azt ígérte neki, hogy nézzen vissza holnap.
Ezért a lap saját modulba költözött (`src/server/suspendedPage.ts`) — a `public.ts`
importja szervert indít, tehát az addigi szerkezet fizikailag kizárta, hogy őr mérje.
Az őr korpusza most a vendég-lap **három állapota** (név+elérhetőségek · név elérhetőség
nélkül · névtelen), és két olyan állítás-osztályt ismer, amire a tulaj-oldalnak nincs
szüksége: **visszatérés/időpont-ígéret** és **hamis szereplő**. ⚠️ Ezek **alany nélkül**
mérnek — a „Dolgozunk rajta" és a „nézzen vissza holnap" egyikének sincs alanya, alany-
követeléssel pont a mért mondat csúszott volna át. A tulaj-oldalra ezek NEM vonatkoznak:
a tulajnak igazat mondunk a mechanizmusról („Fizetés után a honlap automatikusan, azonnal
visszakapcsol" — ez igaz, és ez a dunning-létra lényege).

**⑤ ⛔⛔ A SAJÁT ŐRÖMBEN HÁROM SZABÁLY HALOTT VOLT — ÉS A ZÖLD ÖNTESZT ELFEDTE.**
A JavaScript `\b` szóhatára `[A-Za-z0-9_]`-en értelmezett: szóköz és „á" KÖZÖTT NINCS
határ, ezért a `/\bátmeneti/` magyar mondatban **soha nem illeszkedik**. Így indult az
`átmenetileg` és az `újra elérhető` szabály — némán, sosem tüzelve. Az összesített
önteszt mégis ZÖLD volt, mert **ugyanazon a mondaton más szabályok pirosra mentek és
kitakarták őket**. A javítás nem a regex, hanem a MÓDSZER: minden osztály visel egy saját
`proof` mondatot, és az önteszt kimondja, hogy **mind a 13 illeszkedik a sajátjára** — ez
azonnal kibuktatott egy harmadik halottat is (`48 órán belül`: a magyar tőváltás miatt az
`óra` nem fedi az `órán`-t → fix egységlista helyett „N ⟨szó⟩ belül"). Egy szabály, ami
nem tud pirosra menni, nem őr, hanem komment.

**⑥ AZ ÖNTESZT MINDKÉT FÉLRE KÜLÖN BIZONYÍT.** A visszarontás nem beírt ál-lap, hanem a
VALÓDI renderbe helyettesített 2026-09-11-es szöveg — és ha a helyettesítés nem illeszkedik
(mert a termék szövege változott), az önteszt HANGOSAN bukik, nem mér csendben mást.
Ezen felül kikényszeríti, hogy **mindkét fél** pirosra menjen (tulaj 18, vendég 13):
különben a tulaj-oldal pirosa elrejtene egy vak vendég-mérőt. A nyelv-ág 7 esetre mér, és
a régi viselkedésen bizonyítottan 3 esetet buktat.

**⑦ UTÓKÖR (2026-09-15) — A BETAKARÍTÁS HATÓKÖRE NEM ÍTÉLET-KÉRDÉS, A LINTÉ IGEN.**
A ⑥-ban jelzett „a `public.ts` 4 vendég-stringje lefedetlen” lelet mérve **46 burkolt
literál lett 7 fájlban** — köztük a foglalási ÉRDEKLŐDÉS vendég-hibaüzenetei és egy
vevőnek szóló forgalmi levél. A közös ok: **EGY fájllista (`I18N_SOURCES`) szolgált KÉT
őrt, amelyek KÜLÖNBÖZŐ kérdést tesznek fel**, így a szigorúbb őr hatóköre a lazábbéra
zsugorodott:

- **lint** — „van-e ebben a fájlban BURKOLATLAN vevő-szöveg?” → **ítélet-igényű, marad
  kurált lista.** A `public.ts` a SAJÁT magyar marketing-landingünk szövegeit is
  tartalmazza; a fordításuk külön, meg nem hozott ÜZLETI döntés, amit a lint ide-vétele
  véletlenül döntene el.
- **extractor** — „benne van-e MINDEN BURKOLT string a katalógusban?” → **itt nincs
  mérlegelnivaló: aki `T()`-be tette, KIMONDTA, hogy fordítandó.** Ezért az
  `extract-i18n.mts` a teljes `src/`-t olvassa, fájllista nélkül.

Így a katalógus `--check` frissesség-kapuja **szerkezetileg** zárja az osztályt: új
burkolt string BÁRHOL a `src/`-ben elavulttá teszi a commitolt katalógust, és a commit
megáll. Piros próbával igazolva (sosem listázott fájl → `exit 1`, visszaállítás után
`exit 0`; az exit-kódot külön mérve, nem a kimenetből következtetve).

⛔ **Egy NEGYEDIK vak alak is előkerült:** `T(consoleLang(), "…")` — a nyelv-argumentum
HÍVÁS, nem azonosító. A közös regex csak azonosítót ismert, ezért a lint egy rendesen
BURKOLT stringet BURKOLATLANKÉNT jelentett, az extractor pedig kihagyta ugyanazt.
Mindkét regex javítva; ma egyetlen ilyen eset volt — a baj nem a darabszám, hanem hogy
az alak **ábrázolhatatlan** volt.

Katalógus: 2663 → **2703** (+40 egyedi, **−0 eltűnt**; a diff megmérve, mert a
hatókör-csere elvehetett volna korábban gyűjtött stringeket). ⚠️ **A katalógus-tétel nem
elég ahhoz, hogy a vendég lefordítva kapja** — a nyelvi csomagot a boot-idejű
`ensureAllLanguagePacks()` tölti fel; mérve: a ⑤ szerinti vendég-lap mind a 6 élő
csomagban (de/en/hr/it/pl/sk) ott van.

**Ami NYITVA marad (tulajdonosi döntés, 2026-09-15):** a `public.ts` **27 BURKOLATLAN**
szövegdarabja külön kör — 11 vendég-oldali, 4 lead, 8 tulaj, 4 marketing, 2 határeset,
2 belső log. Tételes átadó-lista (fájl:sor + szöveg + hol + kinek szól):
`_planning/memory/2026-09-14_frozen_guest_page_promise.md` vége. ⛔ Egy tétel
(`Nincs ilyen oldal.`) ÉKEZET NÉLKÜLI, ezért a lint HU-heurisztikája (`[áéíóöőúüű]`) nem
is látja — a következő kör az átadó-listára támaszkodjon, ne a lint kimenetére.

**⑧ A VENDÉG HOSTJÁN A REFUSAL IS A VENDÉG NYELVÉN SZÓL (2026-09-15).**
A ⑦ átadó-listájából a **11 vendég-oldali** string beburkolva: a `serveTenantHost()`
tizenegy válasza — a foglalás és az érdeklődés hibaüzenetei, és MINDEN 404-es lap —
beégetett magyar volt. Egy horvát szállás vendége horvát oldalon kapott magyar
elutasítást, miközben a nyelv KÉZNÉL VOLT (`site.tenantId`); csak senki nem kérte el.
Memoizált `tenantLang()` a függvény elején (kérésenként legfeljebb egy lekérdezés), és
a **throttle-ág is kéri** — egy eldobott kérés se váltson nyelvet. A vélemény-ág, az
EGYETLEN, amelyik eddig is helyesen csinálta, szintén erre a memóra került: két
mechanizmus egy felületen garantáltan elcsúszik.

⚠️ **A nyelvi-előtagos 404 a szállás SAJÁT nyelvén szól, nem a kért előtagén** — ott
azért vagyunk, mert az a nyelvi változat nem létezik (ugyanaz a logika, mint ③-ban).

⛔ **Csapda, amit a kód kommentje is kimond:** `T(await tenantLang(), "…")` alakban a
katalógus-betakarító regexe **nem illeszkedik** (azonosítót vár nyelv-argumentumként),
tehát a string megint kimaradna a nyelvi csomagból — minden kapu zöldje mellett. Ezért
minden hívási helyen `const lang = await tenantLang();` előzi meg a `T(lang, …)`-ot.

**Őr: `scripts/guest-host-i18n-check.mts` — FÜGGVÉNYRE mér, nem fájlra.** Ez nem
kényelmi döntés: a `public.ts` nem vehető fel az `i18n-lint` listájára, amíg a SAJÁT
magyar marketing-landingünk fordítása nyitott ÜZLETI kérdés (⑦). Az őr ezért pontosan
azt a felületet méri, ahol a tenant VENDÉGE jár. ⛔ És bezár egy vakfoltot: az
`i18n-lint` magyar-heurisztikája ÉKEZETRE néz, ezért a „Nincs ilyen oldal." — amiben
egyetlen ékezet sincs — SOHA nem akadt volna fenn rajta.

⛔⛔ **A saját őröm ELSŐ változata VAK VOLT, és az önteszt buktatta le, nem az elemzés.**
A törzs-széles `/"…"/g` literál-regex a korábbi idézőjelekhez igazodva ELCSÚSZIK
(regex-literálok, escape-elt idézőjelek), és a keresett stringet egyáltalán nem találta
meg: három visszarontásból kettő átment rajta. Soronkénti pásztázásra váltva mind a
három fennakad. Önteszt-kontraktus: a visszarontás a VALÓDI törzsbe helyettesít (ha nem
illeszkedik, hangosan bukik), a javított törzsön 0 álpozitív, és a mért függvény
átnevezésére az őr `exit 1`-et ad olvasható üzenettel — nem mér némán üres törzsön.

⛔ **A ⑦ átadó-listám két tételt TÉVESEN képezett le** (SZÖVEG szerint deduplikáltam):
a `Nincs ilyen oldal.` nem egyszer, hanem HÁROMSZOR szerepel a `serveTenantHost()`-ban,
és a második `Az oldal pillanatkép nem található.` nem is a vendég hostján van, hanem a
`servePreviewSite()`-ban. A darabszám (11) véletlenül stimmelt, az összetétel nem — a
saját összefoglalóm lett volna a hamis premissza, ha nem olvasom vissza a kódot.

**Marad nyitva:** a `public.ts` további **16** burkolatlan szövegdarabja (4 lead — ⚠️ a
lead nyelve ISMERT, és a szöveg TEGEZ, míg a kontraktus magázást ír elő —, 8 tulaj,
2 határeset, 2 belső log), plusz a 4 marketing sor, ami üzleti döntés, nem hibajavítás.

**Elvetett változatok:** „C — tény + irány" (…„keresse közvetlenül a szállásadót") — ugyanolyan
igaz, de két sorral hosszabb, és a kontakt-doboz amúgy is ezt mondja; „A — marad a mai szöveg"
— ez tartotta volna az ADR-0119 ③-at, de akkor a hamis állítás KIMONDOTT kivételként került
volna az őrbe, indoklással, nem elhallgatva.

**Visszafordíthatóság:** 🔄 a szöveg és a nyelv-szabály szabadon hangolható; a `suspendedPage.ts`
kiemelése tiszta refaktor (a render viselkedése változatlan, csak a mondatok mások).
🚪 Kifelé tett vállalás: a vendégnek kiküldött lap-forma és a nyelvi ígéret.
**Élesítés NINCS** (§0.3) — külön, kimondott tulajdonosi utasítás kell hozzá.
