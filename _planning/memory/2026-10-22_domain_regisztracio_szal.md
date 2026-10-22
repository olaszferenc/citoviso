# 2026-10-22 — Domain-regisztráció: a szál végig a miénk (ADR-XXXX) — overseer.hu oka és a gépi folyamat

Brief: `~/rc-briefs/domain-reg-tiszt-z-sa-20261022-083453.md` (tulaj: „nincs figyelő, nincs kontroll, nincs
értesítés — a vétel után baszunk az egész folyamatra”).

## Mi derült ki (mérés, nem feltételezés)
- **Az overseer.hu azért áll:** a Websupport domain-profilunkban (`GET /v1/user/3213041/domainProfile`, profil
  #2851827) **nincs azonosító** (`identBirthday`, `identIdentityCard`, `identPassport`, `identVat`,
  `identCompanyRegistration` mind null). A Websupport support ma 08:04-kor írt a `olasz.ferenc@citoviso.com`
  INBOX-ba: „[Websupport] - hiányzó adat - overseer.hu -”: a regisztráció „hiányos adatrögzítés miatt hibára
  futott”, egy azonosítót kérnek válaszlevélben (születési dátum / anyja neve / személyi / útlevél / jogosítvány).
  A rendelési kérés (`{services:[{type:"domain",domain}]}`) semmilyen regisztrálói adatot nem visz; a .hu
  Nyilvántartó a profilból veszi. Ugyanez volt 2026-09-07-én a citoviso.hu-nál (ticket NGW-NKDHD-903).
- A Websupport API-ból a beadás állapota NEM látszik (service `active`, order-végpontok 404, profil-részlet 404);
  csak a support-levél jelzi. Jó esetben a Nyilvántartó megerősítő levele perceken belül jön.
- Dokumentáció szerint `PUT /v1/user/{id}/domainProfile/{profileId}` az `ident*` mezőkkel létezik — a .hu API-n
  nem mérve (írás, tulaj-engedéllyel).

## Mi készült (landolás ebben a fában)
- `RegistrarAdapter.readiness()` + `RegistrarNotReadyError`; Websupport: fiók (kontakt, ÁSZF, kredit) +
  domain-profil (név, e-mail, azonosító); `register()` ezzel kezd; `registrarReadiness()` memo 10 perc.
- `provisionDomain`: nem kész fiók → `pending` + ház-riasztás naponta (nem `failed`, nem tenant-levél);
  `registered→dns_pending` után tenant **vétel-levél** (`buildDomainBoughtEmail`, `bought_notice_at`).
- `registryConfirmWatch`: INBOX + Spam; a regisztrátor emberi levele folyamatban lévő névről → ház-levél+SMS +
  `registrar_note` a soron (`matchRegistrarMail`, `processRegistrarMails`); `confirmLinkSeenSince`.
- `stallWatch`: `registry` (2 h `.hu` link nélkül) és `registrar` (készenlét naponta) söprés.
- Migráció 0113; őrök bővítve (`registry-confirm-check`, `domain-provision-check`, `stall-alert-check`);
  KB admin-domain: két levél; ADR-XXXX.

## Módosított fájlok
`migrations/0113_domain_registrar_watch.sql`, `src/db/schema.ts`, `src/domains/registrar/{registrar,index,mock,inwx,websupport}.ts`,
`src/domains/provisionDomain.ts`, `src/domains/domainAdmin.ts`, `src/domains/registryConfirmWatch.ts`,
`src/console/stallWatch.ts`, `src/email/domainEmail.ts`, `src/i18n/catalog.json`, `kb/entries/admin-domain/entry.hu.md`,
`scripts/{registry-confirm-check,domain-provision-check,stall-alert-check}.mts`,
`_planning/decisions/XXXX-domain-regisztracio-vegigkovetett-szal.md`, `MEMORY.md`, ez a jegyzet.

## Nyitott (tulaj dönt)
1. overseer.hu: melyik azonosítót adjuk a Websupportnak és hogyan (válasz-levél vagy API PUT) — személyes adat.
2. A tenant állapot-képernyőjének „munkatársunk már intézi” sora a `registrar_note_at` pillanatától (ADR-0399
   képernyő, egy feltétel — felület-kapu, a tulaj szava kell).
3. Megújítás (autoExtend=false, nincs renew) és a név átadása a tenantnak (nincs kód) — ADR-XXXX Nyitott 3–4.
4. Élesítés: 0113 migráció + a 2 perces timer és az óránkénti tick az új kóddal; az első futás a mai
   support-levélre riasztani fog (48 órán belüli), és a sorra jegyzetet ír.
