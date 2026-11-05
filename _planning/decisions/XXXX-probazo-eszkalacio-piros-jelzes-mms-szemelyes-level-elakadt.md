## ADR-XXXX — Próbázó eszkaláció: 4. nap piros jelzés, 5. nap élő-oldal MMS, 7. nap személyes levél helyi névvel, 10. nap „elakadt”

**Dátum:** 2026-11-05 · **Döntött:** a tulaj („Elfogadom a javaslatokat!”, plan `assets/design-refs/console/proba-eszkalacio/`: lead-lap **A**, levél **P2**; „ne Poe legyen a kimenő név… mindig valami helyi név”) · **Kapcsolódik:** ADR-0417 (belépés-emlékeztető), ADR-0386 (az operátor látja a próbát), ADR-0407 (Próba riport), ADR-0083/0282 (MMS-pár, MMS-sor), ADR-0421 (ne keressük)

### Mi a helyzet
Élesen mérve 2026-11-05: Sáma (9. nap) és Marilyn (4. nap) megkapta a belépő levelet és egy-egy ADR-0417
emlékeztetőt (Sámánál a 2./4./6. napi kimaradt, mert a funkció 11-04-én indult), egyikük sem állított be jelszót.
Az emlékeztetők ugyanazt a csatornát ismétlik, a 8. nap után semmi nem történik, és a konzol nem jelez.

### Döntés
Az ADR-0417 lépcsői MELLÉ, amíg a tulaj nem állít be jelszót (`tenant_user.password_set_at` / `last_login_at`):
- **e4 — 4. nap:** piros jelzés a konzolon (lead-sor jelvény „nem lépett be · N. nap”, lead-lap piros kártya
  14 napos lépcsővel, Irányítópult figyelem-sor). Napló-jel, nem üzenet.
- **m5 — 5. nap, hétköznap 9–16:** MMS az ÉLŐ oldal nyitóképével („EZ MÁR AZ ÖN HONLAPJA” + webcím); a kísérő
  SMS (friss jelszó-link, 1 szelet) a relay nyugtája után (`mms_outbox.free_trial_id` → `settleTrialMms`).
- **h7 — 7. nap, hétköznap 9–16:** személyes hangú levél, feladó + aláírás a címzett nyelvének HELYI neve
  (`helperPersona.ts`; magyarul „Kiss Eszter”), friss link, felhasználónév, egy mondat az élő oldal saját
  címsoráról (ha van). A minta egyszer jóváhagyva (P2) → magától megy, levelenként nincs tulaj-teendő.
  Telefonos segítséget NEM ajánl (nulla humán, tulaj 2026-11-05).
- **s10 — 10. nap:** „elakadt” — a Próba riportban külön ítélet + „Hol szakad meg a próba?” panel (`?v=` szűrő).
- Minden lépés próbánként, csatornánként egyszer (`free_trial_notice`, küldés előtt foglalva); a már futó próba
  a bevezetéskor minden esedékes lépést egyszer kap. „Ne keressük” leadnek üzenet nem megy (a jelzés igen).

### Megvalósítás
`src/trial/escalation.ts` · `src/trial/liveShot.ts` · `src/trial/helperPersona.ts` · `src/email/loginEmail.ts`
(`buildTrialHelperEmail`, `buildTrialMmsSmsText`) · `src/mms/{sender,relayQueue}.ts` · `src/console/{leadClient,data,views,server,trialReport,trialReportViews}.ts`
· `public/assets/ui/citui-console.css` · `scripts/offer-followup.mts` (óránkénti tick) · `migrations/0125_trial_escalation.sql`
· őr: `scripts/trial-escalation-check.mts` (pre-commit).

### Nyitott
- **Koordinátor-jegy** a 4. napi jelzésnél (a mockban szerepelt): az éles adat a VPS-en van, a koordinátor a dev gépen;
  a jegy-hidat (olvasó figyelő, mint a `valasz-watch.py`) külön lépésben kell megépíteni.
- A kézbesítés továbbra sem mérhető (SMS-nek nincs kézbesítési jelentése) — ez ADR-0417 nyitott pontja.

### Visszafordíthatóság
🔄 könnyű: az óránkénti tick egy blokkja + nézetek; a migráció csak bővít (két CHECK + egy nullable oszlop).
