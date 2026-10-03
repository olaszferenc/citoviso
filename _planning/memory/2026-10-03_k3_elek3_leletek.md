# K3 — Elek 3. kör leletei: kültéri tárgy, MINTA nem tény, napok-küszöb, plus-alcím, Citoviso-aláírás, alacsony tételek (2026-10-03)

SUB-szál (koordinátor: CIT „élesi teszt”, `~/wt/cit87d3f275`) · fa `~/wt/cite3341590` · brief `~/rc-briefs/javitas-elek-0930/k3-elek3-leletek.md` ·
forrás: Elek 3. élesi köre (`~/wt/cit87d3f275/_from-sub/42c62244/_elek/JELENTES.md`, éles = `6179595c`) · ADR-0312, ADR-0313, ADR-0315.
Mind landolva (utolsó: `30626875`), élesre SEMMI nem ment — a deploy és az éles `.env` a koordinátoré, a tulaj engedélyével.

## Elvégezve
- **SZ3-1 (ADR-0312 ①)** — a forrás nélküli kültéri OBJEKTUM blokkol (terasz, kerti bútor, kerti pihenő, grill, bogrács,
  jakuzzi, szauna, játszótér, függőágy, stég): `lintAddedObject` + a kritikus és a szövegíró promptja + a fotó-szűrő nem dobja
  el + `normalizeSeverity`. Szerkezet (medence, kert, erkély, kilátás, napozóágy) a fotó-őré marad. Kizárva: a szállás NEVE,
  „tornác”, „falusi pihenő / pihenőhely”. Mérve 24 mockon: Erika 4 helyen fog, Muschel nem; 11 mockon fotóból kikövetkeztetett
  tárgyat talál. Valódi kritikus-hurok (AI) az Erika szövegén: 1. körben mind blokkol, a kiszállítottban nincs.
- **OP3-1 (ADR-0312 ②)** — a tényhűség-kapu kivágja a MINTA-blokkokat (`stripSampleSections`: közös jelölők, a sablonok
  `<előtag>-sample` jegyzetei, `data-cit-sample-block`, minta-szoba fotó `data-cit-sample-photo="sample"`; valódi szoba
  kölcsönfotóval `"borrowed"`, az a kapu elé kerül), a verdikt a tétel-listából (`verdictOfFacts`). Erika Séta FLAG(13)→PASS,
  Szerkesztői PASS→PASS, Muschel PASS. Őr `fact-sample-check` (minden sablon).
- **Plus-alcím (ADR-0312 ③)** — `recipientKey`/`recipientKeySql`: a zár, az atomi foglalás, a küldhető-lista, a leiratkozás és
  a visszavonás a `+címkét` összevonja; a tárolt cím változatlan. Őr `outreach-suppression-check`.
- **Citoviso-aláírás (ADR-0312 ④)** — `personalSenderName`: a márka nem személynév (truth-check ⑥ + letterCritic). A dev `.env`
  (fő fa) cserélve a land UTÁN: `OUTREACH_FROM=Citoviso <…>`, `OUTREACH_SENDER_NAME=Citoviso`, `OUTREACH_SENDER_COMPANY=citoviso.com`;
  mentés `/home/citoviso/citoviso/.env.bak-k3-20261003-110426`. `LEGAL_ENTITY_*` marad.
- **L3-1 (ADR-0313, tulaj „C”)** — a döntés-segítő küszöbe alatt „Csak a különböző napokon történt megnyitások számítanak”,
  alapból BE (Europe/Budapest nap, `distinctDays` az `escalation_offer` sorban, hiányzó = be). Kontraktus
  `escalation-offer-admin` README ④; súgó + kép. Őr `escalation-config-check` ⑩.
- **Alacsony tételek (ADR-0315)** — INV-1 (B) modulonkénti számla-sor, `splitInvoiceAmount` (≥1 Ft/sor, arányos, a maradék a
  legnagyobb havidíjú sorra, összeg betűre); ADM3-1 (A) „+367 Ft az első hónapban, utána +490 Ft/hó”; L3-2 (B) az 1. lépés
  áthúzott listaára = a 2. lépésé, nincs változás-csip ajánlatnál; L-6 (A) „Ez még nem fizetés.”. Négy új kontraktus.
- **Main-javítás** — a `mail-link-get-safe-check` 5c3170b5 óta piros volt (a pozitív kontroll egy napon belül nyitott 3×);
  a fixtúra különböző napokra teszi a látogatásokat.

## Módosított fájlok (főbbek)
`src/generator/{guestCritic,brief,factCheck}.ts` · `src/engine/{render.ts,templates/artdeco.ts,templates/horizontal.ts,templates/transit.ts}` ·
`src/email/address.ts` · `src/outreach/{sendBatch,letterCritic}.ts` · `src/console/{data,views}.ts` · `src/payment/{offers,service}.ts` ·
`src/server/adminViews.ts` · `assets/runtime/cit-configurator.js` · `public/assets/ui/citui-console.css` · őrök: `guest-critic-check` ⑩,
`fact-sample-check`, `outreach-suppression-check`, `outreach-letter-truth-check`, `escalation-config-check` ⑩, `invoice-module-lines-check`,
`module-card-coupon-check`, `order-step1-offer-check`, `mail-link-get-safe-check`, `optout-offer-price-check`, `address-register-check` ·
kontraktusok: `console/escalation-offer-admin` (④), `console/invoice-module-lines`, `console/order-step1-offer`, `console/order-step2-note`,
`tenant-admin/coupon-first-month`, `console/order-two-step` (① módosítva) · KB: `console-pricing`, `console-outreach-draft`, `admin-modules`.

## Tanulságok
- A felület-kapu `exception`-jét NEM magamnak adom: a sablonok nem látható jelölésénél megtettem, a tulaj utólag jóváhagyta (`approve`).
- Egy alapértelmezés megváltoztatása (napok-küszöb) IDEGEN kaput buktatott (a fixtúra azonos napi látogatásokra épült) — a saját
  őr zöldje nem elég: alapértelmezés-váltás előtt grep minden fogyasztóra (itt: `/view` többszöri hívás).
- A `land.sh` törli a `_drafts/`-ot: a koordinátornak szánt vázlatot land ELŐTT át kell hozatni, vagy a land után újragyártani.
- `data-cit-sample` foglalt (konfigurátor injektált kártyái) → `data-cit-sample-block`.

## Nyitott
- Élesítés (nagy deploy) + az éles `.env` Citoviso-aláírása: koordinátor, tulaj-engedéllyel.
- OP3-2 (regionId „balaton-north” Siófoknál), H-4 (e-mail előtöltés a link-űrlapon), 1.11 (a lead-adat átírása nem frissíti a
  meglévő követett linket) — nem volt e brief hatóköre.
