# 2026-09-25 — E4 logó a vékony fejléces leveleken (megkereső, forgalmi, programajánló)

**Kiváltó (tulaj, Gmail-képernyőkép az Éden üdülőház megkereső leveléről):** „ezzel már
foglalkoztunk! nem ebben a logóban maradtunk!”

## Mi volt a baj
Az E4 logó (ADR-0225, 2026-09-24) csak a 12 platform-levélre került rá. A megkereső levél
kimaradt (ott „szándékosan személyes hangú” levélként kivettük a körből), a havi forgalmi és a
heti programajánló levélnek pedig saját kerete van. Így mindhárom még a régi
„CITOVISO.” + ciános pont szöveges jelet vitte. A megkereső levél kontraktusa
(`assets/design-refs/console/outreach-mail/README.md` §2.2) is még a szöveges jelet írta elő.

## Elvégezve
- `bandBrand()` a `src/email/platformLayout.ts`-ben: ugyanaz a `citoviso-logo-email.png`
  CID-inline, 128×28 (a vékony sávba), + a melléklet. A szöveges jel csak a hiányzó PNG
  tartaléka.
- Erre áll a megkereső (`outreachEmail.ts`), a forgalmi (`trafficEmail.ts`) és a programajánló
  (`programsEmail.ts`) levél. A konzol megkereső-előnézete a logót data: URI-val mutatja.
- A README §2.2 átírva az E4-re.
- Ellenőrzés: mindhárom levél 390 px-en és asztalin lerenderelve és megnézve; outlook-lint,
  email-guard, outreach-preview és a land kapusora zöld.
- **Valódi SMTP-próba** a tulaj Gmailjébe, CSAK az ő címére, a prospect-sorokhoz nem nyúlva:
  Éden üdülőház (nyitókép nélkül) + Villa Suzy Zamárdi (logó + nyitókép) — mindkettő a
  Beérkezőkbe érkezett.

## Módosított fájlok
`src/email/platformLayout.ts` · `src/email/outreachEmail.ts` · `src/email/trafficEmail.ts` ·
`src/email/programsEmail.ts` · a konzol szerver (email-preview útvonal) ·
`assets/design-refs/console/outreach-mail/README.md`

## Nyitott
- A dev gépen hiányzik az Éden üdülőház terv-fájlja (`mock-eden-udulohaz-arch-frames-132282ba.html`)
  → az `ensureHeroShot` `no-mock-file`-t ad, a levél nyitókép nélkül menne. Az éles példány a
  képernyőkép szerint hibátlan; a dev hiány csak dev-adat.
- Nincs élesítve (a nagy deployjal megy).
