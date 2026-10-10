## ADR-0359 — Próba: amit az űrlap kiír, azt rögzíti a próba; a T−3 és a T−1 értesítő mindig kimegy

**Dátum:** 2026-10-11 · **Kontextus:** Elek 3. köre (próba „C” + névváltás, élesítés előtt), B2 és K3 lelet; koordinátori döntés a tulaj 3A-ja alapján (próba-koordinátor szál, 2026-10-10). Pontosítja: ADR-0354 ① (melyik ajánlatot pineli a próba), ADR-0088 §4 (eszkaláció), a próba-értesítők ütemezése (`noticeSendDay`, a hétköznap 9–16-os ablak).

### ① B2 — a kijelzett és a rögzített kedvezmény nem térhet el

**A probléma (mérve):** a próba-levélből (`forras=proba`) érkező, korábban már n-szer látogató leadnél az űrlap „−25% az első díjból…” sort írt ki, a lap látogatás-jelzése (`POST /p/<t>/view` → `ensureEscalationOffer`) viszont a háttérben −50%-os eszkalációs ajánlatot bocsátott ki (a kártya el volt nyomva, proba-c/2 A), és a próba indulásakor a `pinTrialOffer` a legnagyobbat, a −50%-ot rögzítette. Utána a belépő-levél, az admin és a folytatás −50%-ot mondott. A felület „egy kedvezmény” ígérete hazudott, és minden visszatérő kampány-kattintó csendben fele árat kapott.

**Döntés:**
1. **A próba-levélből jövő látogatás nem bocsát ki eszkalációs ajánlatot.** A tulaj 3A-ja: a próba-levélből jövőnek nincs döntés-segítő kártya → nincs eszkaláció sem. A lap a `forras` paramétert a látogatás-jelzésben elküldi; `forras=proba` esetén a szerver az `ensureEscalationOffer`-t nem hívja. Paraméter nélkül (a terv-lap közvetlen linkje) az eszkaláció változatlan.
2. **A próba azt az ajánlatot rögzíti, amit a lead az űrlapon LÁTOTT.** Az űrlap a kiírt %-ot a próba-indítással együtt elküldi (`offerPercent`), a `pinTrialOffer` ezt választja: a lead élő ajánlatai közül az ezzel a %-kal; ha ilyen nincs, de ez a bevezető % (`outreachPercent`), egy `campaign` sor ezzel a %-kal; a többi élő ajánlat lezárul. **Általános invariáns: amit a próba-űrlap kiír, azt rögzíti a próba.**
3. **Kliens-szám sosem áraz.** Ha a küldött % se a lead élő ajánlata, se a bevezető %, a régi szabály marad (a legnagyobb élő ajánlat), naplózva. Ha az űrlap nem írt ki %-ot (0), szintén a régi szabály.

**Őrök:** `free-trial-e2e` ⑩ (forras=proba → nincs eszkaláció, a lap −25%-ot kap; a próba a kiírt −25%-ot rögzíti; kontroll: paraméter nélkül az eszkaláció kibocsátódik; élő −50% mellett a −25%-ot kiíró űrlap → −25%, a −50% lezárva; kitalált −90% → nem áraz). A régi kóddal 4 FAIL (mérve). `proba-c-checkout-check` ⑥: a látogatás-jelzés valódi böngészőben viszi a `forras=proba` jelet.

### ② K3 — a T−3 és a T−1 értesítő mindig kimegy

**A probléma (mérve):** a hétköznap 9–16-os küldési ablak miatt a hétvégére eső lépcső péntekre került; hétfői lejáratnál a T−1 (vasárnap → péntek) a T−3 (péntek) napjára esett, és a szabály („t3 a t1 napján → csak t1”) a T−3-at elhagyta. A hétfőn indult 14 napos próba egyetlen értesítőt kapott, pénteken — miközben a siker-ablak ezt ígéri: „A lejárat előtt 3 nappal és 1 nappal e-mailben és SMS-ben is szólunk”.

**Döntés (koordinátori, a tulaj elvei szerint):** a T−3 és a T−1 **mindig** kimegy. Ha a napja hétvégére esik, az előző hétköznapra kerül; ha így a kettő egy napra (vagy a T−3 a T−1 utánra) esne, a T−3 még egy hétköznappal korábban megy. A levelek szövege a valós hátralévő napokból készül (`trialDaysLeft`), így a pénteki T−1 hétfői lejáratnál „Még 3 nap…”, nem „Holnap”. Csak az a lépcső marad el, amely a próba első napja elé esne (nagyon rövid próba).

**Őr:** `free-trial-expiry-check` ① — hétfői lejárat: T−3 csütörtök, T−1 péntek; mind a hét indulási napra (H–V) mindkét értesítő létezik, hétköznapra esik, külön napon, a T−3 az első, és mindkettő a próba utolsó napja előtt. A régi kóddal 2 FAIL (mérve).
