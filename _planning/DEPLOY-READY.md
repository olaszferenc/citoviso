# DEPLOY-READY — a nagy deploy menete, ellenőrzőlistája, vészterve és füst-próbája

> Frissítve: **2026-09-29** (mérve aznap: élesen `263ef8dd` = `prod/20260924-1004`, a séma `0070`-ig;
> a main 329 committal, 1212 fájllal és 10 migrációval — `0071…0080` — jár előtte).
> Élesítés = **megnevezett commit** (ADR-0053), `bash scripts/deploy-prod.sh <commit> --go`, a tulaj
> AKTUÁLIS, erre az egy műveletre szóló engedélyével (CLAUDE.md §0). Fájl-lista, rsync, kézi másolás NINCS.
> Minden élesi ÍRÁS ebben a dokumentumban (a deploy, az `.env`, a rerender, a backfill, a visszagörgetés)
> külön engedély — az egyik engedélye nem viszi a másikat.

```bash
SSH="ssh -i ~/.ssh/citoviso_hetzner root@178.104.3.223"   # a lenti parancsok ezt használják
```

---

## 1. A deploy menete (`scripts/deploy-prod.sh`, a valós sorrend)

A szkript alapból **száraz** (a kapuk + a diff-terv, élesi írás nélkül); `--go` nélkül a GATE 6 tervénél megáll.
A fő fából futtasd (`/home/citoviso/citoviso`), a cél-commit legyen `origin/main`-en.

| # | Lépés | Blokkol? | Megjegyzés |
|---|---|---|---|
| 1 | **GATE 1** — a cél-commit őse az `origin/main`-nek | ⛔ igen | előbb land |
| 2 | **GATE 4** — fut-e éles scrape (deploy eleje) | ⛔ igen | `--ignore-scrape` tudatosan átviszi — a restart MEGÖLI a futást |
| 3 | **GATE 2** — `git diff --stat <éles>..<cél>` | tájékoztat | a HEAD-egyezés + tiszta fa = checkout kimarad |
| 4 | **GATE 1b** — `legal-check.mts` + az éles `.env` 5 `LEGAL_ENTITY_*` kulcsa | ⛔ igen | csak ezt az 5 kulcsot nézi — a domain-kulcsokat NEM (lásd §2) |
| 5 | **GATE 1c/kép** — a cél-commit worktree-jében `kb-shot --check-committed`, pixel-összevetés (ADR-0220) | ⛔ igen | kihagyás CSAK `KB_SHOT_GATE_WAIVE="<≥20 kar. indoklás>"`, a `DEPLOYED`-naplóba íródik |
| 6 | **GATE 1c** — KB-releváns diffnél `kb-check --coverage` a cél-commiton + `kb-gate.mjs check "<éles>..<cél>"` | ⛔ igen | kell egy FRISS tudasbazis-or PASS-token PONTOSAN erre a tartományra |
| 7 | függő migrációk listája (éles `schema_migrations` vs a cél `migrations/`) | tájékoztat | ma: `0071…0080` |
| 8 | **GATE 6** terv — az időzítők renderelése (`systemd-units.mts render-prod`), új/módosul/egyezik | ⛔ igen | élesen engedélyezett, de a cél-commitban nem prod-ként deklarált időzítő = bukás |
| — | *száraz futás itt véget ér* | | |
| 9 | push a szerver bare repójába (`/opt/citoviso/repo.git`, `refs/heads/deploy`) | ⛔ | |
| 10 | **GATE 3** — `pg_dump` → `/opt/citoviso/backups/db-pre-<ts>.sql.gz` | ⛔ igen | ⚠️ CSAK ha van függő migráció |
| 11 | checkout a megnevezett commitra + „tiszta-e a fa” visszamérés | ⛔ igen | ⚠️ innentől az ÚJ kód van a lemezen (lásd §3.3) |
| 12 | maradvány-ellenőrzés (untracked fájl a kód-fában) | ⚠️ csak figyelmeztet | szándékosan nem blokkol |
| 13 | `npm install` | ⛔ igen | |
| 14 | `npm run db:migrate` | ⛔ igen | bukásnál a servicek NEM indulnak újra |
| 15 | **GATE 5 / 5b** — `i18n-pack-status --ensure` az ÉLES DB-n, majd `kb-translation-coverage-check` (ADR-0207) | ⛔ igen | csak ha a tartomány érinti a `kb/entries/`-t vagy a `src/i18n/catalog.json`-t — ma érinti; AI-költség + idő |
| 16 | **GATE 6 / 6b** — időzítők telepítése, `enable --now`, visszamérés (fájl-hash + enabled + active) | ⛔ igen | ma: +2 új (`events` 05:30, `events-pending` 5 percenként) |
| 17 | **GATE 4** újra — közvetlenül a restart előtt | ⛔ igen | |
| 18 | restart: `citoviso-console` (:4600, kanári, `/leads` → 3xx) → `citoviso-public` (:4800, `/` → 200) | ⛔ igen | a public csak a zöld kanári után |
| 19 | `journalctl -p err` az utolsó 2 percből | ⚠️ csak kiírja | NÉZD MEG — nem bukik rá |
| 20 | `/opt/citoviso/DEPLOYED` sor + `prod/<ts>` tag push | ⚠️ tag-hiba csak figyelmeztet | |

**NEM része a deploynak (külön, utána, külön engedéllyel):**
- `scripts/rerender-tenant.mts --all` — a runtime (`cit-runtime.js`, `cit-modules.css`) a bérlő STATIKUS
  pillanatképébe van égetve; a kód kivitele egyetlen élő lapot sem változtat meg (mérve 2026-09-28). Lásd §4.2.
- `scripts/places-medium-backfill.mts` (ADR-0258) — lásd §4.8.
- **Cloudflare cache** — a szkript nem purge-öl; a `cf-cache-status` fejlécet a füst-próba nézi (§4.1).
- Az éles `.env` kulcsai (§2) — a szkript a `LEGAL_ENTITY_*` kivételével egyiket sem ellenőrzi.

Az éles állapot kérdése egy parancs: `$SSH 'git -C /opt/citoviso/app rev-parse HEAD; tail -n 3 /opt/citoviso/DEPLOYED'` + `git tag -l 'prod/*'`.

---

## 2. Deploy előtti ellenőrzőlista

- [ ] **Az éles `.env` kulcsai** — mérve 2026-09-29: élesen MIND HIÁNYZIK, devben megvan. Nélkülük a
      webcím-vásárlás élesen **mockon** fut (`src/config.ts:277-278`: `REGISTRAR_PROVIDER` / `DNS_PROVIDER`
      alapértéke `mock`), a tulaj pin-térképe pedig nem jelenik meg (`src/config.ts:261`).
      Értéket ide NE írj; a dev `.env`-ből, a tulaj engedélyével, előtte `.env`-mentés
      (`/opt/citoviso/backups/env-pre-<ok>-<ts>`, mint eddig):
      `REGISTRAR_PROVIDER` · `DNS_PROVIDER` · `WEBSUPPORT_API_KEY` · `WEBSUPPORT_API_SECRET` ·
      `WEBSUPPORT_USER_ID` · `WEBSUPPORT_EXPECTED_REGISTRANT` · `CLOUDFLARE_ACCOUNT_ID` ·
      `CLOUDFLARE_API_TOKEN` · `GOOGLE_MAPS_BROWSER_KEY`.
      Jelenlét-mérés (csak olvas, értéket nem ír ki):
      ```bash
      $SSH 'for k in REGISTRAR_PROVIDER DNS_PROVIDER WEBSUPPORT_API_KEY WEBSUPPORT_API_SECRET WEBSUPPORT_USER_ID WEBSUPPORT_EXPECTED_REGISTRANT CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN GOOGLE_MAPS_BROWSER_KEY; do printf "%s " $k; grep -cE "^$k=." /opt/citoviso/app/.env; done'
      ```
      Mind `1` kell. A `.env`-t a servicek induláskor olvassák — a deploy restartja felveszi.
- [ ] **Friss éles `pg_dump` a dev gépre is** (a VPS-en lévő mentés egy gépen él; a legutóbbi 2026-09-22-es):
      ```bash
      mkdir -p ~/citoviso-prod-backups
      $SSH 'set -o pipefail; sudo -u citoviso pg_dump -d citoviso | gzip' > ~/citoviso-prod-backups/db-$(date +%Y%m%d-%H%M).sql.gz
      gunzip -t ~/citoviso-prod-backups/db-*.sql.gz && ls -la ~/citoviso-prod-backups | tail -n 2
      ```
- [ ] **tudasbazis-or PASS-token a VÉGSŐ tartományra** — a GATE 1c a `<éles sha>..<cél sha>` tartományhoz
      kötött tokent kér; ha a cél-commit a futtatás előtt mozdul (újabb land), új token kell.
      `node scripts/kb-gate.mjs check "263ef8dd…..<cél>"` → exit 0; ha nem: az őr futtatása, majd
      `node scripts/kb-gate.mjs pass "<éles>..<cél>" "<kivonat>"`.
- [ ] **Száraz futás zöld** a fő fából: `bash scripts/deploy-prod.sh <cél sha>` — a kimenetben: GATE 1b ✓,
      1c/kép „mind a N commitolt súgó-kép friss”, 1c ✓, a 10 migráció listája, a GATE 6 terve.
      ⚠️ Egyszerre csak EGY fusson (`pgrep -fa deploy-prod`), a 1c/kép Chromiumot indít.
- [ ] **GATE 6 tudomásul:** két új időzítő indul élesen — `citoviso-events.timer` (naponta 05:30) és
      `citoviso-events-pending.timer` (boot után 3 perc, majd 5 percenként). A meglévő 4
      (`billing` 07:00, `booking-maintenance` óránként, `domain-resume` 2 percenként, `traffic-mail` 08:00)
      marad. Vészterv-következménye: §3.1 GATE 6.
- [ ] **GATE 5 tudomásul:** a tartomány érinti a katalógust és a súgót → a deploy közben AI-fordítás fut az
      éles DB-n (idő + költség); a restart csak a zöld 5b után jön. A felületi csomagok és a súgó fordítása
      AUTOMATIKUS — kézi `kb-translate` NEM kell (a régi „kézi újrafordítás” sor elavult, ADR-0207).
- [ ] **Nincs futó éles scrape** (GATE 4 úgyis megállít) — a scrape vonal a tulaj külön szála.
- [ ] Legyen idő a teljes §4 füst-próbára (~30–40 perc) közvetlenül utána; a deploy és a füst-próba között ne
      menjen kiküldés (outreach).

---

## 3. VÉSZTERV — visszagörgetés

**Döntési pont:** ha a füst-próba (§4) működést törő hibát talál, két út van —
**előre-javítás** (fix → land → új `deploy-prod.sh <új sha> --go`, ugyanazok a kapuk) vagy **visszagörgetés** a
deploy előtti verzióra. Apró, körülhatárolt hibánál az előre-javítás a gyorsabb és kockázatmentesebb;
adat-sérülésnél, fizetési hibánál vagy tömeges 5xx-nél a visszagörgetés.

Minden lépés élesi írás → **a tulaj engedélye, lépésenként.**

### 3.1 Mi bukna ma a `deploy-prod.sh 263ef8dd --go`-n, és a kiút

A szkript fejléce szerint „Rollback = the same script with the previously deployed SHA” — de a régi commit
MÉRVE három kapun bukna:

| Kapu | Miért bukik | Kiút |
|---|---|---|
| **GATE 1c/kép** | a `263ef8dd` `kb-shot.mts`-e nem ismeri a `--check-committed`-et (ADR-0220 előtti) → „nem tud összevetni” | `KB_SHOT_GATE_WAIVE="visszagörgetés <új sha> → 263ef8dd: a régi kb-shot ADR-0220 előtti"` (a `DEPLOYED`-be íródik) |
| **GATE 6** | élesen engedélyezve lesz a `citoviso-events.timer` és a `citoviso-events-pending.timer`, a `263ef8dd` `targets.json`-ja nem deklarálja → „nem-deklarált időzítő” | KÉZZEL letiltani (lent, 2. lépés) |
| **GATE 1c** | a fordított tartományra (`<új>..263ef8dd`) nincs tudasbazis-or token | `node scripts/kb-gate.mjs pass "<új sha>..263ef8dd" "visszagörgetés — a súgó a régi verzióra áll vissza"` (az őr futtatása után) |

A **GATE 5** a fordított tartományon is lefut (a katalógus változik), a régi katalógussal — idő és AI-költség.

### 3.2 Adatbázis: nincs down-migráció

A `0071…0080` additív (új táblák/oszlopok), a régi kód nagy része elfut rajtuk — **de** a `0072` a
`booking_request.status`-ba bevezeti az `offered`-et, a `0077` a `payment.status`-ba a `reserved`/`released`-et.
Ha a deploy után akár egy ilyen sor keletkezik, a régi kód nem ismeri (nem mutatja, nem zárja le, rossz ágra
fut). Ezért visszagörgetésnél **a biztos út a GATE 3 `pg_dump` VISSZATÖLTÉSE** (`db-pre-<ts>.sql.gz`, a
deploy saját kimenetében a pontos név).

⚠️ A visszatöltés ELVESZI a deploy óta keletkezett adatot (foglalási kérés, fizetés, lead). Előtte a
hibás állapotot is ments le, és a deploy óta keletkezett fizetési/foglalási sorokat nézd át
(`scripts/find-payment.mts`), hogy kit kell kézzel értesíteni.

⚠️ **A visszagörgető deploy NEM készít `pg_dump`-ot**: a régi commitnak nincs függő migrációja, a GATE 3 csak
függő migrációnál fut. A mentést kézzel kell (1. lépés).

⚠️ A visszatöltést ezen a sémán **senki nem próbálta ki** — a parancsok a szokásos Postgres-eljárás; ha van rá
idő, előbb egy `citoviso_rb` próba-DB-be töltés (2–4. lépés) már önmagában megmutatja, hogy a dump ép.

### 3.3 Félbeszakadt deploy

A checkout (1. §, 11. lépés) után az **új kód van a lemezen** akkor is, ha a migráció, a GATE 5 vagy a GATE 6
bukik, és a servicek még a régi kódot futtatják a memóriából. De a `citoviso-domain-resume.timer` **2 percenként**
új folyamatot indít — az már a lemezen lévő ÚJ kódból fut, a (részben) régi sémán. Tehát bukás után
**azonnal dönteni kell**: a hiba okát javítva a deploy újrafuttatása (előre), vagy a lenti vészterv. Ha a döntés
nem születik meg perceken belül: `$SSH 'systemctl stop citoviso-domain-resume.timer'` (a GATE 6 a következő
deploynál visszaállítja).

### 3.4 Lépésről lépésre (visszagörgetés `263ef8dd`-re)

```bash
SSH="ssh -i ~/.ssh/citoviso_hetzner root@178.104.3.223"
OLD=263ef8dddef0a7f1dbbc43af1003c8045776c198      # a DEPLOYED-sor prev= mezője
NEW=$($SSH 'git -C /opt/citoviso/app rev-parse HEAD')
TS=$(date +%Y%m%d-%H%M%S)

# 1) a hibás állapot mentése (a VPS-re ÉS a dev gépre)
$SSH "set -o pipefail; sudo -u citoviso pg_dump -d citoviso | gzip > /opt/citoviso/backups/db-failed-$TS.sql.gz && ls -la /opt/citoviso/backups/db-failed-$TS.sql.gz"
$SSH "cat /opt/citoviso/backups/db-failed-$TS.sql.gz" > ~/citoviso-prod-backups/db-failed-$TS.sql.gz

# 2) forgalom és időzítők le (a GATE 6 miatt az events-időzítőket le is TILTJUK)
$SSH 'systemctl stop citoviso-public citoviso-console'
$SSH 'systemctl stop citoviso-billing.timer citoviso-booking-maintenance.timer citoviso-domain-resume.timer citoviso-traffic-mail.timer'
$SSH 'systemctl disable --now citoviso-events.timer citoviso-events-pending.timer'

# 3) a deploy előtti dump betöltése egy ÚJ DB-be (a hibás megmarad, átnevezve)
PRE=db-pre-XXXXXXXX-XXXXXX.sql.gz                  # a deploy GATE 3 kimenetéből
$SSH "sudo -u postgres createdb -O citoviso citoviso_rb && set -o pipefail && gunzip -c /opt/citoviso/backups/$PRE | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d citoviso_rb"
$SSH "sudo -u postgres psql -d citoviso_rb -tAc 'select max(name) from schema_migrations'"   # → 0070_…

# 4) csere (a servicek állnak, nincs kapcsolat)
$SSH "sudo -u postgres psql -c 'ALTER DATABASE citoviso RENAME TO citoviso_failed_$TS' -c 'ALTER DATABASE citoviso_rb RENAME TO citoviso'"

# 5) a három kapu kiútja, majd a régi verzió (a fő fából)
node scripts/kb-gate.mjs pass "$NEW..$OLD" "visszagörgetés — a súgó a régi verzióra áll vissza"   # a tudasbazis-or után
KB_SHOT_GATE_WAIVE="visszagörgetés $NEW → $OLD: a régi kb-shot ADR-0220 előtti" \
  bash scripts/deploy-prod.sh $OLD            # SZÁRAZON előbb: a migráció-lista legyen ÜRES, a GATE 6 zöld
KB_SHOT_GATE_WAIVE="visszagörgetés $NEW → $OLD: a régi kb-shot ADR-0220 előtti" \
  bash scripts/deploy-prod.sh $OLD --go       # checkout → npm install → GATE 5 → GATE 6 (a 4 régi időzítőt visszakapcsolja) → restart

# 6) visszamérés
$SSH 'git -C /opt/citoviso/app rev-parse HEAD; tail -n 1 /opt/citoviso/DEPLOYED; systemctl list-timers "citoviso-*" --no-pager'
curl -sI https://citoviso.com/ | head -n 1
```

Utána: a `citoviso_failed_<ts>` DB-t NE töröld, amíg a deploy óta keletkezett sorok sorsa nincs eldöntve.

---

## 4. Deploy utáni füst-próba (tesztbérlő: `ferenc-haz`, telefonról, ~30–40 perc)

Sorrendben; bármelyik piros → §3 döntési pont. Ami élesi írás (rerender, backfill, takarítás), az külön engedély.

1. **Verzió, időzítők, napló, cache**
   ```bash
   $SSH 'git -C /opt/citoviso/app rev-parse HEAD; tail -n 1 /opt/citoviso/DEPLOYED'
   $SSH 'systemctl list-timers "citoviso-*" --no-pager'          # 6 prod időzítő, mind van NEXT
   $SSH 'journalctl -u citoviso-console -u citoviso-public -p warning --since "-15 min" --no-pager -q'
   curl -sI https://ferenc-haz.citoviso.com/ | grep -i -E '^HTTP|cf-cache-status'
   ```
   A `cf-cache-status: HIT` régi lapot jelenthet — a rerender után újra mérd.
2. **Pillanatkép-újrarenderelés** (élesi írás, engedéllyel):
   `npx tsx scripts/rerender-tenant.mts --all --dry` (lista) → `--all` → a `ferenc-haz` ÉS egy valódi bérlő
   lapjának megnézése telefonon (galéria ADR-0259, nyitókép `photos[0]`).
   ⛔ A kapcsoló `--dry`, NEM `--dry-run` — az ismeretlen kapcsolót a szkript nem utasítja el, a `--dry-run`
   tehát némán ÉLESBEN futna (`feedback_near_miss_on_safety_switch_is_silent_opt_out`).
3. **Vendég-út a TENANT hoston** (`https://ferenc-haz.citoviso.com/`, nem a platform `/t/<slug>/`-én):
   foglalási kérés → tulaj-levél → a tulaj dönt (admin, telefonon) → vendég-levél: MINDEN linkje
   (visszaigazolás, lemondás, ajánlat-elfogadás, leiratkozás) a tenant hoston nyíljon, 404 nélkül → lemondás
   végig. (Devben ezt csak a `guest-link-host-check` méri nyers Host-fejléccel; élesben először itt.)
4. **Ajánlat-út:** kérés → a tulaj árajánlatot küld (ADR-0267) → a vendég elfogadja a levélből → a naptár foglalt.
5. **Valódi postafiók:** a fenti levelek Gmailben ÉS iOS Mailben — megjelenés, `.ics` melléklet telefonon a
   naptárba kerül, nem spam, és **nincs „(nem valódi)” lábazat** (`feedback_gate_measured_text_not_its_source`).
6. **Német vendég:** a lap `de` nyelven + egy kérés → a vendég-levelek németül (a GATE 5 által generált csomag).
7. **100 Ft-os éles próbavásárlás:** terhelés → webhook → élesítés → **valódi számla** megérkezik → az
   előfizetés lemondása. (A teljes éles fizetési kör egyetlen bizonyítéka; a hivatkozás `CIT-XXXXXXXX`,
   visszakereshető: `scripts/find-payment.mts`.)
8. **Utómunka (külön engedéllyel):**
   `npx tsx scripts/places-medium-backfill.mts` (száraz, alapból) → átnézés →
   `--apply --backup <fájl>`; a demó-leadek és teszt-rendelések takarítása a prodból
   (`2026-09-24_barion_advanced_approved.md`; a próbavásárlás sorai is).
9. **D+1:** `$SSH 'journalctl -u "citoviso-*" -p warning --since yesterday --no-pager -q'` — az events 05:30-as,
   a billing 07:00-s és a traffic-mail 08:00-s első éles futása; az events-pending 5 perces futásai hiba nélkül.

⚠️ A konfigurátort az untracked `/configure/<artifactId>` úton nézd, ne a `/p/<token>`-en — különben a saját
hívásaid `mock_view` sorokat írnak a lead-statisztikába.

---

## 5. Pilot utánra halasztva (tulaj-döntés, 2026-09-29)

Tudatosan NEM a nagy deploy része — ne kérd számon, ne blokkolja:
- **vélemény-kérő job** a tartózkodás után — ma NEM létezik (a „vélemény-kérés” idővezérelt ága nincs megírva);
- **vendég-ÁSZF / lemondási feltételek** a bérlői lapokra;
- **GDPR érintetti kérelem** kiszolgálása (hozzáférés/törlés folyamat);
- **CSRF-token** az űrlapokon;
- **idegen nyelvű jogi oldalak** (országonkénti jogi csomag, §B.18);
- **`x-forwarded-for` hamisíthatósága** (a rate-limit kulcsa);
- **napi éles `pg_dump`-időzítő + off-site mentés** — addig a GATE 3 és a §2 kézi lehúzása a mentés.

---

## 6. Szálak jelzése (rövidítve)

A régi szálankénti készenléti tábla (2026-08-21) elavult és kivezetve: verzió megy ki, nem fájl, tehát egy
szál része akkor „kész”, ha landolt az `origin/main`-re, és a nagy deploy viszi.
Ha egy szálnak deploy-előfeltétele vagy deploy utáni teendője van, **ide, egy sorban** jelezze:

| Szál / ADR | Mit kér a deploytól | Hol |
|---|---|---|
| Pillanatkép-runtime (2026-09-28) | `rerender-tenant --all` a deploy után | §4.2 |
| Places medium (ADR-0258) | `places-medium-backfill` szárazon, majd `--apply --backup` | §4.8 |
