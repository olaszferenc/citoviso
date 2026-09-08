# 2026-09-08 — ADR-0110: a generált tenant-oldal jogi lábazata (sütik helyett a valódi hiány)

## Kiváltó

Tulaj: *„az oldal építése közben kimaradt a sütik, a sütikezelés és annak elfogadása."*

## Amit a mérés talált — a kérdés átfordult

- **Süti-sáv nem kell, mert süti nincs.** Playwright, friss profil, teljes végiggörgetés egy
  legyártott ÉLŐ oldalon: **0 süti**. A beágyazott Google-térkép (`output=embed`) sem sütit, sem
  `localStorage`-ot nem ír — külön, first-party betöltéssel is mérve: üres. A `cit_session` /
  `cit_op_session` HttpOnly, technikailag szükséges → nem hozzájárulás-köteles.
- **Ami tényleg hiányzott:** a lábléc „Adatkezelés" linkje `href="#"` volt (13 sablon +
  `chrome.ts`), a tenant hoston `/adatvedelem` route nem is létezett — miközben az oldal **két
  űrlappal** gyűjt személyes adatot (`/api/foglalas`, `/api/velemeny`). Impresszum sem volt.
- **Harmadik felek tájékoztatás nélkül:** egy oldalbetöltésen `maps.googleapis.com` 15×,
  `www.google.com` 14×, `maps.gstatic.com` 2×; másik sablonon Google Fonts; plusz hotlinkelt
  portál-képek. Süti nincs, IP-továbbítás van.

⛔ **Tanulság:** a felvetést nem a szó szerinti formájában kell megoldani. Egy süti-sáv kitétele
elfedte volna az igazi jogsértést (tájékoztatás nélküli adatgyűjtés) egy sávval, ami semmiről
nem szól.

## §2b kapu

3 működő mock (A: sablonban · B: egy lap fülekkel + lábléc-sáv · C: dokumentum-elrendezés),
valós skin-tokenekkel, méret-váltóval, adathiány-kapcsolóval. Végigkattintva: **126/126 zöld,
0 JS-hiba**. Tulaj-döntés: **„C + B-lábléc"**, majd „indulhat a kód". Kontraktus befagyasztva:
`assets/design-refs/tenant-site/legal-footer/` (plan.html + README + 6 kép).

⚠️ A mockokban a mérés fogott meg egy néma törést: a 4 oszlopos jogi táblázat **444px** széles
egy 390px-es kereten belül, a „Meddig" oszlop levágódott — a screenshot zöld volt. Mobilon
kártya-listává rendezve javítva (`data-label`), a motorban is.

## Amit szállítottunk

- `src/legal.ts` — tenant jogi csomag adat-vezérelt blokkokkal (`dl`/`table`/`ul`), verziózva,
  i18n-exempt; `missingImprintFields()` a kötelező mezőkre (Eker.tv. 4. §, vevő-típus szerint).
- `src/engine/legalPages.ts` (ÚJ) — a két lap a szállás skinjében (asztali ragadós TJ +
  scroll-követés, mobil `<details>`, „Röviden" doboz), a lábléc **jogi sávja**, és a mock-ági
  link-eltávolítás. Nulla nyers hex; a hiány-jelölés a szállás akcent-színe (a 11 token közt
  nincs hiba-szín).
- `migrations/0056_tenant_legal.sql` + `src/tenant/legalIdentity.ts` — a PUBLIKÁLT jogi
  identitás, a checkout vevő-adatából előtöltve.
- `src/tenant/editor.ts` — a két lap a snapshot mellé íródik minden mentéskor;
  `src/tenant/multilangGenerate.ts` — a fizetett nyelvi verziók is kapják a jogi sávot.
- `src/server/public.ts` — `/adatvedelem` + `/impresszum` route a tenant hoston, `POST
  /admin/legal`, és a **vélemény-hozzájárulás SZERVER-oldali kapuja**.
- `assets/runtime/cit-runtime.js` — a foglalási űrlap adatkezelési sora (mondat, nem pipa).
- `src/server/adminViews.ts` — „Jogi adatok" panel a Fiók fülön, hiányzó kötelező mezőknél
  figyelmeztetéssel; `kb/entries/admin-legal` + kb-shot fixture.
- `scripts/tenant-legal-check.mts` — őr (pre-commit, DB/hálózat nélkül), önteszttel és
  böngészős `--browser` ággal.

## A látogatás-mérés adóssága, itt törlesztve

Az **ADR-0108 ②** szó szerint kimondta: *„az adatkezelési tájékoztatóba be kell kerülnie — ezt
nem ugorjuk át"*. Nem került bele. Most önálló szakaszt kapott (mit rögzítünk, mit NEM, napi
forgó azonosító = számláló nem profil, jogos érdek), és a „Röviden" doboz is kimondja, hogy
mérünk — a puszta „nem használunk sütit" technikailag igaz, gyakorlatilag félrevezető lett volna.

## A tudásbázis-őr 7 valós leletet fogott (mind javítva)

1. A mentés-gomb `citui-btn` **variáns nélkül** → háttér és keret nélküli félkövér szöveg.
2. A panel alji linkek csak ÉLŐ honlapnál léteznek — a KB feltétel nélkül ígérte őket.
3. ⛔ **A jogi sáv eltűnt, ha a tenantnak nem volt jogi adata** — és mivel a 13 sablon lábléce
   csak „Adatkezelés"-t hordoz, az **impresszum pont a hiányos tenantnál vált elérhetetlenné**.
   Most a sáv MINDIG megjelenik; a név/adószám benne opcionális, a két link nem.
4. A többnyelvű (`/de/`, `/en/`) aloldalak nem kaptak sávot → nem volt rajtuk impresszum-link.
5. ⛔ **Nem kötelező mező is hangosan kiabált** („NTAK: — nincs megadva —") a NYILVÁNOS
   impresszumon. A hangos jelölés csak a KÖTELEZŐ mezőké; az opcionális üres sor egyszerűen
   nem jelenik meg.
6. A panel telefon-mezője üres volt, miközben az impresszum a honlap telefonszámát publikálta
   (a fallback csak a renderelőben létezett) → **egy forrás** mindkét oldalra.
7. A KB-kép alján a fix mobil tab-sáv eltakarta azt a két linket, amire a szöveg mutat.

## Mérés (proof-of-work)

- `tenant-legal-check` (+`--self-test`, `--browser`): **zöld**, RED-ikrekkel.
- A VALÓDI legyártott oldalon 18/18 zöld (foglalási sor, kötelező pipa, jogi sáv, link → lap,
  0 JS-hiba, mobil+asztali).
- Szerver-kapu a DB-ben mérve: hozzájárulás nélkül **400 + nulla sor**; hozzájárulással átmegy
  és keletkezik sor (a teszt-sor törölve).
- `kb-check --coverage` 33/33 · i18n-lint · design-token-lint · `legal-check` · `tsc` — mind zöld.
- Route élesben: `/t/nyugalom-demo/adatvedelem` böngészőben kiszolgálva (kép).

## Nyitott

- **Nyelv:** a jogi lapok magyarul élnek (jogi csomag, nem fordítás). A többnyelvű modulhoz
  saját jogi csomag kell országonként — külön szelet.
- **Google Fonts self-host:** megszüntetné a font-célú IP-továbbítást (a térkép tulaj-döntés,
  ADR-0092).
- **Élesítés NINCS** (§0.3): a 0056 migráció egyelőre lokál.
- A régi, ADR-0110 előtt provisionált oldalak jogi lapja az első tartalom-mentéskor
  (vagy egy `rerenderTenantSnapshot` körrel) jön létre.
