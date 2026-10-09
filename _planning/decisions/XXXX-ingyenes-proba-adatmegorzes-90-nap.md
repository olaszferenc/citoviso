## ADR-XXXX — Lejárt ingyenes próba: 90 napos adatmegőrzés, figyelmeztetés, törlés + ÁSZF 1.4

**Dátum:** 2026-10-09 · **Státusz:** elfogadva (motor + őr + ÁSZF); a törlés SZÁRAZON fut, amíg a figyelmeztető levél
szövege a §2b terv-kapun nincs jóváhagyva
**Előzmény:** ADR-0342 (próba-állapot, `free_trial`), ADR-0344 (próba vége: szünetel, nem terhel, T−3/T−1),
ADR-0056 (ÁSZF-verziózás), ADR-0334 (hétköznap 9–16 ablak), ADR-0088 (próba-kupon). Tulaj-döntések 2026-10-09:
① a lejárt próba adatai 90 napig maradnak meg (ameddig a próba-kupon él), előtte figyelmeztető levél, utána TÖRLÉS;
② ÁSZF 1.4 próba-pont jóváhagyva. Koordinátor-döntések 2026-10-09: a törölt próba leadje vissza `qualified`-ba;
a `free_trial` sor a törlés után megmarad.

### Döntés

1. **Határidő** (`src/trial/retention.ts`): törlés napja = a próba utolsó napja (Budapest) + 90 nap (`purgeDay`) —
   ugyanaz a nap, amikor a próba-kupon lejár. A figyelmeztetés 7 nappal előtte (`purgeWarningDay`); **hétvégére eső
   figyelmeztetés VISSZA a péntekre** (8 nap a 7 helyett — előre tolva a levél kevesebb időt adna, mint amit ígér).
   **Késő levél (kiesés) a törlést tolja, a határidőt nem rövidíti:** `effectivePurgeDay = max(purgeDay, levél napja + 7)`,
   és a levél a ténylegesen érvényes napot írja ki.
2. **Figyelmeztetés** (`runPurgeWarnings`): csak hétköznap 9–16, egy levél próbánként — a `free_trial_notice` `p7`
   sorát a küldés ELŐTT foglalja (unique), a sor dátuma a futás ideje (ettől számít a 7 nap).
3. **Törlés** (`purgeExpiredTrials`, napi billing-tick): csak `lapsed` + `converted_at IS NULL` próba, csak ELKÜLDÖTT
   `p7` levél után, legalább 7 nappal. A `DELETE tenant` kaszkádol mindenre, ami a próbához tartozik (site, egységek,
   naptár, ár, foglalási kérés, modul-beállítás, többnyelvű változat, értékelés, látogatás, modul-jogosultság,
   szerkesztő-fiók, belépő-token, üzenet, jogi adat, ajánlat/kupon, rendelés), commit után a `sites/<tenant_id>/` mappa
   (pillanatkép + feltöltött fotók). Tranzakcióban újraellenőriz (`FOR UPDATE`, még `lapsed`?) — közben befutott
   fizetés nem törlődik.
   - **⛔ Fizetett nyom → MEGTAGAD**, hangosan, kézi döntésre: előfizetés · mentett kártya · domain · bármely fizetés a
     tenant rendelésein · fizetett/függő fizetés a lead rendelésein. A napi tick ilyenkor nem-nulla kóddal zár (OnFailure
     levél). (Konvertált próba sosem `lapsed` — ez a második zár, nem az első.)
   - **Napló:** `free_trial.status = 'purged'`, `purged_at`, `purge_report` (táblánkénti sorszám, slug, fájlszám,
     bájt — a törölt TARTALOM nélkül: egy tartalom-mentés a törlés célját semmisítené meg). Kézi CLI:
     `scripts/free-trial-purge.mts [--go] [--trial <id>]`, alapból száraz.
   - **A lead vissza `qualified`-ba** (csak `conversion`-ből; egy közben máshová tett lead marad): nála a miénkből
     semmi nem marad, újra megkereshető.
4. **A `free_trial` sor MEGMARAD** (migráció 0099: `tenant_id` FK `ON DELETE SET NULL` — a 0097 CASCADE-je a sort is
   vitte volna). Benne marad a név, e-mail, telefon és az ÁSZF-elfogadás pecsétje.
   **Jogalap (GDPR 6. cikk (1) f) jogos érdek + 17. cikk (3) e) jogi igények):** (a) az ÁSZF-elfogadás bizonyítéka —
   a Szolgáltató ezzel igazolja, mit és mikor fogadott el a próbázó, egy későbbi vitában erre szüksége van;
   (b) a „leadenként EGY próba” zár (`lead_id` UNIQUE) — a sor nélkül ugyanaz a szállás végtelen ingyenes próbát
   kérhetne. A tárolt adat a cél minimuma (kapcsolattartó, pecsét, napló); a honlap tartalma, a fotók és a fiók törlődnek.
5. **ÁSZF 1.4** (`src/legal.ts`, `ASZF_VERSION "1.4"`, hatályos 2026-10-09, ADR-0056 szerinti verzióváltás): §1 új
   bekezdése a tulaj által jóváhagyott szöveg, egyetlen eltéréssel — „a fiók és az adatok megmaradnak **a próbaidő
   végétől számított 90 napig**” —, ami a két tulaj-döntés közös következménye.
6. **Szárazon, amíg a levél nincs jóváhagyva:** a napi tick `purgeExpiredTrials(now, {dryRun:true})`. Elküldött `p7`
   nélkül a motor amúgy sem töröl; a száraz jel a második zár. A küldő a jóváhagyott szöveggel kerül be (kapcsoló nincs).

### Őr

`scripts/free-trial-retention-check.mts` (saját scratch-DB, `--self-test` szabotázzsal), pre-commit: `retention.ts`,
`start.ts`, a tickek, a CLI és **minden migráció**. Lábai: a napok (hétvége → péntek, késő levél); a levél ablakon
kívül 0, száraz = 0 sor, egyszer megy; levél nélkül és 7 napon belül vár; mind az 5 fizetett nyom külön-külön
megtagad; törléskor pontosan a jelentett sorok tűnnek el, a mappa eltűnik, a `free_trial` sor + pecsét marad, a lead
`qualified`, új próba `trial_used`. **Katalógus:** a séma `tenant`-ból induló kaszkád-fája (pg_constraint) ⊆
`PURGE_TABLES` ∪ blocker-táblák (∪ NOT NULL-lal blockerhez kötött, pl. `dunning_event`) — egy új kaszkádoló tábla
sorai különben számolatlanul tűnnének el.

### Elvetett

- **Törlés helyett anonimizálás / archív mentés:** a tulaj törlést döntött; egy mentés a törlést kiüresítené.
- **A `free_trial` sor törlése is:** a lead újra próbázhatna, és elveszne az ÁSZF-elfogadás bizonyítéka.
- **Hétvégi figyelmeztetés előre, hétfőre:** a levél kevesebb időt adna, mint 7 nap.
