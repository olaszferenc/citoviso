# 2026-10-02 — A1: aggregátor-oldal mint „saját modern honlap” — ~640 lead téves besorolása

**Szál:** SUB a CIT „élesi teszt” koordinátor alatt; brief `~/rc-briefs/javitas-elek-0930/a1-aggregator-besorolas.md`. Döntés: ADR-XXXX.

## Elvégezve
- Mérés élesen (csak olvasás): a `lead.qualification` ← `qualificationOf(raw.websiteStatus)` ← `classifyWebsite(raw.website)`;
  a levél szegmense ← `prospect.segment` (másolat a link létrehozásakor). 640 lead váltana (612 modern→no_site, 27 outdated→no_site,
  1 activation kézi — a [TESZT] Muschel); élesen 1 prospect érintett, az is kiküldött → nem változik.
- `src/scraper/qualify.ts` `PORTAL_DOMAINS` +~50 aggregátor/portál/aldomain-farm/könyvtár (mért éles hostok).
- `scripts/requalify-websites.mts`: átmenet- és host-összesítő, ismeretlen kapcsoló = exit 2, a ki nem küldött link auto-szegmense
  követi a leadet (tranzakcióban). Dev-en `--apply`: 34 lead.
- Őr `scripts/aggregator-host-check.mts` + pre-commit bekötés; 3 mutáció piros.
- Levél visszamérve 3 dev-leaden (bluepillow / hotels-in-hungary / fewo-direkt): előtte „A mostani honlapját is megnéztük.” /
  „…nem tudtuk megnyitni…”, utána mindháromnál „Saját honlapot viszont nem találtunk.”

## Nyitott
- ÉLES újrabesorolás: `cd /opt/citoviso/app && npx tsx scripts/requalify-websites.mts` (száraz) → tulaj-engedéllyel `--apply` —
  CSAK a kód élesítése UTÁN (a régi éles kód nem ismeri a hostokat). Várható: ~640 lead.
- Kétes, NEM listázott hostok (tulaj/koordinátor dönthet): hotel.hu / hotelizator.com aldomainek, siofokszallas.info (5 lead
  ugyanarra a gyökérre), marcaliszallas.hu, balatonhost.com, humtour.com, visty.site, tinyurl.com, drive.google.com.
- A `portal_only` aggregátor-link még nem portál-FOTÓFORRÁS (nincs adapter a regiszterben; a bluepillow/vio linkek keresés-redirectek).
