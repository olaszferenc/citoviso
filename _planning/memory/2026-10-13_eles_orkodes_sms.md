# 2026-10-13 — Élesi őrködés: megakadt külső folyamat → levél + szűrt SMS (ADR-XXXX)

SUB `cit910826e9` a „deploy” FŐ session (`citfb4ed7ab`) alatt; brief `~/rc-briefs/eles-orkodes-sms-20261013.md`.
Tulaj 2026-09-30: „ha valamely külső folyamat megakad, arról jöjjön értesítés + SMS”. Kiindulás: `_planning/DEPLOY-READY.md` 4b.3.

## Hézag-lista (mérve a mainen, `465e5394`)
| Külső folyamat | Előtte | Most |
|---|---|---|
| Fizetés (Barion) `pending`-ben marad | NÉMA (csak ha a vevő visszajött) | óránként: 60 perc után a szolgáltatót kérdezi; függő/hibás → levél + SMS; ott sikeres → aktivál + „pótolta” levél |
| Domain `failed` | csak a tulaj kapott levelet | ház: levél + SMS |
| Domain `pending`/`registering`/`registered` | NÉMA | 2 óra után levél + SMS |
| Domain DNS/TLS (0107), `setup_retry` | levél | levél + SMS |
| Számlázás (ADR-0283) | levél | levél + SMS |
| API-kulcs 401/403 | NÉMA mindenhol | Places ×2, Brave, Websupport regisztrátor + DNS, SMTP a hívás helyén; Anthropic óránkénti ingyenes próba; naponta egyszer, levél + SMS |
| Levélküldés | csak a hívó riasztott (levélben…) | bukó riasztó levél → egy „mail-down” SMS |
| SMS-sor (modemes relay áll) | NÉMA | 30 perc után levél (SMS-t nem: ugyanott várna) |
| iCal-link 24 órája hibás | csak a tulaj | ház: levél |
| Időzítő / szolgáltatás bukása, webhook, foglalási levél, próba-indítás, kézi domain-igénylés | levél | levél + SMS |

## Elkészült
- `src/console/houseAlert.ts` — `sms`/`smsKey` mező, zajszűrős SMS-ág (`house_alert_sms`), csak éles hoston, mail-down tartalék.
- `src/console/stallWatch.ts` — `runStallWatch` (5 söprés, `house_alert_once`), `reportCredentialFailure`.
- `src/console/keyDeath.ts` — `noteDeadKey` (dinamikus import, fire-and-forget).
- `migrations/0108_house_alert_sms.sql` + `src/db/schema.ts`.
- `scripts/offer-followup.mts` — a söprés saját try-ban.
- Bekötések: `src/scraper/sources/googleMaps.ts`, `src/generator/images.ts`, `src/scraper/sources/webSearch.ts`,
  `src/domains/registrar/websupport.ts`, `src/domains/dns/websupport.ts`, `src/email/sender.ts`,
  `src/domains/provisionDomain.ts` (`alertDomainFailed` + SMS a meglévőkre), `src/payment/service.ts`,
  `src/server/public.ts`, `src/trial/start.ts` (sms-jelzők).
- Őr: `scripts/stall-alert-check.mts` (pre-commit); `--self-test` piros (9 FAIL); a main-beli `houseAlert.ts`-sel 8 FAIL.
  `house-alert-check` változatlanul zöld.
- Súgó: `kb/entries/console-settings/entry.hu.md` — az új riasztások + „Melyik riasztás jön SMS-ben is?” (tudasbazis-or: a FLAG-elt két hiányzó tétel pótolva).
- `_planning/DEPLOY-READY.md` 4b.3 + §6 sor.

## Élesen beállítandó (a deploy dolga, NEM ennek a szálnak)
1. Migráció `0108_house_alert_sms` (két új tábla).
2. Riasztási SMS-szám: konzol `/settings` → „SMS-szám” (vagy `OWNER_ALERT_PHONE`). Ma élesen üres → csak levél megy.
   Tulaj teszt-mobil +36 30 516 1631; a +36 30 120 0971 a modem SIM-je — oda NE.
3. `SMS_PROVIDER=queue` élesen + a dev gépen a `citoviso-sms-relay` időzítő (ma is így van). Új systemd-egység nincs.
4. `ANTHROPIC_API_KEY` élesen, ha az Anthropic-próbát akarjuk (nélküle a próba kimarad, nem riaszt).

## Nyitott
- Időzítő-szívverés (le nem futó / letiltott időzítő) — az `OnFailure=` csak a bukást látja.
- MMS-sor torlódása (ma soronként riaszt, torlódásra nem); Cloudflare DNS nincs implementálva.
- SMS-re nincs csendes óra (döntés: a súlyos éjjel is szól, a szűrő fogja a zajt) — a tulaj kérheti.
