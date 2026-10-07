# 2026-10-07 — Válaszok a megkeresésekre (ADR-0339): gyűjtő + irányítópult-blokk (B terv)

**Kérés (tulaj):** „nyitó oldalán jelenjen meg: melyik lead küldte mikor mit, megvan-e válaszolva.
ugrás a lead oldalára” — aznap 3 valódi válasz (2 SMS, 1 e-mail) érkezett, és egyikről sem tudott a rendszer.
Jóváhagyott terv: B (beszélgetés-nézet), `assets/design-refs/console/valaszok/`.

**Elvégezve (4 session-szakasz, egy fában, `~/wt/cit84e19510`):**
- Migráció 0094 (`outreach_reply`, `outreach_reply_poll`); `src/replies/{store,gammu,imap,mime}.ts`.
- Gyűjtő a dev gépen: `scripts/replies-collect.mts --sms|--email` (csak olvas), systemd timerek
  `deploy/systemd/citoviso-replies-{sms,email}.{service,timer}`; `POST /api/replies/ingest` a PUBLIC szerveren.
- Konzol: irányítópult-blokk (lista + beszélgetés, mobilon lista VAGY beszélgetés), „Megválaszoltam” /
  „Visszavonás” (`POST /replies/<id>/answered|undo`), menü-jel, „Figyelmet kér” sor, „Válaszolt” widget-sor.
- Playwright-kattintás (32 lépés zöld, JS-hiba 0): közben lelet — a menü-jel 15 mp-es cache miatt jelölés
  után a régi számot mutatta → a jelölő végpont üríti (`resetNavCountsCache`).
- Őr: `scripts/outreach-reply-check.mts` (+ `--self-test`, 6 család mind pirosra megy), bekötve a `hooks/pre-commit`-ba.
- ADR `_planning/decisions/XXXX-valaszok-a-megkeresesekre.md`; KB `console-dashboard` új szakasz
  (tudasbazis-or PASS) + friss kép; a README feliratai kötő **„…”** literálok + Hatókör.

**Módosított fájlok (ez a szakasz):** a konzol szerver-modulja (`src/console/` — jelölő végpont),
`src/console/navCounts.ts`, `scripts/outreach-reply-check.mts`, `hooks/pre-commit`,
`_planning/decisions/XXXX-valaszok-a-megkeresesekre.md`, `kb/entries/console-dashboard/entry.hu.md`,
`kb/entries/console-dashboard/assets/hu/screen.png`, `assets/design-refs/console/valaszok/README.md`,
`MEMORY.md`, ez a jegyzet.

**Nyitott:**
- NEM élesítve (nagy deploy). Élesen kell: migráció 0094, a timerek a dev gép FŐ fájából
  (`SMS_RELAY_URL/SECRET`, `GAMMU_DB_*`, IMAP-hitelesítő a fő fa `.env`-jében).
- Tulaj-kérdés változatlan: EMAIL_BCC / OUTREACH_COPY_PHONE élesi kivétele csak kimondott „mehet”-re.
- A KB-kép a kb-shot üres fixture-ét mutatja („mind megválaszolva”) — mintaválasz a fixture-be később.
