# Teszt-előfizetések lezárása — téves terhelés-riasztás, egy valódi kockázat élesen (2026-11-27)

Session `cit4ee71a6a`, brief `~/rc-briefs/bankk-rtya-20261127-093605.md` („bankkártya”).

## Kiinduló jelzés
A tulaj fordulónapi terhelést és számlát látott a postafiókjában, és az éles teszt-vásárlások előfizetéseire gyanakodott.

## Mérés
- **Éles:** 3 valódi Barion-fizetés (10-14 103 Ft, 10-21 55 Ft, 11-03 4 957 Ft), utána semmi. A `citoviso-billing` 30 napja `renewalOrders: 0`; az utolsó számla a CITO-2026-7 (11-03).
- **Dev:** a dev gép `citoviso-billing` timere (07:00) a régi sandbox-próbák előfizetéseit újította meg. Barion SANDBOX, tesztkártya …5559, valódi pénz nincs. A Számlázz TESZT-fiók `OV-` számlát adott (OV-2026-95…103), és a tulaj Gmail-pont-aliasaira (pl. `olaszfere.nc@gmail.com`) küldte. A Gmail ezeket ugyanabba a postafiókba kézbesíti. A tulaj megerősítette: Barion sandbox értesítés volt, téves riasztás.
- **Valódi kockázat:** élesen a `[TESZT] Rebeka Panzió` a tulaj valódi MasterCardját (…7275) tárolta tokenként, 12-05-én valódi terhelés lett volna.

## Elvégzett
- Dev: mind a 11 nem lezárt előfizetés `revokeAutoCharge` + `cancelSubscription` (mentés: `~/rc-briefs/bankkartya-20261127/dev-backup-subscription-site.sql`).
- Éles (a tulaj „vegyük le igen” engedélyével): a `[TESZT] Rebeka Panzió` lezárva, token visszavonva (mentés: `/opt/citoviso/backups/teszt-elofizetes-rebeka-20261127-090549/`). A `[TESZT] Nussbaum Panzió` 11-29-én magától zárul (`cancel_at_period_end`, nincs kártya). A Duna Vibe House-hoz nem nyúltunk: ez az egyetlen valós előfizető (tulaj).

## Módosított fájlok
- `MEMORY.md`
- `_planning/memory/2026-11-27_teszt-elofizetesek-lezarasa.md`

## Nyitott
- Javaslat, nem elkezdett munka: a dev számlázója ne küldjön Számlázz-teszt levelet valódi címekre.
