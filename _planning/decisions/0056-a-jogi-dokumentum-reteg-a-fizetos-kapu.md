## ADR-0056 — A jogi dokumentum-réteg: a fizetős kapu előfeltétele

- **Dátum:** 2026-08-22
- **Kiváltó (tulaj):** *„A honlapon milyen jogi dokumentumokat kell elhelyezni? Ez még nincs meg."*
- **Állapot:** ELFOGADVA — a citoviso.com (ELADÓI oldal) rétege. A generált TENANT-oldalak jogi
  minimuma külön szelet, lásd a „Nyitott" pontot.

### A helyzet, amiből indultunk

Egyetlen jogi dokumentum élt: az `/privacy` (`privacyPage`), és az is **kizárólag az outreachre**
szól (GDPR 14. cikk: nyilvános adatgyűjtés + megtekintés-mérés). A fizetős kapu gerince viszont MÁR
ÁLL és a dokumentumra vár: a `config.termsUrl` szándékosan üres, ezért a `requireTerms` hamis, és a
konfigurátor **meg sem jeleníti** az elfogadó sort (halott linkre mutató pipa rosszabb a semminél —
ADR-0055). Az elfogadás tárolása is kész (`order_intent.terms_accepted_at` / `terms_text`, 0029).
Vagyis nem infrastruktúra hiányzott, hanem **maga a szöveg**.

### Döntés — mi kerül ki a honlapra

| Dokumentum | Jogalap | Állapot |
|---|---|---|
| **Impresszum** | Eker.tv. (2001. évi CVIII.) 4. § | ÚJ — EV-nyilvántartási szám, adószám, székhely, elérhetőség |
| **ÁSZF** | Eker.tv. 5. §, Ptk. | ÚJ — ez oldja fel a `termsUrl`-kaput |
| **Adatkezelési tájékoztató** | GDPR 13. | BŐVÍTÉS: a meglévő outreach-fejezet mellé előfizetői + számlázási (Számv.tv. 8 év) fejezet |
| **Adatfeldolgozói szerződés (DPA)** | GDPR 28. | ÚJ, ÁSZF-melléklet |
| **Elállási tájékoztató + mintanyilatkozat** | 45/2014. (II. 26.) Korm. r. | ÚJ — lásd alább, ez volt a legjobban alábecsült tétel |

**⚠️ Az elállás NEM hagyható el „mert B2B vagyunk".** A `validateBuyer` kétféle vevőt ismer:
`business` és **`individual`** — az utóbbi fogyasztó. A kód a lemondó NYILATKOZATOT már kezeli
(`WITHDRAWAL_WAIVER_V1`, 45/2014. 29. § (1) a)), de a lemondás csak akkor érvényes, ha a fogyasztó
**előzetesen megkapta a tájékoztatást** az elállási jogáról. A nyilatkozat tájékoztató nélkül
önmagában nem áll meg — a dokumentum tehát a nyilatkozat érvényességi feltétele, nem dísz.

**Cookie-tájékoztató ma NEM kell**, mert nincs süti a mérésben (a `/p/` instrumentáció user-agentet
és eseményt rögzít, nem sütit); a session-cookie technikailag szükséges → nem consent-köteles.
⚠️ Ha analytics kerül be, ez a sor azonnal megnyílik. **Békéltető testület / ODR sem kell**: B2B-nél
nem kötelező, az EU ODR-platform pedig 2025. július 20-án megszűnt.

### Az ÁSZF üzleti gerince (tulajdonosi döntés — ezek nem levezethetők a kódból)

1. **Felmondás:** a már kifizetett időszak **végéig kiszolgáljuk**, pénz nem jár vissza.
   Szokásos SaaS-modell, B2B-ben bevett.
2. **Lejárat:** a lejárat előtt **15 nappal automatikus értesítés** megy, hogy hosszabbítás
   hiányában a lejárat után lekapcsoljuk az oldalt. ⚠️ Ez nem csak szöveg — **ütemezett feladatot
   követel** (lásd Nyitott ①).
3. **Szerzői jog:** a tulaj tartalma (szöveg, feltöltött fénykép) az övé marad; a **sablon, a
   dizájn-rendszer és a generáló motor a miénk**, amire az előfizetés használati jogot ad. Ez teszi
   a sablont más ügyfélnek is újrahasznosíthatóvá — a teljes jogátruházás az üzleti modell ellen
   dolgozna.
4. **Egyedi domain (az ADR-0020 min. 2 éves vállalás kitöltése):** a tulaj felhatalmaz minket, hogy
   az általa kért domaint **a mi tulajdonunkba** vásároljuk. Az árát a 2 éves szerződéses viszony
   fedezi. A domain **tulajdonjoga az előfizetés lejárta után 90 nappal száll át**, és CSAK akkor,
   ha a tulaj a 2 év alatt (a) az eredetileg választottnál **nem kisebb csomagot** fizetett elő és
   (b) **késedelem nélkül, maradéktalanul** fizetett. Nemteljesítés esetén a domain nálunk marad.

### Hogyan épül (§H.22)

A jogi szöveg **determinisztikus**: a `src/legal.ts`-ben él, verziózva, `i18n-exempt` jelöléssel —
SOHA nem megy fordító-AI-on át, és nem a `T()`/`tr()` úton születik. Az elfogadott verzió rábélyegződik
arra a rekordra, amely az elfogadást hordozza (a 0029 ezt már így csinálja).

Az **impresszum-adatok** (EV név, székhely, nyilvántartási szám, adószám) NEM kerülnek a repóba:
env-ből jönnek az `OUTREACH_SENDER_*` bevált mintájára, kitöltetlenül `[KITÖLTENDŐ: …]` jelöléssel,
és **őr tiltja az élesítést**, amíg kitöltetlen — a kitalált cégadat rosszabb, mint a hiányzó
(§B.17 tényhűség a saját adatunkra is áll).

**⚠️ Korrekció (még aznap, a tulaj jelzésére).** Az első változat a checkout ÁSZF-elfogadó sorát a
`config.termsUrl`-ön keresztül **az impresszum-adatok kitöltöttségéhez kötötte** (üres cégadat ⇒
nincs elfogadó sor). Ez két okból hibás volt, és vissza lett vonva:
1. **Eltörte a végponttól végpontig tesztet.** A scrape→számla teljes kör lokálban nem játszható
   végig, ha egy lépés csak az éles konfiguráció mellett jelenik meg. A tesztkörnyezetnek a TELJES
   folyamatot mutatnia kell, különben pont az marad ellenőrizetlen, ami élesen számít.
2. **Redundáns volt.** Amitől védett — hogy üreges dokumentumot fogadtasson el valódi vevővel —
   azt már a `deploy-prod.sh` GATE 1b-je megakadályozza, és az az ÉLES `.env`-et olvassa.

**Tanulság:** a *futásidejű* működés és az *élesítési készenlét* két külön kérdés. Készenléti
feltétel KAPUBA való, nem a futásidejű útba — különben a fejlesztést is blokkolja, és a funkció a
tesztkörben láthatatlan marad. A `termsUrl` ma mindig `/aszf`; a cégadat-ellenőrzés a deploy-kapuban
és a `legal-check --prod`-ban él tovább.

- **Visszafordíthatóság:** 🔄 a szövegek és az oldalak additívak. 🚪 EGYIRÁNYÚBB a §4 domain-szabály
  és a felmondási feltétel: amint egy vevő elfogadta, az ŐRÁ nézve az a verzió köti — visszamenőleg
  nem írható át, csak új verzió adható ki.
- **Nem vagyunk jogászok:** a szövegek a kötelezettség-térképet fedik le és a saját üzleti
  döntéseinket rögzítik. **Az első éles eladás előtt ügyvédi ellenőrzés kell**, kiemelten a DPA-ra,
  a felelősség-korlátozásra és a domain-átszállási konstrukcióra.

### Mellék-lelet — a mock jogi linkje 404 volt

A `src/generator/demoFrame.ts` a kiküldött mock láblécében az **`/adatvedelem`** útra linkelt, de a
route `/privacy` — vagyis minden hideg megkeresésben **halott jogi link** ment ki. Ez pontosan a
„mock-út elfedi az éles utat" minta: a demo-lábléc önmagában hibátlanul renderelt. A `/adatvedelem`
mostantól valódi route (a `/privacy` megmarad, hogy a korábban kiküldött linkek se törjenek).

### Nyitott (nem ebben a szeletben)

1. **A 15 napos lejárati értesítő ütemezője** — ma nincs cron/scheduler rá. Amíg nincs, az ÁSZF
   olyat ígér, amit a rendszer nem teljesít; a szöveg és a gép együtt érvényes.
2. **A TENANT-oldalak jogi minimuma** — a generált oldal `POST /api/foglalas` és `/api/velemeny`
   végponton **személyes adatot fogad**, tenant-oldali adatkezelési tájékoztató nélkül; a
   vélemény-modul pedig az Fttv. (Omnibus) szerinti **valódiság-nyilatkozatot** követeli meg.
   Ez a következő szelet, és jogsértő terméket szállítunk, amíg nincs meg.
3. **Könyvelői jóváhagyás** az EU-s ág adókezelésére (átvíve az ADR-0055-ből).
