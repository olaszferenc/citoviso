# 2026-08-26 — Miért a „Frissítések" fülre ment a hideg levél (MÉRVE), és mi lett belőle

## A panasz
A tulaj teszteli és magának küldi ki a megkereséseket. Gmailben **kizárólag a Frissítések fülre**
érkeztek. Az ő szava: *„a fasz se nézi a frissítések mappáját"* — a levél tehát kézbesítve volt,
de a mock-link el sem jutott a leadhez. Feszültség: a **kép** hozza a wow-ot és emiatt a
kattintást, viszont épp a képet gyanúsítottuk a rossz besorolással.

## Ahogy kiderült (nem tipp — mérés)
1. **A meglévő postafiók vallott** (Gmail `category:` operátor a saját fiókon):
   - `from:citoviso.com category:updates` → **3 találat, MIND outreach**
   - `from:citoviso.com category:primary` → **8 találat, MINDEN más** (számla, belépési adatok,
     nyelv-értesítő, teszt)
   Azonos feladó, azonos Zoho SMTP, azonos SPF/DKIM → **sem a hitelesítés, sem a domain-reputáció
   nem magyaráz semmit.** Egyetlen szerkezeti különbség volt: a `List-Unsubscribe` fejlécet CSAK az
   outreach állítja (`src/email/outreachEmail.ts`), a többi levéltípus egyiket sem.
2. **Aranyat érő kontroll:** egy TOVÁBBÍTOTT outreach-levél (497 KB, ugyanaz a kép, de az eredeti
   fejlécek nélkül) **Primary**-be esett → a kép gyanúja megingott, a fejlécé megerősödött.
3. **Hat kontrollált levél** (`scripts/inbox-ab.mts`, feladó/SMTP/törzs azonos):

   | | kép | `List-Unsubscribe` | fül |
   |---|---|---|---|
   | A | van | https + one-click | Frissítések |
   | B | van | **nincs** | **Elsődleges** |
   | C | nincs | https + one-click | Frissítések |
   | D | nincs | **nincs** | **Elsődleges** |
   | E | van | https, one-click nélkül | Frissítések |
   | F | van | `mailto:` | Frissítések |

   **Bármilyen fejléc → Frissítések (4/4). Fejléc nélkül → Elsődleges (2/2).** A 318 KB képet vivő
   B is Elsődleges lett: **a kép ártatlan, a wow megtartható.** Középút nincs.

## Amit szállítottam
- **`OUTREACH_LIST_UNSUBSCRIBE` kapcsoló** (ADR-0069), alapérték `on` = MAI viselkedés. A tulaj
  jóváhagyása után egy `.env` sor + restart. A `sendBatch` kapuja a fejlécről átkerült a **testbeli**
  leiratkozó linkre — az a jogi követelmény (Grt./GDPR), és az minden variánsban ott van.
- **Olvasható link `/p/<slug>/<token>`.** Eddig a levél egyetlen CTA-ja egy csupasz véletlen token
  volt ismeretlen feladótól — adathalász-forma. Most a tulaj a SAJÁT nevét látja a webcímben. A slug
  kozmetikai; a token őriz. A már kiküldött `/p/<token>` linkek élnek (normalizálás).
- **Lyukas őr befoltozva:** az „elérhetetlen link" ellenőrzés néven nevezte a Tailscale-t, de csak
  NUMERIKUS IP-t nézett → a `https://mineral.tail3a89f.ts.net:8443` alap ZÖLDEN átment. A kiment
  teszt-levelek olyan linket vittek, amit rajtunk kívül senki nem tud megnyitni — a leiratkozót sem.

## Módosított / létrehozott fájlok
- `src/config.ts` — `outreachListUnsubscribe` kapcsoló
- `src/email/outreachEmail.ts` — a fejléc kapcsolóra kötve (a hibás „mild bulk signal" komment javítva)
- `src/outreach/sendBatch.ts` — a kapu az opt-outot méri, nem a fejlécet
- `src/outreach/draft.ts` — `/p/<slug>/<token>` link
- `src/outreach/outreachCheck.ts` — privát hosztNÉV is elérhetetlen
- `src/console/prospectPath.ts` (ÚJ) + `src/console/server.ts` — útvonal-normalizálás
- `scripts/check-prospect-path.mts` (ÚJ) — 13 eset, pirosra tesztelve, pre-commitban
- `scripts/inbox-ab.mts` (ÚJ) — a fül-mérő lab (valódi prospect-rekordot nem érint)
- `hooks/pre-commit`, `_planning/DECISIONS.md` (ADR-0069)

## Nyitott kérdések
1. **A tulaj döntése kell:** `OUTREACH_LIST_UNSUBSCRIBE=off` élesítése. A kód kész, a mérés megvan.
2. A mérés EGY postafiókból van, és a Gmail feladónként tanul — más címzettnél a verdikt eltérhet.
   Újramérhető: `PUBLIC_BASE_URL=https://citoviso.com npx tsx scripts/inbox-ab.mts <cím>`.
3. **A tárgy és az első sor** (a Gmail-listában ez a három látszik: feladó, tárgy, első sor) még
   soha nem volt hangolva — ez a következő kar a megnyitásra. A szöveg a tulaj asztala (`draft.ts`).
4. A `/p/<slug>/<token>` route-ot a landolás utáni fő fán (:4600) érdemes végigkattintani —
   a regexet 13 eset fedi, de élő kérésen még nem futott.
