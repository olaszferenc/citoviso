## ADR-XXXX — Próba: amit az űrlap kiír, azt rögzíti a próba; a T−3 és a T−1 értesítő mindig kimegy

**Dátum:** 2026-10-11 · **Kontextus:** Elek 3. köre (próba „C” + névváltás, élesítés előtt), B2 és K3 lelet; koordinátori döntés a tulaj 3A-ja alapján (próba-koordinátor szál, 2026-10-10). Pontosítja: ADR-0354 ① (melyik ajánlatot pineli a próba), ADR-0088 §4 (eszkaláció), a próba-értesítők ütemezése (`noticeSendDay`, a hétköznap 9–16-os ablak).

### ① B2 — a kijelzett és a rögzített kedvezmény nem térhet el

**A probléma (mérve):** a próba-levélből (`forras=proba`) érkező, korábban már n-szer látogató leadnél az űrlap „−25% az első díjból…” sort írt ki, a lap látogatás-jelzése (`POST /p/<t>/view` → `ensureEscalationOffer`) viszont a háttérben −50%-os eszkalációs ajánlatot bocsátott ki (a kártya el volt nyomva, proba-c/2 A), és a próba indulásakor a `pinTrialOffer` a legnagyobbat, a −50%-ot rögzítette. Utána a belépő-levél, az admin és a folytatás −50%-ot mondott. A felület „egy kedvezmény” ígérete hazudott, és minden visszatérő kampány-kattintó csendben fele árat kapott.

**Döntés:**
1. **A próba-levélből jövő látogatás nem bocsát ki eszkalációs ajánlatot.** A tulaj 3A-ja: a próba-levélből jövőnek nincs döntés-segítő kártya → nincs eszkaláció sem. A lap a `forras` paramétert a látogatás-jelzésben elküldi; `forras=proba` esetén a szerver az `ensureEscalationOffer`-t nem hívja. Paraméter nélkül (a terv-lap közvetlen linkje) az eszkaláció változatlan.
2. **A próba azt az ajánlatot rögzíti, amit a lead az űrlapon LÁTOTT.** Az űrlap a kiírt %-ot a próba-indítással együtt elküldi (`offerPercent`), a `pinTrialOffer` ezt választja: a lead élő ajánlatai közül az ezzel a %-kal; ha ilyen nincs, de ez a bevezető % (`outreachPercent`), egy `campaign` sor ezzel a %-kal; a többi élő ajánlat lezárul. **Általános invariáns: amit a próba-űrlap kiír, azt rögzíti a próba.**
3. **Kliens-szám sosem áraz.** Ha a küldött % se a lead élő ajánlata, se a bevezető %, a régi szabály marad (a legnagyobb élő ajánlat), naplózva. Ha az űrlap nem írt ki %-ot (0), szintén a régi szabály.

**Őrök:** `free-trial-e2e` ⑩ (forras=proba → nincs eszkaláció, a lap −25%-ot kap; a próba a kiírt −25%-ot rögzíti; kontroll: paraméter nélkül az eszkaláció kibocsátódik; élő −50% mellett a −25%-ot kiíró űrlap → −25%, a −50% lezárva; kitalált −90% → nem áraz). A régi kóddal 4 FAIL (mérve). `proba-c-checkout-check` ⑥: a látogatás-jelzés valódi böngészőben viszi a `forras=proba` jelet.
