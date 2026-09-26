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

## Fekvő fizetés — TULAJ DÖNTÖTT: egy oszlopban görög (ADR-0243)
Fekvő telefonon (844×390) a fizetés-lépésen a „Fizetek" a képernyő alatt volt, görgetéssel sem
elérhető (űrlap-ablak ~24 px, a pipa-blokk rálógott) — régi hiba. ⚠️ Előbb egy koordinátor-session
tévedésből tulaj-döntésként küldte be a „fekvőben is legyen egy oszlopban" javaslatot; a munka
félre lett téve (`~/rc-briefs/cfg-mobile-0926/parked/`), és a tulajt ÚJRA megkérdeztem
(AskUserQuestion) → „Egy oszlopban görgessen". Megvalósítva: `@media (max-height:520px)` a
`.cit-cfg-panel--billing`-re, a ≥900 px-es rács UTÁN (932×430 is). A checkout-fullscreen ② README
kivétellel kiegészítve. Őr: S8 + új S9 („Fizetek" a képernyőn, az ujj őt találja), 844 és 932 fekvő
tartás, `no-landcol` piros önteszt. Képek: `_drafts/cfg-sheet-scroll/fekvo-fizetes-*.png`.

## ✅ LEZÁRVA — az A szál utáni 360-as lelet (nem B-hatókör)
Az A szál (ADR-0240, két-lépéses rendelés) landolása UTÁN álló **360×780**-on a fizetés-lépés
számlázási űrlapjának ablaka ~24 px, a pipa-blokk takarja (előtte 152 px, zöld) — a „Fizetek"
látszik, de az űrlap nem tölthető ki. Ok: a fizetés-lépés tetején ott marad az összeg + ÁFA +
terhelés + a §A nyilatkozat hosszú szövege. Jelentés: `~/rc-briefs/cfg-mobile-0926/B-jelentes-360-urlap.md`;
az őrben `KNOWN_OPEN["360:S8…"]` volt. **Lezárva:** az A szál javította (`eca02c21`: a §A címke
inline `display:flex`-e legyőzte a fizetés-lapi `display:none`-t; 24 → 131 px); az őr a rebase után
mindhárom sablonon „MEGSZŰNT”-et jelzett, a bejegyzés kivéve.

iOS Safari nincs a gépen (csak Chromium) — a `touchmove`+`preventDefault` út WebKiten is a
szabványos, de ott nem mértem.

## Fájlok
- `assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`
- `scripts/cfg-sheet-scroll-check.mts` (új), `hooks/pre-commit`
- `_planning/decisions/XXXX-fekvo-telefonon-a-fizetes-lap-egy-oszlopban-gorog.md` (ADR-0243),
  `assets/design-refs/configurator/checkout-fullscreen/README.md` (② kivétel)
- Képek/videók (gitignore-olt): `assets/design-refs/_drafts/cfg-sheet-scroll/`
