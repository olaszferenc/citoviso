# 2026-09-12 — A lista SORA mondja meg, miről szól (Elek FK-001 · ADR-0125)

**Kiváltó:** az Elek FK-001 újramérése a friss mainen (`23a1114`).
Lelet-forrás: `elek/runs/FK-001-2026-09-12T10-27-19/LELETEK.md` (E1, Z1, Z2).
Döntés: **ADR-0125**. Kontraktus: `assets/design-refs/tenant-admin/fk001-dokumentumok-uzenetek/`.

## A nap lényege

Három lelet, egy hibaosztály: **az adat MEGVOLT, csak nem jutott el a SORIG.** Ezért
maradt volna zöld minden egység-teszt — és ezért mér az új őr a **kirenderelt listán**.

## Amit MÉRTEM (nem feltételeztem)

- **18 számla-sor = KÉT termék.** A dev-parkban: `11 × initial/annual @ 99 900 Ft` +
  `7 × multilang @ 14 900 Ft`, összesen 1 149 525 Ft. A soron egyik sem volt megnevezve.
- ⛔ **A számla-LEVÉL tárgya is hazudott, és ezt senki nem jelentette be:** minden
  számláé „Citoviso előfizetés” volt — a 14 900 Ft-os EGYSZERI többnyelvű díjé is. A
  felület-lelet mellett ez a súlyosabb, mert kimegy a vevőnek (§B.17).
- **A Z2 bejelentés betű szerint PONTATLAN volt:** a kódban VAN külön SMS-ikon és cián
  háttér (`adm-msg__ch--sms`), és a dev-parkban **119 üzenetből 0 az SMS** — tehát „mind
  ugyanaz az ikon” azért állt, mert mind e-mail. A PREMISSZA viszont igaz: 19 px-es ikon
  nem felirat, és a kérdést („melyiken jött?”) a SORNAK kell megválaszolnia.
  (`feedback_measure_the_premise_not_the_request`)
- **Z1 zaj vs. hiány:** 50 dunning-üzenet **8 freeze→thaw körből** — a MENNYISÉG park-zaj
  (az FK-006 séták nyoma), de **már EGY kör is négy túlhaladott értesítőt hagy**, ami
  ellentmond a fiók mai állapotának. A termék-hiány tehát valós, a tömeg nem az.

## Szállítva

1. **`src/billing/invoiceItem.ts`** — EGY regiszter: `order_intent.kind` + `billing_period`
   → tétel-kulcs → lokalizált név. **Ugyanaz a két oszlop, amiből az ÖSSZEG is származik.**
   Kiszolgálja a Dokumentumok sort ÉS a számla-levél tárgyát/törzsét.
2. **`src/tenant/messageThreads.ts`** — a túlhaladottság LEVEZETETT szál-pozíció, nem tárolt
   flag és nem tárgy-szöveg elemzése. Szál-regiszter: `dunning` (tenantonként egy),
   `multilang` (tenantonként egy), `booking` (`related_id`-nként). ⛔ KIMARAD: `invoice`,
   `credentials`, `review`, `traffic`, a `domain` (related_id nélkül naplóz → két webcím egy
   szálba esne) és az érdeklődés-ág. Nem mérhető → nem állítjuk.
3. **Felület:** tétel a főcímben · `E-mail`/`SMS` felirat a soron · `Túlhaladott` +
   „Felülírta: «…» · időpont” · `Ez a legfrissebb` a szálfejen. A túlhaladott sor **nyitható
   és kereshető marad** — állapot-jelölés, nem cenzúra.
4. **Őr:** `scripts/admin-list-labels-check.mts`, hermetikus fixture, pre-commitban.
   Pozitív: minden zöld. **Negatív önteszt: 7 sértés**, köztük mind a három bejelentett.

## Tanulságok (mind SAJÁT hibából, ebben a körben)

- ⛔ **A szűrő termelte volna a hazugságot.** Ha a szál-pozíciót a SZŰRT listán számolnám,
  „SMS” szűrőben egy régi SMS „legfrissebb”-nek látszana, mert az őt felülíró e-mail
  kiesett. Ezért költözött a szűrés az SQL-ből a `listTenantMessages()` JS-ágába, a
  pozicionálás UTÁNRA. Az őr ⑤ pontja pont ezt pinezi.
- ⛔ **CSS-specificitás, harmadszor:** a mock első desktop képén MINDKÉT számla-elrendezés
  egyszerre renderelt, mert `.adm-inv__t strong` (0,1,1) veri a `.inv-no{display:none}`-t
  (0,1,0). **A kép fogta meg, nem a kód olvasása.**
- ⛔ **A saját viselkedés-ellenőrzőm sem fogta meg elsőre:** csak azt mérte, hogy a MÁSIK
  elrendezés MEGJELENIK. A mérce azóta: **pontosan EGY** főcím látszik.
- ⛔ **A sor-daraboló parser-hibája terméknek látszott:** `adm-inv[^"]*` illeszkedett az
  `adm-inv__t`/`__r`-re is → 7 sorból 28. Szó-határ kellett.
- ⛔ **A csatorna-állítás önteszt NÉLKÜL hamis bizonyíték lett volna:** a felirat a
  MARKUPBAN él, adat-rontással nem vihető pirosra. Az önteszt ezért a FIX ELŐTTI sort
  állítja vissza (kiveszi a `adm-msg__chan` spant).
- ⛔ **A mock saját minta-adata §B.17-et sértett:** az első vágásban a minta-SMS ÚJABB volt a
  visszakapcsolásnál, így az lett a szálfej, és a C-változat állapot-sávja ellentmondott a
  saját listájának. Javítva: a T+7 SMS-iker a levél-párja MELLETT áll (ahogy a valóságban).

## ⚠️ INFRASTRUKTÚRA-ÜTKÖZÉS (a tulajnak szól)

**Ebben a worktree-ben (`~/wt/cit2167c7de`) KÉT Claude-session dolgozott egyszerre** — az
enyém (FK-001) és egy „modules-annual-pricing” (FK-002) szál. Menet közben valaki
`git stash` + rebase-t futtatott (HEAD `eaff35a` → `23a1114`), és **a munkám eltűnt a
munkafából**; a stash a KÉT session változásait KEVERTE. Kezelés:
- a stasht **nem popoltam** (az övék benne volt), csak a 100%-ban saját fájljaimat hoztam ki;
- a commit **hunk-szinten szűrt** (`adminViews.ts` 11/19, `citui-admin.css` 3/5 hunk enyém),
  sáv- ÉS tartalom-kereszt-ellenőrzéssel, ami hangosan megáll eldönthetetlen hunknál;
- a `catalog.json`-t **a staged forrásból regeneráltam**, nem a munkafáéból;
- a staged pillanatképet **külön kicsomagolva** fordítottam és kapuztam (`/tmp/verify-fk001`),
  hogy ne az ő változásaikra támaszkodva legyen zöld.

**Az auto-worktree pool ezt hivatott megelőzni** (CLAUDE.md §8) — érdemes megnézni, miért
kapott két session ugyanazt a fát.

## Nyitva marad

- **FK-001 E2** (114 olvasatlan, ismétlődő foglalás-sorok zaja). A §2b kör **„B — szálba
  csukva”** változata válaszolt volna rá (14 sor → 7), a tulaj az „A”-t választotta.
  Külön döntés; a `messageThreads.ts` adata már megvan hozzá (`olderCount`).
- **FK-001 GY1** (Barion süti-sáv a bejelentkezett admin alján) — nem az én körömben.
- **FK-001 F1** (a 06-os shot az Üzenetek tabot fotózta újra) — Elek-forgatókönyv hiba.
