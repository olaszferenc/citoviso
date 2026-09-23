## ADR-0147 — A láthatóság verdiktje KÉT kérdés: kifestve ÉS nem takart; animált megjelenést nem órára mérünk (2026-09-14)

- **Kontextus:** a `configurator-float-check` pirosat jelzett az `origin/main`-en (aurora,
  asztali, `opacity: 0`), egy párhuzamos szál landolását megállítva. A szál három fán is
  megmérte — mindenhol ugyanaz —, ezért repó-szintű, korábbi hibaként külön szálra került.
  Megmérve **nem termék-hiba**: a vásárlás-pirula MINDEN mérésben megjelenik. Az őr volt hibás,
  és **mindkét irányban**.
- **A mérés (2026-09-14, aurora/1280×900):**
  1. **A piros.** Az őr a görgetés után FIX 700 ms-mal mintázott. A megjelenés az aurorán
     **438–1047 ms** között szóródik (a lap saját görgetési munkája dönti el, nem a mi kódunk;
     a többi sablon ~150 ms). Ugyanazon a **változatlan** buildon, ugyanezen a gépen:
     **10 futásból 4 PIROS**. Érme-feldobás, ami fantom-regressziót jelentett.
  2. ⛔ **A zöld fele volt a veszélyesebb.** 700 ms-nál a pirulán már rajta volt a
     `pointer-events: auto`, és az `elementFromPoint` **eltalálta** — miközben az `opacity`
     pontosan **0** volt, és a levágott képernyőképen **nincs ott semmi**. Vagyis az őr hat
     futásból hatszor egy **láthatatlan vásárlás-gombot** igazolt kattinthatónak.
  3. **A vevő útja rendben van:** görgetésre 1,0–1,8 s alatt kifestődik; aki **egyáltalán nem
     görget**, annak a feltétel nélküli `setTimeout(showPill, 2600)` tartalék festi ki
     (mérve 3,3–3,6 s). A `scroll-behavior: smooth` és az aurora nehéz lapja lassítja, de
     sosem tünteti el.
- **Döntés:**
  1. **A láthatóság verdiktje KETTŐ, egymást nem helyettesítő kérdés.** „**Kifestve**"
     (`opacity === 1`) = látja-e ember; „**nem takart**" (`elementFromPoint`) = takarja-e
     valami. Az `elementFromPoint` az **átlátszó elemet is eltalálja** — önmagában sosem
     láthatósági verdikt. (Ez a ház `isVisible()`-tilalmának a folytatása, nem a cáfolata: az
     `isVisible()` a DOM-ra vak, az `elementFromPoint` a PIXELRE.)
  2. **Animált megjelenést nem órára mérünk.** A várakozás a **pixelre** vár (rAF-enkénti
     poll, amíg ki nem fest), nem egy kitalált ms-ra. A keret **kimondott**, és a termék saját
     állandóiból származik (`showPill` 2600 ms + 500 ms áttűnés + 4 s gép-terhelési ráhagyás),
     nem egy szerencsés mintavételből. Ha sosem fest ki: **PIROS**, nem elnyelt timeout.
  3. **Az őr fájlja is triggerelje a saját őrét.** A `configurator-float-check` eddig csak a
     motor/konfigurátor-réteg változására futott — a saját átírása ellenőrizetlenül ment át,
     pedig a hibaosztály egy CSS-sor és egy időzítés.
- **Őr (mind a háromra piros önteszt):** ② páncél nélkül az aurora belépője kiesik a fixed
  rétegből · ③ **átlátszóra állított `.cit-cfg-in`**: a geometriai verdikt itt **ZÖLD marad**
  (ez a lényeg — vak rá), a láthatósági **PIROSRA megy** · ④ a nem-görgető látogató.
  **19 sablon × 3 állítás + 4 önteszt**, két egymás utáni teljes futás zöld.
- ⚠️ **Amit magam rontottam el:** az első keretem 5000 ms volt, és a teljes futásban 4624 ms
  jött ki — **alig-átmenő érték**, vagyis a következő érme-feldobás. Külön mérve a
  terhelésmentes szórás 3255–3591 ms → ~1 s a keretből GÉP-TERHELÉS, nem termék-viselkedés;
  ezért lett a keret levezetve, nem tippelve.
- **Visszafordíthatóság:** 🔄 csak mérőeszköz — termék-kód nem változott.
- **Státusz:** ELFOGADVA (2026-09-14). Élesítés NINCS (§0.3).
- ⚠️ **Iker-javítás:** ugyanennek a pirosnak a *piros felét* egy párhuzamos szál is javította
  (`1ee2fe8`, `waitForSelector(".cit-cfg-in")` + 700 ms) — a rebase konfliktusban jött elő. Az
  ő változata a fantom-pirosat gyógyítja, a **hamis zöldet nem**, ezért az övé elesett és ez a
  blokk lépett a helyére.
- ⚠️ **Sorszám:** ez a blokk `0146`-ként készült, de a landolás pillanatában egy párhuzamos
  szál `0146`-ot landolt (a teszt-forgatókönyv felirat-őre), ezért lett `0147`. A sorszámot
  `git fetch` után, közvetlenül írás előtt ellenőriztem — **a landolás pillanata is ütközhet**.
