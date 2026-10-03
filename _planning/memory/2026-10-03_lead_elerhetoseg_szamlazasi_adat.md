# 2026-10-03 — Lead-elérhetőség: számlázási cím a szállás adataiban (Három Huszár) — eredet + javítás

SUB (brief `~/rc-briefs/fix-lead-elerhetoseg.md`), ADR-0316.

## Ok
A konzol „Adatok” űrlapja (`saveLeadEdits`) — böngésző cím-autofill a tesztelő profiljából, egy tesztkiküldés előkészítésekor.
Ugyanaz a sztring az `order_intent.buyer_address`-ben is (pénztár-űrlap, ugyanaz a profil). A telefon/e-mail szándékos
tesztcímzés (allowlistes számok).

## Mérés
Dev: 7 lead (2 adószámos címmel, 5 „…hrsz. 083/2”-vel), mind `curatorEditedAt`-tel. Éles (csak olvasva): 0 érintett lead/tenant/site.

## Javítás
`src/console/leadContactRules.ts` (adószám/telefonszám a címben → elutasítás, ország ISO-2), `saveLeadEdits` mindent-vagy-semmit,
flash a lapon. Őr: `scripts/lead-contact-guard-check.mts` (pre-commit; régi kódon 6 piros).
Az űrlap autofill-tiltása (views.ts) a §2b felület-kapun megállt — a kivételt csak a tulaj adhatja (ADR-0068); kész patch:
`~/rc-briefs/patches/lead-edit-autofill-off.patch`.
Dev adat: 7 lead javítva, `raw.contactRepair` audit.

## F-1
Ugyanaz a forrás (a tesztelő autofill-profilja), de a MÁSIK irány (szállás irsz./település → számla), és már javítva:
`417dee6b`, `scripts/billing-taxid-in-address-check.mts`. Az új szabály ugyanazt az adószám-keresőt használja.

## Módosított fájlok
- src/console/leadContactRules.ts (új)
- src/console/data.ts
- src/console/server.ts
- scripts/lead-contact-guard-check.mts (új)
- hooks/pre-commit
- _planning/decisions/XXXX-lead-nyilvanos-elerhetoseg-nem-szamlazasi-adat.md (új)

## Nyitott
- Autofill-tiltás patch (`~/rc-briefs/patches/lead-edit-autofill-off.patch`) — tulaj §2b-kivétel kell.
- Mobil tesztcímzés prospect-szinten (tulaj-döntés) — ma a lead nyilvános telefonja a tesztszám.
- A Három Huszár 10-02-i artefaktuma (`fc728903…`) még a régi kontaktot hordja → új generálás kell a sablon-mintához.
