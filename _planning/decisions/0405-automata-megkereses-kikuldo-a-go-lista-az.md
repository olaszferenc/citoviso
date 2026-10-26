## ADR-0405 — Automata megkeresés-kiküldő: a go-lista az adatbázisban, éles időzítő üríti

**Dátum:** 2026-10-26 · **Állapot:** elfogadva (tulaj) · **Érinti:** ADR-0134, ADR-0329, ADR-0334, ADR-0112

### Kontextus
A tulaj, szó szerint: „SOS javítsunk minden olyan tételt, ami ahhoz kell, hogy mielőbb elindulhasson
az automata kiküldés … ezerszer kértem … ez a cél.” Ugyanaznap: „ez nem azt jelenti, hogy szar
minőségben és mindenáron kiküldjük.”

Eddig a kiküldésre jóváhagyott lista (MEHET) szövegfájlokban élt a dev gépen
(`~/rc-carry/mms-pace-*/go-*.txt`, író: `~/rc-briefs/va-mehet.sh`), és egy Claude-session
leadenként kattintotta a konzol `send-all` gombját. Ha nem ült ott session, semmi nem ment ki:
10-08 és 10-26 között egyetlen hideg megkeresés sem ment, miközben ~468 kész mock várt.
Élesen nem volt kiküldő időzítő.

### Döntés
1. **A go-lista az adatbázisba kerül:** `outreach_dispatch` tábla (0115), leadenként egy sor
   (`queued → sending → sent | held | skipped | cancelled`). Sorba tenni csak kurátor által
   jóváhagyott (`approved`), a leadhez tartozó mockot lehet, és csak még meg nem keresett leadet.
2. **Éles időzítő** (`citoviso-outreach-dispatch.timer`, 4 percenként): futásonként legfeljebb
   EGY lead, csak hétköznap 9–16 (Budapest), napi plafon alatt, és csak bekapcsolt főkapcsolóval
   (`app_setting outreach_auto` = `{"enabled":…,"dailyCap":…}`, alapból KI, plafon alapból 40).
3. **Egyenértékű a kézi úttal, nem rövidítés.** A futás a konzol `send-all` lépéseit hívja
   ugyanazokkal a függvényekkel: kép-kapu → `createProspect` → őr-lelet/Vera-ellenőrzés →
   `sendOutreachMail` → `startOutreachPair` → tevékenység-napló. Minden küldési kapu
   (leiratkozás, egy-lövés, cím-zár, §C, nyelvi csomag, kép-egészség, verdiktek, ablak)
   a függvényeken belül újrafut.
4. **Az automata soha nem vállal helyettünk.** Ahol a konzol emberi kattintást kér (megerősíthető
   őr-lelet, kép-kapu tudomásulvétele, hiányzó vagy elavult Vera-ellenőrzés), a sor `held`
   állapotba kerül az okkal, és ember dönt (`requeue` / `cancel`). Egy félbeszakadt futás
   (`sending` 30 percnél régebben) szintén `held`, nem automatikus újrapróba: lehet, hogy kiment.
5. **A statisztika nem változik:** a riport továbbra is a `prospect.sent_at`-ből számol; az
   automata ugyanazt a prospectet és ugyanazt a bélyeget állítja, mint a kézi küldés.

### Eszköz
`npx tsx scripts/outreach-dispatch.mts status | add | import | requeue | cancel | on | off | cap | list | tick`.
Az élesi `on`, `cap`, `add`/`import` éles írás: a tulaj engedélyével (CLAUDE.md §0.3).

### Elvetett
- **Időzítő a dev gépen, ami a konzol send-all végpontját hívja a fájl-listából:** gyorsabb lett
  volna, de a döntés továbbra is fájlban élne, amit az éles rendszer nem lát, és az operátori
  munkamenetet egy szkriptnek kellene utánoznia.
- **„Minden jóváhagyott + Vera PASS mock automatikusan megy”:** a MEHET több ennél (iker,
  egy-gazda-több-szállás, kép-levétel, -bb ítélete) — a sorba tétel kimondott döntés marad.

### Következmény
- A diszpécser (-bb) MEHET-lépése a fájl mellett az éles sorba is beír (`add`); a meglévő
  go-listák egyszeri `import`-tal kerülnek át, a generátorhiba miatt TARTVA sorok nélkül.
- A tartott (`held`) sorok listája (`list --status=held`) a kurátor napi teendője.
