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
5. **Kapuk.** A §C-kapu kétszer fut: a kontroll piszkozatán (minden pozitív kötelem, mint név,
   keretezés, leiratkozás, azonosítás, a szövegből teljesüljön), majd a KÉSZ levélen (változat-tárgy
   + látható első sor + törzs), ami elkapja, amit a változat szövege hozzátenne (pl. „élő már a
   honlapja”). FLAG esetén kontroll-levél megy, naplóval: rossz változat nem tartja fel a sort, és nem
   megy ki. A tényhűség-kapu (Vera) a mockon és a törzsön ül, ezeket változat nem módosítja. A
   `sender` csak a megjelenített nevet váltja, a cím az SMTP-fiók hitelesített címe marad. A `plain`
   törzs UGYANAZOKAT a kapuzott részeket rendereli (a `text/plain` byte-ra azonos).

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

- A 0,5%-os leiratkozási küszöb a mért 1,2%-os alapszint alatt van: a kontroll 100 levél után
  szinte biztosan jelezni fog, és az első jelölt is könnyen kiesik. A küszöb állítható
  (`outreach_experiment.unsubMax`).
- A Riport „Kísérletek” panel és a hétfői összefoglaló-sor: §2b terv (3 változat), jóváhagyásig
  nincs felület-kód.
