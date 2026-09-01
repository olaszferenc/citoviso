# 2026-08-28/29 — A többnyelvű modul ÉLES TESZTJE: három hiba, három szerkezeti javítás (+ a doktrína, ami a munkafával fagy be)

## A kiindulás
A tulaj a teszt-környezetben **végigvitt egy valódi vásárlást** (Barion sandbox,
14 900 Ft, sikeres fizetés) a saját tenantján — és három hibát talált. Mindhárom
olyan, amit fejlesztői „körbekattintás" nem mutatott volna meg.

## ① Nem állítottunk ki SZÁMLÁT (jogi/pénzügyi)

**Mérve:** a `multilang_generation` sora `done`, a fizetés `paid`, de az `invoice`
sor `status='failed'`, indoklás: *„Nincs számlázási nyilatkozat az orderen"*.
A multilang `order_intent`-en `buyer_name: null` — a 0029-es kapu (helyesen) nem
enged fabrikált vevővel bizonylatot kiállítani.

**Javítás:** a multilang-rendelés **ÖRÖKLI** a vevő-azonosságot a tenant korábbi
(initial) rendeléséről — ugyanaz a jogi személy, aki checkoutkor nyilatkozott —, és
**fail closed**: ha nincs honnan örökölni, **nincs pay-link**. Számlázhatatlan pénzt
nem veszünk el.

## ② A fizetés utáni oldal a ROSSZ kérdésre válaszolt

A multilang-vásárlás után az élesítés-oldal jött („itt az oldalad, itt a belépési
adatod") — ugyanaz, mint előfizetéskor. Ennek a vevőnek MÁR van oldala és belépése.
Külön oldal a rendelés `kind`-je alapján: fizetés rendben → a fordítás fut / kész +
a nyelvi linkek + a számla útja + vissza az adminba.

## ③ A látogató nem tudott nyelvet váltani — pedig a kapcsoló „ott volt"

**Az ok:** a kapcsoló benne volt a HTML-ben, de `z-index:60`-nal, a sablonok saját
fejléce viszont `z-index:100` — **a fejléc alatt ült, láthatatlanul**. Az akkori őr
azt mérte, hogy *benne van-e a HTML-ben*. A kényelmes proxy klasszikus hibája:
zöld kapu fizető ügyfél mellett, akinek a funkció nem létezik.

**A tulaj kérdése döntötte el a tervezést:** *„mi van a többi mock típussal?"* —
ezért mind a **16 sablonon, mindkét nézetben (32 eset)** mértünk, és kiderült, hogy
EGYIK kézenfekvő elhelyezés sem jó: a felső sáv 5 sablonon takarásba kerül, a lebegő
chip 6-on ráül az „Érdeklődés küldése" gombra, a menübe szőtt chip pedig mobilon 6
sablonnál eltűnik (ott rejtett a nav).

**A jóváhagyott megoldás (hibrid):** asztalin a chip a sablon SAJÁT menüsorába
szövődik (a sablon elrendezése tartja meg → nem takarhat CTA-t); mobilon külön sáv a
lap tetején, **nem sticky**, és a lap saját FIX fejlécét egy **számított** réteg
tolja lejjebb — sablon-lista nélkül. Zászló + a nyelv saját neve (inline SVG).
Kontraktus: `assets/design-refs/tenant-site/README.md`.

**Új őr:** `scripts/lang-switcher-visibility-check.mts` — böngészőben azt méri, amit
a LÁTOGATÓ lát (elementFromPoint a kapcsoló középpontján, átfedés a lap linkjeivel,
van-e elérhető kapcsoló mindkét nézetben, kigörög-e a sáv). Piros önteszt: a hibát
ÚGY állítja elő, ahogy élesben történt. Az őr azonnal elkapta a saját friss hibáimat
is (fix nav alá csúszó sáv 5 sablonon; két hamis sticky-riasztás rövid lapon).

## ④ A nap legfontosabb tanulsága: A DOKTRÍNA IS ELAVUL A MUNKAFÁBAN

A terv-kaput követve a **kivezetett** külső design-appba akartam tervet tölteni.
Nem hanyagságból: a fám **12 committal le volt maradva**, és abban a `CLAUDE.md` még
az előző napi szabályt írta. A repóban élő §2b-hook sem szólt — **az is csak a
main-en létezett** —, a kapott hook-üzenet pedig a régi szöveget mondta.

⛔ **Repóbeli őr nem tudja megvédeni a lemaradt fát.** Ezért az elavultság-őr a
repón KÍVÜL él: `~/.claude/hooks/block_stale_doctrine.sh`, a GLOBÁLIS
`settings.json`-ból, minden session és munkafa alá. Méri: a fa `HEAD:CLAUDE.md`-je
= `origin/main:CLAUDE.md`? Eltérés → BLOKK. (A munkamásolat eltérése nem blokkol:
doktrína-írás közben ne bénítson.) A `ui-shot-nudge` pedig már a CLAUDE.md ÉLŐ §2b
szakaszából idéz — nincs második példány. → **ADR-0079**.

⭐ Az őr **a szerzőjén is fogott**: e session zárásakor engem blokkolt le (45 commit
lemaradás), mielőtt a jegyzetet írtam volna. Ez a bizonyíték, hogy nem dísz.

Saját őr-buktató tanulságnak: az első verzióm ÚTVONAL alapján ismerte fel a repót,
ezért a `/tmp`-ben álló piros teszt-fát némán átengedte. Egy őr, ami csak a
megszokott helyen fog, nem őr — a felismerés azóta a remote URL-ből megy.

## Ami még ebben a szálban készült (korábbi menetek)
- **ADR-0063** többnyelvű modul (egyszeri díj, fizetett tartalom-hash, stale→újrafizetés).
- **ADR-0067 ①②③** — a vevőnek KÜLDÖTT szöveg is a vevő nyelvén: teljes levél-lánc
  (tenant + a tenant VENDÉGEI), tenant-admin, majd a belső konzol (operátoronkénti
  nyelv, `operator_user.lang`, 0037). Pszeudo-nyelv kapu az ékezet-heurisztika
  vakfoltjára (az „1 db" ékezet nélküli szivárgás kapcsán).
- **ADR-0070 ②③** — a hideg megkeresés a lead nyelvén; az őr-hatókör SZÁRMAZTATOTT
  (import-gráf a levél-adaptertől), futásidejű kapu: hiányos csomagnál nem küldünk.

## Módosított / létrehozott fájlok (fő tételek)
- `src/tenant/multilangOrder.ts` (számlázási azonosság öröklése, fail-closed)
- `src/console/server.ts`, `src/console/views.ts` (multilang visszatérési oldal)
- `src/tenant/multilangCore.ts` (jóváhagyott nyelvváltó), `src/ui/flags.ts`
- `scripts/lang-switcher-visibility-check.mts` (ÚJ őr), `scripts/lang-switcher-{plan,mock}.mts`
- `assets/design-refs/tenant-site/` (jóváhagyott terv + README-kontraktus + mérés)
- `hooks/pre-commit`, `scripts/ui-shot-nudge.mjs`, `CLAUDE.md`, `_planning/DECISIONS.md`
- **repón kívül:** `~/.claude/hooks/block_stale_doctrine.sh` + globális `settings.json`

## Nyitott kérdések / következő lépés
1. **A teszt-vásárlás számlája `failed` maradt** (a javítás előtt jött létre). Vagy
   újrafuttatjuk rá a számlázást, vagy egy friss sandbox-vásárlás mutatja meg a
   helyes bizonylatot végig.
2. **Élesítés nem történt** (§0.3): a 0036/0037 migráció és az egész nyelvi réteg
   lokálban él; a prod több hasznos javítással is el van maradva — külön, kimondott
   engedéllyel vihető ki.
3. A `documents-paging-check` DB-függése (másik szál nyitott csapdája) itt is
   blokkolt egy commitot; ideiglenesen hangos KIHAGYÁS-ra állítva üres adaton.
