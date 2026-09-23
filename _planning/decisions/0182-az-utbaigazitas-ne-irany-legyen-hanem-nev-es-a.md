## ADR-0182 — Az útbaigazítás ne IRÁNY legyen, hanem NÉV — és a sáv vigye is a tettet (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (tulajdonosi döntés ebben a turnben, mért
számok alapján; §2b kivétel naplózva) · **Kapcsolódó:** ADR-0176 (a kézi terhelés-újrapróba
útja), ADR-0178 (a `ghost` osztály), ADR-0045/§J.24–26 (tudásbázis), ADR-0129 ③ (néma
zsákutca nincs) · **Őr:** `scripts/charge-retry-note-check.mts`.

**Probléma.** A kézi terhelés-újrapróba visszajelző sávja négy ágon „**a fenti gombbal**"
fordulattal küldött. Mérve a renderelt tulaj-admin lapon: a sáv a **6 660.** bájtnál áll, a
hivatkozott gombok a **10 200–10 800.** bájtnál — vagyis mind **LEFELÉ** mutatott **FÖLFELÉ**
szóval. A redirect (`?ujra=…`) fragmentet sem vitt, tehát a tulaj a lap TETEJÉRE érkezett, és
telefonon fölfelé kereste azt, ami alatta volt.

**① AZ IRÁNY A KÉPERNYŐ-MAGASSÁGTÓL FÜGG, A NÉV NEM** (tulajdonosi megfogalmazás). Ez a
szabály, nem a konkrét szócsere. Egy „fenti/lenti" akkor is elavul, ha senki nem nyúl hozzá:
elég egy hosszabb fordítás, egy másik készülék vagy egy beszúrt blokk. A `varakozas` ág ezt már
eleve jól csinálta („a »Másik kártyával fizetek« úton") — a többi ezt követi.

**② ⛔ ÉS A NÉV A LAPON MOST LÉTEZŐ KIÚTBÓL SZÁRMAZIK, nem beégetett felirat.** Ez a kör valódi
mellékleletet talált: a **`nincs_kartya`** ág pontosan akkor áll elő, amikor
`payment_method !== 'token'` (`retryCharge.ts`) — ami **bitre ugyanaz a predikátum**, mint az
`autoCharge` (`subscriptionAdmin.ts`). Ilyenkor a mandátum-blokk „Másik kártyával fizetek"
gombja **meg sem jelenik**: a sáv egy NEM LÉTEZŐ kijáratra küldött. A `?ujra=` ráadásul MINDEN
fülön olvasódik, a két kártya-gomb viszont csak a Modulok fülön él. Ha egy kiút sincs, a mondat
nem mutat sehová — kevesebb, de sosem hamis (§B.17).

**③ A SÁV VIGYE IS A TETTET — de csak a TÁVOLIT.** A horgony önmagában nem volt elég, és ezt
három mérés mondta ki 390 px-en:
- a **mandátum-blokkra** horgonyozva a gombok odakerültek, ⛔ de az ÜZENET **1 201 px-szel** a
  képernyő fölé csúszott: két gomb, indoklás nélkül;
- a **fagyás-blokkra**, `scroll-margin-top:130px`-szel: közel járt, ⛔ de **levágta a sáv
  tetejét** (top=−50), mert a sáv a benne ülő gombbal 90-ről **168 px-re** nőtt — a 130 egy
  TARTALOMTÓL FÜGGŐ szám volt, ami egy hosszabb vagy lefordított üzenetnél némán újra vágna;
- ezért a horgony **maga a sáv** (`#terheles-uzenet`), és a sáv **kattintható kijáratot visel**
  (a zöld visszakapcsoló sáv mintájára). Így az üzenet és a tett **szerkezetileg** egy
  képernyőn van, nem egy eltalált px-érték miatt. Ahol nincs teendő (sikerült · a bank még nem
  válaszolt · nincs tartozás), ott NINCS horgony: az üzenet maga a tartalom.

**④ ⛔ EGY IDEGEN ŐR MÉRTE KI, HOGY A MÁSOLÁSNAK ÁRA VAN.** A kijáratot először a
befizetés-gomb nevével vittem a sávba — az viszont viseli a TARTOZÁS ÖSSZEGÉT, és a
`frozen-settle-check` azonnal pirosra ment: a jóváhagyott „B — Rendezés-képernyő" kontraktus
szerint az összeg **csak a fagyás-blokkban** állhat, mert egy harmadik előfordulás azt kelti,
hogy KÉTSZER kell fizetni (mérve: 2 → **3**). Ezért a sáv **csak a TÁVOLI** kijáratot
duplikálja („Másik kártyával fizetek", ~1 200 px-szel lejjebb, összeg nélküli felirat); a
fagyás-blokk befizetés-gombja 390 px-en mérve **amúgy is egy képernyőn van** a sávval.
⚠️ Az idegen őr fixtúrájában nincs `?ujra=` kód, tehát erre az ágra **sosem látott volna rá** —
ezért a szabály átkerült a saját őrbe is.

**⑤ AZ ÖTÖDIK „fenti".** A bejelentés négyet sorolt fel; az ötödik a mandátum-blokk SAJÁT
szövegében ült („A fenti befizetéssel a megbízás újra él"), és a horgony 390 px-es mérésének
KÉPÉN bukkant elő — nem forrás-grepből. Tulajdonosi utasításra javítva; itt a mondat nem mutat
és nem idéz, hanem a tényt mondja ki (irány, név és szám nélkül), mert a név ④ miatt nem jöhet.

**Az őr.** `scripts/charge-retry-note-check.mts` — hermetikus (se DB, se szerver), a RENDERELT
lapot méri 10 eseten (8 kimenet + 2 másik fül), mert a mondatokat külön ágak építik külön
fájlokban, és forrás-grep nem tudja megmondani, melyik melyikkel jelenik meg EGYÜTT. Öt
szabály: irány-tilalom (a sávban ÉS a mandátum-blokkban) · a megnevezett kijárat VALÓDI vezérlő
a lapon · a távoli úthoz kattintható elem valódi `href`-fel · a horgony célja létezik · a sáv
nem ismétli a tartozás összegét.
**Piros önteszt: 23 sértés**, és — az ADR-0157 tanulsága nyomán — az önteszt **külön követeli
meg, hogy MIND AZ ÖT szabály megszólaljon**, mert egy halott szabályt az összevont darabszám
elfedne. Plusz **negatív kontroll a TÖRTÉNETI hibára** (a „Másik kártyával fizetek" a
`nincs_kartya` ágon), hogy az őr ne csak a saját szintetikus sértését ismerje fel.
⭐ Ez a negatív kontroll élesben is dolgozott: amikor a ③ szabályt átírtam, az utó-feltétel
kibuktatta, hogy a kontroll cserével már üresen futna — némán semmit sem bizonyított volna.

**Tudásbázis (a kör kiváltó oka).** Az ADR-0176 teljes tenant-felé néző folyamata súgó nélkül
ment be (§J.24). Pótolva: `admin-subscription` — „Az automatikus kártyaterhelés elakadt" (a két
gomb szerepe + mind a hét kimenet emberi nyelven, a **15 perc** türelmi idő és a **4** kísérlet
indoklásával), valamint a zöld visszakapcsoló sáv kifizetett-időszak mondata és számla-linkje;
`admin-modules` — a fizetés-utáni elutasítás-ág és az „Ezt a fizetést nem találjuk" lap.
⚠️ A pay-lapok a `console/views.ts`-ben élnek (operátor-korpusz), a cikk viszont tenant: a
felirat-őr a félkövér idézeteket a saját korpuszához méri, ezért ezek **sima idézőjelben**
állnak, és a cikk ki is mondja, miért. **Ez drift-védelem nélküli folt — NYITOTT.**
`console-duplicates` képe újragenerálva (az ADR-0178 `ghost`-javítása után a kép még három
egyforma cián gombot mutatott); a kb-shot összesen **18** elavult képet frissített.
KB-fordítás-kör lefuttatva mind a 6 élő nyelvre (végállapot: 19/19 friss mindenütt).
⚠️ Az első kör nem volt zöld: 12 fordításból **kettő** integritás-sértés miatt eldobódott, és
egy újrafuttatás oldotta meg (modell-nemdeterminizmus, nem token-elvágás). **NYITOTT:** ilyenkor
az `ensureKbTranslations` csak „missing"-et számol, és a következő triggerig az adott nyelv
tulaja a RÉGI súgót kapja — erről ma semmi nem szól hangosan (a `kb-freshness` a képeket nézi,
a fordítás-lefedettséget nem).

**Visszafordíthatóság:** 🔄 nincs séma- vagy adatváltozás; a mondatok és egy `scroll-margin-top`.
**Élesítés:** NINCS (§0.3) — ez a kör az élesítést blokkoló KB-kaput oldja, a kimenetelt egy
FRISS, független tudásbázis-őr ítéli meg (ADR-0132 H: a javítást ne az ítélje meg, aki csinálta).

> ⚠️ **UTÓIRAT (2026-09-15) — a független őr FLAG-et adott, és igaza volt.** A három eredeti
> hiányt pótoltnak mérte, ⛔ **de a `kb-shot`-körömet ÚJ RÉSNEK minősítette:** a
> `console-leads/legend.png` ebben a körben **640×2020 / 305 kB-ról 640×126 / 12 kB-ra** esett,
> vagyis a teljes oszlop-magyarázat NÉMÁN kiesett a súgóból, miközben a képaláírás továbbra is
> „a jelmagyarázat kinyitva"-t ígért. Javítva az **ADR-0183**-ban (ok, javítás, ép-őr).
> Ugyanott javítva a cikk két szerkezeti pontatlansága is: a pirula és a cím SORRENDJÉT
> fordítva írtam le, és a mandátum-blokkot a kártya „alatt"-ra tettem, holott a kártyán BELÜL,
> annak alsó felében van (mérve: a kártya 42–90 %-a között). Mindkét állítást mostantól a
> `charge-retry-note-check` ⑥a/⑥b szabálya köti.
> 🔵 **Elhalasztva (az őr szerint nem blokkoló):** a `payResultPage`/`payUnknownRefPage`
> felirat-drift kérdése — a feliratok ma pontosak, a korpusz-döntés külön kör.
