# Viselkedés-üzenet — befagyasztott terv (ADR-XXXX)

**Jóváhagyva:** tulaj, 2026-11-11, a koordinálón át (cit8a744532). A terv-kapu (§2b) szerint ez a
megvalósítás KONTRAKTUSA: amit alább „KÖT” jelöl, az elvárt viselkedés, nem stílus-javaslat.

Fájlok:
- `plan.html` — a működő mock (A/B/C/K fül, Mobil 390 / Asztali váltó). A **B** és **C** fül és a
  „Kivezetjük” / „Csendben” eszkalációs opció csak a döntés előtti összehasonlítás része, **NEM KÖT**.
- `terv-A-mobil.png`, `terv-A-asztali.png` — az A változat a végleges döntéssel (ablak 8–20, „NEM” sor
  nélkül, eszkaláció marad).
- `terv-K-mobil.png`, `terv-K-asztali.png` — a konzol-nézet (K) terve.

## A tulaj döntése (KÖT)

1. **Változat: A** — leadenként EGYETLEN üzenet, örökre.
2. **Küldési ablak: hétköznap 8:00–20:00** (Budapest), hétvégén nem megy.
3. **Az eszkalációs ajánlat (−30%, 72 óra) MARAD.** Ebből: a viselkedés-üzenet **semmilyen kedvezményt
   nem említ** (se a −30%-ot, se a bemutatkozót), így nem mondhat mást, mint a lap.
4. **A „NEM” válasz NEM iratkoztat le automatikusan** → a „Ha nem érdekli, írja vissza: NEM” mondat
   KIMARAD az SMS-ből; a leiratkozás a linkelt lapon marad (ADR-0112). Ha a lead válaszol, az a tulaj
   jóváhagyó sorába megy, és a leadnek több automatikus üzenet nem jár.
5. **SMS ékezet nélkül (GSM-7)**, legfeljebb 2 szelet; hosszú névnél a név rövidül, a link soha.

## Viselkedés (KÖT)

- **Kiváltó** (csak a konzol-főkapcsoló bekapcsolása UTÁNI események; visszamenőleges kör nincs):
  2. látogatás (egy látogatás, amely előtt már volt egy) · árnézés (`panel_open`) · próba-gomb
  (`trial_open`), el nem küldve. A saját `#inditas` linkünk nyitotta `trial_open {via:"link"}` nem kiváltó.
  Több lépésnél a legerősebbre válaszol: próba-gomb > árnézés > látogatás.
- **Időzítés:** az utolsó aktivitás után 20 perccel (új látogatás tolja); ablakon kívül a következő
  hétköznap 8:00 utáni első futáskor; **4 napnál régebbi kiváltóra nem megy** (megvalósítási döntés:
  egy kiesés vagy hosszú ünnep ne küldjön elfelejtett látogatásról üzenetet).
- **Csatorna:** ha a hideg megkeresés a lead magyar mobiljára ment (SMS / MMS-pár) → SMS; különben, ha a
  hideg levél kiment → e-mail a helyi segítő nevében (ADR-0425). Személyenként egy üzenet: (csatorna,
  cím) egyedi.
- **Szöveg:** egy mondat, egy link a kerdes-inditas horgonyára (befagyasztva:
  `assets/design-refs/prospect-page/kerdes-inditas/README.md`):

  | kiváltó | horgony | SMS (forrás, `T()`-vel; kiküldve GSM-7-re hajtva) |
  |---|---|---|
  | látogatás | `#kerdes` | „{név}: ha a honlap-tervével kapcsolatban kérdése van, a terv alján azonnal választ kap rá. {link} Citoviso” |
  | árnézés | `?k=ar#ar` | „{név}: a honlap-terve havi {ár} Ft-tól indul. Hogy mi van benne és mi nem, itt látja: {link} Citoviso” |
  | próba-gomb | `#inditas` | „{név}: a honlap-tervéből egy kattintással élő honlap lesz, {napok} napig ingyen, kártya nélkül. {link} Citoviso” |

  Az ár a legolcsóbb kínált csomag „-tól” ára (ugyanaz, mint a hideg levélben), a napok a lap által
  kínált próba hossza. Ha a lap nem kínál próbát → az árnézés szövege megy; ha nincs ár → a kérdésé.
  A „próba-gomb” szövegben a „terv” szó a §A demó-keretezés miatt kötelező (a §C kapu kéri); a „saját
  címén” az SMS-ből kimaradt (jog-őr 2026-11-12: a próba citoviso-aldomainen fut, a „saját cím” saját
  domaint sugallna — a levél a címet szó szerint kiírja). A levélből a „Nem kell semmit beállítania” mondat
  kimaradt (koordinátor 2026-11-12: a beállító varázsló miatt nem igaz); marad: „A próba végén Ön dönt,
  folytatja-e.”
  Az e-mail ugyanezt mondja egy bekezdésben, egy gombbal, a segítő aláírásával, leiratkozó linkkel
  (+ `List-Unsubscribe` fejléc a hideg levél kapcsolója szerint), a próba-kampány jogalap-mondatával
  (a küldött tervre hivatkozik, NEM arra, hogy „megnézte”; tiltakozási joggal) és cégazonosítással.
- **Leállítók** (a küldés előtt újramérve): leiratkozott (link, cím vagy szám szintjén) · „ne keressük”
  (ADR-0421) · válaszolt bármelyik üzenetre — a válasz és a „ne keressük” SZEMÉLY-szintű: ugyanazzal a
  mobillal / címmel egy másik lead sem kap · próbázik / próbázott · rendelt / rendelési szándék ·
  kizárt / megszűnt lead · teszt · archivált link · közös cím / szám, ha másik lead már kapott
  (ADR-0353) · nem jóváhagyott vagy őr-leletes mock.
- **Főkapcsoló:** alapból KI. A deploy telepíti az időzítőt, de üzenet csak a konzolon (CRM →
  Viselkedés-üzenetek → „Bekapcsolás”) bekapcsolás után megy.

## Konzol-nézet (K) (KÖT)

Új lap: **CRM → Viselkedés-üzenetek** (a tervben „Megkeresések alatt”; a konzolban ennek a CRM modul
felel meg). Főkapcsoló · öt szám (kiment / 24 órán belül visszajött / kérdezett / indított /
leiratkozott) · szűrők (Mind · Visszajött · Árnézés · Próba-gomb · Leállítva) · üzenetenként egy sor,
koppintásra a kiment szöveg · kiváltónkénti összesítés. A „kérdezett” a kerdes-inditas `ask_q` eseménye.
