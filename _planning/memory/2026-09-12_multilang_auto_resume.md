# 2026-09-12 — ADR-0118: a kifizetett, elakadt nyelv-generálás magától indul újra

## A kiváltó

Az előző szál (FK-005b) nyitva hagyta: a generálás a fizetési webhook után **detached** fut —
három nyelv fordítása perceket vesz igénybe, a gateway nem várhat rá —, ezért egy
szerver-újraindítás elvágja, és a sor **örökre `generating`-en marad**. A vevő kifizetett egy
fordítást, amit soha nem kap meg. Mérve 2026-09-11-én: két ilyen sor, az egyik 12 órás. A
Modulok-kártya közben azt írta, „csapatunk újraindítja" — **üres ígéret**, mert semmi nem
indította újra (§B.17 magunkra is áll). A tulaj utasítása: „csináld meg az elakadt generálás
automatikus újraindítását."

## A megoldás — négy szabály, mind PÉNZ-okból

Egy generálás valós LLM-munka, tehát egy naiv „futtasd újra" ciklus rosszabb lett volna a
hibánál.

1. **ÉLETJEL, nem óra.** A futó generálás nyelvenként frissíti a `heartbeat_at`-ot (0062), és a
   figyelő EZT nézi (küszöb: 10 perc néma). Idő-alapon egy LASSÚ, de élő futás mellé indítanánk
   egy másodikat: dupla költség és versengő írás ugyanazokra a fájlokra.
2. **EGY IGÉNYLŐ.** A birtokbavétel egyetlen feltételes UPDATE (`status` + életjel a WHERE-ben)
   — a Postgres sor-zárja dönt, tehát két egyidejű tick közül pontosan az egyik viszi el.
3. **VÉGES SOROZAT.** `attempts ≤ 3`, és a korlát is a WHERE-ben ül, nem a hívó
   jólneveltségén. A `failed` sor is újrapróbálható a korláton belül: a mért bukások egy része
   átmeneti (kimerült API-egyenleg).
4. **AKI FELADJA, SZÓL.** A sorozat végén EMBER kap riasztást (SMS + e-mail), pontosan egyszer
   (`alert_at`). Címzett híján a riasztás hangosan, jelöletlenül marad, és a következő tick újra
   próbálja — a 0112 pár-javítás mintája.

**A felület minden fázisban igazat mond.** Új fázis: `gave_up`. Amíg van hátra próbálkozás, a
kártya AUTOMATIKUS újraindítást ígér (mert az már igaz), és kimondja, hányadiknál tartunk; a
sorozat után abbahagyja, és azt mondja, munkatársunk keresi. A „Kifizetve" nyugta és a halott
fizetés-gomb mindkét állapotban marad.

## Az ÉLES próba (nem szimuláció)

Az FK-005b futás tényleg ottfelejtett egy félbevágott, KIFIZETETT generálást (08:02:10, a runner
process kilépésekor). Nem nyúltam hozzá:

- 08:11:44 tick — nem talált semmit (az életjel 18 másodperccel a küszöb előtt volt)
- 08:16:44 tick — `1 elakadt · 1 újraindítva · 1 befejezve · 0 feladva`
- 08:19:08 — `status=done`, `attempts=1`, `site_multilang` aktív (de, sk, hr)

A kártya végigjárta a három állapotot: „készül" → „a rendszer néhány percen belül automatikusan
újraindítja" → „a nyelvi változatok naprakészek".

## Módosított / létrehozott fájlok

- `migrations/0062_multilang_resume.sql` (ÚJ) — `heartbeat_at`, `attempts`, `alert_at` + részleges index
- `src/tenant/multilangResume.ts` (ÚJ) — figyelő, birtokbavétel, feladás + riasztás (injektálható deps)
- `src/tenant/multilangGenerate.ts` — életjel a start/nyelvenként/vég ponton
- `src/tenant/multilangCard.ts` — a fázis az ÉLETJELBŐL, `gave_up`, `attempts`
- `src/server/adminViews.ts` — a kártya négy fázisának szövege
- `src/db/schema.ts`, `scripts/i18n-scope.mts`, `hooks/pre-commit`
- `scripts/resume-multilang.mts` (ÚJ) — timer-belépő + `--dry` + `--force <id>` (a régi
  `multilang-resume-stalled.mts` helyére)
- `scripts/multilang-resume-check.mts` (ÚJ) — az őr, önteszttel
- `deploy/systemd/citoviso-multilang-resume.{service,timer}` (ÚJ) + README-szakasz
- `kb/entries/admin-multilang/entry.hu.md`, `_planning/DECISIONS.md` (ADR-0118)

## Két lelet, ami nem a feladat volt

- ⚠️ **ADR-szám-ütközés, ismét.** Fetch után 0117-et foglaltam, de egy párhuzamos szál
  KÖZBEN landolta a sajátját ugyanazon a számon → rebase-konfliktus a `DECISIONS.md`-ben,
  és át kellett számozni (0118) 13 fájlban. A „fetch után, közvetlenül írás előtt nézd meg"
  szabály **nem elég**: a land is ütközhet. A feloldás triviális (mindkét ADR marad, a
  sorrend számít), de a kód-hivatkozásokat is át kell írni.
- ⚠️ **A timer a FŐ FÁBÓL fut**, ezért a telepítés után addig pirosan bukott
  (`ERR_MODULE_NOT_FOUND`), amíg a kód nem landolt. Sorrend: előbb land, utána `enable --now`.

## Nyitva

- A `heartbeat_at` **nyelvenként** frissül, tehát EGY nyelv fordítása a leghosszabb néma
  szakasz. Ha egyszer egy nyelv 10 percnél tovább tartana, a küszöböt emelni kell (vagy a
  fordítás-kötegek közé is életjel kerül).
- A feladás-riasztás **élesben még nem ment ki** (a dev gépen nincs riasztási címzett
  beállítva); az őr injektált riasztóval méri. Élesítés előtt a konzol `/settings`
  riasztási címzettjét ellenőrizni kell, különben a feladás csak a naplóba kerül.
