# 2026-09-14 — A konzol natív dialógusai: egy közülük ma is törik (adatvesztés-kockázat)

**Forrás:** tulajdonosi kérés az ADR-0150 nyitott tételére („a konzol 6 natív dialógusát is
nézd meg"). **ADR-0165.** Élesítés NINCS.

## Amit mértem

**⛔ A saját számom már elavult volt.** Az ADR-0150-ben „6"-ot írtam; újramérve a friss
`main`-en **7** natív dialógus van a konzolon. Egy párhuzamos szál közben landolt egy újat.
Tanulság: a saját összefoglaló sor nem premissza — újramérés jár, akkor is (főleg akkor), ha
a saját számomat kapom vissza.

**⛔⛔ Egy hely MA IS TÖRIK.** `src/console/views.ts` — „jóváhagyott mock törlése":
`onsubmit="return confirm('…')"`, a szöveg **`jsStr()` nélkül** az egyszeres idézőjelben.
A magyar forrásban nincs aposztróf, **a fordításban van**:

| nyelv | fordítás | dialógus | eredmény |
|---|---|---|---|
| hu | „…nem vonható vissza." | 1 | megállítva |
| de | „…rückgängig gemacht." | 1 | megállítva |
| **en** | „It **hasn't** been sent yet" | **0** | ⛔ **elmegy a szerverre** |
| **it** | „**l'operazione** è irreversibile" | **0** | ⛔ **elmegy a szerverre** |

Valódi böngészőben mérve: JS-hiba `missing ) after argument list`, `defaultPrevented=false`.
A `confirm()` **soha nem fut le**, a visszafordíthatatlan törlés **megerősítés nélkül** megy.
Ugyanez a hibaosztály, amiről a `jsStr()` docstringje és az ADR-0150 szól.

**Egy LAPPANGÓ pár:** a „link másolása" gomb ugyanígy escape-eletlen volt — ma csak azért
ép, mert egyetlen csomagban sincs aposztróf abban a feliratban. A csomagok AI-generáltak, ez
**szerencse, nem garancia**.

**A másik öt hely rendben volt** (`esc(jsStr(...))`), pedig három fordítása aposztrófot
tartalmaz — vagyis az escape-elés tényleg ez a különbség, nem elmélet.

## Amit változtattam

- `src/console/views.ts` — két `esc(jsStr(…))` burkolás (mock-törlés + link-másolás).
  ⚠️ A felület-kaput a tulaj nyitotta ki (§2b kivétel, kimondott szavával) — magamnak nem
  adhattam volna, és a hook helyesen blokkolt.
- `scripts/dialog-fires-check.mts` — **új őr**, `hooks/pre-commit`-be kötve.
- `_planning/DECISIONS.md` — ADR-0165.

## Az őr (a tulaj kérése szerint)

„MINDEN nyelvi csomagra, a RENDERELT kimeneten mérje, hogy a dialógus tényleg lefut-e,
piros önteszttel." — **8 vezérlő × 8 nyelv**, valódi böngészőben:

- **védett** vezérlő: a kattintás PONTOSAN EGY dialógust vált ki · a beküldés **tényleg
  elindul** · elutasításra **MEGÁLL**;
- **sima** kezelő: nincs JS-hiba, és a hatás bekövetkezik;
- **fedettség** nyelvenként (a mérés ne lehessen üresen igaz);
- **ellenséges ál-csomag** (`zz`): minden feliratba `'`, `"`, `\` — ez fogja meg a LAPPANGÓ
  helyeket, ahol a mai zöld csak szerencse.

**Piros önteszt: 9 bukás, MEGNEVEZETT halmazon** — piros `en`/`it`/`zz`, ZÖLD
`hu`/`de`/`hr`/`pl`/`sk`. A kétirányú elvárás bizonyítja, hogy a mérés a fordítás
TARTALMÁRA mér. A hook-blokk `set -e` alatt, VALÓDIAN visszarontott forráson: `rc=1`.

## Két csapda, amit maga az őröm termelt

1. ⛔⛔ **Üresen igaz állítás.** Az első változat csak azt mérte, hogy a beküldés „megállt-e".
   A küldő-sáv viszont LETILTJA a gombokat, amíg a levél vége (`#cit-letter-end`) nem járt a
   képernyőn — a kattintás el sem indította a submitot, és a „megállt" **zöld lett nulla
   dialógus mellett is**. Külön állítás kellett arra, hogy a beküldés TÉNYLEG ELINDULT.
2. ⛔ **A szelektorom a terméket vádolta.** Három vágólap-gomb van a lapon (tárgy ·
   SMS-szöveg · levéltörzs); a `.first()` a TÁRGY gombját mérte, ami szándékosan nem kérdez —
   az őr mind a 8 nyelven „hibát" jelentett egy ÉP felületre. Mielőtt a terméket hibáztatod,
   nézd meg, a jó elemre mutatsz-e.

## Amit NEM állítok

A rendszer-modál a konzolon **nem készült el** — tulajdonosi döntés, hogy külön kör (a hét
dialógus ma visszafordíthatatlan KIKÜLDÉST véd). A tárgysor és az SMS-szöveg másolása
tudatosan marad megerősítés nélkül: a második példány kockázata a levél szövegéhez tapad.

## Nyitott

- A konzol 7 natív dialógusának rendszer-modálra váltása (külön §2b kör).
- Az őr ma három felületet mér (`leadPage`, `outreachDraftPage` két állapotban). A
  `partnerViews.ts` 8 inline kezelője még nincs benne.
