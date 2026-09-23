## ADR-0158 — A legnagyobb szám az, amit fizet; és a lemondás ne kapja a lap legnagyobb felületét (2026-09-14)

**Státusz:** elfogadva (tulajdonosi döntés a §2b terv-körben) · **Kiváltó:** Elek FK-002
**Kontraktus:** `assets/design-refs/console/modules-quiet-list/` (HTML + README + 3 kép)

### Kontextus

A tenant-admin **Modulok** fülén az Elek-kör 14 leletet mért. Három tartozott össze:

1. A már MEGVETT modul ára `+490 Ft/hó` alakban állt — „+” előjellel, mintha hozzáadandó
   tétel lenne, holott a tulaj már fizeti. Ugyanez a szünetelő és a lemondott-de-kifizetett
   modulon is.
2. Éves számlázású fióknál (99 900 Ft/év) a HAVI szám volt a kiemelt (mérve: 13,12 px / 700 /
   navy), az éves pedig apró és halvány (11,84 px / 600 / muted).
3. A lemondás („Kikapcsolom”) **11 darab teljes súlyú gombként** állt a lapon, ugyanolyan
   `citui-btn--ghost`-ként, mint a „Megnézem” és a „Beállítás”.

A ②-t nem hiba okozta: az **ADR-0088/`modules-annual-pricing` §1 KÖTÖTTE ÍGY** („a havi
egységár marad az elsődleges”), és a kód ezt hűen szállította. A szabály viszont szembemegy
azzal az elvvel, amit a tulaj korábban a konfigurátornál mondott ki: **a legnagyobb szám
legyen az, amit fizet**.

### Döntés

1. **Az éves fiókon az ÉVES ár a kiemelt**, a havi a kíséret. Ez **FELÜLÍRJA** a
   `modules-annual-pricing` §1-ét. A régi kontraktus szövege **áthúzva MARAD** a README-ben,
   az indoklással együtt — különben egy későbbi szál úgy olvasná, hogy a szállítás hibázott,
   holott egy azóta megváltozott szabályt követett.
2. **„+” előjel CSAK ott, ahol tényleg hozzáadás:** a kirakat-kártyán igen, a birtokolt
   (és szünetelő, és lemondott-de-kifizetett) modulon nem.
3. **A lemondás halk szöveges hivatkozás** a sor jobb szélén — de LÁTHATÓ és egy kattintás
   (§J). A döntés a SÚLYÁRÓL szól, nem a létéről.
4. **A modul-sor RÁCS**, nem `flex-wrap`. Ez nem stílus: a tördelés mérve MINDKÉT méreten a
   sor BAL szélére, külön sorba emelte a lemondást (390 px és — a valódi vázban, 248 px
   oldalsáv + 900 px tartalom-plafon — **1280 px-en is**: x=377 a „Megnézem” x=821 alatt).
5. **Az alapeset egyszer szerepel**, a lista fölött, nem 11×-szer a sorokban; a végösszeg a
   kártya FEJLÉCÉBEN is ott van; a tételes számla NYITVA.

### Következmények

- **Egy szabály, egy hely:** a modul-beállító képernyő fejléc-ára (`moduleConfigViews.ts`)
  ugyanezt az alakot viszi — különben két ár-nyelv lenne egy kattintásnyira egymástól.
- **Az információ nem veszhet el a takarítással.** Az ismétlődő „Aktív az oldalán.” sor
  törlése önmagában REGRESSZIÓ lett volna: az `FK-006b-thaw-and-expiry` forgatókönyv olvadás
  után KIFEJEZETTEN megköveteli (`várd: látható "Aktív az oldalán"`), hogy a tulaj lássa, a
  moduljai újra élnek. A gyűjtő-mondat ezért tartalmazza a kifejezést, a darabszáma pedig
  abban az ágban dől el, amelyik az üres sor-állapotot rendereli — és az őr a **runner saját
  keresőjével** (`page.getByText`) igazolja, hogy a tű továbbra is fog.
- **Fagyasztás alatt** (ADR-0155) a gyűjtő-mondat, a fejléc-összeg és a feloldó sor
  ELTŰNIK: az a lap egy dologról szól — mennyi a tartozás és meddig.
- **Nyitva maradt, mert a tulaj NEM döntött róla** (a kontraktus nyitottként sorolja):
  az „Alapdíj (honlap + időpontkérés)” ↔ „nem számítjuk” ellentmondás; a fizetős felületen
  személynevet kiíró kapcsolat-e-mail (`config.outreachSender.email`); a többnyelvű kártya
  „Fizetés és generálás” gombja 0 nyelvvel.

### Az őr

`scripts/modules-quiet-list-check.mts` — **böngészőben** mér, mert a kötött állítások fele
vizuális: a betűméret dönti el, melyik szám a „kiemelt”, és a tördelés-visszaesés csak valódi
szélességen látszik. 21 állítás; a lemondás kontrasztja MÉRVE (4,81), nem feltételezve.

> ⚠️ **A piros önteszt első változata darabszámra ment** („legalább 20 bukás”) és 12-t kapott.
> A küszöbszám nem tudja megkülönböztetni azt, hogy „ezek az állítások nem alanyai a
> visszarontásnak”, attól, hogy „van egy detektor, ami a régi felületet is átengedné” —
> vagyis pont azt a kérdést hagyja nyitva, amiért az önteszt van. **Névsorra váltva** derült
> ki, hogy a REGRESSZIÓM volt hűtlen: a kétsoros (keskeny) árat hagytam benne, így a sor
> kényelmesen elfért, és az `off-order-1280` detektor ZÖLD maradt egy olyan alakon, amit el
> KELL utasítania. Javítva; a 14 névvel felsorolt állítás mind elbukik rajta.

### Mérési tanulság (a mérőeszközre, nem a termékre)

⛔ **A mérő KERETE is hamisíthat.** Az első mérést egy saját, egyszerű vázba renderelve
végeztem — ott a modul-sor ~1240 px volt és egy sorban elfért, tehát a desktop-tördelés NEM
látszott, és a leletet „csak mobilos”-nak hittem. A termék valódi váza (248 px oldalsáv +
`.adm-main__inner{max-width:900px}`) mellett újramérve a hiba mindkét méreten él. A renderelt
felület mérése is csak akkor mérés, ha a keret a termék kerete.
