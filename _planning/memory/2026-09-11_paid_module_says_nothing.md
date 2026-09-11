# 2026-09-11 — A kifizetett modul ugyanazt a képernyőt adta vissza (Elek FK-005b)

## A kiváltó (tulajdonosi bejelentés, mérve)

Az ügyfél kifizetett 14 900 Ft-ot a Többnyelvű honlap modulért, és a Modulok oldal
fizetés ELŐTT és UTÁN **bájtra közel azonos** volt (1280×3518 px-ből három keskeny sáv:
egy jelvény-szám és a három nyelv pipájának kiürülése). Se „kifizetve", se összeg, se
hivatkozás — a „Fizetés és generálás (14 900 Ft)" gomb pedig **változatlanul aktív**
maradt. A vásárló nem tudta eldönteni, hogy egy újabb kattintás új megrendelést indít-e.

Négy hiba, mind reprodukálva (`npx tsx elek/bin/run-all.mts FK-005b`, 2026-09-11 07:51):

1. **A kártya vak volt a fizetésre.** Az egyetlen zöld sor („A fordítás készül") a
   generálás ÁLLAPOTÁBÓL jött, nem a fizetésből — és egy KORÁBBI futás ottfelejtett
   sorából, tehát már a fizetés előtt is ott volt. Nulla információt hordozott.
2. **A visszaigazolás egy ÚJ ÜGYFÉL üdvözlő oldala volt** (belépési adatok, /login,
   „Belépek és szerkesztem"). A `/pay/done` route már helyesen szétválasztott kind
   szerint — de a mock gomb POST-ja NEM azon ment át, hanem saját másolatot rendert.
3. **A bukás-oldalon egyetlen gomb sem volt**, csak egy e-mail cím, és nem volt
   tranzakció-azonosító, amit idézni lehetne.
4. **Elutasítás után a fizetőoldal képe bájtra azonos** volt a fizetés előttivel:
   a böngésző az előzmény-gyorsítótárból szolgálta ki („pending", mindkét gomb élő).

## Amit csináltunk

- **A nyugta a kártyán** (`src/tenant/multilangCard.ts` — új; `paidStateOf()`): a kártya a
  FIZETÉSRE horgonyoz, nem a generálás haladására. Kiírja: Kifizetve — összeg · időpont ·
  megvásárolt nyelvek · hivatkozási azonosító, és a fázist (készül / megakadt / hibázott).
- **A gomb halott, a pipák befagynak**, de ⛔ a kapu az ÍRÁSON ül (ADR-0113 ⑤):
  `multilangPurchaseBlockedReason()` a `createMultilangOrder()` elején — kézzel gyártott
  POST sem rendelhet másodszor ugyanarra a tételre.
- **EGY kimenet-renderelő:** a `/pay/mock/:ref/(paid|failed)` POST 303-mal átadja a
  `/pay/done`-nak (az éles gateway útja), így a kind-szerinti szétválasztás egy helyen él.
  A dupla-terhelés elleni `alreadySettled` ág ÉRINTETLEN maradt (tulajdonosi kérés).
- **Bukás-oldal:** valódi `citui-btn` újrapróbálás-gomb (a korábbi `class="btn"`-nek NINCS
  szabálya a konzol stíluslapján → csupasz linkként jelent meg) + hivatkozási azonosító.
- **Fizetőoldal:** `Cache-Control: no-store` + látható státusz-sáv és magyar státusz-szó.
- **Őr:** `scripts/module-purchase-state-check.mts` — saját eldobható fixture, a fizetés
  ELŐTTI és UTÁNI kártyát HASONLÍTJA, és `--self-test` módban a javítás előtti nézeten
  MINDEN mérésnek pirosnak kell lennie. Mindkét irány futtatva, zöld.

## Két csapda, amit menet közben mértünk

- **Az Elek-futó a MÁSIK fát mérte.** A tenant-admin forgatókönyv csak a public szervert
  bootolta in-process; a fizetőoldal a `PUBLIC_BASE_URL`-ből jött, azaz a FŐ FA :4600-as
  konzoljából. Négy javítás benne volt a munkafában, a futás hiányzónak jelentette őket.
  A `runner.mts` most a konzolt is in-process bootolja és arra irányítja a pay-linket.
- **A park egy-lövetű.** A kifizetett, le nem szállított generálás (helyesen) zárja az
  írás-kaput, ezért az FK-005b másodszorra nem tudott fizetést indítani. A `run-all.mts`
  park-lépésben törli az ELEK-site korábbi nyelv-generálásait (a megrendelés/fizetés/
  számla érintetlen) — ugyanaz az elv, mint a követett link újra-felhúzása.

## Módosított / létrehozott fájlok

- `src/tenant/multilangCard.ts` (ÚJ) — kártya-adat + `paidStateOf` + írás-kapu
- `src/tenant/multilangOrder.ts` — az írás-kapu bekötése
- `src/server/adminViews.ts` — nyugta-blokk, befagyott pipák, halott gomb, `MultilangPaidState`
- `src/server/public.ts` — a kártya-adat összeállítása kiköltözött
- `src/console/views.ts` — bukás-oldal (gomb + hivatkozás), fizetőoldal státusz-sáv
- `src/console/server.ts` — mock POST → 303 `/pay/done`, `no-store` a fizetőoldalon
- `scripts/module-purchase-state-check.mts` (ÚJ) — az őr, önteszttel
- `scripts/multilang-resume-stalled.mts` (ÚJ) — az elakadt, KIFIZETETT generálás újraindítója
- `elek/bin/runner.mts` — in-process konzol + `újratöltés` akció
- `elek/bin/run-all.mts` — park: a modul-vásárlás újra megvehető állapotba áll
- `elek/scenarios/FK-005b-payment-failure-matrix.md` — 8 gépi mérés (volt 5), újratöltés-ág
- `kb/entries/admin-multilang/entry.hu.md` — a „Kifizetve" állapot és a bukás-ág leírása

## Nyitott

- **Az elakadt generálás nem gyógyul MAGÁTÓL.** A generálás detached fut, egy szerver-
  újraindítás elvágja (mérve: két sor ragadt be, az egyik 12 órás). A kártya ezt kimondja,
  és a `multilang-resume-stalled.mts --go` újraindítja — de nincs időzítő, ami magától
  megtenné. Ha kell: óránkénti karbantartó + retry-számláló (új oszlop).
- **Lejárt fizetési link: NINCS ilyen állapot a termékben** (a `payment` sorhoz nem
  tartozik lejárat, a mock pay-link időtlen). Forgatókönyvet írni rá kitalált viselkedést
  mérne — ADR kell előbb (mennyi idő, mit lát a vevő, újragyártható-e a link).
