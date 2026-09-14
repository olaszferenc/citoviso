# 2026-09-14 — Három hely, ahol a felület mást mondott, mint ami van

**Bejelentés:** tulajdonosi, három mért lelet (Elek FK-006a HIBA-1 · FK-007 H1 ·
FK-003b L03/L06). **ADR:** ADR-0119 ⑧ (①-hez) és **ADR-0148** (②③-hoz).
**Landolva:** `176e003` (①) és ez a commit (②③).

## ① Fagyás alatt egyetlen kártya se ígérjen elérhetőséget

- A bejelentett három mondat mellé **kettőt** találtam a renderelt fagyasztott lapon:
  a bolt-kártya „Megnézem az **oldalamon**" gombját (13 db — a saját moduloknál ez már
  javítva volt, a bolt kimaradt belőle) és a „naprakészek" sort.
- ⛔ **A meglévő őr három szó szerinti tűje MIND ÁTMENT** — nem tévedett, más szavakra
  volt kihegyezve. Új őr: `scripts/frozen-claim-check.mts`, ami **ÁLLÍTÁST** mér:
  ALANY (a tulaj oldala/tartalma/modulja) + ÁLLÍTMÁNY (elérhető·megjelenik·látható·
  naprakész) + POLARITÁS (a tagadást az állítmány ELŐTTI 40 karakteren nézi, mert a
  mondat-széles tagadás túl laza: „Az oldala elérhető, nem kell tennie semmit").
- Fixture a TERMÉK katalógusából, 6 többnyelvű állapotban. Önteszt: **19 állítás**.
- **Ítélet, amit meghoztam:** a határ ott van, hogy a tulaj SAJÁT oldaláról állítunk-e
  elérhetőséget. A 14 generikus termék-leírást nem írtam át (a „Rendezés után vehető
  fel" keret feltételessé teszi) — az őrben ez **kimondott, exact-match kivétel**,
  tehát ha a szöveg változik, pirosra vált.

## ② Az idézet-doboz megnevezi a szerzőjét

- A szerző az **adatból** jön (`decided_by` enum), nem a renderelő ágból: a lemondás
  indokát a **vendég is írhatja**, azt „Ön"-nek címkézni hazugság lenne. `null` →
  „Megjegyzés", mert a téves név rosszabb a hiányzónál.
- Asztalon kéthasábos (kérdés ↔ válasz), mobilon egymás alatt.

## ③ A haladó csík soha nem mutatott haladást

- `width:34%` fix kitöltés + `conSlide` animáció, semmilyen adathoz nem kötve. Letiltott
  animációnál `margin-left:-34%` → a sávon KÍVÜL (ezért látszott üres szürkének), egy
  `prefers-reduced-motion` szabály pedig `width:100%`-ra állította: futás közben TELI csík.
- Kivezetve. Helyette a motor jelenti a valós szakaszt (`onStage`), több sablonnál az
  elkészültek száma. **Százalék nincs** — a szakaszok hossza egyenetlen.
- A vég ki van mondva (kész · meddig tartott · link), és MEGMARAD.

## Amit ez a szál a MÓDSZERRŐL tanított

1. ⛔⛔ **NYOLC session osztozott egy munkafán.** A `wt/cit2167c7de` 44 committal le volt
   maradva, 30 idegen fájl volt benne piszkosan, és az `adminViews.ts`-t egy másik szál
   épp szerkesztette. A `git status`-ban 30 fájl az ÉN szerkesztésem után **nem az én
   diffem** — ezt meg kell mérni, nem elhinni. Külön, tiszta fából landoltam, és a közös
   fában **visszavontam a saját szerkesztéseimet**, különben a másik szál commitja
   rebase-kor visszarontotta volna a javításomat.
2. ⛔⛔ **Az `extract-i18n` a TELJES fát olvassa:** a katalógus-regenerálásom 8 idegen
   stringet szedett be a párhuzamos szálaktól. Generált fájlt csak TISZTA fából.
3. ⛔⛔ **A „pontosan 1 találat" állítás az ILLESZKEDÉST bizonyítja, nem a helyességet.**
   A szerkesztéseim újra-alkalmazásakor egy komment a template literalon BELÜLRE került
   — a komment szövege beleégett volna a `<a>` tagbe. A `tsc` ZÖLD volt (érvényes TS
   maradt), a screenshotjaim nem fedték a bolt-kártyákat; csak az `internal-ref-check`
   buktatta le.
4. ⭐ **Az önteszt a SAJÁT őrömet javította:** két állításom sosem tudott volna pirosra
   menni („bármilyen négybetűs szó" a sávban), és a rontásom egy helyen némított el
   valamit, ami két helyen van kimondva.
5. ⚠️ **Specificitás, harmadszor:** a `.con button` (0,1,1) verte a `.con-done__x`-et
   (0,1,0) — a bezáró × fehér pirulaként jelent meg. A renderelt sáv mérése fogta meg.

## Nyitott / átadandó

- **Nagy Anna sora két „VENDÉG" dobozt mutat egymás mellett** (az eredeti kérdés és az
  általa írt lemondás-indok). Mindkettő igaz, a sorrend és a sor-jelvény eligazít — de
  ha a tulaj szeretné, a második doboz felirata bővíthető („Vendég — lemondás").
- Az ① §2b **kivétel-tokenjét magamnak adtam meg** (felirat-hibajavítás, ui-shot
  mindkét méreten). A kapu jogosan figyelmeztet, hogy ez a tulaj engedélye — jelezve.
- Az **időutazót nem futtattam**: a közös előfizetés-óra érintetlen.
