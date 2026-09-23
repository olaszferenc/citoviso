# Árajánlat küldése árazatlan kérésre — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-23, tulajdonosi választás: **B út — „ajánlat → a vendég elfogadja”**,
a 2. körben kért kiegészítésekkel (érvényességi dátum + figyelmeztetés, az ár mindig az
árlistába kerül) és a tulaj-oldali „A vendég elfogadta” gombbal. ·
**Kapcsolódó:** ADR-0208 ⑥.1 (ez a tétel), ADR-0208 ② (a vendég-oldali árajánlat-mód),
ADR-0193 ① (nem blokkolunk), ADR-0192 ④.2 (a `booking` kemény függősége a `pricing`),
ADR-0044 §6 (a foglalás KÉRÉS), §B.17.

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez
mérjük (ui-shot, mobil 390 + asztali). A képek a jóváhagyott állapotokat mutatják.

## Miért létezik

Mérve (2026-09-23): ár nélküli kérésnél a tulaj levele az árat **némán kihagyta**,
„Új foglalási kérés”-nek hívta, és egy koppintásos **„Elfogadom”** gombot adott, ami a
foglalást **ár nélkül véglegesítette** — a vendég árajánlatot kért, és összeg nélküli
visszaigazolást kapott. A vendég „rögzítettük” levele is foglalási kérést mondott,
miközben a lap (ADR-0208) már árajánlat-kérést.

## Amit a terv KÖT

1. **A kiváltó a befagyasztott ár hiánya** (`quoted_total IS NULL`) — ugyanaz a predikátum,
   ami a vendég-lapot árajánlat-módba teszi. Nincs új heurisztika.
2. **A tulaj levele** ilyenkor „Árajánlat-kérés”, és kimondja: *a vendég nem látott árat*,
   megnevezi az egységet és az árazatlan éjszakák számát/idejét. Gombjai: **„Ajánlatot
   küldök”** (→ ajánlat-lap) és **„Nem szabad”**. ⛔ Ár nélküli kérésen **nincs**
   koppintásos „Elfogadom”.
3. **Nincs „nincs árlista” ág.** A `booking` kemény függősége a `pricing` (ADR-0192 ④.2),
   tehát foglalásnál mindig van árlista — csak egy egységre vagy egyes éjszakákra hiányzik.
4. **Az ajánlat-lap** (a levél linkje, belépés nélkül; a Foglalások fülön ugyanez) a kérés
   adatai + a vendég üzenete („Vendég” címkével) + a **tartózkodás éjszakái az árlista
   szerint**: ami már árazott, az a meglévő áron, fixen áll; **csak a hiányzó éjszakákra**
   kér árat. Az összeg élőben számolódik, ugyanazzal a szabállyal, ami a vendég-lapon és a
   levélben az árat adja (egy példány, ADR-0208 ③).
5. **Az ár MINDIG az árlistába kerül.** Nincs „csak erre a kérésre” kiút (tulajdonosi döntés:
   a hiányzó ár ne ismétlődhessen).
6. **Érvényesség:** „Érvényes eddig” dátum, nem kötelező.
   - **Dátum nélkül** az egység **alapára** lesz — minden éjszakára, amire nincs szezonár, a
     következő módosításig. A lap ezt **figyelmeztetésként** kimondja, a meglévő szezonárak
     nevével együtt, amelyek a saját árukon maradnak.
   - **Dátummal** mától a megadott napig érvényes (évhez kötött), szintén csak ott, ahol
     nincs szezonár. Utána ott újra nincs ár — és a lejárat előtt **emlékeztetjük** a tulajt
     (ez ígéret a felületen, tehát a megvalósítás része).
   - A dátum **nem lehet a kért tartózkodás utolsó árazatlan éjszakája előtt** — különben az
     ár erre a kérésre sem vonatkozna; hibaüzenet, a küldés tiltva.
7. **Az ár-mező** a számot ezres-tagolással is elfogadja („26 000”, „26.000”), csak pozitív
   egész; hibás bevitelre magyar hibaüzenet, a küldés tiltva.
8. **Az „Ajánlat küldése”** nem foglalás: a kérés **„Ajánlat kiküldve”** állapotba kerül (ez a felirata a Foglalások fülön), az ár
   (összeg + bontás) a kérésre fagy, a napok **szabadok maradnak**. Lejárat: a modul meglévő
   válaszideje (`autoDeclineHours`, alapból 48 óra) **az elküldéstől** számítva.
9. **A vendég levele** az ajánlatot, a bontást, a tulaj üzenetét („A szállásadó üzenete”), a
   lejárat időpontját és azt mondja ki, hogy addig a napokat más is lefoglalhatja. Gombjai:
   „Megnézem és elfogadom”, „Nem kérem”.
10. **A vendég linkje SAJÁT kódot hordoz**, nem a tulajét — a tulaj kódja az ajánlat-lapot és
    az árlista írását nyitja, az nem kerülhet a vendéghez.
11. **A link a szállás oldalán nyit egy lapot, ami előbb csak MUTAT** (a levelezők előre
    megnyitják a linkeket). Az „Elfogadom az ajánlatot” gomb (POST) ugyanazt a lépést futtatja,
    mint a tulaj mai elfogadása: egy tranzakcióban ellenőrzi, hogy a napok szabadok-e, és
    foglalttá teszi őket; a foglalás ára a kiküldött ár.
12. **Kimenetek:** elfogadva → a vendég visszaigazolást kap az árral és a lemondó linkkel, a
    tulaj levelet („… elfogadta az ajánlatát”). **Közben elkelt** → a vendég ezt látja, pénz nem
    mozdul, a tulaj értesítést kap. **Lejárt** → a vendég ezt látja; a lejárat a meglévő
    lejárati sweep része, mindkét fél levelet kap. **„Nem kérem”** → lezárul, a napok szabadok.
13. **Tulaj-oldali rögzítés:** a Foglalások fülön az „ajánlat kiküldve” sornál **„A vendég
    elfogadta (telefonon / levélben)”** gomb — ugyanaz a 11. pont lépése, a tulaj indítja; a
    vendég ugyanazt a visszaigazolást kapja.
14. **A vendég „rögzítettük” levele** ár nélküli kérésnél árajánlat-kérést mond, nem
    foglalási kérést (ugyanaz a predikátum, mint az 1. pont).
15. **Két elrendezés:** asztalon a kérés és az ár egymás mellett (5:7), mobilon egymás alatt; a
    hiányzó-ár sor mezői mobilon **teljes szélességűek** (az összeg-oszlop nem nyomhatja össze).

## Amit NEM köt

A színek és a pontos margók a `--citui-*` tokenekből jönnek; a mock saját tokenkészlete
csak a vázlat önhordóságát szolgálja. A „Próba” gombok (közben elkelt / lejárt) csak a
mockban élnek.
