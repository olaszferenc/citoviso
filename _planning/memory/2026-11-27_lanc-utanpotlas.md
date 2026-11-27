# 2026-11-27 — Lánc-utánpótlás: régi mock újragenerálása, sor nélküli kész mock, render-kapu újrapróba, párhuzamos kapu, kontraszt, félkész elöl, egyedi szakaszcím

SUB `citf2359c67`, koordinátor `cit96bd8170`, brief `~/rc-briefs/lanc-utanpotlas-20261127.md` (+ a koordinátor 5–9. pontja), ADR-0500 (`_planning/decisions/*-lanc-utanpotlas-ujrageneralas-ujraproba.md`). Élesen NINCS (a koordinátor viszi ki, tulaj-engedéllyel).

## Elvégezve
- ① `src/generator/chainSupply.ts` `regenerateOldQueue`: a régi generátoros várakozó sor mindkét terve a saját kurátori szövegéből (copyManual) újragenerálódik, 0 API. Approved + Vera-PASS csak bájtra azonos copyHash mellett száll át. A régi tervek `superseded_by` rejected-ek. Ha mindkét terv azonos sablonú lenne (kép és településkép nélkül), vagy a generálás hibára fut: a sor okkal tartva.
- ③ `enqueueReadyWithoutRow`: az approved + Vera-PASS-os, sor nélküli mock sort kap (`enqueueDispatch` kizárásai, saját-honlap kapu), tartva, „gépi kapura vár”. TARTVA/KL nem kerül sorba.
- ⑤ `retryFailedQueue` / `retryPlanFor`: a findings-kódok szerint előbb képkiosztás a megnevezett képek nélkül (a településképnél a település mai készletéből), utána a másik sablon, végül tartás (`render-kapu: az automata újrapróba kimerült —`). Leadenként legfeljebb 4 próba, tervenként 2 képes. A kapu a kép-leletekhez URL-t is ír.
- Időzítő: `scripts/chain-supply.mts tick`, `citoviso-chain-supply.{service,timer}` 5 percenként, CPUWeight=10, Nice=15. Leállítás: `CHAIN_SUPPLY=off`.
- ④ `regateStaleQueue`: közös böngésző, mérésenként saját context, párhuzamosság alapból 2, a szabad memória fékezi (`RENDER_GATE_CONCURRENCY`, `REGATE_MIN_FREE_MB` 700, 350 MB/mérés), terhelés nem.
- ⑦ Kontraszt: a `palette.bandTokens` + `readableOn` tokenek (`renderSkinVars`), a Parallax sávjai, a Névből növő gomb-öröklése, a „Minta” címke. A kapu `contrast` kódja a ragadós sávon és a h1/h2/gombon, lapközépen is. A kapu verziója 16.
- ⑧ `HALF_DONE_SQL` a `FAIR_ORDER`-en belül (országonként). A frissítés és a kapu elől a globális kolléga-pass kulcs kikerült.
- ⑨ `render.withUniqueSectionHeadings` (közös befejező lépés) + a kapu azonos-h2 szabálya.
- Mellékes: a kapu mérőszkriptjében a `\s` → `\\s` (a „s” betű eltűnt a mért címekből), és a `photoKind.withBestHeroFirst` fitsHero-tartaléka.
- Bélyeg: `MOCK_HEROFIX_STAMP = "2026-11-27-supply1"` (a koordinátor `headings1`-e után).

## Mérések
Lásd az ADR „Mérve” szakaszát. Röviden: ① 15/24 jó, 9/24 tartva (egytervű kép nélkül), 0 API. ④ 254 → 581 → 732 terv/óra (1/2/3 párhuzamosan, 2 magon). ⑤ 8/21 bukott terv lett pass. ⑦ Jaja/Hullám 1,23:1 → pass. ⑨ 2/40 élesben.

## Nyitott (a koordinátornak)
- A `lanc.sh` `cand.sql` minden ÚJ (fő, 2.) tervpárt újraküld az egylépéses átnézőhöz, akkor is, ha az approved + Vera-PASS bájtra azonos szöveggel átjött. Becslés: ~1240 ajánlat × $0,28 ≈ $350 API-egyenérték ≈ a B-fiók heti keretének 25%-a. Javaslat: a `cand.sql` hagyja ki a párt, ha mindkét terven a mai szövegre szóló Vera-PASS ül. Ekkor csak a ~660 átvinni nem tudott 2. terv megy (≈ $185, ~13%).
- A KL 226: a levétel lefutott, a második átnézés 218/226-nál TARTVA lett. Ez csak a `kor.log`-ban van, a DB-ben nincs ok (a `tartva-sql.py` csak az első kört írja).
- A gyökérben 191 régi `mock-*.html` (nem ennek a sessionnek a fájljai) — a generált mockok a cwd-be kerülnek.

## Fájlok
src/generator/chainSupply.ts, src/generator/mockRefresh.ts, src/outreach/mockRenderGate.ts, src/outreach/mockPhotoGate.ts, src/engine/palette.ts, src/engine/skins.ts, src/engine/render.ts, src/engine/moduleSections.ts, src/engine/templates/parallax.ts, src/engine/templates/wordmarkGrow.ts, src/media/photoKind.ts, scripts/chain-supply.mts, scripts/chain-supply-check.mts, scripts/qa-review-check.mts, deploy/systemd/citoviso-chain-supply.service, deploy/systemd/citoviso-chain-supply.timer, deploy/systemd/targets.json, hooks/pre-commit, MEMORY.md, _planning/decisions/XXXX-lanc-utanpotlas-ujrageneralas-ujraproba.md

## ⑭ E-mail nélküli lead nem foglalja a láncot (2026-11-27 délelőtt, sürgős, külön land)
`LEAD_HAS_EMAIL_SQL` (mockQaReview.ts; raw.email + raw.otherEmails, a leadEmails forrása) a frissítés, a kapu, az újratervezés, az újragenerálás és az újrapróba előtt. A jóváhagyó lap csak e-mailes leadet listáz, a csatornája mindig e-mail. `syncNoEmailHolds` (mindkét időzítő): az e-mail nélküli lánc-sor a „TARTVA: e-mail-cím nélkül nem küldünk…” jegyzetre kerül, és amint e-mailje lesz, visszalép (gépi kapura vár). Scratch-mérés: 1569 sor került tartásba, idempotens, a visszalépés működik.

## 2. kör (10–13., 15–16. pont) — ADR-0503 „Feltöltés elhagyás helyett”
Dátumbélyeg sarok-OCR (sárgaság-csatorna, részleges alak a sarkon), a sávfelirat mondat, szoba csak végső nyitókép, sötét/fakó telefonos nyitóképernyő → következő jelölt, a felszereltség-modul mindig telt (standard készlet, MINTA), a Névből növő fotós hős-szövege fehér + a kapu a h1-et a képhez méri, eager térkép + üres-térkép lelet. Bélyeg supply2, kapu v18. Vak: 16/23 jó újrapróbával. ⑰ A Parallax mindig az egyik terv (újragenerálás, újrapróba, restoreParallaxQueue). Keret-szkript: `~/rc-briefs/uj-lanc-keret/keret-cand.sh check|go|rollback` (a go a koordinátoré; 7113 → 3353 jelölt). Képek: `assets/design-refs/_drafts/kor2/`.

## 3. kör (⑱ ⑳ ㉑ ㉒) — ADR-0505 „Mock 3. kör”
A szobablokk mindig áll (stock hálószoba a kép nélküli kártyán), a cím doboza a leghosszabb szóhoz igazodik (`--cit-hero-wmeasure`, `heroWordFit`), semleges „Galéria” cím 3 saját kép alatt, feliratos nyitókép (forgatott OCR: „A2(2+2)”) helyett a következő jelölt. A ⑲ (mondatos sáv fotó nélkül) a tulaj kérésére KIMARADT („2, ok”). Bélyeg supply3, kapu v19. Vak 12: 2 → 8/12. Következő körre: a településkép-tárból a „satellite photo” tiltása; a ⑲ csak valódi mondattal és akcentszínen.
