## ADR-0146 — A teszt-forgatókönyv feliratait is őr védi — a MÉRT rendszer szemantikájával (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0045/§J.24 (a KB
label-drift őre — ez annak a testvére), ADR-0139/0141 (a felirat-cserék, amik kiváltották).

**Kiváltó (mérve).** Egy nap alatt öt körben írtam át felületi feliratokat. Az FK-004 futása
utána **pass=2 · fail=1 · blocked=9** lett: a 3. lépés a régi „e-mail még nem ment ki"-t
várta, és **egy bukott lépés kilencet blokkolt**. A KB-t ugyanettől a drifttől őr védi, az
Elek-forgatókönyveket semmi — pedig ugyanabból a szövegből élnek. A hiba egy több perces
futásból derült ki, nem a commit-kapunál.

**A mérés, ami a tervet eldöntötte (és kétszer megcáfolta a saját első ötletemet).**

1. **156 állítás, 12 forgatókönyv.** Egy naiv „szerepel-e a forrásban" szabály **7-et**
   jelölt volna meg — de ebből 4 a SAJÁT mérésem hibája volt: a futó a Playwright
   `getByText()`-jét hívja (kis-nagybetű-érzéketlen, szóköz-normalizált részszöveg), én
   pontos egyezést néztem. ⛔ **Egy őr, ami szigorúbban mér, mint a mért rendszer, hamis
   leletet gyárt** — a „Leadek" állítás például az „Aktív leadek" cím jogos részszövege.
2. **A maradék 3 nem felirat volt, hanem ADAT** (begépelt dátum, seed-vendég) — ezért a
   feloldás három STRUKTURÁLIS forrásból dolgozik, nem kézzel tartott kivétel-listából:
   ① a termék szövege, ② amit a forgatókönyv maga begépel, ③ a park-seed.

**Amit az önteszt hozott ki — és amit a zöld futás elrejtett.**

- **A nyers fájl-olvasás vak:** a saját KOMMENTJEINK idézik a leváltott feliratokat, így az
  őr pont ott vakult meg, ahol a történetünket dokumentáljuk. → csak **string-literál**, a
  TS AST-jéből.
- **A KB nem bizonyíték:** az átnevezett „Outreach-piszkozat" a súgó KÉP-ALÁÍRÁSÁBAN élt
  tovább, és az őr feloldottnak látta. A forgatókönyv a TERMÉKRE mér → a KB kikerült a
  bizonyítékok közül (és a kép-aláírás javítva).
- ⛔⛔ **A katalógus egykarakteres „H" bejegyzése mindenre illeszkedett** a sablon-ágon, azaz
  az őr NÉMÁN mindent feloldott — a „156/156 zöld" semmit nem jelentett. → lefedettség-küszöb
  (a sablon literál darabjai fedjék az állítás ≥60%-át).
- **Az állítás gyakran FELIRAT + ADAT** („Visszaigazolva: Kovács János"): siló-szerű
  feloldással 8 ÉLŐ állításra adott hamis riasztást → **darabonkénti** feloldás.

**Önteszt (mindkét irány).** Három FÜGGETLEN, ma ténylegesen átnevezett feliratra pirosra
megy („Outreach-piszkozat", „Pilot-tölcsér (H1–H5)", „Order-intentek"), a 156 élő állítás
közül egyre sem ad hamis riasztást, és külön ki van tűzve egy olyan felirat, amire TILOS
pirosat adni („e-mail még nem ment ki" — a Tevékenység-lapon ma is él).

**⚠️ A korlát, kimondva.** Az őr FA-SZINTEN méri, hogy a felirat létezik-e — nem azt, hogy
azon a lapon van, amit a lépés néz. A 2026-09-14-i KONKRÉT bukást ezért nem fogta volna meg
(az a felirat máshol tovább él); ugyanannak a driftnek **két másik sorát** viszont igen, tehát
a commit-kapunál pirosra ment volna. A lap-szintű mérés böngészőt és a lépés kattintás-útját
kívánná — külön, drágább réteg, ma nem épül meg.

**Visszafordíthatóság:** 🔄 egyetlen script + egy pre-commit sor.
