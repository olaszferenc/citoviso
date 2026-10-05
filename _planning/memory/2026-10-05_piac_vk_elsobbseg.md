# 2026-10-05 — Piac-kapu a Vendég-kritikusnak alárendelve (SUB, Poe-pilot 1–2. ügy)

**Brief:** `~/rc-briefs/piac-vk-precedence-20261005.md` · **ADR:** ADR-0328 (`_planning/decisions/XXXX-piac-kapu-a-vendeg-kritikusnak-alarendelve.md`)
· **Tulaj-döntés:** vékony forrásnál a VK (tényhűség) nyer.

## Elvégezve
- `descriptionSellingPoints` szóegyezés helyett tagmondat-szintű ÁLLÍTÁST kér (`proseAffirms`): tagadás,
  idő-névutó („reggeli után”), név-rész („Kertekből”), szó-belseji egyezés („állatkert”), közeli kilátás
  („kilátással a kertre”), ≥1 km távolság → nem tény. Ugyanez a bíró `isSourcedMiss`-ében; tagadott lista-tétel súlya 0.
- `subordinateToCritic` / `subordinateToCriticInputs`: a VK forrás-alapú kifogása kiveszi a tételt a Piac `missed`
  listájából; a csak-hiányra épülő Piac-FLAG (új `demand` mező) PASS lesz, ha nem marad tétel. Bekötve:
  `generateEngine`, `recopy`, `copyManual` (a VK után).
- Élesen mérve (csak olvasva) a 4 pilot-lead leírásán: Csopak Strand,Reggeli,Parkoló,Garázs → Strand,Parkoló;
  Betérő Kert → —; Gólyásház Strand,Panoráma kiesett; Noémi Strand (700 m) + Klíma megmaradt.

## Módosított fájlok
- `src/generator/marketCheck.ts`, `src/generator/generateEngine.ts`, `src/generator/recopy.ts`, `src/generator/copyManual.ts`
- `scripts/market-vk-precedence-check.mts` (új őr, 27 zöld, önteszt piros), `hooks/pre-commit`
- `_planning/decisions/XXXX-piac-kapu-a-vendeg-kritikusnak-alarendelve.md`

## Nyitott
- A VK nem-determinisztikussága (`~/poe/ugyek.md` 10.) — külön ügy. Élesre csak a nagy deployjal.
