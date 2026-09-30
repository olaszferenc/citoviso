## ADR-XXXX — Minden kimenő küldési ablak és kimenő határidő Budapest-idő szerint számol, a szerver zónájától függetlenül (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; brief: `~/rc-briefs/sms-ablak-idozona.md`) ·
**Kapcsolódó:** ADR-0287 (az óránkénti emlékeztető, ahol a hiba kiderült), ADR-0282 (MMS-relé, 19:30-as vágás), ADR-0112
(mobil-pár), `src/sms/sendWindow.ts`.

**Kontextus.** Az éles VPS **UTC**-ben fut, a dev gép Europe/Budapest-ben. A hideg SMS kapuja (`sendOutreachSms.ts`), a
mobil-pár indítási határa (`pairWindowBlocks`) és az MMS-relé reggeli nyitása a folyamat HELYI óráját olvasta
(`getHours` / `setHours`). Élesen ez 10:00–22:00 Budapest-idős ablakot adott volna, miközben a dev-gépen minden teszt zöld
volt. Egy meglévő őr (`mms-relay-check` ⑫) ezt a hibás viselkedést szó szerint rögzítette is („UTC-n 08:30 Budapest még
nem húz”). Az ADR-0287 emlékeztető-levele a határidőt szintén a szerver zónájában írta ki, a linkelt oldal döntés-kártyája
viszont Budapest szerint mutatja: a levél 1–2 órával korábbi határidőt mondott volna, mint az oldal.

**Döntés.**
1. **Egy szabály, egy példány:** `src/sms/sendWindow.ts` → `SEND_WINDOW_TZ = "Europe/Budapest"`, `sendWindowOpen(now)`,
   `minutesUntilWindowCloses(now)`, `budapestHhmm(now)` (mind a `budapestMinutes`-re épül). Ezt használja a hideg SMS
   kapuja, a mobil-pár indítási határa, az MMS-relé (`mmsPullBlocks`) és az eszkalációs emlékeztető ablaka
   (`followupWindowBlocks`). A régi `smsWindowOpen` (helyi óra) megszűnt.
2. **Kimenő határidő:** az emlékeztető levél határideje (`deadlineText`) `SEND_WINDOW_TZ` szerint formáz, egyezik a lap
   döntés-kártyájával.
3. Az operátori okok („most HH:MM”) is Budapest-időt mondanak; a pár-helyreállítás felismerője (`isTimingOnly`) a mondat
   változatlan elejére illeszkedik.

**Őr:** új `scripts/send-window-tz-check.mts` (pre-commit, tiszta, DB nélkül): három folyamat-zónában (Budapest, UTC, New York),
nyári és téli időben méri az ablakot (07:59 / 08:00 / 19:59 / 20:00), a zárásig hátralévő perceket és a mobil-pár határát,
az emlékeztető ablakát és a levél határidejét. Szerkezetileg azt is, hogy a kimenő döntés-fájlok nem olvassák a helyi órát.
Szándékos rontással mérve: az ablak helyi órára visszaállítva 10, a pár-határ `setHours`-szal 6, a határidő zóna nélkül
5 ellenőrzés bukik. A `mms-relay-check` ⑫ reggeli állítása az új szabályra javítva (UTC-n is 08:00 Budapestkor húz), és a
triggere most a `sendWindow.ts` változására is lefut.

**Nem kimenő, helyi órát olvasó helyek (NEM javítva, felsorolva):**
`src/tenant/multilangCard.ts` `fmtStamp` (a vevőnek mutatott fizetési időbélyeg — élesen UTC-t mutat);
`src/server/moduleConfigViews.ts` „Utoljára frissült” (`toLocaleString` zóna nélkül);
`src/analytics/trafficReport.ts` `since()` (a forgalmi jelentés napi határa helyi éjfél);
`src/analytics/trafficMail.ts` `monthLabel` (hónapnév zóna nélkül). Ezekről külön döntés kell.

**Élesítés:** az ADR-0287-tel együtt (`deploy-prod.sh`, külön engedéllyel). Migráció nincs.
**Visszafordíthatóság:** 🔄 egy commit.
