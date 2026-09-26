# KONTRAKTUS — a megvásárolt modulok listája az oldalsávban, a „Modulok” alatt

**Jóváhagyva:** 2026-09-25, tulajdonosi döntés. Két változatot kapott (A: fa-vonalas lista,
csak a Modulok fülön nyitva · B: pöttyös lista, mindig nyitva), a válasza az A változat volt,
egy kiegészítéssel: a Modulok menüpontra kattintva a lista AZONNAL nyíljon le.
(A tulaj szavát szándékosan nem félkövér idézőjelben írjuk — az a kötő feliratok jelölése.)

- Terv: `module-subnav.html` (önhordó, kattintható; valós Boróka ház adattal, a fő fa :4800-ról
  olvasva; a lapon belüli szkriptek kivéve, csak a navigáció működik)
- A jóváhagyott kép: `modul-kepernyo-desktop.png` (modul-képernyő, lista nyitva, a modul kiemelve),
  `mas-ful-csukva-desktop.png` (más fül: a lista csukva), `menu-mobile.png` (telefon: Menü-fiók)

**Hatókör:** `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css` · `src/server/public.ts`
(a nyitott modul azonosítója)

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **A lista tartalma** ugyanaz a predikátum, amit a Modulok lap a „Beállítás” gombhoz futtat:
   aktív, nem váltotta ki másik modul, és van beállító képernyője. Ami a Modulok lapon nem
   kattintható beállításra, az itt sem jelenik meg (a Boróka háznál: 11 aktívból 10 — az
   „Időpontkérés”-t az Online foglalás kiváltja).
2. **Kattintás egy modulra** = a modul beállító képernyője (`/admin?tab=modulok&m=<id>`), a sor
   kiemelve, a szülő „Modulok” félkövér + akcent-ikon, de nem teli kiemelés.
3. **Nyitott állapot:** a Modulok fülön és bármelyik modul képernyőjén a lista NYITVA érkezik
   (szerver-oldalon, JS nélkül is); más fülön CSUKVA. A nyíl az adott lapon nyit/csuk, a
   választást NEM jegyzi meg — így a Modulok menüpontra kattintás MINDIG nyitott listát ad,
   és a kattintás pillanatában már le is nyílik.
4. **Útvonal a modul képernyőjén:** `<szállás> › Modulok › <modul neve>`, a „Modulok” link.
5. **Számláló** a Modulok soron = a lista elemszáma (egy sor = egy mértékegység). Az
   előfizetés-kártya „N modul aktív” sora változatlan (az az aktív modulokat számolja).
6. **Ikonsávvá csukott oldalsáv:** a lista és a nyíl rejtve, a Modulok ikon a fülre visz.
7. **Telefon:** a Menü-fiókban ugyanez a lista, nagyobb érintési felülettel (a nyíl 40 px).
8. Nincs aktív, beállítható modul ÉS nincs meg nem vett modul → nincs nyíl, nincs lista, sima menüpont.
9. **A meg nem vett modulok** (kiegészítés, 2026-09-26 — a tulaj háromból az „A” változatot
   választotta; terv: `meg-nem-vett-A.html`, képek: `meg-nem-vett-desktop.png`,
   `meg-nem-vett-menu-mobile-sotet.png`, `meg-nem-vett-kattintas-mobile.png`):
   - a megvett modulok ALATT, saját címke után („Még nem vette meg · N”), halvány sorokként,
     jobb oldalt kerek cián + jellel;
   - a tartalom ugyanaz a predikátum, amivel a Bővítés rész a kártyáit listázza (nem aktív,
     nem gerinc) — minden sornak van kártyája, amire érkezik;
   - kattintás = `/admin?tab=modulok#mod-<id>`: a Bővítés kártyájára ugrik, a kártya keretet
     kap (`:target`), a telefonos Menü-fiók bezárul. A sor maga NEM vásárol — a vásárlás a
     kártya gombján és a kosár-sávon marad;
   - a Modulok melletti számláló TOVÁBBRA IS a megvett (beállítható) modulokat számolja (⑤); a
     meg nem vettek száma a saját címkéjükben áll — egy szám = egy mértékegység;
   - nyitás/csukás, ikonsáv, telefon: ugyanaz, mint ③ ⑥ ⑦.

## Kötő feliratok

- **„Modulok listája”** — a nyíl akadálymentes neve (a vak felhasználó ebből tudja, mit nyit).
- **„Még nem vette meg”** — a meg nem vett modulok címkéje (⑨); a darabszám külön elem mögötte.

## Kötő horgony

- `adm-nav__mod`
- `adm-nav__sub`
- `adm-menu__mod`
- `adm-menu__sub`
- `data-subtg`
- `adm-nav__buyh`
- `data-buy`
