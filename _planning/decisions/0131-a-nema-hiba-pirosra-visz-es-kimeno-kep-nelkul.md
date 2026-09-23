## ADR-0131 — A néma hiba pirosra visz; és kimenő kép nélkül nincs páros-indítás (2026-09-13)

**Kontextus.** Az Elek FK-004 kör (2026-09-13) a `result.jsonl`-be kétszer beírta ugyanazt:
`404 …/prospect/9ee2604d…/mms-preview.jpg` — konzol-hibaként ÉS HTTP-hibaként, a 4. és a 7.
lépésen. **Mindkét lépés `pass` lett.** A hibát nem a mérőeszköz találta meg, hanem egy friss
szemű kiértékelő, aki elolvasta a naplót.

Két külön baj egy leletben:

**① A termék.** A piszkozat-lap FELTÉTEL NÉLKÜL linkelte a kimenő MMS képét. A kép nem állt elő
(mérve: a látványterv nyitóképe a `hovamenjek.hu`-n **permanens 404**, a `heroShot` helyesen
megtagadta a cache-elést — üres hero-képpel már ment ki MMS 2026-08-30-án). A route 404-et
adott, a böngésző törött-kép ikont rajzolt, és **közvetlenül alatta ott állt az élő „Páros
indítása" gomb**, ami valódi SIM-ről indít visszavonhatatlan MMS-t. A küldés maga fail-closed
volt (`sendOutreachPair` kép nélkül megtagadja) — **csak a KÉPERNYŐ hallgatott róla.** Ez
pontosan az ADR-0082 tanulsága fordítva: az állapotot a kattintás ELŐTT kell kimondani, nem a
visszautasító sávban.

**② A mérőeszköz.** A runner lépésenként GYŰJTÖTTE a konzol-hibákat és a HTTP ≥ 400 válaszokat,
majd az ítéletnél figyelmen kívül hagyta őket: a zöld csak a `várd:` sorokat jelentette. Egy
mérőeszköz, ami rögzíti a bukást és zöldre értékeli, rosszabb a semminél — **bizalmat gyárt.**

**Döntés.**

① **Kimenő kép nélkül nincs páros-indítás, és a felület MONDJA KI.** A piszkozat-lap a render
   ELŐTT megkérdezi a kép állapotát (`heroShotState` — DB-sor + két `stat()`, böngésző nélkül),
   és `<img>`-et CSAK `ready` állapotban ad ki. Egyébként kimondja, mi a baj — a bukás OKÁVAL
   (a törött kép URL-jével) —, a „Páros indítása" gomb `disabled` és a felirata megnevezi az okot
   („nincs kép"), az egygombos „MINDKÉT csatorna" sáv pedig eltűnik (az is a párost indítaná).
   A `/mms-preview.jpg` route **CSAK CACHE-ből szolgál ki**: eddig egy `<img>`-kérésen belül
   indított 2×30 mp-es Chromium-renderelést. A render háttérben fut, az állapotot a lap
   POLL-ozza — nem időzített teljes újratöltéssel, mert az letörölné a `?kuldes=`
   visszaigazolást a lapról. Bukás után **nem** próbálkozik újra magától (≈40 mp Chromium
   lapmegnyitásonként): arra kimondott „Kép előállítása újra" gomb van. Mérve: 3 lapmegnyitás = 1 render.
   Ide tartozik, hogy a tiltott gomb **ki is néz** tiltottnak: a konzol `button[type=submit]`
   navy gradiense a `disabled` állapotra is ráült (`.con button:disabled` eddig nem létezett,
   miközben a dizájn-magban `.citui-btn:disabled` megvan).

② **Egy lépés NEM lehet zöld, ha közben hiba keletkezett rajta.** A runner ítélete beszámítja a
   rögzített konzol- és HTTP-hibákat. Jogos hiba létezik (a fagyasztott honlap ADR-0080 szerint
   SZÁNDÉKOSAN 503-at ad) — ezért van kivétel, de **kimondva, lépés szinten, KÖTELEZŐ
   indoklással**: `tűrt-hiba: <minta> — <indok>`. Indok nélkül a parser hangosan bukik; a puszta
   minta néma bukás-engedély lenne. Az átengedett hiba a naplóban marad (`tolerated_errors`, az
   indokkal) — nem tüntetjük el, csak megengedjük. A semmire nem illeszkedő minta kiíródik
   (`tolerated_unused`): az elavult engedmény hamis állítás a termékről. A minta TOKENJEI külön
   illeszkednek, mert a rögzített szövegben a status és az útvonal között ott ül az efemer host.
   A néma hibából jövő piros **nem állítja meg a futást** (az Előkészítésben sem): nem
   előfeltétel-hiány, hanem „itt elromlott valami" — a többi lépés bizonyítéka még kell.

**Miért nem elég a szerver-oldali fail-closed.** Mert a kapu ott van, ahol a döntés születik. Az
operátor a KÉPERNYŐN dönt: ha a gomb élőnek látszik, rákattint, és a visszautasításból tudja meg,
hogy sosem lett volna szabad. A törött kép alatti élő gomb ennél rosszabb: azt sugallja, hogy a
kép csak „nem töltődött be nekem", miközben a címzett kapna belőle valamit.

**Őrök (mindkettő negatívan is futtatva).**
- `scripts/mms-preview-gate-check.mts` — a RENDERELT piszkozat-lap mind a négy állapotban; a
  `ready` ág a ①③④ piros ikre (egy „mindig hibát mutató" lap nem csúszhat át zölden); böngésző-réteg
  valódi konzol-CSS-sel (nulla kép-kérés, `elementFromPoint`-tal igazolt látható ok-sáv, tényleg
  tiltott gomb); **önteszt: a régi, feltétel nélküli `<img>` + élő gomb visszainjektálva — a
  detektornak mindkettőt el KELL kapnia.**
- `scripts/elek-noise-verdict-check.mts` — a tiszta osztályozó, a parser (indok nélkül dob), és
  **ÉLES runner-futás mindkét irányban**: kivétel nélkül a 404 pirosra visz (exit 2), egyetlen
  `tűrt-hiba:` sorral ugyanaz zöld, az indok a naplóban. A tiszta függvény önmagában akkor is
  zöld lenne, ha a futó sosem hívná meg — ezért fut a valódi runner.

**Mérés a javítás után.** FK-004 szűkített kör: 12 lépés, **0 konzol-/HTTP-hiba** (előtte 2
lépésen ugyanaz a 404). A zöld mostantól jelent valamit.

**Amit a lelet MELLESLEG kimutatott (nyitott, nem ezen ADR hatóköre):** az ELEK-TESZT lead
látványtervének nyitóképe a portálon halott URL — tehát nemcsak az MMS-kép nem áll elő, hanem a
LEADNEK kiküldött mock nyitóképe is törött. Az adat-frissítés külön feladat.

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül.
