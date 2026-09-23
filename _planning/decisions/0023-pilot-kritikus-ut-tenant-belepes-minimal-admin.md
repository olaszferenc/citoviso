## ADR-0023 — Pilot-kritikus út: tenant-belépés + minimál admin ELŐBB; a belső 6-szerepkörös RBAC halasztva

- **Kiváltó (2026-08-01, tulaj):** a pilot cél = ~100 hideg megkeresés (scraper) → mérni, miből lesz vásárlás →
  a vevő a **fizetés után be tud lépni a saját admin felületére**. A teljes loop átgondolásakor a hiányzó lánc-elem
  (§7d/#9) a **vásárlás utáni tenant-belépés + önkiszolgáló admin** — ezt építjük előbb.
- **Scope-döntés (ADR-0021 sorrend felülírása a pilotra):** a pilothoz a **TENANT (data-plane) belépés** kell,
  NEM a teljes belső 6-szerepkörös RBAC (③). Indok: a belső oldalon egyetlen operátor (a tulaj), Tailscale mögött →
  a granuláris belső RBAC a pilotra **túllövés, elhalasztva** (a séma-terv marad ADR-0021-ben). Amit építünk:
  minimál tenant-auth + önkiszolgáló szerkesztő.
- **Auth-mechanizmus (🚪 döntés): MAGIC-LINK** (jelszó nélküli, e-mailes belépő-link) — a nem-technikai tulajnak a
  legjobb UX (nincs jelszó/reset), és már van e-mail-küldőnk (ADR-0022 EmailSender; lokálban outbox, élesben SMTP).
  Session = aláírt cookie (HMAC, tenant_user_id + lejárat). Egy-használatos, lejáró login-token DB-ben (visszavonható).
- **Tenant-user modell:** egyelőre **1 login / tenant** (a tulaj e-mailje), de a séma `tenant_user` → N-user
  (ADR-0021 4. döntés; recepciós al-user később, migráció nélkül).
- **Minimál admin (§E.12 első szelet):** A1 = belépés + dashboard (oldal-állapot + előnézet-link) + **alap
  szöveg-szerkesztés** (tagline/intro) → újrarender (renderSite a perzisztált recipe + szerkesztett siteData-ból,
  mock=live megőrizve). A2 = **saját fotó feltöltés/csere** (§A élesítési jog-követelmény: a demó Places/StreetView
  kép élesre nem mehet — a tulaj saját képe váltja) + modul-kezelés. A recept-szerkesztő (ADR-0016 ⑤) későbbi.
- **Hol fut:** a tenant-admin a **publikus szerveren** (:4800, data-plane): `/belepes` (e-mail → magic-link),
  `/belepes/verifikacio` (token → session), `/admin` (session-védett). A belső konzol (:4600, control-plane) külön marad.
- **Külső blokkoló:** a magic-link éles kézbesítése SMTP-t igényel (tulaj); lokálban a mock-adapter az outbox-ba írja a linket.
- **Visszafordíthatóság:** 🚪 (auth + tenant-PII: e-mail, session) → körültekintően; a séma additív, a magic-link cserélhető jelszóra.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-01). Impl: A1 (belépés+dashboard+szöveg-szerkesztés) → A2 (fotó+modul).
- **MÓDOSÍTÁS (tulaj, 2026-08-01) — auth-mechanizmus: magic-link → KIADOTT, MEGJEGYEZHETŐ JELSZÓ.**
  Indok: a célszegmens (nem-technikai helyi vállalkozó) számára a magic-link kényelmetlen (minden belépésnél
  e-mail + link-keresés). Helyette: **MI generálunk egy fix, megjegyezhető jelszó-kifejezést** (pl.
  `kilato-levendula-47`), a tulaj a köszönő/vásárlási e-mailben megkapja, és **e-mail + jelszó** párral lép be
  (gyors, ismerős, ismételhető). A jelszót **hash-elve** tároljuk (`scrypt`, node beépített — nincs függőség).
  Elfelejtett jelszó → pilotra operátor-újragenerálás + újraküldés (A2); önkiszolgáló reset később. A `login_token`
  tábla marad a jövőbeli resethez. Session-cookie (HMAC) változatlan. `tenant_user.password_hash` (0012).
- **MÓDOSÍTÁS 2 (tulaj, 2026-08-01) — login-azonosító: e-mail → FELHASZNÁLÓNÉV + külön KOMMUNIKÁCIÓS e-mail.**
  Indok: mivel MI állítunk elő a tulajnak domaint + vállalkozói e-mailt, az ő e-mailje instabil/körkörös login-kulcs.
  Helyette: **felhasználónév** = stabil login-azonosító (MI generáljuk a vállalkozás nevéből, pl. `napfeny-panzio`,
  ütközésnél `-2`), a belépés **felhasználónév + jelszó**. A **kommunikációs e-mail** külön, változtatható mező
  (ide megy a jelszó/értesítés), a tulaj az adminban módosíthatja. Séma (0013): `tenant_user.username` (unique) +
  `email` → `contact_email` átnevezés. A felhasználónév stabil (operátor módosíthatja), a jelszó reset-elhető.
