## ADR-XXXX — Az MMS is relay-en megy a dev gép modemjére; a kép-előkészítés sharp

**Dátum:** 2026-09-30 · **Státusz:** ELFOGADVA (a Deploy-koordinátor briefje, SUB `mmsrelay`) ·
**Kapcsolódó:** ADR-0080 ⑦ (SMS-relay), ADR-0083 (MMS+SMS páros), ADR-0112 (törött pár),
ADR-0276 (házi riasztás), CLAUDE.md §8, `docs/mms-send.md`.

**Probléma (mérve 2026-09-30, éles = a1b134e6):** a tulaj élesen a teszt-prospectre
(„[TESZT] Muschel Panzió”) képes SMS-t próbált küldeni — nem ment ki. Két ok:
1. Élesen `MMS_PROVIDER` üres → `mock`. A `cli` provider a `sudo mms-send`-et hívja, ami CSAK a
   dev gépen létezik (SIM800C). Az SMS-nek van relay-e (`sms_outbox` → `scripts/sms-relay.mts`),
   az MMS-nek NEM volt.
2. Az éles konzol MMS-előnézete (`/prospect/:id/mms-preview.jpg`) 500-at ad: a JPEG-et
   `python3 -c … PIL` állította elő, és a VPS-en nincs Pillow (`ModuleNotFoundError`).

**Döntés:**

① **Külön `mms_outbox` tábla (0081), nem az `sms_outbox` bővítése.** A kép (bytea, ≤300 KB) és a
tárgy nem SMS-mező, és az SMS pull-ja ma minden `queued` sort lehúz: egy `kind` oszlopnál az
SMS-útnak is szűrnie kellene, vagyis a működő SMS-relay változna. Külön táblával az SMS-út
bájtra ugyanaz. A KÉP a sorban él: a relay nem nyúl az éles fájlrendszerhez, és a
`sites/_outreach-shots/` takarítása nem ölheti meg a sorban álló MMS-t.

② **`MMS_PROVIDER=queue`** (éles): a `sendMms` csak sorba tesz (`queued: true`). A `cli` marad a
dev gépnek, a `mock` a helyi tesztnek. Ugyanaz a bearer-titok (`SMS_RELAY_SECRET`) és ugyanaz a
`SMS_RELAY_URL` a dev gépen — a modem EGY szolgáltatás, két csatornával.

③ **Pull/ack API** (`/api/mms-relay/pull|ack`, `src/mms/relayQueue.ts`): pull-onként EGY üzenet
(~60–90 mp/db, `docs/mms-send.md`). Az SMS-sortól EGY ponton szándékosan eltér: **a beragadt
`sending` sor NEM sorolódik vissza, hanem `unknown` lesz + riasztás.** Egy hideg MMS kétszer
kiküldve kétszer fizetett és kétszer mutatja a képet a leadnek — ez rosszabb egy kézzel
eldöntendő sornál (az SMS-nél a ritka dupla emlékeztető elfogadható ár volt). Hogy ez ne legyen
gyakori: a relay a sikeres küldést az ack ELŐTT helyi naplóba írja (`outbox-mms/relay-journal.json`),
és a következő futás először onnan nyugtáz — egy `unknown` sor késői ok-ackja `sent` lesz.
A „masik mms-send fut” (foglalt modem) nem ítélet: vissza a sorba, a kísérlet visszajár.
3 valódi bukás után `failed` + EGY riasztás a `houseAlert` csatornán (ADR-0276).

④ **A pár claimje queue módban az ACK** (ADR-0083 módosítása CSAK a queue providerre): a
`prospect.mms_sent_at`-ot a sikeres ack írja (akkor látta a lead a képet), és CSAK EZUTÁN indul
a kísérő SMS-fél (`sendPairSmsHalf`) — a link-SMS nem érkezhet a kép előtt vagy helyette. A
dupla kattintás ellen a részleges egyedi index véd (prospectenként egy függő MMS). A konzol
idővonala a sor állapotát olvassa (`pairJobState`), mert az ack a PUBLIC folyamatban történik.
Egy `unknown` sor mellett a pár nem indítható újra (lehet, hogy a lead már látta).

⑤ **A JPEG-előállítás `sharp`** (`toMmsJpeg` / `ensureMmsJpeg`): ugyanaz a szabály — leghosszabb él
≤1280 px (nem nagyít), minőség 85-ről 10-es lépcsőben, amíg ≤290 KB vagy a lépcső 40 alá ér —,
az átlátszóság fehérre simul, a plafon fölötti kép DOB. Mérve egy valódi hero-képen: PIL 66 450 B,
sharp 65 722 B, azonos 608×380. Python-függés nincs, így az éles előnézet is működik.

⑥ **Modem-kizárólagosság:** az `mms-send` saját `flock`-ja + a systemd oneshot (a timer nem indít
újra egy még futót). Az SMS-relay-t NEM kell leállítani: a `gammu-smsd-inject` csak a démon
sorába ír, az MMS alatt álló démon utána küld.

**Elvetve:** `sms_outbox` + `kind` (az SMS-út változna, bytea az SMS-sorban); kép-URL a sorban
(az éles fájl eltűnhet, és a relaynek egy második hitelesített letöltő végpont kellene);
automatikus újraküldés beragadt sorra (dupla fizetős hideg MMS).

**Deploy utáni teendők (NEM a land része):** élesen `MMS_PROVIDER=queue` az .env-be; a dev gépen
a `citoviso-mms-relay.timer` telepítése + engedélyezése a fő fából. Őr: `scripts/mms-relay-check.mts`
(mock modem, valódi DB, eldobható fixture) + `scripts/mms-preview-gate-check.mts` ⑨ (sharp).
