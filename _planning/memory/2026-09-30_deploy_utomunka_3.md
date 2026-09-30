# 2026-09-30 — Deploy-utómunka 3: Számla újra gomb · névelő-újrafordítás · MMS esti tiltás

SUB (utomunka3) a Deploy-koordinátor alatt; a tulaj mindhárom tételről előre döntött.

## Elvégezve
- **„Számla újra ▸” gomb** (ADR-0283): a `szamlaretry` SUB patchje rá, felület-kapu `approve` a tulaj által
  jóváhagyott képekkel; a riasztó levél teendője a gombot is megnevezi. A `tudasbazis-or` FLAG-je (kitalált
  „Már van kiállított számla…” idézet a KB-ban) javítva: már kiadott számlánál a konzol szó nélkül a fülre tér vissza.
- **`scripts/i18n-article-refresh.mts`** (ADR-0281): száraz alapból; `--go` = a `{art}`-kulcsok kivétele a
  `language_pack`-ből → `ensureAllLanguagePacks` → visszamérés. Dev: 31 kulcs × 6 nyelv, 0,4334 USD, zöld.
  (A jelentés 33-at írt; a mai katalógusban 31 névelős kulcs van.)
- **MMS esti tiltás** (ADR-0282 kiegészítés): `src/sms/sendWindow.ts` `mmsPullBlocks` — 8:00–19:30 Budapest
  ÉS nyitott SMS-kapu. Őr ⑫ a `mms-relay-check`-ben (nyár/tél, Budapest- és UTC-folyamat), mutációval piros.

## Lelet
- Az éles folyamat **UTC**-ben fut (nincs `TZ`): az SMS-ablak-kapu (`getHours()`) élesen 10:00–22:00 (nyáron)
  budapesti idő szerint enged. Az MMS ehhez igazodik; magát az SMS-kaput nem írtam át (DÖNTÉS KELL a jelentésben).

## Fájlok
`src/console/{server,data,views,houseAlert}.ts` · `src/i18n/catalog.json` · `kb/entries/console-lead/entry.hu.md` ·
`scripts/i18n-article-refresh.mts` · `src/sms/sendWindow.ts` · `src/mms/relayQueue.ts` · `src/outreach/sendOutreachSms.ts` ·
`scripts/mms-relay-check.mts` · `_planning/decisions/0282-…md`
