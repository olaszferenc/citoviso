# 2026-11-09 — BeNo Kőröshegy: rossz címzett javítása, válaszlevél a kész tervvel

**Session:** `citeb126277` (brief `~/rc-briefs/email-megkeres-s-20261109-102850.md`)

## Elvégezve
- Ok: Neo névhasonlóság alapján a kőröshegyi BeNo kontaktját a balatongyöröki Benó leadre írta; a dispatcher telefon-ütközésnél csak az SMS-t tartotta, az e-mailt nem.
- Élesen: a téves kontakt levéve (mentéssel); a kőröshegyi lead kontaktot + 13 fotót kapott; fő terv `e72d82ad` + 2. terv `d8fac402`; prospect `eae96e0c`, link https://beno-apartman-2.citoviso.com; hideg kiküldés `0591aacf` skipped.
- A javított megkeresés válaszlevélben ment ki 11-09 14:52 (reply `8619ce59`, tulaj jóváhagyásával).
- Kód: ADR-0434 (kurátori e-mail-levétel feloldja az iker-tartást; telefon-ütközés az e-mailt is tartja) — landolt, élesen NINCS.

## Módosított fájlok
- `src/outreach/sharedContactGate.ts`, `src/outreach/autoDispatch.ts`, `scripts/dispatch-twin-check.mts`
- `_planning/decisions/0434-rossz-cimzett-javitasa-es-telefon-utkozes-az-egesz-kiku.md`
- `MEMORY.md`

## Nyitott
- ADR-0434 élesítése (`deploy-prod.sh`) — tulaj engedélyére vár.
