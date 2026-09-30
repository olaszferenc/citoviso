# systemd unitok

Verziózott unit-fájlok, hogy a telepítés **reprodukálható és átnézhető** legyen —
ne ad-hoc `ssh` parancsokból álljon össze (ugyanaz az elv, mint ADR-0053-ban a
deploynál: verzió megy ki, nem kézi művelet).

## ⛔ Éles telepítés: a DEPLOY csinálja, kézzel nem (2026-09-23)

A `targets.json` minden időzítőt `prod` vagy `dev` célba sorol (a `dev` indoklással). A
`scripts/deploy-prod.sh` **GATE 6**-ja a CÉL-commitból minden `prod` időzítőt + a szolgáltatását
éles alakra rendereli (`scripts/systemd-units.mts`: `WorkingDirectory=/opt/citoviso/app`,
`npx tsx`, `journal`), telepíti ami eltér, `daemon-reload` + `enable --now`, majd **visszaméri**
(fájl-egyezés + engedélyezve + fut). Bármelyik nem stimmel → a deploy elbukik, a szolgáltatások
nem indulnak újra. Élesen engedélyezett, de nem-`prod`-ként deklarált időzítő is bukás.
Nincs kapcsoló, ami átugorja. A pre-commit (`systemd-units check`) nem enged nyilvántartás
nélküli időzítőt a repóba. Mérve 2026-09-23: a renderelő a kézzel telepített 8 éles egységgel
**bájtra** egyezik — a GATE 6 első futása csak a hiányzót teszi fel.

## `citoviso-alert@` — a ház riasztást kap, ha egy időzített feladat elhasal (ADR-0276)

Minden prod service `[Unit]`-jában `OnFailure=citoviso-alert@%n.service`. Ha az egység `failed`
állapotba kerül, a systemd elindítja a sablon egy példányát (`%i` = a megbukott egység neve), ami a
`scripts/unit-failure-alert.mts`-szel az egység utolsó 40 journal-sorát elküldi az
`app_setting.alert_email` címre (konzol /settings). A sablon a `targets.json` `services` listáján
`prod`: a GATE 6 telepíti és visszaméri, de NEM engedélyezi (nincs mit — az `OnFailure=` indítja).
⛔ A sablonnak nincs és nem lehet saját `OnFailure=`-je (hurok); a `systemd-units check` ezt, és a
prod service-ekből hiányzó sort is pirosra méri. A dev gépen a sablon nincs telepítve.

## `citoviso-public` / `citoviso-console` — a két hosszan futó szerver is a repóból (ADR-0279)

2026-09-30-ig a két szervert kézzel telepítették a VPS-re, ezért nem kaptak `OnFailure=`-t. Most a
`targets.json` `services` listáján `prod`-ként állnak: a GATE 6 a többivel együtt telepíti (csak ha a
sha eltér), `daemon-reload`, és sha-val visszaméri; NEM engedélyezi újra (a `WantedBy=multi-user.target`
alatt már engedélyezve vannak). A daemon-reload UTÁN jön a kanári-sorrendű restart (console → :4600 →
public → :4800), vagyis a restart már az új unit-fájlt veszi fel.

**Bájtra az éles + 1 sor.** A repó-fájl dev-alakú (`/home/citoviso/citoviso`, `node_modules/.bin/tsx`);
a `render-prod` éles alakja a VPS mai unitjával BÁJTRA egyezik, kivéve az új
`OnFailure=citoviso-alert@%n.service` sort. A kiolvasott éles fájl a `prod-snapshot/`-ban van (a sha-ját a
VPS-en mértük, 2026-09-30: public `281f9012…7710`, console `9f6bd77a…4e`); a `house-alert-check` ④ ága ezt
méri, negatív kontrollal. ⛔ Ezért a két unitban NINCS komment — egy komment-sor is eltörné az egyezést.
⚠️ A dev gép saját public/console unitja MÁS (`tsx watch`, naplófájl) — nem ebből a fájlból települ.

**Mikor jön levél? — mérve (systemd 257, `RestartMode=normal`, 2026-09-30).** Egy `Restart=always`
szolgáltatás MINDEN összeomlásnál átmegy a `failed` állapoton, tehát az `OnFailure=` MINDEN crash-nél
elsül — nem csak a start-limit kimerülése után. (A mérés: 1 mp után kilépő próba-unit `RestartSec=3`-mal,
20 mp alatt 5 elsülés, az `NRestarts` 0→4.) A start-limit (alapérték: 5 indítás / 10 mp) `RestartSec=3`
mellett gyakorlatilag SOHA nem merül ki (egy kör ≥ 3 mp), így a szerver nem adja fel, újraindul örökké.
Emiatt a levelezést a `scripts/unit-failure-alert.mts` ritkítja (`unitAlertDue`, `houseAlert.ts`):
- **leállva maradt egység** (egy elhasalt időzítő-tick, `SubState≠auto-restart`) → mindig levél;
- **újrainduló szerver** (`SubState=auto-restart`) → az 1., 11., 101., 1001. … összeomlásnál levél
  („szolgáltatás összeomlott, újraindul — … (N. összeomlás)”), a köztesek csak a riasztó naplójába.
  Az `NRestarts` a legutóbbi kézi indítás (deploy-restart) óta számol.
- **Szabályos stop/restart** (deploy) NEM riaszt: élesen „Deactivated successfully” (journal, 2026-09-22/24).
- `StartLimit*`: élesen nincs beállítva (alapérték). Szándékosan így maradt — lásd az ADR „DÖNTÉS KELL” pontját:
  egy `StartLimitIntervalSec=300` / `StartLimitBurst=5` a publikus oldalt 5 összeomlás után VÉGLEG leállítaná
  (kézi `reset-failed`-ig), cserébe egyetlen levelet adna.

## `[TESZT]` a riasztás tárgyában, ha nem az éles hoston fut (ADR-0279)

`alertHouse` minden tárgy elé `[TESZT] `-et tesz, ha `isLiveHost(config.publicBaseUrl)` hamis
(`src/invoicing/keyGuard.ts` — az „éles” egyetlen definíciója). A dev NINCS némítva: küld, csak jelölve.
Az `OnFailure`-levél (`unit-failure-alert.mts`) ugyanezen az úton megy.

Az alábbi „Telepítés" receptek a **dev gépre** vonatkoznak (ott nincs deploy-kapu).

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

## `citoviso-offer-followup` (ADR-XXXX — 2026-09-30)

**Mit csinál.** Óránként lefuttatja a `scripts/offer-followup.mts`-t: az eszkalációs ajánlat
emlékeztető levelét küldi ki (ADR-0088 §4b) azoknak a leadeknek, akiknél a /pricing-on beállított
késleltetés letelt, és még nem vásároltak.

**Miért kell külön.** Korábban a napi 07:00-s `citoviso-billing` vitte. ADR-0286 óta a késleltetés
1 órától állítható, a napi tick ezért akár egy napot késett, és rövid ajánlatnál ki is maradt. A billing
többi lépése (megújulás, AAM-riasztás, számla-újrapróba) napi maradt, csak az emlékeztető vált le.

**Küldési ablak.** 8:00–20:00 **Europe/Budapest** — a KÓD tartja (`followupWindowBlocks`), nem a
naptár: az éles gép UTC-ben fut. Ablakon kívül a futás semmit nem kérdez le és nem küld; az éjjel
esedékes emlékeztető a reggel 8 utáni első futással megy.

**Miért veszélytelen gyakran futni.** Egy ajánlatra egy levél: a küldés ELŐTT atomi foglalás
(`claimFollowup`: `followup_sent_at` csak ha üres, és az ajánlat még él); lejárt ajánlat nem
foglalható; elbukott küldés után a foglalás feloldódik, a következő óra újrapróbálja.

**Telepítés:** `prod` — a deploy GATE 6 telepíti és engedélyezi (`targets.json`). A dev gépen nincs
rá szükség (ott a levélküldő mock).

**Ellenőrzés:** `systemctl list-timers citoviso-offer-followup.timer` +
`tail ~/.claude/citoviso-offer-followup.log` (dev) · élesen `journalctl -u citoviso-offer-followup`.

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

## `citoviso-multilang-resume` (ADR-0118)

**Mit csinál.** Ötpercenként megnézi, van-e KIFIZETETT nyelv-generálás, ami a
megadott ideje nem ad életjelet, és újraindítja
(`npx tsx scripts/resume-multilang.mts`).

**Miért kell.** A generálás a fizetési webhook után **detached** fut — 3 nyelv
fordítása perceket vesz igénybe, a gateway nem várhat rá. Egy szerver-újraindítás
vagy összeomlás tehát elvágja, és a sor **örökre `generating`-en marad**: a vevő
kifizetett egy fordítást, ami soha nem készül el. Mérve a dev-parkon 2026-09-11:
két ilyen sor, az egyik 12 órás. Addig a Modulok-kártya „csapatunk újraindítja"
mondata **üres ígéret volt** — semmi nem indította újra (§B.17 ránk is áll).

**Miért veszélytelen gyakran futni.** A birtokbavétel egyetlen **feltételes
UPDATE**: a státusz és az életjel a `WHERE`-ben van, tehát két egyszerre futó tick
közül pontosan az egyik viszi el a sort, és egy **élő** (életjelet adó) futás mellé
soha nem indul második. Ez itt nem elegancia, hanem pénz: egy fölösleges újraindítás
valós LLM-költség és versengő írás ugyanazokra a fájlokra.

**Mikor hagyja abba.** `MAX_MULTILANG_ATTEMPTS` (ma 3) automata próbálkozás után
**ember kap riasztást** (SMS/e-mail, pontosan egyszer), a sor `failed` lesz, és a
vevő kártyája abbahagyja az automatikus újraindítás ígéretét. A kézi újraindítás
NEM fogyaszt próbálkozást:

```bash
npx tsx scripts/resume-multilang.mts --force <generation-id>
```

**Telepítés (dev gépen fut):**

```bash
sudo cp deploy/systemd/citoviso-multilang-resume.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-multilang-resume.timer
```

**Ellenőrzés:**

```bash
systemctl list-timers citoviso-multilang-resume.timer
tail -f ~/.claude/citoviso-multilang-resume.log
npx tsx scripts/resume-multilang.mts --dry    # mit találna, írás nélkül
```

## `citoviso-events` (Automata heti programajánló, 2026-09-23)

**Mit csinál.** Naponta 05:30-kor a `scripts/gather-events.mts` három fázisa fut:
1. **gyűjtés** — hetente egyszer: egy település akkor kerül sorra, ha az utolsó kész
   futása a hét hétfője előtti (vagy még sosem volt). Brave → udvarias letöltés →
   JSON-LD + Haiku (5 lap/hívás) → kódszintű kapuk → dedup → `local_event`;
2. **újrarenderelés** — naponta minden `poi`-s oldal, hogy a lejárt program magától
   lekerüljön (a választó lábazata ezt ígéri);
3. **tulaj-levél** — hetente egyszer tenantonként (idempotencia: `tenant_message`
   `programs`), üres készletről hallgat. ⛔ Vendégnek NEM megy levél (tulajdonosi döntés).

**Vásárláskor nem kell másnapig várni: `citoviso-events-pending`** (ötpercenként,
`--pending`): csak azokat a tenantokat nézi, akiknek a saját települése még SOSEM volt
begyűjtve — bármelyik aktiválási úton jött a modul —, begyűjti a körüket és újrarendereli
az oldalukat (levél nincs). Ha senki nem vár, egyetlen DB-lekérdezés. Tulajdonosi döntés
(2026-09-23): „különben dühös lesz a tenant". A két futás egy Postgres advisory lockon
osztozik, így ugyanazt a települést sosem fizetjük kétszer.

**Miért veszélytelen naponta futni.** A gyűjtés a héten már kész településeket kihagyja
(`event_gather_run`), a levél hetente egyszer megy, az újrarenderelés idempotens.

**Pénzt költ.** Mérve 2026-09-23: egy 41 települési kör ≈ $0,43/hét (fele Brave, fele
Haiku). A költség a lefedett TELEPÜLÉSEKKEL nő, nem a tenantokkal (átfedő körök egyszer
fizetnek). Futásonkénti költség és hozam: `event_gather_run`.

**Telepítés (dev gépen):**

```bash
sudo cp deploy/systemd/citoviso-events.* deploy/systemd/citoviso-events-pending.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-events.timer citoviso-events-pending.timer
```

⚠️ Élesen a deploy GATE 6-ja telepíti (fent); a dev gépen a fenti recept.
