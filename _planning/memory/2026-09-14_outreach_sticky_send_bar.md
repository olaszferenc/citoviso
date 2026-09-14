# 2026-09-14 — A küldés a levél UTÁN áll (ADR-0160): a „B" terv megvalósítása és az őr, ami magán tanult

**Szál:** `wt/megkeresesszerk` (B6 / Elek FK-004, második kör) · **Élesítés: NINCS.**
**Tulajdonosi döntés:** a három bemutatott változatból a **„B — Ragadós küldés-sáv"**.
**Kontraktus:** `assets/design-refs/console/outreach-sticky-send/` · **ADR-0160**

## Amit szállítottam

1. **A levél szövege nem görgető doboz többé.** `textarea rows="22"` → `<pre>`, `max-height` és
   `overflow` nélkül. Ez nem „nagyobb doboz": egy `<pre>`-nek **nincs scrollportja**, tehát a
   csonkolás mint hibaosztály szerkezetileg szűnik meg — JS-sel és JS nélkül is.
2. **Minden állapot-átíró küldés a levél UTÁN, ragadós sávban** (`/send`, `/send-pair`,
   `/send-pair-sms`, `/send-all`). A kártyák az állapotot és a címzettet mondják.
3. **A sáv zárva indul, a levél VÉGE nyitja**, és kimondja, miért zárva — kattintás ELŐTT.
4. Az MMS/SMS idővonal a levél után áll; a lap alján is van visszaút.

## ⛔ A csapda, ami majdnem néma díszletet szült

A konzol `.con .panel { overflow-x: hidden }`-je a panelt **scroll-konténerré** teszi. Egy azon
BELÜL ülő `position: sticky; bottom: 0` a **panel dobozához** tapadt volna, nem a képernyőhöz —
és a **teljes-lapos screenshot ezt nem mutatja meg**, mert a sticky elemet a végleges helyére
festi. A sáv ezért a `.con-main` közvetlen gyereke, a panelen KÍVÜL. Az őr önteszt-ága pontosan
ezt állítja elő (a sávot visszateszi a panelbe), és ott bukik.

## ⛔⛔ KÉT SAJÁT MÉRÉSI HIBA — mindkettő az ADR-0147 tanulsága, a saját bőrömön

**(a) Animált megjelenést órára mértem.** A felengedett gomb `opacity`-ja a `--citui-transition`
(220 ms) miatt **0,5-ről 1-re ÚSZIK**, a kapu `data-cit-sendbar="open"` attribútuma viszont
azonnal vált. Az első őröm az attribútumra várt, aztán rögtön mért → **0,5-öt olvasott egy
hibátlan gombon**. Ez fantom-piros lett volna minden futásban. Javítva: a **pixelre** várunk
rAF-enként, a keret a termék saját állandójából levezetve, és ha sosem fest ki: PIROS.

**(b) A görgetés nem azonnali.** A dizájn-mag `html { scroll-behavior: smooth }`-t ír elő, ezért
a `scrollTo` UTÁN rögtön kiolvasott doboz még a **régi** pozícióhoz tartozik. Az őr így a
leiratkozó linket 390 px-en „takartnak" mérte (a fejléc nyelvválasztóját találta el).
`behavior: "instant"` + a tényleges megérkezés kivárása.

⛔ **Ugyanez a verseny ült a `mms-preview-gate-check`-ben is** (`scrollIntoView` után azonnali
`elementFromPoint`). Eddig **érme-feldobás** volt; a megnőtt laptól vált **állandó pirossá**,
és megállította a commitomat. ⭐ Előbb BIZONYÍTOTTAM, hogy a sáv tényleg látszik, és csak utána
igazítottam az őrön — piros őrt a viselkedés igazolása nélkül nem írok át. Az őr saját
öntesztje (⑧) változatlanul fog.

## Az őr, amit a tulaj kért

`scripts/outreach-send-bar-check.mts` — valódi konzol, valódi prospect-sor, 390 + 1280 px:
sorrend (DOM **és** folyam-geometria, a sticky ideiglenes kikapcsolásával) · **tapadás VALÓDI
görgetéssel** (5 mintavétel) · láthatóság **KÉT kérdésre** (opacity-lánc = 1 ÉS
`elementFromPoint`) · a jogi vég **pixelben** (Range-dobozra) · a kapu zárva-indul/nyílik ·
**JS nélkül nem tiltott**.
**Piros önteszt: 3 hibaosztály → 7 állítás megy pirosra.** A kulcs-eset: `opacity:0`-nál a
**geometriai** verdikt ZÖLD marad, a **láthatósági** pirosra megy — pont az ADR-0147 lényege.

## ⛔ Amit a feliratváltozás eltört (és ez a szabály)

A „Küldési csatorna — …" felirat egyetlen szavának átírása azonnal **pirosra vitte a KB-őrt**:
a `console-outreach-draft` súgó **szó szerint idézi**. A súgót a **renderelt lapról** írtam át
(kidumpoltam a látható szöveget, és aszerint fogalmaztam), nem a commit-üzenetből és nem
gépies cserével. Grepeltem az összes fogyasztót (KB, Elek-forgatókönyvek, őrök) — az
`elek-label-drift-check` 159 állítása zöld maradt.

## Fail-safe irány, kimondva

A kiszolgáló a gombokat **ENGEDÉLYEZVE** rendereli, és a **szkript zárja be** őket. Egy halott
szkript így a kaput veszti el, nem a kezelő munkáját; a garancia a POST-on újrafutó §C. Fordítva
a néma hiba egy örökre tiltott gomb lenne, ami tévesen „nem küldhető"-t állít.

## Amit MENET KÖZBEN láttam, de NEM javítottam (külön kérdés)

Az ELEK-TESZT prospect lapján a fejléc azt írja, hogy **„E-mail: most NEM küldhető — a
jogszerűségi kapu tiltja"**, miközben a §C-pirula **PASS**, és a sávban ÉLŐ küldés-gomb áll.
A két állítás két KÜLÖN predikátumból jön (a küldő-út száraz futása vs. a §C-kapu). Ez nem az
én változásom — a gomb korábban a kártyán volt, ugyanígy élőn —, de a sávban jobban látszik.
**Külön körbe való.**

## Módosított fájlok

- `src/console/views.ts` — a küldés-sáv, a `<pre>` levél, az idővonal helye, az alsó visszaút
- `public/assets/ui/citui-console.css` — `.con-sendbar`, `.con-mailtext`
- `scripts/outreach-send-bar-check.mts` — ÚJ őr (önteszttel)
- `scripts/mms-preview-gate-check.mts` — a smooth-scroll verseny javítva
- `hooks/pre-commit` — az új őr bekötve (a CSS és az őr SAJÁT fájlja is trigger)
- `kb/entries/console-outreach-draft/entry.hu.md` — a súgó a renderelt lap szerint
- `assets/design-refs/console/outreach-sticky-send/` — a befagyasztott KONTRAKTUS
- `_planning/DECISIONS.md` — ADR-0160
