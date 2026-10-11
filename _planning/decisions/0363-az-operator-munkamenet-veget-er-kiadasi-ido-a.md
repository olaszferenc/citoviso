## ADR-0363 — Az operátor-munkamenet véget ér: kiadási idő a sütiben, a kapu minden kérésnél az operátor-sort nézi

**Dátum:** 2026-10-11 · **Státusz:** elfogadva (a koordinátor briefje: Elek IT-kereszt kör, B1 — „a tenant-oldal ADR-0303
mintájára”) · **Forrás:** Elek 5. kör (2026-10-11) B1, `_elek/bin/x-opcookie.mts` · **Kapcsolódó:** ADR-0021 (két realm),
ADR-0303 (a tenant-süti kiadási ideje + `password_set_at`).

**A lelet (scratch-DB-n mérve).** Az operátor-süti `<id>.<hmac(id)>` volt: nem volt benne idő, és a konzol-kapu
(`src/console/server.ts`) csak az aláírást nézte. Jelszócsere után a RÉGI süti is nyitotta a konzolt (200); egy új belépés
ugyanazt a sütit adta; a DB-ből TÖRÖLT operátor sütije a `/`, `/leads`, `/scrape`, `/report` lapokat is megnyitotta (200).
Egy kiszivárgott vagy régi gépen maradt operátor-süti tehát sem jelszócserével, sem a fiók törlésével nem volt visszavonható.

**Döntés.**
1. **A süti hordozza a kiadási idejét:** `<id>.<iat ms>.<hmac("op:" + id.iat)>` (a realm-előtag marad, tenant-süti itt nem
   érvényes). A régi formátum (idő nélkül) NEM olvasódik: **az átállás egyszer minden operátort kiléptet** — ez szándékos,
   mert a régi sütik között lehet kiszivárgott is, és azokat másképp nem lehet visszavonni.
2. **A kapu minden kérésnél az operátor-sort nézi** (`verifyOperatorSession`): ha a sor nincs meg → `/login`; ha a
   süti régebbi, mint `operator_user.sessions_valid_from` (0106) → `/login`. A `currentOperator` ugyanezt a szabályt
   alkalmazza, így egy útvonal sem enged be olyat, akit a kapu kizárna.
3. **Lejárat: 30 nap a kiadástól**, a szerver ellenőrzi (eddig csak a süti `Max-Age`-e mondta — a tenant-oldal értéke).
   Jövőbeli kiadási idő (5 perc tűrés felett) érvénytelen.
4. **Ki vágja el a munkameneteket:** a saját jelszócsere (`/settings/password` — a cserélő böngésző azonnal új sütit kap,
   a többi eszköz kilép) és a jelszó-visszaállító szkript (`scripts/operator-user.ts`). A `sessions_valid_from` NULL =
   még nem volt vágás.
5. **Digitális kollégák** (Magellan, Poe, Neo, Vera, Elek): böngészőből, jelszóval lépnek be (a jelszó a
   `~/.config/citoviso/*-operator.txt`-ben) — az átálláskor egyszer újra be kell lépniük, utána változatlan. A szkriptek és
   őrök, amik `mintOperatorCookieValue(id)`-vel lőnek sütit, változatlanul működnek (az aláírás ugyanaz, csak időt is hordoz).

**Visszafordíthatóság.** 🔄 olcsó: a 0106 csak egy NULL-ozható oszlopot ad hozzá; a régi kódra visszaállva a régi formátum
szerint mindenkinek újra be kell lépnie, adat nem vész el.

**Elvetett alternatívák.**
- Szerveroldali munkamenet-tábla — a kiadási idő + `sessions_valid_from` ugyanazt adja új tábla és takarítás nélkül
  (ugyanez volt az ADR-0303 érve).
- Egész számú munkamenet-verzió a sütiben — a süti kiadásához DB-olvasás kellene, és a ~15 őr/szkript, ami
  `mintOperatorCookieValue(id)`-vel lő, mind átírandó lett volna; az időbélyeg ugyanazt dönti el.
- A régi formátumot átmenetileg elfogadni — pont azokat a sütiket hagyná életben, amiket vissza kell vonni.

**Őr.** `scripts/operator-session-check.mts` (scratch-DB + a valódi konzol HTTP-n): jelszócsere előtti süti, törölt
operátor, régi formátum, 31 napos és jövőbeli süti → `/login`; a cserélő bent marad. `--self-test`: a javítás előtti
`operatorAuth.ts` (git) pirosat ad (5 ✗).
