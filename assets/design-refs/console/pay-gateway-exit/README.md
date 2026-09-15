# Az átjáró és a bukás-lap — jóváhagyott terv (2026-09-15, tulaj: „A — a fizetés a főszereplő”)

**Hatókör:** `src/console/views.ts` · `src/console/server.ts` · `public/assets/ui/citui-console.css`

A `plan.html` a KONTRAKTUS (kattintható, önhordó; képek: `plan-mobile.png`, `plan-desktop.png`).
Testvér-kontraktusok: `../../configurator/checkout-fullscreen/` (a fizetés-lépés) és
`../../configurator/checkout-item-block/` (a tétel-doboz). Horgony: **ADR-0129/0130** (a kapu ne
tagadja meg a fizető vevőt), **ADR-0164** (egy jóváhagyott terv szerkezete is köt),
**03-INVARIANTS §B.17**.

---

## Mit mértünk (2026-09-15, betöltött stíluslappal, a valós exportált nézet-függvényeken)

① **A két gomb az átjárón BÁJTRA AZONOS.** „Fizetek ▸” (`.ok`) és „Elutasítom” (`.bad`):
mindkettő **35 px magas, `font-weight: 600`, `12.5 px`, fehér háttér, `999 px` lekerekítés** —
egyedül a szövegszín tér el (zöld / piros). Semmi nem mondja meg, melyik a művelet és melyik a
visszaút.

② **Egyik lap sem nevezi meg, MIT fizet a vevő** (`terméknév: false` mind a négy állapotban):
csak egy összeg áll a képernyőn.

③ **A hivatkozási azonosító csupasz `<code>`, másoló gomb nélkül** — a vevőnek egy képernyőről
kellene kézzel átgépelnie egy azonosítót, amikor épp baj van.

④ **A bukás-lapról nincs nevesített kiút** az újrapróbáláson és egy mailto-n túl.

---

## Amit KÖT — elvárt VISELKEDÉSEK, nem stílus-javaslatok

1. **A fizetés a főszereplő.** Az átjárón a fizetés-gomb **kitöltött** (márka-gradiens), a
   visszalépés **halkabb**: kisebb, könnyebb, kontúros. ⛔ A mérce nem a szín: a gomb legyen
   **mérhetően hangosabb** — nagyobb magasság ÉS nagyobb betű-vastagság. Kötő feliratok:
   **„Fizetek”**, **„Mégsem fizetek most”**.
   ⚠️ Vállalt kockázat, kimondva: a meggondolás útja tudatosan halkabb. Nem tűnik el, és nem
   kisebb a minimális tapintható méretnél.

2. **Mindkét lap MEGNEVEZI, mit fizet a vevő** — szállásnév + a termék és a ciklus egy sorban.
   A név a `payment → order_intent → prospect → lead` úton jön. ⛔ Ha nincs név, a lap **nem talál
   ki egyet**: a tétel-sor a termék megnevezésére szűkül (§B.17 — kevesebb, sosem hamis).

3. **A hivatkozási azonosító MÁSOLHATÓ**, mindkét lapon. A gomb **visszajelez** (a felirata
   megváltozik), és JS nélkül sem tűnik el a kód maga. Kötő felirat: **„Másolom”**.

4. **Minden lapról van legalább egy nevesített kiút.** A bukás-lap alján külön sávban: vissza a
   kezelőfelületre · újabb kártya · ember. ⛔ Néma zsákutca nincs (ADR-0129 ③).

5. **A rendezett fizetésen NINCS terhelést indító gomb** — a lap az állapotot mondja és a
   következményt, nem kínál második terhelést.
   ⛔ **ÉS MINDKÉT KIKÖTÖTT MONDAT MEGMARAD.** Két különböző fogyasztó rögzíti őket, két
   KÜLÖNBÖZŐ literállal ugyanazon a képernyőn:
   `scripts/module-purchase-state-check.mts` → „Ez a fizetés **már** rendezve van”;
   `elek/scenarios/FK-005b-payment-failure-matrix.md` → „Ez a fizetés rendezve van” (**„már”
   nélkül**). Egyik sztring sem tartalmazza a másikat, tehát EGY mondatba összevonva bármelyik
   megfogalmazás eltör egy fogyasztót. A látszólagos ismétlés itt TEHERHORDÓ.

6. **Az elutasított fizetés lapja MÁS, mint a fizetés előtti** — az állapotot sáv mondja ki, és a
   gomb felirata is az újrapróbálásról szól.

## Kötő horgony (SZERKEZET — a `contract-drift-check` ezt is méri)

- `pay-item` — a tétel-sor konténere mindkét lapon
- `pay-act` — a művelet-blokk (gomb-hierarchia)
- `pay-act__quiet` — a halk visszalépés
- `pay-ref` — a hivatkozási azonosító sora a másoló gombbal
- `pay-exits` — a bukás-lap nevesített kiút-sávja

## Amit a terv SZÁNDÉKOSAN nem köt

- **Az átjáró a MOCK átjáró**, a valós Barion pay-link helyén. Élesben a Barion lapja jön, tehát
  ez a gomb-hierarchia ott nem a mi kezünkben van. Azért kötjük mégis, mert ① ezt méri az Elek,
  ② ez a lap megy ki minden nem-Barion úton, és ③ a tétel-sor és a másolható azonosító a saját
  lapjainkon marad érvényes.

## Ellenőrzés

`scripts/pay-exit-truth-check.mts` — a RENDERELT, stíluslappal kiszolgált lapokon mér (a
gomb-hierarchia a forrásban láthatatlan: két `<button>` ugyanúgy néz ki a kódban). Piros
önteszttel, visszarontásonként külön szabály-csoportra.
