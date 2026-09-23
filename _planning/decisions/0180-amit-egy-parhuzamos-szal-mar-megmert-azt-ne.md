## ADR-0180 — Amit egy párhuzamos szál MÁR MEGMÉRT, azt ne mérd meg újra; és a hibakereső szűkítés ne gyártson álbukást (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0177 (ugyanaznap, ugyanez a
felismerés az Elek-futásra), ADR-0176 kör (`0ca7a93` — a scratch-elszigetelés, amit egy
párhuzamos szál landolt), ADR-0168 (a fantom pirula-ütközés), ADR-0147 ② (a pixelre várunk,
nem órára), ADR-0171 (a néma kapu-bukás).

**Kiváltó.** Tulajdonosi utasítás: „javítsd a `lead-page-surface-check` pirula-ütközését" — az
ÉN előző összefoglalóm alapján, ami egy **2026-09-14-i dátumú** őr-leltár sorát idézte „ma
PIROS, és ez TERMÉK-HIBA"-ként. A hiba **nem létezik** (mérve: 19 sablon × 2 méret, `EXIT=0`,
a `y` 475–828 között szór), és az ADR-0168 már **fantomnak** minősítette. A dátum ott volt a
soron; nem az információ hiányzott, hanem a következtetés. **A pirulához egyetlen sort sem
nyúltam.**

### ① ⛔⛔ KÉT SZÁL UGYANAZT A MUNKÁT VÉGEZTE EL, EGYMÁSSAL PÁRHUZAMOSAN

A mérés közben megtaláltam a valódi hibát: öt őr a KÖZÖS `assets/Temp`-be írta a scratch-jét és
törölte is (háromnál INDULÁSKOR) — az `assets/Temp` a munkafákban symlink a fő fába, tehát a
mérők egymás fájljait vitték el. Megírtam az öt javítást és egy osztály-őrt.

**Mire a kapukon átjutottam, egy párhuzamos szál UGYANEZT landolta** (`0ca7a93`): ugyanaz az öt
őr, ugyanaz a diagnózis („a piros VERSENY volt, nem termék"), és egy osztály-őr is
(`guard-scratch-scope-check.mts`). A commit-üzenetük **nevesíti is a szálamat**: *„a
`wt/leadlistalap` session épp UGYANEZT az őrt futtatta, és amelyik előbb végzett, kitörölte a
másik alól a fixture-t"* — az én diagnosztikai futásaim voltak a verseny másik oldala.

**Döntés:** ⛔ **az ő verziójuk a bázis, a duplikátumomat eldobtam** (5 őr + osztály-őr +
hook-bekötés). Két őr egy szabályra két igazság (`feedback_one_rule_two_copies`), és egy most
landolt idegen döntést nem írok át. Amit megtartottam, az kizárólag a NÁLUK NEM LÉVŐ rész.
**Eljárás-tanulság, ami ide tartozik:** bejelentett hiba javítása ELŐTT nem csak a
`DECISIONS.md` címeit kell grepelni, hanem **futó munkát is keresni** — `git log --oneline
origin/main -5` és a `_planning/memory/INDEX.md` aznapi sorai. ~25 szálnál az „egyszerre
ugyanazon" nem kivétel.

⚠️ **NYITOTT, az övék a döntés:** az ő elszigetelésük **munkafa**-egyedi
(`assets/Temp/_leadsurface-${SCOPE}`), az enyém futásonként egyedi gép-szintű temp volt. A
munkafa-egyedi kulcs UGYANABBAN a fában futó két mérést nem védi — és ez nem elméleti: ma
**két teljes kört futtattam EGYSZERRE ugyanebben a munkafában** (pont a verseny
előállításához). Nem írtam át; mérve jelzem.

### ② A HIBAKERESŐ SZŰKÍTÉS NE GYÁRTSON ÁLBUKÁST

A teljes kör ~6 perc, ami egy geometriai hiba kereséséhez használhatatlan, ezért
`--only=<sablon>` szűkítés került az őrbe (≈20 s). ⛔ **De az első változatom KÉT
önteszt-ágat buktatott egy HIBÁTLAN őrön:** a ④ ágak KONKRÉT sablonokra kalibráltak
(`files["fullbleed"] ?? …`), és szűkítve a fallback a szűkített sablont kapta, ahol a
visszarontott hiba nem áll elő.

**Döntés:** a szűkített futás ① **hangos fejlécet** ír, ② a ④ szakasz **kimondottan kimarad**,
③ a záró sor **nem mondja ki, hogy tiszta** („Ez NEM a kapu verdiktje"). Egy hibakereső flag,
ami álbukást gyárt, rosszabb, mint ha nem lenne: pont abban a helyzetben vezet félre, amikor
valódi hibát keresel. (Ugyanaznap az ADR-0177 ugyanerre jutott az Elek-futásnál — a felismerés
konvergens, tehát a hibaosztály valós.)

### ③ A MOZGÓ KIVÁGÁST IS NYUGVÓPONTBAN MÉRJÜK (harmadszor ugyanez a szabály)

A commit kapu-futása `aurora/asztali`-n „üres keretezett dobozt" jelentett (`colours: 1`) —
ugyanazon a fán, ahol az előtte futott teljes kör zöld volt. **1 bukás 12 futásból**, és 10
SZÁNDÉKOS reprodukciós kísérletből (8 szűkített + 2 EGYSZERRE futó teljes kör, 33-as
gépterhelésnél) **egyszer sem** állt elő.

A mechanizmus: a `loc.screenshot()` MAGA görgeti be az elemet, a begörgetés pedig INDÍTJA a
felfedő animációkat (ADR-0115 mozgás-réteg) — az első kivágás `opacity: 0`-nál kaphatja el a
tartalmat. ⭐ **És ez nem elmélet:** a bevezetett várás élesben TÜZELT — ugyanarra a dobozra két
egymás utáni kivágás **65 → 17 színt** adott.

**Döntés:** a kivágás ismétlődik, amíg két egymás utáni mérés meg nem egyezik (max 4 minta,
250 ms), és a napló kiírja, ha mozgott. ⛔ Ez nem gyengítés és **hamis ZÖLDET nem tud adni**: egy
valóban üres doboz stabilan egy színű, tehát ugyanúgy lelet marad — a várás csak a hamis
PIROSAT szünteti meg; a ④ mindhárom piros önteszt-ága tüzel utána.
⚠️ **De NEM állítom, hogy a bukás javítva van:** nem tudtam előállítani, tehát a hatását nem
mértem meg. Ez a mechanizmus kizárása; a napló ezért hagy nyomot a következő előfordulásnak.

**Visszafordíthatóság:** 🔄 mérőeszköz-szintű; nulla termék-kód, nulla migráció.
