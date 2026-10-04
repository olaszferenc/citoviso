# 2026-10-04 — Lírai nyitórész: a leltár-főcím és a leíró intro vége; a gyűjtési terület nem lead-tény (ADR-0324)

**Szál:** SUB (koordinátor: CIT „mock-összehasonlító / Kapunyitás”, `wt/citcad90429`), brief
`~/rc-briefs/vendegcsalogato-hos-szoveg.md`. Tulaj: „9/10 esetben ez van”, „sötétre pácolt???? komolyan????”,
„Lírai szöveg kell”, majd a javaslatra: „Nagyon szűken mehet. Adottságélményként. Vékony forrásnál akkor általánosítás
marad. Javítsuk Kerekerdő MOK-ot, és mehet a javaslat.”

## Mérés
- Az utolsó 50 mock főcíméből 49-et leltár vezetett (dev + éles, csak olvasva); leadenként 23/27. Az intro 16/27 leadnél
  felületet írt le (kézzel átnézve 16/16 valódi). Szabály: `assets/design-refs/_drafts/vendegcsalogato/classify.mjs`.
- Az ok négy helyen a MI kérésünk: a szövegíró 2. szabálya, a brief „1–3 tény a lista elejéről” (ADR-0097 ④), a piaci kapu 1b
  rétege (determinisztikusan buktatta a szolgáltatás nélküli főcímet), a kritikus újraírója; az intro sémája a fotók leírását kérte.
- A/B kísérlet (csak prompt, 1,27 USD): a lírai prompt önmagában 3/5-ben nyújtott forrást (egy vendég anekdotájából „a vendégek
  mesélik”, „közel a kerékpárúthoz” → „a ház mellől indul”, vékony forrásnál kitalált táj) és 2/5-ben lemásolta a prompt
  példa-keretét → kellenek a gépi ikrek, és nem kell kitölthető JÓ-példa.

## Elvégezve
- `src/generator/lyricOpening.ts` (új): négy blokkoló szabály — leíró nyitás, leltár (>1 adottság a főcímben/alcímben, >2 az
  introban), példa-másolás, hangulati tény forrás nélkül / csend zaj-panasz mellett. Név és település kivágva; a célközönség
  („kerékpárosoknak”) nem adottság.
- `guestCritic.ts`: a négy kind, mindig blokkoló, a kritikus és az újraíró promptja. `copywriter.ts` 2. szabály + séma,
  `brief.ts` nyitórész-szabály + intro/tagline séma + lista-sor + alcím-viszony (§2b-kivétel: tulaj, naplózva).
- `marketCheck.ts`: az 1b réteg megfordítva — leltár és üres hangulat bukik, forrásolt líra / település + célközönség átmegy;
  a bíró 1. és 3. szabálya.
- Régió (Kerekerdő): a `balaton-kelet` 32 km-es gyűjtési kör a Bakonyba is belelóg → `resolveRegion()` `known=true` csak kézzel
  írt kontextusnál (`badacsony`); a szövegíró a lead települését kapja; a táj csak a szállás saját forrásából. Éles adatjavítás
  nem kell (a renderelt mockban nincs „Balaton”, az `inputs.region`-t semmi nem rendereli); a Kerekerdő mockja a nagy deploy
  után újragenerálva kapja meg az új szöveget.
- Őrök: `scripts/lyric-opening-check.mts` (új, pre-commit; 35 zöld, önteszt 30 piros; mutációval: zaj-ellenbizonyíték,
  leltár-küszöb, üres-hangulat ág, helynév-kivágás, célközönség-kivágás → mind piros), `region-phrase-drop-check` bővítve.

## Utána (valódi kód, 5 lead, 2,38 USD + Kerekerdő-újrafutás 0,46 USD)
- Leltár-főcím 5/5 → 0/5; leíró intro (lint) 5/5 → 0/5. Bánó: minden kapu zöld.
- Kurátor-sorba megy 4/5 — jogos fogások: Rozé „csendes/nyugalma” forrás nélkül, Strand leíró intro (AI-kritikus), Kerekerdő
  „pár lépésre” a forrás 100 m-ével szemben; Három Huszár egy régi ál-idézet miatt. A kritikus 3 köre nem mindig javít.
- Döntési anyag: `assets/design-refs/_drafts/vendegcsalogato/elotte-utana-valodi.html` (+ `JELENTES.md`, A/B: `elotte-utana.html`).

## Nyitott
- A piaci bíró a Rozénál a „víz közelségét” hiányolja, ami a forrásban nincs — a bíró még leltár/ajánlat-irányba húz vékony
  forrásnál. Figyelni a következő mockoknál.
- A kritikus javító köre néha ront (első Kerekerdő-futás: tautológia-főcím). Ha a kurátor-sor arány tartósan magas, a
  javító-prompt finomítása a következő lépés.
