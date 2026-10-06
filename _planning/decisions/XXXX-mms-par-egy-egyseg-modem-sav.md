## ADR-XXXX — Az MMS-pár egy egység: a következő MMS csak a kísérő SMS igazolt kiküldése után indul (modem-sáv)

**Dátum:** 2026-10-06 · **Státusz:** ELFOGADVA (tulaj-rendelet a „CIT ➕ megkeresés” koordinátoron át) ·
**Kapcsolódó:** ADR-0080 ⑦ (SMS-relay), ADR-0083 (MMS+SMS páros), ADR-0282 (MMS-relay),
ADR-0276 (házi riasztás), `docs/mms-send.md`.

**Tulaj-rendelet (2026-10-06):** „MMS utána sms és csak utána mehet tovább a következő leadre”.

**Probléma (élesben mérve 2026-10-06, 40 mobil-pár egyszerre):** a percenkénti
`citoviso-mms-relay.timer` minden MMS-hez meghívta a `mms-send`-et, ami a küldés idejére
LEÁLLÍTJA a `gammu-smsd`-t. A pár kísérő SMS-e (Unicode, 3–4 rész, a LINK az utolsóban) az MMS
ack-ja után került az éles `sms_outbox`-ba, a dev `sms-relay` befecskendezte a gammu
outboxba — de két MMS között csak 5–20 mp daemon-futás maradt. A részek `SendingError` →
errorbox (gammu ID 69, 70, 71: Hullám, Andi, tulaj-másolat). A lead képet kapott link nélkül,
az éles `sms_outbox` pedig `sent`-et mutatott: a régi SMS-relay a BEFECSKENDEZÉST nyugtázta,
nem a kiküldést (hamis zöld). A kézi megkerülő (`~/rc-carry/mms-pace-20261006/pace.sh`) mutatta
a helyes viselkedést: egy MMS → vár, amíg az SMS-sor és a gammu outbox üres → következő.

**Döntés — a modem-sáv (`src/sms/modemLane.ts`):**
1. **Egy zár, két relay.** Az MMS- és az SMS-relay ugyanazt a zárat fogja
   (`outbox-sms/modem-lane.lock`, PID-alapú, halott tulajdonosét átveszi). Aki tartja, azé a
   modem; az SMS-timer nem csúszhat be egy futó pár közepébe.
2. **Az MMS-tick sorrendje:** ① a sáv legyen ÜRES (nincs úton lévő saját SMS, az SMS-sor üres,
   a gammu outbox üres — idegen/régi üzenet is tart —, a `gammu-smsd` fut); különben ebben a
   tickben MMS NEM indul. ② EGY MMS → ack (a szerver sorba teszi a kísérő SMS-t + a
   tulaj-másolatot). ③ Az MMS-relay MAGA húzza ki ezeket az SMS-eket, befecskendezi, és
   megvárja a gammu ítéletét. Ha a tick ideje (270 mp; a unit `TimeoutStartSec=300`) lejár, az
   úton lévő SMS a sáv-állapotban (`outbox-sms/modem-lane.json`) marad, és a következő tick ①
   pontja tartja vissza a következő MMS-t.
3. **Igazolás a gammu tábláiból, nem feltételezésből.** Egy SMS akkor „kiment”, ha eltűnt a
   gammu `outbox`-ából ÉS a `sentitems`-ben MINDEN része (a darabszám a concat-UDH-ból)
   `SendingOK`/`SendingOKNoReport`/`Delivery*`-OK státuszú. `SendingError`/`Error`/
   `DeliveryFailed`, hiányzó rész, vagy 8 perc az outboxban (törölve — a szerver 10 perces
   újrasorolása ELŐTT, hogy ne menjen ki kétszer) = bukás.
4. **Az ack igaz.** Az `sms_outbox` `sent` CSAK a gammu-igazolás után; bukásnál `ok:false` →
   a sor újrapróbálja (újra-befecskendezés, a következő MMS addig vár), a 3. bukás után
   `failed` + EGY házi riasztás (új: `src/sms/relayQueue.ts`, a `/api/sms-relay/*` logikája
   oda költözött a `public.ts`-ből, hogy az őr a valódi szemantikát hajtsa).
5. **Konfiguráció:** `GAMMU_DB_USER`/`GAMMU_DB_PASSWORD` (+ `GAMMU_DB_HOST`, `GAMMU_DB_NAME`) a
   dev `.env`-ben (a gammu-smsd-inject ugyanazon DB-je; a `mysql` CLI-n át, jelszó `MYSQL_PWD`-ben).
   Hiányában az MMS-relay NEM küld (igazolhatatlan pár = pont a mai hiba); az SMS-relay a régi
   befecskendezés-nyugtázó úton megy, hangos figyelmeztetéssel.

**Tudatos ár:** egy részben kiment, majd bukott SMS újrapróbája az első részeket újra kiküldi
(a lead kétszer kaphatja az eleját) — a link nélküli kép rosszabb. A páros áteresztőképessége
~1 pár / 1–2 perc (MMS ~90 mp + SMS ~20–40 mp), ami a ~90 mp-es MMS mellett alig lassít.

**Élesítés:** a dev-gépi rész (relay-k, modem-sáv) a land után a fő fa ff-elődésével azonnal él
(a timerek a fő fából futnak). Az éles szerver-oldali rész (`src/sms/relayQueue.ts`: a végleges
SMS-bukás riasztása) a nagy deployjal megy; addig a bukás az éles `sms_outbox`-ban `failed` +
`last_error` és a dev relay naplójában (`~/.claude/citoviso-mms-relay.log`) látszik.

**Őr:** `scripts/mms-relay-check.mts` ⑬–⑱ (mock gammu outbox→sentitems, mock óra, a valódi
`pullSms`/`ackSms`): pár-sorrend, a mai hiba (úton lévő link-SMS mellett a következő MMS nem
indul, a sor nem `sent`), errorbox → újrapróba/`failed` + egy riasztás, 8 perces törlés,
idegen outbox-üzenet / leállt daemon, zár. Mutációs próba: a sáv-kapu kikapcsolásával 4 eset bukik.
