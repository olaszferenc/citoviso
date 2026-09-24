# 2026-09-24 — Elek NEGYEDIK szerepe: a VENDÉG (FK-008 + FK-008b) — a pilot előtti vendég-szemű bejárás

**Tulajdonosi kérés:** *„Eleknek nem adtunk olyan szerepet, hogy ő egy kis érdeklődő, aki szállást
szeretne foglalni… minden folyamat: lemondja, módosítja stb. a foglalását, és minden modult, mint
szálláskereső, tesztel."* → *„Mehet, de mindent nézzen."*

## Mi készült

- **Charter-kiegészítés** (`elek/charter/CHARTER.md`, „Elek mint VENDÉG"): a negyedik szerep —
  a rendszerről semmit nem tudó szállást kereső; ERGONÓMIA/ZAVAROS a fő műfaj; a határok
  (csak elek@, csak seed-tokenek) változatlanok.
- **FK-008 — A vendég szemével** (`elek/scenarios/FK-008-guest-journey.md`, `publikus`, 12 szakasz /
  31 lépés): első benyomás · szobák/árak · fotók/térkép/környék/vélemények · vélemény beküldése ·
  foglalás hibás bemenetekkel (üres, fordított, foglalt, MÚLTBELI, név nélkül) · happy path
  nyugtával · árajánlat-út (ADR-0215) · kapott ajánlat elfogadása (`/ajanlat/<token>`) · lemondás
  a levél linkjéről (Mégsem · igen · újranyitva · függő kérésé · elgépelt) · nyelv/jog/lábléc · összkép.
- **FK-008b — A mock a vendég szemével** (`elek/scenarios/FK-008b-guest-eye-on-mock.md`, `konzol`,
  6 / 7): minta-foglalás és minta-vélemény őszintesége, „Miért kaptam?", vendég-nézet vs vásárlói sáv.
  ⛔ A vásárlás ELŐTT fut (utána a lap „már az Öné"-t mond) — a láncban FK-004b után.
- **Vendég-park:** `scripts/seed-elek-guest.sql` (a booking-seed UTÁN): alapár törölve → van ár
  nélküli időszak (árajánlat-út), „Őszi szünet" 10-23→11-01 28 000, Szabó visszaigazolt foglalása
  a jövőbe (10-09→11), zárt nap 11-20, nyitott ajánlat fix tokennel (`elekseed-offer-000000000001`),
  az ELEK-vélemény törölve (napi dedup). **Utána `rerenderTenantSnapshot`** — a lap PILLANATKÉP,
  a seed utáni árak csak újrarenderrel kerülnek rá (3 piros lépés volt ebből).
- **Lánc:** `src/elek/preconditions.ts` (FK-008b `trackedLink`, FK-008 `elekTenant`), `elek/bin/run-all.mts`
  (FK-008b FK-004b után; FK-008 az FK-007 után saját seed+újrarenderrel), `SCOPE.md` két sora.
- **Runner** (`elek/bin/runner.mts`): ① instabil (végtelen animációjú) célpontra erőltetett
  kattintás — de ELŐBB `elementFromPoint`: ha más elem takarja, hangos hiba „a célpontot takarja:
  button.cit-consent__no"; ② a `pageerror` a stack első URL-es keretét is rögzíti.
- **Termék-javítás:** `src/console/views.ts` — a „Másolom" szkript `b.textContent=${jsStr(…)}` IDÉZŐJEL
  nélkül volt → `SyntaxError` MINDEN fizetőoldalon (2026-09-15 óta, az ÉLES `263ef8dd` is
  tartalmazza; a Másolom-gomb élesben halott). Dev-úti javítás: `assets/runtime/cit-runtime.js`
  `initLiveFormBase()` — a `/t/<slug>/` úton az élő vélemény-űrlap `action`-je az `API_BASE`
  előtagot kapja (élesen no-op), különben 405 a platform-hoston.
- **FK-005a drift javítva:** hozzájárulás-sáv elfogadása (`tedd?: kattints ".cit-consent__yes"`), a
  gomb „Fizetek — 9 500 Ft" (a régi „Fizetek ▸" a felirat-őrön egy KOMMENT miatt maradt zöld).

## Futás-eredmény (lokál, ELEK-TESZT park újraépítve FK-005a-val)

- FK-008b: pass 1 · manual 6 → **HIBA 2 · ZAVAROS 8 · ERGONÓMIA 7 · GYANÚ 4**
  (`elek/runs/FK-008b-2026-09-24T18-49-53/LELETEK.md`)
- FK-008: pass 6 · manual 25 · fail 0 → **HIBA 6 · ZAVAROS 9 · ERGONÓMIA 9 · GYANÚ 2 · FORGATÓKÖNYV 1**
  (`elek/runs/FK-008-2026-09-24T19-21-38/LELETEK.md`). Regresszió 0; az FK-007 vendég-oldali H2/Z1/Z2/E7
  leletei megszűntek. Webes teszt-napló mindkettőre kitöltve (200 OK).

### Elek legfontosabb leletei (vendég)
1. **Z1 — a lap egy ÉTTERMET mutat** (hero „Házias konyha…", „Saját étterem"), a szállás egyetlen
   kártya férőhely/leírás/kép nélkül. ⚠️ Részben PARK-ARTEFAKTUM: az ELEK-TESZT lead vendéglő-adatlapból
   született. A „szállás egésze"-kártya üressége viszont valódi.
2. **H3 — foglalt napokra hármas ellentmondás:** „egyedi árat ad" doboz + „Árajánlatot kérek" gomb +
   „Sajnos ezek a napok már foglaltak"; a naptár nem lapoz novemberre, a zárt nap nem látszik.
3. **H4 — az árajánlat-kérés nyugtája a foglalás nyugtáját ismétli** (lemondó linket ígér), egy szó
   nélkül arról, hogy ÁR jön és el kell fogadni.
4. **Z3 — MÚLTBELI dátumra** a widget „egyedi árat ad"-ot ír és árajánlat-gombra vált (nincs ár a
   múltra), a „legkorábbi érkezés" csak beküldés UTÁN derül ki.
5. **H1/H2 — a vendég lapján:** „Ezt az oldalt a Citoviso készítette" credit (szándékos: growth +
   attribution, `src/generator/runtime.ts` — tulajdonosi döntés kérdése), és egy 88 px üres bézs
   fejléc-sáv asztalon (a menü láthatatlan), 390 px-en csak „FOGLALÁS", hamburger nincs.
6. **390 px:** ár-összegzés és küldő gomb ~900–1000 px-re egymástól, a hibaüzenet ~1200 px-re a
   dátum-mezőtől; a platform-lapok gombfeliratai (Vissza / Mégsem) elcsúsznak a keretben (H5).
7. **Mock (FK-008b):** telefonon a vásárlói panel NYITVA áll a hero fölött; asztalon a lebegő
   pirula a főcímre ül; a próba-nyugta a foglalásból semmit nem mutat; a vélemény-űrlapon nincs
   MINTA-jelölés; süti-sáv a vendég-honlapon (az ADR-0186 vakfolt-esete, csak a /p/ lapon jogos).

### Saját mérések (fejlesztő-session, Eleken kívül)
- ⛔⛔ **PILOT-BLOKKOLÓ, ÉLESEN IGAZOLVA (csak olvasással):** a foglalás-levelek linkjei
  (`/foglalas/<t>/lemondom`, `/foglalas/<t>/elfogadom|elutasitom`, `/ajanlat/<t>`, `/velemeny/<t>/…`)
  `publicBaseUrl(req)`-ből épülnek = a KÉRÉS hostja. Élesben a vendég a `<slug>.citoviso.com`-on
  foglal → a link a tenant-hostra mutat → a `serveTenantHost` MINDEN nem-gyökér útra 404
  „Nincs ilyen oldal." (mérve: `ferenc-haz.citoviso.com/foglalas/…` 404 „Nincs ilyen oldal",
  `citoviso.com/foglalas/…` 404 „A link már nem él" = a kezelő él). Vagyis élesben SEM a tulaj
  elfogad/elutasít linkje, SEM a vendég lemondó/ajánlat-linkje nem működik. Az FK-007 azért zöld,
  mert a dev `/t/<slug>/` úton a host a platform. Javítás: a linkek bázisa a platform
  (`config.publicBaseUrl`), nem a kérés hostja — VAGY a tenant-host is szolgálja ezeket az utakat.
- **Hozzájárulás-sáv a konfigurátor CTA-ja fölött** 1280×900-on (`#cit-consent` z-index 2147483600 >
  panel 2147483001): amíg a vevő nem dönt, a „Tovább a megrendeléshez" nem kattintható — laptopon
  valódi vevő-út-akadály (ADR-0186 óta).
- **Közös publikus throttle:** foglalás + érdeklődés + vélemény EGY IP-számlálón, a véleményé 3/10 perc
  → három foglalás-beadás után a vélemény 429. (A vélemény-szakasz ezért a foglalások ELÉ került.)
- **A runner „elment célpont" ága néma zöldet ad:** ha a kattintandó gomb NEM létezik (pl. a felirat
  átváltott), a click „sikerült"-nek számít (egy-lövetű gombokra tervezve) — a 13. lépés így
  sosem posztolt, amíg `tedd?:` mindkét gombra nem ment.
- **FK-007 dátumai elavultak** (09-21→23 már múlt): a következő futása a „legkorábbi érkezés"
  ágon fog elbukni — a seed és a forgatókönyv dátumait évhez nem kötött módon kellene adni.

## Nyitott kérdések / következő lépések
1. A levél-linkek hostjának javítása (pilot-blokkoló) — tulajdonosi döntés: platform-bázis vagy
   tenant-hostos kiszolgálás; utána ÉLES újramérés (a §0.3 engedélyével).
2. Az Elek-leletek triázsa a tulajjal: melyik megy javításra a deploy ELŐTT (H3/H4/Z3 a foglaló
   widgetben, a hozzájárulás-sáv, a mock mobil-panel), melyik marad.
3. Döntés: a „Citoviso készítette" credit maradjon-e a VENDÉG lapján.
4. FK-007 dátum-frissítés; ELEK-TESZT lead szállás-jellegű adatra cserélése (a Z1 zaja).
