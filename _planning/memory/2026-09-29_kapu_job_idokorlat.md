# Kapunkénti időkorlát a kapu-futtatóban — a beragadt böngészős kapu nem tartja fel a landot (2026-09-29)

SUB-szál (koordinátor: `cit3bd83952`) · brief: `~/rc-briefs/kapu-job-idokorlat.md` · ADR-XXXX.

**Elvégezve:**
- `scripts/lib/gate-runner.mjs`: minden kapunak van időkorlátja, `CIT_GATE_JOB_TIMEOUT` s (alapból 600, nem
  kapcsolható ki).
  - Lejáratkor a futtató a `/proc`-ból begyűjti a teljes folyamatfát, ebbe a saját csoportú Chromium is beletartozik.
    Előbb SIGTERM, majd 5 s múlva SIGKILL.
  - A kapu ezután PIROS: rc 124, „⛔ IDŐTÚLLÉPÉS … Utolsó kimenet: │ …”.
  - Ilyenkor nem íródik se zöld-gyorsítótár, se kapuidő-előzmény, és az ① fázisban az író-átsorolás is elmarad.
- `scripts/gate-runner-check.mts`: új J-forgatókönyv, és az önteszt 3 új visszarontása.

**Mérés, döntés:**
- A korlát fix, nem az előzményből számolt. Ok: az előzményt maga a beragadás szennyezi (`cfg-sheet-scroll-check --selftest` = 877 s).
- A „minden ✓ kiírva” esetet nem kezeljük külön. A 09-27-i beragadás futás KÖZBEN történt, és egy kapu, amely nem tért vissza, nem adott ítéletet.

**Nyitott (külön szál):** a gyökérok, vagyis a korlátos `browser.close()`. Nincs közös segéd: 111 kapu maga zár.
A javítás egy `scripts/lib/` zárósegéd lenne (`close` időkorláttal, utána a `browser.process()` pid kilövése), kapunként
bevezetve, a beragadókkal kezdve (`cfg-sheet-scroll-check`, `guest-mobile-check`).

**Módosított fájlok:** `scripts/lib/gate-runner.mjs` · `scripts/gate-runner-check.mts` ·
`_planning/decisions/XXXX-kapunkenti-idokorlat-a-kapu-futtatoban.md` · ez a jegyzet.
