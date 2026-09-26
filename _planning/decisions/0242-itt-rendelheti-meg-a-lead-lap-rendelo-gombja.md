## ADR-0242 — „Itt rendelheti meg”: a lead-lap rendelő gombja mindig kint van, platform-színű, és a Foglalás-sáv fölött ül

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) · **Szál:** „C — indító gomb” (a telefonos rendelés-bejelentés három párhuzamos szálának egyike: A két lépés, B görgetés, C gomb)

### Kontextus

A tulaj telefonról, a Három Huszár mock lead-nézetén (2026-09-26 20:02): *„Az »állítsa össze« gomb van, amikor eltűnik. Ennek mindig láthatónak kell lennie. A szöveg legyen: »Itt rendelheti meg«. Színe a gombbal mindig egyezik a mock gomb színével. Kurvára nem feltűnő.”*

Mérve a kódban: ① a `collapse()` (fül, mellé-koppintás, Esc) `launch.hidden = true`-t írt, és csak a perem-fül maradt, egy felirat nélküli nyíl; ② első betöltéskor a gomb 2,6 mp-ig vagy az első görgetésig nem volt kint; ③ a háttere `var(--cit-accent)` volt, vagyis pontosan a sablon CTA-színe (a képen a piros „FOGLALÁSI IGÉNY”), így a lead a mock egyik gombjának olvasta; ④ a kikerülő (`placeLaunch`) a pirula oszlopában MINDEN fő gomb fölé felmászott, a lappal együtt mozgókéra is, így 390 px-en a dark-luxury hős-gombjai fölé, a bevezető szövegre ült, és görgetésenként ugrált.

§2b terv-kör: valódi Három Huszár mockok (5 stílus, sötét és világos, köztük türkiz akcentű) a valódi panellel, három színváltozat (A fix cián · B cián, türkiz akcentnél lila · C fekete-fehér kontraszt-pirula). A tulaj a **B**-t választotta, és a gomb helyének a Foglalás-sáv fölöttit (kérdőív; egy korábbi, azonos tartalmú válasz tévedésből a koordinátor-sessionből érkezett, a tulaj ezután maga válaszolt és megerősítette). Kontraktus: `assets/design-refs/prospect-page/order-pill/`.

### Döntés

1. **Felirat:** „Itt rendelheti meg”, aria: „Itt rendelheti meg a saját weboldalát” (`tr()`, katalógus).
2. **A gomb mindig kint van**, csak a nyitott panel és a döntés-segítő kártya fátyla alatt nincs. Betöltéskor 0,3 mp után beúszik. Lecsukás után visszajön, és ugyanazt az összeállítást nyitja meg; lecsukott állapotban a perem-fül rejtve van, mert telefonon a gomb alá esett volna.
3. **Szín: platform, soha nem a sablon akcentje.** Cián (`#1fb6d6`, sötét felirat), fehér perem, pulzáló gyűrű. Ha a sablon `--cit-accent`-je a ciánhoz 45°-on belül van a színkörön, lila (`#6d4aff`, fehér felirat). A kiválasztás a JS-ben történik (`pickLaunchColour`, `cit-cfg-launch--alt`); a CSS a `--citui-cyan-500`/`--citui-accent-ink` értékét tükrözi, mert a mock-lapon a `citui.css` nincs betöltve.
4. **Hely:** a pirula alsó éle a képernyő aljához rögzített legfelső réteg (a sablon Foglalás-sávja, süti-sáv) fölött ül, 10 px réssel. A lappal együtt mozgó gombok fölé nem mászik. Ha egy ilyen fő gomb kerülne alá, **oldalt vált** (telefon: jobb → bal; asztal: közép → jobb → bal), és csak ha minden oldal foglalt, akkor lép feljebb a régi módon. A FK-004b H-3 (a pirula ne temessen be fő gombot) tehát változatlanul áll. A sablon Foglalás-sávja a süti-sávra rétegződik, ezért az „alsó réteg” a süti-sáv tetejétől is számít (mérve: a képernyő alsó 40 px-ét figyelő első változat a sávot nem látta, és a pirula rá ült — a `lead-mobile-check` fixture-je fogta meg).
5. **Őr:** `lead-mobile-check` R8 — a koppintás pillanatában (a süti-sáv már kint) a pirula egyetlen rögzített alsó réteget sem fed át; a mérés átfedés, nem a termék küszöbe; a teljes képernyős dekor-háttér (>60 % magas) nem sáv. Piros önteszt: a futtatott JS-ből kivágott sáv-érzékelés.

### Következmények

- A `configurator-float-check` nem-görgető költségvetése a termék új állandójából számol (300 ms, volt 2 600), vagyis szigorúbb lett.
- Az FK-009 forgatókönyv a „Itt rendelheti meg” feliratra vár. A korábbi `first-screen-compact` terv képei a régi feliratot mutatják; az történeti kontraktus, nem íródik át.
- A pirula oldalt is válthat, ezért egy képernyőképen nem mindig ugyanott van. A kép-alapú őröknek a pirulát elemként kell keresniük, nem fix koordinátán.
