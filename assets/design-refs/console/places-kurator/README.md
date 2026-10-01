# Places-fotók kurátori gombja — jóváhagyott terv („B” változat: két forrás-sáv, 2026-10-02)

Tulajdonosi jóváhagyás: 2026-10-02, a koordinátor („Places API 600 $” session) közvetítésével —
miután három változatot (A: sor a rács alatt · B: két forrás-sáv · C: fejléc-gomb +
megerősítés) látott mobil és asztali képen, kattintható HTML-lel. A jóváhagyott a **B**.
Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.

Referencia: `plan.html` (működő mock: lead-eset választó, „A következő lekérés” eredmény-választó,
méret-váltó `@container`-rel), `B-*-mobil.png` / `B-*-asztali.png` (négy állapot), `img/` (minta-képek).

**Hatókör:** `src/console/views.ts` · `src/console/server.ts` · `public/assets/ui/citui-console.css`

## Miért van

ADR-0293 (A rész): a lead-lap Fotók panelje minden megnyitáskor és a generálás alatti 6–8 mp-es
újratöltéskor fizetős Places-lookupot vett (9 nap: 7 007 Text Search + 16 469 Photo Media; egy lead
126×). Tulajdonosi döntés (2026-10-01): Places-fotót a rendszer magától nem kér, kivéve ha a leadnek
egyáltalán nincs portál-fotója; a minőség KURÁTORI döntés — fizetős gomb a lead-lapon, amit a
felület ki is mond; minden Places-eredmény leadenként egyszer fizetve, lejárat nélkül tárolva.

## Mit KÖT a terv

1. **Két forrás-sáv.** Balra a **„Portál-adatlap”** sáv, jobbra a **„Google Places”** sáv, mindkettő
   fejlécén a darabszám. Asztalin (széles panel) egymás mellett, mobilon egymás alatt. A két méret
   két külön elrendezés. A nyitókép-választó („Legyen ez a nyitókép”) mindkét sávban él.
2. **A lap betöltése SOHA nem fizet.** A panel a tárolt választ olvassa (`GET /lead/:id/photos`,
   `places: "cached"`). Places-ért csak a kurátori gomb fizet (`POST /lead/:id/places-photos`,
   `places: "curator"`) — és a portál-fotó nélküli lead generálása, egyszer (A rész).
3. **A gomb kimondja, hogy fizetős.** Felirata **„Places-fotók lekérése”**, rajta a **„fizetős”**
   címke, mellette a mondat: fizetős Google-lekérés (1 hely-lekérdezés + legfeljebb 6 fotó),
   leadenként egyszer, az eredményt tároljuk, újra nem fizetünk érte. A gomb a Places-sáv üres
   helyén áll (szaggatott keretű doboz).
4. **Állapotok — mindegyiknek saját szövege és címkéje van a Places-sáv fejlécén:**
   - *nincs még lekérve* — doboz + gomb (portál nélküli leadnél a szöveg azt mondja: a generálás
     egyszer automatikusan lekéri, vagy most is lekérheted);
   - *lekérés folyamatban* — forgó jel, „ne frissítsd a lapot — a képek ide érkeznek”; ilyenkor
     nincs gomb (nincs dupla fizetés);
   - *lekérve* — a képek a sávban, alattuk: mikor, hány fotó, „Tárolva, újra nem fizetünk érte”, és
     mikor kérjük újra (név/hely változás vagy halott tárolt kép). Címke: **„Places: lekérve · tárolva”**;
     ha a generálás kérte (portál nélküli lead): **„Places: auto-lekérve · tárolva”**, és a szöveg
     kimondja, hogy automatikus volt. Gomb nincs.
   - *nincs találat* — „A Google nem talált fotót…”, az üres eredmény is tárolva, nem kérdezzük újra;
     a gyenge egyezés („nem biztos, hogy ez a szállás”) ugyanide tartozik. Gomb nincs.
   - *Places nem elérhető* (kvóta/kulcs/hálózat) — **„Places nem elérhető”**, az ok megnevezve, „Ez a
     mi korlátunk, nem a lead hibája”, és kimondja: ezért nem fizettünk, semmi nem tárolódott. Gomb:
     **„Újrapróbálom”** (fizetős címkével). Portál nélküli leadnél: a következő generálás magától
     újrapróbálja.
5. **A koordinátor válaszai (2026-10-01), a tulaj döntéseiből:** ① a „nem talált fotót” is eredmény —
   tároljuk, nem kérdezzük újra (csak név/hely változás vagy halott link esetén); ② a hiba
   (kvóta/kulcs/hálózat) nem eredmény — nem tároljuk, a kurátor újrapróbálhat, a portál nélküli lead
   automatikus lekérése a következő alkalommal újrapróbálódik; ③ dollár-összeg nem kell a felületre;
   ④ hogy az automatikus lekérés hol fut, az A rész dönti el — a panel csak az eredményt mutatja.
6. **A görgethető rács jelzi, hogy van még kép.** A sáv rácsa a panelen belül görget (max. 420 px);
   ha alul van még kép, a levágott sor elhalványul, és alatta egy sor mondja meg, hány kép van lent.
   (A tulaj mock-átnézésén derült ki, hogy jelzés nélkül a levágott sor hibának látszik.)

## Amit a megvalósítás a tervhez HOZZÁTETT (a terv nem mutatta, a kód állapotai igen)

- *elavult* (`stale`): a tárolt eredmény korábbi névre/helyre szól, vagy a tárolt kép halott — doboz
  az okkal + **„Places-fotók újrakérése”** gomb (fizetős címkével). A tulaj 5. döntése szerint ez az
  egyetlen eset, amikor újrakérdezünk.
- *nincs helykoordináta* (`no_coords`): a Places nem kérdezhető — csak egy mondat, gomb nélkül.
- *nincs API-kulcs a gépen*: a gomb nem némán hal el, hanem „Places nem elérhető” + az ok.
- *a kérés nem ért vissza* (a mi hálózatunk): nem Google-hibának nevezzük, hanem azt mondjuk, hogy
  frissítsd a lapot — ha a lekérés közben lefutott, az eredmény már tárolva van.

## Amit a terv NEM köt

A pontos árnyalatok és térközök: minden a `--citui-*` dizájn-magból jön (sötét módban is). A
minta-képek és a képaláírások csak minták.
