# 2026-09-26 — Telefonon a rendelés-panel görget, nem a mögötte lévő lap (cfg-mobile B szál)

**Kiváltó:** a tulaj telefonról (Három Huszár mock, 20:02): „nem is lehet vásárolni, mert nem a
vásárlási szekció gördül, hanem a honlap maga". Brief: `~/rc-briefs/cfg-mobile-0926/B-gorgetes.md`
(párhuzamos A = két-lépéses panel, C = „Itt rendelheti meg" gomb).

## Mérés (nyers érintés, nem kerék)
- `Input.synthesizeScrollGesture` ebben a headless Chromiumban SEMMIT nem görget (egy sima
  4000 px-es lapot sem) → egy rá épített őr mindenre zöld lett volna. A nyers
  `Input.dispatchTouchEvent` (touchStart → touchMove×N → touchEnd) görget; az őr S0 szabálya ezt
  minden futásban igazolja (csukott panellel a gesztus mozgatja a lapot).
- Javítás előtt, 3 sablon × 390/360/fekvő: a panel fején / láblécén húzva a lap **~320 px-t**
  ment, a lista végén a húzás **átláncolt** a lapra; a 2. lépésen és a fizetés-lépésen szintén.

## Javítás (viselkedés, nincs kinézeti döntés → nem §2b-kör)
- `assets/runtime/cit-configurator.js`: `touchmove`-őr a panelen (`passive:false`) — a húzást
  csak akkor engedi, ha a céltól a panelig van görgető, ami abba az irányba még mozdulhat;
  oldalirányú és kétujjas gesztus natív marad.
- `assets/runtime/cit-configurator.css`: `overscroll-behavior: contain` a `.cit-cfg-body`-n, a
  fekvő egész-panelen és az asztali fizetés-hasábon.
- ⛔ SZÁNDÉKOSAN NEM lap-zár (`overflow:hidden` / `position:fixed` body): a panel mellett/fölött
  látszó lap húzásra görgethető marad (élő előnézet böngészése), és a modul-kapcsolásra a lap
  továbbra is odagörget (`revealChange`). Mindkettő mért szabály (S6, S3).

## Őr
`scripts/cfg-sheet-scroll-check.mts [--selftest]` (pre-commit, a konfigurátor fájljaira):
S0 gesztus-hitel · S1 fej/lista/lábléc/lista-vége · S2 a lista végig elérhető · S3 élő előnézet ·
S4 bezárás után a lap görget · S6 a lap a panel mellett görget · S7 2. lépés + fizetés-lépés ·
S8 a fizetés-űrlap saját görgetése. A gesztus helye a panel SAJÁT geometriájából jön (fej/lista/
lábléc sáv), nem szelektor-magasságból — az A szál átszervezése után is értelmes.
Piros önteszt: a javítás kivéve → S1 és S7 PIROS, S3/S6 zöld (390 + fekvő).

## Nyitott — TULAJ-DÖNTÉS
**Fekvő telefonon (844×390) a fizetés-lépésen a „Fizetek" gomb a képernyő alatt van, görgetéssel
sem érhető el** (az űrlap-ablak ~24 px, a pipa-blokk rálóg). A javításom ELŐTT is így volt. A
javítás (a fizetés-lap fekvőben egy oszlopban görög, mint az 1. lépés `max-height:520px` ága) a
`design-refs/configurator/checkout-fullscreen` kontraktus ② pontját („egy nézetben, görgetés
nélkül") írná felül — ezért kérdés ment a tulajnak. Az őrben `KNOWN_OPEN`-ként hangosan kiírva
(„ISMERT, NYITOTT — nem zöld"), és jelzi, ha megszűnt.

⚠️ Egy koordinátor-session tévedésből tulaj-döntésként küldte be a „fekvőben is legyen egy
oszlopban görgethető a fizetés" javaslatot; a rá épített munka NEM landolt, hanem félre van téve:
`~/rc-briefs/cfg-mobile-0926/parked/B-fekvo-fizetes-egy-oszlop.patch` (CSS `max-height:520px`
blokk a `.cit-cfg-panel--billing`-re, a ≥900 px-es rács UTÁN, hogy a 932×430 is összecsukjon; +
őr: S9 „Fizetek elérhető és az ujj őt találja", 932×430 tartás, `no-landcol` piros önteszt; az S8
ujj-helye az űrlap saját görgetője, ha az görget — 360×780-on a panel közepe a pipa-blokkra esik).
Részeredmény a patch-csel: fekvőn S8 zöld, a no-fix önteszt S7-e fekvőn már NEM piros (a panel
egy oszlopként görget) → ott csak állón várható piros S7. A teljes futás nem ért véget.

iOS Safari nincs a gépen (csak Chromium) — a `touchmove`+`preventDefault` út WebKiten is a
szabványos, de ott nem mértem.

## Fájlok
- `assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`
- `scripts/cfg-sheet-scroll-check.mts` (új), `hooks/pre-commit`
- Képek/videók (gitignore-olt): `assets/design-refs/_drafts/cfg-sheet-scroll/`
