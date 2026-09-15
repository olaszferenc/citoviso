# A tulajnak szóló felület hangneme, és a chip, ami nem mondta meg, hogy üres

**2026-09-14** · szál: `wt/uzenetekdok` · Elek FK-001 (2026-09-13-i futás) + FK-006b
**Élesítés: NINCS.** A kinézeti rész a §2b kapunál áll (`TERV-KESZ.md`).

## Amit szállítottam

Négy apró tétel a BRIEF §2b-kivétele alapján (a kivételt a tulaj adta, szó szerint a
BRIEF-ben — nem magamnak, ADR-0068), mindkét méreten ui-shottal ellenőrizve:

1. **E7 — a tulaj-felület egységesen magáz.** 9 felirat (Áttekintés-teendők, Fotók-súgósor,
   belépő lap, elfelejtett jelszó, Szövegek-vezető, mentés-visszajelzés).
2. **E6 — az év-szűrő nem kér el nem dönthető döntést.** Egyetlen évnyi adatnál nincs év-chip.
3. **Z2 (első fele) — a csatorna-chipek száma.** `channelCounts` a `projectMessages()`-ből,
   ugyanabból az egy predikátumból, mint a lista (ADR-0127 ③).
4. **Egy NUL-bájt** a `admin-list-labels-check.mts`-ben, ami a fájlt binárissá tette.

## ⛔⛔ AZ ŐR ZÖLD VOLT, ÉS NEM TÉVEDETT — MÁS KÉRDÉSRE VÁLASZOLT

A `hu-voice-check.mts` a bejelentés napján zöld volt, pedig a tegezés a képernyőn állt.
Az oka: **a tárgya a 16 VENDÉG-oldali sablon volt**, a tenant-admint soha nem nézte.
Közben két szomszédos admin-képernyő két hangnemben beszélt ugyanazzal az emberrel
(„Tölts fel saját fotókat" / „Minden értesítés, amit ÖNnek küldtünk").
→ **Az őr hatóköre kiterjesztve a tulaj-oldali nézet-fájlokra is.** A kód-KOMMENT
szándékosan kimarad: három helyen a kommentek TÖRTÉNETI IDÉZETKÉNT őrzik a régi feliratot,
és egy őr, ami a saját dokumentációnkat bünteti, arra tanít, hogy töröljük a magyarázatot.

## ⛔⛔ A SAJÁT DETEKTOROM HIBÁJÁT AZ ÁLPOZITÍV-KONTROLL FOGTA MEG, NEM AZ ELEMZÉS

A JS `\b` **csak ASCII-t ismer** (`\w` = `[A-Za-z0-9_]`), ezért a `\bTölts\b` **illeszkedik a
„Töltsön" belsejére** — az „ö" nem szó-karakter, tehát ott szó-határt lát. Az első verzióm
így a SAJÁT magázó javításomat jelentette hibának. Minden határ azóta Unicode-tudatos
lookaround (`(?<![\p{L}\p{N}_])…(?![\p{L}\p{N}_])`).
⭐ Ugyanez a kontroll talált egy **eddig ismeretlen valódi leletet** is: „Válassz ki képeket."
(a fotó-feltöltő JS-üzenete) — amit egyetlen kézi grepem sem hozott elő.

## ⛔ EGY LELETET MÉRÉSSEL ELVETETTEM

„A rendezés azonos percen belül eldöntetlen” — **hamis premissza.** A `sent_at`
mikroszekundum-pontos, a `logTenantMessage` minden sort külön tranzakcióban ír
(a globális `db`-vel, sosem `trx`-szel), explicit `sent_at`-insert sehol → azonos időbélyeg
nem áll elő. Az Elek eredeti szövege is „azonos PERC"-et mond, és maga írja, hogy a sorrend
kérdése **emberi döntés**. → nem kódjavítás; a §2b kapuhoz került.

## A §2b vázlatok — amit a saját kattintás-próbám buktatott le

Három működő változat (`assets/design-refs/_drafts/uzenetek-{a,b,c}.html`), a valódi
szabályokkal, a park 2026-09-13-án mért 71 üzenetével. A Playwright-próba **háromszor**
fogta meg a saját munkámat:

- **az előnézet-szabályom nem oldotta meg a leletet:** az „Összeg + Tétel” 19 számla-sorra
  csak **4-féle** előnézetet adott, mert a tétel MÁR A CÍMBEN ott van. Az előnézet azt mondja
  el, ami a **címből hiányzik** (az összeget); a sor egyediségét a cím adja.
- **kimaradt a „Szűrés törlése”** — a mai termékben ott van; egy vázlat, amiből kimarad, a
  jóváhagyás után visszafejlődésnek látszana.
- **a jelvény-elvárásom túl általános volt** („legyen kisebb”): a „B” változat SZÁNDÉKOSAN
  nem csökkenti a jelvényt, hanem megnevezi a lezárt részt — az állításom a HELYES
  viselkedést jelentette volna hibának.

⚠️ **A próbám kétszer a saját hibáját jelentette volna a mocké helyett:** teljes újrarajzolás
mellett a kereső-mező ÚJ csomópont, így a `fill()` egy leválasztott mezőt töltött ki (az
`input` nem buborékol a `document`ig); és a „Mind” chip csak a TÉMÁT nullázza, a csatorna
külön dimenzió. **Kattintás után várni kell, és a teljes visszaállás a „Szűrés törlése”.**

## Mérve, a döntéshez

- A szűrő-sáv **390px-en 247px magas** (a három soros elrendezéssel; „C”-ben 205px) — ennyi
  megy el, mielőtt az első üzenet látszik. A három sorra bontás **módosítaná az ADR-0127 ②
  jóváhagyott két soros tervét**, ezért tulaj-kérdés.
- A bal menü jelvénye ma **70**; a javaslat szerint **21** (A és C), vagy marad 70, de
  kimondja, hogy 49 túlhaladott (B).
- A park **üres** (a tegnapi purge után): a `tenant_message` 0 sor, ezért az élő útvonalon a
  szűrő-sáv nem is renderelődik. A vizuális ellenőrzés a `kb-shot` fixture-jével és a
  `documentsSection()`/`messagesSection()` közvetlen renderelésével történt.

## Módosított fájlok

- `src/server/adminViews.ts` — magázás (9 felirat), év-chipek, csatorna-chip számok
- `src/tenant/messages.ts` — `channelCounts` a `MessageListResult`-ban
- `src/server/public.ts` — a route továbbadja a `channelCounts`-ot
- `scripts/kb-shot.mts` — a fixture is (⚠️ a `scripts/` NINCS típus-ellenőrizve)
- `scripts/hu-voice-check.mts` — +tulaj-oldali hatókör, Unicode-határok, álpozitív-kontroll
- `scripts/admin-list-labels-check.mts` — +5 állítás (mind pirosra megy öntesztben), NUL-fix
- `hooks/pre-commit` — az őr leírása követi a kiterjesztett hatókört
- `src/i18n/catalog.json`, `kb/entries/admin-{messages,documents,overview,photos,texts}`

## Nyitott

A `TERV-KESZ.md` ⑦ pontja (8 nyitott kérdés) — a tulaj egy körben dönt, az orchestrátoron át.
A `_drafts/` a `land.sh`-val törlődik; a vázlat egy paranccsal újragenerálható
(`npx tsx assets/design-refs/_drafts/build-mocks.mts`).

---

# MÁSODIK KÖR (ugyanaznap) — a tulaj döntött: „C — Ügyek, nem levelek"

A §2b kör lezárult: a tulaj a **C** változatot választotta, és vele együtt jóváhagyta,
hogy a túlhaladott üzenet NEM olvasatlan, és hogy az előnézet a tartalmat mutassa.
Kontraktus befagyasztva: `assets/design-refs/tenant-admin/uzenetek-ugyek/`.

## ⚠️ A JÓVÁHAGYÁSKOR ELHANGZOTT SZÁM NEM AZ, AMIT A SZABÁLY AD

„71 sor → ~12 ügy" hangzott el. **Megmérve: 71 → 22 felső szintű sor.** A különbség a
**19 SZÁMLA**, amit az ADR-0125 szándékosan nem szálasít (egy új számla nem teszi
valótlanná a régit) — és amihez a tulaj ugyanabban a mondatban mondta, hogy ne nyúljak.
A nyereség tehát **50 dunning-sor → 1 ügy-sor**. Ezt a kontraktus 0b pontja kimondja,
hogy ne várjunk tőle többet, mint amit tud.

## A KONTRAKTUS-ŐR A FELADATLISTÁM VOLT

A README befagyasztása után a `contract-drift-check` azonnal **8 bukást** jelentett —
a `**„…"**` alakban jelölt kötő feliratok még nem léteztek a kódban. Gépi feladatlista,
nem emlékezet. ⚠️ Egy hibát is elkövettem benne: a RÉGI feliratot (`Mind olvasott (71)`)
is `**„…"**`-ban írtam, vagyis az őr épp azt követelte volna meg, amit lecserélünk —
a régi alakot azóta `kód`-jelöléssel idézi a README.

## AMIT A SAJÁT ŐRÖM TALÁLT A SAJÁT KÓDOMBAN

- ⛔ **Egysoros SMS-nél az előnézet MEGISMÉTELTE a címet.** Tárgy nélküli SMS-t a lista a
  törzs első sorából címez, és a „következő érdemi sor" ugyanaz a sor volt — a kártya
  mindent kétszer mondott. Javítva: ha nincs MÁS mondanivaló, az előnézet ÜRES.
- ⛔ **A saját őröm INDEX szerint párosított** sort a fixture-höz. Az ügy-nézet a lépéseket
  a fejük alá csoportosítja, tehát a renderelt sorrend már nem a fixture sorrendje: az őr
  m5-öt m4 markupjához mérte, és a hibát a TERMÉKRE fogta volna. Azonosító szerint párosít.
- ⛔ **A fixture nem mérte a szabályt:** a számla-üzenet törzse `"…"` helyőrző volt, tehát
  nem volt benne összeg-sor — az előnézet-szabály MEGMÉRETLEN maradt. Valódi törzs került be.
- ⛔ **A `scripts/` nincs típus-ellenőrizve:** az új mezők hiánya a guard-fixture-ökben csak
  FUTÁSIDŐBEN derült ki (`Cannot read properties of undefined (reading 'join')`).

## KÉT MAGYARTALANSÁG, AMIT MAGAM GYÁRTOTTAM

- „Megjelölöm olvasottként **mind a 1** üzenetet" — a számnév előtti magyar névelő a
  kimondott alaktól függ (az 1, a 2, az 5, a 6…). Ez pontosan a gépi **„a(z)"**-csapda,
  amit az Elek külön leletként jelentett. A mondatok úgy épülnek, hogy a névelő NE a
  számhoz tapadjon („— {n} üzenet", „a következő {n} üzenetet").
- „▴ **A(z)** {subject} korábbi lépéseinek elrejtése" — ugyanaz. Átírva névelő nélkülire.

## Mérve a szállított kódon

- olvasatlan **65 → 21** (a 44 túlhaladott már nem riaszt);
- **66 üzenet → 22 sor** csukva, **66** kinyitva — a találat-szám mindkét állapotban 66;
- a keresés a CSUKOTT ügy lépésére is talál (az őr külön állítása).

## Őr

`admin-list-labels-check`: +3 blokk (⑨ ügy-csukás · ⑩ olvasatlan-szabály · ⑪ előnézet),
**9 új állítás, mind PIROSRA megy** az öntesztben (összesen 31 sértés a visszarontott
nézeten). A visszarontás mindháromnál a FIX ELŐTTI állapotot állítja vissza: nincs
csoportosítás, a régi olvasatlan-szabály, és a törzs első sora az előnézetben.

---

# HARMADIK KÖR — a súgó, és a szál lezárása

## ⛔⛔ A KB-ŐR ZÖLD VOLT, MERT MÁS KÉRDÉSRE VÁLASZOLT (megint)

A `kb-check` **horgonyt és kép-frissességet** mér, nem IDÉZETET. A cikk közben három olyan
feliratot idézett, ami már nem létezik („Mind olvasott (2)", „A szűrt 2 olvasott",
„Szűkítés"), és egy állítása **MÁR AZ ELSŐ KÖR ÓTA hamis volt**: „Az »E-mail« és az »SMS«
gombon nincs darabszám" — pedig az első körben épp azt tettem rá.
→ A felirat-csere ELŐTT grepelni kell a fogyasztókat; a `kb/` a fogyasztók közé tartozik.
   (Az Elek-forgatókönyveket ellenőriztem, ott csak KOMMENTBEN szerepelt — a KB-t nem.)

⭐ **A KB-őr viszont a saját hibámat elkapta:** a félkövér idézetbe beleégettem egy konkrét
számot („— 2 üzenet"), a forrásban helyőrző áll → label-drift hiba. Csak az ÁLLANDÓ részt
szabad idézni.

## ⛔ SZŰKÍTETTEM A KONTRAKTUST A JÓVÁHAGYOTT VÁZLATHOZ KÉPEST

A tulaj által jóváhagyott `uzenetek-c.html` mutatta a **visszakapcsoló sávot** is
(„Ezzel a 2026. 09. 10. – 2027. 09. 10. időszak van rendezve" + „Megnyitom a számlát a
Dokumentumok közt ▸"), és a TERV-KESZ.md a közös tételek közt sorolta. A befagyasztott
README-be viszont **nem vettem be**, és nincs megvalósítva — az `adminViews.ts` „A honlapja
újra elérhető" sávja változatlan.
**Ez a `feedback_approved_draft_is_the_contract` fordítottja:** nem a tervet erőltettem a
meglévő vázba, hanem a SZERZŐDÉST szűkítettem a terv alá, csendben. A kontraktus-őr nem
foghatta meg — csak azt méri, amit a README KÖT. Nyitott tételként jelentve.

## Élesítés

**NEM az én dolgom** (tulajdonosi döntés, 2026-09-15): a szálak MEGVÁRJÁK egymást, és egy
MEGNEVEZETT VERZIÓ megy ki közösen. A munkám landolt és igazolva van, tehát része lesz a
közös élesítésnek.

## NYITOTT TÉTELEK (átadva)

1. ✅ **LEZÁRVA 2026-09-15** (a tulaj kérésére) — a visszakapcsoló sáv kimondja a kifizetett
   időszakot, és elvezet a bizonylathoz. **A kontraktus ⑦b pontja pótolva.**
   ⛔⛔ **A SAJÁT ÖSSZEFOGLALÓ SOROM VOLT A HAMIS PREMISSZA:** ide azt írtam, hogy „adat
   MEGVAN (`subscription.arrears.periodStart/End`)". **Újramérve: az `arrears` csak
   `past_due`/`frozen` állapotban él** — a sáv viszont PONT AKKOR jelenik meg, amikor a fiók
   MÁR ÚJRA AKTÍV, tehát ott mindig `null` lett volna. A kifizetett ciklus valójában maga a
   FOLYÓ időszak (`current_period_start/end`), mert a fizetés arra állítja. Új `settled` mező
   épült rá, a bizonylattal (az `order_intent.renewal_period_start` kulcson).
   ⭐ Mellékesen egy rejtett hiba is kijött: a sáv a NYERS ISO dátumot írta ki a vevőnek
   („2026-09-13") — ugyanaz a hibaosztály, amit az ADR-0144 máshol javított.
   ⛔ Két SAJÁT őr-hiba is: az első változatom az EGÉSZ lapon kereste a `tab=dokumentumok`-ot
   és a BAL MENÜ linkjét találta meg; a meglévő `--self-test` pedig a FAGYASZTOTT ágat rontja
   vissza, ami ezt a sávot meg sem érinti — enélkül az öt új állítás sosem lett volna piros.
   Őr: +10 állítás a `frozen-settle-check`-ben, HÁROM fixtúrával (van/nincs bizonylat/nincs
   adat), és egy állítás MEGMÉRI, hogy a link tényleg odavezet (3 sorból 1-re szűkít).
   ℹ️ A `hu-machine-form-check` közben a KÖZÖS park hiányzó előfizetés-sorára panaszkodott
   (feltétel nélkül fut, tehát MINDEN szál commitját blokkolta) — a saját javaslata szerint
   pótolva: `seed-park-subscription.mts --go` (idempotens, a valódi vásárlási láncot építi).
2. **Azonos percen belüli sorrend** (Elek FK-006b KÉZI KELL-1) — a rendezés determinisztikus
   (mérve), a kérdés csak az, MUTASSUNK-e másodpercet, vagy állapot-üzenet előzzön-e.
   Tulaj-döntés kell; a TERV-KESZ ⑦ pontja volt, nem dőlt el.
3. **A kétszer mondott képernyő-név** (`<h1>` + kártya `<h2>`, ~130px fülenként, Elek E5) —
   MINDEN admin-fület érint, ezért szándékosan külön körbe való.
4. **Lapozás / dátum-csoportok** — a „B" változat kínálta, a tulaj a „C"-t választotta. A
   lista 22 sorra rövidült, de a 19 SZÁMLA-sor megmarad; ha zavaró, az külön kérdés
   (pl. év szerinti csoportosítás), nem ezé a tervé.
5. ⚠️ **A szűrő-sáv 390px-en 205px magas** (mérve) — ennyi megy el a telefonon, mielőtt az
   első üzenet látszik. A kontraktus ⑥ kimondja; ha sok, összecsukható, de az külön terv-kör.
6. ℹ️ **Az ELEK-tenant hiányzik a parkból**, ezért az FK-001 újrafuttatása ezen a felületen
   még nem történt meg — az ügy-nézetet a `messagesSection()` közvetlen renderelésével és a
   `kb-shot` fixture-ével mértem, nem élő végigjátszással.
