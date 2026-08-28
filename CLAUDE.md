# Citoviso — Globális Claude Code Konvenciók

⚠️ EZEK A SZABÁLYOK KÖTELEZŐEK. NEM OPCIONÁLISAK. MINDEN SESSIONBEN ÉRVÉNYESEK.

> **Mi ez a projekt?** **Iparág-AGNOSZTIKUS** weboldal-generáló + disztribúciós gép: **bármely standardizálható iparág** digitálisan gyenge szereplőinek nyilvános adataiból/képeiből (Google Maps / portál-bejegyzések) automatikusan modern, reszponzív, konverzió-fókuszú online jelenlétet generál — **ÉS láthatóvá teszi** (Google Maps/GBP + SEO/indexelés; a honlap szükséges, de nem elegendő). Az iparág **paraméter**, nem beégetett kód; a szállás/vendéglátás a nulladik ponton beazonosított **első pilot-vertikum, NEM a termék határa**. Üzleti horog: hideg, személyre szabott mockup-megkeresés → élesítés (fizetős kapu) → moduláris upsell (pl. szállásnál booking-jutalék kiváltása).

---

## 0. DEPLOY DOKTRÍNA (⚠️⚠️ MEGKERÜLHETETLEN — MINDEN MÁS ELŐTT)

Ez a szabály felülír mindent, beleértve a `bypassPermissions` engedély-módot is. A bypass CSAK a lokális, jóváhagyás nélküli munkára vonatkozik — élesre NEM ad felhatalmazást.

1. **Lokál először, mindig.** Minden változtatást ezen a Debian dev-gépen (`/home/citoviso/citoviso`) fejlesztek és tesztelek. Élesre semmi nem megy, amíg lokálban nincs leellenőrizve.
2. **Élesre VERZIÓ megy, nem fájl-másolat (ADR-0053).** Az élesítés = egy MEGNEVEZETT COMMIT kicsekkolása, és a verzió felírva az éles gépre — így a „mi fut élesen?" egyetlen parancs. ⛔ A korábbi „csak a módosított fájlokat visszük" szabály FELÜLÍRVA: az termelte, hogy az éles ma **8 különböző dátum fájljaiból** összeálló kollázs (20 fájl soha nem ment ki, 47 eltér), vagyis olyan állapotot futtat, ami egyetlen commitban sem létezett és sehol nem lett tesztelve. A diff-before-deploy elve ATTÓL MÉG ÉL: a két tag közti diffet listázd ki élesítés előtt. **Eszköz: `bash scripts/deploy-prod.sh <commit> [--go]`** (2026-08-22 óta ÉLES) — kapui: csak origin/main-en lévő commit mehet; dry-run alapból; pg_dump migráció előtt; console-kanári → public restart-sorrend; „mi fut élesen?" = `git -C /opt/citoviso/app rev-parse HEAD` + `/opt/citoviso/DEPLOYED` + `prod/*` tagek.
3. **Élesre csak külön, scope-olt engedéllyel.** Bármilyen élesi írás (fájl VAGY DB) CSAK a felhasználó explicit, az aktuális turn-ben adott engedélyével. Az engedély EGYETLEN push-műveletre szól, nem marad nyitva a következőre. Minden új élesi művelet előtt ÚJ engedélykérés.
4. **Élesi olvasás szabad** (diagnosztika), élesi mutálás soha engedély nélkül.
5. **Éles infra ÉL** (2026-08-02 óta) — lásd a §5 tereptérképet. A doktrína tehát NEM elméleti.

> A gépen globális PreToolUse hook (`block_live_deploy.sh`) blokkolja az élesi írást/deploy-t engedély nélkül — ez a repóra is véd. Override CSAK current-turn user-engedéllyel.

---

## 1. SESSION INDÍTÁSA (ELSŐ LÉPÉS — MÁS NEM TÖRTÉNHET ELŐTTE)

1. Olvasd el ezt a fájlt: `/CLAUDE.md`
2. Olvasd el: `/MEMORY.md` (projekt-összefoglaló)
3. Nézd át a `_planning/memory/` indexét (fejlődő vállalati memória)
4. Nézd át a `_planning/DECISIONS.md` legutóbbi ADR-jeit — **döntés (adatmodell, árazás, folyamat, infrastruktúra) implementálása ELŐTT vissza kell olvasni az érintett ADR-t.** Egy már meghozott döntés újratárgyalása vagy megsértése a leggyakoribb hiba-forrás. ⚠️ Új ADR írásakor a sorszámot **közvetlenül írás előtt** ellenőrizd `git fetch` után — párhuzamos szálak egyszerre számoznak (2026-08-22: két ADR-0051 keletkezett).
5. Nézd át a `_planning/DOMAIN/04-INDEX.md`-t (vállalati ontológia) — domain-döntés (adatmodell, árazás, generálási szabály) előtt KÖTELEZŐ
6. Ha valamelyik nem létezik: jelezd és hozd létre üres sablonnal
7. Foglald össze 3-5 sorban: hol tartunk, mi volt az utolsó feladat
8. Kérdezd meg: min szeretne dolgozni

> **Ontológia nulláról:** a domain-tudást (fogalmak, entitások, invariánsok, számítási modellek) a `_planning/DOMAIN/`-ban KEZDETTŐL építjük — nem utólag desztilláljuk. Új tartós tudás → a megfelelő DOMAIN-fájlba, ne csak a memóriába.

---

## 2. FELADAT VÉGREHAJTÁS UTÁN (MINDEN EGYES FELADAT UTÁN KÖTELEZŐ)

- [ ] ✅ Kész státusz jelzése
- [ ] 📁 Módosított / létrehozott fájlok listája (teljes útvonallal)
- [ ] 💡 Következő logikus lépés javaslata (ha van)

---

> ⚠️ **A DOKTRÍNA IS ELAVULHAT A FÁDBAN** (ADR-0079, 2026-08-28): a munkafa a szabályok
> befagyott pillanatképe. Ezt a fájlt egy 12 committal lemaradt fából olvasva egy session a
> már KIVEZETETT design-appba akart tervet tölteni. Ezért fut globálisan (a repón kívülről,
> `~/.claude/hooks/block_stale_doctrine.sh`) egy őr, ami BLOKKOLJA a szerkesztést, ha a fa
> `CLAUDE.md`-je eltér az `origin/main`-étől. Ha blokkol: `git fetch` + `rebase`, és olvasd
> ÚJRA az érintett szakaszt.

## 2b. TERV-JÓVÁHAGYÁSI KAPU — FELÜLET-MUNKA (⚠️ MEGKERÜLHETETLEN, ADR-0065/0066/0076)

⚠️ **Kinézeti döntést igénylő felület-munkánál a sorrend KÖTELEZŐ. A kapu előtt kódot írni tilos.**

**Mi a CÉL (2026-08-26, tulajdonosi pontosítás — ez a kapu LÉNYEGE, a lépések csak eszközök):**
① **Lássam, amit generálok.** Amíg vakon szállítottam, 90-es évekbeli felületek mentek ki, és nem
tudtam róla. ② **Kinézet és funkcionalitás alaptétele ELDŐLJÖN, mielőtt órákat kódolok rá.**
⛔ Ha egy lépés ezt a két célt nem szolgálja, akkor felesleges — de a lépéseket NEM én írom át
(2026-08-25: pont ezt tettem, önkényesen; a doktrína a tulajé).

1. **Terv, nem kód — de MINDIG MŰKÖDŐ MOCK FÁJL.** 2–4 önhordó HTML változat a `--citui-*`
   tokenekből, valós adat-mintával. ⛔ **A mocknak a VÁRT FUNKCIÓKAT TARTALMAZNIA KELL**
   (tulajdonosi rendelet, 2026-08-27): input-mezők tényleges viselkedése (normalizálás,
   validáció, hibaüzenet), kattintások, gombok, állapotváltások, folyamat-visszajelzés. A tulaj a
   FUNKCIONALITÁST is megítéli, nem csak a képet — egy statikus kép erre alkalmatlan.
   ⭐ A viselkedés a VALÓDI szabályokat tükrözze (pl. a domain-normalizálás ugyanazt csinálja,
   mint a `domains.ts`) — ne egy szebb hazugságot; és a mock felirata se állítsa magáról, hogy
   „nem működő", ha működik (§B.17 magunkra is áll).
   ⛔ **A HELYE A MUNKAFÁN BELÜL** (`assets/design-refs/_drafts/`, gitignore-olt): a `/tmp` és a
   fő fába mutató `assets/Temp` symlink KÍVÜL esik a session munkakönyvtárán, ezért a tulaj a
   Remote-Control sessionben nem tudja megnyitni („Can't read this file…", 2026-08-27).
   ⭐ **MÉRET-VÁLTÓ a mockban** (tulaj kérése, 2026-08-27): „Mobil 390px / Asztali" gombpár, hogy
   EGY fájlban lássa mindkét elrendezést. ⚠️ `@container` query kell hozzá (`container-type:
   inline-size`), NEM `@media` — az az ablakhoz kötődik, és egy szűkített div-ben nem sülne el,
   vagyis a váltó csak keskenyítene, de nem rendezne át. Telefonon induljon mobil módban.
   ⛔ **MINDIG KELL DESKTOP ÉS MOBIL TERV IS** (tulajdonosi rendelet, 2026-08-27). A tulaj
   TÖBBNYIRE mobilon néz — de **nem neki és nem a mobilnak fejlesztünk**. A vendég/vevő ugyanúgy
   ül gép előtt, és egy csak-mobilra tervezett felület asztali gépen szétesik vagy üresen kong.
   A két méret KÉT KÜLÖN TERVEZŐI DÖNTÉS (elrendezés, oszlopok, mit visz a szélesebb hely) —
   nem ugyanaz a terv kétszer lelőve.
2. **Ellenőrzés a saját szemeddel:** `npx tsx scripts/ui-shot.mts <fájl|/route>` → 390px + desktop,
   és a képeket **Read-del meg is nézed** (nem elég legyártani). ⭐ EZ az ① cél eszköze — nem eszköz
   hiányzott hozzá soha, hanem hogy kötelező legyen.
   ⭐ **A MŰKÖDÉST is ellenőrzöd, nem csak a képet:** a mock interaktív részeit Playwrighttal
   végigkattintod (input → normalizálás, hibás input → üzenet, gomb → állapotváltás, JS-hiba = 0).
   Kép-ellenőrzés nem mutatja meg, hogy a beírt szöveg mit csinál.
3. **ELJUTTATOD A TULAJHOZ** — a képeket ÉS a kattintható HTML-eket (`SendUserFile`), egy körben,
   magyarázattal: melyik változat mit dönt el. ⛔ **MINDKÉT MÉRET KÉPEIT KÜLDÖD** (mobil ÉS
   desktop) — 2026-08-27: legyártottam mindkettőt, de csak a mobilt küldtem el, így a tulaj a
   döntés felét nem látta. A hiányzó méret nem „részlet": azon a felén is dönteni kell. ⛔ A KÜLSŐ DESIGN-APP KIVEZETVE (tulajdonosi
   döntés, 2026-08-26): a `DesignSync` OAuth-ja folyton lejárt, a kártya-index kézi frissítést
   igényelt, és az idő a „nem látom / még nem töltötted fel / hol van már" körökre ment el.
   ⚠️ A külső app SOHA nem az alkotás eszköze volt, csak a bemutatásé — az ① célt a 2. pont
   (ui-shot + saját szemmel megnézni) szolgálja, és az VÁLTOZATLANUL KÖTELEZŐ.
   A tulaj a képen dönt; ha módosítani akar, megmondja, és ÚJ kört generálsz.
4. **⛔ MEGÁLLSZ ÉS VÁRSZ.** A jóváhagyásig SEMMI: nincs működő logika, nincs teszt, nincs
   adat-csiszolás, nincs kód. (2026-08-25: pont ezt szegtem meg — a tulaj szava: „tök fölösleges
   így a workflow".)
5. **Jóváhagyás után:** a terv befagy `assets/design-refs/console/…`-ba (a megvalósítás
   KONTRAKTUSA, commitolt) — a HTML mellé `README.md`, ami kimondja, mit KÖT a terv
   (elvárt viselkedés, nem stílus-javaslat) —, és CSAK ezután indul a kód; a kész felületet
   ehhez a képhez méred.
6. **Takarítás — a `land.sh` végzi** (ADR-0077): a session zárásakor a `_drafts/` törlődik,
   hogy ne gyűljön a szemét. Veszélytelen: a vázlat egy paranccsal újragenerálható, a
   jóváhagyott terv pedig a `design-refs/console/` alatt él, commitolva.

**Kivétel:** apró javítás (elírás, szín-fix, meglévő minta követése, hibajavítás) mehet közvetlenül,
ui-shot ellenőrzéssel. Kétség esetén: terv-először.

---

## 3. SESSION ZÁRÁSA (MIELŐTT A FELHASZNÁLÓ ELMEGY)

⚠️ Ha a felhasználó zárást kér, MIND A HÁROM lépés jár, külön kérés nélkül. Nem emlékeztetsz rá — MEGCSINÁLOD.

1. **Memória-frissítés.** `/MEMORY.md` (az aktív feladat előzménybe csúszik, az új szál a helyére) **+** új fájl a `_planning/memory/`-ba (dátum, elvégzett munka, módosított fájlok, nyitott kérdések) **+** a sora a `_planning/memory/INDEX.md`-ben. Döntés született? Az az `_planning/DECISIONS.md`-be megy ADR-ként, nem a session-jegyzetbe.
2. **Commit tételes fájllistával.** ⛔ SOHA `git add .` (több session dolgozik párhuzamosan, a `git add .` mások félkész munkáját viszi be).
3. **Landolás: `bash scripts/land.sh`** — fetch → rebase → kapuk → push → **visszaellenőrzés** egyben (ADR-0052); hangosan bukik. A „felküldve" CSAK a land zöld záró sora („IGAZOLTAN FENT") után mondható ki, azaz amikor a `git log origin/main..HEAD` üres — **amíg nem az, a session NINCS lezárva.** Kézi push esetén is ugyanez az igazolás jár.

> **Miért kötelező a 3. pont:** 2026-08-22-én megmérve 16 worktree élt, és a GitHubon **összesen 1 db `wt/*` ág** volt fent — a záró push a legtöbb sessionben SOHA nem történt meg. ~10 párhuzamos szálnál a `main` percenként mozog, tehát a sima `git push` non-fast-forwarddal elhasal; a session látja, a felhasználó viszont a „kész, felküldve" összefoglalót olvassa. Egy éles DKIM-hibajavítás így egy halott sessionben ült, senki nem tudott róla. **A „felküldve" csak akkor mondható ki, ha az `origin/main` igazoltan tartalmazza; ha nem ment át, azt HANGOSAN kell jelezni.**
>
> ⚠️ **A commit-szám és a `git cherry` HAZUDIK** (a rebase új SHA-t és új patch-id-t ad ugyanannak a tartalomnak). Ha azt kell eldönteni, fent van-e valami, **szemantikusan** ellenőrizd (benne van-e a route/függvény/fájl a `main`-en), ne számlálóval.

**Élesítés a zárás része? NEM.** Az „élesre mehet" külön, kimondott utasítás (§0.3), és verziót visz ki, nem fájlokat (§0.2, ADR-0053).

---

## 4. KÓD KONVENCIÓK (SZIGORÚAN KÖTELEZŐ)

- ❌ Soha ne módosíts működő kódot, amit nem kértek
- ❌ Soha ne használj placeholder kommenteket (`// rest of code here`)
- ❌ Soha ne feltételezz DB tábla/mező neveket — mindig kérdezz
- ✅ Mindig teljes, copy-paste kész fájlt adj vissza
- ✅ Ha valami nem világos: előbb kérdezz, aztán csináld
- ✅ TypeScript `strict` mód; ESM (`import`/`export`); relatív útvonalak hordozhatóan
- ✅ **i18n-doktrína (§B.18, ADR-0036):** VEVŐ-oldali felirat SOHA nem beégetett — szerver-oldalon `T(d, "…")`, kliens-oldalon `tr("…")` burkolással születik (a kulcs a magyar forrás-string; csomag: `language_pack`, katalógus: `scripts/extract-i18n.mts`). Jogi szöveg országonkénti JOGI csomag (nem UI-fordítás). **HÁRMAS KAPU kényszeríti:** (1) PostToolUse-hook (`scripts/i18n-scan.mjs` — szerkesztéskor azonnal blokkol), (2) git pre-commit (`hooks/pre-commit` — i18n-lint + katalógus-frissesség + design-token-lint; friss klónon egyszer: `git config core.hooksPath hooks`), (3) teljes lint kézzel: `npx tsx scripts/i18n-lint.mts`.
- ✅ **Dizájn-token-doktrína (ADR-0021 ①):** SAJÁT felület (konzol, tenant-admin, honlap) színt/betűt/radiust CSAK a dizájn-magból vesz (`public/assets/ui/citui.css`, `--citui-*`); nyers hex/rgb tilos (márka-derivált alfa = `color-mix()` tokenre). Ikon: közös készlet `src/ui/icons.ts` (cián akcent-pötty kézjegy, emoji tilos). Kivétel CSAK indoklással az őr ALLOW-listáján. Őr: `scripts/design-token-lint.mts` (+ PostToolUse hook: `design-token-scan.mjs`).
- ✅ Kód kommentek: **angolul**; kommunikáció: **magyarul**

---

## 5. TECHNIKAI KÖRNYEZET

- **Runtime:** Node.js 20+, TypeScript (strict, ESM)
- **Adatgyűjtés:** Playwright (headless Chromium — a gépen már telepítve), portál/Maps scraping
- **Generálás:** template-motor (közös „mag" + szállásonkénti adat-objektum → statikus/dinamikus oldal)
- **DB (tervezett):** PostgreSQL (multi-tenant)
- **Admin (tervezett):** önkiszolgáló felület — a tulaj szerkeszti a képeket/szövegeket (support-minimalizálás)
### Tereptérkép — hol mi van

| Környezet | Elérés | Útvonal | Szerep |
|---|---|---|---|
| Dev gép | lokál | `/home/citoviso/citoviso` | **Integrációs pont + tesztkörnyezet.** Itt NEM fejlesztünk (ADR-0052) |
| Munkafa | lokál | `~/wt/cit<sid>` | Itt fejlesztünk, szálanként külön (a watchdog hozza létre) |
| DB | unix socket | `/tmp:5433`, `citoviso_dev` | **KÖZÖS** minden szálnak (12 MB) — a `sites/`, `node_modules`, `.env` szintén symlink a fő fába |
| Git | `origin` | `git@github-citoviso:olaszferenc/citoviso.git` | Verziótörténet **és** (ADR-0053 után) a deploy forrása |
| Éles VPS | `ssh -i ~/.ssh/citoviso_hetzner root@178.104.3.223` | `/opt/citoviso/app` | Hetzner CX23/Debian13. Backupok: `/opt/citoviso/backups/<szál>-<ts>/` |
| Éles service-ek | systemd | `citoviso-public` (:4800), `citoviso-console` (:4600) | `WorkingDirectory=/opt/citoviso/app`, `npx tsx src/server/public.ts` |
| Domain | Cloudflare | `citoviso.com` | tenant-aldomainek: `<slug>.citoviso.com` |

⚠️ **Az éles fa ma NEM git-checkout**, hanem fájl-másolatok kollázsa (ADR-0053 ezt írja felül).
Deploy-protokoll és szálankénti készenlét: **`_planning/DEPLOY-READY.md`** — élesítés előtt KÖTELEZŐ
elolvasni (import-closure + migráció-diff + fa-diff, mind olvasás).

---

## 6. KOMMUNIKÁCIÓ

- Nyelv: **magyar**
- Stílus: tömör, lényegre törő
- Kód kommentek: angolul

---

## 7. ARCHITEKTÚRA-ELV (a motor „magja")

A rendszer lelke: **egy közös template + szállásonkénti adat-objektum**. Egy új szállás felvétele = egy új adat-rekord, nem új kód. A pipeline lépései:

1. **Ingest** — Google Maps + foglaló-portál (zimmerinfo, hovamenjek, stb.) → strukturált adat + kép-URL-ek + valós, egyedi jellemzők.
2. **Analyze** — képek stílus/paletta-kinyerés (vision) → arculat-preset + akcentszín.
3. **Generate** — template kitöltése az adattal + a szállás EGYEDI „mag"-szekciójával (nincs generikus töltelék; nincs emoji-ikon, saját SVG-készlet).
4. **Outreach** — mockup-link kiküldése a tulajnak (GDPR/Grt. tudatos, leiratkozással).
5. **Convert** — megrendeléskor a tulaj saját (tiszta, jogtiszta) képei + admin-hozzáférés.

⚠️ **Jogi őrszem:** portál/vendég-fotó CSAK demóra; élesre a tulaj saját assetjei vagy engedély. Hideg email = célzott, személyre szabott, leiratkozható (nem tömeg-spam).
