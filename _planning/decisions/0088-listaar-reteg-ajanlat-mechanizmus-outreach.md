## ADR-0088 — Listaár-réteg + ajánlat-mechanizmus (outreach-kedvezmény, eszkalációs trigger, kupon)

**Dátum:** 2026-08-31 · **Státusz:** ELFOGADVA (tulajdonosi döntés-sor ebben a sessionben;
implementáció külön körben, a felületi része §2b terv-kapun át) ·
**Kapcsolódó:** ADR-0033 (árazás-igazságforrás, régió), ADR-0080 (előfizetés-motor),
ADR-0082 (csatorna-kapuk), §B.17 (tényhűség), §C.23 (Fttv./bait-and-switch tilalom),
0003-migráció (prospect/mock_view/mock_event viselkedés-gerinc).

**Kiváltó (tulaj-ötlet):** kell egy új réteg az árazásba — LISTAÁR —, amihez képest az
outreach-kedvezmény áthúzott árként mutatható; a mock-látogatási viselkedésre eszkalációs
ajánlat építhető; és az új előfizető kupont kap a következő vásárlására. „Ezzel több
marketing kampányt is lehetne csinálni."

**A döntések:**
1. **Listaár = a mai `pricing_config` árak.** A listaár VALÓDI, fizethető ár: aki a publikus
   honlapon direktben kér szolgáltatást (maga adja meg az adatait), listaáron vásárol. Ettől
   lesz az áthúzott −X% becsületes (§B.17 az árazásra): a horgony nem fiktív, hanem két
   értékesítési út valós különbsége. ⛔ Fiktív „akciós" ár (amit soha senki nem fizet) tilos.
2. **Ajánlat-entitás, nem beégetett százalék.** Minden kedvezmény egy prospect-hez kötött
   AJÁNLAT: százalék + lejárat (nap VAGY dátum) + felhasználhatóság-szám + hatókör. Az
   outreach −25%, az eszkalációs −50%, a szezonális/szegmens-kampány mind UGYANANNAK az egy
   mechanizmusnak a paraméterezése — ez adja a „több kampány" képességet.
3. **Első mock-outreach: listaár −25%** (paraméter, nem konstans), a mockon/ajánlatban
   áthúzott listaárral mutatva, a template saját formanyelvében — ⛔ nincs bazári
   „AKCIÓ!"-villogás (referencia-minőség pozicionálás).
4. **Eszkalációs trigger: 3. látogatás vásárlás nélkül** (a meglévő mock_view-ból számolva —
   lekérdezés, nem új instrumentáció). Lefutása SZEKVENCIÁLIS: (a) az oldalon jelenik meg a
   mélyebb ajánlat („szeretnénk segíteni a döntésben" keretezés, −50% paraméter); (b) ha ezután
   sem vásárol 24–48 órán belül, ugyanaz az ajánlat e-mailben megy ki — a meglévő
   leiratkozás- és csatorna-kapukon (ADR-0082) át. Az ajánlat EGYSZERI és HATÁRIDŐS (pl. 72
   óra, kimondva) — nem védekezésből (a leadek nem beszélnek össze, tulaj-pontosítás), hanem
   mert lejárat nélkül az ajánlat csak egy újabb halasztható dolog: a határidő visz döntésre.
5. **Hatókör: az ADOTT TRANZAKCIÓ** (tulaj: „adott tranzakcióra vonatkozzon"). Havi vásárlásnál
   az az egy hónap, éves vásárlásnál a teljes éves díj kedvezményes; a MEGÚJULÁS listaáron
   megy, és ezt az ajánlat szövege kimondja (a néma megújulás-áremelkedés churn + megtévesztés).
6. **Kupon:** új előfizető 25% kupont kap a KÖVETKEZŐ vásárlására (pl. modul). Paraméterei
   ugyanazok, mint bármely ajánlaté (lejárat, felhasználhatóság-szám). ⛔ Kedvezmény SOHA nem
   halmozódik: mindig az egyetlen LEGNAGYOBB kedvezmény él (tulaj-rendelet).
7. **A konverzió hordozza az ajánlatát:** az order_intent/konverzió-rekordba be kell kerülnie,
   MELYIK ajánlattal zárt — e nélkül a kampányok hatása mérhetetlen. (A 0003-kori komment
   „full-price order capture"-t mond; az ajánlat-réteg ezt bővíti.)
8. **Kapcsolódó feladat (tulaj-kérés, ADR-0080 terület):** a moduloknál lehessen a kiválasztott
   csomagot ÉVES előfizetésre átváltani.

**Elvetve:** (a) trigger-e-mail és oldali sáv EGYSZERRE — duplán ütné ugyanazt az embert;
(b) örökre szóló kedvezmény — a volumen-modellt enné; (c) a „leadek összebeszélnek" félelemre
méretezett titkolózás — életszerűtlen (konkuráló szállásadók), a határidő indoka a döntés-zárás.

**Visszafordíthatóság:** 🔄 az ajánlat-réteg additív (a listaár-út a mai út); paraméterek
(százalékok, határidők, trigger-küszöb) szabadon hangolhatók; a mechanizmus kikapcsolása =
nincs aktív ajánlat, minden listaáron megy.

> **ADR-0088 kiegészítés (2026-08-31, tulajdonosi jóváhagyás):** a felület-terv a **„B:
> ár-kártya + visszaszámláló"** variáns (kontraktus: `assets/design-refs/console/offer-ui/`),
> két pontosítással: ① az **érvényesség MINDIG kimondva** — az ajánlat az ADOTT (egyszeri)
> tranzakcióra, az ELSŐ díjra szól, a hosszabbítás listaáron; határidős ajánlatnál a lejárat
> dátummal kiírva; ② az outreach-jogosultság a `prospect.sent_at` pecsétből SZÁRMAZTATOTT
> (nem küldőnként bekötött) — a self-serve/direkt út szerkezetileg listaáras marad.
> Megvalósítva: offer-backend (0045 migráció, `src/payment/offers.ts`, checkout/megújulás/
> multilang bekötés, önteszt), konfigurátor ár-kártya + eszkalációs döntés-kártya
> (élő szerveren 12/12 ellenőrzés), levél ár-mondat + follow-up küldő a napi billing-ticken.

> **ADR-0088 §8 kiegészítés (2026-09-01, tulajdonosi jóváhagyás: „B"):** a havi→éves váltás
> felülete a **„B: megtakarítás-doboz"** variáns (kontraktus:
> `assets/design-refs/console/period-switch/`), a tulaj „WTF"-je nyomán rögzített
> **véglegesség-szabállyal**: a „Mégsem" CSAK az élesítés és az első éves számla kifizetése
> közti ablakban él; **az éves számla kifizetése után a váltás végleges** (nincs visszatérítés,
> lemondásnál a kifizetett év végigfut — ADR-0080 lemondás-szabálya). Mechanika: a váltás a
> KÖVETKEZŐ fordulónaptól él (`pending_period`, 0046), a kifizetett időszakhoz nem nyúlunk,
> arányosítás nincs; a korábban (régi áron) kiállított következő számla nem nyeli el a
> váltást — az az azutáni fordulótól él, és a kártya ezt a dátumot mondja. A kártya
> modul-deltái élesített/éves állapotban a számla saját periódusában beszélnek (havi ár ×
> fizetett hónapok — §B.17). KB: admin-subscription „Hogyan válthatok éves fizetésre?".

> **ADR-0088 ⑨ (2026-09-01) — ISMÉTLŐDŐ KÁRTYÁS MEGBÍZÁS: kimondva, láthatóvá és
> visszavonhatóvá téve.** Kiváltó (tulaj-kérdés): „lehet-e Barionon folyamatos fizetési
> megbízást adni… ha megadja a kártyaadatokat, folyamatosan vonja az egyenleget". A mérés
> eredménye: **a gépezet ADR-0080 ④ óta MEGVAN és él** (checkout `InitiateRecurrence` +
> 3DS-trace → `subscription.recurrence_token` → a napi tick MIT-terheléssel fizet, díjbekérő
> a fallback). ⛔ Amit viszont sehol nem tettünk meg: **a vevőnek soha nem mondtuk ki**, hogy
> a kártyáját ismétlődően terheljük, és **nem tudta se látni, se visszavonni** a megbízást —
> tárolt hitelesítő adat tájékoztatás és visszavonás nélkül (kártyatársasági szabály +
> tisztességes tájékoztatás sérelme). Ez ugyanaz a minta, mint a
> `feedback_additive_write_is_not_a_gate`: a funkció bekapcsol, de nincs, ami kikapcsolja.
> **Döntések:** ① az ÁSZF „2. Díjak és fizetés" pontja kimondja az ismétlődő terhelést
> (változó összeg, T−3 előértesítés, a kártyaadatot a szolgáltató tárolja, mi nem) és a
> **bármikori visszavonhatóságot** (jövőre nézve hatályos, a fizetési kötelezettséget nem
> szünteti meg → díjbekérős útra vált); ÁSZF-verzió **1.0 → 1.1** (ADR-0056: érdemi változás
> = verzió-emelés, a korábbi rendelés a régi szövegre kötelez). ② `revokeAutoCharge()` a
> tokent **TÖRLI**, nem csak letiltja (megtartott token = későbbi kód újra terhelhetne);
> új megbízás = új, 3DS-kihívott vevő-indított fizetés — a kártyaséma ehhez köti a tárolt
> hitelesítőt. ③ A tenant-admin látja a megbízás állapotát és a **kuponját** (eddig némán
> érvényesült: a `bestActiveCouponForTenant` beárazta, de a tulaj nem tudott róla). ④ Sandbox-
> igazoló hám: `scripts/recurring-mandate-check.mts` (`config` — környezet-készenlét;
> `status` — tárolt token+trace; `charge` — **egy tenantra szűkített** megújulás-mintázás +
> MIT-terhelés; a teljes `runBillingCycle` tiltott tesztből, mert a KÖZÖS dev-DB-n más
> szálak tenantjainak is számlát mintázna és dunning-levelet küldene).
> **Felület:** külön §2b terv-kör (megbízás-sor + kupon + checkout-tájékoztató).
