## ADR-0324 — Lírai nyitórész: leíró mód és leltár tilos, a líra is forrásból; a gyűjtési terület neve nem lead-tény (2026-10-04)

**Dátum:** 2026-10-04 · **Státusz:** elfogadva — a tulaj a koordinátoron át (SUB, brief
`~/rc-briefs/vendegcsalogato-hos-szoveg.md`) · **Felülírja:** ADR-0091 ④ („a hero lead önmagában nevezzen
meg konkrétumot”) és ADR-0097 ④ („a főcím a lista ELEJÉRŐL nevezzen meg 1–3 tényt”) · **Kiegészíti:** ADR-0143
és ADR-0163 (a terület a gyűjtés doboza — most a generátorra is) · **Kapcsolódó:** §B.17, ADR-0292 (vendég-kritikus,
B-szabály), ADR-0317 (a prompt-példát a modell lemásolja), ADR-0065 (§2b-kivétel: `copywriter.ts`).

**A tulaj szava.** „valahogy el kellene érni, hogy ilyen nem vendégcsalogató szövegeket generáljon a rendszer.
9/10 esetben ez van…” · „Viccelsz bazdmeg???? sötétre pácolt???? komolyan????” · „lehet le is kellene tiltani a
nyitórésznél azt hogy leíró módban menjen… Lírai szöveg kell…” · a javaslatra: „Nagyon szűken mehet.
Adottságélményként. Vékony forrásnál akkor általánosítás marad. … mehet a javaslat.”

**Mérés (dev + éles, csak olvasva).** Az utolsó 50 mock hős-címéből **49-et leltár vezetett** (38 tiszta
felszereltség-lista, 11 leltár + helyfarok, 1 élmény-vezetésű). Leadenként 27-ből 23. Az intro 27 leadből **16-nál**
a fotóról leolvasott felületet írta le („két sötétre pácolt faháza”, „zöld-fehér homlokzatú, piros cseréptetős”);
kézzel átnézve 16/16 valódi találat. A szabály: `assets/design-refs/_drafts/vendegcsalogato/classify.mjs`
(explicit szólisták, újrafuttatható).

**Az ok a MI kérésünk volt, négy helyen.** A 2026-08-31-i „Fenyőillatú csend a tető alatt” kitiltása óta a
főcím KÖTELEZŐEN amenityt nevezett: (1) a szövegíró 2. szabálya és a séma; (2) a brief „1–3 tény a lista
elejéről” sora, miközben a táj/fekvés súlya a rangsorban 0; (3) a piaci kapu 1b rétege determinisztikusan
buktatta a szolgáltatás nélküli főcímet (a Kerekerdő PASS-indoklása: „konkrét, használható dolgokat nevez meg
(bekerített kert tűzrakóval, saját parkoló)”); (4) a kritikus újraírója. Az intro sémája azt kérte: „a képeken
VALÓBAN LÁTHATÓ jellemzőket fűzd bele”. A tényhűség NEM volt ok: a Kerekerdő élmény-ténye szó szerinti idézettel ott
volt („Természetközeli pihenés a Magas-Bakonyban … Hárskút erdők és hegyek ölelte határában”).

**Döntés.**
1. **A nyitórész (hero főcím + alcím + intro) LÍRAI.** A hely érzetét adja egy forrásból ismert képpel (táj,
   fekvés, közelség, évszak, kinek való). Leíró mód TILOS: felület, anyag, szín, bútor, méret, felszereltség-lista.
   A felszereltség a kiemelésekbe való.
2. **Egy adottság, nagyon szűken (tulaj ①):** a főcímben és az alcímben legfeljebb EGY, élménybe ágyazva,
   felsorolás soha; az introban legfeljebb kettő, a végén.
3. **A líra is forrásból.** Tájegység, érzéki részlet (madárszó, illat, ropogó tűz, csillagos ég) csak, ha a
   leírás vagy egy vélemény kimondja. „Csend” / „nyugalom” TILOS, ha bármelyik vélemény zajról szól. EGY vendég
   egyszeri élményéből nem lesz főcím és nem lesz „a vendégek mesélik” (ADR-0292 B kiterjesztve).
4. **Vékony forrás (tulaj ②):** a líra a településből és a célközönségből épül, általános marad, tájat nem
   talál ki. Nem FLAG.
5. **A líra nem üres hangulat** — a 2026-08-31-i tilalom marad: a főcím VALÓS képet visz, és nem másolható
   rá más szállásra. Kitölthető „JÓ” példa-keret nincs a promptban (mérve: két szállás ugyanazt kapta,
   „Ahol a falu véget ér, és kezdődik…”); a tiltott példák EGY forrásból (`lyricOpening.ts`
   `OPENING_BAD_EXAMPLES`) mennek a promptokba és a másolás-ellenőrzésbe.
6. **Determinisztikus ikrek** (`src/generator/lyricOpening.ts`, a vendég-kritikusban MINDIG blokkolók):
   `leiro_nyitas` · `leltar_nyitas` · `minta_masolas` · `hangulat_forras_nelkul`. A szállás neve és a település
   a mérés előtt kivágódik („Balatonudvari” nem udvar).
7. **A piaci kapu megfordul.** Az 1b réteg a LELTÁRT (>1 adottság) és az ÜRES hangulatot (se forrásolt
   helyszó, se település, se adottság) buktatja, a forrásolt lírát átengedi. A bíró 1. szabálya „MIÉRT jön ide”
   lett; a 3. szabály a hiányzó erős pontot a kiemeléseken méri, nem a főcímen.
8. **A gyűjtési terület neve nem lead-tény** (rendszerszintű, a Kerekerdő esete). A `balaton-kelet` egy 32 km-es
   keresési kör (46,96 / 17,88), ami a Bakonyba is belelóg: Hárskút „Balaton-Kelet” régióként ment a
   szövegírónak ÉS a tényhűség-kapu LICENCÉRE. A `resolveRegion()` mostantól csak kézzel írt, a helyért kezeskedő
   kontextusnál (`REGIONS`, ma: `badacsony`) ad `known=true`-t; a DB-beli gyűjtési dobozok azonosítója megmarad
   (nyelv, ütközés-kerülés), a neve nem kerül a promptba. A szövegíró helyette a lead SAJÁT települését kapja
   (`Település:`); a tájegységet csak a szállás saját forrásából nevezheti meg.

**Előtte / utána** — lásd a jelentést (`_planning/memory/2026-10-04_lirai_nyitoresz.md`): 5 lead (Kerekerdő
élesről olvasva, Bánó Porta, Strand Apartman Keszthely, Három Huszár, Rozé dev), ugyanaz a bemenet.

**Őr.** `scripts/lyric-opening-check.mts` (pre-commit, AI és DB nélkül): 12 kiment nyitórész pozitív kontrollként,
5 becsületes lírai iker negatív kontrollként, a piaci kapu strukturális rétege (leltár bukik, forrásolt líra
átmegy, üres hangulat bukik, vékony forrás átmegy, egy adottság élményként átmegy), és a bekötés. Önteszt: a régi
viselkedés (nincs lint + „főcím adottság nélkül = FLAG”) → 29 állítás piros. Mutációval igazolva: a zaj-ellenbizonyíték,
a leltár-küszöb, az üres-hangulat ág és a helynév-kivágás kiiktatása egyaránt pirosra viszi.
`scripts/region-phrase-drop-check.mts` bővítve: a gyűjtési terület (`balaton-north`, és koordinátából Tapolca)
`known=false`.

**Éles adat.** Adatjavítás nem kell: a renderelt Kerekerdő-mockban nincs „Balaton”, a tárolt `inputs.region`-t
semmi nem rendereli. A Kerekerdő mockja a nagy deploy után újragenerálva kapja meg az új szöveget.

**Visszafordíthatóság:** 🔄 — prompt-szöveg, egy lint-modul, egy kapu-ág és egy feltétel a `resolveRegion`-ben;
tárolt adat nem változott.

### Utószál (2026-10-04, tulaj: „a két nyitott pontodat IS javítsd”)
1. **A piaci bíró csak forrás-tényt hiányolhat.** A válasz megnevezi, melyik szabályon bukik (`rules`), a `missed`-listából
   determinisztikusan kiesik minden, ami nem forrás-tény (`isSourcedMiss`: tény-címke egyezés vagy tartalmazás, ill. szó
   szerint a bemutatkozásban; 6 betűs tő-egyezés szándékosan NINCS — a „Strandröplabda” nem bizonyítja a strand közelségét).
   Ha a bukás CSAK a 3. szabályon állt, és forrásolt hiány nem maradt, a verdikt PASS, indoklással (`applyJudgeVerdict`).
   ⚠️ **Helyesbítés:** a fenti mérésnél azt írtam, hogy a Rozé forrásában „a víz közelsége nincs”. A bemutatkozás valóban
   egy szó („Révfülöp”), de a balaton.hu szolgáltatás-listáján áll a „Hajózás” és a „Vizibicikli kölcsönzés” (az ékezetes
   „víz” keresésem nem találta). A bíró három hiánya közül tehát kettő forrásolt volt; a kitalált a „strandközelség”.
   (Hogy ez a lapos lista a ház vagy a környék kínálata, az az ADR-0317 „ismert határa” — scraper-kérdés.)
2. **Tautológia a nyitórészben blokkol** (`ismetles_nyitas`, `lyricOpening.ts` `tautology`): a főcím önmagát ismétli
   (≥ 2 tartalmi tő kétszer), vagy a főcím és az alcím ugyanaz (≥ 4 szavas közös futam, vagy a főcím tartalmi tövei ≥ 60 %-ban
   az alcímben). Mérve: a kritikus javító köre „Erdők és hegyek ölelte határban, ahol erdők és hegyek ölelik a faházakat”-ot
   csinált; a 17 eddig mért nyitórészen a szabály ezt, a pilot főcím = alcím esetét és két régi (mai promptos) ismétlést fog,
   a jó kimeneteken nem jelez. A `bestRound` a blokkoló kifogás nélküli kört választja, így a rontó javítás nem nyerhet.

**Őr:** a `lyric-opening-check` bővítve (55 zöld; önteszt 46 piros). Mutációval: a forrás-szűrő kiiktatása, a részszó-egyezés
kiiktatása, a csak-3.-szabály felmentés kiiktatása, a 6 betűs tő-egyezés, és a tautológia mindhárom ága (izolált esetekkel)
egyenként pirosra viszi. **Újramérés** (valódi kód, Rozé + Kerekerdő, 0,82 USD): Rozé — piaci PASS, kritikus PASS; Kerekerdő —
nincs tautológia, kritikus PASS, a bíró viszont a főcímet („Erdők és hegyek ölelte határban, Hárskút mellett”) üres hangulatnak
ítélte (az első ítélete ugyanerre a szövegtípusra PASS volt — a bíró szór; kurátor-sor).

### Kiegészítés — földrajzi állítás csak forrásból; a település ismerete nem forrás (2026-10-04)
**Tulaj** (a koordinátoron át, brief `~/rc-briefs/lirai-foldrajzi-allitas.md`): „Kell-e gépi szabály arra, ha a szöveg csak a
település ismeretéből állít földrajzi tényt (pl. »a Balaton partján«)?” → **„általános lírai szöveg.”**

**Mérés (dev + éles, csak olvasva; a valódi lint a korpuszon, kézzel átnézve).** Leadenként a legutóbbi mock nyitórészéből
**dev 11/25, éles 2/13** állított forrás nélküli földrajzi tényt (mockonként dev 74/174, éles 4/43). Példák: Camping Carina
„Balaton-parti” (a forrásban a „Balaton” csak a település nevében áll), Kemencés „Káli-medence” + „Balaton-felvidék”, Artemisz
„erdőszéli”, Aranykagyló „domboldal és a szőlők”, Kerekerdő „dombok és mezők” (a forrás „erdők és hegyek”-et mond), Agrosz
(üres forrás) tanúhegyek/panoráma/Badacsony. Kézi átnézésből két hamis pozitív javítva a mérés előtt: a „szőlőlugas” terasz,
nem szőlőhegy; az angol/német vélemény („main beach”, „lake view”) is forrás.

**Döntés.**
1. A nyitórész (főcím, alcím, intro) földrajzi/táj-szava — Balaton, part, víz, tó, strand, öböl, hegy, domb, erdő, völgy,
   mező, szőlő/borvidék, panoráma/kilátás, nádas, folyó/patak, megnevezett tájegység (Bakony, Káli-medence, Balaton-felvidék,
   Badacsony…), égtájas parti fekvés („déli partján”) — csak akkor állhat, ha a szállás saját forrásában (leírás, tény-idézet,
   vélemény) van rá szó. A szállás neve és a település a BIZONYÍTÉKBÓL is kivágódik: „Balatongyörök” nem igazolja
   a „Balaton-partot”. A víz-család egymást igazolja (part/strand/tó/Balaton ↔ „a víz közelsége”); egy tájnév nem igazol
   egy másikat („Bakony” ≠ „Badacsony”).
2. Gépi iker: `lyricOpening.ts` `GEO_CLAIMS`, a meglévő `hangulat_forras_nelkul` kifogás kiterjesztéseként (MINDIG blokkoló);
   a javító utasítás: „általános lírai szöveg kell: a település és a célközönség, legfeljebb egy forrásolt adottság élményként”.
3. Prompt: a szövegíró, a brief és a kritikus újraírója kimondja, hogy a település ismerete — és a NEVE — nem forrás;
   kitölthető példa-keret nincs (ADR-0317).

**Őr:** `lyric-opening-check` ⑥ szakasz — 7 piros eset valódi kiment sorokból (Rozé „a Balaton partján”, Carina település-név,
Kemencés tájegység, Kerekerdő dombok, Artemisz erdő, „déli partján”, Bakony ≠ Badacsony), 8 zöld forrással (víz-család,
angol vélemény, strand → part, szőlőlugas, „medence partján”, kötőjel nélküli „Káli medencében”, öböl + égtáj forrásból);
bekötés: mindhárom prompt. 71 zöld, önteszt 62 piros. Mutációval: a település kivágása a bizonyítékból, a medence-kivétel,
a szőlőlugas-kivétel, a víz-család, az angol bizonyíték, a kötőjel-opcionális alak, a tájnevek, az égtáj-ág és az egész
földrajz-ág kiiktatása egyenként pirosra viszi.

**Újramérés** (ugyanaz az 5 lead, valódi kód: brief+copy hívás + vendég-kritikus, DB-írás nélkül; **1,67 USD**): a kritikus
ELŐTTI vázlatban 2/5 földrajzi állítás forrás nélkül (Kerekerdő „erdők és dombok” — a forrás hegyeket mond; Rozé „a tó közeli
nyaralás”), a SZÁLLÍTOTT szövegben **0/5**. A Strand „a Balaton nyugati öblében” átment — jogosan: a forrás szó szerint
mondja („a Balaton nyugati csücskében, a Keszthelyi-öböl partján”). Kritikus: Bánó, Három Huszár, Rozé PASS; Kerekerdő és
Strand kurátor-sor (nem földrajzi okból).

**Ismert határ:** a szólista explicit (a korpuszban előforduló szavak + a fő tájegységek); egy új tájnév (pl. „Hegyhát”) addig
nem jelez, amíg fel nem kerül. Az összetételek közül csak a felsoroltak számítanak („gyógytó” nem).
