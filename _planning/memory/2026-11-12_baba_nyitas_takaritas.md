# 2026-11-12 — „Babával is várjuk” le a mockok nyitórészéből

**Session:** `cit6a02c689` · brief `~/rc-briefs/bab-val-is-v-rjuk-20261112-142043.md` (tulaj, Vali vendégház képernyőképe)

## Mi volt
436 nem elutasított éles mockban baba/kisgyermek-szöveg állt a nyitórészben (308 főcím, 198 alcím, 215 bemutatkozó első mondat), jellemzően „…, babával érkezőknek is”.

## Gyökérok
- `~/rc-briefs/uj-lanc/fo-terv/rules.md` §5 példája: `kiságy → „babával érkezőknek is”`.
- `~/poe/stilus.md` 12. sora jóváhagyott mintaként tanította.

## Javítás
- Lánc: a példa kivéve, tiltó blokk a `rules.md`-ben, `stilus.md` felülírva; `write.py`: `BABY_RE` + `opening_baby()`, egy javító kör, utána HIBA (azonnal él).
- Repó (`d652c13d`, landolva): `lyricOpening.ts` `baba_nyitas` + `babyOpening`/`firstSentence`; `copyCurator.ts` hibát ad; `guestCritic.ts` blokkoló; esetek a `lyric-opening-check` és `copy-curator-check` kapukban.
- Éles adat (tulaj „szedjük le”): 436 mock — végződés gépi levágása, 333 alcím/intro előfizetéses átírása új tény nélkül, a „Babával érkezőknek is” slogan-kiemelés levéve, újrarenderelés ugyanazon a linken. Mentés: `/opt/citoviso/backups/baba-nyitas-20261112-*/`. Utóellenőrzés: 0/0/0.

## Szándékosan maradt
Valódi felszereltség-kiemelések („Kiságy és etetőszék”), az intro későbbi mondatai, Relax Apartman, Platán.

## Nyitott
- A repó-őr élesítése a következő deployjal.
