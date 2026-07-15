# 03 — INVARIÁNSOK (Citoviso ontológia)

> Szabályok, amiknek MINDIG igaznak kell lenniük. Megsértésük bug vagy jogi/üzleti kockázat. Kód-review + generálás előtt ellenőrizd.

## §A — Kép & tartalom jogállás (provenance)
1. Élesre mehet: **(a)** `owner` (vagy explicit írásos engedélyű) kép; **VAGY (b)** `guest`/`portal` demó-kép, **HA** a tenant a szerződés/fizetés kapujában **jogi önnyilatkozatot** tesz — kijelenti, hogy a kép szerzői joga felett rendelkezik, **+ szavatosság + kártalanítás** —, ÉS a fizetés előtt volt lehetősége lecserélni (testre szabás/feltöltés/előnézet). Indok: a `guest`/`portal` képet nagy valószínűséggel a tenant vagy megbízottja töltötte fel → hihető a szerzősége. ⚠️ **`places`/`streetview` NEM önnyilatkozható** (Google jogállás, nem a tenanté) → élesre csere kell. `generated`: külön (a miénk, licenc a tenantnak).
2. **Vízjeles** portál-fotó élesre **SOHA** — a látható idegen vízjel önmagában kizáró ok, az önnyilatkozattól függetlenül; élesre a tulaj tiszta eredetije vagy csere.
3. Minden kép-assetnek KÖTELEZŐ provenance-osztálya (owner|guest|portal|places|streetview|generated).

   **Enforce-olható kontraktus** (a jog/provenance-őr erre horgonyoz — FÁZIS-kötött):
   - **Provenance × fázis mátrix.** A megengedettség a FÁZISTÓL függ, nem magától a képtől:
     - **MOCK/DEMO fázis** (a kiküldött előzetes terv): owner | guest | portal | places | streetview | generated **mind megengedett**, DE **KÖTELEZŐ a demo-framing** — a mock deklarálja magát előzetes tervnek (lábléc: „Előzetes terv — készült a Citoviso motorral"), és SEM szövegben, SEM meta-adatban NEM adja ki magát a tulaj hivatalos, élő oldalának, sem a képeket a tulaj tulajdonának.
     - **LIVE/TENANT fázis** (konverzió után, élő Site): **owner** (vagy explicit írásos engedélyű) asset; **VAGY guest | portal**, ha a tenant a fizetési kapuban **jogi önnyilatkozatot** tett (rendelkezés a szerzői joggal + szavatosság + kártalanítás) ÉS volt lehetősége lecserélni (§A.1/b). **places | streetview** (Google jogállás) és **vízjeles portál-fotó élesre SOHA** (§A.2) → csere kell. `generated`: külön licenc.
   - **Igazságforrás:** minden kép-asset provenance-osztályt kap az ingest/feltöltés pontján. ⚠️ [DEFERRED — a kép-rights provenance mező a kódban MA NINCS: a régi `Property.PropertyImage.source` a Property-modellel kiesett. Visszaépítendő a data-plane asset-táblába a konverziós fázis scaffoldjakor.]
   - **Enforce NOW:** a generált mock demo-framinget hordoz (lábléc-jelölés jelen; nincs „hivatalos oldal"/owner-tulajdon állítás) → determinisztikus check a generált HTML-en + a jog/provenance-őr review-ja.
   - **Enforce DEFERRED (konverziós asset-kapu, ha megépül):** élesítéskor (nyilvános go-live, ADR-0014) a nem-owner képre kötelező (a) a fizetési kapuban rögzített **jogi önnyilatkozat** (guest/portal esetén: rendelkezés + szavatosság + kártalanítás), VAGY (b) csere owner-assetre. `places`/`streetview`/vízjeles → mindig csere. A **privát `provisioned` előnézet** (fizetés/nyilatkozat ELŐTT) még demó-fázisú → itt a demó-kép megengedett (a preview nem nyilvános). Aktiváló feltétel: a provisioning/konverziós pipeline élesedése.

## §B — Dizájn
4. **NINCS emoji-ikon.** Csak saját SVG-sprite ikon (`currentColor`, stroke).
5. Minden generált oldalon KÖTELEZŐ a `Property.unique` szekció valós, megkülönböztető adattal — generikus töltelék TILOS.
6. A paletta a szállás SAJÁT fotóiból jön (analyze), nem fix sablon-szín.
7. `review` csak VALÓS, szó szerinti vendégvéleménnyel tölthető ki (kitalált nem).
17. **Tényhűség — sosem fabrikálunk tényt.** Ár, szoba, m², értékelés, NTAK-szám és minden hard adat CSAK valós forrásból. Ismeretlen adat → a szekció **kihagyva**, NEM naiv fill. Elv: „bizonytalanság → kevesebb, sosem hamis." (Az AI szabad a SZERKEZETEN, kötött a TÉNYEKEN.)

   **Enforce-olható kontraktus** (a tényhűség-őr erre horgonyoz — nem a hangulatra):
   - **HARD tény (verifikálandó):** szám vagy ellenőrizhető állítás — ár, m², szoba/kapacitás, ★/értékelés + értékelés-szám, évszám, NTAK/nyilvántartási szám, díj/minősítés, konkrét távolság („200 m a strandtól"), cím, telefon, e-mail, nyitvatartás. **SOFT tartalom (szabad):** hangulat, jelző, elrendezés, paletta, hívogató szöveg.
   - **Igazságforrás — az EGYETLEN megengedett bemenet HARD tényhez:** (a) a scraper strukturált mezői: `QualifiedLead` (`name`, `address`, `phone`, `email`, `website`, `lat/lon`, `photoCount`, `matchConfidence`, `material`), `WebsiteAssessment`, `RawLead`; VAGY (b) a briefnek átadott fotókon **EGYÉRTELMŰEN LÁTHATÓ** jellemző (image-grounded). Más semmi.
   - **Tiltott kimenet:** (1) bármely HARD tény, ami sem strukturált mezőből, sem látható képi jellemzőből nem vezethető le (LLM-becsempészés a `GeneratedBrief.intro/highlights/tagline` szabad szövegébe — ma ez az EGYETLEN valós szivárgási pont, mert strukturált ár/m²/szoba mező még nincs); (2) ismeretlen mező „naiv" kitöltése hihető értékkel; (3) generikus töltelék a `unique` mag helyén; (4) `matchConfidence` low sávú lead fotó-/jellemző-tulajdonítása (lásd §F.17b).
   - **Bizonyíték-kötelezettség:** minden kiadott HARD ténynek visszavezethetőnek kell lennie egy forrás-mezőre VAGY „image#N látható" jelölésre. Nincs bizonyíték → a tény/szekció **KIMARAD** (nem puhítjuk, nem tippeljük).
   - **Ellenőrzés (őr-eljárás):** a generált copyból (`GeneratedBrief.intro/highlights/tagline`) kiemeljük a HARD-tény-jelölteket (számok, ★, felső fok konkrét állítással, nevesített amenity/díj) → mindegyikhez forrás-mező- vagy kép-illesztést keresünk → illesztetlen = sértés → a szekció eldobva vagy a lead flag-elve.
   - **⚠️ Fázis-határ — minta-modul az előnézetben (ADR-0015):** a fenti tiltás a HARD tény **valósként való feltüntetésére** vonatkozik. Külön eset a **modul-KONFIGURÁTOR keretezett, fizetés-ELŐTTI előnézete**: ott egy adat nélküli modul **reprezentatív/minta-állapottal MEGmutatható** — a *sales* megköveteli (láthatatlan modult nem lehet eladni). Feltétel: **félreérthetetlen minta-jelölés** (pl. „minta — így néz ki, ha lesz X"), a demó-fotókkal azonos demo-framing logika. **KŐBE VÉSVE:** minta-tartalom a **nyilvános ÉLŐ oldalra SOHA** nem másolódik át adat-fedezet nélkül — vétel *enged*, valós adat (vagy a tulaj admin-feltöltése) *tölt*. Az élő oldal marad teljesen adat-kapuzott (17. pont).

   **Enforce-olható — dizajn-doktrína** (a dizájn-őr determinisztikusan ellenőrzi a generált HTML-en; részletes kontraktus: [06-UI-CONTRACT.md](06-UI-CONTRACT.md)):
   - **Emoji-tilalom (§B.4):** a HTML-ben NINCS emoji (`\p{Extended_Pictographic}`) — ikon KIZÁRÓLAG inline SVG.
   - **Téma-token kontraktus (06-UI-CONTRACT A):** a `:root` KÖTELEZŐEN kiadja mind a 11 tokent (`--cit-accent`, `--cit-on-accent`, `--cit-ink`, `--cit-muted`, `--cit-bg`, `--cit-surface`, `--cit-line`, `--cit-radius`, `--cit-font-display`, `--cit-font-body`, `--cit-shadow`). Hiányzó token = sértés (a widgetek nem öltöznek fel).
   - **Modul-horog (06-UI-CONTRACT B):** a GERINC érdeklődés-CTA jelen (`data-cit-module="booking"`); a modul-slotok stabil `data-cit-module` horgot viselnek.

## §C — Outreach (jog)
8. Hideg megkeresés = célzott, személyre szabott, **leiratkozható** (nem tömeg-spam). GDPR/Grt.-tudatos.
9. Külön küldő-domain + SPF/DKIM/DMARC (deliverability), a fő domain égetése tilos.

   **Enforce-olható kontraktus** (a jog/provenance-őr erre horgonyoz — FÁZIS-kötött):
   - **Minden kiküldött hideg megkeresés KÖTELEZŐ elemei:** (1) működő, egy-kattintásos **leiratkozó-link**; (2) azonosítható, valós **feladó-identitás** (ki ír, milyen jogalapon — Grt. jogos érdek + GDPR-tájékoztatás elérhető); (3) **személyre szabott** tartalom (a konkrét lead adatára/mockjára hivatkozik — NEM azonos tömeg-szöveg); (4) nem félrevezető tárgy/feladó (nem tettet létező kapcsolatot). A küldés külön domainről, SPF/DKIM/DMARC-kal.
   - **Enforce NOW:** ha bármilyen outreach-drafot (email/SMS szöveg) írunk, a jog/provenance-őr ELŐBB ellenőrzi a fenti 4 elemet + a §A demo-framing állítást (a linkelt mock előzetes terv, nem „a te oldalad kész").
   - **Enforce DEFERRED (küldő-pipeline kapu, ha megépül):** a tényleges e-mail-küldő KÓD (ma `smtpUrl`/`outreachFrom` üres, nincs küldő-modul) nem küldhet leiratkozó-link + azonosítható feladó nélkül; a suppression-lista (leiratkozottak) betartása kötelező. Aktiváló feltétel: a küldő-pipeline élesedése.

## §D — Deploy (a CLAUDE.md §0 tükre)
10. Lokál-először; élesre CSAK módosított fájlok, push-onként ÚJ scope-olt engedéllyel. Éles cél amúgy még TBD.

## §E — Üzleti pozicionálás
11. A kommunikáció horga a **booking-jutalék megtakarítása**, nem a honlap ára.
12. A skálázhatóság feltétele az **önkiszolgáló admin** (support ~0). Ha egy feature növeli a per-tenant supportot, az invariáns-sértés.

## §F — Saját-honlap detektálás (presence)
13. **A „nincs saját honlap" állítás bizonyítást igényel, nem a hiány feltételezését.** A Google Maps `websiteUri` hiánya NEM bizonyíték — csak azt jelenti, hogy a Maps-profilhoz nincs kötve honlap. A leadet aktívan verifikálni kell (domain-guess + HTTP-proba, kiegészítő web-search a farokra).
14. **Talált honlap CSAK geo/kontextus-egyezéssel érvényes.** Egy domain akkor számít az adott lead saját honlapjának, ha a lekért oldal a márka-magot ÉS a régiót (vagy egyéb egyértelmű azonosítót: cím/telefon) is korroborálja. **Brand-only egyezés = COLLISION, elvetendő** — a cégnév ütközhet másik településen működő, teljesen más vállalkozással (bizonyított: Rózsakő ház/Badacsony ↔ Rózsakő Étterem/Kisvárda). Ez az A4 konfidencia-kapu tükre a presence-rétegben.
15. **Parkolt / eladó / builder-placeholder oldal nem saját honlap** („ez a honlap eladó", domain-parking) → `none` marad.
16. **Geo-verifikáció nélküli presence-check TILOS élesíteni:** hamis pozitívja jó leadet dob el („van már honlapja"). A naiv guess ezen a mintán 4/4 hamis pozitívot adott.
17b. **Soha ne tulajdoníts fotót vagy jellemzőt ellenőrzött entitás-párosítás nélkül — jobb NINCS fotó, mint téves.** Az A4 match-konfidencia low sávja (⛔) dobja a leadet; a medium sáv kontextuális felülvizsgálatot igényel. (Piroska-eset: valódi 1,0★/27 vs. téves párosítás 4,6★/5 — a rating/vélemény-szám eltérése azonnal flag-elte volna.)

## §G — Izoláció, jog, ember a hurokban
18. **A Vendég (a tulaj ügyfele) NEM a mi üzleti aktorunk.** Következmény: kötelező **tenant-izoláció** — minden Site vendég-adata (PII) tenantonként elkülönül (RLS + per-tenant titkosítás; prémium: külön séma/DB). A megvalósítás architektúra-döntés, de az izoláció-elv nem alkudható.
19. **Mi legfeljebb technikai adatfeldolgozó vagyunk, NEM adatkezelő a vendég felé.** Agentek a control plane-ben élnek; a **vendég-PII-hez üzletileg nem férnek hozzá** (data plane izolált). Két fizetési sík is elkülönül: Tenant→Citoviso (a mi bevételünk) ↔ Vendég→Tulaj (a tulaj fiókján folyik, nem rajtunk át — jogi tisztaság).
20. **Kivétel-alapú ember a hurokban, amely idővel önmagát vonja vissza.** Az ember SOHA nem a fősodorban áll (az automata), csak a bizonytalan/kockázatos kivételeknél (kuráció, pénzügyi felügyelet, support); a fősodor betanulásával az emberi lefedettség csökken. A kockázat aszimmetrikus (kiküldött hibás mock ≫ visszatartott) → bizonytalanság esetén ember.

## §H — Láthatóság, SEO, lokalizáció
21. **A honlap szükséges, de nem elegendő — a generátornak ALAPBÓL felfedezhető (SEO-optimális) oldalt kell gyártania.** Kötelező, automatizált réteg: technikai SEO (sebesség/mobil/sitemap/HTTPS/canonical) + **Schema.org strukturált adat (LocalBusiness/Hotel/Restaurant JSON-LD)** egyenesen a strukturált lead-adatból + meta. GBP-kezelés és Search Console-indexelés tulaj-hozzáférést igényel → konverzió UTÁN. ⚠️ Reális keret: a láthatóság időigényes és nem garantált top-találat — a kontrollálható emelőket optimalizáljuk, nem „#1 helyet ígérünk".
22. **Ország-lokalizáció = Nyelv (AI, dinamikus) | Jog+formátum+pénznem (determinisztikus).** A tartalmi/marketing szöveget AI fordítja **kontextus-alapon** (nyelv-független forrás + cache-elt variánsok, NEM hardcoded string-tábla). ⚠️ A **jogi szöveg + formátum + pénznem determinisztikus, ország-szabály-táblából** — SOHA nem fordító-AI-ra bízva.

> Új invariáns felbukkanásakor ide vedd fel, és linkeld a memóriában.
