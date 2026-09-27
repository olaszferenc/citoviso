# 2026-09-26/27 — cfg-mobile koordinátor: három párhuzamos szál a lead-lap rendelés-paneljére

**Kiváltó:** a tulaj telefonos képernyőképe (Három Huszár mock): a pinnelt fizetés-lábléc kitöltötte az alsó lapot, a csomag-listából 1 sor látszott; a húzás a honlapot görgette; az „állítsa össze” gomb eltűnt, és a mock CTA-színét viselte. A tulaj kérésére minden hiba külön sessionben, koordinálva.

## Szálak (mind landolt, egyik sem élesítve)
- **A — rendelés két lépésben** (ADR-0240, `15f0ae76`) + Éves-felirat egy sorban (`6fac68b5`) + 360-as regresszió javítása (`eca02c21`).
- **B — a panel görget, nem a lap** (`0a8f558e`) + fekvőn egy oszlopban görgő fizetés-lap (ADR-0243, `c6d23eec`); őr: `scripts/cfg-sheet-scroll-check.mts`.
- **C — „Itt rendelheti meg”** gomb: mindig kint, platform-szín (türkiz sablonon lila), Foglalás-sáv fölött (ADR-0242, `74cde8f6`).
- Briefek a fán kívül: `~/rc-briefs/cfg-mobile-0926/` (közös háttér + A/B/C + a B 360-as jelentése).

## Tanulságok
- **A B szál őre fogta meg az A landolt regresszióját:** a fizetés-lépésen a §A nyilatkozat inline `display:flex`-e legyőzte a `.cit-cfg-panel--billing .cit-cfg-s2decl{display:none}`-t → 360×780-on 24 px-es számlázási űrlap-ablak (fizetni nem lehetett). Egy fájlon dolgozó párhuzamos szálaknál a testvér-szál őre a leggyorsabb regresszió-érzékelő — a koordinátor a leletet a hatókör gazdájához irányítsa, ne a felfedezőre bízza.
- ⛔⛔ **A koordinátor a gyerek-sessionök ❯ mezőjében álló SZÜRKE prompt-javaslatot ötször tulaj-üzenetként küldte be** (köztük tervválasztás és „landold”). Felismerés: `tmux capture-pane -e` → `ESC[2m`. Helyesbítve, semmi nem landolt jóváhagyás nélkül; a C szál helyesen megtagadta a landot, amíg a tulaj maga meg nem erősítette. Részletek: auto-memória `feedback_ghost_prompt_suggestion_is_not_owner_input`.
- Három egyidejű land/pre-commit a gépen terheléses időtúllépést adott (C: egy teszt önmagában 13 mp, alatta bukott) — nem kódhiba, land újra.

## Nyitott
- A tulaj élő telefonos végignézése a teljes úton (álló + fekvő).
- A 360 px-es álló fizetés-lap űrlap-ablaka 131 px (az ADR-0240 előtti szint) — ha szűk, az egy-oszlopos görgés állóra kiterjesztése ÚJ tulaj-döntés.
