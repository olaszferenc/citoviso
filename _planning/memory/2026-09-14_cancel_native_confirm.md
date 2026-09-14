# 2026-09-14 — A kód-komment ellentmondott a kódnak: natív `confirm()` a lemondáson

**Forrás:** Elek FK-007 **E3** lelet (2026-09-13-i teljes futás, 12 kör, ~250 lelet), a mai
`origin/main`-en (`4535965`) újramérve. **ADR-0150.** Élesítés NINCS.

## Amit mértem

A `src/server/bookingViews.ts` kommentje kimondta: „No native `confirm()`" — közben **ugyanabban
a fájlban**, a lemondás ágon `onsubmit="return confirm(…)"` futott. A komment igaza a
**fedés-választóra** vonatkozott, de a szövege file-szintű állításnak olvasódott. A premisszát
a javítás előtt ellenőriztem: a hivatkozott sorok (`:337`, `:721`) a mai main-en érvényesek voltak.

**Teljes felmérés (`src/` + `assets/runtime/` + `public/`), a javítás előtt:**

| Réteg | Natív dialógus | Sors |
|---|---|---|
| **Vendég-oldal** (publikus lap, konfigurátor, generált sablonok, `assets/runtime/*.js`) | **0** | A vendég-lemondás már ma is teljes megerősítő LAP (`guestCancelConfirmPage`) |
| **Vevő-oldal** (tenant-admin) | **1** — `bookingViews.ts:337` | **JAVÍTVA** |
| **Operátor-konzol** (a saját belső felületünk) | **6** — `views.ts:2964/4413/4501/4604/4730` (5× `confirm`) + `testLogViews.ts:249` (`alert`) | **Szándékosan kívül hagyva** (nem vevő-felület; a kiküldés-megerősítések átszabása külön, mérendő kör) |

⭐ A „6 db a konzolon" nem elhallgatott adósság: az ADR-0150 táblázata is kimondja, hogy ne
tűnjön el a következő olvasónak.

## Amit változtattam

- `src/server/bookingViews.ts` — `cancelForm()`: `onsubmit="return confirm(…)"` **ki**, helyette
  `data-bk-cancel` + escape-elt `data-bk-name` / `data-bk-when` horgok. Új `cancelScript(lang)`:
  a **fedés-választóval AZONOS** burok (`.bk-ovl`/`.bk-ovm`, ragadó gomb-sor, `--citui-*`) —
  **nulla új CSS**, mert épp az azonosság a lényeg. A `:721` komment megkapta a hiányzó mondatot
  (mit állít és mit NEM), és a `bookingsSection` csak akkor tűzi ki a scriptet, ahol van
  lemondható foglalás.
- `scripts/cancel-confirm-check.mts` — **új őr**, `hooks/pre-commit`-be kötve.
- `elek/scenarios/FK-007-booking-full-loop.md` · `kb/entries/admin-bookings/entry.hu.md` ·
  `assets/design-refs/tenant-admin/foglalasok-README.md` — a fogyasztók.
- `src/i18n/catalog.json` — 2 új / 1 elhagyott string.
- `_planning/DECISIONS.md` — ADR-0150.

## Amit az őr bizonyít (390 és 1280 px, RENDERELT lapon)

natív `confirm(`/`alert(`/`prompt(` **sehol** a kimeneten · **egy** koppintás nyit, a `<details>`
panel nem nyílik mellette · a modál **megnevezi** a vendéget, az éjszakákat és a következményt ·
a záró gomb és a „Mégsem" `elementFromPoint`-tal elérhető · a záró gomb tényleg **beküld**
(`id` + a modálba gépelt indoklás) · a „Mégsem" **semmit** nem küld · a **no-JS** űrlap ép.

**Piros önteszt:** a régi markuppal (horog nélkül, `onsubmit` visszatéve) **6 mérés bukik**.

## Két csapda, amibe menet közben beleléptem

1. ⛔⛔ **Hamis zöld az őr-öntesztemre.** A hook-blokkot `set -e` alatt egy KITALÁLT kapcsolóval
   (`--selftest-as-real`) futtattam — a script azt figyelmen kívül hagyta, NORMÁL módban futott,
   zöld lett, és a blokk „nem állt meg". Ez pontosan a
   [near-miss on safety switch] hibaosztály: ismeretlen kapcsoló = néma kikapcsolás. **Újra,
   valódian:** a FORRÁST rontottam vissza (`perl -0pi`, mentett másolattal), úgy futott a blokk —
   `rc=1`, a záró `echo` nem futott le, majd visszaállítás és 0 találat ellenőrzése.
2. ⛔ **A felirat-csere fogyasztói.** Az FK-007 a `.bk-dayinfo textarea` mezőbe gépelt — a modál
   megnyitása után az nem elérhető. Grep nélkül a következő Elek-futás bukott volna rá, és a
   piros a HELYES kódra mutatott volna.

## Amit NEM állítok

A képek (`--shots`, viewport-felvétel, nem fullPage) az **elrendezést** bizonyítják 390 és
1280 px-en — nem azt, hogy a folyamat ujjal végigvihető (ADR-0149 kimondott korlátja).
A no-JS ág a javítás előtt sem erősített meg semmit (dialógus JS nélkül nem fut), és most sem —
a fix ezt az ágat nem javítja és nem rontja.

## Nyitott

- A konzol 6 natív dialógusa (fenti táblázat) — külön kör, tulaj-döntéssel: a kiküldés-
  megerősítéseknél a natív dialógus MA véd valami visszafordíthatatlantól.
- A történet-listás „Lemondom" ugyanezt a modált nyitja, de a KB csak a naptár-ágat írja le.
