# Citoviso — BACKLOG / parkolt ötletek

> Később kidolgozandó ötletek, amelyek nem az aktuális fázis tárgyai, de nem szabad elveszniük.
> Ha egy ötlet aktuálissá válik, told a megfelelő ROADMAP-fázisba.

## Termék / UX

### ⭐⭐ Interaktív mock-konfigurátor + élő próbatér (fizetés ELŐTT) — ELŐLÉPTETVE: a KONVERZIÓ SZÍVE (ADR-0015)
Dátum: 2026-07-05 · Forrás: tulaj (ötlet) · **2026-07-13: NEM parkolt ötlet többé — ADR-0015 kimondta: modult csak
LÁTHATÓAN adunk el, ez a konverziós gerinc. A provisioning-gerinc (tenant/site/entitlement + convertLead, ADR-0014)
kész; ez a HIÁNYZÓ vizuális sales-felület. Adat nélküli modul az előnézetben minta-állapottal, jelölve (§B.17 fázis-határ).**
- A **mock megnyitása interaktív önkiszolgáló folyamatot indít**, nem statikus előnézet: a leendő vevő
  **összeállítja magának a csomagot** (modulok), **cserél képet, hangol kinézetet**, és **élőben teszteli**
  az általa összerakott honlapot — mindezt **élesítés/fizetés ELŐTT**, és **bármikor visszatérhet** hozzá.
- **UX-ív (fontos):** (1) *puff-varázslat* = a kész, lenyűgöző mock, nulla erőfeszítés (a horog) →
  (2) *elmélyülés* = a motivált lead testre szab + élőben tesztel (elköteleződés) → (3) fizetés → élesítés.
  Feloldja a látszólagos feszültséget a „nulla vacakolás" elvvel: előbb a csoda fog meg, utána szöszöl vele.
- Kapcsolódik: élesítés = 1. fizetős kapu (alapmodell); minimum→szofisztikált modul-lépcső (1d);
  a 3 becsatlakozási pont fokozatos bekapcsolása (Fázis 2). Kidolgozás: várhatóan Fázis 4 (MVP).
- **⚠️ 2026-07-16 — TULAJ-LELET: a próbafelület LÁTVÁNYA kevés (a mechanika kész, ADR-0015 1. szelet él).**
  A jelenlegi UX = jobb-lent lebegő „Csomag összeállítása" ikon → oldalsó panel + alul jelölt MINTA-sáv.
  Funkcionálisan jó, DE a FRAMING rossz a horoghoz: egy lebegő beállító-ikon **eszköz/„cookie-beállítás"
  affordanciát** sugall, nem **csodát**. Az célszegmens (**„2026-ban nincs honlapja"** = digitálisan gyenge,
  gyakran nem tech-affin) nem egy checkboxtól hatódik meg, hanem a **LÁTVÁNYTÓL** — és a wow-nak az UX-ív
  **1. lépésében (puff-varázslat), MINDEN erőfeszítés ELŐTT** kell ütnie; a konfig csak a 2. lépés (elmélyülés).
  **A próbafelületnek drámaian látványosabbnak kell lennie.**
- **✅ DÖNTÖTT IRÁNY (2026-07-16, tulaj) — „ALL-IN → onnan lefelé" (anchoring-flow), 2 ütem:**
  1. **1. ütés = a TELJES oldal, „Íme az új oldala.”** Minden releváns modul feltöltve, NULLA chrome/ikon —
     tiszta puff-varázslat, ami egyben **megmutatja a plafont** (milyen gazdag lehet). Ez a horog.
  2. **2. lépés = „állítsa össze a sajátját”** → innen lép a konfigurátorba (a kész toggle-mechanika ezt
     szolgálja ki). A „basic olcsó" csomag itt **veszteségként** hat (aki látta a teljeset, annak fáj
     lekapcsolni) → ez hajtja az upsellt. **Előbb a vágy, aztán az ár** — nem alulról építkezés.
  - **⚠️ Fő dizájn-feszültség (§B.17):** ha az 1. ütés mintákkal is teljes, azt JELÖLNI kell („a te valódi
    adataiddal töltjük fel"), de úgy, hogy **ne ölje meg a wow-t** (finom, egységes keret, nem MINTA-szalag-tenger).
  - **Nyitott scope-részlet:** a 2. lépés teljesből TRIMMEL lefelé (anchoring-erősebb, tulaj+asszisztens tippje)
    vagy basicből ÉPÍT fölfelé — eldöntendő a scope-nál.
  - **Elv-horgony:** puff-varázslat ELŐBB, vacakolás UTÁNA; a „nincs semmije" lead a legértékesebb szegmens →
    a látvány a fő MOAT. **Következő:** ennek az ívnek a scope-olása (mi a „teljes" default, hol a belépő-CTA,
    hogyan finom a §B.17-jelölés) — a mostani lebegő-ikonos 1. szelet (ADR-0015 impl) ennek a 2. lépése lesz.

### Domain-választás a vásárlásnál — saját domain vs. citoviso-domain (2026-07-20, tulaj)
A vásárlás/élesítés lépésénél a **tenant válasszon**: a Site a **saját domainjén** (`panziosissi.hu`) VAGY egy
**citoviso-adta domainen** (aldomain, pl. `sissi.citoviso.hu`, vagy citoviso-birtokolt domain) menjen élőre.
- **Saját domain:** DNS-beállítás (a tulaj A/CNAME-et állít ránk, vagy mi kezeljük a delegálást) + TLS-cert +
  tulajdon-igazolás. Több súrlódás, DE a tulaj brandje + a meglévő SEO-tőke megmarad. Nem-tech tulajnál a DNS a fő
  akadály → kézi/asszisztált beállítás (A2), később automatizálható (DNS-API, ACME).
- **Citoviso-domain (default a célszegmensnek):** **azonnali, nulla súrlódás** — mi kezeljük DNS-t/TLS-t. A
  „2026-ban nincs honlapja/domainje" tulaj gyakran nem is birtokol domaint → ez a természetes alapértelmezés.
- **⭐ Upsell/retenció-horog:** ha nincs saját domainje, **regisztrálunk neki egyet** (pl. `panziosissi.hu`) →
  extra bevétel + erős retenció (a domain nálunk = kötődés). A „saját domain" akár magasabb csomag/tier is lehet.
- **Kapcsolódás:** Site-állapotgép `live` élesítés (ADR-0014); [[project_visibility_engine]] (a domain = SEO/GBP
  horgony, aldomain-izoláció kérdése); árazás. **Adatmodell (később):** a `site` kap `domain` + `domain_type`
  (`own` | `citoviso_sub` | `citoviso_registered`) + verifikáció-állapot mezőt → DOMAIN-ba emelni + migráció,
  amikor épül. Ma parkolt requirement, a `live` élesítés még kézi ház-oldali lépés (A2).
- **Domain-javaslat + valós idejű foglaltság-csekk (2026-07-20, tulaj):** a checkout ajánljon fel alapból
  **4 szabad, jól hangzó** domaint az üzletnévből (név/+város/+„panzio"/„szallas"/rövidítés), a lead országának
  végződésével — **HU-first: .hu elsődleges (+`.com`/`.eu` fallback)**, a `.sk/.fr` multi-ország a globális fázissal.
  - **Két réteg:** olcsó CSEKK (RDAP/WHOIS v. availability-API pl. Domainr) a javaslatokhoz; **registrar API**
    (Gandi/OVH/Porkbun/Namecheap, v. wholesale reseller Openprovider/CentralNic) a *hiteles csekkhez + regisztrációhoz*.
  - **⚠️ ccTLD-szabályok:** .hu = ISZT-akkreditált registrar + nexus; .fr = EU-nexus; .sk nyitott → nem uniform.
  - **MIKOR:** a **hiteles csekk + foglalás a CHECKOUT-nál, kötelezően** (real-time, illékony → csak ott garantált).
    Kurátori jóváhagyás előtt legfeljebb *pitch-horog* a mockban („foglalható: X.hu"), de checkoutkor MINDIG újracsekk.
    Hatékonyság (A1): olcsó RDAP a sok lead pre-javaslatához, drága registrar-csekk csak a konvertálóknál.
  - **Checkout:** (a) szabad javasolt variáns (mi regisztráljuk) VAGY (b) tenant saját domainje (csekk→reg, v. DNS-bekötés).
  - **Nyitott:** a registrar-API konkrét pick (.hu-akkreditáció) — a billing/hoszting-kutatás mellé vehető.
  - **Reális kockázat-korrekció (tulaj):** a „bármikor elkelhet" csak rövid/generikus/brandelhető nevekre igaz;
    a niche panzió-nevek (`piroskahaz-badacsony.hu`) kollízió-esélye ~0 → nyugodtan elő-ajánlható és odaígérhető,
    a checkout-csekk formaság. Fallback mégis kell (ritka ütközés + registrar-front-running rövid neveknél).
- **Email-modul — N egyedi postafiók a domainhez (2026-07-20, tulaj):** pl. **10 egyedi email az árban**,
  tenant-adminban állítható, **auto-provisionált** (nincs ember). **CSAK saját / általunk regisztrált domainnél**
  (citoviso-aldomainnél nem). Érték: upsell + **retenció-horog** (email lock-in — nehéz otthagyni). Kell hozzá
  **email-provider API-val:** Migadu / Mailcow (self-host) / Zoho / resell Google Workspace–M365 — a hoszting-döntés mellé.

### Kereskedelmi hurok — árazás + billing (2026-07-20, tulaj döntés-irány)
A tulaj: **„all-in, minden automata"** — a nem-tech tulaj nem utalgat, a kártyás/automata fizetés
**konverziós követelmény**, nem skálázási luxus (felülírja a manuális-először javaslatot).
- **Árazási modell:** **előfizetés (havi)**, **BÁZIS + modulcsomag-árak** (a megvett modulok külön díja) +
  **éves előre-fizetés kedvezmény**. A számokat NEM most rögzítjük → **konfigurálható ár-mező**.
- **⭐ Egybeesés:** ez PONT a konfigurátorra ül — a modul-kapcsolók árcímkét kapnak, az „ALL-IN → trim" ív
  **ár-horgony** lesz (teljes havidíj látszik → lefelé trimmel a megfizethetőig). A „Választott modulok"
  összegző mellé ár kerül (bázis + Σ modul, havi; évesnél kedvezmény).
- **⭐ SCOPE-SZŰKÍTÉS (2026-07-20, tulaj): a TESZT HU-first, nem globális.** Első tesztek **EV-ként, AAM
  (alanyi adómentes) + átalányadó, Magyarországon** — ismert jog/nyelv/piac. A globális MoR-fork (Paddle/
  Lemon Squeezy vs Stripe-global) **PARKOLVA a validációig** — csak „ha akkorát szól" jön a nemzetközi adózás;
  a KFT-vé alakulás gyors, nem előfeltétel. Ez a helyes reverzibilis mozdulat (ne dönts irreverzibiliset proof előtt).
- **Teszt-stack (HU, kicsi) — KUTATÁS-ALÁTÁMASZTVA (2026-07-20, ld. `RESEARCH-2026-07-billing-hosting.md`):**
  (1) **Gateway = Barion (ajánlott):** nincs belépő/havi díj, natív token-recurring/MIT, first-party Számlázz.hu-integráció.
  ⚠️ a **bázis+modul (változó) + éves-vs-havi eltérő összeg → MerchantInitiatedPayment (MIT)** kell, amit a Barion külön
  jóváhagy (előre kérni, pilot-csúszás-kockázat). SimplePay: tud, de véges egyszer-használatos tokenek (újraregisztráció-teher).
  Stripe: legjobb DX, de HU-EV jogosultság/HUF-payout/Számlázz.hu-párosítás ELLENŐRIZETLEN.
  (2) **Számlázz.hu Számla Agent (megerősítve):** API (POST XML/JSON), AAM-számlát tud, **NAV-adatszolgáltatás automatikus**,
  használat-alapú díj. A backend hívja a Barion-webhookra (nem maga a webhook-vevő). Hurok: Barion IPN → backend → Számla Agent.
  - 🚪 **NEHEZEN visszafordítható = a gateway + kártya-tokenek** (nem migrálnak → váltásnál minden előfizetőtől új mandátum).
    🔄 Könnyen cserélhető: hoszting + számlázó-bekötés.
- **Pilot fizetési stratégia (tulaj, 2026-07-20) — MIT-független indulás:** ha a Barion MIT-jóváhagyás lassú/akadós,
  a pilot NEM várja meg: havonta **fizetési-kérés** megy a tenantnak több csatornán (email/SMS) → **Barion pay-link**
  (egyszeri fizetés, nincs MIT/tárolt kártya) → **nem fizet → deaktiválás**. Az **auto-MIT (tárolt kártyás auto-terhelés)
  = 2. fázis**, amint a Barion jóváhagyja. **Gateway-migráció terv:** új gateway → új tenant az új folyamaton; régi
  tenantok amint lehet átállítva (a hard-reverse token-problémát migrációval kezeljük, nem paralízissel).
- **AAM következmény (KUTATÁS-KORRIGÁLT):** a számla ÁFA-mentes („AAM"/„mentes az adó alól" záradék, Áfa tv. §169 m);
  az ár most bruttó=nettó. **`vat_rate` PER SZÁMLA** (most 0), NEM tenant-flag → a küszöb-átlépés/KFT **újrafestés nélkül**
  (már a határszámlát is áfásan kell, §188). **AAM-küszöb 2026 = 20M Ft** (nem 18M — az 2025 volt; 22M/2027, 24M/2028).
- **⚠️ Hoszting/deploy-cél KIKÉNYSZERÍTVE:** kártyás fizetés = webhookok = nyilvános app + élesített oldalak
  hosztolása. A „TBD éles infra" innentől nem halasztható — a gateway-jel együtt eldöntendő.
  - **KEMÉNY hoszting-kritérium (tulaj, 2026-07-20):** a tenant saját domainje **ember NÉLKÜL, automatikusan
    aktiválható** legyen → programozott custom-domain-csatolás + **auto-TLS**. Ez a „Cloudflare for SaaS /
    Custom Hostnames" v. Caddy on-demand-TLS kategória. A hoszting-kutatás EZT mint kötelező kritériumot mérje.
- **Következő:** kis, HU-scope-os kutatás (gateway: Barion vs SimplePay vs Stripe recurring + EV/AAM + díjak +
  Számlázz.hu-összekötés) + hoszting-cél → grounded ajánlás + scope-olt 1. szelet (árazás+rendelés a
  konfigurátorban). Hurok-sorrend: árazás → rendelés → fizetés → élesítés → tenant-admin → (később) globális billing.

## ⚠️ Kritikus elvek / minőség

### ⭐ Entitás-párosítás & provenance = bizalom-kritikus (2026-07-06 lelet)
- **Lelet:** a per-lead Places-lookup soft `locationBias`-szal egy AZONOS NEVŰ helyet párosított máshonnan
  (badacsonytomaji „Piroska Ház" → mindszentkállai „Piroska´s houses", ~15 km). A vízió-copy egy IDEGEN házat írt le
  (kitalált wellness). Tömeg-léptéken a névazonosság gyakori → félrevezető, jogilag veszélyes.
- **Fix (kész, `dae1762`):** kemény `locationRestriction` + távolság-ellenőrzés (≤250 m) + név-egyezés; bizonytalanság → NULL.
- ⭐ **INVARIÁNS:** SOHA ne tulajdoníts fotót/jellemzőt egy szállásnak ellenőrzött párosítás nélkül. **Jobb NINCS fotó
  (Street View / nincs galéria + őszinte régió-copy), mint a ROSSZ ház fotója.** A vízió-copy felnagyítja az adathibát → a
  párosítás/provenance rock-solid kell legyen, minden enrichment-forrásnál (fotó, kontakt, website).
- **Biztonsági háló:** ez pontosan a Fázis 1b **mock-kuráció (A2)** nulladik-pont-gate indoka — a kiküldés előtti (kezdetben
  emberi) ellenőrzés fogja el a maradék mismatch-et. A vízió-mismatch a „nulladik ponton bukás" iskolapéldája.

### ⭐⭐ A4 — A mock-alap TÖBB-RÉTEGŰ ellenőrzése (defense in depth) — kidolgozandó rendszer
A tulaj külön aláhúzta: EXTRÉM kritikus, miről készül a mock. Nem egy check, hanem rétegek — mindegyik konfidenciát ad:
1. **Provenance kötelező** — minden adat (fotó/kontakt/szöveg) hordozza: forrás + párosított entitás + konfidencia. Nélküle nem használjuk.
2. **Több-jeles entitás-párosítás** — geo (kemény terület-restrikció + távolság) + név + cím + kategória; legalább 2 jel egyezzen. (1. réteg kész: `dae1762`.)
3. **Kereszt-forrás korroboráció** — több független forrás egyezése (OSM + Places + portál); fotót/tényt csak korroborált entitásról.
4. **AI/vízió mint ELLENŐR (nem csak generátor)** — fotó előtt: „illik-e a kép [X] nevű, [régió]-beli [típus]-hoz?"; copy után: adversariális hallucinació/mismatch-ellenőr (automatizált kurátor-elővizsgálat).
5. **Konfidencia-kapuzott fallback** — bármely kritikus dimenzió alacsony → kevesebbet mutatunk (fotó/állítás elhagyás), SOSEM rosszat. „Bizonytalanság → kevesebb, sosem hamis."
6. **Mock-kuráció (A2) gate** — kiküldés-előtti nulladik-pont (kezdetben ember → később automata a betanult konfidencia-modellel).
7. **Tulaj-megerősítés a konverziónál** — végső ellenőrzés élesítéskor + szerzői jogi nyilatkozat. DE ez a kiküldés UTÁN → az 1–6 rétegnek előtte szilárdnak kell lennie.
→ Ez a **provenance/verifikáció** kereszt-metsző rendszer: a scraper és generátor mellett harmadik, bizalom-kritikus komponens. Kidolgozás: Fázis 3/4-ben, folyamatosan.

**A4 megvalósítás — per-item provenance + konfidencia-pontozás (a kurátor substrate-je):**
- **Jelenleg:** csak durva, lead-szintű `sources` (mely adapterek találták). Per-item provenance NINCS még — kiépítendő.
- **Per-item provenance** minden enrichelt tételen (fotó, telefon, website, vélemény, copy-állítás):
  `{ érték, forrás, párosított-entitás {név, placeId, távolság-m, név-hasonlóság}, konfidencia 0..1, időbélyeg }`.
- **Lead-szintű match-konfidencia** — aggregált A4-jelek: geo-távolság + név-hasonlóság + kereszt-forrás korroboráció
  (hány független forrás egyezik) + rating/vélemény-szám konzisztencia + kategória-egyezés → kompozit 0..1.
- **Kapuzás (konfidencia → akció):** magas → auto-pass · közepes → kurátor-review (kezdetben ember) ·
  alacsony/ellentmondó jelek → **⛔ FOLYAMAT-STOP** (nem generálunk/küldünk, flag). A vélemény EGY súlyozott jel, nem életbiztosítás.
- Ez adja a mock-kuráció (A2) gate és a „nagy gyanú → megállítás" substrate-jét.
- **⚠️ Őr-lelet (2026-07-12):** az őr-agentek éles próbáján (tényhűség-őr) kiderült, hogy a lead-artifactekből
  (pl. `leads-godollo.json`) MA HIÁNYZIK a `matchConfidence` mező — a scraper ezen verziója nem adja ki. Emiatt a
  §F.17b konfidencia-kapu (low-sáv → fotó-/jellemző-tulajdonítás gyanú) ma csak közvetett korroborációval zárható
  (websiteStatus, saját-domain e-mail), nem determinisztikusan. Teendő: a `matchConfidence` (a `confidence.ts`
  kimenete) visszavezetése a lead-artifactbe, hogy a §F.17b kapu gépiesen zárható legyen. Kapcsolódó rés:
  a match-konfidencia ma tisztán mechanikus (név+táv+OSM), kontextuális/vélemény-korroboráció nélkül.

## Stratégia / termék-vektorok

### ⭐ A scraper mint ÖNÁLLÓ termék (iparág-független lead-intelligence)
Dátum: 2026-07-06 · Forrás: tulaj (stratégiai meglátás)
- A lead-discovery motor iparág-agnosztikus → **bármely iparág piaci szereplőit** fel tudja térképezni egy régióban.
  Ez **önmagában eladható termék** (piaci-felderítés / lead-intelligence / B2B partnerkeresés), a Citoviso-tól függetlenül.
- **Use-case (valós):** a tulaj logisztikai cége — adott régióban potenciális partnerek (betongyárak, előregyártók,
  térkőgyárak, aszfaltkeverő üzemek stb.) automatikus felderítése.
- **Következmény a fejlesztésre:** a scrapert eleve **újrahasználható, önálló komponensként** építsük (nem a
  Citoviso-generátorba drótozva) — tiszta be/kimenet, iparág/régió/forrás paraméterezve. ⭐ Az építést ezzel kezdjük.
- Kapcsolódik: a scraper is Iparág × Ország paraméterezett (Fázis 4c-i); két kulcs-motor.

### ⭐ Vélemények mint háromszoros forrás (enrichment mag + A4 verifikáció)
Dátum: 2026-07-06 · Forrás: tulaj
- **(1) Info-kinyerés** — a vendégvélemények felszereltséget/szolgáltatást/hangulatot írnak le, amit a fotó nem mutat.
- **(2) ⭐ Az EGYEDI „mag"** — a vélemények a valós megkülönböztető pontokat emelik ki VENDÉGSZAVAKKAL (házigazda, pince,
  kilátás) → az AI-copy a visszatérő, valós pozitívumokra horgonyozhat. Őszinte (vendég-tanúság), és jobb, mint a vízió:
  az élményt/szolgáltatást a fotó nem tudja.
- **(3) ⭐⭐ A4 KONTROLLPONT (kereszt-forrás korroboráció)** — a rating + vélemény-SZÁM + a vélemények TARTALMA igazolja,
  hogy a JÓ LEADET (a helyes entitást) kezeljük. Piroska-eset bizonyítja: valódi 1,0★/27 vs. téves párosítás 4,6★/5 → a
  rating/szám-eltérés azonnal flag-elte volna a mismatch-et. → Vedd be az A4 2–4. rétegébe (rating-konzisztencia + vélemény-tartalom egyezés).
- **⚠️ Jogi:** belső elemzésre/verifikációra szabadon; MEGJELENÍTÉSRE csak valós, szó szerinti vélemény + provenance,
  KURÁLVA (alacsony értékelésű hely negatív véleményét nem tesszük ki) — §B.7 invariáns.
- **Forrás:** Google Places (`reviews`, `rating`, `userRatingCount` a field maskban), portálok, Tripadvisor. A verified
  párosításból (A4/1. réteg) — mismatch esetén nincs vélemény sem.
- **⭐ HIBRID VÉLEMÉNY-MODELL (2026-07-11 · tulaj):** két forrás, egy modul.
  - **(A) KÜLSŐ, scrape-elt** — Google Places / portál / Tripadvisor (fent). Jogilag kényes (verbatim + provenance + kuráció),
    a mock-fázisban a hidegindításhoz kell (van már közösségi bizonyíték a helyről).
  - **(B) FIRST-PARTY, az OLDALON HAGYOTT vélemény** — a generált/élesített site-on a vendég közvetlenül nálunk hagy véleményt.
    Jogtiszta (saját platform, tulaj-moderáció/kuráció), friss, nincs scrape-függés/hotlink-törékenység → **saját adat-vagyon**.
    Egyben **retention-horog + dinamikus modul** (mint a booking): konverzió után élő „review-gyűjtő" funkció, ami leállítható
    (nem a tartós láthatóság része) → upsell/megtartás. Kapcsolódik: felfedezhetőség-motor (GBP-review kérés), booking-modul mintája.
  - **A UI-modul (reviews-carousel, ADR-0011) MINDKETTŐT renderi** — a kártya forrás-jelölt (külső: „Google" + provenance;
    first-party: moderált). A render-réteg kész; az adat-réteg (B: űrlap+tárolás+moderáció, A: enrichment+jogi kapu) külön szelet.

### ⭐⭐ Enrichment / mock-minőség hiányos lead-adatnál — A LEGÉRTÉKESEBB SZEGMENS
Dátum: 2026-07-06 · Forrás: tulaj + AI-meglátás

**⭐ Stratégiai keretezés (miért ez a legfontosabb szegmens):** a „nincs semmije" lead technikailag a
legnehezebb (kevés anyag), de ÜZLETILEG a legértékesebb:
- a hozzáadott érték a kiinduló állapottal fordított → semmiből foglalható oldal = MAX delta (a láthatóság-ígéret itt szól legerősebben);
- a konverziós hajlandóság a fájdalommal korrelál → teljes láthatatlanság = max motiváció; nincs mihez ragaszkodnia (nincs régi oldal);
- verseny-mentes: a klasszikus webstúdiók nem célozzák (nincs is honlapjuk) — mi scraperrel pont őket találjuk meg;
- ⭐ MOAT: aki minimális adatból varázslatos, egyedi mockot tud csinálni, az nyeri ezt a szegmenst → a fő IP-nk.
→ Ezért ezt a lead-típust és a „megoldási képletét" ÁTFOGÓAN, STANDARDIZÁLTAN kell kezelni (nem ad-hoc). Két hiány-pótló mechanizmus:
- **(1) Stock fotó + placeholder + testreszabási javaslat.** Ha nincs elég saját kép/anyag, a generátor
  **stock fotót** tesz a helyére **placeholderként**, és az egyedi vásárlási folyamatban **javasolja a tulajnak**,
  milyen képet töltsön fel az adott helyre (amit a generátor automatikusan a helyén kezel). Kapcsolódik:
  interaktív mock-konfigurátor, élesítés = kép-csere.
- **(2) ⭐ Régiós kontextus-scraper (külön komponens).** Egy scraper, ami adott **település/régió nevezetességeit,
  programjait** gyűjti (Badacsony: Balaton-közelség, borrégió, borpincék, Balaton-körüli bicikliút…) → **közös
  régió-enrichment réteg**, ami minden lead mockjába **program-/élményajánlatként** kerül. Ez az **Iparág × Régió
  tengely turisztikai dimenziója**; a szállás „egyedi magja" részben a régiós beágyazottság. Mivel a régióról MINDIG
  van gazdag anyag, ez pótolja a lead-szintű hiányt.
- **Sorrend:** előbb a lead-szintű enrichment MÉRI, mennyi anyag jön össze; a mérés dönti el, milyen sürgős a
  régiós réteg (adat-vezérelten — A1/A2). Kidolgozás: Fázis 4/5 enrichment-szeletek.

### Contact/enrichment forrás-lánc a „nincs oldal" szegmenshez
Dátum: 2026-07-06 · Forrás: tulaj
- A no-site lead a legértékesebb, de a legszegényebb kontaktban/anyagban (mérve: email 1/8). Forrás-lánc,
  célzottól az általánosig — mindegyik adapter, a mag változatlan:
  1. **Beazonosított portál (célzott):** a lábnyom-profil tudja, hol van (szállás.hu/booking/airbnb) → onnan
     email/kép/leírás. ⚠️ anti-scraping + ToS + jogi őrszem (portál-fotó CSAK demóra).
  2. **Internetes keresés (catch-all) — PARKOLVA (2026-07-06 lelet):** ⚠️ a Google „entire web" Custom Search
     KIVEZETVE (új CSE-nél tiltva 2026-03 óta, teljes EOL 2027-01); az egész piac fizetőssé vált (Brave: nincs
     ingyenes tier 2026-02 óta, ~$5/1000; Bing kivezetve). → NINCS ingyenes web-search API. Valódi per-query költség
     → csak szelektíven, magas-értékű leadekre (lead-priorizálás). Az adapter KÉSZ (`webSearch.ts` + `enrichWebSearch.ts`);
     csak a kliens cserélődik egy fizetős szolgáltatóra (Brave/Tavily/SerpAPI), a logika marad. Iparág-független.
  3. **Cégnyilvántartás (hivatalos):** email/cím.
- Kontakt-csatorna prioritás: email > sms(mobil) > voice > none (automatizált kattintható-link outreach).
  No-site reálisan SMS-first, ahol nincs email.

### Megvehető elemek: MODULOK vs. SERVICE-ek (rögzítés, taxonómia később)
Dátum: 2026-07-07 · Forrás: tulaj
- Két vödör, à la carte megvehető — most CSAK rögzítjük, a részletes taxonómia később:
  1. **MODULOK** = a Site-ba épített, entitlement-kapuzott **funkciók** (dinamikus szigetek a MI infránkon).
     Pl. **foglalás**, online fizetés, menü, galéria. ⭐ Ezek **leállíthatók** → a **retention-motor**
     (kilépés = a funkció megszűnik; pl. foglalás elvesztése = vissza az OTA-jutalékra).
  2. **SERVICE-ek** = általunk nyújtott, megvehető **szolgáltatások** (nem feltétlen Site-funkció).
     Pl. profi fotó, szövegírás, **láthatóság/GBP-kezelés**, hirdetési kampány. Egy részük egyszeri, más recurring.
- ⚠️ Kapcsolódó elv (2026-07-07 lelet): az **egyszeri láthatóvá tétel** (GBP-optimalizálás, citations, SEO) TARTÓS
  és az ügyfélé — nem vehető vissza. Ezért a recurring díjat a **leállítható funkció** (modul) + a **folyamatos
  service** indokolja, NEM a már odaadott, tartós eszköz. A honlap-hosting leállítható (domain az ügyfélé), a
  GBP/citations nem. Retention = folyamatos érték, ami megszűnik fizetés nélkül (+ a szegmens nem tartja fenn magától).

## Működés / skálázás

### Belső moduláris back-office (operátor-platform)
Dátum: 2026-07-05 · Forrás: tulaj (megjegyzés)
- A control plane maga is egy termék: **belső, operátor-facing moduláris platform** — pénzügy, sales, **CRM**,
  **bizonylat-management**, egyéb belső modulok. Ugyanaz a „modulárisan bővül, nincs egyedi fejlesztés" filozófia,
  mint a tenant-oldalon → **két moduláris platform** (külső Site-modulok + belső back-office).
- **Belső RBAC:** szerepkör-szintű jogosultság (kurátor / pénzügy / sales / support / admin külön). Ez akkor válik
  élessé, amikor ezeket a belső modulokat fejlesztjük (későbbi fázis; a Fázis 3/3d lefektette az alapot).

### Adat-vezérelt lead-priorizálás (az all-in indulás UTÁN)
Dátum: 2026-07-05 · Döntés: indulásnál ALL IN (minden leadnek mock), közben kategória/konverziós adatot gyűjtünk.
- Később: **lead-scoring** a begyűjtött adatból (mely kategóriák/jelek konvertálnak) → a drága mock-gyártást
  a legígéretesebb leadekre fókuszáljuk (költség-optimalizálás). A1/A2-konzisztens: előbb tanulunk, majd automatizált szűrés.

## Adat-eszköz / geo

### ⭐ Saját POI-adatbázis (koordináta-kulcsú, újrahasznosítható geo-eszköz)
Dátum: 2026-07-08 · Forrás: tulaj (ötlet)
- Építsünk **saját POI-adatbázist**: cím + minden elérhető attribútum, **koordináta alapján mentve/kulcsolva**,
  a **Street View**-val összevetve/párosítva. Ma a leaden külön van a `lat/lng` és a `address` mező, de nem
  kezeljük **első osztályú, újrahasznosítható geo-eszközként**.
- **Konkrét mechanika:** Google Maps-scrollozáskor/scrape-kor a **konkrét koordinátát mentsük le magunknak**
  (nem csak a címsort) → dedupolt, forrás-független POI-törzs.
- **Miért:** „egymillió későbbi felhasználási lehetőség" — iparág-agnosztikus alap (lead-discovery,
  jelenlét-verifikáció §F, régiós kontextus-scraper, vizuális enrichment, aggregátor-portál, jövőbeli
  térkép/kereső-termékek). Tartós, halmozódó adat-vagyon, közel nulla marginális költséggel.
- Kapcsolódik: presence-detektálás geo-invariánsok (`DOMAIN/03-INVARIANTS.md §F`), enrichMaterial (Street View),
  A4 provenance. Kidolgozás: külön adat-réteg (POI entitás) + a scraper-források rákötése.

## Console / lead-pipeline

### Lead-státuszok + szűrők a konzolon (folyamati mélység — kalibrálandó)
Dátum: 2026-07-08 · Forrás: tulaj (kérdés: „mennyire menjek bele folyamatilag?")
- A konzolon **szűrők** (kvalifikáció, régió, mock-státusz, később szegmens) + explicit **lead-életciklus státuszok**
  (pl. `új → mock kész → jóváhagyva → kiküldve → megnyitva → order-intent → konvertált / elvetett`).
- ⚠️ **Folyamati mélység — javaslat:** a pilothoz **minimál** státusz-halmaz elég (a fenti tölcsér-állomások),
  a teljes CRM-pipeline-t (PROCESS.md) NE most építsük ki — evolúciósan, amikor a mérés megköveteli.
- **Ismert hiány:** az **ország** dimenzió hiányzik — a scraper ma `COUNTRY="HU"`-t drótoz be
  (`src/scraper/persist.ts`); az Iparág × Ország modellhez a `Region` kapjon `country` mezőt és fűződjön végig.

### ⭐ Mockok vizuális változatossága — NE egy kaptafa (dizájn-rendelet)
Dátum: 2026-07-08 · Forrás: tulaj (nyomaték)
- A generált mockok **kinézetileg NE egy sablonra** készüljenek. Nem csak a tartalmi „mag" egyedi (az már
  rögzített), hanem a **vizuális arculat is** variálódjon szállásonként: paletta + akcentszín + betűpár **ÉS**
  elrendezés/struktúra/szekció-ritmus.
- ⚠️ **Jelenlegi állapot:** `src/generator/render.ts` = EGYETLEN fix template (épp a kerülendő kaptafa).
- **Megoldás-irány:** (1) több layout-variáns / komponálható szekció-készlet, (2) **vízió-vezérelt
  arculat-preset** a fotókból (CLAUDE.md §7 Analyze — paletta/stílus-kinyerés), (3) saját SVG-ikonkészlet
  (nincs emoji), (4) a szállás egyedi „mag"-szekciója. Kapcsolódik: `memory/feedback_design_no_emoji_unique_core`.

### Supervisory admin-felület szegmensek fölött (konfigurálható folyamat-változók)
Dátum: 2026-07-09 · Forrás: tulaj
- Admin-szintű felület **szegmensek fölött**, ahol folyamat-változók állíthatók (pl. utánkövetés-kadencia N,
  score-küszöbök az auto/manuál mockhoz, időzítések). **Több változó** is bekerülhet — ne bedrótozás, hanem konfiguráció.
- Kapcsolódik: 1→2 score-küszöb (éles auto/manuál), outreach-kadencia (PROCESS.md átmenet-szabályok).

### Kötelező kérdőív leiratkozásnál / nemleges válasznál (tanulás)
Dátum: 2026-07-09 · Forrás: tulaj (ötlet)
- Leiratkozáskor + nemleges válasznál **kötelező rövid kérdőív** → strukturált „miért nem" adat (churn/elutasítás-okok),
  a szegmens-tézis és az outreach finomításához. Jogi: a kérdőív ne akadályozza a leiratkozás jogát (opt-out elsőbbség).
