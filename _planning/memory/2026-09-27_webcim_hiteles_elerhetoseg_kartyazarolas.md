# 2026-09-27 — Webcím: a vásárlás hibája + hiteles elérhetőség + kártyazárolás (ADR-0251)

## Bejelentés
Tulaj, telefonon (dev :4800, Lidó): a saját webcím vásárlása „A fizetést nem sikerült elindítani”-val
áll meg. A folyamat nem bizalomgerjesztő, mert végig „nem tudjuk előre” áll rajta. Legyen
elérhetőség-ellenőrzés, és győzzük meg a vevőt, hogy ha a regisztráció nem sikerül, nem terhelünk.

## 1. A hiba (landolva: `a2df3252`)
A `createDomainUpgradeOrder` nem örökölte a deklarált vevőt → nem volt `buyer_country` → a piac-kapu
(ADR-0111) megtagadta a fizetési linket („ismeretlen piac”). A modul-/nyelv-bővítés és az elszámolás
örökli, a domain nem örökölte. A `domain-provision-check` fixture-je vevő nélküli volt, ezért a kapu
vak volt rá. Most a javítás nélkül 3 piros, vele zöld.

## 2. §2b kör → jóváhagyás
Három változat (A1 zárolás + idővonal · A2 zárolás tömören · B visszautalás), mobil és asztali
képekkel, működő HTML-lel. A tulaj a mechanizmusból „A)”-t, a megjelenésből „A1”-et választotta.
A kontraktus: `assets/design-refs/console/domain-zarolas/`.

## 3. Megvalósítás
- **Elérhetőség:** `src/domains/availability.ts`, a Websupport csak-olvasó validate-je.
  Négy állapot, csak a „Szabad” kérhető; az Áttekintés és a rendelés-POST újra ellenőriz.
- **Fizetés:** Barion **DelayedCapture** (kártyán blokkol). ⛔ Előbb Reservation-nel építettem, és az
  ADR-0228 újraolvasása fogta meg, hogy az valódi terhelés — a jóváhagyott „ez még nem terhelés”
  mondat hamis lett volna. `payment.reservation` + `reserved`/`released` állapot (migráció 0077),
  lehívás a regisztráció után (`captureDomainReservation`), bukáskor feloldás
  (`releaseDomainReservation`), időzítős rendezés (`settleDomainReservations` a resume-domains-ban).
- **Felület:** A1 szerint (forrás-mondat, „Most zárolunk”, garancia-idővonal, pénz-állapotos 3. lépés,
  bukás-képernyő), a `/pay/done` a Webcím fülre visz. Levél, súgó (+ review.png), kb-shot fixture
  (az elavult `priceYearly` alakról).
- **Sandbox-mérés** a valódi adapterrel: Authorized → Capture → Succeeded; Authorized →
  CancelAuthorization → Canceled (Reversed).

## Módosított fájlok
src/domains/{domainUpgrade,availability,domainAdmin,provisionDomain}.ts ·
src/domains/registrar/websupport.ts · src/payment/{service,barion,gateway,mock}.ts ·
src/server/{adminViews,public}.ts · src/console/server.ts · src/email/domainEmail.ts ·
src/ui/icons.ts · src/db/schema.ts · migrations/0077_payment_domain_reservation.sql ·
scripts/{domain-provision-check,kb-shot,resume-domains}.mts · kb/entries/admin-domain/ ·
assets/design-refs/console/{domain,domain-zarolas}/ · ADR-0078 (módosítás-jel) · ADR-0251

## 2. kör (tulaj: „Javítsuk ezeket is”)
„Fizetek” mondat az Áttekintésen + a súgóban; a Wallet-ág megfigyelése (Apple/Google Pay DelayedCapture-nél
rejtve, a Wallet marad — a doksi szerint csak kártya); a lead-konfigurátor jelölője hiteles; élő dev-próba siker.
Menet közben két idegen kapu billegett (console-contrast, outreach-link-live: a lead-lap ~31 s) — tulaj-
engedéllyel 90 s-os korlát; a gyökérokot a „Lead-lap lassú” szál javította (ADR-0250). A photo-normalize
iker-javítás: a másik szálé maradt.

## Nyitott
- Élő végigpróba a dev-en a tulaj telefonján (sandbox-kártya: 4444 8888 8888 5559). A bukás-ág egy
  „taken”-t tartalmazó szabad névvel próbálható ki (a dev regisztrátor mock).
- ✅ Éles POS: DelayedCapture ELFOGADVA (egy nem kifizetett próba-Start, tulaj-engedéllyel). Nyitott: a Wallet-ág sandbox-fiókkal.
- Nincs élesítve (a nagy deployjal megy).
