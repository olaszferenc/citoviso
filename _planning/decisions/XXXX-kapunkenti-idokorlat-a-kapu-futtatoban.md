## ADR-XXXX — Kapunkénti időkorlát a kapu-futtatóban: a vissza nem térő kapu HANGOSAN piros, a teljes folyamatfája leállítva (`scripts/lib/gate-runner.mjs`) (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** a kapu-koordinátor (`cit3bd83952`) javaslatára: *„ok elfogadom”*.
  Brief: `~/rc-briefs/kapu-job-idokorlat.md`.
- **Előzmény:** ADR-0227 (párhuzamos kapu-futtatás), ADR-0230 (gépi slotok), ADR-0265 (kapuidő-előzmény),
  memória: `reference_gate_runner_has_no_job_timeout_chromium_hang`.

**A tény:** a futtatóban nem volt kapunkénti időkorlát. Egy Playwright-kapu `epoll_wait`-ben állt
(node ~0 % CPU), percekig: 2026-09-27-én a `guest-mobile-check --selftest` 18 percig (a 2. fixtúra
UTÁN, futás KÖZBEN), 2026-09-29-én a `cfg-sheet-scroll-check --selftest` 13 percig (minden ✓ kiírva).
A land addig állt, amíg egy session kézzel meg nem ölte.

**Döntés:**
1. **Korlát: `CIT_GATE_JOB_TIMEOUT` másodperc, alapból 600, minden kapura egyformán.** A leghosszabb
   egészséges kapu ~112 s (előzmény, `lead-page-surface-check`), így a 3–4×-es terhelési nyúlás
   (~450 s) is belefér. Ha nincs megadva, 0 vagy nem szám, akkor is 600: a korlát nem kapcsolható ki.
   Az előzményből számolt korlátot (N × előzmény) elvetettük: az előzményt épp a beragadások
   szennyezik (a `cfg-sheet-scroll-check --selftest` sora 877 s-ot mutatott), így a korlát a
   hibával együtt nőne.
2. **Lejáratkor** a kapu TELJES folyamatfáját (tsx → node → Chromium) a `/proc` szülő-pid láncából
   gyűjti ki. Csoport-szintű ölés nem elég: a Playwright a Chromiumot saját folyamatcsoportba teszi.
   A fa SIGTERM-et kap, 5 s türelmi idő után SIGKILL-t, mindig PID szerint, sosem névminta alapján.
3. **Az ítélet PIROS: kilépési kód 124.** A kapu stderr-jébe kerül: `⛔ IDŐTÚLLÉPÉS: a kapu N s után
   sem tért vissza …`, az ölt pid-ek (és ha valami mégis élve maradt, az is), a korlát, valamint az
   utolsó 5+3 kimeneti sor. Menet közben egy `⏱` sor is jelzi a lejáratot. A hook ugyanazzal a
   `gate_failed` blokkal írja ki, mint bármely bukást.
   - Zöld-gyorsítótár-bejegyzés nem íródik (csak rc 0 tárolódik).
   - Kapuidő-előzmény sem íródik: a beragadás nem a kapu hossza.
   - Az ① fázisban a lejárt kapu akkor sem sorolódik át íróként a ② fázisba, ha írni is próbált.
     Piros marad, nem próbálkozik újra.
4. **A „minden ✓ kiírva, csak a zárás lógott” esetet nem különböztetjük meg.** A kapu nem tért
   vissza, tehát nem adott ítéletet. A 09-27-i beragadás ráadásul futás KÖZBEN történt, vagyis a
   stdout alapján a két eset nem is választható el megbízhatóan. Az utolsó kimenet a jelentésben
   látszik, és ez az olvasónak elég.
5. **Gyökérok (böngésző-zárás) — most nem javítjuk.** Nincs közös zárósegéd: 111 kapu maga indítja a
   Chromiumot és maga hívja a `browser.close()`-t. A javítás egy `scripts/lib/`-beli korlátos
   zárósegéd lenne: `close()` időkorláttal, utána a `browser.process()` PID-jének kilövése. Ezt a
   kapukba kapunként kellene átvinni, a legismertebb beragadókkal kezdve (`cfg-sheet-scroll-check`,
   `guest-mobile-check`). Ez külön szál; az 1. pont ettől függetlenül véd.

**Őr:** `scripts/gate-runner-check.mts` J-forgatókönyve:
- egy kapu kiír egy sort, indít egy saját csoportú unokát, és 25 s-ig alszik;
- a 3 s-os korlát mellett a futás 124-gyel piros, hangos, az utolsó sort mutatja;
- mindkét pid halott, a többi kapu lefut, előzmény nem íródik, a második futásban újra lefut.

Az önteszt három új visszarontása: korlát ki · csak a közvetlen gyerek ölve · a beragadás az
előzménybe kerül. Mindhárom piros. Az önteszt maga véges, mert a fixture-kapu 25 s után kilép.
