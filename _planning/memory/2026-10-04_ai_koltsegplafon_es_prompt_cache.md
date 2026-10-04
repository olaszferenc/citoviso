# 2026-10-04 — AI-költségplafon (napi $20, env) + prompt-cache a mock-generáláson (SUB)

Koordinátor: b00442f9 (Neo). Brief: `~/rc-briefs/ai-koltsegplafon-impl-20261004.md`.

## Elvégezve
1. **Kemény napi plafon** (tulaj-döntés: $20, CSAK mock-költség, CSAK env `AI_DAILY_CAP_USD`):
   - `src/ai/dailyCap.ts`: `mockSpendToday()` = `sum(mock_artifact.inputs->'aiUsage'->>'costUsd')`
     a mai Europe/Budapest napra (`generated_at timestamptz`); `withMockBudget()` = plafon-ellenőrzés,
     utána `withAiUsage()`. Elírt env (NaN/negatív) → alap $20, hangos warn (a NaN = nincs plafon lenne).
   - Fojtópont: `generateMock`, `generateEngineMock`, `recopyArtifact` mind `withMockBudget`-tel
     indul → konzol, intake (`processMockRequest` → `failed` + üzenet), CLI-szkriptek mind fedve.
     A recopy nem dob: `{ok:false, message}`.
   - Konzol: a generálás és a recopy útvonala a futás ELŐTT kérdez; a generálás kimenet-sorában /
     piros flash-ben: „Elérted a napi AI-költségplafont: ma $X / $20 (N mock)…”.
   - Őr: `scripts/ai-daily-cap-check.mts` (pre-commit): src/-ben `withAiUsage(` csak src/ai/-ban,
     a 3 generátor withMockBudget-tel indul, a 2 konzol-út előbb kérdez; viselkedés plafon=0 mellett,
     hamis API-kulccsal (mutációs próbán bukik).
2. **Prompt-cache** (`src/ai/promptCache.ts`, 5 perces ephemeral): rendszer-prompt cache-elve a
   guestCritic / rewrite / marketCheck / briefAndCopy / factCheck hívásokon; a guestCritic változatlan
   forrás-blokkja és a marketCheck fotói külön jelölővel. A mérő árazása helyes volt (olvasás 0,1×,
   írás 1,25×; Opus 4.8 min. előtag 1024 token).
   **Mérés devben** (Üdülő tábor, fullbleed): alap $0.433 (cache 0) → 1. mock $0.411 (írás 25k,
   olvasás 19k; guestCritic −26%, marketCheck −22%, briefAndCopy az 1,25× írás miatt drágább) →
   2. mock 5 percen belül **$0.268 (−38%)**, olvasás 42,7k.

## Nyitott / következő
- **3. pont (napi összeg a konzolon) — §2b TERV-KAPU, még NINCS kész:** a mock-kör átadva utódnak.
- A recopy FELÜLÍRJA az artefaktum `aiUsage`-át (nem adja hozzá) → egy mai mock recopy-ja után a
  napi összeg alulbecsül (a generálás költsége eltűnik). Tulaj/koordinátor döntése, javítsuk-e.
- A konzol több sablont PÁRHUZAMOSAN generál → egymás cache-ét nem látják (az írás még nem kész).
  Egy rövid késleltetés az első után a −38%-ot a köteg többi tagjára is kiterjesztené.
- Párhuzamosan indított futások mind a futás előtti összeget látják: egy köteg a saját költségével
  átlépheti a plafont; a KÖVETKEZŐ indítás már elutasított.
- Élesre csak a nagy deployjal (tulaj).

## Fájlok
`src/ai/dailyCap.ts` (új) · `src/ai/promptCache.ts` (új) · `src/config.ts` · `src/console/server.ts` ·
`src/generator/{generate,generateEngine,recopy,guestCritic,marketCheck,brief,factCheck}.ts` ·
`scripts/ai-daily-cap-check.mts` (új) · `hooks/pre-commit`
