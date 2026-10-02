# 2026-10-02 — A1: aggregátor-oldal mint „saját modern honlap” — ~640 lead téves besorolása

**Szál:** SUB a CIT „élesi teszt” koordinátor alatt; brief `~/rc-briefs/javitas-elek-0930/a1-aggregator-besorolas.md`. Döntés: ADR-0307.

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
  CSAK a kód élesítése UTÁN (a régi éles kód nem ismeri a hostokat). Várható: 667 lead (621 modern→no_site, 45 outdated→no_site, 1 activation kézi).
- ✅ Kétes hostok MÉRÉSSEL eldöntve (koordinátor szabálya, 2. kör): portál: siofokszallas.info, visty.site, balatonhost.com, tinyurl
  (→ booking.com); none: drive.google.com; saját: hotelizator.com, marcaliszallas.hu, humtour.com, hotel.hu. Az (a) szabály CSAK
  jelöl (kb. 25 lánc/több egységes saját oldal hamis találat lenne) → `sharedHostCandidates()`, a (b) dönt. Éles: 662 lead (+22).
- ✅ A maradék 35 (a)-jelölt lemérve (3. kör): portál 4 (balatonakali, marcali, zenefalu — útvonal-szűkítve; vonyarcvashegy — host),
  saját 30 (lánc/intézmény/több egységes tulaj) → `MEASURED_OWN_HOSTS`. Éles: 667 lead (+5). A-jelölt: 0. ADR-0307 2. kiegészítés.
- A `portal_only` aggregátor-link még nem portál-FOTÓFORRÁS (nincs adapter a regiszterben; a bluepillow/vio linkek keresés-redirectek).
