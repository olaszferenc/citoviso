## ADR-0134 — Amit a leadnek megajánlunk, az legyen az, amit KAP: a törött képes mock nem hagyható jóvá és nem küldhető ki (2026-09-13)

**Kontextus.** Elek FK-003b L01 (2026-09-13). A frissen generált mock kurátor-lapján
EGYSZERRE volt látható a rendszer SAJÁT piros sávja — „4 kép forrása nem érhető el — ezek a
képek a **LEADNEK kiküldött lapon is törötten jelennek meg**" —, a nyitókép-választó mind a
négy „nincs kép / 404-et ad" csempéje, és a piros „Nyitókép: nem ítélhető" őr-pirula. Ennek
ellenére a **Jóváhagyás akadálytalanul átment**, a visszaigazolás egyetlen szót sem szólt a
képekről, és a felület azonnal felkínálta a leadnek küldhető **követett linket**. Az FK-004b
ugyanezt a lapot a lead szemével nézve azt mérte, hogy **egyetlen valódi fotó sincs rajta**.

**A mért ok (2026-09-13, curl, bot-UA-val és böngésző-UA + referer-rel is).** Nem a mi
oldalunkon van: a **hovamenjek.hu ÁTNEVEZTE** a fájljait, ezért a TÁROLT URL rohad el.
⛔⛔ **AZ ELSŐ LELETEM HAMIS VOLT, ÉS BEKERÜLT EBBE AZ ADR-BE:** 8 URL-es mintából
(„8/8 404, öt leaden") azt vontam le, hogy „megszűnt a séma". A TELJES mérés (mind a **73**
tárolt hovamenjek-URL) megcáfolta: **59 halott / 14 élő**, 11 leadet érint, ebből 8-nál MIND —
de a Villa Pátzay 9 URL-jéből csak 1. A minta a leadek között **csomósodott**, nem szórt.
**Az ADATLAPOK ÉLNEK**, és friss begyűjtéssel a fotók visszajönnek (a valódi leaden mérve:
4 adatlap · 11 fotó, high sáv). A „404-et ad" és a „megszűnt a séma" két KÜLÖN állítás: az
elsőhöz elég 8 URL, a másodikhoz az egész halmaz kell. ⚠️ **A kapu ettől még kell** — a tárolt
URL bármikor elrohadhat, és a kurátor ne abból tudja meg, hogy mi ment ki a leadhez. Ugyanennek
a leadnek az `i.szalas.hu` képei is 404-esek (a szálláshely lekerült a portálról); a 13 begyűjtött
fotóból **11 halott**, a két élő pedig `balaton.hu` **reklámbanner**, amit az ADR-0116 eleve kizár.
A parkban 904 különböző fotó-URL-t mérve a többi gazdagép rendben van (booked.hu, lake-balaton.com,
oastatic, bstatic: 200), tehát ez **portál-szintű elhalás**, nem általános romlás. ⚠️ Az ok
múlandó — **a kapu hiánya nem az.**

**Amit a mérés a kódban talált.** A ház **már megmérte** a törést, csak nem vont le belőle
semmit: a `heroShot.ts` a kiküldött levél nyitóképéhez Playwrighttal ellenőrzi az **első képernyő**
képeit, és ha törött, `null`-t ad — amit a `sendBatch` „akkor kép nélkül megy a levél"-ként
elnyelt. A link mögötti lap ettől függetlenül kiment, 10+ üres kép-hellyel. A konzol
`photo-health` végpontja pedig a mondatában a **kiszállított lapról** állított valamit, miközben
az `inputs.siteData.photos` **bemeneti** listát mérte — a ház visszatérő hibamintája: a kapu a
fixture-ön mér, nem azon az úton, amin az adat kimegy.

**Döntés.**
① **Egy mérés, a RENDERELT artefaktumon.** `src/outreach/mockPhotoHealth.ts` a lemezen lévő
`mock_artifact.path` fájlból — abból, amit a lead a `/mock/<id>` és `/p/<token>` úton megkap —
vonja ki az összes kép-hivatkozást (`img[src|srcset]`, `source`, `background-image:url()`,
`link[rel=preload][as=image]`, `og:image`/`twitter:image`), és a konzol kép-proxyjának
`fetchPhoto`-jával méri meg őket. **Ugyanaz a lekérő és ugyanaz a cache**, mint amit a kurátor
csempéjén lát: két külön mérés két igazságot adna egy képernyőn.
② **EGY predikátum dönt minden kapun** (`photoGateBlocks`): jóváhagyás · követett link · levél ·
SMS. Az `unknown` (nincs renderelt fájl) **nem tudomásul vehető** — ott nem törött kép van, hanem
nincs mit kiküldeni.
③ **A jóváhagyás nem mehet át némán.** Törött lapnál a szerver visszatérít a **megtagadás
képernyőjére**, ami megnevezi, MELYIK kép, MIÉRT (404/403/hálózat, a valódi státusszal és a
gazdagéppel), hányszor szerepel a lapon, és mi a következménye a leadnél. A kurátor joga megmarad
— de **kimondott** kattintással, és a tudomásulvétel **NÉVSORRA** szól (`inputs.brokenPhotoAck`):
ami a jóváhagyás óta esett ki, arra nem érvényes.
④ **A kiküldés-út ugyanazt a kaput viseli.** A követett link készítése, a levél és az SMS a
**küldés pillanatában** újramér — nem a jóváhagyáskori emlékből dolgozik, mert a portál azóta is
törölhetett.
⑤ **A képernyő a KATTINTÁS ELŐTT mondja ki**: a Jóváhagyás gomb mellett megjelenik ugyanaz a
mondat, ugyanabból a végpontból. Ez kényelem; a garancia a szerver-oldali kapu, ami JS nélkül is áll.

**Amit menet közben találtam (és javítottam).** A lead-lap fül-szkriptje a `#a-<artifactId>`
horgonyra **nem váltott fület** (az `ALIAS` csak három nevet ismert), vagyis a szerver egy REJTETT
fülön lévő kártyához küldte volna a kurátort — a megtagadás képernyője pont így lett volna
láthatatlan. A `fromHash` most a panelen belüli elemre is felold, és a **mért** ragadós-sáv-magasság
alá görget (telefonon a menü tördelése miatt tippelt pixel nem elég).

**Őr.** `scripts/mock-photo-gate-check.mts` — 22 állítás, és **nem fixture-ön**: a lapot a TERMÉK
renderelője (`src/generator/render.ts`) állítja elő, a kép-listát **valódi Chromium** adja
(független referencia — az őr nem az `extractImageRefs`-szel méri az `extractImageRefs`-et), a
kaput **valódi HTTP-n, a valódi konzol-szerveren, valódi DB-soron** nyomjuk meg, a 404-et pedig egy
helyi kép-szerver adja (determinisztikus, hálózat-független). Méri a **negatív irányt is**: ép mock
jóváhagyása akadálytalanul átmegy — egy mindig-blokkoló kapu ugyanolyan hibás, mint egy
mindig-átengedő. A küldés-út **szerkezeti** mérést kap (a §C-lánc előfeltételei nélkül egy korábbi
kapu nyelné el a mérést, és az őr a ROSSZ okból lenne zöld) — ez a korlát ki van írva.
Az **önteszt meggyógyítja** a renderelt lapot: az őrnek ettől pirosra kell mennie (11 bukás),
különben nem a valós kimenetből dolgozik, hanem egy beégetett elvárásból.
A `--sweep` a park **tényleges jóváhagyott** artefaktumait nézi meg a lemezen; mérve: Dencs
Apartmanház 6/0, Rozé Fogadó 5/0 zöld, **ELEK-TESZT Vendégház 4 kép / 4 törött → piros**.

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül. A tudomásulvétel az artefaktum
`inputs.brokenPhotoAck` mezőjében él; törlésével a kapu újra zár.
