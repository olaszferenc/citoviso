# 2026-09-01 — A mock szövege eladjon (ADR-0091) + a térkép megjelenik (ADR-0092)

## Mi volt a kiváltó

Tulajdonosi dörgedelem-sorozat UGYANARRA a hibára, négy körön át. A nyitó mondat:
*„sokadszor találkozok ilyen szöveggel… ez egy ÜGYFÉL SZERZÉS, nem vicc"* — a Dencs
Apartmanház mockja `Fenyőillatú csend a tető alatt` főcímmel és `Olvasnivalóval teli
könyvespolc a nappaliban` fő kiemeléssel ment ki, miközben a szállás saját hirdetése
játszóteret, kertet, saját parkolót, kiságyat és etetőszéket sorol.

## A gyökér — nem az volt, aminek látszott

**A szövegíró ÉHEZETT, és a PROMPT pontosan ezt kérte tőle.** Mérve: a
`generateBriefAndCopy` nevet, régiót, címet és 4 fotót kapott; a prompt azt mondta,
építsen a képeken láthatóra. Engedelmeskedett — leírta a kanapét, a könyvespolcot, a
csempét. Közben **46 high-band portál-profil 289 szolgáltatása és 28 valós leírása**
ült felhasználatlanul a `lead.raw`-ban.

A hero-lead séma-mezője pedig szó szerint ezt kérte: *„A hero KÖLTŐI vezércíme — rövid
HANGULATI mondat"*. Két körön át az őrt erősítettem, mielőtt megnéztem, mit rendeltem.

## Mit csináltunk (a lánc mind az öt pontján)

1. **Tény-etetés** — a hitelesített hirdetés szolgáltatásai + bemutatkozása bemegy a
   promptba. A leírás tény-forrás, nem átvehető szöveg; **számot belőle tilos átvenni**
   (mért példa: egy hirdetés szerint a múzeum „autóval csaknem 10 méterre" van).
2. **A próza erős állításai számon kérhető ténnyé** (`descriptionSellingPoints`) — sok
   portál NULLA szolgáltatás-listát ad, csak szöveget.
3. **Marketing-őr** (`marketCheck.ts`) — determinisztikus twin + marketinges bíró,
   visszacsatolt újragenerálással; a második bukás blokkolja a kiküldést.
4. **A FŐCÍM külön mérce** — önmagában nevezzen meg konkrétumot, és ne hordjon
   építőanyagot.
5. **Konzol-panel + csak-szöveg újragenerálás** — a szöveg végre látható, és javítható
   anélkül, hogy a kinézet elveszne.

## A négy kör, amit a tulajnak kellett elkapnia (mind az én hibám)

| # | Amit szállítottam | Miért ment át |
|---|---|---|
| 1 | „Fenyőillatú csend a tető alatt" | a szövegíró nem kapott tényt |
| 2 | „Faillatú csend a Balatonnál" | az őr max_tokensje kevés volt → `error`; és a strukturális réteget SZÁNDÉKOSAN vaknak írtam adathiányra |
| 3 | „…a fenyőgerendás tetőtér alatt" | a főcím-szabály csak azt kérdezte, megnevez-e tényt — az anyagot nem tiltotta |
| 4 | Kati Villa: „tágas kert és saját parkoló" egy közvetlen vízparti, saját strandos villára | minden számonkérés a szolgáltatás-LISTÁN állt, a portál viszont csak prózát ad |

## Tanulságok, amiket vinni kell

- ⛔⛔ **Mielőtt őrt írsz arra, amit a rendszer csinál, nézd meg, mit KÉRTÉL tőle.** Két
  kört töltöttem az őr élesítésével, miközben a prompt maga rendelte a hangulatot.
- ⛔⛔ **Az adathiányos ág lett a VAK ág — harmadszor ezen a szálon.** A strukturális
  réteget azzal az indokkal írtam vaknak „ha nincs adat", hogy ne büntessük a szöveget a
  scrape hibájáért. Az eredmény: ott volt a legvakabb, ahol a kimenet a legrosszabb. Kié
  a hiba, az nem változtat azon, hogy kimehet-e.
- ⚠️ **A „megvan az adat" nem azonos azzal, hogy „eljut a fogyasztóig".** A leírás
  ELJUTOTT a szövegíróhoz a Kati Villánál (az „elektromos kapus udvar" onnan van) — de a
  szövegíró mazsolázott, az őr pedig meg sem kapta. Minden új adatnál: ki olvassa, ki
  kéri számon, ki méri?
- ⚠️ **Két kódút ugyanarra a kérdésre = előbb-utóbb két viselkedés.** A térkép-query a
  modul-blokkban koordinátát kapott, a kompozíciós úton nevet+címet. Ugyanez volt a
  minta a fotó-sávnál is.

## Módosított fájlok (a szál egésze)

- `src/generator/brief.ts`, `src/engine/copywriter.ts` — tény-etetés, főcím-szabály, rangsor
- `src/generator/marketCheck.ts` **(új)** — a marketing-őr + `groupAmenities` + `descriptionSellingPoints`
- `src/generator/recopy.ts` **(új)** — csak-szöveg újragenerálás
- `src/generator/generateEngine.ts`, `src/generator/factCheck.ts`, `src/generator/highlightValue.ts`
- `src/scraper/sources/portals/extract.ts`, `politeness.ts`, `src/scraper/sources/portalListing.ts`
- `src/console/views.ts`, `src/console/server.ts`, `public/assets/ui/citui-console.css`
- `src/engine/primitives.ts`, `src/engine/moduleSections.ts`, `assets/runtime/cit-runtime.js`, `cit-modules.css`
- `src/legal.ts` — a térkép-beágyazás adatvédelmi szakasza
- `scripts/copy-panel-check.mts` **(új)** — a panel-kontraktus ellenőrzése (22/22)
- `assets/design-refs/console/copy-panel.html` + `README.md` — a befagyasztott terv

## Nyitott

- A marketing-őr bírója **nem determinisztikus**: ugyanaz a szöveg két futáson kaphat más
  ítéletet (mérve: a „tóparton" állítást egyszer elkapta, másodszor átengedte). A
  strukturális réteg stabil — a bíró a lágy fele.
- A `copy-panel-check.mts` **nincs pre-commitba kötve** (szervert indít, lassítaná a többi
  szálat). Kézzel futtatandó, ha a panel változik.
- A generált szöveg **egy nyelven** épül; a többnyelvű modul fordítja, de a főcím-szabályt
  a fordításon nem méri senki.
