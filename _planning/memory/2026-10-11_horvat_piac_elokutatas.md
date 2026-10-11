# 2026-10-11 — Horvát piac: számlázási, ÁFA- és jogi előkutatás

**Brief:** `~/rc-briefs/sz-ml-z-s-20261010-075645.md`: a tulaj adószakértői és könyvelői tanácsot kér; a session nézzen
utána, milyen feltételekkel nyújtható a szolgáltatás az EU-ban, név szerint Horvátországban (számlázás, jog).

## Elvégzett munka
- Kutatási jegyzet: `_planning/RESEARCH-2026-10-horvat-piac-szamlazas-jog.md`, a tanácsadónak szóló kérdéslistával.
- A repó állapotából indult: AAM-os EV, Számlázz.hu, Barion; ADR-0055 (VIES + reverse_charge DB CHECK), ADR-0098,
  ADR-0111 (piac-kapu), ADR-0206.
- Kód nem változott.

## Fő megállapítások
- **B2B, horvát PDV-azonosítóval:** fordított adózás. A kódban kész, de a SAJÁT közösségi adószámunk nincs a számlán,
  és az A60-at is be kell adni. A horvát paušalist a 25% PDV-t maga fizeti, és nem vonhatja le, ezért nála a mi árunk +25%.
- **B2C:** évi 10 000 € EU-s forgalomig AAM. Fölötte OSS (25% horvát ÁFA) vagy SME-rendszer (horvát mentesség 60 000 €-ig).
  A kódban sem számláló, sem ilyen ág nincs.
- **Adószám nélküli szállásadó:** a 282/2011 18. cikk (2) „ellenkező információ” kitétele miatt kockázatos B2C-ként
  számlázni. Javaslat: horvát szállásadónál kötelező PDV-azonosító.
- **Horvát forrásadó:** nyitott kérdés, hogy az előfizetés jogdíjnak minősülhet-e.
- **Jog:** a horvát ZEK opt-int ír elő a magánszemélyeknek küldött marketing-e-mailre. Ez a hideg tölcsér legnagyobb
  kockázata; a magyar jogalap-döntés nem vihető át.

## Nyitott (tulaj)
- Adószakértő/könyvelő a 6. fejezet 7 kérdésével.
- Horvát jogász: ZEK, ÁSZF, tenant-lábazat, .hr domain.
- Addig a HR piac-kapu ZÁRVA marad.

## Módosított fájlok
`_planning/RESEARCH-2026-10-horvat-piac-szamlazas-jog.md` (új, landolt) · `MEMORY.md` · ez a jegyzet.
