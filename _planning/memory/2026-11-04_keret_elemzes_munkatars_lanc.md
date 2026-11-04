# Keret-elemzés: hová megy a token, és a munkatárs-lánc egyszerűsítése (2026-11-03/04)

Session: CIT `citf1f3528f`, brief `~/rc-briefs/el-fizet-s-20261103-210427.md` (tulaj-kérdések). Kód nem változott.

## Elvégzett munka
- Mérés (éles SELECT + pipemeter): mock ~90k be / ~5k ki token, 9 hívás, $0,51 (AI-úton); 30 nap alatt csak 50 AI-mock ($25), mert a kurátori (Poe) úton a generátor nem hív AI-t. Munkatársak: heti ~$1 586 API-egyenérték (~70% keret), ~$7 / kiküldés. Megnyitás: 193/691 (28%). Mind az öt munkatárs Opus 5.5-ön.
- Tulaj-döntések rögzítve (MEMORY.md „Tények és döntések”): API-token nem opció; munkatárs-munka nem megy vissza kódba (a kód katasztrofális volt); munkatárs nem megy kisebb modellre (Haiku/Sonnet rossz volt); helyi/bérelt GPU nem irány; Batch API a mockra nem éri meg (~$12/hó).
- Átfedés-térkép a láncban (Magellan→Neo→Poe→Vera→-bb) és javaslat: -bb → Vera (1 hét átfedés), dupla ellenőrzések le, képátnézés Veránál. Tulaj jóváhagyta a próbát; átadva a Koordinátornak (`cita291565c`), brief `~/rc-briefs/munkatars-osszevonas-20261104.md`.

## Módosított fájlok
- `MEMORY.md` (Tények és döntések, 11-03/04 sorok)
- `_planning/memory/2026-11-04_keret_elemzes_munkatars_lanc.md` (ez)
- fán kívül: `~/rc-briefs/munkatars-osszevonas-20261104.md`, auto-memória `feedback_no_api_token_proposals.md`

## Nyitott
- A -bb végleges leállítása: tulaj-döntés az átfedéses hét mérése után (Koordinátor hozza).
- A munkatársak keretének tételes mérése (kép / szöveg / újraolvasott kontextus leadenként) — felajánlva, nem kérték.
- 2026-11-04: GitHub SSH időszakosan „Permission denied (publickey)” ezen a gépen.
