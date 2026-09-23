## ADR-0021 — Citoviso saját felület-világ: központi dizájn-mag + kettős identitás-realm (control/data plane) + granuláris belső RBAC

- **Kiváltó (2026-07-31, tulaj):** a pilot-felkészülés következő témája a **Citoviso publikus honlap** — „a lap
  honlap, amit a világ lát" (kik/mik vagyunk) **ÉS** ahol a tenantok belépnek a saját admin-felületükre, illetve
  mi belső userek a saját felületeinkre (scraper, mock-generálás, lead-kezelés). A folyamat-átbeszélésen kiderült:
  ez **három külön réteg, három kockázati profillal**, és a tulaj a tervezéskor a **belső jogosultságokat** és egy
  **központi dizájn-magot** emelte ki fő igényként.
- **A kérés szétbontása (a fő tisztázás):**
  1. **Publikus honlap** (anonim; alacsony kockázat 🔄) — marketing / bizalom-horgony. Auth NEM kell hozzá → önállóan,
     elsőként szállítható.
  2. **Bejelentkezés-kapu** (magas kockázat 🚪) — valódi identitás/auth (jelszó, session), új PII → RLS-kiváltó lehet.
  3. **Mögöttes felületek** — tenant-admin (data plane) + operátor-konzol (control plane); részben megvannak.
- **Döntés 1 — Központi dizájn-mag (tulaj kulcs-igénye):** EGY forrás a **saját termék-felületeink** arculatához
  (tokenek + alap-CSS + komponens-készlet), amiből MINDEN saját felület merít (honlap, login, belső konzol,
  tenant-admin chrome). **Elhatárolás a motor `--cit-*`-jától:** az a GENERÁLT tenant-oldalakat témázza (data plane,
  skinenként változó); ez a mi termék-brandünk (control plane), **stabil, egy arculat**. Névtér: `--citui-*`
  (pl. `public/assets/ui/`), a motor-tokenektől elkülönítve. A honlap **bespoke** (nem a motorból generált), de e mag fölött.
- **Döntés 2 — Kettős identitás-realm (KŐBE VÉSVE, §G-horgony):** a **control plane** (belső userek, mi) és a
  **data plane** (tenantok) **külön identitás-realm**: nincs közös user-tábla, nincs közös jogosultság; a tenant SOHA
  nem érhet control-plane adatot. Vizuálisan lehet egy közös „Bejelentkezés" a honlapon, a realm-ek mögötte elkülönülnek.
- **Döntés 3 — Granuláris belső RBAC (6 szerepkör, tulaj-választás):** szerepkör = engedély-halmaz (capability-string),
  route/művelet engedélyre kapuzva. Szerepkörök az ERP-modulokra képezve:
  **Superadmin** (minden + user/szerepkör-kezelés) · **Operátor** (scrape/mock-generálás/kuráció) ·
  **Sales/outreach** (lead-pipeline/prospect/megkeresés/konverzió) · **Pénzügy** (fizetés/számla/előfizetés/deaktiválás) ·
  **Dizájner** (dizájn-mag/skinek/korpusz-archetípusok + dizájn-kapu felülvizsgálat). (A Support szerepkör most kimaradt.)
  **Pilotra 1 Superadmin seed** (a tulaj az egyetlen belső user), de a séma (users + roles + permissions) eleve
  granuláris → szerepkört adni később ≠ újraírás.
- **Döntés 4 — Tenant-userek:** egyelőre **1 login / tenant** (a tulaj), de a séma eleve **tenant → N-user**
  (későbbi al-user, pl. recepciós, migráció nélkül).
- **Sorrend (visszafordíthatóság-címkével, egy szál egyszerre):**
  ① 🔄 **Központi dizájn-mag** (`--citui-*` + alap-CSS + komponensek) — mindent felold, tiszta CSS.
  ② 🔄 **Publikus honlap** — bespoke, a magra építve; login-gomb = placeholder.
  ③ 🚪 **Identitás + RBAC** — két-realm auth (users/roles/permissions/session séma + login-flow); itt lép be PII/RLS.
  ④ 🔄 **Belső konzol** ráhúzva a dizájn-magra + control-plane auth mögé.
  ⑤ 🚪 **Tenant-admin** önkiszolgáló szerkesztő (§E.12) + data-plane auth.
- **Elhatárolás / éles:** minden LOKÁLBAN épül; élesítés a tulaj-külső előfeltételekre vár (citoviso.com regisztráció
  + hoszting). A ③/⑤ auth-séma az első valódi tenant-PII → az RLS-kérdést a ③ szeletnél külön nyitjuk (§G.18).
- **Visszafordíthatóság:** ①②④ 🔄 (additív CSS/HTML/re-skin); ③⑤ 🚪 (auth-séma + PII) → lassan, rákérdezve.
- **Státusz:** ELFOGADVA (tulaj, 2026-07-31). Következő lépés: az ① dizájn-mag megépítése.
- **Kiegészítés (2026-08-19, tulaj-kérésre):** az ① mag-lefedettség **TELJES** lett — a tenant-admin addig beágyazott
  `ADM_STYLE` stílusblokkja kikerült külön rétegfájlba (`public/assets/ui/citui-admin.css`), a hardcode-olt színek
  tokenizálva (+3 új token a magban: `--citui-navy-950`, `--citui-ink-inverse`, `--citui-ok-soft`; márka-derivált
  alfák `color-mix()`-szel a tokenekre kötve). Innentől MINDHÁROM saját felület (honlap `home.css`, konzol
  `citui-console.css`, tenant-admin `citui-admin.css`) kizárólag a `citui.css` tokenjeiből öltözik → skin-csere =
  a `:root` token-értékek cseréje EGY helyen.
- **Dizájn-döntés (tulaj, 2026-08-19, 4 mock közül):** admin kártya-fejléc = **navy gradiens-sáv** (full-bleed, fehér
  cím, cián ikon-chip) a szem-vezetésért; ikon-készlet = **egyedi Citoviso ikon-nyelv**: kerekített vonal + ikononként
  EGY tömör cián akcent-elem (a logó pöttyének visszhangja); utility/állapot-ikon (check, alert) tiszta currentColor,
  hogy a szemantikus szín igaz maradjon. Következő kör: ugyanez az ikon-nyelv a belső konzolra is.
- **Token-audit + ikon-rollout (2026-08-19, 2. kör):** MINDEN saját felület átvizsgálva. Ikonok közös modulba:
  `src/ui/icons.ts` (admin + konzol innen importál; konzol-menü 6 új ikont kapott). Javítva: konzol `var(--bad)`/
  `var(--line)` NEM-LÉTEZŐ tokenek → `--citui-*`; kóbor sötét hexek → tokenek; márka-derivált rgba-k →
  `color-mix()` (konzol-CSS + home.css, vizuálisan ekvivalens); Leaflet térkép-státuszszínek a szemantikus
  tokenek tükrei (SVG-attribútumban a var() nem oldódik fel — kommentelt literál-tükör). DOKUMENTÁLT kivételek:
  logó-színek + honlap-illusztrációk artwork-stopjai (brand-konstansok, nem skin-elemek); `/p/` előnézet-lábléc
  (engine-oldalra kerül, citui.css nélkül). Új token: `--citui-glow-blue` (hero aurora).
- **Determinisztikus token-őr (2026-08-19, 3. kör, i18n-lint minta):** `scripts/design-token-lint.mts` — a felület-
  láncon (3 CSS réteg + 5 TS + index.html) tiltja a nyers szín-literált, az idegen (nem-citui) `var()`-t és a NEM
  LÉTEZŐ `--citui-*` hivatkozást (elírás-fogó; élesben azonnal fogott egy `var(--citui-cyan)` bugot). Kivétel CSAK
  a szkript ALLOW-listáján, indoklással, vagy same-line `token-exempt` markerrel. Hook: `design-token-scan.mjs`
  (PostToolUse, scope-szűrt, sérülésnél exit 2 = blokkoló visszajelzés) a `.claude/settings.json`-ban.
