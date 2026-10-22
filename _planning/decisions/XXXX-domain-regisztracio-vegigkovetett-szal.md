## ADR-XXXX — Domain-regisztráció: a szál VÉGIG a miénk — a rendeléstől az élesedésig a gép figyel, kérdez és szól (2026-10-22)

**Kiváltó (tulaj, 2026-10-22 reggel, brief `domain-reg-tiszt-z-sa`):** „A domainregisztrációs folyamat úgy
szar, ahogy van. […] Nincs rá figyelő, nincs rá kontroll, nincs értesítése a leadnek, nincs értesítése a
citovisós adminnak. […] a folyamat egészen addig tart, hogy a tenant megrendeli az általa kívánt domaint,
leadjuk a regisztrátornak és kifizetjük, és onnantól baszunk az egész folyamatra.”

**Mért tények (2026-10-21/22, overseer.hu, éles):**
- A rendelési kérés a regisztrátornak `{ services: [{ type: "domain", domain }] }` — **semmilyen regisztrálói
  adat nincs benne.** A Nyilvántartó a fiók **domain-profiljából** veszi a domain-használót (`GET
  /v1/user/{id}/domainProfile`, mérve: 1 profil, név + cím + e-mail + telefon, **minden `ident*` mező üres**).
- A `.hu` Nyilvántartó a magánszemély regisztrálótól **egy azonosítót** kér (születési dátum / anyja neve /
  személyi / útlevél / jogosítvány). Ennek híján a Websupport **be sem adja** az igénylést: a `service` státusza
  `active`, a díj kreditből levonva, a rendelés-végpontok 404 — **az API-ból semmi nem látszik.** Az egyetlen
  jel egy **emberi support-levél** („[Websupport] - hiányzó adat - overseer.hu -”, 2026-10-22 08:04, a
  `olasz.ferenc@citoviso.com` INBOX-ban), 16 órával a vétel után. Ugyanez 2026-09-07-én a citoviso.hu-nál
  (ticket NGW-NKDHD-903: „a tulajdonosi adatok összekeveredtek”; a tulaj levélben küldte el a személyi számát,
  a support újraindította, aznap bejegyezték).
- Rendben menő igénylésnél a Nyilvántartó megerősítő levele **perceken belül** jön (citoviso.hu 2026-09-06
  21:27 rendelés → aznap este levél); az overseer.hu-nál **soha**.
- Amit a kód a vétel után csinált: 2 percenként `dns_pending`-et írt, a postafiók-figyelő csak a
  megerősítő LINKET kereste (csak az INBOX-ban), a ház 24 óránál kapott volna riasztást, a tenant 72 óránál
  levelet; a vételről a tenant **semmilyen** levelet nem kapott (csak a számlát), a képernyője „várhatóan
  holnap …-ig” ígért.

### Döntés — a folyamat szakaszai és ami MINDEGYIKNÉL kötelező

A saját domain szála **egy szál, egy gazdája a Citoviso**, a tenant igénylésétől a honlap élesedéséig (és
később a név átadásáig). Minden szakasznak van **(a)** gépi ellenőrzése, **(b)** határideje, aminek lejártakor a
**ház** riasztást kap, és **(c)** a tenant felé igaz állapota.

| # | Szakasz | A gép teszi | Határidő → ház-riasztás | A tenant látja / kapja |
|---|---|---|---|---|
| 0 | **Fiók-készenlét** (vétel ELŐTT és óránként) | `registrar.readiness()`: fiók alapértelmezett kontaktja = várt tulajdonos; ÁSZF megerősítve; kredit > 0; **domain-profil létezik, a név egyezik, van e-mail, van legalább EGY azonosító** | hiány → **nincs vétel** (`RegistrarNotReadyError`, a sor `pending` marad, a zárolás áll), ház-levél+SMS naponta egyszer; az óránkénti `stallWatch` **vevő nélkül is** riaszt (`registrar-ready`) | „Már intézzük — Önnek nincs teendője.” (nem „elkelt”, nem `failed`) |
| 1 | Rendelés + fizetés (zárolás) | mint eddig (ADR-0251/0362/0381) | 2 óra `pending`/`registering` → `domain-stall` | képernyő 1. szakasz |
| 2 | **Vétel** a regisztrátornál | atomi claim (0106), rendelés + kreditből fizetés | — | **ÚJ levél: „Megvásároltuk a webcímét: …”** — mi jön, mennyi idő, addig hol él a honlap (`bought_notice_at`, egyszer) |
| 3 | **Nyilvántartói bejegyzés** (`.hu`) | a postafiók-figyelő 2 percenként, **INBOX + Spam**: ① megerősítő link → tulaj SMS+levél (a gép NEM kattint, 09-09); ② **a regisztrátor EMBERI levele a névről** → ház-levél+SMS **azonnal** + `registrar_note` a soron | **2 óra** vétel után nincs megerősítő link → `domain-registry` riasztás (a regisztrátor nem adta be) · 24/72 óra mint eddig (ÚJ-K1) | állapot-képernyő (ADR-0399); regisztrátor-jegyzet esetén „munkatársunk már intézi” (a képernyő-sor bekötése felület-kapu alatt, lásd Nyitott) |
| 4 | DNS a mi szerverünkre | zóna-API: `@`/`www` A → `DOMAIN_TARGET_IP` (ADR-0103 terv-B) | `dns_pending` 24/72 h | képernyő |
| 5 | Tanúsítvány + kiszolgálás | root-timer certbot + nginx-blokk (ADR-0394); host-alapú feloldás, slug → 301 | `tls_pending` 24/72 h | „Elkészült a saját webcíme” levél (megvan) |
| 6 | Megújítás (1 év) | ⛔ **nincs** (`autoExtend=false`, nincs renew-hívás) | — | — |
| 7 | **Átadás a tenantnak** (ÁSZF §9) | ⛔ **nincs kód** | — | — |

### Ami ebben a landban megvalósul (kód)
- `RegistrarAdapter.readiness()` (+ `RegistrarNotReadyError`), Websupport: `GET user` + `GET domainProfile`;
  `register()` ezzel kezd; `registrarReadiness()` 10 perces memóval; mock: `MockRegistrar.readinessProblems`.
- `provisionDomain`: nem-kész fiók → `pending` + ház-riasztás naponta (`house_alert_once`), **nem** `failed`,
  **nem** tenant-levél; `registered → dns_pending` után a tenant **vétel-levele** (`buildDomainBoughtEmail`).
- `registryConfirmWatch`: INBOX + Spam; a regisztrátor emberi levelének felismerése (`matchRegistrarMail`:
  feladó regisztrátor/Nyilvántartó + folyamatban lévő név a tárgyban/szövegben; automata tárgyak — díjbekérő,
  számla, „szinte a tiéd” — nem; a linkes Nyilvántartó-levél az ① ága); 48 óránál régebbi első látásra
  bejegyzés riasztás nélkül; `registrar_note`/`registrar_note_at` a soron.
- `stallWatch` óránként: `registry` (2 óra, `.hu`, nincs link, nincs jegyzet) és `registrar` (készenlét,
  naponta egyszer problémakészletenként).
- Migráció **0113**: `registrar_note`, `registrar_note_at`, `bought_notice_at`.

### Nyitott — a tulaj dönt
1. **overseer.hu MOST:** a Websupport a profil azonosítóját kéri (válasz-levél a ticketre VAGY `PUT
   /v1/user/{id}/domainProfile/{profileId}` az `identBirthday`/`identIdentityCard` mezővel — a PUT a
   dokumentációban létezik, a .hu API-n **nem mérve**). Személyes adat → a tulaj mondja meg, melyiket és hogyan.
2. **A tenant képernyő-sora** („munkatársunk már intézi” a regisztrátor-jegyzet pillanatától): egy feltétel az
   ADR-0399 képernyőben — a felület-kapu (§2b) miatt a tulaj szava kell, utána egy sor.
3. **Megújítás** (6.): `autoExtend` bekapcsolása a vett szolgáltatáson vagy éves renew-hívás — API nem mérve.
4. **Átadás** (7.): javasolt út a Websupport **tulajdonosváltási kérelme** (#211604 mintájára, a tenant saját
   Websupport-fiókjába) vagy regisztrátor-váltás auth-kóddal; operátori lépés, kézikönyv + konzol-gomb később.
5. A megerősítő űrlap gépi kattintása továbbra is TILOS (09-09), amíg nincs pozitív siker-jel.
