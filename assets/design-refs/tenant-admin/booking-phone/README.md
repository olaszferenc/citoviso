# A tulaj foglaláskezelése telefonon — JÓVÁHAGYOTT TERV (FK-015, „A” változat)

**Jóváhagyva:** 2026-09-29, a tulaj szavai: *„A) verzió. Igen a döntésre váró kell ami Kártyanyitás
előtt is látszódjon a fő részen.”* (a koordinátor sessionön át). ·
**Kapcsolódó:** ADR-XXXX (ez a döntés), `../foglalasok-README.md` ① (a jelvény szabályát felülírja),
`../booking-queue-urgency/` ⑥ (a telefonos sorrendet felülírja), `../../console/mail-links/` (az
Üzenetek-fül döntés-linkjei — ④ változatlanul köt), `../booking-offer-scope/` (az ajánlat-lap, változatlan).
**Őr:** `scripts/booking-phone-check.mts` (piros önteszttel, pre-commit). ·
**Hatókör:** `src/server/bookingViews.ts` · `src/server/adminViews.ts`

`plan.html` a §2b kör működő vázlata (három változattal, méret-váltóval); **az „A” változat KÖT** — elvárt
viselkedés, nem stílus-javaslat. A `jovahagyas-*.png` képek a jóváhagyás pillanatát rögzítik (álló
390×844, fekvő 844×390, asztali).

## Miért létezik

Az éjszakai FK-015 kör (2026-09-28, 390 px) képei szerint a tulaj telefonon csak nehezen vezényli le a
döntést: a levélből a „Foglalások megnyitása” gomb a 844 px-es hajtás ALATT ült, ~36 px magasan; a gyors
döntés megerősítője alatt rögtön az ellentétes döntés állt, „Mégsem” nélkül; a visszaigazoló űrlap ~160 px-es
hasábba szorult, a vendég neve nélkül; a vendég telefonszáma sima szöveg volt; az új kérés nem jelent meg a
Teendők között; a naptár a mai hónapon nyílt („nincs foglalt nap”), miközben a kérés októberre szólt.

## Amit a terv KÖT

1. **A döntésre váró kérés kártyanyitás nélkül is látszik.** A Foglalások jelvénye a DÖNTÉSRE VÁRÓ kérések
   száma, és a fül megnyitásától nem tűnik el (a régi szabály: „még nem látott” — ez felülírva). Az Áttekintés
   tetején egy sáv mondja ki, hány kérés vár és a legsürgősebb mikor jár le; a Teendők között kérésenként egy
   sor, **„Döntök”** gombbal (a kérésre visz), árajánlat-kérésnél **„Ajánlatot küldök”** gombbal (az ajánlat-lapra).
2. **Telefonon a döntés áll elöl.** A Foglalások fülön (álló ÉS fekvő tartásban) a döntésre váró kérések
   állnak legfelül, a naptár közvetlenül alattuk, a csempék és a többi alattuk. A bevezető mondat a fül
   aljára került, az útmutató a cím melletti súgó-ikonná. Asztalon marad a jóváhagyott „naptár bal, lista jobb”.
   Az első kérés **„Visszaigazolom”** és **„Elutasítom”** gombja görgetés nélkül a képernyőn van, ≥ 44 px.
3. **A megerősítő a kártyán belül nyílik, teljes szélességben, és megnevezi a vendéget** (kérdés + időpont ·
   szoba · összeg + a következmény). Két gombja: **„Mégsem”** és **„Igen, visszaigazolom”** (elutasításnál
   **„Igen, elutasítom”**). A „Mégsem” semmit nem változtat. Amíg nyitva van, az ellentétes döntés gombja
   nem látszik. Az üzenet-mező egy koppintásra nyílik (**„+ Üzenetet írok a vendégnek”**), hogy a gombok
   a képernyőn maradjanak. JS nélkül is működik (a „Mégsem” ilyenkor visszavisz a kártyához).
4. **A naptár ott nyílik, ahol a következő döntés van:** a levélből nyitott kérés, különben a legsürgősebb
   kérés szobáján és hónapján, ha nincs ilyen, a következő érkezésén; visszaigazolás után nyitva, a döntött
   kérés hónapján (a foglalt napokkal). A csukott sor kimondja a kérést, és új napfajta jelöli a kért
   éjszakákat: szaggatott keret, jelmagyarázata **„kért éjszaka — döntésre vár, még NEM foglalt”** —
   koppintásra a kéréshez ugrik.
5. **A vendég egy koppintásra van:** **„Felhívom”** (`tel:` link) és **„Írok neki”** (`mailto:`) a kártyán;
   a levélben a telefonszám koppintható. A kártya alján link nyitja a naptárat a kért hónapon és szobán.
6. **A levél (Üzenetek fül) tetején a döntés:** ki · mikor · mennyi, a 48 px-es **„Foglalások megnyitása”**
   (AZT a kérést nyitja), alatta a **„Gyors döntés innen is:”** gombjai. A gyors döntés rákérdez a vendég
   nevével, és van **„Mégsem”**; a megnyíló megerősítő a képernyőre görgetődik.
7. **Az árajánlat-kártya magyarázata a kártya belső margóján belül** van (a régi a kártya széléig futott).
8. **Döntés után** a sáv megnevezi a következő kérést, és linkkel odavisz.

## Eltérések a vázlattól (a megvalósításkor, kimondva)

- **A naptár színei a mai Foglalások-naptáréi maradtak** (a vázlaton a vendég-foglalás sötétkék + pötty volt).
  A tervből csak az új napfajta („kért éjszaka”) köt; a többi szín a meglévő kontraktusoké.
- **Az Üzenetek gyors döntésének gombja „Igen, elfogadom” / „Igen, elutasítom” maradt** (a mail-links
  kontraktus ④ köti); a vázlaton ugyanitt „Igen, visszaigazolom” állt. A kérdés viszont a vendég nevét viszi.
- **A döntés utáni sáv** a vázlat „A napok foglaltak: …” mondata helyett a meglévő „A vendég e-mailt kapott
  róla.” mondatot tartja; a foglalt napokat a nyitva megjelenő naptár mutatja.
- A vázlat Áttekintése csak a döntés-út elemeit mutatta; a valódi lap többi része változatlan.

## Amit NEM köt

A B és C változat (felugró ablak · egy kérés = egy képernyő) — a tulaj nem ezeket választotta. A színek és
margók a `--citui-*` tokenekből jönnek.
