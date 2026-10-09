# 2026-10-09 — Valós oldal erőforrásigénye (mérés) + ingyenes próba koordinátor indítva

Brief: `~/rc-briefs/ingyenes-opci-20261009-080043.md` (tulaj: 0 előfizetés ~200 kiküldésből, az okát nem tudjuk;
mérjük fel egy VALÓS oldal API-költségét és tárhelyét, mielőtt a 2 hetes ingyenes próba vonalán továbbmegyünk).

## Elvégezve
- **Felmérés landolva:** `_planning/RESEARCH-2026-10-valos-oldal-eroforrasigeny.md` (`508fe8d4`). Minden szám mért:
  - valós oldal 2,5–3 MB (250 KB HTML + 10–12 fotó × 200–240 KB), max 6,1 MB; a 10,6 MB-os legacy oldal a 09-27-i
    normalizálóval 1,77 MB lenne; 30 GB szabad → ~10 000 oldal; az ADR-0024-es 10 MB/tenant becslés felülmért.
  - API: convertLead $0; az egyetlen per-oldal AI a többnyelvű modul (fizetés után fut), valódi hívással mérve
    **$0,0223/nyelv/oldal**; `language_pack` globális; per-látogató AI nincs; az utolsó 356 mock $0,00 (kurátori út).
  - ⇒ a 2 hetes próba gépi önköltsége ≈ 0; a valódi erőforrás operátori idő (nem mérve).
  - Éles tölcsér: 177 kiküldve → 60 megnyitotta (34%) → 5 panel_open → 1 checkout → 0 order_intent. A fal a panel ELŐTT.
  - 5 `outreach_reply` élesen: 2 meleg lead, 2 MA IS megválaszolatlan (+36 20 433 2780: „más szegmensnek is?" → IGEN).
  - Outreach-szemét: `_outreach-shots/_photos` 444 MB + PNG 141 MB = 3,1 MB/lead, takarítás nincs.
- **Tulaj-döntések:** ingyenes próba VAN; a próba alatt FULL funkció; hossz + kupon % a `/pricing`-on; visszamenőleges
  „ingyenes próba" levél a megkeresetteknek („kurva jó ötlet"); a „mindkét mock tabbal" (feat/multimocktabs) kérdésre később válaszol.
- **Koordinátor indítva:** „CIT ➕ Ingyenes próba — koordinátor", sid `f3e80964`, fa `~/wt/citf3e80964`,
  brief `~/rc-briefs/ingyenes-proba-koordinator-20261009.md` (6 SUB-os munkaterv A–F, levél-pontok, feltevések).
  SUB-jel leszedve (tulaj kérte koordinátorként): marker + PUT; a watchdog-state címe háttérben javítva.

## Feltevések a briefben (a koordinátor erősítteti meg a tulajjal)
- próba vége: LEFAGY (`frozen`), kártya előre nem kell; saját domain a próbában nincs (€15 + 12 hó hűség).

## Nyitott
- A 2 megválaszolatlan SMS-válasz (tulaj).
- A próba operátori idejének mérése (a felmérés hiányzó fele).
- Outreach fotó-cache/screenshot takarítás — mikortól.
- `feat/multimocktabs` rebase (649 commit lemaradás) — a tulaj válasza után, külön szál.
