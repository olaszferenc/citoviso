## ADR-0167 — A lead-lap első kérdése a MUNKAMENET, nem egy pontszám; és minden szám vezesse le magát (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0161 (a testvér-felület,
a lead-LISTA — az állapot-szótár ott dőlt el és ide is áll), ADR-0164 ④ (a kontraktus
SZERKEZETET is köthet — ez a terv élni is kezd vele), ADR-0141 (nincs nyers adatbázis-érték
a felületen), ADR-0101 ① (nincs „a(z)”), ADR-0130 (a figyelmeztetés nem kapu), ADR-0149 (minden
Elek-lépésről két kép), 03-INVARIANTS §B.17 (tényhűség).
**Kontraktus:** `assets/design-refs/console/lead-page/` (tulaj jóváhagyta 2026-09-14,
„B” változat: munkamenet-sáv és összehasonlító mock-tábla).

⭐ **A kontraktus él az ADR-0164 ④ képességével:** `**Hatókör:**` sor + `## Kötő horgony`
szakasz, 13 szerkezeti azonosítóval. Ennek a tervnek a legtöbb eleme **ADAT**-ot jelenít meg
(dátum, képszám, arányok), nem literált — a felirat-kötés egyedül tehát **meg sem kérdezte
volna**, hogy a munkamenet-sáv vagy az összehasonlító tábla kikerült-e egyáltalán. Pontosan az
a hibaosztály, ami a fizetőoldal tétel-dobozát három napig észrevétlenül hiányzóvá tette.

**Kiváltó (Elek FK-003b, 2026-09-13; minden premissza újramérve 2026-09-14-én).** Az operátor
lead-lapja nyolc ponton mondott mást, mint ami van — de a leletek **egy tőről** fakadnak: a lap
**adat-lapként** volt megszerkesztve (mezők, számok, kártyák), holott a kurátor **munkamenetet**
vezet rajta, és egyetlen kérdése van: *hol tart ez a lead, és mi a következő lépés.*

### ① A FEJLÉC NAGY SZÁMA HELYÉRE MUNKAMENET-SÁV

A fejléc legnagyobb, legelső eleme a match-konfidencia volt. Mérve: **595 leadből 109-nek
nincs értéke** — azoknál a lap legfeltűnőbb helyén egy alig látható szürke `–` állt navy
alapon, a magyarázata pedig egy MÁSIK fülön, a lap közepén. **Döntés:** a helyére **hat állomás**
kerül (Begyűjtve · Mock · Jóváhagyva · Kiküldve · Rendelés · Fizetve), és **minden állomás vagy
DÁTUMOT mond, vagy azt, hogy „még nem”** — ⛔ néma gondolatjel sehol (a `–` egyszerre jelentett
„nem mértük”-et és „nulla”-t). A soron következő állomás **megjelöli magát**.

⚠️ Ehhez a `LeadDetail` megkapta a `surveyedAt`-ot. A „Begyűjtve” állomásnak **valódi dátum**
kell: egy kitalált vagy elhagyott dátum ugyanaz a hibaosztály, mint amit ez az ADR megszüntet.

### ② FUTÁS KÖZBEN SEM VÉSZ EL, HOGY VAN JÓVÁHAGYOTT MOCK

A régi fejléc-pirula feltétele (`latestMock.status !== "approved"`) **pont abban az esetben volt
hamis**, amit a lelet leír: újragenerálás alatt a legfrissebb artefaktum `running`, tehát a
„van jóváhagyott mock” tény **eltűnt a képernyőről**, és csak egy gépi `data-cit-approved`
attribútumban élt. Ezen múlik, hogy a megkeresés kiküldhető-e. **Döntés:** a **Mock** állomás
vált futás-állapotra (eltelt idővel), a **Jóváhagyva** állomás viszont **a helyén marad a saját
dátumával** — a sáv nem felejt.

### ③ MINDEN SZÁM VEZESSE LE MAGÁT, VAGY MONDJA KI, HOGY NEM JÖN KI

Két lelet, egy szabály:

- **Három szám ugyanarról.** Mérve ezen a leaden: **12** (Adatok fül) · **11** (portál-bontás) ·
  **10** (a mockba ment) — és a bontás `0+11+0` **nem adta ki a 12-t**, mert a Street View
  „igen”-ként szerepelt, de darabként beleszámított. Most **egy mondat** (hányat gyűjtöttünk,
  ebből hány ment a mockba) + **kinyitható bontás** — és ⛔ ha a részek nem adják ki az
  összeget, a lap **kimondja**, nem elsimítja.
- **A két főszám összeadódik.** A „mit használ fel a szöveg” sáv eddig „9 szolgáltatást 18-ból”
  és „3 dolgot nem említ” alakban szólt — a maradék **6 tétel sorsáról egy szó sem**. Most a
  **harmadik szakasz** (ismétlés/általános) is ott van, a lap **kiírja az összeadást**, és
  kimondja, hogy a nevező nem csak a gyűjtésből jön, ezért generálásonként változhat.

Ez az `feedback_two_divisors_on_one_row` és a `feedback_screen_must_not_shrink_or_decide`
osztálya: **a képernyő ne mondjon kevesebbet, mint amennyi történt**, és a részek adják ki az
egészet.

### ④ SZÁMLÁLÓ HELYETT MONDAT — MERT A HIÁNYZÓ SZÁM IS ÁLLÍTÁS

Hét fülből **hat** viselt magyarázat nélküli számot, a **„Fotók” egyet sem** — így a hiánya
„üres”-nek olvasódott, pedig nem az. **Döntés:** a fülsor alatt **egy sor mondja meg, mi van a
megnyitott fülön**, és követi a fül-váltást. A szöveget a **kiszolgáló** írja le fülönként (nem
egy kézzel karbantartott JS-objektum) — a `feedback_one_rule_two_copies` miatt: egy felirat két
példányban két igazság.

### ⑤ AZ ÖT EGYFORMA KÁRTYA HELYÉRE ÖSSZEHASONLÍTÓ TÁBLA

Az artefaktum-kártyák címe minden azonos sablon/arculat-párra ugyanaz volt: a kártyák nem
mondták meg, **miben különböznek**. **Döntés:** egy tábla, oszlopai **készült · sablon/arculat ·
képszám · nyitókép · állapot · döntés** — így „öt egyforma kártya” **szerkezetileg lehetetlen**.
⚠️ A műveletek (jóváhagyás, elutasítás, konvertálás, törlés) **a kártyákon maradnak,
változatlan űrlapokkal**: egy táblába tömörítve a megerősítő párbeszédek és a fotó-kapu doboza
elveszne — a tábla ÖSSZEHASONLÍTÁSRA van, nem a cselekvés kiváltására.

### ⑥ NINCS GÉPI SZÖVEG AZ OPERÁTOR SZEME ELŐTT

`kulcs=érték` felsorolás (üres `heroScore=` mezőkkel) helyett **megnevezett sorok, és az ÜRES
mező meg sem jelenik**; nyers `reject` enum helyett a **közös szótár** magyar szava (ADR-0161 ②);
`superseded_by:<uuid>` helyett **„Felülírta: …”**. A nyers alak **kinyitva** elérhető marad — a
fejlesztőnek kell, az operátornak nem. Ez az ADR-0141 kiterjesztése a lead-lapra.

### ⑦ A GOMB A SAJÁT TETTÉT MONDJA

**„Megjelölöm kiküldöttként”** — ⛔ nem „mérés indul”, mert a követett linken **már 119 esemény
van**. A mérés a link létrehozása óta fut; a megjelölés azt rögzíti, hogy INNENTŐL a forgalom a
címzetté. A magyarázat a gomb **mellé** került.

### ⑧ TELEFONON A SÁV FÜGGŐLEGES, A TÁBLA SOROKKÁ BOMLIK

390 px-en hat állomás vízszintesen vagy kigörögne, vagy olvashatatlanul összenyomódna — ez
**külön tervezői döntés**, nem a desktop lelőve. A mock-tábla ugyanígy: fejléc nélkül,
soronként megnevezett mezőkkel.

**Az elvetett változat** („A” — megtartott fejléc-metrika, kártyák kiegészítő sorokkal) a
kontraktus mellett marad képen, hogy a döntés MIRE mondott nemet, az is dokumentálva legyen.
⚠️ A kontraktus a **mock-fül** felvételeit is tartalmazza (`B-mock-ful-*.png`): a két változat
legnagyobb különbsége ott ül, a lap érkezési állapotában pedig nem látszik —
`feedback_mock_omitted_the_broken_half`.

### AZ ŐR — ÉS AMIÉRT GEOMETRIÁVAL ÍTÉL

`scripts/lead-page-plan-check.mts` a KIRENDERELT lapon mér, valódi stíluslappal; piros
öntesztje 4 állítást buktat a visszarontott lapon.

⚠️⚠️ **A fül-mondat láthatóságát `elementFromPoint`-tal ítéli, nem a meglétével — és ez nem
elméleti.** A megvalósítás ELSŐ változatában a mondat ott volt a lapon, helyes szöveggel, a
teljes-lapos screenshot is rendben mutatta, közben a **RAGADÓS fülsor** (top=60, bottom=111)
**teljesen rátakart** (top=59, bottom=78): az operátor soha nem látta volna. A javítás: a fülsor
és a mondat **egy ragadós egység** (mérve utána: 60–111 és 111–147, takarás nélkül). Ugyanaz az
osztály, mint a `reference_fullpage_shot_hides_dead_sticky`.

**A saját őröm három rése, menet közben javítva** (mind a
`feedback_guard_greenly_defended_the_bug` osztálya):
- a sáv- és a sávdiagram-állítások a **DOM-jelenlétet** mérték, nem a **láthatóságot**:
  `display:none`-nal elrejtve **mind zöld maradt**. Most mindkettő geometriát néz.
- a `decisionNote` mintája **36 karakteres uuid-alakhoz** kötött, a fixture rövid idjével nem
  illeszkedett — vagyis a nyers `superseded_by:…` **átment volna**. Most az ELŐTAGRA köt.
- a ⑥ állítás **üres halmazon** mért, mert a fixture-ből hiányzott a szöveg-panel bemenete.

⛔ **És amit a KÉPERNYŐKÉP fogott meg, nem a fordító:** a `latestMock` deklarációja a
használata UTÁN állt; a `tsc --noEmit` átengedte, a lap viszont futásidőben elszállt
(„Cannot access 'latestMock' before initialization”). Ezért kötelező a §2b 2. lépése — a
fordító zöldje nem helyettesíti azt, hogy MEGNÉZED a lapot.

**Hatókör.** Az irányítópult „13/14 eladó” piros jelvénye és a diszkvalifikált lista-nézet
hiányzó „mikor/ki” adata **nem** tartozik ide (ugyanaz a hibaosztály, másik felület) — a
lista kontraktusánál nyitva.

**Visszafordíthatóság:** 🔄 felület- és szöveg-szintű; egy olvasott mező (`lead.created_at`)
került a lead-részletbe, nulla migráció, nulla adat-mozdulat.
