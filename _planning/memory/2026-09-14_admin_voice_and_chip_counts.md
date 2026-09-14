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
