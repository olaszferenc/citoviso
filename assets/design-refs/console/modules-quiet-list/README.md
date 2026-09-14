# Kontraktus — Modulok fül: „Csendes lista"

**Jóváhagyva:** 2026-09-14, tulajdonosi döntés a §2b terv-körben (①/②/③ változatból az **①**).
**Kiváltó:** Elek FK-002 (2026-09-13 futás, 2026-09-14 újramérés) — 14 lelet a tenant-admin
Modulok fülén: a lap a lemondásnak adta a legnagyobb felületet, 11-szer ismételte ugyanazt a
mondatot, a megvett modulon „+" előjelű árat mutatott, és éves fiónál a havi számot emelte ki.
**Hatókör:** `src/server/adminViews.ts`, `public/assets/ui/citui-admin.css`
**Kapcsolódó:** ADR-0080 · ADR-0089 (`modules-tab`) · ADR-0113 (`modules-pay-gate`) ·
`modules-annual-pricing` (⚠️ §1-ét ez a kontraktus FELÜLÍRJA — lásd lent) · 03-INVARIANTS §B.17.

A `modules-quiet-list.html` a jóváhagyott terv — **kattintható és számol**: a „Kikapcsolom" a
VALÓDI szabállyal írja újra a végösszeget, a darabszám abból a listából jön, amit összead, a
lemondott modul a fordulónapig az oldalon marad. Valós ELEK-adat: alapdíj 3 900 Ft/hó,
11 számlázott modul 6 090 Ft/hó, havi 9 990 Ft, éves 99 900 Ft (2 hó ajándék, ×10).
„Mobil 390px / Asztali" váltó **és** „Képernyő (görgethető) / Teljes lap" váltó.

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

### 1. A modul-sor RÁCS — nem törhet szét

A sor `display:grid`, NEM `flex-wrap`. ⛔ A mai fülön a tördelés emeli a lemondást a sor BAL
szélére, külön sorba — és **mérve nem csak mobilon**: 1280 px-en is (a „Kikapcsolom" x=377,
a „Megnézem" x=821 ALATT), mert a valódi váz a tartalmat 900 px-re fogja (248 px oldalsáv +
`.adm-main__inner{max-width:900px}`).

- **Asztali:** `név | ár | műveletek` egy sorban, a műveletek jobbra zárva.
- **Mobil:** `név | ár` az első sorban, a műveletek a másodikban, **jobbra zárva**.
- ⛔ A lemondás SOHA nem kerülhet a sor bal szélére, és soha nem lehet a sor első eleme.

### 2. A lemondás halk — a lapon nem áll 11 teljes súlyú gombként

A „Kikapcsolom" **szöveges hivatkozás** (aláhúzott, `--citui-muted`), nem `citui-btn`.
A „Megnézem" és a „Beállítás" marad gomb. A visszakapcsolás („Mégis megtartom") ugyanott,
ugyanabban a halk formában, de akcentszínnel.

⛔ **Nem tűnhet el és nem kerülhet menü mögé:** a lemondásnak elérhetőnek KELL maradnia egy
kattintással (§J: ami nem látszik, az nem létezik). A döntés a SÚLYÁRÓL szól, nem a létéről.

### 3. Csak a kivétel beszél — de az információ nem veszhet el

A soronkénti állapot-sor CSAK akkor jelenik meg, ha MOND valamit: lemondva · kiváltva ·
szünetel · első díjra vár. Az alapeset („Aktív az oldalán.") 11× ismételve nem információ.

> ⛔ **Ezt nem lehet egyszerűen kitörölni.** Az `elek/scenarios/FK-006b-thaw-and-expiry.md`
> olvadás után KIFEJEZETTEN megköveteli: `várd: látható "Aktív az oldalán"` — azaz a fizetés
> rendezése után a tulajnak LÁTNIA kell, hogy a moduljai újra élnek. A soronkénti ismétlés
> eltávolítása enélkül **némán vitt volna el információt**
> (`feedback_layout_swap_silently_removes_information`).
>
> **A kötelező forma:** a blokk **egyszer**, a lista fölött mondja ki, hányan vannak alapesetben
> — „**{n} modul aktív az oldalán** — alább csak azt jelezzük, ami ettől eltér." A szám
> SZERKEZETILEG abból a halmazból jön, amit a sorok alapesetnek mutatnak
> (`feedback_label_must_derive_from_predicate`), és `{n} = 0` esetén (pl. fagyasztás alatt)
> a mondat **nem jelenik meg** — így a `frozen-state-check` tiltása is sértetlen marad.

### 4. A végösszeg a görgetés ELŐTT is ott van

A kártya FEJLÉCÉBEN egy pirula: „Jelenleg {összeg}/év" (éves fiónál) vagy „…/hó" (havinál).
⛔ Ugyanabból a forrásból, mint a lista alatti összegző és az Előfizetés-kártya „Következő
számla" cellája — a fülön **egy** igazság lehet. Mérve ma: az összegző 390 px-en a lap
**79 %-ánál** kezdődik (y=4632 / 5874), 1280 px-en a **74 %-ánál** (y=2482 / 3372).

### 5. A tételes számla NYITVA

Az Előfizetés-kártya „A következő számla tételei" `<details>`-e alapból `open`.

### 6. ⛔ „+" előjel CSAK ott, ahol tényleg hozzáadás

A MÁR MEGVETT (és a **szünetelő**, és a lemondott-de-kifizetett) modul ára **nem** visel „+"
előjelet: az nem egy hozzáadandó tétel, hanem amit a tulaj már fizet. A KIRAKAT-kártyán a „+"
MARAD — ott valóban növekményt jelöl.

### 7. ⭐ Éves fiónál az ÉVES ár a kiemelt (⚠️ ez FELÜLÍR egy korábbi kontraktust)

> **A `modules-annual-pricing/README.md` §1 ezzel ELLENTÉTESET mondott** („a havi egységár
> marad az elsődleges"), és a szállítás azt hűen teljesítette — mérve: havi 13,12 px / 700 /
> navy, éves 11,84 px / 600 / halvány. A tulaj 2026-09-14-én ezt **felülírta**, a
> `feedback_screen_must_not_shrink_or_decide` elve alapján: **a legnagyobb szám legyen az,
> amit fizet.** Éves fiónál ez az éves ár.

- Éves fiókon: az **éves** összeg az elsődleges (nagyobb, `--citui-navy-900`), a havi mellette
  halványan és kisebben. Havi fiókon változatlanul csak a havi áll — ott az éves szám zaj lenne.
- A szorzó `12 − annualFreeMonths`, **ugyanaz az egy forrás**, amit a tervsáv és a
  számla-cella használ. ⛔ A szám SOHA nem írható ki kézzel.
- Ugyanez áll a modul-beállító képernyő fejléc-árára (`moduleConfigViews.ts`).

### 8. A 12 ≠ 11 feloldása ott van, ahol a szám áll

A lista alatt egy mondat kimondja, hány modul él az oldalon és hány szerepel a számlán, és
megnevezi a különbséget. Eddig ez csak az Áttekintés csempéjén volt feloldva.

---

## Amit a terv NEM dönt el (NYITOTT, külön körre)

- ⛔ **Az alapdíj felirata.** Egy képernyőn áll az „Időpontkérés, kapcsolat → **nem számítjuk**"
  és az „**Alapdíj (honlap + időpontkérés)**". A vázlat ezt „Alapdíj (a honlap maga)"-ra váltotta,
  de a tulaj erről NEM döntött, és a mai feliratot a `modules-annual-pricing` §2 táblázata írja
  elő. **Ezért a megvalósításban VÁLTOZATLAN marad.**
- ⛔ A „Kérdése van a csomagról?" link személynevet ír ki (`config.outreachSender.email`).
- ⛔ A többnyelvű kártya „Fizetés és generálás" gombja 0 nyelvvel is aktív (szerver-oldali kapu).

---

## Az őr, ami ezt méri

`scripts/modules-quiet-list-check.mts` — a RENDERELT fülön mér, és ahol a kérdés vizuális
(„melyik szám a nagyobb?"), ott **böngészőben, számított stílussal**, nem a forráson:

1. a birtokolt soron NINCS „+", a kirakat-kártyán VAN;
2. éves fiónál az éves ár betűmérete NAGYOBB a haviénál (a „legnagyobb szám" elve mérve,
   nem feltételezve) — és havi fiónál nem jelenik meg éves alak;
3. a sor `display:grid`, és a lemondás x-pozíciója a „Megnézem"-é UTÁN van, 390 és 1280 px-en
   egyaránt (a tördelés-visszaesés detektora);
4. a lemondás nem `citui-btn`, de LÁTHATÓ és kattintható;
5. az alapeset-sor 0-szor szerepel a sorokban, és a gyűjtő-mondat száma egyezik az alapesetű
   sorok valódi számával; fagyasztás alatt a mondat NEM jelenik meg;
6. a fejléc-pirula összege egyezik az összegzőével és a számla-celláéval;
7. a számla-`<details>` nyitva.

Piros önteszt: `--self-test` a 2026-09-14 ELŐTTI formát rendereli, és minden állításnak buknia
kell rajta.
