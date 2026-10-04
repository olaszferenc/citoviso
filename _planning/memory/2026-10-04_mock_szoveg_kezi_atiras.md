# 2026-10-04 — A mock szövege kézzel átírható (A + B, ADR-XXXX)

**Kérés (tulaj):** „a mockoknál lehessen manuálisan újraírni a szöveget”.
**Döntés (koordinátoron át):** „Előnézet és mező” → A ÉS B; D2–D5 a javaslat szerint.

## Mi készült

- **A — mezős űrlap:** a mock-kártya „Részletek” alatt, „A mock szövege — kézi átírás” blokk.
  - Minden mező szerepel: főcím, dőlt kiemelés, alcím, felső sor, bemutatkozás, kiemelések, szakasz-címek.
  - A sablonon nem látszó mező jelölve van.
  - Kinyitva a kártya a teljes sort kapja.
- **B — helyben szerkesztés:** `/artifact/:id/edit` — kurátori előnézet szerkesztő sávval, friss render; a `/mock/` link
  érintetlen.
  - Kattintásra helyben írható; a dőlt kiemelés kijelöléssel állítható.
  - Mobilon az alsó sáv 50 px.
- **Egy mentési út:** `POST /artifact/:id/copy` → `saveManualCopy()`.
  - **Tárolás:** `inputs.copyManual` (value, orig, source: "curator").
  - **Render:** ugyanabba a fájlba.
  - **Őrök:** a tényhűség és a marketing újra fut; a vendég-kritikus CSAK ítél.
  - **Nyugtázás:** a régi `verdictAck` elvész.
- **D3:** a `recopy` rávetíti a kézi mezőket, a kritikus után is. A forrás-összeállítás közös: `copySources.ts`.
- **Sablon-horgok:** 21 sablon kapott `data-cit-copy` horgot; a kiemelés-index a usp-összefésülésen át is helyes.
  - 126 render bájtra azonos a horgok levétele után.

## Őrök

- `copy-hook-check` (21 sablon, 239 mező; piros kontroll).
  - Talált lyuk: a `body.querySelectorAll` a body-n ülő horgot nem látta.
- `copy-manual-check`:
  - a beágyazott szkriptek parse-olnak — egy escape-hiba a teljes B-t némán megölte, az e2e fogta meg;
  - a mentési terv;
  - D3.

## Tanulságok

- Az `innerText` a CSS `text-transform`-ot is visszaadja. Egy nagybetűs kicker nagybetűvel mentődött volna, ezért
  DOM-szöveg kell.
- A kártya `overflow:hidden`-je alatt a sticky nem működik.

## Nyitott

- **D5 a tenant-szerkesztőre NEM terjed ki.** Ott néma vágás van 240/2000/12-nél, a szorosabb érték az élő tulajok
  szövegét csonkítaná. Az egységesítés külön §2b kör.
- **Élesre csak a nagy deployjal.**

## Fájlok

- `src/engine/copyFields.ts`, `src/generator/copyManual.ts`, `src/generator/copySources.ts`
- `src/console/copyEditViews.ts`, `src/console/views.ts`, `src/console/server.ts`
- `src/generator/recopy.ts`, `src/generator/guestCritic.ts`
- `src/engine/render.ts`, `src/engine/templateKit.ts`, `src/engine/templates/*.ts` (21)
- `public/assets/ui/citui-console.css`
- `scripts/copy-hook-check.mts`, `scripts/copy-manual-check.mts`, `scripts/design-token-lint.mts`, `scripts/kb-check.mts`
- `hooks/pre-commit`
- `kb/entries/console-lead/entry.hu.md`
- `assets/design-refs/console/mock-copy-edit/`
- `_planning/decisions/XXXX-mock-szoveg-kezi-atirasa.md`
