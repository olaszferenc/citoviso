# 2026-11-08 — E-mail a Google-ből + jóváhagyó lap szűrők + egy terv elég (ADR-0433)

**Session:** `cit2ac35559` (brief `~/rc-briefs/email-nem-tal-ljuk-meg-20261108-210515.md`).

## Elvégzett munka
- **Ok:** a jóváhagyásra váró leadek ~2/3-ának nem volt e-mailje, mert a kontakt-futtató (`futtato.sh`) csak telefon ÉS e-mail nélküli leadet vett elő, és Binget/Brave-et használt, Google-t soha.
- **Új Google e-mail-kereső** (repón kívül): `~/rc-briefs/uj-lanc/kontakt/email-google.mjs` — „<név> <település> email” headless Google-találati oldalból, $0; biztos csak ha a cím a lead nevével + településével/telefonjával egy blokkban van; iker / több jelölt / MX nélkül → kétes, nem íródik be.
- **Beírás:** `eg-apply.sh` (cron */30, `apply.mjs --only data --go`, csak üres mezőbe, utána visszaolvas).
- **Keresés:** cron óránként `flock`-kal, `--pending --limit 400`. 11-09: a régi `pgrep -f` őr a cron saját parancssorára illeszkedett → egyszer sem indult; javítva. Ütem 40–80 mp (7–15 mp-nél a Google ~38 lekérdezés után IP-t tiltott).
- **Mérve:** 11-08 este 65 lead → 44 biztos; 11-09 10:27-ig 183 → 126 biztos (69%), captcha 0. 11-09 reggel 1226 jóváhagyásra váró volt e-mail nélkül.
- **Jóváhagyó lap szűrők:** „Messenger-ellenőrzés” (Ellenőrizve / Ellenőrzésre vár) és „Második terv” (Van / Nincs — egy tervvel megy) — `src/console/approvalQueue.ts`, súgó `kb/entries/console-approval/entry.hu.md`.
- **ADR-0433 (tulaj „A”):** a hiányzó második terv nem tartja vissza a kiküldést (1885 jóváhagyásból 1536-ot tartott vissza) — `src/outreach/autoDispatch.ts`, őr `scripts/dispatch-rooms-guard-check.mts`. Élesen a2f21838 óta (11-08 22:10).

## Állapot-ellenőrzés
```
cd ~/rc-briefs/uj-lanc/kontakt; tail out/eg-cron.log; tail out/eg-apply.log
```

## Nyitott
- **Tulaj 11-09 IGEN:** a Google e-mail-kereső fusson MINDEN e-mail nélküli leadre (ne csak a jóváhagyásra várókra), hogy a lead már e-maillel érkezzen a jóváhagyó lapra. Indítás: miután a jóváhagyásra várók elfogytak (~11-10 reggel), mert a Google csak lassú ütemet enged. Teendő: `email-google.mjs` új módja (pl. `--all-missing`, `qualification='no_site'` elöl) + cron; a régi `kontakt.mjs` Bing-ágát kiváltani.
