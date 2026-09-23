## ADR-0075 — Teszt-adat purge: a SZERZÉSI oldal marad, a SZÁLLÍTÁSI oldal ürül (szkriptelve, nem kézzel)

- **Dátum:** 2026-08-26 · **Státusz:** ELFOGADVA, végrehajtva lokálban · **Kapcsolódó:**
  ADR-0041 (az első, kézi purge 2026-08-20), ADR-0053 (dry-run-alapértelmezés mint kapu-minta).
- **Tulaj-kérés (szó szerint):** „üritsd ki lokálon a teszt mockokat meg slug honlapokat meg
  mindent! a scrape lead stb maradjon"

**Döntések.**
1. **A vágás vonala a pipeline-on: SZERZÉS marad, SZÁLLÍTÁS ürül.** Marad a drága, újra nem
   termelhető réteg (`lead`, `lead_provenance`, `scrape_run`, `scraper_definition`, `region`);
   ürül a belőle bármikor újragyártható lánc (mock → prospect → tenant → site → entitlement →
   order → payment → invoice → accounting_document) és a lemezes snapshot-állomány.
2. **Tulaj-döntés a határesetekre (2026-08-26):** a pénzügyi **tranzakciók** mennek, a **törzsadat**
   marad (`partner`, `legal_entity`, `bank_account`, `module_price`, `pricing_config`) — hogy a
   pénzügyi modul fejleszthető maradjon keret nélkül újraépítés nélkül. Az operátor-fiókok mind
   maradnak. A fejlesztői lemez-kimenet (`sites/_engine-proof`, `_outreach-shots`, `_console-shots`,
   `_inbox-ab`) NEM adat, marad.
3. **Szkript, nem kézi SQL** — `scripts/purge-test-data.mts`. Ez a MÁSODIK purge (az első kézzel
   ment, ADR-0041); a második előfordulás a rétegről szól, nem a feladatról. Kapui a
   `deploy-prod.sh` mintáját követik: **dry-run alapból**, `--go` kell az íráshoz, teljes JSON-mentés
   a törlés ELŐTT (`_planning/backups/`, gitignorált — lead-PII), EGY tranzakció, majd
   önellenőrzés (a célzott táblák tényleg üresek-e, a megőrzendők tényleg megvannak-e).
4. **A konvertált lead visszakerül a körbe:** `lifecycle_status` `activation`/`conversion` →
   `qualified` (6 lead), így a korpusz nem csak megmarad, hanem újra használható is.

**Vállalt mellékhatás.** A `curator_decision` FK-CASCADE-del lóg a `mock_artifact`-on, tehát a
mockokkal 25 kurátori döntés is elment. Mock nélkül nincs értelmük — de ez a purge NEM
veszteségmentes a kurációs oldalon, és a mentés-JSON az egyetlen visszaút.

**Mérés (2026-08-26 futás).** Törölve: 30 mock_artifact, 7 prospect, 20 mock_view, 200 mock_event,
7 tenant → 7 site + 9 site_unit + 92 entitlement + 4 tenant_user, 14 bizonylat, 4 számla,
9 fizetés, 11 rendelés, 25 curator_decision; lemezen 11 snapshot-mappa + 28 mock-fájl + 19 outbox.
Érintetlen: 592 lead, 2119 lead_provenance.

**Mellék-javítás — a `sites` symlink NEM volt ignorálva.** A `.gitignore` `sites/` mintája záró
perjeles, ami symlinkre nem illeszkedik (a git fájlt lát, nem könyvtárat) — a worktree-beli
`sites` szimbolikus link `??`-ként állt a status-ban. Pontosan ez a rés vitte be egyszer a
per-worktree `assets/Temp` linket, ami landolva felülírta a fő fa valódi mappáját. A minta most
perjel nélkül IS szerepel (ahogy az `assets/Temp`-nél már javítva volt). A pre-commit 120000-őre
a második védvonal marad.

**Visszafordíthatóság:** 🚪 egyirányú az adatra nézve (a mentés-JSON a visszaút, de a lemezes
HTML-snapshotok NEM kerültek a mentésbe — azok az `inputs`-ból újrarenderelhetők, ADR determinisztikus
re-render). A szkript maga 🔄.

**Nyitott.** ① A `sites/_engine-proof` 242M-je (a `sites/` 98%-a) továbbra is ott ül — regenerálható,
de a purge szándékosan nem nyúlt hozzá. ② A mentés-JSON lead-PII-t tartalmaz és a `_planning/backups/`
ma korlátlanul gyűlik — retenciós szabály nincs.
