# 2026-10-13 — Foglalás beállítása: kérdezz-felelek ellenőrzőlista + Segítő (ADR-XXXX)

SUB `citd9a8f335` a „deploy” FŐ session (`citfb4ed7ab`) alatt; brief `~/rc-briefs/foglalas-kerdezz-felelek-20261013.md`.
§2b kör: három működő mock (A lépésenként · B ellenőrzőlista · C beszélgetés) → a tulaj a **B**-t választotta,
a mobilon javított alsó „Kérdezzen a Segítőtől” sávval. Terv: `assets/design-refs/tenant-admin/foglalas-kerdezz-felelek/`.
A vázlat-generátor (src + Playwright-teszt) a fán kívül: `~/rc-briefs/_drafts-backup/foglalas-kf-20261013/`.

## Ami elkészült
- `/admin/booking-setup`: hat rész, állapot-címkék, „Mentés, tovább”, akadályok, próba-foglalás, Segítő (Haiku 5.5).
- Mentés a meglévő írás-függvényeken át (`src/tenant/bookingSetup.ts`); a modul-konfig ÖSSZEFÉSÜLVE íródik.
- `requests.ts`: a vendég-út szabálya kiemelve (`stayRuleErrors`/`stayIsTaken`/`stayQuote`) — a próba ugyanazt hívja.
- Online foglalás képernyő: alul a „Foglalás beállítása” kártya; a régi szabály-űrlap a „Haladó beállítások” alatt (`#halado`).
- Költség: `tenant_ai_call` (0109) + `recordAiUsage`; napi 40 kérdés/szállás; `PRICE_PER_MTOK` kiegészült a haiku-5-5-tel.
- Őr: `scripts/booking-setup-check.mts` (pre-commit bekötve; AI-t SOHA nem hív). Súgó: `kb/entries/admin-booking-setup`.

## Mérve
- Haiku 5.5, 6 éles kérdés: ~3 620 be + ~140 ki token, ~$0.00043/kérdés, 1,7–2,9 mp. Minőség: megtagadja a beírást,
  témán kívül nemet mond, az előlegről őszinte, a Booking-naptárhoz a Haladóba visz, a prompt-injekciót nem követi.

## Tanulság
- A `block_worktree_ports` hook egy parancsban a `public.ts` szövegre és a `tsx`-re együtt tüzel (akkor is, ha csak
  egy python-szerkesztés útvonala). A szerkesztést és a futtatást külön Bash-hívásba kell tenni.
- A kb-shot `hash` paraméterével az elem-felvétel 30 mp-ig várt a `.bs-main`-ra. A `clickFirst` (a valódi kattintás) működött.
- A kb-shot minden futása néhány idegen súgó-képet is átír (betű-zaj: console-scrape, rooms, booking). Ezeket visszaállítottam; nem a mi változásunk.

## Nyitott
- 2. kör (javaslat-kártya „Alkalmaz”, majd írás) — külön terv kell.
- Konzolon nincs még kijelzés a `tenant_ai_call` költségéről (SQL-lel olvasható, az ADR-ben).
