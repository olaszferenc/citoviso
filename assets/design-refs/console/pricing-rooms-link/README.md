# Árak képernyő → út a Szobák szerkesztőhöz („B: gomb a jegyzetben”)

Tulajdonosi jóváhagyás: 2026-09-25 („B”), két változatból (A: link-sor a jegyzetben, B: gomb a
jegyzetben). Kiváltó ok (a tulaj szava): ha a tulaj nem a szállás egészét, hanem szobákat akar
árazni, a szobákat előbb fel kell vennie — az Árak képernyőről eddig ide nem vezetett út, csak egy
nem kattintható mondat említette a modult. **Ez a terv KÖT.**
**Hatókör:** src/server/moduleConfigViews.ts · src/server/public.ts

## Amit a terv KÖT

1. **A jegyzet marad, gombot kap.** Az Árak képernyő felső jegyzete (a mai mondat: „Az árat
   egységenként adja meg — a vendég is így látja majd. …”) változatlan szöveggel megmarad, és
   mellé egy MÁSODLAGOS gomb kerül (`citui-btn--ghost citui-btn--sm`). Asztalin a jegyzet jobb
   szélén, a szöveggel egy sorban; mobilon a szöveg alatt, teljes szélességben.
2. **A gomb célja a Szobák modul állapotától függ** — a modul-képernyő csak AKTÍV modulra nyílik
   (`serveAdmin`), ezért a gomb nem mutathat vakon a szerkesztőre:
   - Szobák modul AKTÍV → felirat **„Szobák, apartmanok szerkesztése”**, cél
     `/admin?tab=modulok&m=rooms` (a Szobák szerkesztő).
   - Szobák modul NEM aktív → felirat **„Szobák modul bekapcsolása”**, cél `/admin?tab=modulok`
     (a Modulok fül, ahol a modul a „Hozzáadom” gombbal kapcsolható be).
   Az állapotot a nézet KAPJA (`PricingEditorData.roomsActive`, kötelező mező), ugyanazzal a
   predikátummal, amellyel a képernyő-kapu dönt (aktív modul a tenant modul-listájában).
3. **Mindkét egység-számnál ott van** (egy „A szállás egésze” egységnél és több egységnél is) —
   a kiváltó eset pont az egy-egységes tulaj, aki szobákat akar.
4. **Súgó:** az `admin-modules-pricing` bejegyzés a gomb feliratával szó szerint egyezően mondja
   el, hova visz, és hogy a Szobák modul nélkül a Modulok fülre visz; a képernyőkép (`screen.png`)
   a gombbal együtt készül (ADR-0220: a súgó-kép frissesség deploy-kapu).
5. Minden felirat T()-fordított; nyers szín nincs, a gomb a dizájn-mag osztályait viseli.

## Tükör: a Szobák képernyőről vissza az Árakhoz (tulajdonosi kivétel, 2026-09-25)

A tulaj szava („ja lehessen visszamenni az árakhoz!”) + §2b kivétel ugyanerre a mintára,
terv-kör nélkül. Ugyanaz a B: a Szobák képernyő felső jegyzete („Ezek jelennek meg az
oldalán…”) mellett egy másodlagos gomb, a célja az Árak modul állapotától függ:
- Árak modul AKTÍV → felirat **„Árak, szezonok szerkesztése”**, cél `/admin?tab=modulok&m=pricing`.
- Árak modul NEM aktív → felirat **„Árak modul bekapcsolása”**, cél `/admin?tab=modulok`.
Az állapot a `NewUnitView.pricingActive` (a szerver ugyanazzal a predikátummal oldja fel, mint a
képernyő-kapu); a súgó `admin-modules-rooms` bejegyzése a feliratokkal egyezően vezet.

## Kötő horgony

- `data-cit-rooms-link` — a gomb horga (az őr és a súgó-kép erre méri a jelenlétét és a célját)
- `mcfg-note--act` — a kétoszlopos jegyzet-sor osztálya
- `data-cit-pricing-link` — a tükör-gomb horga a Szobák képernyőn

## Képek

- `plan-mobile.png` — 390 px: a gomb a szöveg alatt, teljes szélességben (mindkét állapot)
- `plan-desktop.png` — 1280 px: a gomb a jegyzet jobb szélén (mindkét állapot)

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** Önhordó (a `citui.css` +
`citui-admin.css` beágyazva), Mobil/Asztali és Világos/Sötét váltóval; a gombok kattintva kiírják
a céljukat.
