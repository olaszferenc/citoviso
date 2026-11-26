# 2026-11-26 — „Országok / Árazás” megvalósítás: mind az öt fázis + ünnepnap-forrás

**Session:** cita363cd23 (SUB a 🟨3 Nemzetközi Terjeszkedés koordinátor alatt, `cit9b4690e3`). Brief: `~/rc-briefs/orszagok-arazas-terv-20261126.md`, megvalósítási terv: `~/rc-briefs/orszagok-arazas-megvalositas-terv-20261126.md`.

## Elvégzett munka
- **Terv** (§2b) befagyva: `assets/design-refs/console/orszagok-arazas/` és `…/arvaltozas-ertesito/`.
- **1. fázis** (ADR-0484): egy CRM-menüpont `/countries`, táblázat + ország három fülön (Ország / Árazás / Kiküldés).
- **4. fázis**: a kiküldés minden szabálya a `country` soron (0155), az auto-approve a repóban (`src/outreach/autoApprove.ts`), „mobil ellenőrizve” jel (`POST /contact-checked`). Egyenértékűség az éles másolaton zöld.
- **5. fázis** (ADR-0489): ütemezett árváltozás (0156 `price_change`): a megújítás az időszak kezdőnapjának árán; emelés ≥ +30 nap + értesítő (A változat, lemondó mondat nélkül); csökkenés azonnal.
- **2. fázis** (ADR-0491): új ország a világ-katalógusból (`src/countryCatalog.ts`), saját ár-régió jóváhagyatlan MNB-javaslattal, életciklus Felvéve → Indulás → Fut / Szünetel (0157). Indulás = jóváhagyás teljesség nélkül.
- **3. fázis** (ADR-0492): az indulás-lista részletezve (`src/countryLaunchStages.ts`): Bábel Felület / Levelek / Jogi / Súgó, kontakt, mock, a kiküldés oka. Az Indítás-napló a legutóbbi 6 bejegyzést mutatja, a régebbiek lenyithatók (legfeljebb 50).
- **Ünnepnap-forrás** (ADR-0493, 0158): `src/holidaySource.ts`, Nager.Date (ingyenes, kulcs nélkül). Választáskor és évente tölt, forrás-jelöléssel; ismeretlen ország = üres lista, piros teljesség.
- Az árváltozás-levél Bábel-kivétele törölve: Bábel lefordította (30ca5f73).

## Élesítés (a koordinátor vitte)
c29eb067 (prod/20261126-1942): 0156 és 0157 lefutott, HU és HR launched. A 0158 a következő deployjal megy.

## Tulaj-döntések
B jóváhagyás (alapból `owner`); F5 levél: A változat; visszavonó felület nincs (`cancelPriceChange` felület nélkül); a globális ársort a tulaj tölti kézzel; a domain díja azonnali.

## Tanulság
Adat-módosító migrációt land előtt nem szabad a közös dev DB-re felvinni. A 0155 korán felvive a HU ablakot írta át, és mások landja bukott (auto-memória: `feedback_no_dev_migration_before_land`).

## Nyitott
Nincs.
