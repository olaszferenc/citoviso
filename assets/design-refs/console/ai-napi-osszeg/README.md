# Napi AI-költség a konzolon — fejléc-pirula + generálás-panel — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-10-05, tulajdonosi döntés a koordinátoron át: **A + B** (a fejléc-pirula minden lapon
ÉS a lead-lap generálás-panelje, a B becslésével és átlépés-figyelmeztetésével együtt). A C
(irányítópult-kártya) változat ELVETVE — nincs a tervben.
**Kapcsolódó:** `src/ai/dailyCap.ts` (a napi plafon, b3f49e2f), `_planning/memory/2026-10-04_ai_koltsegplafon_es_prompt_cache.md`,
ADR-0233 (a konzol keret), CLAUDE.md §2b.
**Hatókör:** `src/ai/dailyCap.ts` · `src/console/i18nCtx.ts` · `src/console/aiSpend.ts` · `src/console/views.ts` · `src/console/server.ts` · `public/assets/ui/citui-console.css`

`plan.html` a mock (méret-, téma- és állapotváltóval; `verify-mock.mjs` a kattintás-próbája: 60/60, JS-hiba 0).
A `*.png` a jóváhagyott állapotok képei. **Ez a README a kötő szöveg, a mock a kép.**

## Miért létezik

A napi plafon (kemény, $20, csak env: `AI_DAILY_CAP_USD`) 2026-10-04 óta él, de a konzolon semmi nem
mutatta, hol tart a nap: a kurátor csak a TILTÁSKOR tudta meg, hogy közel járt. Mérve: élesen 10-04-én
41 mock, $26.96 — a plafon fölött lett volna.

## Amit a terv KÖT

1. **Adat:** a `mockSpendToday()` (`spentUsd`, `mocks`, `capUsd`, `blocked`) — kérésenként egyszer,
   rövid gyorsítótárral olvasva, a navigáció-számlálók mintájára. Ugyanaz a szám a pirulán és a panelen.
   A plafon a konzolról NEM állítható: **egyik felületen sincs rá szerkesztő.**
2. **Szintek:** `< 80%` zöld · `80–99%` borostyán (közel) · `≥ 100%` piros, tiltva (`spent ≥ cap`,
   ugyanaz, mint az `isCapReached`).
3. **A · fejléc-pirula a konzol MINDEN keretes lapján** (a ⌘K és a Súgó között): **„AI ma”** + összeg +
   „/ plafon” + vékony sáv. Telefonon csak az összeg és a sáv. Kattintásra lenyíló részletek:
   **„Mai AI-költség — mock-generálás”**, nagy összeg „/ plafon”, sáv, sorok: **„Mai mock”** ·
   **„Átlag / mock”** (ma még nincs mock: „—”) · **„Maradék”** (≈ N mock; tiltva: „holnap 0:00-ig”).
   Közel járva borostyán figyelmeztetés a maradékkal; elérve a tiltó szöveg BETŰRE a `capReachedMessage()`
   (**„Elérted a napi AI-költségplafont”**). Lábjegyzet: csak a mockok számítanak, a plafon az
   `AI_DAILY_CAP_USD` env-változóból jön, **„a konzolról nem állítható”**. Esc és kívül-kattintás zár.
4. **B · a lead-lap generálás-paneljén, a gomb alatt:** **„Mai AI-költség”** + összeg / plafon · N mock
   + sáv, alatta a kijelölt sablonok BECSÜLT költsége (sablononként egy mock; a becslés a mai átlag,
   amíg ma nincs mérhető mock, a mért éles átlag: $0.66). Ha a becsült összeg a plafon fölé vinne:
   borostyán figyelmeztetés, hogy a futás ELINDUL (az ellenőrzés az indulás előtt történik), de utána
   holnapig minden új generálás tiltva. Elérve: a gomb letiltva, fölötte a tiltó szöveg. A gomb meglévő
   „(N típus)” felirata változatlan.
5. **A szerver-oldali tiltás változatlan** (a pre-check és a `withMockBudget`): a felület csak mutat,
   nem ő a kapu.
