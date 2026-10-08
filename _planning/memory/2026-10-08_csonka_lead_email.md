# 2026-10-08 — Csonka lead-e-mail (raw.email az eleje nélkül): két ok, javítás + őr ⑥

**Tünet (élesen, 4 lead):** `raw.email` = `amiliapizzeria@…`, `llaberekturistahaz@…`, `.bela@gmail.com`,
`.segelyezo@gmail.com`; a kontaktnaplóban (`raw.contacts`) a teljes cím is ott volt. Levél még nem ment ki.
A brief gyanúja („név-tisztító vág”) NEM igaz — mérve két külön ok:

1. **Brave-kivonat kiemelése** (`web_snippet`, 09-27-es leadek): a Brave `description` a lekérdezés szavait
   (= a lead nevét) `<strong>`-gal jelöli, a jelölés szó KÖZEPÉN is zárhat:
   `"…írj a hajas</strong>.bela@gmail.com címre"` (élő lekérdezéssel reprodukálva). Az e-mail-minta a `>` után
   indult → `.bela@gmail.com`. Innen a „név-szó” korreláció.
2. **Hibás OSM-tag** (10-08-as leadek): way/373597860 `contact:email=amiliapizzeria@familiapizzeria.hu`,
   way/1040377531 `email=llaberekturistahaz@gmail.com` — a forrás maga csonka; a honlap a teljeset mutatja.

**Javítás:**
- `src/scraper/sources/webSearch.ts` `braveText()`: inline jelölő-tag rés nélkül törlődik, entitás dekódolva.
- `src/scraper/enrichWebSearch.ts` `isBusinessEmail`: ponttal kezdődő/végződő vagy `..`-os local-part nem cím.
- `src/email/leadEmails.ts` `fullerEmail()` + `src/scraper/enrichContact.ts`: a felfedezési (OSM) cím helyett a
  honlap teljes alakja, és a csonk elutasítva a kontaktnaplóba kerül (eddig a felfedezési e-mail be sem került).
  ⚠️ A „szigorú utótag” ÖNMAGÁBAN NEM bizonyíték: élesen 18 utótag-párból 14 hamis volt (a hosszabb a szemét:
  `%20hello@`, `maito:`, `nligetapartments@`; vagy másik valódi fiók: `info.atriumagard@`, `reservations.budapest@`).
  Ezért csak akkor cserél, ha a csonk ponttal kezdődik, vagy a teljes local-part = a honlap domain-magja.
- Őr: `scripts/phone-normalize-check.mts` ⑥ (valódi Brave-kivonat, a 14 hamis pár is fixtúra, enrichContact-eset;
  mutációval piros, `--self-test` él); pre-commit trigger bővítve.

**Élesi adat:** a 4 lead `raw.email`-jét a koordinátor javította (mentés `/opt/citoviso/backups/email-csonka-20261008/`).
Utána mérve további érintett `raw.email` nincs; a kontaktnaplóban 3 elfogadott csonk-sor maradt
(6a3f24b8 `.bela@`, b197e4c0 `.segelyezo@`, 8f8a0035 `.+@globex.com`). Javító, idempotens SQL:
`scripts/fix-truncated-lead-email-20261008.sql` — élesen NEM futott (tulaj-engedély kell).
