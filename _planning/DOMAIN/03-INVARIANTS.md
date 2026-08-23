# 03 — INVARIÁNSOK (Citoviso ontológia)

> Szabályok, amiknek MINDIG igaznak kell lenniük. Megsértésük bug vagy jogi/üzleti kockázat. Kód-review + generálás előtt ellenőrizd.

## §A — Kép & tartalom jogállás (provenance)
1. Élesre mehet: **(a)** `owner` (vagy explicit írásos engedélyű) kép; **VAGY (b)** **BÁRMELY** demó-kép (`guest` | `portal` | `places` | `streetview`), **HA** a tenant a szerződés/fizetés kapujában **jogi önnyilatkozatot** tesz — kijelenti, hogy a demóban látható képek szerzői joga felett **teljes körűen rendelkezik**, **+ szavatosság + kártalanítás** —, ÉS a fizetés előtt volt lehetősége lecserélni (testre szabás/feltöltés/előnézet). Indok (**tulajdonosi döntés, 2026-08-20**): a képek a tenant SAJÁT ingatlanát/szolgáltatását ábrázolják, tehát ő vagy megbízottja töltötte fel valahova → a szerzőség az övé; a nyilatkozat + szavatosság + kártalanítás nála telepíti a jogi felelősséget. `generated`: külön (a miénk, licenc a tenantnak).
   - **Következmény — nincs üres oldal:** ha a tenant nyilatkozott, de NEM tölt fel saját képet, akkor **a mockban szereplő képek kerülnek az élő oldalra**. A go-live SOHA nem eredményezhet kép nélküli oldalt (ez sértené a §I szállítási invariánst: amit megajánlottunk, azt kapja).
2. **Vízjeles** portál-fotó élesre **SOHA** — a látható idegen vízjel önmagában kizáró ok, az önnyilatkozattól függetlenül; élesre a tulaj tiszta eredetije vagy csere.
3. Minden kép-assetnek KÖTELEZŐ provenance-osztálya (owner|guest|portal|places|streetview|generated).

   **Enforce-olható kontraktus** (a jog/provenance-őr erre horgonyoz — FÁZIS-kötött):
   - **Provenance × fázis mátrix.** A megengedettség a FÁZISTÓL függ, nem magától a képtől:
     - **MOCK/DEMO fázis** (a kiküldött előzetes terv): owner | guest | portal | places | streetview | generated **mind megengedett**, DE **KÖTELEZŐ a demo-framing** — a mock deklarálja magát előzetes tervnek (lábléc: „Előzetes terv — készült a Citoviso motorral"), és SEM szövegben, SEM meta-adatban NEM adja ki magát a tulaj hivatalos, élő oldalának, sem a képeket a tulaj tulajdonának.
     - **LIVE/TENANT fázis** (konverzió után, élő Site): **owner** (vagy explicit írásos engedélyű) asset; **VAGY guest | portal | places | streetview**, ha a tenant a fizetési kapuban **jogi önnyilatkozatot** tett (teljes körű rendelkezés a szerzői joggal + szavatosság + kártalanítás) ÉS volt lehetősége lecserélni (§A.1/b). Az EGYETLEN feltétlen kizáró ok a **vízjeles** fotó (§A.2). `generated`: külön licenc.
   - **Igazságforrás:** minden kép-asset provenance-osztályt kap az ingest/feltöltés pontján. ⚠️ [DEFERRED — a kép-rights provenance mező a kódban MA NINCS: a régi `Property.PropertyImage.source` a Property-modellel kiesett. Visszaépítendő a data-plane asset-táblába a konverziós fázis scaffoldjakor.]
   - **Enforce NOW:** a generált mock demo-framinget hordoz (lábléc-jelölés jelen; nincs „hivatalos oldal"/owner-tulajdon állítás) → determinisztikus check a generált HTML-en + a jog/provenance-őr review-ja.
   - **Enforce NOW (konverziós asset-kapu):** élesítéskor (nyilvános go-live, ADR-0014) a nem-owner képre kötelező (a) a fizetési kapuban rögzített **jogi önnyilatkozat** (`order_intent.photo_rights_declared_at` + a nyilatkozat SZÖVEGE `photo_rights_text`-ben, bizonyítékként megőrizve), VAGY (b) csere owner-assetre. Nyilatkozat megléte esetén a demó-képek **maradnak** (§A.1 következmény). Feltétlen kizárás: vízjeles. A **privát `provisioned` előnézet** (fizetés/nyilatkozat ELŐTT) még demó-fázisú → ott a demó-kép mindig megengedett.
   - ⛔ **LEZÁRT KÉRDÉS — nem újranyitható (tulajdonosi rendelet, 2026-08-20).** A fenti fotó-jogállási szabály **üzleti/jogi döntés, a tulajdonos hatásköre**. Az AI-asszisztens ebben **nem nyilatkozik, nem mérlegel, nem javasol alternatívát, és nem nyitja újra** — sem „ToS-kockázat", sem „biztonságosabb út" címén. A feladat kizárólag a szabály HŰ implementálása. Ha az implementáció során tényszerű ELTÉRÉST észlel a kód és e szabály között, azt jelenti — de a szabályt nem vitatja.

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


18. **Nyelvi-csomag doktrína (ADR-0036) — a nyelv PARAMÉTER, a felirat SOHA nem beégetett.**
   Minden VEVŐ-oldali felület (sablon, widget, konfigurátor, fizetőoldal, e-mail-váz) a feliratait
   **nyelvi csomagból olvassa** — szerver-oldalon `T(d, "…")` (templateKit), kliens-oldalon `tr("…")`
   (CIT_I18N / manifest-i18n). A kulcs maga a magyar forrás-string; a katalógust az extractor
   (`scripts/extract-i18n.mts`) gyűjti, a csomagot az `ensureLanguagePack` provisionálja (AI-fordítás
   egyszer nyelvenként, placeholder-őrzéssel, `language_pack` tábla).
   - **ÚJ felület/felirat CSAK burkolva születhet** — beégetett vevő-felirat = doktrína-sértés,
     mert némán magyar marad egy lengyel oldalon.
   - A per-lead AI-szövegek (brief/copywriter) a cél-nyelvet paraméterként kapják — ott nincs csomag.
   - JOGI szöveg ≠ fordítás: az outreach jogalap/leiratkozás-szöveg országonkénti JOGI CSOMAG,
     tulaj-jóváhagyással (§C ország-kapu) — azt tilos „csak lefordítani".
   - Őr: `scripts/i18n-lint.mts` (determinisztikus forrás-lint a vevő-felület fájlokon).
   - Ismert adósság: a kompozíciós fallback-út (`primitives.ts`/`chrome.ts`) és a tenant-admin/konzol
     még burkolatlan (post-pilot); új kód ott is csak burkolva írható.

19. **KONVERZIÓS DRAMATURGIA — a FŐ MOTIVÁCIÓ, aminek fényében MINDEN felület-döntés születik
   (tulaj-rendelet, 2026-08-23, ADR-0062).** Az oldal célja nem az, hogy egy funkció „ki legyen
   pipálva", hanem hogy a látogatóban VÁGYAT építsen, és a vágy csúcsán konvertáljon. Az ív
   KÖTELEZŐ sorrend: **① elcsábítás** (hero, képek, a hely története — itt SEMMI nem kér még
   semmit) → **② ajánlat** (szobák, élmények, árak) → **③ bizalom** (vélemények, valós számok)
   → **④ konverzió** (a TELJES foglalási/érdeklődési felület) a lap ALSÓ, döntési zónájában.
   - A teljes konverziós űrlap (foglalás-widget, naptár) az első képernyőn TILOS — „foglalj,
     mielőtt bármit láttál volna" a vágy-építés ellentéte. Fent CSAK könnyű, karcsú CTA él
     (gomb/sáv), ami a konverziós szekcióhoz UGRIK.
   - Egy funkció LÉTE nem érv az elhelyezésére: minden új felület-elem helyét a dramaturgiai
     ív dönti el, és leszállítás előtt a kimenetet LÁTOGATÓ-szemmel kell megítélni
     (screenshot, 390px is), nem feature-listával.
   - Őr: `native-content-check` dramaturgia-kapuja — a teljes foglalási felület a forrás-
     sorrendben a galéria/szoba-tartalom UTÁN áll; az első zónában csak CTA-horgony.

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

## §I — Ígéret ⇔ Szállítás hűség (WYSIWYG a nulladik ponton) — NEM ALKUDHATÓ

23. **⛔⛔ Amit a leadnek MEGAJÁNLUNK, PONTOSAN azt kell megkapnia fizetés után. Az áteresztés (bait-and-switch) a nulladik ponton ABSZOLÚT TILOS — üzletileg öngyilkos ÉS jogilag súlyos (megtévesztő kereskedelmi gyakorlat / Fttv., szerződésszegés).** A kiküldött outreach-mock a fő üzleti horog: ha a lead erre kattint és ezért fizet, akkor az élő (LIVE/TENANT fázisú) oldalnak **vizuálisan és minőségileg legalább ekvivalensnek kell lennie** — nem lehet lebutított/„80%-os" változat. A mock a szerződés vizuális tárgya, nem csali.
    - **Következmény a motorra:** a `mock → live` átmenet NEM ronthatja a minőséget. Ezért a `mock=live` (egy motorból, ADR-0016) az ALAPÉRTELMEZETT út. Ha valaha bespoke/HIBRID utat választunk a horog wow-jáért, az CSAK akkor megengedett, ha az élő oldal ugyanazt a minőséget szállítja (pl. a bespoke-kimenet maga válik szerkeszthető live-vá) — a downgrade-csapda tilos.
    - **A tényhűségtől külön invariáns:** §B.17 arról szól, hogy a mock tartalma ne fabrikáljon tényt; §I arról, hogy a megajánlott FORMA/MINŐSÉG a fizetés után is megmaradjon. A kettő együtt: *igaz tartalom + hű szállítás.*
    - **Enforce:** minden mock→live architektúra-döntésnél kötelező visszamérési pont (a horog-mock és az élő oldal screenshot-ekvivalenciája). Eltérés → invariáns-sértés, nem mehet élesbe.

## §H — Láthatóság, SEO, lokalizáció
21. **A honlap szükséges, de nem elegendő — a generátornak ALAPBÓL felfedezhető (SEO-optimális) oldalt kell gyártania.** Kötelező, automatizált réteg: technikai SEO (sebesség/mobil/sitemap/HTTPS/canonical) + **Schema.org strukturált adat (LocalBusiness/Hotel/Restaurant JSON-LD)** egyenesen a strukturált lead-adatból + meta. GBP-kezelés és Search Console-indexelés tulaj-hozzáférést igényel → konverzió UTÁN. ⚠️ Reális keret: a láthatóság időigényes és nem garantált top-találat — a kontrollálható emelőket optimalizáljuk, nem „#1 helyet ígérünk".
22. **Ország-lokalizáció = Nyelv (AI, dinamikus) | Jog+formátum+pénznem (determinisztikus).** A tartalmi/marketing szöveget AI fordítja **kontextus-alapon** (nyelv-független forrás + cache-elt variánsok, NEM hardcoded string-tábla). ⚠️ A **jogi szöveg + formátum + pénznem determinisztikus, ország-szabály-táblából** — SOHA nem fordító-AI-ra bízva.

## §J — Tudásbázis & felhasználó-vezetés (ADR-0045)
24. **Tenant-felé néző admin-funkció nem születhet súgó nélkül.** Minden felület-szekció/folyamat
    KB-lefedettséggel jön (`data-kb-anchor` + `kb/entries/` bejegyzés: folyamatleírás + screenshot) —
    ez a §E.12 (önkiszolgáló admin, support≈0) előfeltétele. Mérce: az IT-kezdő tulaj TELEFONRÓL,
    segítség nélkül végigmegy a folyamaton. A súgó a TÉNYLEGES felületet írja le (valós gombfeliratok,
    valós sorrend) — elavult súgó rosszabb, mint a hiányzó. Enforce (ÉLES): `scripts/kb-check.mts
    --coverage` a pre-commitban ÉS PostToolUse-hookként (`kb-scan.mjs`) — anchor↔entry bijekció +
    **„label”**-drift a view-forrás ellen; + `tudasbazis-or` az ítélet-igényű részre.
25. **A KB nyelvi teljessége automata, nem manuális fegyelem.** KB-entry létrejötte/módosulása →
    automata, markdown-tudatos fordítás MINDEN élő nyelvi csomagra (`kb_translation`, `source_hash`-
    őrzött staleness). Új nyelv/régió aktiválása = UI-csomag + KB-fordítás EGY ensure-hívásból — a
    lengyel tulaj nem kaphat magyar súgót, és a KB nem maradhat ki egy új nyelvből azért, mert valaki
    elfelejtette. (A §B.18 tükre dokumentum-szinten; a §H.22 munkamegosztás itt is áll: tartalom = AI,
    jogi szöveg = determinisztikus csomag.)
26. **Screenshot csak reprodukálható lehet.** A súgó-képek script-generáltak (Playwright, nyelv-
    paraméteres) — UI-változásnál és új nyelvnél újragenerálódnak. Kézi kép csak átmeneti és
    nyelv-jelölt; külső (repón kívüli) képhivatkozás tilos. Ok: a kézi kép elavul és nyelv-hamis.

> Új invariáns felbukkanásakor ide vedd fel, és linkeld a memóriában.
