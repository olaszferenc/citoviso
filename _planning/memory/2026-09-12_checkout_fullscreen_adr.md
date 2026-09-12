# 2026-09-12 — A fizetés pillanata: teljes felületű fizetés-lap + a tartós kötelezettség kimondása

**Kiindulás:** tulaj-bejelentés az Elek FK-005a köréből — a vásárlási panel valótlant
állít a pénzről, és a kötelező hozzájárulásokat elrejti.

## Mit mértem (mind az öt bejelentés IGAZ volt)

A valós renderelt panelen (`renderSite → injectRuntime → injectConfigurator`, nem fixture-ön):

| # | Bejelentés | Mérés |
|---|---|---|
| ① | a fejléc a fizetésnél is „Most nem fizet semmit" | IGAZ — a `.cit-cfg-head` a lépéstől független volt |
| ② | a pipák és a gomb a nézeten kívül | IGAZ — `.cit-cfg-step3` görgőablak **276px**, tartalom **1284px**; gomb `y≈1766` / 844px, mind a 3 pipa kívül; **asztali 900px-en is** kívül (`y≈1424`) |
| ③ | a jogi szöveg mondat közepén elvágva | IGAZ — a 399 karakteres törvényi szöveg a panel alsó élénél végződött |
| ④ | a visszaigazolás hallgat a megújulásról | IGAZ |
| ⑤ | „Belépés: /login" | IGAZ — `config.publicSiteUrl` üresen fél útvonalat írt ki |

ÁFA-utalás az egész úton sehol — igaz.

## §2b terv-kör

3 működő változat (`_drafts/checkout-A|B|C`), mindegyik méret-váltóval, valós adattal,
a VÁRT funkciókkal (pipa-kapu, számláló, „Teljes szöveg" nyitó, Fizetek → visszaigazolás).
Mind a 6 kombináció (3 változat × 2 méret) mérve + 22 viselkedés-állítás változatonként,
a képeket Read-del megnéztem, a tulajnak elküldtem mindkét méretet.

**Tulaj döntése: „C — teljes felületű fizetés-lap" + a visszaigazolás mind a 6 ténnyel.**
Kontraktus befagyasztva: `assets/design-refs/configurator/checkout-fullscreen/`
(plan.html + README 13 kötő ponttal + 4 kép).

## Szállítva

- **A fizetés-lépés elhagyja a 440px-es fiókot** (`.cit-cfg-panel--billing`): mobilon
  teljes képernyő, asztalin kéthasábos checkout (bal: űrlap, jobb: álló összegző kártya).
  Három zóna, amiből **egy** görgethető: `co-bar` / `co-scroll` / `co-act`.
- **Lépés-függő fejléc** (`setStrap`): a fizetés-lapon megnevezi a terhelést és az összeget.
- **Pipa-kapu** (`syncConsents`): a gomb tiltott, amíg mind nincs bejelölve; a jegyzet
  számlál (`0/3`), cég ágon `0/2`; a tiltott gombra koppintva pirosra vált a hiányzó sor.
- **Rövid, EGÉSZ MONDAT jogi sorok** (`legal.ts` `*_SHORT_V1`) + a törvényi szöveg
  helyben nyílik. A bélyegzett szöveg változatlanul a teljes (§H.22).
- **ÁFA-sor** (`VAT_NOTE_AAM` / `VAT_NOTE_REVERSE_CHARGE`) — a manifesten át, hogy az
  invoice `vatKey`-ével mozogjon, ne a runtime JS-ben legyen beégetve.
- **„A következő terhelés …"** a fizetés ELŐTT, dátummal és listaárral.
- **Visszaigazolás: „AZ ELŐFIZETÉSE" doboz** 6 ténnyel; a megújulás összegét a
  `renewalPreview()` ugyanúgy számolja, ahogy a `billing.ts` a rendelést kiállítja.
- **`/login` javítás:** abszolút URL híján NEM ír fél útvonalat, hanem az e-mailre utal.

## Őr

`scripts/checkout-viewport-check.mts` — **49 állítás**, a VALÓS renderelt panelen,
`elementFromPoint`-tal, 390px + desktop + cég-ág + visszaigazolás. Pre-commitban.
Piros önteszttel igazolva (5 bukás, pontosan a bejelentett hibát nevezi meg).

## ⛔ Három tanulság, mind mérésből

1. **A Playwright `check()`/`click()` auto-scrollja az `overflow:hidden` konténert is
   elgörgeti** — egy szándékosan elrontott vázlat emiatt 390px-en ZÖLDRE mért. A kapu
   ezért nullázza a görgetést a mérés előtt, és `evaluate()`-tel pipál, nem `check()`-kel.
2. **⚠️ Az Elek FK-005a a fizetés után ÁTLÉP a FŐ FA szerverére.** A mock `payUrl`
   abszolút (`PUBLIC_BASE_URL`, `src/payment/mock.ts`), így a 05/06 kép a `main`
   állapotát mutatja, nem a munkafáét. Fél órát kerestem egy „hiányzó" dobozt, ami a
   munkafa szerverén végig ott volt. **Munkafában végzett fizetés-utáni javítás az
   Elek-képen NEM látszik, amíg nem landol.**
3. **A `contract-drift-check` kötő-felirat mintája csak EGYENES záró idézőjelet fogadott
   el** — a magyar `”`-vel jelölt 7 feliratom NÉMÁN kimaradt a kapuból. Javítva (mindkettőt
   elfogadja), és az első futásán azonnal fogott egy valós eltérést a saját kontraktusomban.

## Nyitott

- A dev DB fordulónapja **2035-re csúszott** az FK-006 időutazó ismételt futásaitól — a
  visszaigazolás ezért „2035. 09. 10."-et mutat lokálban. Nem kód-hiba; a közös park
  torzítása. Éles adaton a `current_period_end` a valós dátum.
- A `.cit-cfg-panel--billing .cit-cfg-off-l4` a fizetés-lapon el van rejtve (duplikáció a
  `nextcharge` sorral) — step 1-en változatlanul látszik.
- Élesítés NINCS (§0.3).

**Módosított fájlok:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` ·
`src/legal.ts` · `src/generator/configurator.ts` · `src/console/views.ts` ·
`src/payment/service.ts` · `src/payment/billing.ts` · `scripts/checkout-viewport-check.mts` (új) ·
`scripts/billing-checkout-check.mts` · `scripts/contract-drift-check.mts` · `hooks/pre-commit` ·
`assets/design-refs/configurator/checkout-fullscreen/` (új kontraktus).
