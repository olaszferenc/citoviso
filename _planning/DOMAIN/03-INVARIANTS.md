# 03 — INVARIÁNSOK (Citoviso ontológia)

> Szabályok, amiknek MINDIG igaznak kell lenniük. Megsértésük bug vagy jogi/üzleti kockázat. Kód-review + generálás előtt ellenőrizd.

## §A — Kép & tartalom jogállás (provenance)
1. Élesre mehet: **(a)** `owner` (vagy explicit írásos engedélyű) kép; **VAGY (b)** **BÁRMELY** demó-kép (`guest` | `portal` | `places` | `streetview`), **HA** a tenant a szerződés/fizetés kapujában **jogi önnyilatkozatot** tesz — kijelenti, hogy a demóban látható képek szerzői joga felett **teljes körűen rendelkezik**, **+ szavatosság + kártalanítás** —, ÉS a fizetés előtt volt lehetősége lecserélni (testre szabás/feltöltés/előnézet). Indok (**tulajdonosi döntés, 2026-08-20**): a képek a tenant SAJÁT ingatlanát/szolgáltatását ábrázolják, tehát ő vagy megbízottja töltötte fel valahova → a szerzőség az övé; a nyilatkozat + szavatosság + kártalanítás nála telepíti a jogi felelősséget. `generated`: külön (a miénk, licenc a tenantnak).
   - **Következmény — nincs üres oldal:** ha a tenant nyilatkozott, de NEM tölt fel saját képet, akkor **a mockban szereplő képek kerülnek az élő oldalra**. A go-live SOHA nem eredményezhet kép nélküli oldalt (ez sértené a §I szállítási invariánst: amit megajánlottunk, azt kapja).
2. **Vízjeles** portál-fotó élesre **SOHA** — a látható idegen vízjel önmagában kizáró ok, az önnyilatkozattól függetlenül; élesre a tulaj tiszta eredetije vagy csere.
3. Minden kép-assetnek KÖTELEZŐ provenance-osztálya (owner|guest|portal|places|streetview|generated).
3b. **Go-live = ÚJRA-RENDER §A-policyvel; a live státusz-flip CSAK sikeres render UTÁN.** A `provisioned`→`live` átbillentés nem szolgálhat ki privát `provisioned` (noindex, demó-fotós) snapshotot. Az élesítéskor kötelező egy `applyLivePhotoPolicy`-vel szűrt LIVE-fázisú újra-render (`index,follow`), és a `status='live'` flip CSAK a sikeres render után történhet meg — hibás render SOHA nem hagyhat maga után demó-fotós vagy noindex live site-ot (a kockázat aszimmetrikus, §G.20). Strukturálisan nem-szűrhető artifact (legacy HTML-másolat) → az auto-aktiválás MEGTAGADVA, paid+provisioned marad kurátori rendezésig. Igazságforrás: `src/payment/service.ts` (`rerenderTenantSnapshot(..., { as: "live" })` ELŐBB, `.set({ status: "live", live_at })` UTÁNA), `src/tenant/editor.ts rerenderTenantSnapshot`.

   **Enforce-olható kontraktus** (a jog/provenance-őr erre horgonyoz — FÁZIS-kötött):
   - **Provenance × fázis mátrix.** A megengedettség a FÁZISTÓL függ, nem magától a képtől:
     - **MOCK/DEMO fázis** (a kiküldött előzetes terv): owner | guest | portal | places | streetview | generated **mind megengedett**, DE **KÖTELEZŐ a demo-framing** — a mock deklarálja magát előzetes tervnek (lábléc: „Előzetes terv — készült a Citoviso motorral"), és SEM szövegben, SEM meta-adatban NEM adja ki magát a tulaj hivatalos, élő oldalának, sem a képeket a tulaj tulajdonának.
     - **LIVE/TENANT fázis** (konverzió után, élő Site): **owner** (vagy explicit írásos engedélyű) asset; **VAGY guest | portal | places | streetview**, ha a tenant a fizetési kapuban **jogi önnyilatkozatot** tett (teljes körű rendelkezés a szerzői joggal + szavatosság + kártalanítás) ÉS volt lehetősége lecserélni (§A.1/b). Az EGYETLEN feltétlen kizáró ok a **vízjeles** fotó (§A.2). `generated`: külön licenc.
   - **Igazságforrás:** minden kép-asset provenance-osztályt kap az ingest/feltöltés pontján. ✅ **ÉL** (a korábbi „DEFERRED — a mező a kódban MA NINCS" megjegyzés mérve hamis volt, 2026-09-17-én újramérve): a `Photo.provenance` a render-bemeneten hordozza az osztályt (`src/engine/recipe.ts`), a LIVE-él kapuja `src/engine/photoPolicy.ts` (`isLiveSafePhoto` / `applyLivePhotoPolicy`), a `src/tenant/editor.ts`-ből hívva; a nyilatkozat bizonyítéka `order_intent.photo_rights_declared_at` + `photo_rights_text` (`src/db/schema.ts`, írja `src/console/data.ts`). ⚠️ Ami HIÁNYZIK: önálló data-plane asset-tábla — a provenance ma a pillanatkép-adaton utazik, nem külön entitásként. ✅ **A §A.2 2026-09-19 óta ÉLŐ KAPU** (ADR-0200). Korábban itt az állt, hogy a `watermarked` flaget „semmi nem állítja `true`-ra, tehát a §A.2 csak típusdefiníció" — ez mérve IGAZ volt: a fék be volt építve (`photoPolicy.ts`), a pedál működött, de soha senki nem nyomta meg, vagyis vízjeles portál-fotó kimehetett egy FIZETŐ ügyfél élő oldalára. Ma a vízjel-ítéletet a MÁR FUTÓ vision-kör adja (`heroPick.ts`, prompt-verzió `v3-watermark`, KÜLÖN `watermarked` mező — nem `subject` kategória, mert a vízjel ortogonális a tartalomra: egy vízjeles kép is lehet a szállás tökéletes külső fotója), a bélyeg a `dropNeverShown`-ban ragad rá (mind a NÉGY renderelő út ezt hívja), és a `toSitePhotos` viszi tovább a kiszállított `Photo`-ig. ⚠️ KIMONDOTT KORLÁT: az élesítés cache-ből dolgozik, fizetős hívás nélkül — egy `v3` ELŐTT legyártott mock pillanatképén nincs ítélet, és a §A.2 ott nem fut le; a `provision.ts` ezt HANGOSAN kiírja, a pótlás `scripts/rescore-photo-verdicts.mts` (alapból száraz). A detektálás PONTOSSÁGA címkézett korpuszon nincs mérve — az őr a LÁNCOT bizonyítja (ítélet → bélyeg → kizárás), nem a modell találati arányát.
   - **⛔⛔ IDEGEN HIRDETÉS SEMMILYEN provenance-osztály alatt nem mehet ki (ADR-0116).** Mérve 2026-09-11: egy másik cég reklámbannere ment ki a FIZETŐ ügyfél szállás-lapján, a szállás nevével feliratozva — **és a JSON-LD `image` tömbjében is**, tehát a Google felé. A vision-réteg 2026-09-09 óta HELYESEN ítélte `ad_banner`-nek, az ítélet ott ült a `photo_hero_score` cache-ben; csakhogy a `NEVER_HERO` szándékosan csak HÁTRASOROLT. **Megvett ítéletet nem dobunk el: a hátrasorolás és a kizárás KÜLÖN kérdés, és ami nem ezé a szereplőé, azt semmilyen sorrendben nem igaz ráírni.** A kizárás mind a NÉGY renderelő úton érvényes, nem csak a generálásnál: `generate` · `provision` (élesítés) · `tenant/editor::assembleEffective` · `heroOverride`. Igazságforrás: `NEVER_SHOWN` + `dropNeverShown` (`src/generator/heroPick.ts`), mind a négy hívóhely ellenőrizve. ⚠️ A „csak az első N fotó kap ítéletet" rés zárva: `HERO_SCORE_CAP = 24` a KISZÁLLÍTOTT halmazhoz (`PORTAL_PHOTO_CAP`) igazodik, nem a hero élmezőnyéhez — a nem-nézett kép nem semleges, hanem SZŰRETLEN.
   - **Enforce NOW:** a generált mock demo-framinget hordoz (lábléc-jelölés jelen; nincs „hivatalos oldal"/owner-tulajdon állítás) → determinisztikus check a generált HTML-en + a jog/provenance-őr review-ja.
   - **Enforce NOW (konverziós asset-kapu):** élesítéskor (nyilvános go-live, ADR-0014) a nem-owner képre kötelező (a) a fizetési kapuban rögzített **jogi önnyilatkozat** (`order_intent.photo_rights_declared_at` + a nyilatkozat SZÖVEGE `photo_rights_text`-ben, bizonyítékként megőrizve), VAGY (b) csere owner-assetre. Nyilatkozat megléte esetén a demó-képek **maradnak** (§A.1 következmény). Feltétlen kizárás: vízjeles. A **privát `provisioned` előnézet** (fizetés/nyilatkozat ELŐTT) még demó-fázisú → ott a demó-kép mindig megengedett.
   - ⛔ **LEZÁRT KÉRDÉS — nem újranyitható (tulajdonosi rendelet, 2026-08-20).** A fenti fotó-jogállási szabály **üzleti/jogi döntés, a tulajdonos hatásköre**. Az AI-asszisztens ebben **nem nyilatkozik, nem mérlegel, nem javasol alternatívát, és nem nyitja újra** — sem „ToS-kockázat", sem „biztonságosabb út" címén. A feladat kizárólag a szabály HŰ implementálása. Ha az implementáció során tényszerű ELTÉRÉST észlel a kód és e szabály között, azt jelenti — de a szabályt nem vitatja.

## §B — Dizájn
4. **NINCS emoji-ikon.** Csak saját SVG-sprite ikon (`currentColor`, stroke).
5. Minden generált oldalon KÖTELEZŐ a `Property.unique` szekció valós, megkülönböztető adattal — generikus töltelék TILOS.
6. A paletta a szállás SAJÁT fotóiból jön (analyze), nem fix sablon-szín. ⚠️ De a fotó-akcent NEM nyersen kerül be: csak a HUE jön a fotóból, a luminanciát a skin saját akcentjének WCAG-luminanciájához igazítjuk (bináris keresés HSL-lightness-en, `harmonizeAccent`, `src/engine/palette.ts`) → a skin világos/sötét karaktere és kontraszt-garanciái sértetlenek (a dark-luxury sosem világosodik ki), egyetlen token cserélődik (`--cit-accent`). Determinisztikus → a `mock=live` megmarad; érvénytelen HEX vagy kontraszt-bukás → skin-akcent fallback (nincs regresszió). ⚠️ A kódban rögzített PADLÓ `MIN_CONTRAST = 3.0` (`palette.ts`), NEM a memóriákban emlegetett „≥6" — a 6 az ÉSZLELT eredmény (a harmonizált akcent a kézzel hangolt skin-akcent luminanciáját örökli), a 3.0 az a küszöb, ami alatt visszaáll a fallback. Számot ide csak a kódból írj.

6b. **A MÉRET nem a TARTALOM — a nyitókép választása nem lehet proxy-metrikán.** Évekig a legnagyobb pixelméretű fotó lett a hero (`generate.ts` best-first → minden sablon `photos[0]`), mert a méret volt az egyetlen ingyen kéznél lévő jel. Mérve: a Farkas apartman heroja **fürdőszoba**, a Berta Apartmanházé a portál **fejléc-grafikája**; 35 leadből **16-nál (46%)** a méret-rendezés nem a portál saját galéria-sorrendjének első képét emelte előre. **A portál galéria-SORRENDJE a tulaj borító-választása** — ingyenes jel, amit a méret-rendezés minden körben felülírt.
   - A ma élő szabály (ADR-0115/0116): ① portál galéria-sorrend, ② vision-pontszám (0–100 + tárgy-kategória), **fotó-URL-re cache-elve** (`photo_hero_score`, migráció 0060), ③ `NEVER_HERO` strukturális plafon. A cache `model` mezője **prompt-verziót is hordoz** (`PROMPT_VERSION`) — bővülő kategória-listánál a régi ítéletek különben beragadnának.
   - **Ha egy döntés proxy-metrikán ül, MÉRD MEG a különbséget** a proxy és a valódi cél között valós adaton, mielőtt megvédenéd. A szám dönt, nem az intuíció.
   - **Az operátori felülbírálat VISSZAVONÁSA nem „hagyd, ahogy van".** Az előző választás a mentett `siteData.photos` SORRENDJÉT is átírta (a pillanatképben a sorrend maga az adat), ezért a jelölés törlése némán semmit nem csinált, miközben a sáv „visszaállt"-at írt. Ha egy művelet a KANONIKUS állapotot mutálja, a visszavonása = a **SZABÁLY újrafuttatása**, nem a jelölés törlése. (`src/generator/heroOverride.ts`, migráció 0061.)

6c. **Térköz-ritmus — nincs holt függőleges sáv (ADR-0012).** A generált oldal reszponzív ritmust tart: `padding-block: clamp()` (nincs fix 6rem+), a NON-hero szekció magassága a tartalmat kövesse (csak a hero teljes-magasságú), belső rés ≤ ~2,5rem, ~85% kitöltés-cél. A „lágy airiness" (szekció-magasság − tartalom-kiterjedés = holt sáv, mobilon jellemző) mérve: `src/generator/qaAiriness.ts` (`auditAiriness`, render-alapú, tag-agnosztikus sáv-detektálás) → `airinessDeadPct` az artifactba. ⚠️ **A mérés MA best-effort és NEM blokkol** (`src/generator/generate.ts`: 22% fölött csak `⚠️ levegős` konzol-flag, headless-hiba esetén kihagyva; `scripts/qa-airiness.ts` a kézi futtató). A célzott regenerálás NINCS megépítve — ne hivatkozz rá kapuként. Ha kapuvá tesszük: célzott regen, NEM vak runtime CSS-felülírás és NEM auto-regen.

6d. **Minőség-mérce (wow) — a kraft adat-független, kötelezően maximum.** MINDEN generált mockot a repóbeli referencia-mércéhez hasonlítunk (`assets/design-refs/reference-quality/` + `README.md` kraft-standard; screenshot: `npx tsx scripts/engine-shot.ts <fájl> --width=1440`). Kraft-standard: immerzív 100svh hero (full-bleed kép + scrim + eyebrow + óriás display-cím + CTA) · szerif-display + sans body · **prominens** foglaló/érdeklődés-sáv (üveg/dock/sticky, sosem árva) · gazdag szekciók (sticky nav · szoba-kártyák · amenity-rács SVG-ikonokkal · vélemény-sáv · GYIK · térkép · gazdag lábléc) · szekció-padding 90–110px · hover/reveal. ⚠️ **A fő csapda: a ROSSZ TENGELY optimalizálása** — a wow-t a **gazdag kézműves szekció-készlet** adja, NEM egy vékony primitív-váz kombinatorikája (skin×archetípus×variáns). A kraft **adat-független** → azonnal mehet; a gazdag szekciók adat-fedezetére a §B.17 fázis-kapu vonatkozik (mock: jelölt minta; live: valós adat).

6e. **(adat-kezelés) Nem törlünk, olvasáskor ítélünk — a szűrő legyen auditálható.** Egy pipeline-szűrő SOHA ne dobja el némán a jelöltet: az elvetett sor (kontakt-jelölt, portál-fotó) BENNE marad az adatban, az elvetés INDOKÁVAL. Ok: (1) az operátor nem tudja megkülönböztetni a „nem találtunk semmit"-et a „találtunk hármat és a jót dobtuk el"-től; (2) a „melyik forrás jobb?" csak MÉRÉSSEL dönthető el, ahhoz az elvetett sorok is kellenek. Egy szigorúbb szűrő nem törölheti a már használt adatot; a `firstSeen` sosem íródik felül. A védelem nem a szigorúbb szabály, hanem a LÁTHATÓSÁG. (Alkalmazás: kontakt-főkönyv `src/scraper/contactLedger.ts`; portál-fotó minőség `src/scraper/sources/portals/photoQuality.ts` — a méret a fájl FEJLÉCÉBŐL, a lemérhetetlen kép MEGMARAD.)

7. `review` csak VALÓS, szó szerinti vendégvéleménnyel tölthető ki (kitalált nem; a `SAMPLE_REVIEWS` fabrikált idézetek kivezetve). **A Google/Places vélemény SZÖVEGE nem tárolható és nem jeleníthető meg** — a Places-feltételek egyetlen korlátlanul megőrizhető mezője a `place_id` (`src/reviews/placeRating.ts`: „the place_id we are allowed to keep"), a futásidejű szöveg-lehívás ~$25/1000 → a modul veszteséges. A vélemény SZÖVEGE tehát first-party (a mi oldalunkon hagyott). **A SZÁM (★-átlag + értékelés-szám) más kategória: TÉNY, nem szerzői mű → megjeleníthető**, két kapu mögött: `match_confidence ≥ 0,7` (`MIN_CONFIDENCE`) — fals párosításnál a SZOMSZÉD csillagai mennének ki (§F.17b/§B.17) — ÉS 30 napos frissesség (`MAX_AGE_DAYS`). ⚠️ Amit NEM ígérünk: csillagos rich-result a találati listában — a moderált first-party vélemény sem ad rá jogosultságot (ADR-0046).
17. **Tényhűség — sosem fabrikálunk tényt.** Ár, szoba, m², értékelés, NTAK-szám és minden hard adat CSAK valós forrásból. Ismeretlen adat → a szekció **kihagyva**, NEM naiv fill. Elv: „bizonytalanság → kevesebb, sosem hamis." (Az AI szabad a SZERKEZETEN, kötött a TÉNYEKEN.)

   **Enforce-olható kontraktus** (a tényhűség-őr erre horgonyoz — nem a hangulatra):
   - **HARD tény (verifikálandó):** szám vagy ellenőrizhető állítás — ár, m², szoba/kapacitás, ★/értékelés + értékelés-szám, évszám, NTAK/nyilvántartási szám, díj/minősítés, konkrét távolság („200 m a strandtól"), cím, telefon, e-mail, nyitvatartás. **SOFT tartalom (szabad):** hangulat, jelző, elrendezés, paletta, hívogató szöveg.
   - **Igazságforrás — az EGYETLEN megengedett bemenet HARD tényhez:** (a) a scraper strukturált mezői: `QualifiedLead` (`name`, `address`, `phone`, `email`, `website`, `lat/lon`, `photoCount`, `matchConfidence`, `material`), `WebsiteAssessment`, `RawLead`; VAGY (b) a briefnek átadott fotókon **EGYÉRTELMŰEN LÁTHATÓ** jellemző (image-grounded). Más semmi.
   - **Tiltott kimenet:** (1) bármely HARD tény, ami sem strukturált mezőből, sem látható képi jellemzőből nem vezethető le (LLM-becsempészés a `GeneratedBrief.intro/highlights/tagline` szabad szövegébe — ma ez az EGYETLEN valós szivárgási pont, mert strukturált ár/m²/szoba mező még nincs); (2) ismeretlen mező „naiv" kitöltése hihető értékkel; (3) generikus töltelék a `unique` mag helyén; (4) `matchConfidence` low sávú lead fotó-/jellemző-tulajdonítása (lásd §F.17b).
   - **Bizonyíték-kötelezettség:** minden kiadott HARD ténynek visszavezethetőnek kell lennie egy forrás-mezőre VAGY „image#N látható" jelölésre. Nincs bizonyíték → a tény/szekció **KIMARAD** (nem puhítjuk, nem tippeljük).
   - **Ellenőrzés (őr-eljárás):** a generált copyból (`GeneratedBrief.intro/highlights/tagline`) kiemeljük a HARD-tény-jelölteket (számok, ★, felső fok konkrét állítással, nevesített amenity/díj) → mindegyikhez forrás-mező- vagy kép-illesztést keresünk → illesztetlen = sértés → a szekció eldobva vagy a lead flag-elve.
   - **A grounding-fotó FELBONTÁSA tényhűség-tengely, nem költség-tengely (ADR-0085).** A modell HARD tényt olvas a képről (image-grounded ág), és a felbontás csökkentése MÉRTEN fabrikációt/kihagyást okoz: ugyanaz a „légkondicionált" állítás teljes felbontáson 3/3 helyes, 1024px-en 0/3 (+egyszer „ventilátoros szobák" fabrikálva). Ezért a grounding-pixelek maradnak; kicsinyítés CSAK akkor indokolt, ha az alternatíva a fotó teljes ELEJTÉSE (>3 MB inline-korlát → nyers URL = Cloudflare-blokk = elveszett grounding). „§B.17 > költség." Igazságforrás: `src/generator/images.ts` — a `shrinkForVision` CSAK a `raw.length > MAX_INLINE_BYTES` (3 000 000) ágon fut, a `VISION_MAX_EDGE` a normál grounding-fotót nem érinti.
   - **Cross-site kép = idegen kreatív, nem a szállás fotója — ELVETENDŐ (ADR-0096 ④).** A listázó oldal HOSZTJÁTÓL eltérő domainen tárolt kép (reklám-banner, kampány-kreatív) NEM lehet a mock fotója/heroja, MÉG vouch-olt/hitelesített adatlapról sem (mért eset: `balaton.hu`-hosztolt Mirabella-camping banner egy másik szállás adatlapján). Igazságforrás a listázó host (`site2()` összevetés, `src/scraper/sources/portals/photoQuality.ts`); a hoszt-lista átmeneti réteg ezen a szinten, tartós helye a platform-registry. Ikertétele a §A idegen-hirdetés kizárása — ott a VISION ítél, itt a HOSZT.
   - **Az adathiányos ág NE legyen csendes átengedés.** Minden őrnél, aminek van „ha van adat / ha nincs adat" ága: a nincs-adat ág a VAK ág, épp ahol a kimenet a legrosszabb (kevesebb tény = több hely a tölteléknek). Tedd fel legalább a leggyengébb kérdést (nevez-e meg BÁRMIT, ami a felhasználónak érték?), és bukj rá; az INDOKLÁS mutasson az adathiányra, de a verdikt akkor is bukás. Kié a hiba (scrape vs szövegírás), az nem változtat azon, hogy kimehet-e. Kapcsolódó enforce: a `factVerdict="error"` is BLOKKOLJA a küldést mindkét csatornán — ellenőrizetlen ≠ küldhető (`src/outreach/sendBatch.ts`, `src/outreach/sendOutreachSms.ts`; a blokkoló lista: `designVerdict`, `demoFraming`, `factVerdict`, `marketVerdict`).
   - **⚠️ Fázis-határ — minta-modul az előnézetben (ADR-0015):** a fenti tiltás a HARD tény **valósként való feltüntetésére** vonatkozik. Külön eset a **modul-KONFIGURÁTOR keretezett, fizetés-ELŐTTI előnézete**: ott egy adat nélküli modul **reprezentatív/minta-állapottal MEGmutatható** — a *sales* megköveteli (láthatatlan modult nem lehet eladni). Feltétel: **félreérthetetlen minta-jelölés** (pl. „minta — így néz ki, ha lesz X"), a demó-fotókkal azonos demo-framing logika. **KŐBE VÉSVE:** minta-tartalom a **nyilvános ÉLŐ oldalra SOHA** nem másolódik át adat-fedezet nélkül — vétel *enged*, valós adat (vagy a tulaj admin-feltöltése) *tölt*. Az élő oldal marad teljesen adat-kapuzott (17. pont).

   **Enforce-olható — dizajn-doktrína** (a dizájn-őr determinisztikusan ellenőrzi a generált HTML-en; részletes kontraktus: [06-UI-CONTRACT.md](06-UI-CONTRACT.md)):
   - **Emoji-tilalom (§B.4):** a HTML-ben NINCS emoji (`\p{Extended_Pictographic}`) — ikon KIZÁRÓLAG inline SVG.
   - **Téma-token kontraktus (06-UI-CONTRACT A):** a `:root` KÖTELEZŐEN kiadja mind a 11 tokent (`--cit-accent`, `--cit-on-accent`, `--cit-ink`, `--cit-muted`, `--cit-bg`, `--cit-surface`, `--cit-line`, `--cit-radius`, `--cit-font-display`, `--cit-font-body`, `--cit-shadow`). Hiányzó token = sértés (a widgetek nem öltöznek fel).
   - **Modul-horog (06-UI-CONTRACT B):** a GERINC érdeklődés-CTA jelen (`data-cit-module="booking"`); a modul-slotok stabil `data-cit-module` horgot viselnek.

17c. **⛔⛔ A tényhűség MAGUNKRA IS ÁLL — nem csak a generált tartalomra.** A §B.17 alanya
   nem a mock, hanem MINDEN állítás, amit a rendszer kiad: a saját felületünk, a levélszövegünk,
   az audit-naplónk, a kód nevei és az ígéreteink. Hét mért eset ugyanebből a családból:
   - **Paraméter csak FORRÁSSAL helyes.** A `CUSTOM_DOMAIN_YEARLY = 6900` placeholder volt
     („owner sets it"), mégis a vevő képernyőjére, a rendelésbe és a számlába sétált — mert a
     NEVE (`custom_domain_yearly`, „Domain díja (1 év)") hitelesnek látszott. Pénz-paramétert
     addig nem szabad helyesnek nyilvánítani, amíg meg nem található, KI és MIKOR mondta ki
     (`git log -S`, session-átiratok). Ha nincs ilyen: **nyitott kérdés**, nem „meglévő beállítás".
   - **Modellváltáskor NEVEZD ÁT, ne csak értékeld át** (`custom_domain_yearly` →
     `custom_domain_monthly`, `domain_free_min_monthly` → `domain_min_package_monthly`). Egy
     „free min" nevű oszlop, ami már nem ad semmit ingyen, a következő félreértés magja.
   - **A felület nem állíthat olyan mellékhatást, ami nem történik.** A leiratkozott ágon a
     követett jogi lábazat azt állította, „a megtekintés adatai rögzülnek" — azon az úton nem
     mérünk. Külön, opted-out lábazat jár (§C).
   - **Nem ígérhetünk meg nem épített funkciót.** „Csapatunk újraindítja" addig hazugság, amíg
     nincs, ami újraindítsa (ADR-0118); a felület nem ígérhet visszautalást, amíg 0 refund-ág
     van megírva (mérve) — akkor sem, ha a szolgáltatónak VAN refund-API-ja.
   - **Üres állapot > fabrikált sor.** Az audit-napló (`prospect_optout_log`) a bekapcsolás
     napjától él; visszamenőleges „actor" egy jogi bizonyítékban rosszabb az üres doboznál.
   - **A kód KOMMENTJE is állítás.** A „cheapest-first" kommentű függvény csökkenő ár szerint
     válogatott, és 220 Ft/hó-val többet adott el, láthatatlanul.
   - **Leltár/státusz-sor nem mérés, hanem egy régi mérés emléke.** Ami olcsó csak-olvasó úton
     ÚJRAMÉRHETŐ, azt ne idézd — 4 állításból 3 elavult volt 3 nap alatt. Dátum nélküli állítás
     státusz-jelentésben hazugság-gyanús.

18. **Nyelvi-csomag doktrína (ADR-0036) — a nyelv PARAMÉTER, a felirat SOHA nem beégetett.**
   Minden VEVŐ-oldali felület (sablon, widget, konfigurátor, fizetőoldal, e-mail-váz) a feliratait
   **nyelvi csomagból olvassa** — szerver-oldalon `T(d, "…")` (templateKit), kliens-oldalon `tr("…")`
   (CIT_I18N / manifest-i18n). A kulcs maga a magyar forrás-string; a katalógust az extractor
   (`scripts/extract-i18n.mts`) gyűjti, a csomagot az `ensureLanguagePack` provisionálja (AI-fordítás
   egyszer nyelvenként, placeholder-őrzéssel, `language_pack` tábla).
   - **ÚJ felület/felirat CSAK burkolva születhet** — beégetett vevő-felirat = doktrína-sértés,
     mert némán magyar marad egy lengyel oldalon.
   - A per-lead AI-szövegek (brief/copywriter) a cél-nyelvet paraméterként kapják — ott nincs csomag.
   - **A nyelv FORRÁSA felületenként eltér** (nem `hu`-alapértelmezés, ADR-0067): vevő-oldal +
     VENDÉG-levelek → a SITE nyelve; lead-/outreach-levél → a MOCKja nyelve; tenant-admin → a
     site nyelve; **belső operátor-konzol → az EMBER fiókja** (`operator_user.lang`, migráció
     0037; olvasó: `consoleLang()`, `src/console/i18nCtx.ts`), NEM a piacé. Jogi szöveg és a
     számla-BIZONYLAT tétele KIVÉTEL (§H.22 / §K).
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

19b. **⛔⛔ ÁR-IGAZSÁG a saját felületeinken — a képernyő ne zsugorítson és ne döntsön helyette
   (tulaj-rendeletek, 2026-09-08/11/12).** Ez NEM a 17c: ott az állítás HAMIS volt, itt IGAZ,
   de HIÁNYOS — a felület kevesebbet mondott, vagy helyette döntött.
   - **A lap legnagyobb száma = amit a vevő FIZET.** Ha egy tétel nem fér bele, akkor sem
     lóghat a totálon KÍVÜL: legyen bontás („ebből …"), ne kiegészítés („+ …"). Mérve: a vevő
     6 430 Ft-ot fizetett és 5 430-at olvasott a lap legnagyobb betűivel — a tulaj ebből
     „extrázott csomag az alapcsomag ára alatt"-ot olvasott ki.
   - **Egyszeri összeg mellé KÖTELEZŐ odaírni, mi jön utána.** Egy „/hó" felirat alatti akciós
     ár állítás a jövőről. Helyes alak: „Most fizetendő" fejléc + áthúzott későbbi teljes díj +
     „Egyszeri kedvezmény — utána {X} / hó a díj."
   - **Egykattintásos „segítség" ne változtasson azon, MIT vesz a vevő**, hacsak tételesen meg
     nem nevezi. Ha mégis választ helyette, a **legolcsóbb elegendő** halmazt válassza. (A
     „Bekapcsolom (+2 370 Ft/hó)" gomb 3 modult tett a kosárba megnevezés nélkül, csökkenő ár
     szerint — 220 Ft/hó-val többet adott el, mint amennyi a küszöbhöz kellett.)
   - **EGY képernyőn EGY igazság lehet egy számról.** Két másolat közül az egyik mindig lemarad
     egy feltétellel, és a felület nem hibát ad, hanem KÉT egyformán magabiztos számot
     (mérve: 60 700 vs 53 800 Ft egy lapon). A definíció EGYETLEN exportált függvény
     (`isBilledModule`, `src/tenant/modules.ts`; hívói `src/server/adminViews.ts` +
     `src/tenant/subscriptionAdmin.ts`), és ⚠️ **az ÉRTÉK egy forrásra kötése NEM elég, ha a
     PREDIKÁTUM duplán marad** — a periódus-feltétel duplikációja tízszeres eltérést adott
     (5 570 vs 55 700). Az érték és a rá vonatkozó feltétel EGYÜTT egy szabály.
   - **Döntés ELŐTT a megmutatás legyen TELJES.** Visszafordíthatatlan lépés előtt (kiküldés,
     fizetés) rögzített magasságú előnézet csak akkor, ha bizonyítottan elfér. A csonkolás
     mindig a VÉGÉT veszi el — ott pedig a jogi rész áll (aláírás, leiratkozó-link, jogalap):
     mérve 560px keret vs. 785/1056px levél, görgetősáv nélkül. A fail-safe irány: a beégetett
     méret nagyvonalú **PADLÓ**, amit a JS lefelé igazít.

## §C — Outreach (jog)
8. Hideg megkeresés = célzott, személyre szabott, **leiratkozható** (nem tömeg-spam). GDPR/Grt.-tudatos.
9. Külön küldő-domain + SPF/DKIM/DMARC (deliverability), a fő domain égetése tilos.

   **Enforce-olható kontraktus** (a jog/provenance-őr erre horgonyoz — FÁZIS-kötött):
   - **Minden kiküldött hideg megkeresés KÖTELEZŐ elemei:** (1) működő, egy-kattintásos **leiratkozó-link**; (2) azonosítható, valós **feladó-identitás** (ki ír, milyen jogalapon — Grt. jogos érdek + GDPR-tájékoztatás elérhető); (3) **személyre szabott** tartalom (a konkrét lead adatára/mockjára hivatkozik — NEM azonos tömeg-szöveg); (4) nem félrevezető tárgy/feladó (nem tettet létező kapcsolatot). A küldés külön domainről, SPF/DKIM/DMARC-kal.
   - **A KÖTELEZŐK HORDOZÓJA csatornánként más (ADR-0112, tulajdonosi döntés 2026-09-08).** A négy elem a MEGKERESÉS EGÉSZÉBEN kötelező, nem feltétlenül az üzenet-szövegben: a levélben (1)+(2) a levél testében van, a MOBIL úton (MMS+SMS pár) a szöveg meghívás, és (1)+(2) a linkelt előnézet-oldal lábazatában él. Amit ez KÖT:
     - a szövegben MARAD (3) a lead neve **prózában** és (4) a terv-keretezés — ⛔ a linkben lévő olvasható slug és a saját domainünk NEM számít bele (a kapu a prózán mér, nem a nyers szövegen; 2026-09-08-án mérve egy névtelen tömeg-szöveg PASS-t kapott az URL-je miatt);
     - a link a kötelezők EGYETLEN hordozója, ezért elérhetetlen/hiányzó link = kiút nélküli megkeresés → küldés-tiltó;
     - a hordozó oldalnak a **megkeresés** jogalapját is ki kell mondania (a „megtekintés adatai rögzülnek" a TRACKING jogalapja — nem ugyanaz), és meg kell neveznie a hirdetőt;
     - a hiba-ágak (hiányzó mock-fájl, 404) is viszik a lábazatot, amíg a token érvényes;
     - **A LEIRATKOZÁS PUSH-TILALOM, NEM KIZÁRÁS (tulajdonosi döntés, 2026-09-08):** a leiratkozott ember a kapott linket megnyithatja, a tervet megnézheti és meg is rendelheti — de ezen az úton NEM mérünk (nincs `recordView`, nincs esemény-beacon) és NEM nyomunk (nem keletkezik és nem jelenik meg ajánlat, nincs utókövetés). ⛔ A lap ilyenkor nem viselheti a követett lábazatot: az azt állítja, hogy rögzítjük a megtekintést — §B.17 magunkra is áll.
     - **A KIÚT ÚTVONALA (tulajdonosi döntés, 2026-09-08 — nem újratárgyalandó):** a mobil úton a leiratkozás **a mért oldal megnyitásával** történik, a link az oldal **legalján**. A §C.1 „egy-kattintásos" követelménye tehát a levél-úton betű szerint, a mobil-úton EZEN AZ ÚTON teljesül. Vállalt következmény: a leiratkozás-szándékú megnyitás is beleszámít az ADR-0088 §4 hármas küszöbébe (a harmadikra jár a −50% ajánlat); további küldést ez nem eredményez, mert a leiratkozás után a suppression zár.
     - **A TÖRÖTT PÁR MAGÁTÓL HELYREÁLL (ADR-0112, tulajdonosi rendelet):** ha az MMS kiment és a kísérő SMS nem, a címzettnél kiút nélküli reklám-kép marad — ezért ① a pár EL SEM INDULHAT, ha kevesebb mint 60 perc van a küldési ablak végéig (az MMS visszavonhatatlan, éjjel pedig nem javítunk), ② percenkénti automata újraküldés backoff-fal, ahol az „ablak zárva"/„modem foglalt" NEM használ el próbálkozást, ③ a sorozat végén EGYSZER riasztás az operátornak SMS-ben ÉS e-mailben. Időközbeni leiratkozás LEZÁRJA a párt (a kiút megvan). ⚠️ A STOP-válasz feldolgozása továbbra sem létezik.
     - **A FELADÓ-AZONOSÍTÁST A KONFIGURÁCIÓN MÉRJÜK, NEM A SZAVAKON (ADR-0130, 2026-09-13 mérve):** a kiküldött levél lábazata azt mondta magáról, hogy „**(nem valódi)**", és a kapu zöld PASS-t adott rá — mert minden §C.2 szabály a SZÖVEGET mérte, a szöveg pedig pontosan azt írta, amit a config diktált. A kapu ezért mezőnként méri a ténylegesen KINYOMTATOTT azonosító-értékeket: ① kitöltött-e, ② **valódi alakú-e** (adószám ellenőrző számjegy, nyilvántartási szám-alak, szabvány szerint FENNTARTOTT levél-domain — RFC 2606/6761, megjegyzést viselő bejegyzett név), ③ nem a `.env.example` minta-értéke. ⛔ **Szó-feketelista tilos** (kétszer sült el helyes értékre: `xXx` token, valós adószám) — a kérdés nem az, hogy „teszt-szagú-e", hanem hogy **lehet-e valódi**. A lelet STRUKTURÁLT (melyik env, mit nyomtatna a levél, mit mért a kapu). A hamis FLAG ugyanolyan bukás, mint a hamis PASS, ezért az ÉLES konfig-értékek pozitív esetként ki vannak tűzve az önteszten.
     - **⛔⛔ MINDEN outreach-garancia ALANYA az EMBER, nem a rekord (ADR-0122/0123).** A rekord a
       mi könyvelésünk belügye; a címzett akkor is EGY ember, ha nálunk két sorban szerepel.
       Következmények, mind mérve:
       - **Suppression személy-szintű**: bármely sor ugyanazzal a (normalizált) címmel vagy
         számmal + opt-out → tilt (`isEmailSuppressed` / `isPhoneSuppressed`,
         `src/outreach/sendBatch.ts`). Ez élesben HELYES viselkedés, nem hiba. ⚠️ Következmény a
         teszt-parkra: a teszt-leadek a tulaj saját adatait hordozzák, ezért **egyetlen kattintás
         lezárhatja az egész parkot** — ha „mindenkinél leiratkozott van", ne a kódot keresd
         először, hanem számold meg, hány sor van ténylegesen leiratkozva.
       - **Egy-lövés CÍM-szinten, nem sor-szinten**: a `WHERE stamp IS NULL` két külön soron
         mindkettőt átengedi, READ COMMITTED alatt két párhuzamos küldő is szabadnak olvassa →
         a claim a normalizált címre vett `pg_advisory_xact_lock(hashtext(addressKey))`-ban fut,
         és a küldhető LISTA is címenként EGY sort kínál.
       - **Illesztés normalizált alakon, az ÖSSZEHASONLÍTÁSNÁL is** (`normalizeEmail`,
         `src/email/address.ts`), ne csak íráskor. ⚠️ A nyers egyenlőség évekig VÉLETLENÜL
         tartott: minden scraper-út kisbetűsít, ezért 397/397 cím kanonikus volt — **az adat a
         hibát ki sem tudta fejezni**. A lyuk a KEZELŐ ÁLTAL GÉPELT mező volt. Ahol két tévedés
         ára eltér (túl-illesztés = egy elmaradt hideg levél; alul-illesztés = jogsértés), az
         olcsóbb hiba felé kell dönteni. ⛔ De a hatókört KI KELL MONDANI: nincs plus-alcímzés-
         és nincs Gmail-pont-összevonás — az harmadik fél postafiók-szemantikájáról szóló, nem
         mért állítás (a pont a Gmailen kívül MÁS embert tiltana). Az őr negatív állítással pinezi.
       - **A VISSZAVONÁS annyira érjen el, amennyire a tiltás — de egy tapodtat sem tovább.**
         Cím-szintű tiltás + egy sort mozdító visszavonás = a felület azt írja, „újra küldhető",
         miközben a küldés tiltott marad (élőben mérve: `ok:true` + `isEmailSuppressed → true`).
         Oldd fel az összes sort, amit a tiltás OLVAS, mindet naplózva, majd **mérd újra** a valódi
         predikátumokat — és ha más kulcs (telefon) még tilt, NEVEZD MEG, ne oldd fel csendben.
         A túl-visszavonás a veszélyes irány.
       - **A szabály és amit a képernyő mond róla, UGYANAZ legyen.** A tiltást a kártya a
         KATTINTÁS ELŐTT mondja ki, ne a visszautasító sávban — különben az operátor egy
         „nem vonható vissza" megerősítést nyom le egy HALOTT gombon.
       - **A szabály előtti adat marad.** Az őr TÉNYKÉNT írja ki, mi ment ki kétszer, nem
         bukásként — megtörtént, nem visszavonható.
     - **Ismétlődő kártyás megbízás = pecsételt hozzájárulás + visszavonhatóság (ADR-0088 ⑨).**
       Automata, ismétlődő kártyaterhelés (MIT) CSAK explicit, PECSÉTELT vevő-hozzájárulással
       indítható (ÁSZF-verzió + checkout-hozzájárulás rögzítve: `order_intent.recurring_consent_at`
       / `recurring_consent_text`, a szöveg `RECURRING_MANDATE_V1`, `src/legal.ts`), és a vevőnek
       elérhető **kétlépéses visszavonás** kell, ami a tokent **TÖRLI** (`revokeAutoCharge`,
       `src/payment/subscription.ts`) — megtartott token mellett egy későbbi kód újra terhelhetne.
       ⛔ Egykattintásos „bekapcsolás" NEM adható: a kártyaséma a tárolt hitelesítőt 3DS-kihívott,
       VEVŐ-INDÍTOTT fizetéshez köti — a megbízást a következő fizetési link kiegyenlítése adja
       újra. Élesítés-kötés: az ÁSZF-szöveg és az admin-visszavonás EGYÜTT megy ki.
   - **Enforce NOW:** ha bármilyen outreach-drafot (email/SMS szöveg) írunk, a jog/provenance-őr ELŐBB ellenőrzi a fenti 4 elemet + a §A demo-framing állítást (a linkelt mock előzetes terv, nem „a te oldalad kész").
   - **Enforce NOW (küldő-pipeline kapu — MEGÉPÜLT 2026-08-01, újramérve 2026-09-17):** EGYETLEN őrzött küldő-út (`sendOutreachMail`, `src/outreach/sendBatch.ts`) — konzol-gomb + batch + CLI mind ezen konvergál; minden előfeltétel a küldés pillanatában újra fut. A §C ma **KILENC kapu EGYIKE** ezen az úton, ezért a „küldhető" jelvény önmagában nem verdikt: a döntő sornak a művelet SAJÁT predikátumát kell lefuttatnia száraz módban (`sendOutreachMail(id, { dryRun: true, probe: true })`). ⛔ **Suppression SZEMÉLY-szintű** (lásd fent). `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` fejléc nélkül a pipeline nem ad át levelet az adapternek (RFC 8058; `src/email/outreachEmail.ts`, ellenőrzés `sendBatch.ts`). Atomi `created→sent` claim a küldés előtt (nincs duplázás). `SmtpEmailSender` valós (nodemailer, `src/email/sender.ts`; hiányzó `SMTP_URL`/`OUTREACH_FROM` → konstruktorban bukik), lokálban `ReservedRecipientGuard` védi. A korábbi „ma nincs küldő-modul, `smtpUrl` üres" megjegyzés ELAVULT.

## §D — Deploy (a CLAUDE.md §0 tükre)
10. Lokál-először; élesre **VERZIÓ megy, nem fájl-másolat** (ADR-0053): az élesítés egy
    MEGNEVEZETT COMMIT kicsekkolása + a verzió felírva az éles gépre, `bash
    scripts/deploy-prod.sh <commit> [--go]`-val (csak `origin/main`-en lévő commit; dry-run
    alapból). ⛔ A korábbi „csak a módosított fájlokat visszük" szabály FELÜLÍRVA — az termelte,
    hogy az éles 8 különböző dátum fájljaiból összeálló kollázst futtatott, ami egyetlen
    commitban sem létezett és sehol nem lett tesztelve. A diff-before-deploy elve ATTÓL MÉG ÁLL.
    Push-onként ÚJ scope-olt engedély (CLAUDE.md §0.3). Zárás = tételes commit + `scripts/land.sh`;
    a „felküldve" csak az `origin/main` igazolt tartalmazása után mondható ki.
    **Az éles cél ÉL** (Hetzner CX23/Debian13, `/opt/citoviso/app`, `citoviso-public` :4800 /
    `citoviso-console` :4600, ADR-0024 óta) — a „TBD" nem áll.
    - ⚠️ **A zöld deploy nem garantálja, hogy a látogató az újat kapja.** A CDN a statikus
      css/js-t órákig a régivel szolgálja ki (mérve `max-age=14400` = 4 óra, `cf-cache-status:
      HIT`, purge-kulcs nincs a prod `.env`-ben) → a HTML új, a stíluslap régi. Ellenszer:
      tartalom-hasított asset-URL (`?v=<sha1 8 jegy>`, `withAssetVersions`), és CSS/JS-t érintő
      deploy után az **ÉLESEN kiszolgált** fájlt mérd, ne a lokálisat.
    > A kanonikus deploy-doktrína a `CLAUDE.md` §0; ez a pont annak a tükre. Ha a kettő eltér,
    > a `CLAUDE.md` nyer — és ezt a sort kell javítani.

## §E — Üzleti pozicionálás
11. A kommunikáció horga a **booking-jutalék megtakarítása**, nem a honlap ára.
12. A skálázhatóság feltétele az **önkiszolgáló admin** (support ~0). Ha egy feature növeli a per-tenant supportot, az invariáns-sértés.
12b. **A publikus honlap/kommunikáció a VEVŐ hasznáról szól, nem a mi mechanizmusunkról.** A célszemélyt nem érdekli a technikai hátterünk (pipeline, motor, iparág-agnoszticitás, „konfidencia-kapu") — minden szekció vevő-ELŐNYT mutat (több vendég, profi + mobil megjelenés, megtalálhatóság), nem folyamatot. A lap GERINCE a **minta (mock) igénylése** — a személyre szabott előnézet a fő horog. A technikai büszkeség legfeljebb egy halk mondat, nem szekció. Bizalom customer-nyelven („a saját adataidból, a te jóváhagyásoddal, kockázatmentesen"), nem fejlesztő-nyelven.
12c. **Modult CSAK láthatóan adunk el (ADR-0015).** Az entitlement önmagában — vizuális bizonyíték nélkül — NEM konvertál („sosem-látott modulért nem áldoz pénzt senki"). A konverzió szíve a **vizuális modul-konfigurátor + élő előnézet**, nem a provisioning-gerinc (az a rá ülő kereskedelmi réteg). Az adat nélküli modul az előnézetben minta-állapottal MEGmutatható (félreérthetetlen minta-jelöléssel, a demó-fotó-logikával — §B.17 fázis-határ), de az élő oldalra soha adat-fedezet nélkül.

## §F — Saját-honlap detektálás (presence)
13. **A „nincs saját honlap" állítás bizonyítást igényel, nem a hiány feltételezését.** A Google Maps `websiteUri` hiánya NEM bizonyíték — csak azt jelenti, hogy a Maps-profilhoz nincs kötve honlap. A leadet aktívan verifikálni kell (domain-guess + HTTP-proba, kiegészítő web-search a farokra).
14. **Talált honlap CSAK geo/kontextus-egyezéssel érvényes.** Egy domain akkor számít az adott lead saját honlapjának, ha a lekért oldal a márka-magot ÉS a lead **SAJÁT VÁROSÁT** (nem a régió-címkét) is korroborálja — a város **HELYETTESÍTI** a régió-tokeneket, SOHA nem uniózik velük (egy sugaras régió sok települést fog át → az unió fals pozitívot enged; ADR-0043, kódban kimondva: `src/scraper/enrichPresence.ts`). A cím szabad szövege TILOS horgony (a `hungary` token 40/56 leadnél szerepel). Korrobációs rétegek: (a) **márka-a-domainben** (a saját oldal a cégről van elnevezve; köznév és FÖLDRAJZI token nem korroborál), (b) white-label **aldomain-farmok** kizárása (property-név az aldomainben: `x.hungaryhotel.net`), (c) **megosztott-kontakt őr** (egy telefonszám egy üzleté). **Brand-only egyezés = COLLISION, elvetendő** — a cégnév ütközhet másik településen működő, teljesen más vállalkozással (bizonyított: Rózsakő ház/Badacsony ↔ Rózsakő Étterem/Kisvárda). Ez az A4 konfidencia-kapu tükre a presence-rétegben.
14c. **Magyar nevek szabadon flip-elnek — a domain-guess-nek a FORDÍTOTT token-sorrendet is próbálnia kell.** A „típus-szó + tulajdonnév" magyar cégnevek megcserélődhetnek a domainben („Panzió Sissi" ↔ „Sissi Panzió" → a valós domain `panziosissi.hu`, nem `sissipanzio`). Csak a név-sorrendű host-tippelés **fals negatívot** ad (van saját oldala, mégis `no_site`). Ez a §F.14 ikertétele: a 14. a fals POZITÍVot (brand-collision) tiltja, a 14c a fals NEGATÍVot (elmulasztott flip) fogja el. Kód: `candidateHosts` (`src/scraper/enrichPresence.ts`) a reverzált token-sorrendet is generálja.
15. **Parkolt / eladó / builder-placeholder oldal nem saját honlap** („ez a honlap eladó", domain-parking) → `none` marad.
15b. **Portál-besorolás hoszt-CÍMKE szintű, sosem naiv substring.** A domain akkor „portál", ha (a) a hoszt-CÍMKE egyezik egy ismert portál-márkával (`labels.includes(brand)`, ill. `host === d || host.endsWith("." + d)`), VAGY (b) az útvonal katalógus-BEJEGYZÉST tartalmaz (`/szallashelyek/<entry>`). Naiv substring-egyezés HAMIS POZITÍVOT ad: `danubiushotels.com ⊃ "hotels.com"` → a lánc SAJÁT oldala „portál" lett. Fordítva: egy vállalkozás saját `/szallas/` aloldala az Ő tartalma, nem idegen katalógus-bejegyzés — csak konkrét bejegyzés-minta után minősül portálnak. Kód: `isPortalHost` (`src/scraper/qualify.ts`).
16. **Geo-verifikáció nélküli presence-check TILOS élesíteni:** hamis pozitívja jó leadet dob el („van már honlapja"). A naiv guess ezen a mintán 4/4 hamis pozitívot adott.
17b. **Soha ne tulajdoníts fotót vagy jellemzőt ellenőrzött entitás-párosítás nélkül — jobb NINCS fotó, mint téves.** Az A4 match-konfidencia low sávja (⛔) dobja a leadet; a medium sáv kontextuális felülvizsgálatot igényel. (Piroska-eset: valódi 1,0★/27 vs. téves párosítás 4,6★/5 — a rating/vélemény-szám eltérése azonnal flag-elte volna.)

17d. **⛔ A SAJÁT KIMARADÁSUNK nem lelet a rekordról.** Az elérhetetlen adatforrás nem állítás
    az entitásról. Mérve 2026-09-09: a Places napi kvótánk kimerült (429), a `placesLookup`
    `if (!res.ok) return null`-lal néma nullává tette, a route catch-e üres tömbbé, a panel
    pedig ebből azt írta ki, hogy **„Ehhez a leadhez nem találtunk fotót."** — a tulaj a LEADET
    hibáztatta, miközben a lista mellette 10 képet mutatott. Ez a §F.13 általánosítása minden
    külső forrásra:
    - **`null` = „megkérdeztük, nincs találat".** Amit meg sem tudtunk kérdezni, az KÜLÖN TÍPUS
      az okkal (`PlacesUnavailableError` + `quota | auth | network | upstream`), és végigmegy a
      láncon a felületig (`src/scraper/sources/googleMaps.ts`, `enrichPlaces.ts`,
      `src/generator/images.ts`, `generate.ts`). A negatív ágat is tesztelni kell, különben
      minden üres terület „kimaradás" lesz.
    - **RÉSZLEGES kimaradásnál a szöveg is részleges legyen.** „A fotók nem tölthetők be" 14
      látható fotó fölött igaz a Places-re és hamis a képernyőre → ok-fél mondat + két külön
      keret (semmi jött / csak az egyik fél jött).
    - **Tárolt szám ≠ friss hívás.** Ahol két felület ugyanarra a szóra („kép") két külön
      forrást használ (tárolt `material.placesPhotos` vs. élő fizetős hívás), ott a felhasználó
      ellentmondást lát — és ezt a felületnek ki kell mondania.
    - **Két különböző kudarc = két külön mondat.** A „nem ítélt" (nincs vision-verdiktünk) és a
      „nem tölthető be" (404 a forráson) NEM ugyanaz; ha egy elágazás dönt róluk, az olcsóbban
      kiírható lesz a magyarázat, és a kurátor vakon dönt a lap legfontosabb képéről. Ha a hiba
      a KISZÁLLÍTOTT termékre is kihat, azt a felület mondja ki — a néma csonkítás
      „mindent kiszállítottunk"-nak olvasódik (§I.24).

17e. **A régió/keresési CÍMKE egy KERESÉSI TERÜLET, sosem a lead pozíciós ténye — és rétegenként
    újratermelődik.** A sugaras régió (pl. „Balaton északi part", bbox az egész tóra) sok
    települést fog át. A verify-rétegen ez már megoldott (a lead VÁROSA horgonyoz, nem a
    régió-token — §F.14 / ADR-0043); de a COPY-rétegen visszaszivárgott: a sweep-címke
    „északi part"-ként FÖLDRAJZI TÉNYKÉNT került 5 DÉLI parti lead tagline-jába
    (meta/og/JSON-LD/hero). A `region.label`-t TILOS pozíciós állításként a briefnek/
    copywriternek adni; ha kell hely, a lead saját városát add. ⚠️ Determinisztikus kapu erre ma
    NINCS (part-oldal geometriát igényelne) — csak prompt-szabály véd, tehát statisztikus. Ha
    megint előjön: a factCheck kapjon földrajz-ellenőrzést. (§B.17 és §F metszete.)

## §G — Izoláció, jog, ember a hurokban
18. **A Vendég (a tulaj ügyfele) NEM a mi üzleti aktorunk.** Következmény: kötelező **tenant-izoláció** — minden Site vendég-adata (PII) tenantonként elkülönül (RLS + per-tenant titkosítás; prémium: külön séma/DB). A megvalósítás architektúra-döntés, de az izoláció-elv nem alkudható.
19. **Mi legfeljebb technikai adatfeldolgozó vagyunk, NEM adatkezelő a vendég felé.** Agentek a control plane-ben élnek; a **vendég-PII-hez üzletileg nem férnek hozzá** (data plane izolált). Két fizetési sík is elkülönül: Tenant→Citoviso (a mi bevételünk) ↔ Vendég→Tulaj (a tulaj fiókján folyik, nem rajtunk át — jogi tisztaság).
20. **Kivétel-alapú ember a hurokban, amely idővel önmagát vonja vissza.** Az ember SOHA nem a fősodorban áll (az automata), csak a bizonytalan/kockázatos kivételeknél (kuráció, pénzügyi felügyelet, support); a fősodor betanulásával az emberi lefedettség csökken. A kockázat aszimmetrikus (kiküldött hibás mock ≫ visszatartott) → bizonytalanság esetén ember.

## §I — Ígéret ⇔ Szállítás hűség (WYSIWYG a nulladik ponton) — NEM ALKUDHATÓ

23. **⛔⛔ Amit a leadnek MEGAJÁNLUNK, PONTOSAN azt kell megkapnia fizetés után. Az áteresztés (bait-and-switch) a nulladik ponton ABSZOLÚT TILOS — üzletileg öngyilkos ÉS jogilag súlyos (megtévesztő kereskedelmi gyakorlat / Fttv., szerződésszegés).** A kiküldött outreach-mock a fő üzleti horog: ha a lead erre kattint és ezért fizet, akkor az élő (LIVE/TENANT fázisú) oldalnak **vizuálisan és minőségileg legalább ekvivalensnek kell lennie** — nem lehet lebutított/„80%-os" változat. A mock a szerződés vizuális tárgya, nem csali.
    - **Következmény a motorra:** a `mock → live` átmenet NEM ronthatja a minőséget. Ezért a `mock=live` (egy motorból, ADR-0016) az ALAPÉRTELMEZETT út. Ha valaha bespoke/HIBRID utat választunk a horog wow-jáért, az CSAK akkor megengedett, ha az élő oldal ugyanazt a minőséget szállítja (pl. a bespoke-kimenet maga válik szerkeszthető live-vá) — a downgrade-csapda tilos.
    - **A tényhűségtől külön invariáns:** §B.17 arról szól, hogy a mock tartalma ne fabrikáljon tényt; §I arról, hogy a megajánlott FORMA/MINŐSÉG a fizetés után is megmaradjon. A kettő együtt: *igaz tartalom + hű szállítás.*
    - **Enforce:** minden mock→live architektúra-döntésnél kötelező visszamérési pont (a horog-mock és az élő oldal screenshot-ekvivalenciája). Eltérés → invariáns-sértés, nem mehet élesbe.
24. **⛔⛔ A MEGAJÁNLÁS PILLANATÁBAN is áll a hűség: törött képes mock NEM hagyható jóvá és NEM küldhető ki (ADR-0134).** Mérve (2026-09-13, Elek FK-003b L01): a kurátor-lap SAJÁT piros sávja kimondta, hogy „a képek a LEADNEK kiküldött lapon is törötten jelennek meg" — a jóváhagyás mégis akadálytalanul átment, és a felület azonnal felkínálta a követett linket. A 23. pont a *fizetés utáni* szállításról szól; a lyuk a nulladik ponton volt: egy üres kép-helyekkel érkező hideg megkeresés a bizalom azonnali elvesztése.
    - **A mérce a RENDERELT artefaktum** (`mock_artifact.path`), nem a generálás bemeneti fotólistája — a kapu azon az úton mérjen, amin az adat tényleg kimegy.
    - **A mérés a KIKÜLDÉS pillanatában fut**, nem a jóváhagyáskori emlékből: a forrás-portál azóta is elrohaszthatta a TÁROLT URL-t (a hovamenjek.hu átnevezte a fájljait: mérve 73 tárolt URL-ből 59 halott, miközben az adatlapok élnek).
    - **Az ember a hurokban marad (§G.20), de KIMONDOTTAN:** a kurátor tudomásul veheti a törést, a tudomásulvétel azonban NÉVSORRA szól — ami azóta esett ki, arra nem érvényes. A „nincs renderelt lap" eset nem nyugtázható le, azt újra kell generálni.

## §H — Láthatóság, SEO, lokalizáció
21. **A honlap szükséges, de nem elegendő — a generátornak ALAPBÓL felfedezhető (SEO-optimális) oldalt kell gyártania.** Kötelező, automatizált réteg: technikai SEO (sebesség/mobil/sitemap/HTTPS/canonical) + **Schema.org strukturált adat (LocalBusiness/Hotel/Restaurant JSON-LD)** egyenesen a strukturált lead-adatból + meta. GBP-kezelés és Search Console-indexelés tulaj-hozzáférést igényel → konverzió UTÁN. ⚠️ Reális keret: a láthatóság időigényes és nem garantált top-találat — a kontrollálható emelőket optimalizáljuk, nem „#1 helyet ígérünk".
21b. **A tenant-SEO URL-TERMELÉS, és a `*.citoviso.com` hálózat reputációja KÖZÖS vagyon (ADR-0041).**
    (a) Feloldatlan platform-aldomain → **404**, SOHA nem eshet át a marketing-landingre: különben
    bármennyi kitalált aldomain azonos tartalommal 200-at adna (duplikált tartalom / *scaled content
    abuse* az egész hálózaton), ÉS a frissen fizetett tulaj a saját linkjén a MI oldalunkat látná
    (`isUnclaimedTenantHost`, `src/server/public.ts`). Fenntartott labelek (`www/admin/api/mail/app/
    static/assets`), apex és IP-hoszt viselkedése változatlan. (b) Slug→saját domain váltásnál
    KÖTELEZŐ permanens **301 + canonical-átállás** (a rangsor-jelek átvitele; enélkül az upsell
    SEO-büntetés) — kód: `res.writeHead(301, …)` a slug-hoszton, ha él a `custom_domain`.
    ⚠️ Lokálban a 301 szándékosan ki van kapcsolva (a teszt-domain nincs a DNS-ben), élesben fut.
    (c) Nyers, tenantonként azonos program-/tartalom-scrape TILOS = *scaled content abuse*; helyette
    geo-horgonyzott környezet-modul a saját POI-vagyonból (a koordináta tenantonként egyedi ⇒ nem
    duplicate).
22. **Ország-lokalizáció = Nyelv (AI, dinamikus) | Jog+formátum+pénznem (determinisztikus).** A tartalmi/marketing szöveget AI fordítja **kontextus-alapon** (nyelv-független forrás + cache-elt variánsok, NEM hardcoded string-tábla). ⚠️ A **jogi szöveg + formátum + pénznem determinisztikus, ország-szabály-táblából** — SOHA nem fordító-AI-ra bízva. A multilanguage-igény MINDEN felületre kiterjed — nemcsak a generált tenant-Site-okra, hanem a tenant-adminra ÉS a belső operátor-konzolra is (a nyelv FORRÁSA felületenként más, §B.18). **A kód/útvonal/azonosító/DB-mező alapnyelve MINDIG angol** (magyar slug tilos); a megjelenített szöveg lehet magyar.

27. **PIAC-KAPU — a piac kulcsa az ORSZÁG, nem a nyelv (ADR-0111, 2026-09-08).**
   A jogi csomag JOGRENDSZERHEZ tartozik: AT és DE nyelve közös, joga nem — nyelv szerint egy
   megnyitás kettőt nyitna ki. A piac állapota adat (`market` + append-only `market_log`,
   migráció 0057; a `HU` sor `approved`), a döntéshez **kötelező indoklás szerver-oldalon is**,
   az actor a bejelentkezett operátor. Kód: `src/markets.ts` (`isMarketApproved`).
   - **Három FAIL-CLOSED kapu:** ① hideg megkeresés (a verdikt HIÁNYA is tiltás,
     `src/outreach/draft.ts`), ② pay-link kiadása, ③ az élesítés — a `status:"live"` kapcsoló
     ELŐTT, hangos megtagadással (`src/payment/service.ts`).
   - **A MEGÚJULÁS KIVÉTEL.** Egy piac lezárása nem teheti fizetésképtelenné a meglévő
     ügyfelet: a szerződés nyitott piacon jött létre, a visszavonás a JÖVŐRE hat. Zárt piacon is
     átmegy a `renewal` (`oi.kind !== "renewal" && !isMarketApproved(...)`).
   - **Zárt piacon is szabad:** lead-gyűjtés, mock-gyártás, mintaoldal — mert egyik sem ajánlat
     és egyik sem publikál jogi dokumentumot. A kapu az AJÁNLATON és a PUBLIKÁLÁSON ül.
   - ⚠️ A kapu csak a KÉRDÉST teszi fel a megfelelő pillanatban; a jogi csomag TARTALMA
     országonként még nem létezik (`src/legal.ts` ma egy magyar csomagot ismer). A második piac
     megnyitása előtt a szövegeknek ország szerint kell szétválniuk.

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

## §K — Számlázási identitás & bizonylat (ADR-0055)

28. **A számla vevője SOHA nem fabrikálható marketing-adatból.** A Google Maps megjelenítési
    neve NEM jogi név; a `lead.address`-ből regexszel vágott mező NEM számlázási cím; az adószám
    nem hagyható `null`-on. A vevő jogi identitása a fizetés ELŐTT bekért, **explicit
    nyilatkozat** (magánszemély vagy cég, jogi név + cím + adószám), amit az `order_intent`-re
    **immutábilisan** rábélyegzünk — a §A fotó-jog mintája a pénzügyi oldalon: a tényt ÉS az
    elfogadott szöveget megőrizzük.
    - **DB-szinten kényszerítve, nem alkalmazás-logikában:** cég ⇒ adószám kötelező;
      `reverse_charge` (Áfa tv. 37. §) ⇒ cég + közösségi adószám + VIES `valid`. Kód:
      `migrations/0029_order_billing_identity.sql` CHECK-ek, `src/billing/{buyer,taxId}.ts`
      (HU ellenőrzőszám: súlyok 9,7,3,1,9,7,3 — a képlet a 01-CALC-MODELS-ben él).
      Ok: cég adószám nélküli számlát kap → nála költségként elszámolhatatlan, a NAV Online
      Számlában láthatatlan → azonnali sztornó az első pilot-vevőnél.
    - **Egy heurisztika HELYE dönti el, hiba-e.** A `parseHuAddress` tippje SZÁMLA-forrásként
      jogilag törött, checkout-PREFILLKÉNT hasznos (a vevő 2 mp alatt javítja). Ezért a
      számla-útról KIVEZETVE, `src/billing/prefill.ts`-ben él, és a fájl fejléce kimondja, miért
      nem térhet vissza. Döntő kérdés: *ha ez téved, ki veszi észre és mibe kerül?*
    - **Következmény:** minden `0029` ELŐTT kiállított bizonylat fabrikált vevőt hordoz → NEM
      minta a helyes bizonylatra.
29. **A mock bizonylat-provider ugyanazt utasítja el, amit az éles (Számlázz.hu) is.** Enélkül a
    mock engedékenysége elrejti az éles hibát, és a hiba a valós fiókban jelentkezik
    (elszámolhatatlan költségszámla, NAV-láthatatlanság, sztornó-kérés). ⚠️ Élesítés-előfeltétel:
    ÁSZF-dokumentum (`config.termsUrl`) + könyvelői jóváhagyás az EU-s (közösségi adószámos) ágra.

## §L — Egyedi domain & elköteleződés (ADR-0071/0078/0093/0094/0109)

30. **A FIZETÉS a domain-beszerzés triggere — nincs operátori jóváhagyás.** A `handleWebhook`
    `paid` ága indítja a provisioninget (`kind='domain_upgrade'` / `'domain_settlement'`). A
    biztonság a registrar **atomi check-and-register**-jéből jön, nem emberi kapuból (ha időközben
    elkelt, a vétel elhasal, nem veszünk rosszat). A live adapterek **őszinte stubok**: kulcs
    nélkül a konstruktorban dobnak — nincs néma mock-fallback. Kód: `src/domains/provisionDomain.ts`.
31. **A domain a ZÁLOG — átszállás csak maradéktalan rendezés után.** Hűségidő alatt nincs rendes
    felmondás; a korai kilépés kötbért von maga után (a képlet a 01-CALC-MODELS „Domain-kötbér"
    szakaszában, egyetlen olvasó: `settlementQuote()`, `src/domains/domainSettlement.ts` — a
    tenant sosem fizet mást, mint amit látott). A behajtás **önvégrehajtó** (a domain
    visszatartása + előfizetés-freeze), NEM külön jogi lépés. ⛔ A megtartási/kedvezmény-ajánlat
    NEM pótolja a hiányzó kötelmet — szankció nélkül a felület csak ellentmondást szül.
    A csomag-padló (`order_intent.committed_min_monthly`) rendeléskor BEFAGY; a modulváltás
    (`applyModuleChange`) ATOMIAN elutasítja a padló alá csökkentést (`activeDomainCommitment()`,
    `src/domains/domainCommitment.ts`).
32. **Nem ígérünk visszautalást, amit nem építettünk meg.** Sikertelen beszerzésnél nincs
    auto-refund: a tenant másik nevet választ, arra fordítjuk az összeget. A felület ezért NEM
    ígér visszautalást — §B.17c magunkra is áll: nem állítunk olyan képességet, ami nincs. Indok:
    nem képtelenség (a Barionnak van Refund API-ja), hanem **meg-nem-épített funkció**.
33. **Az ár-plafon őr fail-closed.** A `RegistrarAdapter.getYearlyPriceEur` plafon feletti (vagy
    stub-dobó) ára → ajánlat-szűrés (`src/domains/domainAdmin.ts`) + kemény kapu a `register()`
    ELŐTT (`provisionDomain.ts`) és a rendelés felvételénél (`domainUpgrade.ts`); plafon felett
    `failed`, **pénz nem mozog**.

## §M — A tenant-oldal jogi lábazata (ADR-0110)

34. **Adatot GYŰJTŐ élő oldal nem létezhet jogi lábazat nélkül.** Minden élő tenant-Site
    kötelezően viszi: `/adatvedelem` + `/impresszum` a **szállás SAJÁT skinjében**, és egy
    **állandó lábléc jogi sáv** MINDEN lapon (a fizetett nyelvi verziókon is) — ez az egyetlen
    hordozója az impresszum-linknek a template-úton, ezért akkor is megjelenik, ha a tenantnak
    még nincs jogi adata. Hiányzó KÖTELEZŐ mező (Eker. tv. 4. §, vevő-típus szerint) a lapon
    hangosan „— nincs megadva —"; a nem kötelező üres sor egyszerűen nem jelenik meg. Kód:
    `src/engine/legalPages.ts` (`renderLegalStrip` / `withLegalStrip` / `renderTenantLegalPage`),
    `src/tenant/legalIdentity.ts`, migráció `0056_tenant_legal.sql`.
35. **Az űrlap-jogalapok NEM keverhetők.** Foglalás = szerződés-teljesítés (GDPR 6(1)b) →
    MONDAT elég. Vélemény = hozzájárulás (6(1)a) → KÖTELEZŐ PIPA, és a kapu **szerver-oldali**
    (`form.get("consent") !== "1"` → 400, nincs DB-sor; `src/server/public.ts`). A kliens-oldali
    `required` NEM kapu.
36. **A süti-kérdés MÉRÉSHEZ kötött, nem szokáshoz.** Ma NINCS süti-sáv, mert mérve **0 süti**
    (friss profil, teljes végiggörgetés; az `output=embed` Google-térkép sem ír sütit/
    localStorage-ot), a `cit_session`/`cit_op_session` pedig HttpOnly, technikailag szükséges.
    ⛔ Süti-sávot kitenni oda, ahol nincs süti, „cookie-theatre" — hozzájárulást kérünk olyanra,
    ami nem történik, és ELFEDI a valódi hiányt (§B.17c). **Enforce:** tracker-detektor
    (`scripts/tenant-legal-check.mts`) — ha GA/`gtag(`/`fbq(`/matomo/hotjar kerül a motor
    kimenetébe, az őr bukik, és akkor a süti-kérdés is újranyílik.

## §N — Az őr hitelessége (az „Enforce" klauzulák előfeltétele)

> Minden §-unk „Enforce"-klauzulával zárul, tehát az invariánsok betartatása MÁR itt él — **egy
> vak őr pedig nem betartatás, hanem betartatás-LÁTSZAT**, vagyis magának az invariánsnak a
> sérülése. Ezért tartozik ez az ontológiába, nem csak a munkamódba.

37. **Egy vak őr is zöld — ezért minden Enforce-klauzula csak akkor számít, ha az őr bizonyítja,
    hogy tud PIROSRA menni.** Mért hibaminták:
    - **Az őr NE hívja azt, amit vizsgál.** A rendezés-őr a saját `compareSortKeys`-ével mért,
      ezért a visszarontott (ékezet-vak) rendezésre ZÖLD maradt: a mérés és a hiba egyetértett.
      Független referenciával (`new Intl.Collator("hu")`) ugyanaz **5 bukás**. Gyanújel: az őr
      `import`-ja ugyanabból a modulból jön, amit véd.
    - **PIROS ÖNTESZT kötelező**, és a hibát a **TERMÉK** oldalán állítsd elő. ⚠️ Egy mutáció,
      ami nem változtat (nem létező mintára célzott), NEM bizonyít semmit — ezt az önteszt
      jelezze. ⚠️ Több fokozatban futtasd: a `pg_restore --exit-on-error` 50%-os csonkolásra
      bukik, **95 és 99%-osra EXIT 0-t ad, egyező sorszámokkal** — ha az 50%-nál megállsz, azt
      hitted volna, működik a védelem.
    - **A fixture bizonyítsa a SAJÁT ÚTJÁT.** Egy elgépelt kulcs (`templateId` vs `template`)
      miatt 17 sablon × 2 mérés mind UGYANAZT az archetípus-lapot mérte, csupa zölddel. A
      darabszám magabiztosságot ad, lefedettséget nem. ⛔ A fixture ne szögezze le azt a mezőt,
      ami a hibát okozza (`cancelAtPeriodEnd: false` minden soron → a bukó ág sosem futott).
    - **Az őr HATÓKÖRE = a doktrína.** Ami lemarad a fájllistáról, az nem „konvertálatlan",
      hanem **őrizetlen** (ADR-0067/0070). ⚠️ És a fordítottja ugyanolyan vak: az EGÉSZ
      kódbázisban kereső `contract-drift-check` zöld maradt egy szándékos visszarontáson, mert
      a keresett felirat máshol is szerepelt. **Mindenhol keresni = sehol sem keresni.**
    - **Felületi szöveg-szabályhoz RENDERELT réteg kell.** A felület szövegének csak a fele van
      a kódban; a másik fele migrációs seed, DB-sor, operátor által gépelt mező, külső API
      válasza. Mérve: AST-szintű teljes forrás-grep TISZTÁT jelentett, miközben a `/settings`
      lap két ADR-számot mutatott (a `0057_market.sql` INSERT-jéből). A statikus scan a gyors
      iker, nem a döntőbíró — és **mondd ki, melyik réteg mit lát**. Igazold a rétegek
      szükségességét külön-külön negatív próbával: ami semmilyen visszarontásra nem pirul
      egyedül, az a réteg dísz.
    - **PIXEL-verdikt: `elementFromPoint`, nem `display`/`isVisible()`.** A DOM zöld lehet 0
      kifestett pixel mellett (`overflow:auto` ős levágja az abszolút pozicionált leszármazottat
      — a legördülő SOHA nem látszott, miközben `display:block`, nem-üres `getBoundingClientRect`,
      Playwright `isVisible()=true` és a kattintás is NAVIGÁLT). Ugyanez fordítva: az
      `isVisible()` igazat mond egy 12 560px-re elgörgetett elemre is. ⚠️ Rokon csapdák: a
      `[hidden]` **nulla specificitású**, tehát bármely `display:flex/grid` felülírja (a „rejtett"
      elem LÁTSZIK, a képen konzisztensnek tűnve); és a link-alakú gomb megkapja a keretes
      `.con a` (0,1,1) szabály színét a saját `.citui-btn--*` (0,1,0) variánsa ellenére —
      **kontrasztot MÉRJ, ne nézz**.
    - **A mérés ne mozdítsa el, amit mér.** A Playwright `check()`/`click()` actionability
      auto-scrollja az `overflow:hidden` konténert is elgörgeti — egy szándékosan elrontott
      fizetés-sáv (`top:2200px`) emiatt 390px-en ZÖLDRE mért. Láthatóság-mérés előtt nullázd a
      görgetést, és állapotot `page.evaluate()`-tel állíts.
    - **A teszt NEVE nem lefedettség.** Az `ad_banner` fixture a „Mirabella-banner" szóval volt
      zöld, de `portalHost`-ot hazudott — a valós adatban kép-host === portál-host, tehát a
      cross-site szabály **szerkezetileg nem tudott tüzelni**. Ha egy teszt neve szerint lefedi
      az esetet, nézd meg a BEMENŐ ÉRTÉKEIT.
    - **A nulla összehasonlítás nem zöld.** Ha egy oldalt sem sikerült megmérni, az HIBA, nem
      „minden rendben". Hasonlóság-mérőhöz **kalibráló önkontroll** kell (ugyanaz a bemenet
      önmagával = 100%) — egy 24×16-os szürkeárnyalatos aláírás három világos lapon vak volt
      (90,8% → 90,6% egy teljes elrendezés-átírásra).
38. **Mielőtt őrt írsz arra, amit a rendszer csinál, nézd meg, mit KÉRTÉL tőle — és honnan jött
    a BEMENET.** A hero-lead négy körön át volt hangulati töltelék, és két kör ment el az őr
    élesítésével, miközben a prompt ÉS a séma-mező leírása szó szerint „költői, HANGULATI"
    mondatot rendelt a lap legolvasottabb sorába. Prompt-javítás után az ELSŐ generálás jó lett.
    A prompt a KÉRÉS, az őr a háló; rossz kérésre erősebb hálót építeni = a rendszer
    folyamatosan hulladékot gyárt, amit drágán szűrünk ki. Ugyanígy: mielőtt szabályt írsz arra,
    ami a KIMENETEN megjelenik, keresd meg, HONNAN jött az adat — egyszer egy „a telefonszám ne
    legyen benne" szabály egy helyes mechanizmust bénított volna le teszt-adat miatt.

---

> ⚠️ **Számozás.** A pontok történetileg nőttek, ezért a 18/19/20 és a 24 KÉTSZER szerepel
> (§B↔§G, illetve §I↔§J). Az új pontok 27-től folytonosak (§H.27 → §K.28–29 → §L.30–33 →
> §M.34–36 → §N.37–38); ahol a beszúrás egy meglévő pont KÖZVETLEN folytatása, ott betűs alpont
> (`3b`, `6b–6e`, `12b`, `12c`, `14c`, `15b`, `17c`, `17d`, `17e`, `19b`, `21b`) — így nem
> keletkezik ÚJ ütközés: minden címke a fájlban egyedi. ⚠️ A `17b` történetileg a §F-é, ezért a
> §B tényhűség-alpontja `17c`-vel indul, a §F új alpontjai pedig `17d`/`17e` — a betű nem
> jelent sorrendet a §-ok között. Egy teljes átszámozás külön, önálló kör legyen, ne új pontok
> mellékterméke.

> Új invariáns felbukkanásakor ide vedd fel, és linkeld a memóriában.
