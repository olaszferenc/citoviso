## ADR-0091 — A mock SZÖVEGE eladjon: tény-etetés, marketing-őr, szöveg-panel, csak-szöveg újragenerálás

**Dátum:** 2026-08-31/09-01 · **Kiváltó:** tulajdonosi dörgedelem-sorozat ugyanarra a hibára.
A kiváltó mondat: *„sokadszor találkozok ilyen szöveggel… ez egy ÜGYFÉL SZERZÉS, nem vicc"* —
a Dencs Apartmanház mockja `Fenyőillatú csend a tető alatt` főcímmel és
`Olvasnivalóval teli könyvespolc a nappaliban` fő kiemeléssel ment ki, egy olyan szállásra,
aminek a saját hirdetése játszóteret, kertet, saját parkolót, kiságyat és etetőszéket sorol.

**A gyökér NEM az őr hiánya volt, hanem az, hogy a szövegíró ÉHEZETT és a PROMPT ezt kérte.**
Mérve: a `generateBriefAndCopy` hívás nevet, régiót, címet és 4 fotót kapott, a prompt pedig azt
mondta, hogy a képeken láthatóra építsen. Engedelmeskedett — leírta a kanapét. Közben **46
high-band portál-profil 289 szolgáltatása és 28 valós leírása** ült kihasználatlanul a
`lead.raw`-ban.

**Döntés — a lánc mind az öt pontján:**

1. **Tény-etetés** (`brief.ts`, `generateEngine.ts`): a hitelesített hirdetés szolgáltatás-listája
   ÉS saját bemutatkozása bemegy a promptba. A leírás TÉNY-forrás, nem átvehető szöveg (idegen
   szerzői mű), és **számot belőle tilos átvenni** (mért példa: egy hirdetés saját szövege szerint
   a múzeum „autóval csaknem 10 méterre" van).
2. **A próza erős állításai számon kérhető ténnyé** (`descriptionSellingPoints`): sok portál NULLA
   szolgáltatás-listát publikál, csak szöveget. Kati Villa: a leírás „közvetlen vízparti… saját
   stranddal, stéggel" — a mock „tágas kert és saját parkoló" főcímmel ment ki, mert minden
   számonkérésünk a LISTÁN állt.
3. **Marketing-őr** (`marketCheck.ts`), két rétegben — a *heurisztikus őr mellé strukturális iker*
   doktrína szerint: (a) determinisztikus twin, API nélkül: az ÁTADOTT tényekből hányat nevez meg
   az eladó felület; (b) marketinges bíró a maradékra. **Foga van:** bukásnál a kritika
   visszacsatolódik EGY újragenerálásba, a második bukás `marketVerdict:"flag"`, amit a
   kiküldés-kapuk már olvasnak.
4. **A FŐCÍM külön mérce.** Az őr első verziója az eladó felületet EGYBEN nézte, ezért a gazdag
   kiemelések átvitték az üres H1-et (`Faillatú csend a Balatonnál` átment 9 megnevezett ténnyel).
   Külön réteg: a hero lead önmagában nevezzen meg konkrétumot; **és ne hordjon építőanyagot**
   (`fenyőgerendás tetőtér` — tulaj: *„miért nem írjuk bele, hogy XC30/37 betonból, harminchatos
   betonszivattyúval pumpálva?"*). Rangsor: vízpart/strand/stég/medence/panoráma > kert/terasz >
   parkoló/wifi.
5. **Láthatóság és beavatkozás** (ADR-0065 kapun át jóváhagyva, kontraktus:
   `assets/design-refs/console/copy-panel.html` + README): a generált szöveg eddig CSAK a
   renderelt mock fájlban létezett — nem volt hol észrevenni. Új konzol-panel: a teljes eladó
   szöveg + a hirdetéssel szembeállítva (felhasznált / nem említett, csoportosítva), és
   **csak-szöveg újragenerálás** utasítással (`recopy.ts`), ami a sablont, skint, fotókat és az
   elrendezést érintetlenül hagyja. Már kiajánlott mockot nem ír át (§I).

**Scrape-oldali javítások ugyanebben a szálban:** a típus-szó lefokozás a saját indoklásának
mondott ellent („kemény azonosító igazolja", majd mégis lefokoz); régi táblázatos lapok
(turistautak.hu) leírás-kinyerése (`<td>`, tag-enkénti pásztázás, ENTITÁS-horgony a lap jogi
lábléce ellen); ISO-8859-2 charset-visszaesés, ha a lap nem nyilatkozott és a dekódolás elromlott.

**Visszafordíthatóság:** 🔄 — minden réteg additív, az őr kikapcsolása egy hívás törlése.

**Meta-tanulság (harmadszor ütött be ezen a szálon):** az adathiányos ág volt a VAK ág. A
strukturális réteget szándékosan írtam vaknak arra az esetre, amikor nincs szolgáltatás-lista —
vagyis ott volt a legvakabb, ahol a szöveg a legrosszabb. **Mielőtt őrt írsz arra, amit a
rendszer csinál, nézd meg, mit KÉRTÉL tőle.**
