# Modul le/feliratkozás + előfizetés-kezelés — jóváhagyott terv (B változat)

**Jóváhagyva:** 2026-08-28 (tulajdonosi döntés: „Nekem B tetszik. Fontos, hogy lássa
hogyan módosul a havidíja instant és erősítse meg.") · **Kapcsolódó:** ADR-0080 ②③⑤⑥.

A `modules-billing-B.html` a megvalósítás KONTRAKTUSA — elvárt VISELKEDÉS, nem
stílus-javaslat. A kész felületet ehhez mérjük (ui-shot, mobil 390 + desktop).

## Amit a terv KÖT

1. **Gyűjtött módosítások, megerősítéssel.** A kapcsolók önmagukban NEM élesítenek.
   Minden eltérést egy alsó, sötét tervsáv gyűjt soronként, kimondva a következményt:
   - bekapcsolás → „azonnal élne — első díj: <fordulónap>" (ADR-0080 ② B-opció)
   - lemondás → „<fordulónap>-ig aktív maradna"
   Érvényesítés CSAK az „Alkalmazom a módosításokat" gombbal; „Elvetem" visszaáll.
2. **A díj-változás INSTANT látszik, számmal** (tulajdonosi kiemelés): a tervsáv a
   következő számla új összegét ÉS a mostanihoz képesti különbséget is mutatja
   („7 730 Ft (+490 Ft a mostanihoz képest)"), színkódolva; az Előfizetés-kártya
   „Következő számla" cellája és tétel-listája élőben frissül a kapcsolókkal.
3. **Előfizetés-kártya fent:** fordulónap · jelenlegi díj · következő számla
   (dátummal) + kibontható tételes lista (alapdíj + modulok, az új tétel jelölve).
4. **Alkalmazás után visszaigazolás:** zöld összegzés — mi él mostantól (első díj
   dátummal), mi marad aktív a fordulóig.
5. **Lemondott modul soron belül:** sárga jelvény „Lemondva — <fordulónap>-ig aktív
   marad" + „Visszakapcsolom" link (ingyenes, hiszen ki van fizetve).
6. **Fizetési állapot-sávok** a kártya tetején: rendezetlen díj (sárga, „Díj
   rendezése" gomb a fizetőlinkkel) és felfüggesztve (piros, „…és visszakapcsolás");
   a szöveg kimondja: fizetés után automatikusan, azonnal visszakapcsol.
7. **Teljes előfizetés lemondása** külön veszély-zónában a lap alján: kétlépcsős
   megerősítés → „Előfizetése <fordulónap>-án zárul" állapot + „Meggondoltam magam"
   visszaút. A honlap a kifizetett időszak végéig él (ADR-0080 ③).
8. **Kiváltás-szabály látszik:** az Online foglalás bekapcsolása az Időpontkérést
   kiváltja („nem számítjuk") — a sor elhalványul, az ok kimondva.
9. **Nincs fizetési átirányítás** modul-bekapcsolásnál (a 0033 instant-pay upsell
   flow-t a B-opció váltja); az egyszeri díjas multilang (ADR-0063) saját kártyáján,
   saját flow-val marad.

## Mock-króm (NEM a termék része)

A felső sötét sáv (Mobil/Asztali váltó + demó-állapot gombok) csak a bemutatót
szolgálja; a demó-állapot váltó a 6. pont sávjait mutatja meg.
