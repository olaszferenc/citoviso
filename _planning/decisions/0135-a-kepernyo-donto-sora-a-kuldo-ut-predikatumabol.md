## ADR-0135 — A képernyő döntő sora a KÜLDŐ-ÚT predikátumából származzon, ne a kapuk egyikéből (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0130 (ugyanaz a lap,
ugyanaz a futás), ADR-0082/0122 (csatorna- és cím-szintű egy-lövés), ADR-0095 (kurátori
kapu), 03-INVARIANTS §C.

> ⚠️ Ez a szál **0131-ként** írta meg magát, és a szám **NÉGYSZER** csúszott el alóla, mire
> landolt: 0131 (FK-004 H1) → 0132 (súgó-ADR) → 0133 (egyediség-állítás) → 0134 (törött képes
> mock) → és végül a jelen szám. Mindegyik AZALATT kelt el, amíg az előző ütközést oldottam.
> **Tanulság:**
> a `git fetch` az írás előtt nem elég, és a land pillanatában sem elég egyszer ellenőrizni —
> a verseny a kapuk ~10 perces futása ALATT dől el, ezért a számot közvetlenül a `rebase
> --continue` ELŐTT kell újraszámolni. Az átszámozás azért maradt olcsó, mert a szám kevés
> helyen él (ADR-fejléc, session-jegyzet, memória-index, MEMORY.md, commit-üzenet) —
> **kódba egyetlen ADR-szám sem került**.
>
> ⛔ **És egy saját hiba, ami ebből lett:** az átszámozást automatizáltam egy fájl-széles
> `replace`-szel, ami MÁS szálak ADR-számait is átírta a `DECISIONS.md`-ben, a `MEMORY.md`-ben
> és a memória-indexben (0131→0134, 0132→0134). A javítás: a három közös doksit **újraépítettem
> az `origin/main`-ről**, és CSAK a saját betoldásomat tettem vissza. Közös fájlban a
> „cseréld ki mindenhol" művelet nem átszámozás, hanem adatvesztés — a saját blokkodat kell
> megcímezni, nem a mintát.

**Kiváltó (Elek FK-004 Z1 + Z2, tulaj-bejelentés).**

- **Z1:** a lap tetején zöld „Jogszerűségi kapu: PASS — küldhető" jelvény állt, közvetlenül
  alatta piros „⚠ A levél linkjei ide mutatnak: mineral.tail3a89f.ts.net — nem a feladó
  domainje". Két ellentétes jelzés, és **semmi nem mondta meg, melyik dönt**. (Nem a piros:
  a küldés végbement.) Az operátornak találgatnia kellett egy visszafordíthatatlan gomb előtt.
- **Z2:** a küldés UTÁN is „PASS — küldhető" állt a képernyőn, miközben a csatorna a saját
  szövege szerint kimerült („Egy csatornán csak egyszer megy ki hideg megkeresés").

**Mérve (a premissza alatt egy nagyobb hiba).** A `sendOutreachMail` **kilenc** okból utasít
el (leiratkozás · csatorna-egylövés · cím-szintű egy-lövés · suppression · hiányzó
contact_email · hiányzó vagy nem jóváhagyott mock-artifact · hiányos nyelvi csomag · §C-kapu ·
artifact-verdikt), a jelvény pedig **egyet** mért ezekből. 2026-09-13-án mérve: három ELEK-
prospect „küldhető"-t mutatott volna, miközben a küldő-út „a mock kurátori jóváhagyásra vár"-ral
dobta vissza őket. **A jelvény tehát nem tévedett — más kérdésre válaszolt**, mint amit az
operátor feltesz.

**Döntés.**

1. **A lap döntő sora a küldő-út SAJÁT verdiktje.** Új `describeMailSendability(prospectId)`,
   ami ugyanazt a `sendOutreachMail`-t futtatja `dryRun`-ban: „E-mail: most kiküldhető" vagy
   „E-mail: most NEM küldhető — <a küldő-út saját indoklása>". ⛔ A nézet NEM vezeti le újra
   abból az állapotból, amit épp betöltött — az a szabály második példánya lenne, és pont az a
   bejelentett hiba.
2. **Új `probe` kapcsoló, EGY különbséggel, kimondva.** A száraz futás egyetlen lépése drága:
   az `ensureLanguagePack` **provisionálna** (AI-hívás + DB-írás), amit egy GET-render nem
   tehet meg. Probe módban a hiányt **megmérjük** (`missingPackStrings`) — ez a SZIGORÚBB
   irány, tehát a próba **soha nem lehet megengedőbb**, mint a valódi küldés.
3. **A §C-jelvény csak azt állítja, amit ítél:** „Jogszerűségi kapu: PASS", illetve
   „Jogszerűségi kapu: FLAG — ez tiltja a küldést". A „küldhető" nem az ő ítélete volt.
   ⚠️ Az első vágásom „Jogszerűségi kapu **(§C)**"-t írt, és az ADR-0126 őre jogosan dobta ki:
   a doktrína-szakasz FEJLESZTŐI azonosító, nem felhasználói szöveg. A jelvény attól lett igaz,
   hogy nem ígér küldhetőséget — nem attól, hogy megnevezi a saját paragrafusát.
4. **A nem-blokkoló figyelmeztetés megmondja magáról, hogy nem blokkol** („⚠ Figyelmeztetés
   (nem blokkol): …"). Egy verdikt-alakú piros sáv egy zöld alatt, magyarázat nélkül, a
   visszafordíthatatlan gomb mellett: ez volt a Z1.

**Őr (`scripts/outreach-sendability-check.mts`, pre-commitba kötve).** A KIRENDERELT lapon
mér, 20 valós prospecten: ① a lap állítása = a küldő-út verdiktje · ② a §C-jelvény soha nem
ígér küldhetőséget · ③ elhasznált csatornán a lap nem állíthat küldhetőt · ④ a figyelmeztetés
kimondja, hogy nem blokkol. **Negatív önteszt:** a lapnak hazug („mehet") állítást adva
**10 mérés megy pirosra**. ⚠️ A ② szabályt ez a hazugság nem falszifikálja (az csak az
állítást hamisítja, a jelvényt nem), ezért a ② külön, a **2026-09-13-án ténylegesen kiment
jelvény-szövegen** bizonyítja, hogy egyáltalán lát valamit — különben zöld sor lenne, ami
sosem mérhetett semmit.

**Visszafordíthatóság:** 🔄 kód-szintű. A drágább rész (egy száraz futás page-renderenként,
~6 SELECT) a helyes válasz ára; ha valaha sokat számít, a predikátum cache-elhető — de a
képernyő akkor sem vezetheti le újra a saját fejéből.
