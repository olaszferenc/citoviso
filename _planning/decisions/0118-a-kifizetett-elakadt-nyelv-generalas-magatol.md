## ADR-0118 — A KIFIZETETT, ELAKADT NYELV-GENERÁLÁS MAGÁTÓL INDUL ÚJRA (2026-09-12)

**Státusz:** ELFOGADVA (tulajdonosi utasítás: „csináld meg az elakadt generálás automatikus
újraindítását") · **Kód:** ÉL lokálban · **Élesítve:** NINCS (§0.3) ·
**Kapcsolódó:** ADR-0063 (többnyelvű modul), ADR-0113 ⑤ (a kapu az íráson),
ADR-0112/0058 (a törött pár automata javítása — ennek a mintája), ADR-0071 (domain-resume timer).

**Kiváltó, mérve (2026-09-11, dev-park).** A generálás a fizetési webhook után **detached**
fut — három nyelv fordítása perceket vesz igénybe, a gateway nem várhat rá. Egy
szerver-újraindítás (a dev gépen egy `tsx watch` újratöltés is) tehát elvágja, és a sor
**örökre `generating`-en marad**. Két ilyen sor élt egyszerre, az egyik 12 órás: a vevő
kifizetett egy fordítást, amit soha nem kapott meg, és **semmi nem indította újra**. A
Modulok-kártya közben azt írta, „csapatunk újraindítja" — üres ígéret, vagyis §B.17-sértés
saját magunkkal szemben.

### Döntések

1. **ÉLETJEL, nem óra.** A futó generálás nyelvenként frissíti a `heartbeat_at`-ot
   (0062), és a figyelő EZT nézi. Egy idő-alapú mérce („20 perce indult") egy LASSÚ, de
   élő futás mellé indítana egy másodikat: dupla LLM-költség és versengő írás ugyanazokra
   a fájlokra. Küszöb: `MULTILANG_STALL_MINUTES = 10`.
2. **EGY IGÉNYLŐ, feltételes UPDATE-tel.** A birtokbavétel egyetlen `UPDATE … WHERE
   status IN (…) AND coalesce(heartbeat_at, created_at) < now() - küszöb`. A sor-zár dönt,
   tehát két egyszerre futó tick közül pontosan az egyik viszi el. Előbb-olvas-aztán-ír
   megoldás itt versenyt hagyna — és a verseny ára pénz.
3. **VÉGES SOROZAT.** `attempts ≤ MAX_MULTILANG_ATTEMPTS` (ma 3), és a korlát a **WHERE-ben**
   ül, nem a hívó jólneveltségén. Egy tartósan bukó generálás különben öt percenként
   égetné a pénzt, örökre.
4. **A 'failed' is újrapróbálható** (a korláton belül): a mért bukások egy része átmeneti
   (kimerült API-egyenleg, hálózat) — pont azokat gyógyítja egy későbbi próba.
5. **AKI FELADJA, SZÓL.** A sorozat végén EMBER kap riasztást (SMS + e-mail, a 0098
   csatornáin), pontosan egyszer (`alert_at`), és a sor véglegesen `failed` lesz.
   Címzett híján a riasztás **hangosan, jelöletlenül** marad, és a következő tick újra
   próbálja — nem vész el csendben (a 0112 pár-javítás mintája).
6. **A FELÜLET MINDEN FÁZISBAN IGAZAT MOND.** Új fázis a kártyán: `gave_up`. Amíg van
   hátra próbálkozás, a kártya **automatikus** újraindítást ígér (mert az már igaz);
   a sorozat után abbahagyja, és azt mondja, munkatársunk keresi. A „Kifizetve" nyugta és
   a halott fizetés-gomb mindkét állapotban marad — a pénz beérkezett.
7. **A KÉZI ÚJRAINDÍTÁS NEM FOGYASZT PRÓBÁLKOZÁST**, és a korlát fölött is megy:
   `npx tsx scripts/resume-multilang.mts --force <id>`. Ezt az utat nevezi meg a
   feladás-riasztás levele is.
8. **Ötperces systemd timer** (`citoviso-multilang-resume`), a FŐ FÁBÓL futva, a
   `deploy/systemd/` verziózott receptje szerint. Öt perc, mert a vevő percekben méri a
   „mindjárt kész"-t; sűríteni felesleges, mert a figyelő úgyis csak a 10 perce néma
   sorokat nyúlja meg.

**Elvetve:** (a) **szerver-boot-on újraindítás** — a dev gépen minden fájlmentés újratölti a
szervert, ez percenként indítana fizetős generálást; (b) **korlátlan újrapróbálás** — egy
determinisztikus hiba (pl. hiányos nyelvi csomag) örökre égetné a pénzt, és senki nem tudna
róla; (c) **óra-alapú elakadás-mérce** — lásd ①.

**Mérés:** `scripts/multilang-resume-check.mts` — saját eldobható fixture, **injektált**
futtatóval és riasztóval (az őr sem LLM-et nem éget, sem SMS-t nem küld). `--self-test`
módban kiveszi a szabály horgonyait (életjel-küszöb → 0, sorozat-korlát → végtelen,
`gave_up` fázis → sima hiba), és elvárja, hogy a rájuk épülő mérések MIND elbukjanak.
Mindkét irány zöld; pre-commitba kötve.

**Visszafordíthatóság:** 🔄 a timer kikapcsolható (`systemctl disable`), a kód-út marad
kézi (`--force`) eszköznek; a 0062 oszlopok additívak. 🚪 Kifelé tett ígéret változik: a
kártya „automatikusan újraindítja" mondata — ezt a timer nélkül NEM szabad kint hagyni.

**Nyitva:** a `heartbeat_at` nyelvenként frissül, tehát EGY nyelv fordítása a leghosszabb
néma szakasz. Ha egyszer egy nyelv 10 percnél tovább tartana, a küszöböt emelni kell
(vagy a fordítás-kötegek közé is életjel kerül).
