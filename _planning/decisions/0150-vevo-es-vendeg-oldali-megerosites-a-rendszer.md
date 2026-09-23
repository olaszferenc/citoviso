## ADR-0150 — Vevő- és vendég-oldali megerősítés a rendszer saját modáljával, natív `confirm()` nélkül

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kontextus:** tenant-admin „Foglalások" fül
(Elek FK-007 E3); hatókör a VEVŐ- és VENDÉG-oldali felületek

**A probléma, mérésből.** A `src/server/bookingViews.ts` egyik kommentje kimondta, hogy „No native
`confirm()`" — közben **ugyanabban a fájlban** a tulajdonosi lemondás `onsubmit="return confirm(…)"`-mel
zárult. A komment igaza a fedés-választóra vonatkozott, a lemondásra nem, de a szövege file-szintű
állításnak olvasódott. **Két baj egyszerre:** ① a lemondás négy lépés volt (panel nyit → gépel →
küld → nyers OS-dialógus), ez volt Elek szerint a lap legdurvább ergonómiai pontja; ② **a kód
hazudott magáról** — a következő olvasó a kommentnek hisz, nem a kódnak.

**Felmérés (a javítás előtt, az egész `src/` + `assets/runtime/` + `public/`).** Natív dialógus:
- **Vendég-oldal (publikus lap, konfigurátor, generált sablonok, `assets/runtime/*.js`): 0 darab.**
  A vendég-lemondás már ma is teljes megerősítő LAP (`guestCancelConfirmPage`).
- **Vevő-oldal (tenant-admin): 1 darab** — a fenti lemondás. **Ez a javítás tárgya.**
- **Operátor-konzol (a saját belső felületünk): 6 darab** — 5 `confirm()` (mock törlése, e-mail-
  küldés, MMS+SMS páros, mindkét csatorna, már kiküldött levél másolása) és 1 `alert()`
  (teszt-napló mentés-hiba). **Szándékosan KÍVÜL hagyva:** ez nem vevő-felület, és a kiküldés-
  megerősítések átszabása külön, mérendő kör. A tényt itt rögzítjük, hogy ne tűnjön el.

**A döntés.** ① **Vevő- és vendég-oldali felületen nincs natív `confirm()`/`alert()`/`prompt()`.**
A visszafordíthatatlan lépés megerősítése a rendszer saját komponense. ② **Új komponens nem
születik hozzá:** a lemondás a fedés-választóval AZONOS burkot használja (`.bk-ovl`/`.bk-ovm`,
ragadó gomb-sor, `--citui-*` tokenek) — egy képernyőn egy megerősítés-forma legyen, ne kettő.
③ **A modál többet mond, mint amit levált:** megnevezi a vendéget és az éjszakákat, kimondja a
következményt, és az indoklás-mező ugyanott van, ahol a döntés. A kiút gomb, nem mondat:
„Mégsem — megtartom" (szó szerint a vendég-oldali lemondó lapról). ④ **Egy koppintás:** a
„Foglalás lemondása" felirat közvetlenül a modált nyitja, a `<details>` panel nem nyílik ki
mellette. ⑤ **A no-JS kontraktus érintetlen:** JS nélkül egyik figyelő sem fut, a panel a
megszokott módon nyílik, és az űrlap ugyanarra a `/admin/booking/cancel` útvonalra POST-ol.

**Miért kap ŐRT, és miért nem elég a komment.** Épp az bukott meg, hogy a szabályt EGY KOMMENT
őrizte. `scripts/cancel-confirm-check.mts` a RENDERELT lapon mér 390 és 1280 px-en: natív dialógus
sehol (forrás-szintű minta a kimeneten) · egy koppintás nyit · a modál megnevez · a záró gomb és a
„Mégsem" `elementFromPoint`-tal elérhető · a záró gomb tényleg beküld (`id` + a modálba gépelt
indoklás; a `form.submit()` nem süt el submit-eseményt, ezért a prototípus csapdázva) · a „Mégsem"
nem küld be semmit · a no-JS űrlap ép. **Piros önteszt:** a régi markuppal (horog nélkül,
`onsubmit` visszatéve) **6 mérés bukik**; a `hooks/pre-commit`-be kötött blokk `set -e` alatt,
VALÓDIAN visszarontott forráson mérve `rc=1`-gyel áll meg.

**Amit a javítás eltört volna, ha nem grepelem ki:** az FK-007 forgatókönyv a `.bk-dayinfo textarea`
mezőbe gépelt — az a modál megnyitása után nem elérhető. A forgatókönyv frissítve (`.bk-ovnote`),
és új lépés állítja, hogy a megerősítő a rendszeré (`darab ".bk-ovm" >= 1`). A KB-bejegyzés és a
befagyasztott kontraktus (`assets/design-refs/tenant-admin/foglalasok-README.md`) szintén frissült.

**Visszafordíthatóság:** 🔄 a `cancelScript()` és a `data-bk-cancel` horog eltávolításával a felület
a no-JS ágra esik vissza (működő, csak megerősítés nélküli űrlap); DB- és útvonal-változás nincs.
