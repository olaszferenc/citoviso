## ADR-0501 — A településkép-szabály a kapun is a választó bemenetén ítél (330 px); bélyeg- vagy verzió-emelés nem üríti ki a tulaj lapját

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva (koordinátor `cit9b4690e3`: „a településkép-választó ugyanazt a szabályt hívja, amit a render-kapu”)
- **Kiegészíti:** ADR-0479 (településkép), ADR-0500 ⑤ (bukás utáni újrapróba), ADR-0499 (a várakozó sor okkal félreáll)
- **Érinti:** `src/media/townPick.ts` (`townJudgeInput`, `judgeTownPicture`), `src/outreach/mockRenderGate.ts` (`RENDER_GATE_VERSION` 16 → 17), `scripts/qa-review-check.mts`

### Mért helyzet (vak mérés élesen, 11-27 10:50, 69 HR sor)
- 18 sor állt félre render-kapu bukással. Kb. 9-nél a lap helyi (településkép) képe bukott a településkép-szabályon („sötét / alkonyi”, „a grave or cemetery”, közeli tető, gyenge minőség), pedig ugyanezt a képet a választó ugyanezzel a szabállyal (`townVerdict`) átengedte.
- **Ok: a CLIP méretfüggő.** A választó a Commons 330 px-es bélyegképét pontozza. A kapu is a 330 px-es változatot kéri (`townJudgeBytes`), de ha ez a letöltés nem sikerül, a lap 1280 px-es fájlján ítél. Mérve:
  - Kreuze im Sonnenschein: 330 px jó, 1280 px „sötét / alkonyi”;
  - Tučepi-Podstup: 330 px jó, 1280 px „a grave or cemetery”.
- Az ADR-0500 ⑤ mérése ugyanezt az esetet a „8: a településnek nincs más jóváhagyott nyitóképe” sorban látta: az újrapróba nem talál másik képet, mert a választó szerint nincs mit cserélni.

### Döntés
- A `judgeTownPicture` minden 330 px-nél szélesebb képet a választó szélességére kicsinyít, mielőtt a CLIP-hez adja (`townJudgeInput`, helyben, $0).
- A választó saját 330 px-es bélyegképei változatlanul mennek át, az ítéletei nem mozdulnak. A gyűjtött településkép-készletek nem évülnek el (`TOWN_PICK_VERSION` marad).
- A kapu verziója 17: a régebbi ítéletek újraítélődnek az ADR-0499 ④ / ADR-0500 ④ ütemezése szerint.
- Mérve a két éles képen: normalizálva mindkettő „jó”, ahogy a választónál.

### ② Bélyeg- vagy verzió-emelés nem üríti ki a tulaj lapját (koordinátor, 11-27 11:4x: „minden horvát sor eltűnt”)
**Mérve, élesen, olvasva:**
- A 5882aaed (bélyeg `headings1`) és a 35f2a6d1 (bélyeg `supply1`, kapu v16) után minden várakozó terv elavult; a frissítés `left: 646`-ot mutatott.
- A HR fő tervek ítélete v15 maradt: 11 passz, 19 bukás.
- A `HALF_DONE_SQL` csak a JELENLEGI verzió passzát számolja, így a lapon volt sorok elvesztették az elsőbbségüket, és a teljes hátralék mögé kerültek.
- A deploy utáni első tick-et (10:38:57 UTC) a systemd 10:48:57-kor kilőtte (`TimeoutStartSec=600`). Két ok:
  - a kapu-keret a sorok lekérdezése után indult;
  - egy dolgozó a keret végén még kétterves sort kezdett.
  A félig kész ítéletek elvesztek, és a lépés naplósora sem íródott ki.
- A „released: 0” önmagában nem hiba: csak a „gépi kapu megfogta” jegyzetű, majd mindkét tervvel átment sort számolja. A lapra kerüléshez nem kell, ott a két jelenlegi passz dönt.

**Döntés:**
- Az ajánlat előrehaladása (`OFFER_PROGRESS_SQL`) a lead élő terveinek száma, amelyek UTOLSÓ ítélete passz volt, bármely verzión (2 = a lapon volt, 1 = félkész). Országon belül ez áll a sorrend élén (`FAIR_ORDER`), utána a mai passz (`HALF_DONE_SQL`), aztán a kor. Bélyeg- vagy verzió-emelés után a lapon volt sorok frissülnek és ítélődnek újra elsőként, így a lap egy-két tüzelés alatt újratelik.
- A kapu-keret a lépés elejétől számol, és új render csak akkor indul, ha egy teljes (`REGATE_RENDER_ROOM_MS` = 60 s) még belefér. A tick így a 600 s alatt marad.
- Elvetve: a régi passzos sor maradjon a lapon az új ítéletig. A frissítés addigra a fájlt már átírta, a lap tehát meg nem ítélt mockot mutatna a tulajnak. A tulaj „Mehet”-je a fájl mtime-jához kötődik.

### Miért
A teszt-doktrína (§2c) szerint a választó előre szűr, a kapu pedig ugyanazt méri. Ha ugyanaz a szabály két különböző bemeneten fut, a választó átenged egy képet, a kapu megbuktatja, és az újrapróbának nincs mit választania.

### Visszafordíthatóság
🔄 — egy függvény; a verzió visszaállításával a régi ítéletek újra érvényesek.

### Megjegyzés
A koordinátor ugyanezen körre kért további pontjai (nyitókép-alkalmasság a választóban, ismétlődő szöveg, automatikus újragenerálás bukás után, a kapu „s”-hibája) az ADR-0500-ban már landoltak (⑤, ⑩a, ⑩b). Ez az ADR csak a hiányzó darabot pótolja.
