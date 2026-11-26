# 2026-11-26 — Riport ország-sáv minden fülön + bejövő üzenet országa és fordítása (Bábel)

**Brief:** `~/rc-briefs/report-20261126-070656.md` · **Fa:** `cit14106f0b` · **Döntés:** ADR-XXXX · **Terv:** `assets/design-refs/console/orszag-szuro-forditas/` (tulaj: 1.B · 2.B · 3 igen)

## Elvégezve
- Terv-kör (§2b): egy fájl, A/B változatok, mobil/asztali; tulaj-döntés 1.B (közös sáv), 2.B (fordítás + eredeti együtt), 3 igen (megkeresés + Poe javaslat is).
- Riport: közös `reportCountryStrip` mind a 8 fülön (Tölcsér, Viselkedés, Mock, Próba, Előfizetők, Tenantok, Lead-állomány, Kísérletek); `ctry` a fül-linkekben és a szűrő-űrlapokban; a kiválasztott chip a „Mind” után; Előfizetők országra = annak pénzneme. (SUB-ágens végezte, a főszál átnézte.)
- Válaszok: ISO-chip (`countryOfLeads`), `trText` (fordítás / halvány eredeti / „Bábel fordítja…”), lista-kivonat a fordításból, Bábel-űrlap csak a `babel` fióknak.
- Adat: migráció 0154 `outreach_reply_translation` (rész × célnyelv, source_hash); `src/replies/translation.ts`; `/api/replies/ingest` visszaadja a `needsTranslation`-t; `scripts/replies-collect.mts` Bábel-jegyet ír (`~/babel/beerkezo/*-forditas-*.md`), a meglévő `babel-watch.py` 10 percenként átadja.
- Bábel RUNBOOK §4d; súgó: console-dashboard + console-report* bejegyzések.
- Őrök: `scripts/reply-translation-check.mts` (scratch DB, 29/29, `--shot` képpel), `scripts/country-reports-e2e.mts` ⑥ (20 pont).

## Nyitott
- Élesítéskor: a 0154 migráció; Bábel Chrome-ja belépve az éles konzolra a `babel` fiókkal (a fiók létezik).
- Lead-állomány cellái a `/leads?stock=` listára mutatnak, ami nem ismeri az országot (szűretlen lista nyílik).
- Kísérletek: a napi keret és a futó változatok száma globális marad.
- A dev DB-ben egy `_mkt_check XF` teszt-ország-sor látszik a sávon (dev-szemét, élesen nincs).
- Súgó-képek a sávval még nincsenek frissítve; a súgó-szöveget Bábel fordítja.
