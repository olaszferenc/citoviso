# 2026-10-05 — Pilot-másolat a mobil-megkeresésről (SMS/MMS a tulajnak)

**Kérés (tulaj, brief):** élesen a pilot végéig minden megkeresésről e-mail BCC-ben, és az SMS/MMS
menjen a +36 30 516 1631 számra is.

## Mi volt már kész
- **E-mail:** az `EMAIL_BCC` pilot-BCC (sender.ts `pilotBcc`) MINDEN `audience: "platform"` levelet
  másol — a hideg megkeresés (`outreachEmail.ts`) is ilyen. Élesen be van állítva:
  `EMAIL_BCC=olasz.ferenc@citoviso.com` (olvasva 2026-10-05). Kódváltozás nem kellett.

## Új
- `OUTREACH_COPY_PHONE` env (`src/config.ts`), üres = ki (pilot után ez az állapot).
- `src/outreach/pilotCopy.ts`: `copyOutreachSms` / `copyOutreachMms` — soha nem dob, a lead
  küldését nem érinti; a lead saját száma = másolat-szám → nincs önmásolat.
  SMS-másolat fejléce: `[Másolat → <lead>, <szám>]` + a teljes szöveg.
- Bekötés: pár-MMS (sor-mód: a lead sora UTÁN sorba; közvetlen mód: a kísérő SMS UTÁN, hogy a
  lead ne várjon ~90 mp-et a linkre/leiratkozásra), a pár SMS-fele, az önálló SMS — mind a
  sikeres ág után. Az MMS-másolat `prospectId` NÉLKÜL megy (a lead egy-MMS-per-prospect
  sorhelyét és az ack-et nem bántja).
- Őr: `scripts/pilot-copy-check.mts` (pre-commit, diff-scope-olt).

## Nem másolt
Operátor-riasztások (pairRepair, aamAlert, payLinkAlert), tenant-értesítők, számla-felszólítás SMS —
ezek nem megkeresések.

## Nyitott
- ✅ ÉLES: 2026-10-05 11:26, `30012966` = `prod/20261005-1126` (tulaj-kérésre; a deploy előtt a
  tudasbazis-or FLAG-elte a fejléc AI-pirula súgóját — telefonon felirat nélküli — javítva `30012966`-ban).
- Az éles `.env`-ben a sor MÁR BENNE VAN
  (`OUTREACH_COPY_PHONE=06305161631`, 2026-10-05 08:55 UTC, tulaj-engedéllyel, restart nélkül;
  mentés `/opt/citoviso/backups/pilot-copy-env-20261005-085532/`) → a deploy pillanatától él.
- Pilot végén: a sort törölni az éles `.env`-ből (és az `EMAIL_BCC`-t is) + restart.
- Sor-módban az MMS-másolat a sorba-tételkor indul: ha a lead MMS-e utóbb elbukik, a másolat ettől
  még kimehet. Minden MMS-másolat ~90 mp modemidő.
