## ADR-0416 — Portál-jutalék kiváltása és megtalálhatóság: Search Console, „közvetlen foglalás előnye” modul, közösségimédia-modul, Google Térkép-útmutató

**Dátum:** 2026-11-02 · **Státusz:** IRÁNY ELFOGADVA (tulaj, 2026-11-02, tulaj-szál `cit0dae95bf`); a felület-munkák a §2b terv-kapun mennek át ·
**Kapcsolódik:** `_planning/VISIBILITY.md` (felfedezhetőség-motor), ADR-0361 (portál-naptárszinkron), `_planning/DOMAIN/01-CALC-MODELS.md` (ügyfél-oldali megtérülés)

### Kiváltó

A Marilyn Vendégház (Kehidakustány) tulaja 2026-11-02-én felhívta a tulajt: próbázni akar, és neki, valamint több általa ismert
szállásadónak két dolog számít: ① megszabadulni a portálok (Booking, Szallas.hu) jutalékától, ② hogy a vendégek megtalálják a
saját oldalt. A tulaj alaptézise: a vendégek jelentős része a portálon választ szállást, utána rákeres a nevére, és megnézi,
kap-e jobb feltételt közvetlen foglalásnál. Ebből két követelmény jön: a névre keresésnél **meg kell jelennünk**, és az oldalnak
**azonnal mutatnia kell a közvetlen foglalás előnyét**.

### Mérés (2026-11-02, élő `sama-vendeghaz.citoviso.com`, `overseer.hu`)

- Megvan: `index, follow`; cím „<Név> — <Település>”; canonical; LodgingBusiness JSON-LD (cím, koordináta, értékelés);
  robots.txt + sitemap; ~380 szó JS nélkül is olvasható. Saját domainnél az aldomain 301-gyel a saját domainre visz, és a
  canonical a saját domain (`overseer.citoviso.com` → `overseer.hu`), így nincs duplikált tartalom.
- Hiányzik: a Google-nek semmi nem jelzi, hogy az oldal létezik (nincs Search Console-beküldés, nincs rámutató link); a
  meta-leírás vékony („Nálunk Fonyódon pihenhet.”).

### Döntés

1. **Search Console-beküldés — automatikusan, mindkét címre** (tulaj: „2-t is be kell küldeni”). Minden élő szállásoldal
   beküldése a citoviso.com-os címével (`<slug>.citoviso.com`) ÉS — ha van — a saját domainjével. A saját domainnél a
   301 + canonical miatt a Google a saját domaint tekinti fő címnek. A szállásadónak nincs vele dolga. Mellé erősebb,
   a szállás saját adataiból képzett meta-leírás (§B.17: csak valós adat).
2. **„Közvetlen foglalás előnye” — külön, megvehető modul, csomagba is tehető.** A szállásadó a stratégiájához választ
   előre megírt szövegek közül (pl. legjobb ár, kedvezmény, ingyenes lemondás, ajándék), és az oldal tetején ez látszik.
   ⛔ Az ígéret csak akkor jelenhet meg, ha a rendszer be is tartja, vagy a szállásadó kifejezetten vállalja
   (pl. a „-5% közvetlen foglalásnál” a foglalási árban ténylegesen levonódik; a „legjobb ár” a szállásadó saját nyilatkozata),
   mert a valótlan reklám-ígéret fogyasztóvédelmi kockázat. Jogi alap: a Booking.com 2024-11-14 óta DMA-kapuőr, az EGT-ben
   paritás-záradékot nem alkalmazhat, tehát a saját oldalon olcsóbb ár megengedett. A Szallas.hu szerződését nem ellenőriztük.
3. **Közösségi média — külön modul.** Első lépés: kész poszt a szállás saját fotójából + a naptár szabad napjaiból, a
   **Heti programajánló** (`poi`) moduljának helyi programjaival összekötve („ezen a hétvégén falunap — nálunk még van hely”),
   egy koppintásos megosztással. A tulaj valódi célja azonban a **célzott hirdetés / célzott tartalom** — ez külön tisztázandó
   (ki fizeti a hirdetési keretet, kinek a fiókjából fut, mérés/süti-hozzájárulás), és saját döntést kap.
4. **Google Térkép-útmutató a szállásadónak — kell.** Lépésről lépésre: a honlap címe a saját Google Térkép-profiljába
   (és a Facebook-oldalába). A **Google-profil kezelése** (VISIBILITY.md §2) akkor jön, ha lesz konkrét tenant, akivel együtt
   végigvihető.
5. **Elvetve:** jutalék-kalkulátor a rendelő panelen (tulaj: „nem kell”).

### Számok kifelé (§B.17)

Jutalék-százalékot nem állítunk; a szállásadó a saját kulcsával számol. Igazolt sáv: OGY Infojegyzet 2024/1 — az online
szállásközvetítők jutaléka a nettó szállásdíj 10–30%-a. A `01-CALC-MODELS.md` forrás nélküli „15–18%” és „20–30% átcsábítás”
értéke 2026-11-02-én forrásolt szövegre cserélve.

### Visszafordíthatóság

🔄 Mind a négy irány olcsón visszavonható; élesítés csak külön tulaj-engedéllyel (§0.3).
