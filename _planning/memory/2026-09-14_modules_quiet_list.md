# 2026-09-14 — Modulok fül: a jóváhagyott „Csendes lista" leszállítva (ADR-0158)

**Szál:** `wt/modulokful` (B5, Elek FK-002) · **Élesítés: NINCS** (§0.3)
**Kontraktus:** `assets/design-refs/console/modules-quiet-list/`

Ez a szál két körből állt. Az első a mérés + a terv-kapu volt
([[2026-09-14_modules_tab_plan_gate]]); ez a második: a tulaj az **① Csendes lista**
változatot választotta, és két mért tételt külön is kimondott (nincs „+" a megvetten;
éves fiónál az éves ár a kiemelt).

## Amit a döntés FELÜLÍRT — és miért nem töröltük a régi szöveget

A `modules-annual-pricing` §1 **kötötte**, hogy éves fiónál is a HAVI ár az elsődleges, és a
kód ezt **hűen szállította** (mérve: havi 13,12 px / 700 / navy · éves 11,84 px / 600 /
halvány). A tulaj ezt a „legnagyobb szám az, amit fizet" elv alapján felülírta. A régi
kontraktus szövegét **áthúzva meghagytam**, az indoklással: különben egy későbbi szál úgy
olvasná, hogy a szállítás hibázott, holott egy azóta megváltozott szabályt követett.

## ⛔ A takarítás némán vitt volna el információt

A „11× ugyanaz a sor" lelet nyilvánvaló javítása a sor törlése lett volna. Grep-pel
felderítve kiderült: az `elek/scenarios/FK-006b-thaw-and-expiry.md` **olvadás után
KIFEJEZETTEN megköveteli**, hogy látszódjon az „Aktív az oldalán" — azaz a fizetés rendezése
után a tulajnak LÁTNIA kell, hogy a moduljai újra élnek. A törlés egy zöld forgatókönyvet
tett volna némán pirossá, és elvette volna a jó hírt a vevőtől.

**Megoldás:** a blokk **egyszer** mondja ki, a lista fölött („Aktív az oldalán mind a
{n} modul…"), a szám pedig abban az ágban dől el, amelyik az ÜRES sor-állapotot rendereli —
nem egy második predikátumból. Az őr a **runner saját keresőjével** (`page.getByText`)
igazolja, hogy a tű továbbra is fog, nem a saját sztring-illesztésével.
Kapcsolódó: [[feedback_label_change_breaks_its_quoters]],
[[feedback_layout_swap_silently_removes_information]].

## ⛔ A piros önteszt DARABSZÁMRA ment — és ez elrejtett egy valódi rést

Az őr öntesztje először „legalább 20 bukás"-t várt, és 12-t kapott. A kísértés az volt, hogy
lejjebb vegyem a küszöböt. Egy küszöbszám viszont **nem tudja megkülönböztetni**, hogy „ezek
az állítások nem alanyai a visszarontásnak", attól, hogy „van egy detektor, ami a régi
felületet is átengedné" — vagyis pont azt a kérdést hagyja nyitva, amiért az önteszt van.

**Névsorra váltva** (14 megnevezett állítás) azonnal kiderült, hogy a **regresszióm volt
hűtlen**: a kétsoros (keskeny) árat hagytam benne, ezért a sor kényelmesen elfért, és az
`off-order-1280` detektor ZÖLD maradt egy olyan alakon, amit el KELL utasítania. A hűséges
regresszió (egysoros, széles ár + havi-vezető sorrend) után mind a 14 bukik.

## ⛔ A landolás közben egy PÁRHUZAMOS szál ugyanezeket a sorokat írta át

Az ADR-0155 (fagyasztott lap: egy összeg, határidő, csak olvasható modul-lista) és a
„névelőt a gép dönti el" (ADR-0101 ①, `a(z)` tiltva) ugyanabban a függvényben landolt.
A rebase-konfliktust **tartalmilag** kellett feloldani, nem szövegesen:

- a fagyasztott ág rejtett inputjai (nélkülük egy submit mind a 11 modult lemondaná) az
  ÖVÉK — megtartva, az én rács-celláimba ágyazva;
- a fejléc-összeg, a gyűjtő-mondat és a feloldó sor **fagyasztva ELTŰNIK**: az a lap egy
  dologról szól, és egy „Jelenleg 99 900 Ft/év" pirula a tartozás mellett pont az az
  ellentmondás lenne, amit az ADR-0119 lezárt;
- az új mondatom `a(z)`-t használt → átírva a landolt `huArticleLower()`-re.

## ⛔ A KB-fogyasztót OLVASÁSSAL kaptam el, nem őrrel

A `<details open>` miatt az `admin-subscription` súgó mondata („a **sorra koppintva** látja a
bontást") hazuggá vált. Egyetlen gépi kapu sem szólt volna: a `kb-check` a FELIRATOK
meglétét méri, nem azt, hogy a leírt INTERAKCIÓ még szükséges-e. Javítva (3 hely), a
`modules-annual-pricing`-hez tartozó árcímke-mondattal együtt.

## ⚠️ Mellék-lelet: a `console-outreach-draft` KB-képe NEM determinisztikus

Kétszer futtatva a `kb-shot`-ot, kód-változás NÉLKÜL, két különböző sha256-ot ad
(`85ca674f…` → `88db9df0…`). Ezért minden KB-képes szál diffet kap rá, ami nem az övé.
Nem nyúltam hozzá (nem az én felületem), de rögzítve: aki KB-képet regenerál, ne commitolja
be gondolkodás nélkül. Ugyanígy kimaradt az `admin-multilang` és az `admin-settlement`.

## Mérve (előtte → utána)

| | előtte | utána |
|---|---|---|
| mobil lap magassága | 5874 px | **4490 px** |
| az összegző pozíciója (mobil) | 79 % | 73 % — és a fejléc-összeg **0 %-nál** |
| „Kikapcsolom" @1280 px | x=377, külön sorban, a „Megnézem" (x=821) ALATT | a sor jobb szélén |
| a lemondás kontrasztja | — | **4,81** (mérve, nem feltételezve) |

## Módosított fájlok

- `src/server/adminViews.ts` (ár-forma, rács-sor, halk lemondás, fejléc-összeg, gyűjtő- és
  feloldó mondat, JS-szinkron) · `src/server/moduleConfigViews.ts` (ikerpár: fejléc-ár)
- `public/assets/ui/citui-admin.css` (`.adm-mine__row` rács, `.adm-price*`, `.adm-mine__off/__now/__all/__recon`)
- `assets/design-refs/console/modules-quiet-list/` (ÚJ kontraktus) ·
  `…/modules-annual-pricing/README.md` (§1 áthúzva, felülírva)
- `scripts/modules-quiet-list-check.mts` (ÚJ őr) · `scripts/modules-annual-check.mts` (új jelölés)
- `hooks/pre-commit` · `kb/entries/admin-modules/` · `kb/entries/admin-subscription/`
- `_planning/DECISIONS.md` (ADR-0158)

## Utókör ugyanezen a napon — az alapdíj felirata (a tulaj külön kérésére)

A tulaj a szállítás után kimondta: „Az alapdíj felirat ellentmondását is javítsd meg."

**Újramérve** (nem a saját összefoglalómból): a felirat **KÉT helyen** áll — a most már NYITOTT
tételes számlán (3 900 Ft) és az összegzőben (39 000 Ft) —, és az ellentmondás **csak az egyik
állapotban** él:

| állapot | gerinc sora | alapdíj-felirat |
|---|---|---|
| Online foglalás NINCS megvéve | „az árban" | „Alapdíj (honlap + időpontkérés)" — **igaz** |
| Online foglalás MEGVÉVE | „nem számítjuk", „az Online foglalás váltja ki" | „Alapdíj (honlap + időpontkérés)" — **hamis** |

**A javítás:** a felirat a gerinc-SLOT valódi állapotából derivál (fut → „…időpontkérés";
kiváltva → „…kapcsolatfelvétel"; nincs gerinc → „Alapdíj (honlap)"), EGY kifejezésből, két
fogyasztóval.

⛔ **A pár MÁSIK felét NEM írtam át.** A „nem számítjuk" chipet a `modules-billing` kontraktus
§8 KÖTI („a sor elhalványul, az ok kimondva"). Egy ellentmondó párból a HAMIS felet kell
javítani — a másikat felülírni egy második, kéretlen kontraktus-sértés lett volna. (Aznap már
egyszer felülírtam egy kontraktust, de arra KIMONDOTT tulajdonosi utasítás volt.)

⛔ **Nem törléssel oldottam meg:** ahol a gerinc tényleg fut, ott a felirat továbbra is
MEGNEVEZI — különben a javítás némán vitt volna el információt. Az őr **mindkét állapotot**
méri, és a piros iker a feltétel nélküli feliratot teszi vissza.

⚠️ **A saját képkészítőm vázát megint elrontottam:** oldalsáv nélkül a `.adm-shell` rácsban a
tartalom a 248 px-es oszlopba esett, és egy ~50 px széles hasábot fényképeztem. Másodszor ugyanaz
a hiba-osztály ebben a szálban: **a keret is része a mérésnek.**

## Harmadik utókör — a support-cím (ADR-0174)

A tulaj: „A személynévre szóló kapcsolat-e-mailt is javítsd meg." → `info@citoviso.com`.

**Mérve:** a tenant-admin és a belépési súgó a `config.outreachSender.email`-t kapta — a hideg
megkeresés JOGILAG KÖTELEZŐ feladó-azonosítását (§C.2), ami a dev-konfigon személynév. Új,
önálló `config.supportEmail` mező; három szerep, három mező (support · megkeresés-feladó ·
Impresszum), szándékosan nem összevonva.

⛔⛔ **A rebase egy PÁRHUZAMOS szálat hozott be, amelyik UGYANEZT a hibát javította** (`358cade`,
„a kapcsolat-cím nem létezett"). Ők a vízvezetéket: egy forrás a hívótól + **cím hiányában a
mondat ELMARAD**, nem cserélődik hihetőre (§B.17). **Az ő megoldásuk maradt**, én a SZEREPET
javítottam alatta (a hívó mostantól a support-mezőt adja át, nem a megkeresés-feladót). A két
javítás összeadódik — ha a konfliktust „az enyém nyer" alapon oldom fel, a szigorúbb §B.17-es
ágat töröltem volna el. **Konfliktusnál előbb OLVASD EL, mit csinált a másik.**

⛔ **A premisszájuk és az enyém ellentmondott:** ők azt mérték, hogy az `info@` „a
konfigurációban SEHOL nem szerepel"; a repó infra-jegyzete (2026-08-03) szerint viszont
**ingyenes alias ugyanarra a Zoho-postafiókra**. Mindkettő igaz a maga kérdésére (config ≠
postafiók), és EGYIK SEM friss mérés. A kézbesíthetőséget innen nem lehet mérni: a 25-ös port
kifelé zárva (ECONNREFUSED mind a 7 próbacímre, a biztosan létező `olasz.ferenc@`-re is).
**Az őr ezért a saját határát kimondja a kimenetén** — nem állítja, hogy a cím működik.

ℹ️ **Rögzített, NEM javított lelet:** a belépési súgón a cím SZÖVEG, nem `mailto:` link. Az
őröm első változata emiatt lett piros egy helyes lapon — más kérdésre válaszolt volna.

## Nyitott

- A kontraktus „Amit a terv NEM dönt el" szakasza: a „Fizetés és generálás" gomb 0 nyelvvel.
- ⛔ **EMBERI:** élnie kell a Zoho-aliasnak az `info@citoviso.com` címre.
- A belépési súgó kattinthatósága (fenti lelet).
- A `console-outreach-draft` KB-képének nem-determinizmusa (fenti).
