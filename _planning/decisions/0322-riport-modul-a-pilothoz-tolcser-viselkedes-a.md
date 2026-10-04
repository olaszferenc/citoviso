## ADR-0322 — Riport-modul a pilothoz: tölcsér + viselkedés a mért linkekből, kétrétegű kilépés-ok, csomag-besorolás, mérés-egységesítés (2026-10-04)

**Dátum:** 2026-10-04 · **Státusz:** elfogadva (tulajdonosi egyeztetés + jóváhagyott terv:
`assets/design-refs/console/riport/`, „B Mehet") · **Kapcsolódó:** ADR-0108 (tenant-forgalom: szerver-oldali,
süti nélkül, host-only referrer), ADR-0110 (nincs süti-sáv a tenant-oldalon), ADR-0139 (a nem kiküldött link forgalma
nem érdeklődés), ADR-0167 (lead-lap tölcsér-állomásai), ADR-0186 (Barion Pixel csak hozzájárulással), ADR-0233 (konzol
Linear-héj, világos+sötét), ADR-0285…0287 (eszkalációs ajánlat), ADR-0288 (Budapest-idő), ADR-0291 (GET nem dönt),
ADR-0064 (a konzol moduljai: … · Riport · …).

**A tulaj szava.** „Lassan indulunk a pilottal és valós megkereséseket fogunk küldeni. […] milyen eszközről nézik,
mikor lépnek ki. Vajon miért lépnek ki? Miért nem vásárolnak? Akik meg vásárolnak mennyire mélyülnek el […] pénzügy is
kell! Bevételek cashflow jelzés tenant kategóriák csomagokkal, modul kimutatás […] Mérni kellene a tenant aktivitást is
a saját admin oldalán. Meg azt hogy hogyan változik a tenant látogatottsága."

**A kiindulás, mérve.** A mock-link (`/p/<token>`) már ~30 eseménytípust mér (görgetés, idő, modul, preset, checkout-
lépések, eszkaláció), de: a `/report` dátum és idősor nélküli; a „Konvertált" oszlopa mindig 0, mert a `prospect.status`-t
senki nem írja `converted`/`lost`-ra; a `mock_view` nyers UA-t és teljes referrert tárol (a tenant-oldal ADR-0108 szerint
csak hostot); nincs szekció-láthatóság, nincs kilépési pont (a `dwell_end` csak másodpercet visz), a `/pay/go` megnyitás
nem naplózódik; nincs tenant-admin aktivitás-napló (csak `last_login_at`, felülíródik); a tenant-forgalom csak a `/`-t
számolja. Nevesített csomag nincs (alapdíj + modulok; a presetek egymásba ágyazottak: Alap ⊂ Ajánlott ⊂ Teljes).

**Döntés.**
1. **Három kör, ebben a sorrendben** (tulaj: „1: OK"): ① Tölcsér + Viselkedés lap + a mérés-bővítés; ② Pénzügy +
   csomag-lap; ③ Tenant-aktivitás + tenant-forgalom. Mindegyik külön §2b-terv; az ① jóváhagyva (B — kérdés-első).
2. **Mérés-bővítés a mock-oldalon** (saját, első-fél beacon, ahogy ma): `section_seen {id}` (IntersectionObserver a
   `data-cit-module`/szekció-horgokon), `dwell_end {seconds, last_section, last_step}`, `client_error`, és a `/pay/go`
   megnyitás naplózása (`pay_go`). A `prospect.status` fizetéskor `converted`, leiratkozáskor `lost` lesz (a tölcsér
   „Fizetve" oszlopa ettől függetlenül a `payment`-ből számol).
3. **Mérés-egységesítés (ADR-0108 kiterjesztése a mock-oldalra):** a `mock_view` a nyers `user_agent` helyett kinyert
   mezőket tárol (`device` mobil/tablet/asztali · `os` · `browser`), a `referrer` host-only. Egy szabály, két hely helyett.
   Visszamenőleg: a meglévő sorokból a kinyerés egyszer lefut, utána a nyers oszlopok ürülnek.
4. **Kilépés-ok KÉT RÉTEGBEN, egymáshoz kalibrálva** (tulaj: „Ez kettős feladat"). **A — következtetett:** minden nem
   vásárló megnyitó látogatás EGY címkét kap tíz közül, egy helyen élő, küszöbös szabályokkal (`src/analytics/
   exitReason.ts`; biztos jel = konkrét esemény, közepes = időzítés). **B — kimondott:** 1-koppintásos mikro-kérdőív
   (5 opció + „Más…" szöveg) három ponton: eszkalációs ajánlat elvetése után, leiratkozó lap a visszaigazolás UTÁN
   (semleges, nincs eladás), emlékeztető-levél linkjéből nyíló megerősítő lap (gomb + POST dönt, ADR-0291). Tárolás
   `prospect_feedback`. **Kalibráció:** ahol van kimondott ok, a gépi tipp mellé kerül; a találati arány a lapon, a
   szabály-küszöböket ebből hangoljuk. A két réteg a lapon KÜLÖN jelenik meg, nem keveredik.
5. **Csomag-besorolás SZÁMÍTOTT, nem tárolt** (tulaj: „ha valaki alapcsomagot veszi + kiválasztja hozzá később, ami
   ajánlott vagy magasabb csomagban van, akkor átsorolódik"): az aktuális csomag = a legnagyobb preset, amelynek MINDEN
   modulja aktív entitlement; ami felette van = csomagon kívüli modul. A KEZDŐ csomag ugyanez az első fizetett rendelés
   modul-listájára; a választott presetet a rendelés is eltárolja (`order_intent.preset`, ma csak eventben él). Egyszeri
   tételek (többnyelvűség, domain) nem csomag-elemek. A 2. kör lapja: kezdő/aktuális megoszlás, átsorolási mátrix
   (honnan→hová, hány nap, első hozzávett modul), modul-népszerűség (induláskor vs. utólag), csomagon kívüli kedvencek,
   upsell-célpontok (1 modul hiányzik a következő csomaghoz).
6. **Tenant-aktivitás napló** (tulaj: „OK") a 3. körben: szerver-oldali `tenant_activity` (login, fül, akció-típus),
   süti nélkül, az adatkezelési tájékoztatóban kimondva (jogos érdek). Tenant-forgalom: `site_visit` útvonallal
   (apartman-oldal, nyelv), továbbra is szkript- és süti-mentes — ADR-0110 NEM nyílik újra; tenant-oldali idő/kilépés
   ezért nincs, és ezt a lap kimondja.
7. **Reggeli digest e-mailben** a tulajnak (tulaj: „email"): tegnap kiküldve/megnyitva/rendelés/fizetve + 30 napos
   cashflow — a 2. kör végén, a Pénzügy-számokkal együtt.
8. **Ítélet-célok** (40/30/20/4/75 % és 24 óra) kezdőértékek, operátor-állíthatók — nem beégetett számok.

**Elvetett alternatívák.** Google Analytics / külső mérés (ADR-0108 — elvetve marad). E-mail megnyitás-pixel (a küldő
szándékosan nem tölt távoli képet; a „megnyitás" = emberi jel a lapon, pontosabb is). Tenant-oldali kliens-mérés
süti-sávval (ADR-0110 újranyitása — a pilot alatt nem). Nevesített csomagok bevezetése csak a riport kedvéért (a
számított besorolás ugyanazt adja, két igazság nélkül). A tölcsér-lap „A — számok-első" változata (a tulaj a B-t
választotta: egy ránézésre „megy-e a pilot").

**Visszafordíthatóság:** 🔄 — a lapok olvasnak; az új eventek és oszlopok addítivak; a nyers UA/referrer leállítása
egyirányú az ADATRA (a kinyert mezők maradnak), ezért a kinyerés előbb fut, mint az ürítés.

**Őr.** `scripts/contract-drift-check.mts` (a README kötő feliratai a hatókörben); a kilépés-ok szabályai önteszttel
(`exitReason.ts` — rögzített látogatás-minták → elvárt címke), hogy egy küszöb-hangolás ne némán változtassa a
címkézést.
