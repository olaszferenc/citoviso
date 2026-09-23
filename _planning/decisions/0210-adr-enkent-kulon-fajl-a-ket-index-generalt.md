## ADR-0210 — ADR-enként külön fájl, a két index generált, és a duplikált szám kapu (2026-09-23)

**Kiváltó (mérve, 2026-09-22):** egy szál egyetlen este HÁROMSZOR nem tudott landolni ugyanazzal a
dokumentum-blokkal: kétszer az ADR-szám csúszott el (a foglalás íráskor történik, a véglegesítés a
push-kor, köztük 10–20 perc kapu-futás), a harmadik körben SZABAD szám mellett is elbukott a rebase,
mert mindketten ugyanannak a fájlnak a végére fűztünk (`_planning/memory/INDEX.md`). Terhelés:
12 ADR / 24 óra, 16 commit a `DECISIONS.md`-re, 17 az `INDEX.md`-re. Az ütközés nem mindig derült
ki: az **ADR-0033 két különböző döntés**, mindkettő beolvadt.

**Döntés (tulajdonosi irány: A + D most, B + C utána; E — dátum+slug — elvetve):**
- **A — ADR-enként külön fájl:** `_planning/decisions/NNNN-slug.md`, első sora `## ADR-NNNN — Cím`.
  A preambulum a `_planning/decisions/README.md`. Külön fájlok nem ütköznek.
- **A `DECISIONS.md` RÖVID generált index** (szám · cím · link, újabb elöl) — tulajdonosi választás
  2026-09-23; a szöveg EGY példányban él. Teljes szövegű keresés: `grep -rn … _planning/decisions/`.
- **D — a memória `INDEX.md` generált**, minden jegyzet első `# ` címéből.
- **A két index ütközését a land ÚJRAGENERÁLÁSSAL oldja fel** (`scripts/land-rebase.sh` →
  `planning-index.mts rebase-resolve`) — KIZÁRÓLAG akkor, ha csak ez a két fájl ütközik; minden más
  ütközés ugyanúgy hangosan megállít, mint eddig.
- **C minimuma MOST, nem később:** a kapu bukik, ha két ADR ugyanazt a számot viseli. ⚠️ Enélkül „A"
  RONTOTT volna: két `0209-*.md` fájl között a git semmilyen ütközést nem jelez, vagyis a darabolás
  a mai egyetlen jelzést is elvitte volna, és a duplikátum némán olvadt volna be (ahogy a 0033).
  Az alszámok (`0036/b`, `0186 utószál`) külön címkék, nem duplikátumok.
  ⭐ **Munka közben élesben is megtörtént:** ezt az ADR-t 0209-ként írtam, és mire commitoltam,
  egy párhuzamos szál a 0209-et landolta (felszereltség, régi alakban) — ezért lett 0210.
- **ADR-0033:** mindkét döntés bájtra hűen, külön fájlban él; a kapu ezt az EGY esetet ismert
  kivételként kezeli (`KNOWN_DUPLICATES`). Az átszámozás tulajdonosi döntés (a későbbi, az nginx-es
  kapjon új számot) — „később rendezzük" (2026-09-23).
- **Átmenet:** a migráció idején futó szálak a RÉGI, egyfájlos naplót szerkesztik. A feloldó a
  visszajátszott commit régi alakú változását BLOKK-SZINTEN a saját ADR-fájljába viszi (módosított
  blokk → a fájl, amelyik még a bázis-tartalmat hordozza; új blokk → új fájl), és MEGÁLL, ha ugyanazt
  az ADR-t a main is módosította, vagy ha a szál blokkot törölt. Vak újragenerálás a szerkesztést
  némán eldobná — a negatív kontroll pontosan ezt mutatja meg.

**Bizonyíték:**
- A migráció bájtra hű: 209 blokk ↔ 209 fájl (`verify-split`), és FÜGGETLENÜL is (awk-darabolás +
  sha256-multihalmaz, a TS-kód nélkül). Pozitív kontrollok, mind PIROS: 1 bájt a régi fájl 0117-es
  blokkjának közepén · 1 bájt egy ADR-fájlban · egy törölt fájl · tartalom az elválasztó után.
  (Az első 0117-es rontás NEM változtatott semmit — a kontroll ezt kiírta, ezért újra futott.)
- `scripts/planning-index-land-check.mts`: eldobható git-repóban a VALÓDI `land-rebase.sh`, 22
  állítás (párhuzamos ADR + jegyzet · ugyanaz a szám · régi alakú szerkesztés átvétele · mindkét
  oldal módosított · idegen ütközés · kézi index-szerkesztés), negatív kontrollal. Három célzott
  rontás mind a SAJÁT forgatókönyvét vitte pirosra (a feloldó kikapcsolva → ①; duplikátum-vakság
  → ②; idegen ütközés lenyelése → ⑤).
- Fogyasztók TÉTELESEN (útvonalként): gépi olvasója a `DECISIONS.md`-nek NINCS; a `REFINE-DECISIONS.md`
  MÁS fájl (egy „DECISIONS.md"-re írt csere eltalálná); a `distill.sh` az `INDEX.md`-t név szerint
  kizárja (helyes marad); prózai horgony: `CLAUDE.md` §1.4/§3.1 (átírva), `tudasbazis-or` agent
  (átírva), session-jegyzetek, `elek/scenarios/FK-006a/b`, `migrations/0068`, `src/generator/corpus.ts`
  (az „ADR-NNNN a DECISIONS.md-ben" ma is igaz: az index sorából egy kattintás).
- Mellékhatás, mért javulás: a kézi `INDEX.md` 209 jegyzetből **25-öt nem tartalmazott**; a generált mind a 209-et.

**Elvetett:** teljes szövegű generált `DECISIONS.md` (minden ADR két példányban — tulajdonosi döntés
a rövid index mellett) · a kézi index-sorok („hook") megőrzése a jegyzetekben: 184 jegyzet
átírását jelentette volna, ami a `distill.sh` manifestjében mind „új"-nak számít (éjszakai
LLM-újrafeldolgozás) — az index sora ezért a jegyzet saját `# ` címe; a régi kézi sorok a git-történetben.

**⛔ Incidens a saját őrömmel (2026-09-23, helyreállítva):** a land-őr első változata a pre-commit
hookban futva ÖRÖKÖLTE a git `GIT_DIR`/`GIT_INDEX_FILE` változóit, így a „teszt-repó" parancsai a
VALÓDI repón futottak: a KÖZÖS configban `core.bare=true` és hamis `user.*`, a saját ágamon egy
fixture-commit. Push nem volt; a config 10:54:45-től a javításig sérült, közben más szál nem
commitolt (mérve). Helyreállítva (bare=false, az eredeti identitás a `[user]` szakasz
helyéből és a reggeli commitokból igazolva), a fixture-ág törölve. Javítás: a gyerek-folyamatok
környezetéből minden `GIT_*` kikerül + TRIPWIRE minden írás előtt; hook-környezetben CSALI
repóra bizonyítva (érintetlen), a szűrést visszarontva a tripwire az első lépésnél megállít.

**② B — a szám a LAND pillanatában dől el (2026-09-23, tulajdonosi jóváhagyás):** új ADR `XXXX-slug.md`
fájlba, `## ADR-XXXX — Cím` fejléccel, és a szál mindenhol `ADR-XXXX`-ként hivatkozik rá. A `land-rebase.sh`
a rebase UTÁN (az utolsó fetch után) a következő szabad számot adja (`planning-index.mts assign`), és
külön, jelölt commitban (`Land-Assigned-ADR:`) írja át:
- CSAK a saját diff HOZZÁADOTT sorait (`git diff -U0 origin/main...HEAD`) — a mainen már meglévő sort
  soha (ez a megfizetett lecke: egy vak `sed` két idegen ADR-t írt át);
- a mechanizmust leíró fájlokat (`CLAUDE.md`, a szkriptek, a README, ez az ADR) SOHA — ha ott hozzáadott
  sorban helyőrző áll, hangos megállás;
- UTÓ-FELTÉTELEK: minden megváltozott sor csak a csere erejéig tér el; a main meglévő sora bájtra
  marad; idegen fájl nem változik; nem marad helyőrző; nincs duplikátum; ha a sor MÁR hivatkozik az új
  számra (két jelentés lenne) → megállás. Bármelyik sérül → a fa visszaáll, az ág a helyőrzőn marad.
- Verseny: ha a push előtt valaki elviszi a számot, a következő kör (és minden bukott land) visszavonja
  a SAJÁT kiosztó commitját (csak ha jelölt és nincs a mainen), és friss számot ad.
- Bizonyíték: a land-őr 50 állítása (⑧ kiosztás · ⑨ verseny · ⑩–⑫ megállások · ⑬ negatív kontroll: a
  szűkítés kikapcsolva az utó-feltétel megfogja); két célzott rontás (undo kikapcsolva → ⑨ piros;
  doktrína-védelem kikapcsolva → ⑩ piros).
- A régi út (`next` + számozott fájl) működik tovább; ütközéskor a duplikátum-kapu fogja meg.

**Nyitva:** A `MEMORY.md` „Aktív feladat"
blokkjának ütközése (A+D nem érinti). · ADR-0033 átszámozása.

**Visszafordíthatóság:** 🔄 — a régi napló a git-történetben bájtra megvan, a fájlok összefűzése
visszaadja; adat, kód-viselkedés, éles nem érintett. **Élesítés:** NINCS (§0.3) — dokumentum-infra.
