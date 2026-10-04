# 2026-10-04 — Névből növő B: húzható 4:3 Képek-sáv, Foglalás-kártya a Képek után, nagyobb és lassabb nyitány

**Szál:** SUB a CIT koordinátor („mock-összehasonlító / Kapunyitás”) alatt; brief `~/rc-briefs/nevbol-novo-kepek-naptar.md`.
**Tulaj-döntés:** „Névből növő B” (2026-10-04, a koordinátoron át). Kontraktus: `assets/design-refs/tenant-site/wordmark-grow-b/`.

## Elvégezve
- **Nyitány** (`src/engine/motion.ts`): a kinövő keret 14×18 → ~175×218 px (390 telefon; álló képernyőn a név két
  fele a keret fölött/alatt), 70×86 → ~245×306 px (1440 asztali). Kinövés 1,9 → 3,0 mp, a hős SAJÁT dobozába nő,
  a takaró áttűnik — korábban a teljes ablakra nőtt, és a kisebb hős-dobozba ugrott (ez volt a „túl gyors”).
  Teljes nyitány ~7,0 → ~8,7 mp (ADR-0115 nyitott kérdése a hosszról ezzel élesebb).
- **Képek** (`wordmarkGrow.ts`): a kártyapakli helyén egy sor 4:3 kártya a közös `data-cit-gstrip` runtime-mal —
  asztalon 3 egyszerre, 860 px alatt 86% + kilógó. A `gallery-cap` wordmark-pontja FELÜLÍRVA.
- **Foglalás:** a „cta” sáv (foglalási felület esetén) a Képek után, kártyaként; a naptár a lap végén marad.
- **Őr:** `gallery-reach-check` — wordmark-grow a sáv-sablonok közt + „asztalon 3 kép” állítás.

## Lelet, NEM javítva (brief szerint)
A közös foglalás-sáv stílusa (`ENQUIRY_BAR_CSS`, primitives.ts) csak a régi sablonokba kerül; az **arch-frames** és a
**tilted-gallery** sávja ugyanúgy formázatlan, bal szélre tapadó. A B megoldás CSS-e a wordmark-grow SAJÁT CSS-ében él,
ezért azokra nem hat.

## Nyitva
- A runtime `mountGalleryDeck` (pakli) most már egyik sablon sem használja — holt kód, külön döntéssel törölhető.
