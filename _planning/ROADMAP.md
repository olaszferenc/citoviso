# Citoviso — Fejlesztési ROADMAP (jóváhagyott)

Utolsó frissítés: 2026-07-05
Státusz: **Fázis 1 ✅ + Fázis 2 ✅ KÉSZ. Következő: Fázis 3 (architektúra).**

---

## ⭐ KERESZT-METSZŐ ALAPELVEK (minden fázisra, minden fejlesztésnél kötelező)

**A1 — Automatizálás-elsőbbség.** Az automatizáció az egyik fő ÉRTÉKAJÁNLATUNK; a tömeghatás miatt
értéket csak automatizált folyamaton át adhatunk. Minden folyamatot be KELL sorolni:
*Automatizált (agent/rendszer — cél) / Manuális→tenant (a tulaj feladata) / Manuális→ház (Operátor/Kurátor).*
Minden manuális pontnál KÖTELEZŐ kérdés + feljegyzés: **hogyan tehető később automatizálttá?**

**A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban.** Az ember sosem a fősodorban áll (az automata),
csak a bizonytalan/kockázatos kivételeknél; a fősodor betanulásával az emberi lefedettség csökken.
(Kuráció, pénzügyi felügyelet, support — lásd Fázis 1b.)

**A3 — Nyelv ≠ korlát; AI-vezérelt, kontextus-alapú lokalizáció.** A tartalmi szöveget AI fordítja kontextus-alapon
(nem hardcoded string-tábla, hanem nyelv-független forrás + AI-generált cache-elt variáns; felületek: Site/admin/outreach).
⚠️ Határ: **jog + formátum + pénznem = determinisztikus, ország-szabály** (NEM fordító-AI-ra bízva).

---

> A teljes fejlesztési folyamat fő fázisai. A tulaj jóváhagyta a sorrendet (2026-07-04).
> Elv: a magot NEM a semmiből absztraháljuk, de nem is egy iparágból — a Fázis 1 iparág-független
> vázat rak le, a Fázis 2 azonnal ütközteti 1-2 iparággal (absztrakt-először + konkrétból-desztillált ötvözet).

## Fázisok

- **0. Üzleti alapmodell — ✅ KÉSZ.** Jóváhagyva, mentve: `_planning/memory/2026-07-04_business_model_understanding.md`.

- **1. Rendszer-anatómia — a „mag" fogalmi terve (iparág-FÜGGETLEN) — ✅ KÉSZ.**
  Kimenet: `2026-07-04_phase1_system_anatomy.md`. Fő eredmények:
  - **1a. Aktorok** ✅ — 7 szereplő; kötelező tenant-izoláció; vendég = nem üzleti aktorunk; cégnyilvántartás mint forrás.
  - **1b. Tölcsér-gerinc** ✅ — 8 állomás; ⭐ INVARIÁNS: *kivétel-alapú, önmagát visszavonó ember a hurokban*.
  - **1c. Fogalmak** ✅ — szótár; ⭐ **Iparág × Ország kétdimenziós motor**; ⭐ meta-domain mindig marad → aggregátor/portál vektor.
  - **1d. Moduláris kompozíció** ✅ — taxonómia (univerzális / iparág-spec. / ország-függő / tenant-belső) + minimum→szofisztikált lépcső; à la carte.

- **2. Az absztrakció próbája 1-2 konkrét iparággal — ✅ KÉSZ.**
  Kimenet: `2026-07-05_phase2_industry_validation.md`. ⭐⭐ KONKLÚZIÓ: mind a 4 réteg (ügyfélút, ügyvitel,
  adat-séma, modulkészlet) közös magot mutat + specializáció **3 becsatlakozási ponton: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ**.
  Egy Iparág-definíció = e 3 interfész implementálása. Tézis (iparág-független mag) IGAZOLVA két valós iparágon.

- **3. Architektúra & technológiai alapdöntések (enterprise-réteg) — ⏳ KÖVETKEZŐ.**
  Fő bemenet Fázis 2-ből: a **Kínálat/Elérhetőség/Konverzió hármas** = definíció-vezérelt „csatlakozó", minden más közös.
  Multi-tenancy, adatmodell (**fix mag + rugalmas attribútum-réteg**), **tenant-izoláció** (saját store/honlap),
  temporal/audit, i18n (A3), hosting több százezer oldalhoz, AI-agent-orchestráció, security, stack-döntések.

- **4. Vertikális MVP — első működő end-to-end szelet.** ⏳ Egy iparág, egy piac, a teljes tölcsér kicsiben, a valódi magra.

- **5. Éles pilot — első valós ügyfelek.** ⏳ Valós lead → megkeresés → fizetés → élő oldal. A humán-pontok éles feltérképezése.

- **6. Skálázás & bővítés.** ⏳ Több iparág/piac, i18n, enterprise-réteg kiteljesítés, humán-pontok automatizálása,
  a pénzügyi/értékesítési konstrukció véglegesítése (éles adatokkal).

## Jelenlegi belépőpont a folytatáshoz
**Fázis 3 indítása (architektúra).** Kiindulás: a 3 becsatlakozási pont (Kínálat/Elérhetőség/Konverzió) mint
definíció-vezérelt csatlakozó. Első témák: adatmodell (fix mag + rugalmas attribútum-réteg) és a tenant-izoláció
megvalósítása több százezres léptékben. Kimenetek eddig: `2026-07-04_phase1_system_anatomy.md`,
`2026-07-05_phase2_industry_validation.md`.
