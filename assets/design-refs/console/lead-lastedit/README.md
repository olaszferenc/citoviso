# Lead-fülek: ki szerkesztette utoljára — jóváhagyott terv (A változat, 2026-10-05)

Tulajdonosi jóváhagyás: **2026-10-05** („A verzió"). A tulaj három változatot látott asztali ÉS
mobil képen, kattintható HTML-lel. Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés,
nem stílus-javaslat.

Referencia: `plan.html` (kattintható, „Mobil 390px / Asztali" váltóval; a fotók a méret miatt
kivéve, a mock-kártyák pillanatképe bent), `A-asztali.png`, `A-mobil.png` (Rozé Fogadó valós
lead-lapja, MINTA-nevekkel).
Elvetve: `elvetett-B-asztali.png` (a fül-mondat alatti „Utoljára…" sor + lenyíló előzmények),
`elvetett-C-asztali.png` (monogram-pötty a fülön + külön „Napló" fül).

Testvér-kontraktusok: `../lead-page/` (fülsor + fül-mondat), `../mock-cards/` (mock-kártya).

## Miért van

A tulaj kérése (2026-10-05): „a leadnél látszódjon, hogy adott tabot ki szerkesztette utoljára
(pl. mockot ki hozta létre)". Ma ez SEHOL nincs tárolva: a lead-, mock-, megkeresés-tábláknak nincs
szerző-mezője, a `curator_decision.decided_by` pedig minden sorban a beégetett „console" szöveg
(dev DB, 26/26 sor), vagyis a kártya „Döntés" sora ma hamis szerzőt mutat.

## Mit KÖT a terv

1. **Minden fül KÉT sort visel:** felül a fül neve, alatta kisebb, halványabb sorban a
   legutóbbi szerkesztő monogram-pöttye + neve + ideje (pl. „ferenc · ma 13:20",
   „elek · tegnap 16:20", régebbi: „10.02. 10:03"). Az aktív (fehér) fülön a sor muted színű,
   az inaktívakon a navy sávon halvány fehér — a kontraszt-őrön át kell mennie.
2. **Nincs adat → „—"** a második sorban (pl. csak olvasható „Forrás-csomag" fül, vagy a napló
   indulása előtti állapot). Soha nem marad üresen, és soha nem hazudik szerzőt.
3. **Szereplő-fajták:** operátor (monogram a felhasználónévből), a szállás tulaja (pl. konfigurátorból
   leadott csomag-igény), rendszer (ütemezett/automatikus futás). A három megkülönböztethető.
4. **Mock-kártya:** a cím-alsor alatt új sor „Létrehozta: <név>" (+ „kurátori szöveggel", ha az
   volt). A napló előtti mockon „Létrehozta: nem rögzített (a napló előtti mock)".
5. **Döntés-sor:** a zárójelben a VALÓDI operátor neve áll (a beégetett „console" kivezetve);
   a régi, „console"-os sorok „nem rögzített"-ként jelennek meg.
6. **Mobil (390 px):** a fülsor vízszintesen görget, mint eddig; a kétsoros fül nem tör
   vízszintes túlcsordulást a lapon.

## Nyitott (a megvalósítás előtt a tulajjal tisztázandó)

- Az adatmodell neve és mezői (javaslat: `lead_activity` napló-tábla — `lead_id`, `tab`, `action`,
  `actor_kind` operátor|tulaj|rendszer, `operator_id` → `operator_user`, `actor_label`,
  `subject_id`, `at`), és a `curator_decision.decided_by` valódi névre állítása.
