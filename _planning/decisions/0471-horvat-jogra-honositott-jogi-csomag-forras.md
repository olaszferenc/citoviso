## ADR-0471 — Horvát jogra honosított jogi csomag: forrás-variáns TERVEZETKÉNT, kikapcsolva

**Státusz:** JAVASLAT (tulaj 2026-11-23 „Mehet a jogi csomag” = a tervezet elkészítése; élesítés CSAK tulaj- és ügyvédi
jóváhagyás után; brief `hr-jogi-csomag-tervezet-20261123.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0458 (jogi csomag országonként), ADR-0110, ADR-0111 (piac-kapu), ADR-0056 (ÁSZF), ADR-0412 (csak Bábel fordít) ·
**Nem érinti:** a ma élő HR csomagot (ADR-0458: magyar szöveg Bábel-fordítása, hivatkozások nem honosítva) — az marad.

### Kiváltó
A mai HR csomag a magyar jogszabályokat nevezi horvátul (pl. „mađarske Vladine uredbe br. 45/2014.”, NAIH, Grt.).
Az ügyvédi álláspont (2026-11-18) szerint így használható, de a tulaj horvát jogra honosított változatot kért, amit ő és
az ügyvéd jóváhagyhat.

### Döntés (javaslat)
① **A variáns forrás-egység CSERE**, nem új dokumentum: `src/legalVariantHR.ts` `LEGAL_VARIANT_HR.units[]` —
`hu` = a mai HR-csomag egy forrás-egysége betűre (ahogy a `legalSources("HR")` felsorolja), `variant` = ugyanennek
horvát jogra írt változata, MAGYARUL (a forrás nyelve). A lapok szerkezete, a renderelők, az egység-felsorolás és a
bélyeg-mechanika változatlan. 18 egység cserélődik (a 227-ből), mindegyik hivatalos forrással (URL + dátum), a nyitott
pontok 8 ügyvédi kérdésként (`lawyerQuestions`), a szándékosan magyar maradó pontok `keepsHu` indoklással, a termékbeli
előfeltétel `prerequisite`-ként (ZZP 81.a online elállási funkció).
② **Kikapcsolva:** `enabled: false`, semmilyen élő modul nem importálja. Őr: `scripts/legal-variant-hr-check.mts`
(①–⑥: kikapcsolt, leválasztott, a mai forrásra illik, jelölés/helyőrző ép, nincs megmaradt magyar jogszabály a jelöletlen
egységekben, a mai HR csomag teljes és a lecserélt egységek élesen a véglegesített HR.json-t adják).
③ **Fordítás:** Bábel, külön munkalapon (`--export`), visszaút `src/i18n/babel/legal/variants/HR-HR.json` (az élő
betöltő ezt nem olvassa).
④ **Bekapcsolás (jóváhagyás UTÁN, külön land):** a `legalPack.ts` a HR csomag forrás-egységeit a variánssal képezi
(`legalSources` + `packFromFile` a `hu → variant` leképezéssel, CSAK `enabled` mellett), a `LEGAL_PACK_BASE` mellé a
bélyeg `HR/hr/aszf-<v>+tenant-<v>+var-HR-<n>` alakot kap; a csomag-teljesség a variáns fordításait kéri (hiány → kapu
zár, magyar fallback soha); a `legal-pack-e2e` HR-ága a variáns-szöveget méri. A HU csomag és a többi ország bájtra marad.

### Megfeleltetés és leltár
A tulajnak szóló összefoglaló (`assets/design-refs/_drafts/hr-jogi/index.html`, gitignore-olt; tartós másolat
`~/rc-briefs/hr-jogi-csomag-20261123/`) tartalmazza a megfeleltetési táblát és a teljes leltárt.
Kulcs-leletek (forrás: zakon.hr egységes szövegek, olvasva 2026-11-23; a hivatalos NN-szöveggel egyeztetendő):
- ZZP 86. (1) 1.: az elállás CSAK teljesen teljesített szolgáltatásnál zárul ki; előtte arányos díj (84. (8)) —
  a mai „az élesítés teljes teljesítés” mondat horvát jogon kétséges.
- ZZP 81.a (NN 59/26, 2026-06-17-től): kötelező online elállási funkció — termékfejlesztési előfeltétel.
- ZEK 50. (4): az előzetes hozzájárulás alól csak a jogi személy kivétel; ZET 8. + 4. (2) a magyar feladóra is vonatkozik
  → hideg megkeresés magánszállásadónak ügyvédi kérdés.
- ODR-platform 2025-07-20-án megszűnt ((EU) 2024/3228) — nem hivatkozunk rá.
- Zakon o računovodstvu ÚJ (NN 85/24): 11 év megőrzés a szállásadó bizonylataira (a tenant-adatkezelésben).
- Vendéglátási törvény 32. (2): kategória + adószám/közösségi adószám a hirdetésben; a mai `LEGAL_LOCAL.HR`
  „Kategorizálási határozat száma” kötelező mezőt a törvény nem nevezi → ügyvédi kérdés (élő kódot nem módosítottunk).

### Visszafordíthatóság
🔄 — egy új, leválasztott adatfájl és egy őr; törlésük semmit nem változtat.

### Nyitott
- A 8 ügyvédi kérdés (`LEGAL_VARIANT_HR.lawyerQuestions`).
- Csomagon kívüli magyar jogi elemek (nem a jogi csomag része, a variáns nem fedi): `src/outreach/escalationFollowup.ts:204`
  és `src/outreach/behaviorMessageCopy.ts:222` (levél jogi sora, UI-fordításon át), `src/outreach/experiment.ts:248`
  (panasz-minta: NAIH — horvát válaszhoz AZOP kellene), `src/server/adminViews.ts:6267` (tenant-admin figyelmeztetés a
  magyar e-ker. törvényt nevezi), operátori szövegek (`src/console/views.ts:8361`, `src/outreach/outreachCheck.ts:487`).
