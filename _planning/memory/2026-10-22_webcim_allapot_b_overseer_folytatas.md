# 2026-10-22 — Webcím állapot-képernyő „B” (ADR-0399) · overseer.hu folytatás · a domain-folyamat hiányai

Session: f5adbfb1 utódja, fa `~/wt/citba7915d2` (átadás 10-21 20:50). Záró állapot: minden landolva (`origin/main` = d5a71eec), élesen semmi.

## Elvégzett
- **Webcím állapot-képernyő a vétel után** — terv A/B (`assets/design-refs/_drafts/webcim-allapot/`, a land törölte), tulaj: „B”. Kód: `domainStatusB()` az `adminViews.ts`-ben (egy mondat a várható elkészüléssel — .hu: vétel + 24 óra egész órára felfelé; 3 szakasz; lépéslista időponttal; 24 óra / stuck_stage≥1 / setup_retry → „munkatársunk már intézi”), `DomainProgressTimes` a `domainAdmin.ts`-ben, `0112_domain_ns_active_at.sql` (a dns_pending→tls_pending ideje). Kontraktus: `assets/design-refs/console/domain/allapot-4-webcim-b.html` + README. ADR-0399. Őrök igazítva: domain-package-claim-check ⑤, domain-order-single-flight-check B2, domain-provision-check (az ígéret-regex „e-mailben szólunk”-ra is). Valós adattal renderelve, 390/1280 képen ellenőrizve.
- Commitok: 1ca6e607 (memória), d9840205→185af0ab (feature), d5a71eec (ADR-szám). „IGAZOLTAN FENT”.
- Deploy dry-run `d5a71eec`: GATE 1c/kép bukás (amenities, 198 px, szemre azonos); 2. futás memóriahiány miatt leölve. NEM élesítve.
- overseer.hu: 08:15 nincs bejegyezve; a regisztrátor 06:04-es „hiányzó adat” levele megtalálva (IMAP INBOX 673) — egy azonosító kell a MI profilunkhoz.

## Hiba, amit elkövettem
„A domain a partner nevére kell” — kitaláció, kétszer visszavonva. Modell: ADR-0103, a tulaj szava: „az enyém a domainnév, amíg meg nem veszik tőlem”. Memória: `feedback_domain_registrant_is_citoviso_never_partner`.

## Nyitott (a MEMORY.md Aktív feladat szakaszában tételesen)
deploy · a regisztrátornak adandó válasz (a tulaj személyes adata) · a domain-folyamat többi hiánya (döntés nincs) · Fotók-lap címei (C SUB) · Belépés egy hely A+B (SUB 4678246e) · memória (elekdrive Chrome) · a figyelő vaksága a support-levelekre.

## Módosított fájlok (landolva)
`src/server/adminViews.ts` · `src/domains/domainAdmin.ts` · `src/domains/provisionDomain.ts` · `src/db/schema.ts` · `migrations/0112_domain_ns_active_at.sql` · `src/i18n/catalog.json` · `assets/design-refs/console/domain/allapot-4-webcim-b.html` · `assets/design-refs/console/domain/README.md` · `_planning/decisions/0399-webcim-allapot-kepernyo-idopontokkal.md` · `scripts/domain-order-single-flight-check.mts` · `scripts/domain-package-claim-check.mts` · `scripts/domain-provision-check.mts` · `scripts/kb-shot.mts` · `MEMORY.md`
