# 2026-10-05 — Napi AI-összeg a konzolon (A fejléc-pirula + B generálás-panel)

**Szál:** SUB (koordinátor b00442f9), előd 97bde5b8 (mock-kör + befagyasztás). Tulaj-döntés: **A + B**, a C (irányítópult-kártya) elvetve.

## Elvégezve
- **Befagyott terv** commitolva: `assets/design-refs/console/ai-napi-osszeg/` (plan.html, README.md — kötő szöveg, 9 png, verify-mock.mjs 60/60).
- **Adat:** `src/console/aiSpend.ts` — `getAiSpend()` 15 s gyorsítótár a `navCounts.ts` mintájára; DB-hiba → `console.warn` + null (a pirula ilyenkor nem jelenik meg). Kérés-kontextus: `i18nCtx.ts` `ai` + `setConsoleAi`/`consoleAi`; betöltés `server.ts` a `setConsoleNav` mellett. Teszt-varrat: `resetAiSpendCache`, `primeAiSpendCache`.
- **Tiszta segédek** a `dailyCap.ts`-ben: `AI_NEAR_RATIO = 0.8`, `MOCK_COST_FALLBACK_USD = 0.66`, `spendLevel()`, `mockCostEstimateUsd()`. A szerver-oldali tiltás (pre-check + `withMockBudget`) VÁLTOZATLAN, mindig friss olvasás.
- **A:** `views.ts` `aiPill()` a ⌘K és a Súgó között, lenyíló (`#con-ai-pop`), kattintásra nyílik; Esc vagy kívül-kattintás zárja (`shellScript`). Telefonon csak az összeg és a sáv látszik, a lenyíló teljes szélességű.
- **B:** `aiGenBudget()` a generálás-gomb ALATT: mai összeg / plafon · N mock + sáv + a kijelölt sablonok becslése (`citAiEst()` a `citTplCount()`-ból). Ha a futás átlépné a plafont, borostyán figyelmeztetés jelenik meg. Elérve: a gomb `disabled` lesz, a `title` a tiltó szöveg, a tiltás piros üzenetként a form fölött áll, és a bukott korábbi outcome nem jelenik meg kétszer.
- **Mellékjavítás:** a `citTplCount()` eddig az ELSŐ `.gen-go` gombot fogta meg. Ha volt szöveg-panel, ez a „Szöveg újragenerálása” gomb volt, ezért a „(N típus)” felirat oda került. Most a `form[action$="/generate"]` gombját fogja meg.
- KB: `kb/entries/console-lead/entry.hu.md` „### Napi AI-költségplafon” (tudasbazis-or FLAG nyomán).
- CSS: `citui-console.css` `.con-ai*`, `.con-gen-budget`, `.con-gen-est`, csak `--citui-*` tokenekkel.

## Ellenőrzés
- Playwright-próba (scratch, ui-shot-mintájú in-process szerver, `primeAiSpendCache`): ok / near / blocked / üres nap × 390 + 1280 → pirula, szint, nyitás, `aria-expanded`, Esc, kívül-kattintás, gomb-tiltás, becslés, átlépés-figyelmeztetés, „(N típus)”, JS-hiba 0 — **ALL OK**. A képeket megnéztem: a befagyott png-knek megfelelnek.
- Kapuk: tsc, i18n-lint, design-token-lint, contract-drift-check, ai-daily-cap-check, kb-check, console-linear-check — zöld.

## Nyitott
- A „közel” állapot élesben csak $16+ költésnél látszik; dev-ben a teszt-varrattal lőhető.
