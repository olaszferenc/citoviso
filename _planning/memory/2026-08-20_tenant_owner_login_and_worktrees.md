# 2026-08-20 — Tenant vissza-belépés az élő oldalról (ADR-0042) + session-izoláció git worktree-vel

## Kiváltó (tulaj)

> „Élesítés után a tenant nem tudja hol tud adminjába belépni, szerintem erre kellene neki egy
> belépés gomb. Vagy mi a javaslatod?"

## Lelet — a rés valós volt

- `serveTenantHost` a live snapshotot `/`-on adta, **minden más útvonal 404** → a tulaj ösztönös
  `sajátoldala.hu/admin` tippje hibára futott.
- A lábléc Citoviso kredit-csíkja (`src/generator/runtime.ts`) kizárólag a `citoviso.com`-ra mutatott;
  a tulaj felé **semmilyen kapaszkodó nem volt**. Az egyetlen mutató a go-live e-mail — ami elveszik.

## Döntés (ADR-0042) — rétegzett, diszkrét, NEM feltűnő gomb

A live oldal elsődleges közönsége a LÁTOGATÓ; egy hangsúlyos belépés-gomb az ő konverziós útját rontaná.

1. **Kitalálható URL:** tenant-hoszt `/admin` és `/login` → **302** a tenant-loginra (404 helyett).
2. **Halk lábléc-sor:** „Tulajdonosi belépés" a kredit-csík alatt, keret nélkül és tompán, hogy a csík
   FOLYTATÁSAKÉNT olvasódjon (ne második sávos lábléc). `rel="nofollow"`.
3. A **go-live e-mail marad az elsődleges csatorna** — a webes rétegek csak backupok.
   ⚠️ NYITOTT: a levél belépés-tartalmának auditja (tartalmazza-e az URL-t + felhasználónevet).

## Architektúra-elv — SERVE-time injektálás

`src/server/ownerLogin.ts` (a `demoFrame.ts` mintája): a motor kimenete tiszta marad, és a link
**soha nem szivároghat ki egy outreach-mockra**. Ez nem kényelmi kérdés — a mock fázisban NINCS fiók,
amibe be lehetne lépni, tehát egy „belépés" felirat hamis ígéret volna (§I szomszédsága).

⚠️ **Következmény, amit tudni kell:** a serve-time injektálás **kívül esik a generálás-idejű i18n-őrön**
(`generateEngine.ts` `ensureLanguagePack`). Az injektor csak `loadPack`-et hív (olvas), nem `ensure`-t —
szándékosan: az `ensureLanguagePack` AI-fordítást indít (`translateBatch`), ami page-request hot path-ra
sosem való. A feltöltés helye a **boot-idejű self-heal** (`ensureAllLanguagePacks`, ADR-0036/b).

## i18n + dizájn

- A felirat `T(d, "…")`-vel születik; a nyelvet a snapshot **saját `<html lang>`-je** adja.
- A fájl bekerült a doktrína-láncba (`extract-i18n` / `i18n-lint` / `i18n-scan`) — enélkül idegen nyelvű
  tenant-oldalon némán magyar maradt volna.
- A csík szándékosan **nem `--citui-*`-ból** színez: az a MI felületünk dizájn-magja; egy tenant-oldal a
  motor `--cit-*` skinjét hordozza, ezért a sornak skin-agnosztikusnak kell lennie.

## Verifikáció

`tsc` ✅ · i18n-lint ✅ · katalógus-frissesség ✅ · design-token-lint ✅ · injektor füst-teszt
(idempotens, kredit-csík UTÁN, helyes URL, `</body>` nélküli HTML-re is) ✅ · vizuál **390px + 1280px** ✅
⚠️ NEM futott: a 302 élő szerveren, valós live tenant-hoszttal (DB-ben live site-rekord kellene) —
kódolvasással ellenőrizve (a tenant-hoszt ága fut előbb, `public.ts:376`).

---

# A MÁSIK FELE: ~11 session EGY working tree-ben

## A lelet

A `git status` nem „korábbi session maradéka" volt: **hat+ session dolgozott élőben ugyanabban a
mappában**. Munka közben két commit landolt alattam, egy fájl eltűnt, a végén pedig a saját munkámat
**egy másik session `git add .`-elte be** (`44a6d82`, 27 fájl, 4 különböző téma keverve) — plusz az
ADR-0042 egy i18n-commitba (`d60f76a`) került. Semmi nem veszett el, de a történet kevert.

**Valós áldozat (másik szál rögzítette):** a kevert `44a6d82`-ből **kimaradt a reenrich route**, bár a
gomb bekerült → félig működő állapot ment ki.

## Megoldás — sessiononként külön git worktree: `~/bin/rc-wt.sh`

```
rc-wt.sh "SEO réteg A" seo     # → ~/wt/seo, wt/seo branch, saját portok, ott indul az RC-session
```

### ⚠️ A kritikus megkötés: NINCS KÖTŐJEL a worktree útvonalában

A `rc-watchdog.py` a transcript-mappából `basename.replace("-", "/")`-tel számol vissza repo-útvonalat
(`projdir_to_proj`, 32. sor). Kötőjeles mappanév **hibás útvonalra invertálna, és a watchdog rossz fában
támasztaná fel a sessiont — csendben.** Ezért a slug `[a-z0-9]`-re szűrt. Ezt NE „javítsd".
Ellenőrizve: `~/wt/probe` → `-home-citoviso-wt-probe` → vissza `/home/citoviso/wt/probe` ✅
→ **a watchdogot nem kellett módosítani.**

### Amit a vizsgálat kihozott

- ✅ **DB automatikusan megosztott:** az embedded Postgres **abszolút** unix socketen figyel
  (`/tmp`, 5433) → nincs adat-szétcsúszás, nincs duplikált klaszter, nincs teendő.
- ✅ **git-hook öröklődik** (`core.hooksPath` a közös `.git/config`-ban), a `hooks/` követett.
- 🔗 **Linkelni kell** (gitignore-olt, de nélkülözhetetlen): `.env` (titok — másolva driftelne),
  `node_modules` (134M), `assets/Temp`, és ami nem nyilvánvaló: **`sites/`** — a DB *cwd-relatív*
  útvonalat tárol (`path.resolve(process.cwd(), site.path)`), így saját `sites/` mappával **minden élő
  tenant-oldal 404-ezne**.
- 🔌 **Portok:** `CONSOLE_PORT` / `PUBLIC_PORT` env-vezérelt, a szkript slug-hashből stabil párt oszt
  (4600/4800 ütközne). Egyik sincs a `.env`-ben, tehát env-ből felülírható.

### Korlátok

1. **Futó sessiont nem lehet átmozgatni** — a cwd induláskor rögzül. Ez az ÚJ sessionökre hat.
2. **Worktree = saját branch** (a git nem enged egy branchet két helyen) → **merge lesz a folyamat része**.

## Szabály innentől

- ⛔ **Soha `git add .`** — mindig path-scoped `git add`.
- Új szál → `rc-wt.sh` saját worktree-vel, ne a fő fában.
- Commit után **hívó+hívott ellenőrzés** (a kimaradt reenrich route tanulsága).

## Módosított / létrehozott fájlok

- `src/server/ownerLogin.ts` (**új**) — serve-time injektor
- `src/server/public.ts` — import + `/admin`·`/login` 302 + injektálás a live snapshotra
- `scripts/extract-i18n.mts`, `scripts/i18n-lint.mts`, `scripts/i18n-scan.mjs` — a fájl bekötése
- `src/i18n/catalog.json` — „Tulajdonosi belépés"
- `_planning/DECISIONS.md` — **ADR-0042**
- `/home/citoviso/bin/rc-wt.sh` (**új, repón kívül**) — worktree-s session-indító

## Nyitott

- Go-live e-mail: tartalmazza-e a belépési URL-t + felhasználónevet? (1. réteg, a tulaj nem kérte)
- A 302 élő verifikációja valós live tenant-hoszton.
- A régi, hetek óta nyitva álló sessionök (`c7c54a06` aug 17 óta, `50733a49` aug 14 óta) lezárása.
