# 2026-09-28 — A vendég oldala: a „Foglalás” rossz választót állított, üres felugró, összetapadt kártya, a „Mégsem” zsákutcája

Brief: `~/rc-briefs/vendeg-oldal-egesz-szallas.md` (SUB, koordinátor `citded06a5f-cc`). Alany: Három Huszár
Apartments (`harom-huszar-apartments`). A mérés a fő fa :4800-án (origin/main = 88f14ecb) és a saját fában.

## Mit mértünk, mi lett belőle

| # | Bejelentés | Mérve | Ítélet |
|---|---|---|---|
| ② | „Mégsem — megtartom” → ERR_CONNECTION_REFUSED | A lemondó lapot prod `PUBLIC_SITE_URL`-lel renderelve a link `https://<slug>.citoviso.com`; a tenant host (`Host: <slug>.citoviso.com`) `/`-je 200 | **Élesben helyes. Mérőeszköz-hiba:** az Elek-runner saját efemer szervert indít, de a `tenantSiteUrl` a `config.publicSiteUrl`-ből, azaz a FŐ FA :4800-ából építi a visszautat (a pay-link csapda párja). Az FK-016 alatt a :4800 épp újraindult. Javítva: `elek/bin/runner.mts` a saját szerverére állítja |
| ÚJ | — | A kártya „Foglalás”-a a widgetet NEM állította: `document.querySelector('[name="unit"]')` a **vélemény-űrlap** választóját adta („Hol szállt meg nálunk?”), mert az a widget fölött áll. „A szállás egésze” gomb → a widget a Nádas apartmanon maradt | **Valódi, súlyos hiba**, minden olyan lapon, ahol a vélemény-űrlap a foglalás előtt áll. Javítva: `#cit-unit`. Az őr (`room-details-check` ①b) UGYANAZT a választót kérdezte, ezért ZÖLDEN védte a hibát |
| ① felugró | fekete fotódoboz | `show()` fotó nélkül korán visszatért: a stage és két élő nyíl kint maradt | Javítva: fotó nélkül a galéria `hidden` (+ CSS `[hidden]` ismétlés, mert a `display:flex` üti), a szöveg a × alá lép (`data-nophoto`). A 390-es foglalás-gomb a mai fő fán LÁTSZIK a felugróban |
| ③ | „Nádas apartman4 fő24 000 Ft / éj” | a közös tartalék kártyán a héj (`display:block`) a korábbi oszlop-flex gyerekeit inline sorrá tette | Javítva: `.cit-modsec__room.cit-room__open` oszlop-flex |
| ① ár | az ár nélküli „egész” foglalás-gombbal | a widget erre az egységre árajánlat-módba vált, tehát az út járható — a kártya nem mondja meg | **§2b:** A/B/C mock → a tulaj: **„C”**. Megvalósítva: `splitWholeBand`/`injectWholeBand` (render.ts) + `wholeBandBlock` (moduleSections.ts) — mind a 19 sablonon a rácsban csak a szobák, alattuk a sáv; ár nélkül „Egyedi ár”, „Részletek és árajánlat”, a felugróban „Árajánlatot kérek”. Kontraktus `design-refs/tenant-site/whole-unit-band/` |

## Az őr bővítése (`scripts/room-details-check.mts`)

- fixture: 4. egység FOTÓ NÉLKÜL + vélemény-űrlap egység-választóval (a csapda előfeltétele, és ha hiányzik, az őr kimondja);
- OUTCOME-állítás: a felugró „Foglalás”-a után a `#cit-unit` értéke = az egység (nem csak az attribútum);
- „összetapadt kártya-szöveg” a kirajzolt `innerText`-en; „üres fotódoboz fotó nélkül” (csak ha a kártyán sincs kép —
  a három szikár sablon `roomsForMock`-kal a ház képét kölcsönzi, ott joggal van kép);
- 3 új visszarontás; a tartalék-kártyásat csak a tartalék kártyát rajzoló sablonokon méri (`onlyFallback`).

## Tanulság

- **A választót ID-vel, ne névvel.** Egy lapon két `name="unit"` él (vélemény + foglalás); az „első” a DOM-sorrend
  véletlene. Az őr ugyanazzal a feltevéssel mérte → közös vakfolt. Negatív kontroll: a fixture-ben KELL a második választó.
- **A mérőeszköz visszaútja is a mért fára mutasson** — nem csak a pay-link. Ami abszolút URL-t épít `config`-ból, az a
  runnerben a fő fára visz.

## Igazolás — és egy csapda

- `room-details-check`: 38/38 zöld; `--selftest`: a kontroll zöld, és minden visszarontás pirosra viszi a kaput.
- FK-014 (a javítás UTÁN, 15:48 UTC): 1 pass · 2 fail · 18 kézi. **Mindkét fail környezeti**: ⑥ a várt „48 000”
  helyett 56 000 — egy másik szál 17:43-kor felvitte az „Őszi szünet” (10-23…11-02, 28 000 Ft) szezont, tehát a helyes
  ár 2×28 000; ⑧ „Már küldött véleményt” — Elek egy korábbi körben már írt. A forgatókönyv két elvárása a közös parkon
  elavult, a felület nem.
- ⛔⛔ **A futás a kártyákat MÉG ÖSSZETAPADVA mutatta** — mert a runtime JS/CSS a bérlő STATIKUS pillanatképébe
  (`sites/<tenant>/index.html`) van BEÉGETVE a renderelés pillanatában. Egy runtime-javítás a vendégnél csak
  `npx tsx scripts/rerender-tenant.mts <slug>|--all` után él. **Élesítéskor is: a nagy deploy után `--all` kell**,
  különben minden bérlő a régi runtime-ot futtatja (a `deploy-prod.sh` ezt ma NEM csinálja).

## Módosított fájlok

`assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css` · `elek/bin/runner.mts` ·
`scripts/room-details-check.mts` · ez a jegyzet · a C: `src/engine/render.ts` · `src/engine/moduleSections.ts` ·
`src/engine/templateKit.ts` · `src/engine/recipe.ts` · `src/i18n/catalog.json` · `assets/design-refs/tenant-site/whole-unit-band/`. Döntési anyag (gitignore-olt): `assets/design-refs/_drafts/whole-unit-price/`.

## Egy rendszer, két állapot (a testvér-szállal, cit2cd9905d-19, ADR-0257)

A „csak egyben adom ki” (ADR-0257) ugyanezt a sávot használja: `data-cit-whole-mode="main"` (a `Room.wholeOnly`-ból),
a szobák ELŐTT. A mód-váltó és a helye (előtte/utána) a sávban él; a „main” kinézete és a bemutató-szobák a testvér-száléi.

## Nyitva

- Admin-javaslat (a tulaj még nem döntött): a „Kiadom egyben is” pipánál az egész ház árának bekérése, vagy kimondott „ajánlatot adok”.
- A kompozíciós (nem-sablonos) render-út nem kapja a sávot — élő bérlő ma mind sablonos; ha változik, ott is kell.
- A lemondó lapon nincs kattintható szállásadó-elérhetőség (ítélet-kör FK-016/2) — nem ennek a briefnek a része.
