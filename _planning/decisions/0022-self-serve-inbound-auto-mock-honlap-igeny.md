## ADR-0022 — Self-serve inbound auto-mock: honlap-igény → automatikus mock → e-mail (őr-kapuzott)

- **Kiváltó (2026-08-01, tulaj):** a honlap gerince a minta-igénylés; a leadott igényből **automatikusan generált
  mock kell, e-mailben kiküldve.** (A landing tartalmi finomhangolása külön, későbbi kör.)
- **Folyamat:** `honlap-űrlap → POST /api/mock-request → azonnali „megkaptuk" → (háttér) egy-vállalkozás feloldás
  (Places Text Search név+település, VAGY Maps-link→place_id) → generateEngineMock (meglévő motor, A4 kép/rating-kapu)
  → előnézet hosztolás token-URL-en (/m/:token) → ŐR-KAPUK → e-mail a kérőnek (link + „kérem élesben" CTA).`
- **Kiküldés-politika (tulaj-döntés): ŐR-KAPUZOTT AUTO** (A2/A4). Magabiztos találat (match-konfidencia ≥ küszöb)
  + dizájn-doktrína PASS + demo-framing PASS → **automatikus küldés**. Bizonytalan találat vagy bármely FLAG →
  `needs_review` (kurátor-sor), NEM megy ki vakon. Így a többség automata, de nem küldünk félre-azonosított/rossz mockot.
- **Épített darabok (mind interfész mögött, a Barion/Számlázz build-behind-an-interface mintára):**
  - `mock_request` tábla (0010) — állapotgép: `received→resolving→generating→sent | needs_review | failed`; token az előnézethez.
  - `src/scraper/resolveOne.ts` — egy hely feloldása (Places Text Search / place_id) → `QualifiedLead` + match-konfidencia.
  - `src/email/` — **EmailSender interfész + Mock-adapter** (lokálban `outbox/*.eml`-be írja a levelet) → valódi SMTP
    env-kapcsolóval (`EMAIL_PROVIDER=mock|smtp`). Ma NINCS SMTP-fiók/küldő-domain → a Mock-adapter fut (end-to-end tesztelhető).
  - `src/intake/mockRequest.ts` — az orchestrátor (fire-and-forget háttér-feldolgozás, a konzol generate-mintájára).
  - `src/server/public.ts` — Node http szerver: `public/` statikus + `POST /api/mock-request` + `GET /m/:token`
    (leváltja a fejlesztői python statikus szervert; ugyanúgy folyamatosan fut :4800-on).
- **Külső blokkolók (tulaj, a build ettől függetlenül kész):** valódi e-mail-küldés (SMTP-fiók + küldő-domain);
  publikus hoszting (az e-mailes előnézet-link egyelőre a Tailscale/preview URL — a tulajnak működik, kívülről a hoszting után).
- **Jog/GDPR:** ez **inbound, kért** megkeresés (a tulaj maga kéri a mintát) → a hideg-outreach §C-kapunál lényegesen
  enyhébb; az adatkezelési tájékoztató (/adatvedelem) linkelendő az űrlapnál. A mock provenance §A: demo-framing megmarad.
- **Visszafordíthatóság:** 🔄 additív (új tábla + új modulok + új szerver); a python→node szerver-csere könnyen visszavonható.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-01). Impl. folyamatban.
