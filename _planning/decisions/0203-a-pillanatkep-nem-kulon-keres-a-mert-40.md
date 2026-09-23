## ADR-0203 — A pillanatkép nem külön kérés: a mért 40 másodperc 2 volt, és a kattintás a döntést akadályozta (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva · **Felülírja:** ADR-0131 („a kép kimondott
kérésre indul") indoklását · **Kapcsolódó:** ADR-0134 (a lap `heroShotState()`-et kérdez
ELŐSZÖR, és csak `ready`-re tesz ki `<img>`-et — ez ÉRVÉNYBEN marad), ADR-0082 (a felület
kattintás ELŐTT mondja meg az állapotot), politeness-doktrína (hostonként egy kérés).

**Tulajdonosi kérdés:** „miért nem jön automatikusan előnézeti kép?" — 19 legenerált
mock-változat, egyiken sem kép, kártyánként egy „Kép kérése" gomb.

### ① A leírt indok mérve hamis volt

A kártya azt állította: *„a kép legyártása ~40 másodperc, ezért külön kérésre indul"*. Megmérve
(`heroShot.ts`, ugyanaz a lead, üres gyorstárból):

| | leírt indok | **mérve** |
|---|---|---|
| egy render ideje | ~40 s | **5,6 s** (első) · **2,0–2,3 s** (a többi) |
| kérés a portál felé / render | — | **5–8** (csak az első képernyő tölt be) |
| 19 kép összesen | ~13 perc | **47 másodperc** (mérve, lásd ④) |

A 40 másodperc a BUKÓ eset két kísérletének ideje volt (`ATTEMPTS=2` × 30 s timeout) — abból
lett a felületen egy INDOK, amiért a kurátor 19 kártyán 19-szer kattintott. A hamis indok nem
kényelmi kérdés volt: a kép kell a DÖNTÉSHEZ (melyik változat menjen ki), a rendszer pedig a
döntés UTÁNRA tartogatta.

### ② A valódi korlát a portál volt — és az megszüntethető

Minden render újra lehúzta a lead fotóit a forrás-portálról. Egy lead 19 változata UGYANAZT a
fotó-készletet hordozza, tehát ~19 × 6 = ~120 kérésből ~114 fölösleges ismétlés — és pontosan az
a burst-minta, amiért a lake-balaton.com egyszer 429-cel válaszolt, és egy ÜRES képű MMS ment ki
(2026-08-30). **Forráskép-cache** (`src/outreach/photoCache.ts`): az első render letölti és
lemezre teszi, a többi onnan eszik. Mérve: a 19 render **4 letöltést** küldött ki, a többi
mind gyorstár-találat (6–8 / render). A mock HTML változatlan — a kiszolgálás a Playwright
`route.fulfill()`-jén megy, tehát a lap ugyanazt az URL-t kéri, mint élesben.

⛔ Amit a cache NEM ment el: nem-200 válasz, nem-kép tartalom, üres vagy 8 MB fölötti fájl. Egy
404-es HTML befagyasztása a hibát tenné tartóssá (2026-09-18 lecke: egy pillanatnyi kimaradásra
épített javítás 45 élő fotót írt 0-ra). TTL 7 nap — a portál ÁTNEVEZ, amikor cserél, tehát egy
élő URL tartalma stabil; a TTL takarít, nem helyességet véd.

### ③ A döntés

1. **A generálás végén** minden elkészült változat képe magától elindul (`server.ts`, a generate
   route lezárásában).
2. **A lead-lap megnyitása** sorba állítja a HIÁNYZÓKAT (`kind === "none"`) — enélkül a ma már
   meglévő 19 kártya örökre kattintás-függő maradna. ⚠️ CSAK a `none`: a `failed` NEM indul újra
   magától (egy bukott render minden lapmegtekintéskor újraindulva pontosan az ADR-0131-es hiba
   lenne), arra marad a `POST /artifact/:id/shot` gomb.
3. **Globális sorompó**: egyszerre EGY render (`MAX_CONCURRENT_RENDERS`). Az `inflight` map
   artifactonként védett, a DARABSZÁMOT semmi nem fogta — 19 párhuzamos Chromium 19 párhuzamos
   kép-sort jelentett volna a portál felé. A soros futás az, ami a cache-t is dolgoztatja.
4. **A kártya magától frissül**: a `shot-state` végpont 2026-09-13 óta létezik, és a kommentje
   azt ígérte, hogy „a kártya teljes lap-újratöltés nélkül tudja követni" — a kliens-oldal
   viszont soha nem íródott meg. Most megíródott: a kész kép a helyén cseréli le a „készül…"
   dobozt, a lap többi része (nyitott panelek, görgetés, visszajelzés) érintetlen marad.
   ⛔ **KÖTEGELVE, és ÚJRATÖLTÉS NÉLKÜL** — mindkettő MÉRT bukásból jött, a saját első
   változatomból: (a) kártyánként kérdezve 19 mock 19 fetch-et indít háromszor percenként, és
   a lap SOHA nem ér el `networkidle`-t → a `button-weight-check` 390 px-en „HTTP nincs
   válasz"-ra futott; a köteges `/lead/:id/shot-states` egy kérdés (mérve 13 lekérdezés a
   teljes futamra, nem 247). (b) Bukásnál `location.replace()`-szel akartam a szervertől
   megfogalmaztatni az OKOT — ez a betöltés közepén is lecserélte a lapot, vagyis megtörte a
   navigációt (ugyanaz a bukás). Az ok most a válaszban utazik, a doboz helyben mondja ki.
5. **A felirat igazat mond**: a „~40 másodperc, ezért külön kérésre indul" mondat kikerült.

### ④ A bizonyíték

Üres gyorstárból, a lead-lap megnyitása után, KATTINTÁS NÉLKÜL:

```
  a lap networkidle-ig betöltött 19,4 s alatt      ← a poll NEM akasztja meg
    0 s  ready:7 · running:12      20 s  ready:16 · running:3
   10 s  ready:11 · running:8      30 s  ready:19
  49,5 s · betöltött KÉP: 19 · lap-lekérdezés: 13 · JS-hiba: 0
```

(A köteges végpont ELŐTTI változat ugyanezt 47 s alatt hozta — a kötegelés nem a sebességért
kellett, hanem azért, hogy a lap elérje a `networkidle`-t.)

### ⑤ Nyitva marad

A forráskép-cache ma rendernként épül; egy lead-szintű előmelegítés (a begyűjtéskor egyszer
letölteni) az első render 5,6 s-ét is levinné. · A `MAX_CONCURRENT_RENDERS` = 1 konzervatív: az
éles VPS-en mérni kell, elbír-e kettőt. · A cache takarítása (TTL-lejárt fájlok törlése) ma nincs
ütemezve.
