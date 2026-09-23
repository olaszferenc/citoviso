# 2026-09-22/23 — Az elutasított kártya nem néma · a park megmondja magáról · a deploy-kapuk tudnak bukni

**Kiinduló kérdés (tulaj):** ha a tenant a Modulok fülön rányom az „Alkalmazom — a kártyáját
4 900 Ft-tal terheljük" gombra, a tárolt kártyát terheli-e a rendszer, és kell-e még bármit tennie?
**Válasz:** igen, élő megbízásnál egy kattintás — MIT-terhelés → a modul azonnal él → számla. A gomb
felirata szerkezetileg a megbízás meglététől függ (`AUTOC`, `subscriptionAdmin.ts`). A lyuk az
ELUTASÍTOTT terhelés ága volt. **Élesítés:** NINCS (§0.3) — minden landolt, egyik sem ment ki.

## Mit csináltunk (landolt commitok)
- `c4e61db` — **elutasított kártya:** a néma gateway-redirect (élesen a Barion lapja) helyett a tulaj a
  Modulok fülön marad, piros sáv (`#kartya-elutasitva`) + „Fizetés kézzel" (a DB-ből olvasott saját
  pay-link, `openUpsellPayUrl` — a query-be tenni open redirect lenne). Vegyes beküldésnél a megerősítő
  felugró KATTINTÁS ELŐTT mondja ki, hogy a lemondás a fizetéstől függetlenül érvénybe lép. KB átírva
  (a „Mi van, ha a fizetés nem sikerül?" a megszűnt utat írta le). Új őr: `declined-mandate-note-check` (7 állítás).
- `a7aaf5a4` — **végigfuttatva VALÓDI POST-tal** (roze-fogado, `PAYMENT_GATEWAY=mock` + `MOCK_RECURRING_FAIL=1`,
  vegyes beküldés): 10/10 állítás, minden írás visszagörgetve. Csak ez mutatta meg, hogy a soron belüli gomb
  390 px-en széthúzta a sort → saját sorba.
- `e55f821` — **`scripts/park-doctor.mts`** + a `gate_failed` park-gyanúnál egy sorral odaküld (negatív
  kontrollal: valódi leletnél csendben marad). Mérve: 166 kapuból 55 a közös dev-DB-t olvassa.
- `d6d7c9c1` — **a fordítás CSAK a deploy kapuja** (ADR-0207 módosítás, tulajdonosi döntés): a commit nem kér fordítást.
- `249684bd` — `kb-freshness` ④ az ÉLES fordítást méri (csak olvasás), nem a dev-DB-t.
- `127f2194` — ⛔ **a `deploy-prod.sh` hat blokkoló kapuja nem tudott bukni** (`$SSH "… | tail" || fail` a
  tail kódját látja — mérve az éles gépen): pg_dump, db:migrate, npm install, GATE 5/5b, helyi `| sort`.
  `pipefail` soronként + őr: `deploy-pipe-check` (a javítás előtti fájlon pontosan a 6 sort találja).

## Tanulság
- ⛔⛔ **Felelősséget áthelyezni egy kapura csak azután szabad, hogy bebizonyítottad: BUKNI tud.** Reggel a
  GATE 5-re tettem a súgó-fordítás egyetlen kényszerét; délután derült ki, hogy nem tud bukni.
- ⛔ **Három saját téves állítás, mind méréssel cáfolva:** „a mock a mi hosztunkon fut, ezért lokálban nem
  látszott" (a dev a Barion SANDBOXOT futtatja); a képeim tenantja (Nyugalom) nem is kártyás; a jóváhagyott
  preview „Fiók fülön frissítse a kártyát" kijárata nem létezett (a mandátum-blokkban van).
- ⭐ A „piros" háromféle: park-állapot (idegen teszt-szemét: `_amdedup_…` lead hat land-kísérletet blokkolt),
  verseny (közös DB + fánként más magyar forrás), valódi lelet (a saját őröm bekötetlen maradt — a
  guard-wiring-check fogta). Csak az utolsó szól a diffről.
- ⚠️ A negatív kontrollt csak a MÉRT sorra alkalmazd: egy `sed` az önteszt saját mintáját is átírta, és zöld maradt.

## Módosított fájlok
`src/server/{adminViews,public}.ts` · `src/payment/service.ts` · `public/assets/ui/citui-admin.css` ·
`kb/entries/admin-modules/entry.hu.md` · `src/i18n/catalog.json` · `hooks/pre-commit` ·
`scripts/{declined-mandate-note-check,park-doctor,deploy-pipe-check}.mts` (új) · `scripts/kb-freshness.mts` ·
`scripts/deploy-prod.sh` · `_planning/decisions/0207-*.md` · `_planning/DOMAIN/03-INVARIANTS.md` · `.claude/agents/tudasbazis-or.md`

## Nyitott kérdések / következő lépés
- 🔴 **A korábbi pg_dump-mentések valódisága nem bizonyított** (a kapu nem tudott bukni): `/opt/citoviso/backups/db-pre-*.sql.gz`
  méret + `gunzip -t` — csak olvasás, a tulaj szavára.
- A következő deploy az ELSŐ, amelyen a GATE 3/5/5b és a migráció kapuja valóban bukni tud; függő fordítás: `admin-modules-rooms`, `admin-modules`, `admin-overview`.
- `kb-freshness` ②: a tenant-súgó képernyőképei régebbiek a view-knál (`kb-shot`, átnézéssel).
- A 14 napja árva `_mcfg_check lead` a parkban (a park-doctor jelzi, nem törli) — a tulaj szavára.
