## ADR-XXXX — A lefotózott portál-molinó elérhetőséggel reklám; csak a sign_map-ítéleteket kérdezzük újra

**Dátum:** 2026-10-14 · **Kontextus:** éles végigteszt, Elek-foglaló F-3. **Tulaj-döntés:** „B” (a koordinátoron át, 2026-10-14). **Kiterjeszti:** a képszűrő `ad_banner` szabályát (heroPick, v2-adbanner / v3-watermark).

### Kiváltó
A teszt-boglarka galériájában egy Google-fotó a valódi szállás szallas.hu-molinóját mutatta, rajta a tulaj telefonszámával és gmail-címével, valamint a „www.szallas.hu” felirattal. A képszűrő `sign_map`-nek ítélte, 5 ponttal. Nyitókép így nem lett belőle, de a galériában maradt, mert onnan csak az `ad_banner` esik ki. A régi szabály csak a képre *ráégetett* szöveget tekintette reklámnak, a lefényképezett táblát pedig „a szállás saját táblájaként” kivette.

### Döntés
1. **A prompt v4-contactbanner:** ha egy lefényképezett tábla, molinó, plakát vagy szórólap a kép fő eleme, és rajta foglalási portál neve, webcím, telefonszám vagy e-mail olvasható, akkor `ad_banner`, és kiesik. A puszta névtábla vagy cégér (csak a név, elérhetőség és portál nélkül) továbbra is `sign_map` vagy `exterior`.
2. **„B” — újrapontozás csak a sign_map-ekre:** a v3-as ítéletek érvényesek maradnak, kivéve a `sign_map`-eket (`acceptsCachedVerdict`). Élesen 16 727 ítélet van, ebből 277 `sign_map`. A teljes újrapontozás kb. 25 USD lett volna, ez kb. 0,4 USD. Az új generálás a régi `sign_map`-eket magától újrakérdezi.
3. **Az újrapontozó az eredeti URL-lel hív.** A cache `url_key`-e kisbetűsített, a Google-fotók azonosítója viszont kis- és nagybetűre érzékeny. Az eredeti URL-eket a `mock_artifact.inputs` és a `site.edited_site_data` fotólistáiból keresi ki.

### Deploy után (sorrendben)
1. `npx tsx scripts/rescore-photo-verdicts.mts --sign-map`: száraz futás, kiírja a darabszámot.
2. `npx tsx scripts/rescore-photo-verdicts.mts --sign-map --go`: éles futás, fizetős vision-hívással.
3. A tenant-oldalak újrarenderelése: az `editor.ts` a renderkor a gyorsítótárból szűr, így a molinó az élő lapokról is lekerül.

### Mérés (dev, élő vision-hívás)
- A molinó: v3 szerint `sign_map`, 5 pont; v4 szerint `ad_banner`, 0 pont.
- Ugyanennek a galériának a másik 5 képe változatlan maradt.
- Negatív kontroll: egy szállás saját névtáblája (apartman.hu) `sign_map` maradt.

### Őr
`scripts/hero-contact-banner-check.mts` (elfogadási szabály, prompt-szabály, az újrapontozó módja). A `watermark-gate-check` a v4-et várja.

### Visszafordíthatóság
🔄 könnyű. Séma nem változott. A v3 → v4 átírás soronként felülírja az ítéletet; visszaállításhoz a verziót kell visszaírni.
