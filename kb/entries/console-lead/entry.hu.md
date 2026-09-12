---
id: console-lead
title: Lead-lap — a munkafolyamat: adat, mock, kuráció, megkeresés, konverzió
audience: operator
anchors: console.lead
updated: 2026-09-12
---

A lead-lap a napi munka szíve: itt fut végig egy szereplő a teljes láncon —
adat-ellenőrzés → mock-generálás → kurátori döntés → megkeresés → konverzió.

![Képernyőkép: a lead-lap telefonon](assets/hu/screen.png)

## A fejléc — mielőtt bármit csinálsz

A név melletti badge a honlap-kvalifikáció; a tény-sávban ország, város, régió, cím, a talált
honlap (kattintható), a **„Match-konfidencia”** (mennyire biztos, hogy a begyűjtött adatok tényleg
erről az üzletről szólnak — alacsony értéknél ELŐBB ellenőrizz, csak utána generálj), és a
legutóbbi mock állapota.

A megkeresés-jelvény pontosan annyit mond, amennyi TÖRTÉNT: „2 megkeresés · még nem ment ki”,
„2 megkeresés · ebből 1 ment ki”, vagy — és csak ekkor zölden — „2 megkeresés · kiküldve”.
Ha a szám kisebb, mint a megkeresések száma, akkor tényleg van még, ami nem ment ki.

## Begyűjtött adatok

A **„Begyűjtött adatok — szerkeszthető”** panelben pótolhatod és javíthatod, amit a scrape hozott;
a mentett érték a következő mock-generáláskor már érvényes. Azt, hogy melyik mező honnan jött
(forrás + konfidencia, kattintható forrás-linkkel), az **Audit** fülön a **„Provenance (A4)”**
lenyíló táblázat mutatja. Ha az adat hiányos vagy gyanús, az **„Adatok újragyűjtése”** gomb
friss webes keresést futtat erre az egy leadre.

## Mock-generálás

A generáló panelben a **„Kinézet-típus”** kártyákon választod ki, milyen elrendezéssel
készüljön a mock, majd a gombbal indítod. Az elkészült mock az „előnézet ▸” linken nyílik.

⚠️ **A választó TÖBBSZÖRÖS, és alapból egy sincs bejelölve.** Amennyi kártyát bejelölsz, annyi
külön mock készül; ha egyet sem jelölsz be, egy alapértelmezett kinézettel készül el. Ezt
érdemes tudni, mert könnyű azt hinni, hogy „nem az készült, amit kértem”, holott választás
nélkül a rendszer maga döntött.

### Honnan tudod, hogy fut, és mikor bukott el

A generálás 1–2 percig tart, ezért **a lap tetején** — közvetlenül a szállás neve alatti sötét
sáv alatt — végig ott van egy világoskék csík: **„Mock generálása fut”**, mellette az **eltelt
idő** (percre-másodpercre ketyeg) és a „~1-2 perc — a lap magától frissül” felirat. Amíg fut:

- a fejléc mock-pirulája nem „approved”-ot mond, hanem **„mock: generálás fut”** az eltelt idővel
  — a régi állapot nem állíthatja magáról, hogy ez a friss;
- a **„Mock és generálás”** fülön lüktető pötty jelzi, hogy ott dolgozik valami — akkor is
  látod, ha épp másik fülön állsz;
- a lap magától újratölt, nem kell frissítened.

⛔ **Ha elbukik, azt is a lap tetején mondjuk meg.** Ugyanaz a sáv pirosra vált, és kiírja az
okot (például *„A generálás elbukott: Your credit balance is too low to access the Anthropic
API.”*). A kimenet a gomb fölött is ott marad, hogy ne ugyanazt a gombot nyomogasd egy olyan
hibára, amit előbb máshol kell orvosolni.

### A jobb oldali előnézet ENNEK a leadnek az adata

A kártyák mellett élő keretben látod, hogy néz ki **ennek a szállásnak** a lapja a kijelölt
kinézeten — a legutóbbi mock szövegével és képeivel, új generálás nélkül. Másik kártyát
jelölsz be, a keret azonnal átvált rá.

⚠️ Ha a leadhez **még nincs egyetlen generált mock sem**, nincs mit renderelni: ilyenkor egy
**MÁSIK szállás** mintája látszik ezen a kinézeten, és a kép alatti felirat ezt ki is mondja.
Az első mock után a saját lapja kerül a helyére.

## A nyitókép felülbírálása

A rendszer maga választ nyitóképet — **a legjobbat, nem a legnagyobbat** —, és minden képnél
kiírja, mit lát rajta. Ha nem értesz egyet vele, felülbírálhatod.

**Két helyen tudsz jelölni, és másképp néznek ki:**

- A **Fotók panelen** minden képnél ott a pontszám és az indoklás, a kép alatt pedig a
  **„Legyen ez a nyitókép”** gomb; az aktuálison **„ez a nyitókép”** áll. Kockázatos
  választásnál megerősítést kér.
- **„A mock szövege”** panelen egy sáv mutatja a nagy aktuális nyitóképet — rajta a
  **„NYITÓKÉP”** címke —, mellette a többi kép alkalmasság szerint. Itt a bélyegre magára
  kattintasz: „Kattints, ha mást akarsz a lap tetejére — a mock azonnal újrarenderelődik.”

- A jelölés **a leadhez tapad**, és a mock **azonnal újrarenderelődik** vele — a sáv ki is írja:
  „Kézi nyitókép — … választotta. A mock már ezzel van renderelve.”
- ⛔ **Kiküldött mockot NEM cserél ki alattad.** Ha a mock már ki lett ajánlva a leadnek, a
  csere elmarad, és a lap tetején piros sávban megjelenik az indok: *„Ez a mock már ki lett
  ajánlva a leadnek — a nyitóképét nem cseréljük ki alatta. A választást elmentettük: a
  következő generálás már ezzel készül.”* Amit a szállásadó egyszer megkapott, azt utólag nem
  írjuk át — a jelölésed viszont nem vész el.
- A **„Vissza a gépi választásra”** gombbal visszavonod a jelölést. Ez **nem a korábbi állapotot
  állítja vissza**, hanem újra lefuttatja a szabályt — az eredmény lehet más kép is, mint ami
  a jelölés előtt volt.
- Ha egy képről nincs ítéletünk, a sáv ezt kimondja („Erről a képről nincs ítéletünk — a mock
  kurátor-sorban marad”), nem találgat.

**⚠️ „nem ítélt” és „nem tölthető be” — KÉT KÜLÖNBÖZŐ dolog.** Könnyű összekeverni, pedig
egészen mást jelentenek:

- **„nem ítélt”** = nincs róla gépi véleményünk (nem néztük meg, vagy nem fért bele a
  pontozott képek körébe). A kép attól még tökéletes lehet.
- **piros sor a csempe alatt** = a képet MAGÁT nem sikerült betölteni, és ott áll az ok is —
  például *„Ez a kép már nincs meg a forrásnál — 404-et ad (hovamenjek.hu).”* Ilyenkor a
  csempén egy piros háromszög és a **„nincs kép”** felirat látszik, nem a böngésző
  törött-kép ikonja.

⛔ **Ha van ilyen kép, a választó alatt piros összegző sor jelenik meg:** *„N kép forrása nem
érhető el — ezek a képek a LEADNEK kiküldött lapon is törötten jelennek meg.”* Ez nem
szépséghiba: **ugyanezek a képek hiányoznak a szállásadónak megmutatott lapról is.** Ilyenkor a
Fotók fülön a **„Portál-fotók újra-scrapelése”** a következő lépés, és utána új mock.

**A reklámbannerek nem választhatók.** Ha egy képről kiderült, hogy egy MÁSIK cég hirdetése, a
csempéje halványan ott marad — a felirata **„kizárva”**, és megnevezi, mit lát rajta
(**„nem kerül a lapra”**) —, de nem lehet rákattintani: a generált oldalra sem kerül ki.

⚠️ **A „nem találtunk fotót” a LEADRŐL szól, nem rólunk.** Ha nálunk akad el valami (például
elfogy a kép-forrás napi kerete), azt a panel külön mondja meg — olyankor a lead ártatlan, és
érdemes később újrapróbálni.

## „A mock szövege” — a szöveg-panel

Az **„A mock szövege”** panelen látod, amit a szállásadó olvasni fog — és itt kérhetsz rajta
változtatást. Két chip-csoport van, és **csak az alsó kattintható**:

- **„Ezeket a hirdetésből eladja”** — amit a szöveg már említ. Ezek csak tájékoztatnak,
  nem lehet rájuk koppintani.
- **„Ezeket nem említi — koppintson, hogy bekerüljön”** — a kimaradt tények. **Ezek a
  kattinthatók.**

⚠️ A koppintás **nem cseréli le a szöveget**, hanem beírja a tételt az alatta lévő utasítás-mezőbe
(**„Mit csináljon másképp? (elhagyható — vagy koppintson a fenti pontokra)”**) — ugyanoda,
ahova te is írhatsz saját kérést. A panel ezt maga is kimondja. A tényleges átírást a
**„Szöveg újragenerálása”** gomb indítja.

A forrás-panel „igazolt tény kimaradt” sora is ide mutat vissza, és **pontosan ugyanazt a
listát** mutatja, mint a fenti chipek — ugyanannyi tételt, ugyanazokkal a nevekkel. Ha a kettő
eltérne, az hiba: jelezd, ne találgass, melyik az igaz. (Korábban a lenti sor a nyers listát
írta ki, a fenti pedig a megszűrtet, így ugyanaz a lap két különböző számot mondott.)

⛔ **Meddig írható át?** Nem a jóváhagyás a határ — az után is újragenerálhatod. A szöveg
abban a pillanatban fagy be, amikor a Megkeresés fülön megnyomod a
**„Követett link készítése”** gombot: onnantól a mock ki van ajánlva a leadnek, és nem
írjuk át a címzett alatt. ⚠️ **Ez a küldés ELŐTT történik** — hiába nem ment még ki levél,
a link elkészítése után már elutasítást kapsz. Ilyenkor a kiút: **generálj új mockot**, ha
másik ajánlatot akarsz adni.

## „Honnan tudjuk?” — a szöveg forrásai

A **„Mock és generálás”** fülön, a szöveg-panel alatt a **„Honnan tudjuk? — a szöveg forrásai”**
panel mutatja, MIBŐL dolgozott a generátor ennél a mocknál (a generáláskori pillanatképből — ha
azóta újragyűjtöttél, az itt nem látszik, csak a következő mockban). A panel csak azokon a
mockokon jelenik meg, amelyek **a forrás-panel élesítése ÓTA** készültek: a korábbiakhoz nincs
pillanatkép, ezért panel sincs — generálj újat, és megjelenik.

![Képernyőkép: a „Honnan tudjuk?” forrás-panel](assets/hu/source-panel.png)

1. Fent négy forrás-kártya: portál-adatlapok, vendég-vélemények, tulaj-bemutatkozás, képek —
   számokkal. A szaggatott szegélyű kártya hiányzó forrást jelent (pl. „nincs megadva”
   tulaj-bemutatkozás): ez nem hiba, de ha pótolható, pótold — a tulaj-bemutatkozást az
   **„Adatok”** fülön, a **„Begyűjtött adatok — szerkeszthető”** blokk **„Tulaj-bemutatkozás”**
   mezőjében írhatod be; a hiányzó portál-adatra pedig ugyanott indíthatsz újragyűjtést.
2. Alatta a mock szöveg-elemei tény-chipekkel — főcím, bemutatkozó, kiemelések és így tovább.
   ⚠️ Itt **csak az az elem jelenik meg, amelyikhez tartozik chip**: ha egy elemre (tipikusan
   az alcímre) egyetlen tény sem illeszkedik, az a sor némán kimarad a panelről. Ne lepődj meg,
   ha nem látod mindegyiket — a képen sincs rajta mind.
   A chip színpöttye a forrás: cián = vendég-vélemény, zöld = tulaj-bemutatkozás,
   piros = forrástalan, **sötétkék = minden más** (jellemzően a portál-adatlap, de ide esik a
   szállás saját leírásából kinyert és a be nem azonosított forrású tény is).
   **A chipre kattintva megnyílik a forrás-doboz**, négyféle tartalommal:
   ① szó szerinti, gépileg ellenőrzött idézet a forrás nevével;
   ② **„A szolgáltatás-listájában szerepel (nincs külön szöveg-idézet).”**;
   ③ **„A leírás-elemző nyerte ki a szövegből (ehhez nem készül szó szerinti idézet).”**;
   ④ a PIROS chipnél **„FORRÁSTALAN”** — **„Ezt az állítást egyik forrás sem támasztja alá —
   a tényhűség-őr jelölte. Újragenerálás vagy kézi javítás javasolt.”**
   A ② és ③ nem hiba (ott nincs mit idézni), a ④ viszont **cselekvést kér** — ez az egyetlen,
   amivel dolgod van. Újabb kattintás csukja.
3. A zöld sáv azt igazolja, hogy nincs forrás nélküli állítás; ha lenne, piros sávot látsz a
   tételekkel. Alatta az „igazolt tény kimaradt” sor: ezek benne vannak a forrásokban, de a
   szövegből kimaradtak — a fenti szöveg-panelen egy koppintással visszaadhatod őket az
   újragenerálásnak.
4. A „csak a problémák” pipával a panel elrejti az egészséges részeket, és csak a piros
   chipes elemeket meg a figyelmeztetéseket hagyja fent — gyors ellenőrzéshez.

## Kuráció — ember dönt

Minden mockon két gomb: **„Jóváhagyás”** és **„Elutasítás”**. Kiküldeni CSAK jóváhagyott mockot
lehet — ez kőbe vésett szabály, a rendszer nem enged vak auto-sendet. Elutasításnál a mock a lap
alján az „Elutasított mockok” csoportba kerül, és bármikor generálhatsz újat.

⚠️ **Egy leaden EGY jóváhagyott mock van.** Ha jóváhagysz egy másikat, a korábbi automatikusan
visszakerül „legenerálva” állapotba, és a lap tetején zöld sávban ezt ki is írjuk. Így a fejléc,
a nyitókép-panel és a megkeresés mind ugyanarra a mockra mutat. (Kivétel: amit **már kiküldtünk**
a leadnek, azt nem minősítjük vissza — az az ajánlat áll.) Visszaminősíteni nem baj: a mock
megmarad, bármikor újra jóváhagyhatod.

## Megkeresés

A **„Megkeresés — követett link”** panel prospect-linket készít a jóváhagyott mockhoz. Az
**„E-mail / SMS megnyitása — küldés ▸”** gomb az Outreach-piszkozat KÉPERNYŐRE visz — ott fut le
a §C-jogszerűségi kapu, ott választasz csatornát, és onnan küldi ki a levelet maga a rendszer
(részletes útmutató: a Súgóban az „Outreach-piszkozat" téma). Ha kézzel, a saját leveleződből
küldtél, a **„Megjelölöm kiküldöttként — mérés indul”** gombbal jelzed — innentől méri a rendszer a megnyitást
és az aktivitást (Tevékenység-gomb).

## Ha a soron „leiratkozott” áll

A leiratkozott prospect sorában piros címke jelzi a leiratkozást a dátumával, és a küldés-gomb
eltűnik. Alatta egy dobozban látod a leiratkozás-naplót: mikor, ki, és — visszavonásnál — mire
hivatkozva.

⚠️ **Egy leiratkozás több sort is némává tehet.** A tiltás nem a linkhez tartozik, hanem a
SZEMÉLYHEZ: ha ugyanaz az e-mail-cím vagy telefonszám bárhol máshol leiratkozott, a rendszer
oda sem küld. Ezért fordulhat elő, hogy egyetlen kattintás után több leadnél is elakad a küldés
— ilyenkor azt a sort kell megkeresni, ahol a piros címke áll.

### A leiratkozás visszavonása

A doboz **„Leiratkozás visszavonása ▸”** sorára koppintva nyílik ki az űrlap. Írd be az
indoklást, majd **„Visszavonás”**. Az indoklás kötelező — üresen vagy pár betűvel a rendszer
nem engedi el.

⛔ **Ezt csak akkor teheted meg, ha a címzett MAGA kérte** (telefonon, e-mailben, személyesen).
A leiratkozás jogilag a címzetté, nem a miénk. Amit beírsz, a naplóba kerül a felhasználóneveddel
együtt, és ott is marad — ez a bizonyíték arra, hogy volt jogalapod. Ha nincs ilyen kérés,
hagyd a leiratkozást érvényben.

Visszavonás után a piros címke eltűnik, a küldés-gomb visszajön, a napló pedig megmarad a soron.

⭐ **A visszavonás annyira ér el, amennyire a tiltás.** Mivel a tiltás a SZEMÉLYHEZ tartozik, a
visszavonás egyszerre oldja fel az ÖSSZES olyan követett linket, amelyik ugyanarra az e-mail-címre
mutat — a visszajelzés meg is mondja, hányat („Leiratkozás visszavonva 2 követett linken”).
⚠️ Ha a személyt a TELEFONSZÁMA miatt még egy másik lead sora is tiltja, a rendszer ezt KIMONDJA,
és nem ígér küldhetőséget: „a megkeresés MÉG NEM küldhető: …”. Ilyenkor azt a sort is meg kell
keresni. (A cím kis- és nagybetűs alakja ugyanaz a személy: `Info@…` és `info@…` egy postafiók.)

## Konverzió

Ha a tulaj megrendelt, a jóváhagyott mock alatti űrlapon a **„Konvertálás privát előnézetbe ▸”**
gomb indítja az élesítést — a modulok a tulaj konfigurátor-választásából jönnek, nem kézből.

## Diszkvalifikálás

Ha a szereplő biztosan nem célpont, a lap alján a **„Diszkvalifikálás”** panelben indokkal
kivezetheted — megmarad, az újra-scrape sem hozza vissza, és bármikor visszavonható.
