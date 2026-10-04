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
