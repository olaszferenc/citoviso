## ADR-0462 — Kísérlet-motor a hideg megkereséshez: változat-címke, levélnyitás-mérés pixel nélkül, gépi keret-osztás

**Státusz:** ELFOGADVA a motor és a mérés (tulaj „Ok jó így” 2026-11-21, koordinátor `citb64f0ed0`, brief `kiserlet-motor-20261121.md`); a Riport „Kísérletek” panel §2b-terv-körben, jóváhagyásra vár ·
**Épít:** ADR-0459 (hideg sáv, `coldLinkBase`), ADR-0435 (`open_via`, `?e` jel), ADR-0405 (automata kiküldő), ADR-0322 ③ (nyers UA/referrer nem tárolódik), ADR-0101 (levél-szerkezet, Outlook-őr) ·
**Forrás:** `_planning/OTLETEK-2026-11-20-konverzios-gepezet.md` §0, §2.1, §2.2, §3.

### Kiváltó

A hideg levélnél soha nem volt tárgy-, feladó- vagy törzs-teszt. A „megnyitás” a linkre kattintást
jelentette (`mock_view`), magát a levél megnyitását semmi nem mérte, mert a hős-kép CID-ként
utazott (553 KB/levél). Így a nem-nyitók három csoportja (spam / látta a tárgyat / elolvasta, de nem
kattintott) nem választható szét, és minden szöveg-ötlet tulaj-kör maradt volna, nem gépi döntés.

### Döntés

1. **Változat-katalógus + címke.** `outreach_variant` (0143) dimenziónként: `subject` · `first_line` ·
   `sender` · `body_style` · `image`. Minden dimenzió kontrollja (`is_control`) a MAI levél, szöveg
   nélkül: a kód ugyanazt rendereli, mint eddig. A §3 jelöltjei `enabled=false` állapotban születnek;
   bekapcsolni a koordinátor fog, a tulaj jóváhagyása után. Minden kiment hideg levél dimenziónként
   egy változatot kap, `outreach_send_variant` (prospect × dimenzió), CSAK a sikeres küldés után.
   Részt vesz: magyar levél, nem teszt-lead, nincs tulaj-átírás (`copy_override`). A külföldi levél
   mindig kontroll, címke nélkül (a jelöltek szövege magyar, ADR-0456: idegen levél csak teljesen a
   saját nyelvén).
2. **Levélnyitás pixel nélkül.** A hideg sávon (`coldLaneActive()`) a hős-kép a hideg hostról
   töltődik: `<coldLinkBase>/p/<token>/kep.jpg`, a küldéskor befagyasztott 1120 px-es JPEG
   (`sites/_outreach-shots/mail/<token>.jpg`), így a mock újrarenderelése a postafiókban lévő képet
   nem töri el. Minden lekérés egy `email_open` sor: Gmail képproxy = `open`; Apple Mail előtöltés
   (Apple 17/8 IP, csupasz `Mozilla/5.0`, böngésző-jel nélküli Mac WebKit UA) = `proxy_prefetch`,
   külön számolva; a `mock_view` bot-listája = `bot`. Nyers UA és IP nem tárolódik. A pilot-másolat
   (`?sajat=1`, `markOwnViewLinks`) nem számít. A kép mindig kiszolgálódik. A platform-sáv
   (citoviso.com, vevői levelek) nem változik; konfigurált hideg sáv nélkül (dev) a CID marad.
3. **Gépi keret-osztás (Thompson).** Budapesti naponként egyszer (a kiküldő első tickjén) az őr fut,
   aztán dimenziónként P(legjobb) Beta(link72+1, érett−link72+1) mellett, ahol az elsődleges cél a
   72 órás link-nyitás (`mock_view`, bot nélkül, `open_via='email'`), csak a ≥72 órás levelek
   számítanak. A 24 órás levélnyitás másodlagos, csak a riportban szerepel. Padló: minden
   engedélyezett változat ≥10% (vízfeltöltés; ha n×10% ≥ 1, egyenlő osztás). A napi osztás az
   `app_setting.outreach_experiment.plan`-ben él (determinisztikus mag: nap + dimenzió); a keret a
   rámpa mai plafonja, különben a `dailyCap`. Levelenként a saját részesedése alatt legjobban
   lemaradó, a leadre ALKALMAZHATÓ változat megy (pl. `{city}` nélküli leadnek nem megy városos tárgy).
4. **Őr.** ≥100 levél után a leiratkozás >0,5%, VAGY panasz-szavas válasz (`COMPLAINT_PATTERN`; FBL
   nincs) esetén a változat `enabled=false` lesz, `disabled_reason`-nel, napló és `alertHouse` levél.
   **A kontrollt a gép nem kapcsolja ki**, csak riaszt, naponta egyszer: a kontroll a tulaj által
   már futtatott levél, és ha egy dimenzió kiürülne, az megállítaná a kiküldést.
   **Módosítás 2026-11-21 (koordinátor `citb64f0ed0`, üzemi döntés):** a küszöb RELATÍV: a változat
   akkor esik ki, ha ≥100 levél után a leiratkozása > a dimenzió kontrolljának aránya + 0,5 pont
   (`unsubMargin`); amíg a kontrollnak nincs 100 levele, a leiratkozás-szabály nem ítél. A kontroll
   panasznál vagy 2% fölött (`controlAlertMax`) riaszt. Ok: a mért alapszint 1,2%, az abszolút 0,5%
   minden jelöltet kiejtett volna.
5. **Kapuk.** A §C-kapu kétszer fut: a kontroll piszkozatán (minden pozitív kötelem, mint név,
   keretezés, leiratkozás, azonosítás, a szövegből teljesüljön), majd a KÉSZ levélen (változat-tárgy
   + látható első sor + törzs), ami elkapja, amit a változat szövege hozzátenne (pl. „élő már a
   honlapja”). FLAG esetén kontroll-levél megy, naplóval: rossz változat nem tartja fel a sort, és nem
   megy ki. A tényhűség-kapu (Vera) a mockon és a törzsön ül, ezeket változat nem módosítja. A
   `sender` csak a megjelenített nevet váltja, a cím az SMTP-fiók hitelesített címe marad. A `plain`
   törzs UGYANAZOKAT a kapuzott részeket rendereli (a `text/plain` byte-ra azonos).

6. **Ár-sor dimenzió (módosítás 2026-11-22, tulaj-döntés a koordinátoron át, migráció 0144):**
   `price_line` — kontroll = a mai navy árdoboz + kedvezmény; `none` = se doboz, se ár-mondat, se
   a kedvezmény érvényességi lábjegyzete; a „sima mondat” változat (`template`, `{price}` /
   `{offerPrice}`) szövege a koordinátortól jön a tulaj jóváhagyása után. A változat a TÖRZSET
   írja (a `p3`/`fine` rész kiürül vagy a mondatra cserélődik, a törzs a részekből újraépül), így
   a §C-kapu a kész levelet ítéli. A levél kedvezmény-százaléka (ADR-0286) ettől függetlenül
   rögzül a küldéskor: a lap ugyanazt az ajánlatot mutatja.
7. **Riport „Kísérletek” fül (2026-11-22, tulaj: C terv):** `GET /report/experiments`, befagyasztott
   terv `assets/design-refs/console/kiserletek/`; a hétfői sor a Riportba kerül, mert heti
   összefoglaló LEVÉL nincs — az előző lezárt budapesti hetet mutatja, hétfő 0:00-kor vált.

8. **Személyes levél változatai (2026-11-22, koordinátor; a szöveg végleges jóváhagyása a tulajnál,
   migráció 0145, mind KIKAPCSOLVA):** `sender/szemelyes` (név = `OUTREACH_FOLLOWUP_SENDER_NAME`),
   `subject/ez_az_on_szallasa`, `body_style/szemelyes` (E/1, logó/gomb/árdoboz nélkül),
   `price_line/mondat`. A szövegük a KÓDBAN él `T()`-vel (`src/outreach/experimentCopy.ts`), a
   katalógus-sor `template`-je NULL. A `mondat` csak a személyes levéllel alkalmazható, mert a -tól ár
   az Alap csomag, foglalás nélkül, és nem állhat a dobozos levél foglalás/jutalék-ígérete mellett.
   A megszólítás (szállásnév) és az E/1 a tulaj döntése, nem kísérleti dimenzió. A §C-kapu a kész
   személyes levelet először KERETEZÉS miatt FLAG-elte; a koordinátor döntése (2026-11-22): a bevezető
   „még nem nyilvános, egyelőre csak Ön látja”, így PASS. Az ár-mondat rövidítve „Bemutatkozó áron havi
   {offerPrice} Ft-tól.” (a „… az Öné” reklámfordulatot a tulaj/Elek korábban elvetette). A személyes
   levélnek nincs felső (első-sor) szövege, az első látható szöveg a megszólítás; az első-sor dimenzió
   csak a dobozos levélre vonatkozik (a sima és a személyes levélen nem kísérletezik, nem is rögzül).

### Elvetett alternatívák

- **Fix A/B 50-50:** a rosszabb fél a teszt végéig a keret felét égeti, és két változatnál többre nem
  skálázódik; a Thompson a jobbnak ad többet, a padló pedig nem hagyja kihalni a gyengébbet.
- **Követőpixel (1×1 láthatatlan kép):** rejtett elem, spamjel (tulaj 2026-11-18: a levélben semmi
  nem lehet rejtett), és a nyitáson kívül semmit nem ad, amit a saját hős-kép ne adna.
- **Változatonkénti külön §C-kapu a sablonon:** a kapu szöveget ítél, a sablon nem levél. A kész
  levél ítélete szigorúbb, és lefedi a sablont is.

### Visszafordíthatóság

Csak additív migráció. Minden jelölt kikapcsolva: a kimenő levél a mai, egyetlen különbség a hideg
sávon a távoli kép. Ezt a `remoteHeroActive()` dönti el, visszaállítani egy sor (CID). A motor
leállítása = minden nem-kontroll sor `enabled=false`. Önteszt: `scripts/experiment-selftest.mts`
(pre-commit), az Outlook-őr a sima változatot is nézi.

### Nyitott (koordinátor/tulaj)

- A Riport „Kísérletek” panel és a hétfői összefoglaló-sor: §2b terv (3 változat), jóváhagyásig
  nincs felület-kód.
