## ADR-0156 — A kép nélküli lap ugyanaz a kár, mint a törött képes: a kiküldés-kapu a KÉP HIÁNYÁT is fogja (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0134 (a kapu, aminek a
SZÁNDÉKÁT ez a rés kijátszotta), ADR-0136 (a generálás eldobja a halott fotókat — ettől
NŐTT a kockázat), ADR-0129 (a kapu nem tagadhatja meg a fizetni akarót), ADR-0140
(felülírt renderelt fájl), 03-INVARIANTS §B.17.

**Kiváltó (Elek FK-004b GY-1, 2026-09-14, a kódból megerősítve).**
`src/outreach/mockPhotoHealth.ts` — `verdict: broken.length ? "broken" : "ok"`. Ha nincs
mit töröttnek mérni, a verdikt **„ok"**, tehát a kiküldés-kapu átengedi. **A nulla fotós
lap zöld kapuval ment volna ki a leadhez** — pontosan az a kár, ami ellen az ADR-0134
épült, csak a másik ajtón.

⚠️ **És a kockázat NŐTT, nem csökkent.** Az ADR-0136 óta a generálás **eldobja** a
véglegesen halott fotókat (`resolveGatedPhotos` → `dropDeadPhotos`), vagyis a „törött kép"
esetének helyét rendszerszinten a **„nincs kép"** veszi át. A két javítás együtt azt adta,
hogy a kapu egyre kevesebbet fog.

**A kapu nem tévedett — MÁS KÉRDÉSRE válaszolt.** Azt mérte, hogy a lapon lévő képek
élnek-e; nem azt, hogy van-e egyáltalán kép. Ez a ház visszatérő hibamintája (a „küldhető"
jelvény, a „nem ítélt" csempe, a `lead-filter-label-check` @1280px-e).

**Mérve (2026-09-14, a dev-parkon és a termék renderelőin).**

| mérés | eredmény |
|---|---|
| jóváhagyott artefaktum a parkban | 3 (ebből 2 mérhető a lemezen) — **mindkettőn 6 élő fotó**, ma egyik sem nulla-fotós |
| lead 0 portál-fotóval | **558 / 595 (93,8 %)** |
| ebből 0 Places-fotóref is | **148 / 595 (24,9 %)** → ezekre a lap **biztosan** kép nélkül állna elő |
| a maradék 410 | a Places élőségén múlik — a Places-út 2026-09-14-én **él** (egy lekérdezéssel mérve: 10 fotóref) |
| fotó nélküli lap kép-hivatkozásai | **19 motor-sablon × 2 fázis + a template-first renderelő → MIND 0** |

⚠️ **Amit a 148 NEM jelent:** nem 148 kiment lapot. Ma egyetlen ilyen artefaktum sincs a
parkban — a szám a KITETTSÉG, nem a kár. De a generálás bármelyik leadre indítható, és a
kapu addig nem szólt volna.

**Döntés.**

① **Új `nophoto` verdikt.** Ha a renderelt lapon **egyetlen kép-hivatkozás sincs**
(`refs.length === 0`), a verdikt `nophoto`, és a kapu blokkol. ⚠️ A predikátum a
hivatkozások SZÁMÁRA néz, nem a távoliakra: egy relatív/`data:` képről nem mértünk semmit,
tehát nem állíthatjuk, hogy nincs fotó (§B.17).

② **A predikátum ÉRVÉNYESSÉGE mérve van, nem feltételezve.** A „0 hivatkozás = 0
szállás-fotó" azonosság csak addig áll, amíg egyetlen sablon sem tesz dekoratív képet a
fotótlan lapra. Ezt az őr **mind a 19 sablonon, mindkét fázisban** megméri — ha egy új
sablon mégis tenne, a kapu NÉMÁN vakká válna rá, és ehelyett piros lesz.

③ **Nem vak tiltás: kimondott ÉS INDOKOLT kivétel.** Az ADR-0134 tudomásulvétele NÉVSORRA
szól — itt nincs névsor, mert nincs kép. A helyére **kötelező, szabad szöveges indoklás**
lép (min. 10 karakter, trim után), ami **ki · mikor · miért** alakban az artefaktumra
íródik (`inputs.noPhotoAck`). ⛔ Az indoklás nélküli sor NEM tudomásulvétel — különben a
kötelező mező egy néma pipa második példánya lenne (l. „a bukást naplózó, mégis átengedő
mérőeszköz" osztálya).

④ **A kivétel KÉT LÉPÉS a képernyőn** (tulajdonosi döntés a §2b körből, „B" változat;
kontraktus: `assets/design-refs/console/nophoto-gate/`). A doboz először csak a rendes
kiutat kínálja; a vállalás külön, kimondott kattintás mögött nyílik — `<details>`-szel,
tehát **JS nélkül is**. A garancia a szerver, a natív `required minlength` a fék, a
számláló csak kényelem.

⑤ **A mondat a SAJÁT kérdésére válaszol.** Se a fejléc, se a levél/SMS indoklása nem
állíthat törött képet egy kép nélküli lapról („0 kép forrása nem érhető el" semmit nem
mondana, és az operátort a rossz kiút felé küldené).

⑥ **A FIZETNI AKARÓ vevőt ez a kapu NEM állítja meg (ADR-0129).** A vevői rendelés
`generated → approved` emelése a `curateArtifact`-en megy, nem ezen a HTTP-úton. Ez most
**kimondott** szabály és **mért** állítás, nem szerencsés véletlen: az őr végig is futtatja
az emelést egy kép nélküli mockon, és szerkezetileg tiltja, hogy a `data.ts` kapuvá váljon.

**Amit a saját munkám közben találtam (és javítottam).**

⛔⛔ **Az őr szerkezeti mérése a MÁSIK FÁT olvasta.** Az `import`-jai a script helyéhez
(worktree) képest oldódnak fel, a `readFile(path.resolve(process.cwd(), …))` viszont a
munkakönyvtárhoz — és a `--sweep` miatt az őrt a FŐ FÁBÓL szokás futtatni. Így a
szerkezeti állítások a fő fa forrását mérték, miközben a viselkedési részek az enyémet:
**három kész javításomat jelentette hiányzónak.** A forrás-olvasás innentől `SRC_ROOT`-ból
megy (a script saját fája). Ugyanez az osztály egyszer már négy javítást tüntetett el.

⛔ **A felület-mérésem KIVÉTELLEL állt le jelentés helyett.** Az öntesztben a doboz eltűnik,
a `summary.click()` pedig Playwright-timeouttal ölte meg az egész futást — a maradék
állítás sosem hangzott el, a hibaüzenet meg egy timeout volt, nem az, hogy MI hiányzik.
Egy hangosan bukó őr még nem használható őr.

⚠️ **MÉRT, NEM JAVÍTOTT — a `.con button.bad` kontrasztja 3,91 (fehéren) / 3,57 (a kapu
dobozán).** A 4,5-ös küszöb alatt van, és ez a ház **13 helyen** használt piros gombja
(a meglévő ADR-0134 tudomásulvétel-gomb ugyanez). Nem az én változásom hozta, és egy
házon átívelő szín-döntés tulajdonosi kör — de ki van mondva, nem elnyelve. Amit az őr
ehelyett MÉR: hogy a felirat a márka-piros **marad** (a `.con button` 0,1,1 specificitása
nem írja felül — ez a csapda a házban már háromszor ütött), és hogy a tiltott gomb
**tiltottnak is LÁTSZIK** (opacity 0,5), nem csak `disabled` a DOM-ban.

**Őr.** `scripts/mock-photo-gate-check.mts` — **71 állítás**, önteszt **26 piros**.
Az új szakaszok: ③a a kapu igazságtáblája a `nophoto`-ra (köztük: a törött-kép
tudomásulvétel NEM fedezi a kép nélküli lapot; az indoklás nélküli pipa blokkol) · ③c a
predikátum érvényessége 19 sablonon × 2 fázison · ④b a valódi konzol-úton (HTTP, DB-sor,
renderelt fájl): a jóváhagyás megtagadva, a képernyő a saját kérdésére válaszol, az
indoklás nélküli vállalás visszapattan **megnevezett** hibával, az indokolt vállalás
átmegy és **naplózódik** · ④b2 a szállított doboz **valódi böngészőben, 390 ÉS 1280 px-en**
· ④c az ADR-0129 (a vevői út szabad) · ⑤ a küldés-utak külön `nophoto` ága a küldés ELŐTT.
⛔ **A piros önteszt két irányban bizonyít:** a `--self-test` a fotótlan lapnak ad képet
(26 piros), és külön, kézzel visszarontva a verdikt-ágat + a kapu-sort **13 piros** —
vagyis a predikátum-állítások sem beégetett elvárásból zöldek.

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül. A kivétel az artefaktum
`inputs.noPhotoAck` mezőjében él; törlésével a kapu újra zár.

**Nyitott.**
- A `.con button.bad` 3,91-es kontrasztja (fent) — külön, házon átívelő kör.
- Ha a lap MINDEN képe törött (`broken`, 0 élő fotó), a kár azonos a `nophoto`-val, de a
  kiút az ADR-0134 **névsoros** tudomásulvétele marad — ott a kurátor nevesítve látta, mit
  vállal, ezért nem kap külön indoklás-kényszert. Ha ez a gyakorlatban rutinná válik, a két
  ág összevonandó.
- A `mock-photo-gate-check` a KÖZÖS `sites/`-be és a közös DB-be írja a fixture-jét
  (`ŐR-photo-gate`); párhuzamos szálakon ütközhet. Mérve ebben a körben: egy másik fa
  futtatta ugyanezt az őrt, és a `consent-style-check` egy commit-körben emiatt lett
  hamis piros (háromszor újrafuttatva zöld).
