# systemd unitok

Verziózott unit-fájlok, hogy a telepítés **reprodukálható és átnézhető** legyen —
ne ad-hoc `ssh` parancsokból álljon össze (ugyanaz az elv, mint ADR-0053-ban a
deploynál: verzió megy ki, nem kézi művelet).

## `citoviso-domain-resume` (ADR-0071)

**Mit csinál.** Kétpercenként továbbnyomja a beragadt egyedi-domain beszerzéseket
(`npx tsx scripts/resume-domains.mts`).

**Miért kell.** A domain-vétel után az NS-delegálás és a TLS-kibocsátás **percekig**
tart. A fizetési webhook nem várhat rá (a gateway timeoutolna), ezért a beszerzés
`dns_pending` / `tls_pending` állapotban parkol. Enélkül a timer nélkül a tenant
kifizetné a domaint, a beszerzés pedig félúton állna, amíg valaki kézzel újra nem
futtatja — vagyis a „zéró emberi interakció" ígéret pont a leglassabb lépésnél bukna.

**Miért veszélytelen gyakran futni.** A `runDomainProvisioning` idempotens: a
végállapotú (`live` / `failed`) sorokat kihagyja, és minden állapot csak a SAJÁT
lépésébe lép be újra — nincs dupla vétel, nincs dupla e-mail.

**Telepítés (dev gépen már fut):**

```bash
sudo cp deploy/systemd/citoviso-domain-resume.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-domain-resume.timer
```

**Ellenőrzés:**

```bash
systemctl list-timers citoviso-domain-resume.timer
tail -f /home/citoviso/.claude/citoviso-domain-resume.log
```

⚠️ **Élesen a `WorkingDirectory` MÁS**: a dev gépen `/home/citoviso/citoviso` (a fő fa,
ADR-0052 integrációs pont), az éles VPS-en `/opt/citoviso/app`. A unit-fájlt élesítés
előtt ehhez kell igazítani — a `StandardOutput` naplóút szintén.

⚠️ Az éles telepítés **külön, kimondott engedélyt igényel** (CLAUDE.md §0.3) — ez a
mappa csak a reprodukálható receptet tartja.

## `citoviso-booking-maintenance` (ADR-0044/b — beütemezve 2026-09-06)

**Mit csinál.** Óránként lefuttatja a `scripts/booking-maintenance.mts`-t: behúzza a
tenantok portál-naptárait (Booking.com stb.), és lejáratja a megválaszolatlan
foglalási kéréseket (a vendég e-mailt kap róla).

**Miért kell.** A script 2026-08-21 óta létezett, de SEHOL nem volt beütemezve
(mért luka, booking-triázs 2026-09-06): a portálon kelt foglalás csak kézi
„Frissítés"-re ért ide, a lejáratás pedig sosem futott — a vendég a semmiben lógott.

**Miért veszélytelen gyakran futni.** A szinkron a portál-feed pillanatképét
tükrözi (foglalt napot nem ír felül), a lejáratás pedig csak a határidőn túli,
még `pending` kéréseket zárja — mindkettő idempotens.

**Telepítés (dev gépen már fut):**

```bash
sudo cp deploy/systemd/citoviso-booking-maintenance.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-booking-maintenance.timer
```

**Ellenőrzés:** `systemctl list-timers citoviso-booking-maintenance.timer` +
`tail ~/.claude/citoviso-booking-maintenance.log`.

## `citoviso-pair-repair` (ADR-0112)

**Mit csinál.** Percenként megnézi, van-e **törött mobil-pár** (`mms_sent_at` kitöltve,
`sms_sent_at` üres), és újraküldi a kísérő SMS-t (`npx tsx scripts/pair-repair.mts`).

**Miért kell.** ADR-0112 óta a kísérő SMS az EGYETLEN, ami a követett linket viszi — és a
link viszi a jogalapot meg a leiratkozást. Egy törött pár tehát azt jelenti, hogy a
címzettnél egy reklám-kép van, kiút nélkül. Eddig ezt egy piros jelzés mutatta a konzolon,
és egy operátornak észre kellett vennie; a job-állapot ráadásul in-process élt, tehát egy
újraindítás elfelejtette. Tulajdonosi rendelet (2026-09-08): **„mindenképp az automatikus
újra küldés kell"**.

**Miért veszélytelen gyakran futni.** Csak azokra a párokra nyúl, amelyeknél a backoff
(2·5·15·30·60·120·240·480 perc) letelt, az SMS-fele pedig minden §C-kaput újrafuttat —
beleértve a friss leiratkozás-ellenőrzést. Az MMS-t SOHA nem küldi újra (ADR-0083
egyszeri aktus). A 8:00–20:00 ablakon kívül nem csinál semmit, és **nem használ el
próbálkozást** (az „ablak zárva" időzítés, nem hiba). A sorozat végén EGYSZER riaszt
(SMS + e-mail, a konzol /settings címzettjei), és utána nem próbálkozik tovább.

**Telepítés (dev gépen fut — a modem itt él, ADR-0080 ⑦):**

```bash
sudo cp deploy/systemd/citoviso-pair-repair.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-pair-repair.timer
```

**Ellenőrzés:**

```bash
systemctl list-timers citoviso-pair-repair.timer
tail -f ~/.claude/citoviso-pair-repair.log
npx tsx scripts/pair-repair.mts     # kézi tick
```

## `citoviso-backup-dev`

**Mit csinál.** Napi négyszer (00/06/12/18:15) menti a **dev** adatbázist
(`citoviso_dev`) és a valódi `sites/` fákat, majd minden futásban VISSZA IS
ÁLLÍTJA a dumpot egy eldobható adatbázisba, és soronként összeveti a forrással.
Cél: `~/backups/citoviso-dev/` (28 pillanatkép + havi archív).

**Miért kell.** Az ADR-0086 napi mentése az **élest** húzza le; a dev DB-nek
2026-09-09-ig **nulla** mentése volt. Közben az nem „eldobható tesztadat": 595
leades korpusz és 2 119 provenance-sor ül benne — hetek scrape-munkája és
AI-költsége —, ráadásul ~10 párhuzamos session OSZTOZIK rajta (CLAUDE.md §5), és
menet közben törölnek belőle (a 2026-09-08-i purge 2 tenantot, 10 prospectet és 78
artifactot vitt el; ott a mentést kézzel írta meg a session, és két kaszkádban
pusztuló tábla ki is maradt belőle). Ezért ütemezett, származtatott hatókörű
(a tábla-lista a DB-ből jön, nem kézi listából) és önellenőrző.

**Miért napi négyszer.** A dev DB munkaidőben mozog; egy délelőtti véletlen törlés
után a legutolsó jó állapot ne legyen 20 órás. A `:15` kikerüli a 03:00-s éles
mentést, a 07:00-s billinget és a 07:20-s kb-frissességet.

⚠️ **PG-kliens verzió.** A dev cluster az `@embedded-postgres` csomagé (18.x), a
Debian 13 viszont csak 17-es klienst szállít, és a `pg_dump` verzió-eltérésre
ELVBŐL megtagadja a dumpot. Ezért kell a PGDG-tárolóból a `postgresql-client-18`.
A script ezt megméri és megnevezi a teendőt, ha egyszer hiányozna.

**Telepítés (dev gépen fut — lokális, az élest nem érinti):**

```bash
sudo cp deploy/systemd/citoviso-backup-dev.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-backup-dev.timer
```

**Ellenőrzés:**

```bash
systemctl list-timers citoviso-backup-dev.timer
tail -f ~/.claude/citoviso-backup-dev.log
bash scripts/backup-dev.sh                                  # kézi mentés
bash scripts/backup-dev.sh --verify-only <mentés-könyvtár>  # újraellenőrzés
```
