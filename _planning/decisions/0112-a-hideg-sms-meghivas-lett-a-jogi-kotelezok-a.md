## ADR-0112 — A hideg SMS meghívás lett: a jogi kötelezők a linkelt oldalra kerültek (2026-09-08)

**Státusz:** ELFOGADVA (tulajdonosi döntés, 2026-09-08) — lokálban ÉL, élesre nem ment ki.

**Kontextus.** A kísérő SMS (ADR-0083 MMS+SMS pár) így ment ki:

> „{név} – az imént MMS-ben küldött honlap-látványtervet élőben itt nézheti meg (jogos
> érdekű megkeresés, nem kötelez): {link} – {feladó}. Leiratkozás: {unsub}"

A tulaj ítélete: „ez a szöveg szar". A kifogás nem stilisztikai: a mondat közepén ülő
jogi formula és a MÁSODIK hosszú URL a meghívást hivatalos értesítéssé változtatja, épp
azon a csatornán, ahol a címzett egy ismeretlen számtól kap üzenetet.

**Döntés.** A szöveg meghívás lesz, és a jogi kötelezők EGY KATTINTÁSSAL arrébb, a
linkelt előnézet-oldal lábazatába kerülnek:

> „{név} – az imént MMS-ben küldött honlap-látványtervet most élőben megnézheti és
> kipróbálhatja kötelezettségmentesen! A Citoviso Csapata
> {link}"

Az önálló SMS-sablon ugyanezt a hangnemet kapja. Az aláírás fixen „A Citoviso Csapata"
(nem a beállított személynév) — a tulaj választása.

**Amit ez KÖT (a §C-kapu ennek megfelelően alakult, `outreachCheck.ts`):**
- a szövegből KIKERÜLT a leiratkozó-link (C1) és a jogalap-mondat (C2 fele);
- a szövegben MARADT a lead neve (C3), a terv-keretezés (C4) és a feladó megnevezése;
- a LINK a kötelezők egyetlen hordozója → hiányzó vagy elérhetetlen link = küldés-tiltó
  FLAG, mert az kiút nélküli megkeresést jelentene.

**⛔ Amit a jog/provenance-őr talált az első megvalósításban (mind javítva):**
1. **A C2/C3 kapu élesen NO-OP volt.** A kapu a nyers üzenet-szövegen mért, az éles link
   viszont `https://citoviso.com/p/<lead-slug>/<token>` — benne a márkanevünk ÉS a lead
   neve. Mérve: egy senkit meg nem nevező, ékezet nélküli nevű leadhez írt tömeg-szöveg
   `PASS`-t kapott. Javítás: minden „mit MOND az üzenet" szabály a PRÓZÁN mér (az URL-ek
   kivágva). Az önteszt negatív esetei az ÉLES URL-alakot használják, mert a dev base URL
   nem tartalmazza a márkanevet — a teszt addig a rossz okból volt zöld.
2. **A jogalap tartalmilag nem került át.** A lábléc a MEGTEKINTÉS adatrögzítésének
   jogalapját mondta ki, nem a MEGKERESÉSét — az őr string-illesztése ezt nem látta.
   Javítás: a lábléc kimondja a megkeresés jogalapját (Grt. 6. § / GDPR 6. cikk (1) f))
   és megnevezi a hirdetőt (`OUTREACH_SENDER_COMPANY`); az őr külön méri a kettőt.
3. **404-es előnézet = kiút nélküli címzett.** Hiányzó mock-fájlnál csupasz 404 ment ki.
   Javítás: érvényes token mellett a hiba-lap is viszi a jogi lábazatot.

**Őrök (mindkettő offline, gyors, MINDIG fut a pre-commitban):**
- `scripts/optout-carrier-check.mts` — a hordozó oldalt méri: a VALÓDI `injectTrackingNotice`
  kimenetén a két jogalap + a hirdető neve + a leiratkozó link, az URL illesztése a VALÓDI
  routerhez (mindkét linkalakban), és szerkezetileg, hogy a `/p/` ág (siker- ÉS hiba-ág) tényleg
  ezen keresztül szolgál ki. Negatívan futtatva bukik (3 rontás-eset mérve).
- `scripts/sms-gate-selftest.mts` — a kiszállított szöveget a §C-kapun; a rontott változatok
  (névtelen, tömeg-szöveg, link nélkül, elérhetetlen link, kész-oldal állítás) FLAG-elnek.

**Ezért mozdult modulba az `injectTrackingNotice`** (`src/console/prospectNotice.ts`): a
konzol-szerver importja szervert INDÍT, így a lábazat — ami mostantól a mobil-út egyetlen
jogi hordozója — nem lett volna mérhető. A design-token őr ALLOW-listája követte a fájlt.

**A kiút útvonala — TULAJDONOSI DÖNTÉS, 2026-09-08 (a korábbi nyitott pont LEZÁRVA).**
Kérdés volt: a leiratkozás most követett (a címzettnek meg kell nyitnia a mért előnézet-oldalt)
és két kattintás — visszategyük-e a linket az SMS-be, vagy tegyük tracking-mentessé az utat?
**Tulaj: marad így — a leiratkozás a MÉRT OLDAL MEGNYITÁSÁVAL történik, a link LEGALUL.**
Amit ez kimond, és amit ezért NEM kell újratárgyalni:
- a leiratkozó link nem kerül vissza az SMS-be (a szöveg meghívás marad);
- a lábazat az oldal LEGALJÁN áll (a `</body>` elé injektálva) — az őr ezt szerkezetileg méri;
- a leiratkozás-szándékkal érkező látogatás is rendes, mért látogatás.
⚠️ Ennek EGY ismert következménye van, tudatosan vállalva: a leiratkozáshoz meg kell nyitni és
le kell görgetni a lapot, és az a megnyitás beleszámít az ADR-0088 §4 hármas küszöbébe. Aki
harmadszorra keresi a kiutat, közben megkapja a −50%-os döntés-segítő ajánlatot. Valós kár
ebből nincs: ha leiratkozik, az `unsubscribed_at` miatt sem az utókövető levél, sem semmilyen
további küldés nem indul (`escalationFollowupsDue` + személy-szintű suppression), az ajánlat
árva sorként lejár. ⛔ A §C.1 „egy-kattintásos" megfogalmazása a MOBIL úton így nem teljesül
betű szerint — ezt a tulajdonosi döntés írja felül, a 03-INVARIANTS §C ezt rögzíti is.

**A LEIRATKOZOTT LÁTOGATÓ — TULAJDONOSI DÖNTÉS, 2026-09-08.**
Kérdés: „ha valaki leiratkozik, de tudatosan megnyitja megint a linket, akkor nem tud
vásárolni?" A mérés: **nem tudott.** A `/p/<token>` a `unsubscribedPage()`-et adta — se mock,
se konfigurátor, se megrendelés —, miközben ugyanez a lap arra biztatott, hogy „írjon nekünk
bátran". Ráadásul következetlenül: a `POST /p/<token>/request` sosem vizsgálta a leiratkozást.

**Döntés: a leiratkozott látogató MEGNÉZHETI a tervet és MEG IS RENDELHETI — de nem mérünk és
nem nyomunk.** A leiratkozás azt jelenti, hogy MI nem keressük többé (push), nem azt, hogy ŐT
kizárjuk abból, amit maga akar megnézni (pull). Amit a `tracked` flag kikapcsol:
`recordView`, az esemény-beacon (a `track` opció el sem megy a konfigurátornak), az
eszkalációs ajánlat MINTÁZÁSA és BÁRMILYEN ajánlat-kártya megjelenítése. Ami marad: a mock,
a konfigurátor és a megrendelés.

> **MÓDOSÍTVA — tulajdonosi döntés, 2026-09-25: az ÁR nem kártya.** Mérve: a leiratkozott
> ágon a lap LISTAÁRAT mutatott (6 840 Ft), miközben a `handleOrderRequest` a prospect élő
> ajánlatával KEDVEZMÉNYESEN terhelt (5 130 Ft) — a lap és a terhelés eltért. A hideg levél
> a kedvezményt ÍRÁSBAN ígérte, ezért a leiratkozás nem vonja vissza. Mostantól:
> - az ajánlatot a `/p/` MINDKÉT ágon feloldjuk (`bestActiveOfferForProspect`), ugyanazt,
>   amit a rendelés terhel → a lap ára = a terhelt ár (áthúzott listaár + fizetendő);
> - a leiratkozás a NYOMÁST kapcsolja ki: `offerQuiet` → a határidős döntés-segítő kártya
>   (felugró, visszaszámláló) NEM jelenik meg; új eszkalációs ajánlat továbbra sem keletkezik.
> Őrök: `optout-carrier-check.mts` (szerkezeti), `optout-offer-price-check.mts` (böngésző,
> 390px + asztali, követett ágon kontrollként a kártya MEGJELENIK).

**A lap nem hazudhat magáról (§B.17):** ezen az ágon NEM a követett lábazat megy ki — az azt
állítja, hogy „a megtekintés adatai rögzülnek", ami itt valótlan volna. Helyette
`injectOptedOutNotice` (kimondja: nem keressük többé, ezt a megtekintést nem rögzítjük, és ki
volt a küldő; leiratkozó linket NEM kínál újra) + `injectOptedOutBanner` a lap TETEJÉN, hogy
ne kelljen az aljáig görgetni a magyarázatért. Az `optout-carrier-check.mts` ⑤ szakasza mind
a kettőt méri, a route-ból pedig szerkezetileg megköveteli a négy kikapcsolt mechanizmust —
negatívan futtatva mindkét irányban bukik.

**A TÖRÖTT PÁR — TULAJDONOSI DÖNTÉS, 2026-09-08: „mindenképp az automatikus újra küldés kell".**
Állapot: `mms_sent_at` kitöltve, `sms_sent_at` üres → a címzettnél egy reklám-kép van link és
opt-out nélkül, mert ADR-0112 óta a kísérő SMS az egyetlen hordozó. Eddig ezt egy piros jelzés
mutatta a konzolon, és egy operátornak észre kellett vennie; a job-állapot ráadásul in-process
élt, tehát egy újraindítás elfelejtette.

**A megoldás három rétegű:**
1. **Megelőzés** (`pairWindowBlocks`): a pár EL SEM INDUL, ha kevesebb mint 60 perc van a
   küldési ablak (8:00–20:00) végéig. Az MMS-claim visszavonhatatlan, az éjszakai javítás pedig
   tiltott — egy 19:55-ös indítás tehát pontosan azt az állapotot garantálná, amit kerülünk.
   A tulaj engedélyezési-listás teszt-száma mentesül, mint az ablak alól általában.
2. **Automatikus javítás** (`src/outreach/pairRepair.ts` + `citoviso-pair-repair.timer`,
   percenként, a FŐ FÁBÓL — a modem ezen a gépen él, ADR-0080 ⑦). Backoff:
   2·5·15·30·60·120·240·480 perc (~24 óra ablak-időben). Az SMS-fele minden §C-kaput
   újrafuttat, beleértve a friss leiratkozás-ellenőrzést; az MMS-t SOHA nem küldi újra.
   ⛔ Az „ablak zárva" / „modem foglalt" válasz **nem használ el próbálkozást** — az időzítés,
   nem hiba; enélkül egyetlen éjszaka felélné az egész sorozatot, és a riasztás egy soha meg
   nem próbált párról szólna. Ha időközben megjön a leiratkozás, a pár LEZÁRUL küldés nélkül:
   a kiút, amit az SMS vitt volna, már megvan.
3. **Feladás + riasztás** (tulaj választása): a sorozat végén EGYSZER riaszt SMS-ben ÉS
   e-mailben (a konzol /settings címzettjei, az ADR-0098 AAM-riasztás mintája), utána nem
   próbálkozik tovább. Címzett hiányában hangosan naplóz és NEM pecsétel — a pár esedékes
   marad, a riasztás nem vész el.

**Éjszaka:** a tulaj a szigorú ablakot választotta (a másik opció a 22:00-ig nyúlás volt).
Este eltört pár tehát reggel 8-ig vár; ezt ellensúlyozza az ①-es megelőzés.

**Őr:** `scripts/pair-repair-check.mts` — eldobható fixture a valódi DB-ben, 21 állítás
(backoff, időzítés-vs-hiba, siker, feladás+riasztás egyszer, leiratkozás-lezárás, a teljes
párhoz nem nyúl, megelőzés). Az effektek injektáltak, mert a give-up ág különben valódi SMS-t
és levelet küldene a tulajnak minden futásnál. Negatívan futtatva bukik (az időzítés-felismerést
kivéve 2, a leiratkozás-ágat kivéve 3 állítás pirosodik).

**Nyitott pontok (nem ebben a körben):**
- **STOP-válasz továbbra sincs kezelve.** Aki SMS-ben „STOP"-ot ír vissza, azt ma senki nem
  dolgozza fel (a leiratkozás a linken megy). Ez ADR-0083 óta nyitott, a mostani kör nem
  érinti.
- **A lábazat magyarul beégetett.** Amíg a `lang !== "hu"` országkapu zár, ez rejtve marad; a
  piac-nyitáskor (ADR-0111) a kötelezők egyetlen hordozója magyarul jelenne meg. Az országnyitás
  jogi csomagjának ezt tartalmaznia kell.
