# 2026-08-01 — Pilot-infra: dizájn-mag + publikus honlap + self-serve auto-mock + tenant-belépés/admin

## Mit építettünk (mind lokál, verifikálva, pusholva)

### ADR-0021 — Citoviso saját felület-világ
- **Dizájn-mag** (`public/assets/ui/citui.css` + `citui.js` + `citui-styleguide.html`): `--citui-*` tokenek
  (navy `#0e2a47/#16283f`, cián `#1fb6d6/#35c4e0`, Inter+Space Grotesk) + komponens-készlet (gomb/kártya/nav/űrlap/
  pill/chip/tábla/lábléc) + reveal (no-JS safe). A brand `assets/brand/`-ból (kész logó: C=szem+play). Elkülönítve a
  motor `--cit-*` skinjétől. Logó-SVG-k a `public/assets/ui/`-ban.
- **Kettős identitás-realm** kimondva (control plane = belső / data plane = tenant; külön user-tábla, külön jog, §G).
- **Granuláris belső RBAC TERV** (6 szerepkör) — de a pilotra **HALASZTVA** (egy operátor, Tailscale mögött).

### Publikus honlap (`public/index.html` + `assets/home/{home.css,home.js}`)
- **Vevő-fókuszú** tartalom (tulaj: „a landing csupa faszság volt, magunkról szólt — a vevőt nem érdekli a technikai
  hátterünk"). A lap gerince a **minta-igénylés**. A tulaj HTML-mintájából TISZTÁN újraépítve (nem copy-paste), a magra.
- No-JS reveal-fix: JS nélkül minden látszik (üres-sáv tilalom).

### ADR-0022 — self-serve auto-mock (honlap-igény → mock → e-mail)
- Űrlap **Leaflet térkép-pinnel** (pontos koordináta = magas A4-konfidencia; a félre-azonosítás fő kockázatát oldja).
- `src/scraper/resolveOne.ts`: pin → Places `locationBias` keresés (emberi tű ~approx), fallback: név+település Text Search.
  Nincs Maps-találat → koordináta-only lead (nulla-lábnyom szegmens, Street View baseline) → needs_review.
- `src/intake/mockRequest.ts`: orchestrátor (fire-and-forget). Feloldás → lead-perzisztálás → `generateEngineMock` →
  kapuk (A4 konfidencia ≥0.7 + dizájn PASS + demo-framing PASS) → **őr-kapuzott auto** küldés; FLAG → needs_review.
- `src/email/{sender,mockRequestEmail}.ts`: **EmailSender interfész + Mock-adapter** (`outbox/*.eml`); `EMAIL_PROVIDER=smtp`
  éles (kulcs+domain kell). `src/generator/demoFrame.ts`: §A demo-framing lábléc a kiszolgált/ellenőrzött előnézeten
  (fontos tanulság: a framing szövege NEM tartalmazhatja a tiltott „éles/hivatalos oldala" kifejezést — tagadásban is FLAG-el).
- `mock_request` tábla (0010, +lat/lon). Verifikálva: Hotel Bonvino pin → SENT + `/m/:token` framelt előnézet.

### ADR-0023 — tenant-belépés + minimál önkiszolgáló admin
- **Auth-döntések (tulaj-vezérelt, iteratív):** (1) magic-link → ELVETVE (nem-tech tulajnak macerás); (2) kiadott,
  **megjegyezhető jelszó** (`generateMemorablePassword` → `kilato-levendula-47`, scrypt hash); (3) login-azonosító =
  **felhasználónév** (a vállalkozásnévből generálva, stabil), NEM e-mail (mert mi adunk neki e-mailt/domaint) +
  külön **módosítható kommunikációs e-mail**. Session = aláírt HMAC cookie.
- `src/auth/tenantAuth.ts` (authenticate/hash/session/currentTenant/updateContactEmail) + `src/tenant/credentials.ts`
  (`issueAndSendTenantLogin` — aktiváláskor e-mailezi a belépési adatokat). `src/email/loginEmail.ts` (hitelesítő adatok).
- **Admin** (`src/server/adminViews.ts`, dizájn-magon): **A1** szöveg-szerkesztés (név/szlogen/bemutatkozó/kiemelések) →
  re-render mock=live; **A2** saját fotó feltöltés/csere (§A: demó Places/StreetView kép élesre nem mehet → saját kép
  váltja). `src/tenant/{editor,assetStore}.ts` (LocalAssetStore `sites/<tenant>/uploads/`, interfész mögött → CDN később).
- Táblák: `tenant_user`+`login_token` (0011), `password_hash` (0012), `username`+`contact_email` (0013), `site.edited_site_data`.
- Bug elkapva út közben: `/belepes` handler `email` mezőt olvasta `username` helyett → javítva.

## Új publikus szerver
`src/server/public.ts` (:4800) — statikus `public/` + intake API + tenant-admin + előnézet/uploads kiszolgálás.
Leváltotta a fejlesztői python statikust; folyamatosan fut (setsid/nohup). Belső konzol továbbra is :4600.

## Commitok (origin/main szinkron)
`82e7e87` (mag+honlap+auto-mock) · `a5b471b` + `4d2a381` (tenant-auth) · `41f3978` (A2 fotó).

## Következő + blokkolók
- **KÖVETKEZŐ:** B) outreach küldő-pipeline (~100 hideg megkeresés: SMTP-adapter + batch + §C-kapu + HTML-sablon).
- **Külső (tulaj):** citoviso.com + publikus hoszting (a kiküldés/webhook/élesítés előfeltétele) · éles Barion+Számlázz
  kulcs · küldő-domain (SPF/DKIM).
- **Böngészős teszt:** `http://100.97.188.105:4800/` (honlap+minta-igénylés); `/belepes` tenant-admin.
