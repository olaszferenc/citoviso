# Tenant-admin — Üzenetek: ÜGYEK, nem levelek

**Státusz:** a tulaj jóváhagyta (2026-09-14) — a §2b körből a C változat nyert · **Kapu:** CLAUDE.md §2b
<!-- ⚠️ A változat NEVÉT szándékosan NEM `**„…"**` alakban írjuk: a contract-drift-check
     azt KÖTŐ FELIRATNAK olvassa, és egy tervezői opció-nevet keresne a felületen. -->

**Hatókör:** `src/server/adminViews.ts` · `src/tenant/messages.ts` · `src/tenant/messageThreads.ts` · `src/tenant/messagePreview.ts` · `src/tenant/subscriptionAdmin.ts`

**Döntés:** ADR-0154 (`_planning/DECISIONS.md`).

**Kiváltó mérés:** Elek FK-001 (`elek/runs/FK-001-2026-09-13T12-52-35/LELETEK.md`) — E1, E2, E3, Z4 + FK-006b.

- Terv (kattintható, működő): `plan.html`
- Képek: `uzenetek-{mobile,desktop}.png`

**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A megvalósítást ehhez mérjük; a csendes
eltérés ugyanolyan súlyos, mint a kapu megkerülése.

---

## 0. ⛔ AMIT EZ A TERV FELÜLÍR — és amit NEM

**FELÜLÍRJA az ADR-0127 ① döntését** („a szálba csukás nem épül meg"). Az a döntés
2026-09-13-án **a foglalás-szálakra mért adatból** született: ott a csukás 35 sorból
egyet nyert volna, miközben 34 KÜLÖN foglalást rejtett volna el. Ez az érvelés **áll
is** — és ez a terv **nem is bántja a foglalás-szálakat**. Amit felülír, az a
következtetés kiterjesztése a **dunning-létrára**, amiről az Elek AZÓTA mérte meg,
hogy önmagában **50 sor egyetlen ügyről**, és a lap 69%-át teszi ki.

⛔ **NEM ÉRINTI** (tulajdonosi döntés, 2026-09-14-én újra megerősítve):
- a **számla-sorok felépítését** a Dokumentumok listán (ADR-0125 ③) — a 9 egyforma sor
  úgy marad, ahogy van;
- a `dunning → szamlazas` **téma-besorolást** (ADR-0127 ①);
- azt, hogy a **számla nem állapot-szál**: egy új számla nem teszi valótlanná a régit
  (ADR-0125 ⑤ „ami szándékosan kimarad").

## 0b. ⚠️ MENNYIT NYER — MÉRVE, hogy ne várjunk tőle többet

A jóváhagyáskor „71 sor → ~12 ügy" hangzott el. **Megmérve a park 2026-09-13-i
összetételén: 71 üzenet → 22 felső szintű sor.** A különbség nem hiba és nem is
javítható ezzel a szabállyal: a maradék **19 sor a 19 SZÁMLA**, amit a fenti ⛔ pont
szándékosan nem szálasít. A nyereség tehát **50 dunning-sor → 1 ügy-sor**, és a lap
9 képernyőről ~2-re rövidül. Ha a számla-sorok száma zavaró, az **külön** kérdés
(pl. év szerinti csoportosítás), nem ezé a tervé.

---

## 1. Amit a terv KÖT

### ① Az ÜGY a sor, nem a levél

- Egy **állapot-szál** (`dunning`, `multilang`, `booking` a maga `related_id`-jével)
  **EGY soron** áll a listán: a szál **legfrissebb** üzenete, a mai állapottal.
- A korábbi lépések **nem tűnnek el**: a sor alatt nyitó áll, ami **megnevezi a
  darabszámot**, és egy koppintásra kinyitja őket. Kötő felirat:
  **„Ugyanennek az ügynek a korábbi"** (a darabszám és a szó-alak ragozódik).
- A szálon KÍVÜLI üzenet (számla, belépési adat, `related_id` nélküli érdeklődés)
  **ugyanúgy önálló sor marad**, mint ma.
- A kinyitott lépések **ugyanazt** a sort kapják, mint eddig: áthúzott cím,
  **„Túlhaladott"** jelölés és a felülíró üzenet megnevezése időponttal.
- ⛔ A csukás **semmit nem rejt el a kereséstől és a szűréstől**: a találat-szám a
  TELJES üzenet-halmazra vonatkozik, nem a sorokra. Egy szűrő, ami elrejtene egy
  találatot, pontosan az a hibaosztály, ami ezt a kört elindította.

### ② A TÚLHALADOTT ÜZENET NEM OLVASATLAN

- Mérve (Elek FK-001 E2): a bal menü **71**-et riasztott, és ebből **49** olyan sor
  volt, amit a rendszer MAGA nyilvánított elavultnak. Teendőnek mutattuk azt, amit
  mi magunk zártunk le.
- Mostantól az olvasatlanság predikátuma: `readAt === null` **ÉS** a sor **nem
  túlhaladott**.
- ⛔ **EGY SZABÁLY, EGY FORRÁS.** Ugyanez a predikátum adja
  (a) a bal menü jelvényét, (b) az „Olvasatlan" chip számát, (c) a tömeges
  olvasottnak-jelölés hatókörét és feliratát. Külön ág = két igazság egy képernyőn.
- A tömeges jelölés **pontosan azokat a sorokat billenti, amiket megszámolt** — se
  többet, se kevesebbet.

### ③ AZ ELŐNÉZET A TARTALMAT MUTATJA, NEM A MEGSZÓLÍTÁST

- Mérve: 19 számla-értesítő előnézete **betűre azonos**: „Kedves Elek Teszt!" (a
  törzs első nem-üres sora a megszólítás).
- Az előnézet az első **ÉRDEMI** sor: a megszólítás és a puszta udvariassági mondat
  kimarad.
- Számlánál az előnézet azt mondja el, ami a **CÍMBŐL HIÁNYZIK: az ÖSSZEG**.
  ⚠️ Mérve a vázlaton: az „összeg + tétel" előnézet 19 sorra csak **4-félét** adott,
  mert a tétel MÁR A CÍMBEN ott van. A sor egyediségét a cím adja, az előnézet a
  döntéshez kell.
- **A SOR EGÉSZE legyen egyedi**: cím + előnézet együtt azonosítsa a bizonylatot.

### ④ A SOR MEGMONDJA, HOGY MEGNYITHATÓ

- Minden soron ott a nyitó jelzés. Kötő felirat: **„Megnyitom"** (nyitott állapotban
  **„Bezárom"**). Ma a 90 karakternél csonkolt előnézet mellett semmi nem jelezte,
  hogy a sor egyáltalán kattintható.

### ⑤ A TÖMEGES JELÖLÉS IGE, ÉS MEGERŐSÍTÉST KÉR

- A mai felirat (`Mind olvasott (71)`) állítás-alakú, ige nélkül, közvetlenül egy SZŰRŐ
  mellett — nem dönthető el ránézésre, hogy szűrő, kijelzés vagy tömeges művelet.
  <!-- ⚠️ A RÉGI feliratot szándékosan `kód`-jelöléssel írjuk, nem `**„…"**`-ban: az utóbbi
       KÖTŐVÉ tenné, vagyis az őr pont azt követelné meg, amit épp lecserélünk. -->

- Az új felirat igét tartalmaz: **„Megjelölöm olvasottként"**, a darabszámmal.
- Kattintásra **megerősítést kér**, és a megerősítő szöveg **KIMONDJA A HATÓKÖRT**
  (szűrt lista mellett azt, hogy csak arra hat). Az ADR-0127 ⑦ hatóköre változatlan.
- Ha a hatókörben nincs olvasatlan, a gomb **nincs ott** — üres műveletet nem kínálunk.

### ⑥ SZŰRŐ-SÁV: három kérdés, három sor

- **„Miről szól"** (téma-chipek) · **„Hogyan jött"** (csatorna) · **„Állapot"**
  (olvasatlan).
- ⛔ Ez **módosítja az ADR-0127 ② két soros** elrendezését: ott a „Szűkítés" sor
  csatornát és olvasottságot kevert, amit az Elek Z2-ben leletként jelentett.
- ⚠️ **ÁRA, MÉRVE:** a sáv 390px-en **205px** magas. Ez az a hely, ami a telefonon
  az első üzenet elől megy el. Ha ez sok, a sávot össze kell csukni — de akkor az
  **külön terv-kör**, nem csendes visszavágás.
- Minden chip **számot visel**, és amit ígér, azt szállítja (ADR-0127 ③, már él).
- Üres találatnál a sáv **végig látszik**, és van kiút: **„Szűrés törlése"**.

### ⑦b A VISSZAKAPCSOLÓ SÁV MEGMONDJA, MELY IDŐSZAKOT FIZETTE KI — ÉS ELVEZET A SZÁMLÁHOZ

<!-- ⚠️ EZ A PONT UTÓLAG KERÜLT BE (2026-09-15). A tulaj által jóváhagyott vázlat
     MUTATTA, a kontraktus első változatába viszont nem vettem be — csendben
     szűkítettem a szerződést a terv alá, és a kontraktus-őr emiatt nem is foghatta
     meg. A tulaj kérésére pótolva. -->

- A zöld „A honlapja újra elérhető" sáv eddig kimondta, hogy a díj rendezve, és hogy a
  számlát elküldtük — de **nem azt, hogy MEDDIG van rendezve**, és úgy hivatkozott a
  bizonylatra, hogy **nem vezetett el hozzá** (Elek FK-006b ZAVAROS-1/2).
- A sáv kimondja a kifizetett időszakot: **„Ezzel a"** … időszak **„van rendezve"**,
  és — ha bizonylat igazolja — az összeget is.
- A bizonylat **egy koppintásra** elérhető a Dokumentumok fülön, a számla sorszámával.
- ⛔ **§B.17 — CSAK AMIT MEGTALÁLTUNK:** ha nincs kiállított számla az időszakra, sem
  összeg, sem link nem jelenik meg; a sáv ilyenkor az időszakot mondja el, és a szöveg
  marad a régi. Egy link, ami nem nyílik meg, rosszabb a hiányzó linknél.
- ⚠️ **Az `arrears` mező ERRE NEM JÓ** (mérve): az csak `past_due`/`frozen` állapotban él,
  a sáv viszont pont akkor jelenik meg, amikor a fiók MÁR ÚJRA AKTÍV. A kifizetett ciklus
  ilyenkor maga a FOLYÓ időszak (`current_period_start/end`), mert a fizetés arra állítja.

### ⑦ DOKUMENTUMOK — az összegző megnevezi magát

- A képernyő legnagyobb száma ma „Összesen 1 224 450 Ft", időszak és jelentés nélkül;
  egy tartozás-üzenetek közül idetévedő tulaj fizetendőnek olvassa (Elek Z6).
- Kötő feliratok: **„Eddig kifizetett"** és mellette külön **„Jelenleg fizetendő"**.
- A számok alatt egy halvány sor megmondja, **miből áll** az összeg.

---

## 2. Amit a terv NEM köt

- A sorok színe, a lekerekítés, az ikonok formája — a dizájn-mag (`--citui-*`) dönt.
- A minta-adat (`plan.html`) konkrét szövegei: az a park pillanatképe, nem előírás.
- Az azonos percen belüli sorrend (Elek FK-006b KÉZI KELL-1) — **nyitva marad**,
  külön döntés.
- A kétszer mondott képernyő-név (`<h1>` + kártya `<h2>`) — MINDEN admin-fület érint,
  ezért külön körbe tartozik.
