# A jóváhagyott terv újraépítése — és miért NEM írja felül

A repo gyökeréből:

```
node assets/design-refs/console/freeze-state-v2/regen/B.mjs               # → freeze-state-B.regen.html
node assets/design-refs/console/freeze-state-v2/regen/verify-contract.mjs # kattintás-próba, 390 + 1280
```

## ⛔ A generátor NEM a hitelesség forrása — a commitolt `freeze-state-B.html` az

Mérve (2026-09-14): a generátor a **mai** `citui.css` + `citui-admin.css` tartalmát
ágyazza be, én pedig a megvalósításkor 69 sor CSS-t adtam a stíluslaphoz. Az újraépített
fájl ezért eltér a jóváhagyottól — **pontosan mérve: 0 sor veszett el, 103 jött hozzá**,
és mind a 103 az a `.adm-frz` blokk, amit a mock **nem is használ** (a saját `.fz-*`
osztályaival dolgozik). A terv markupja azonos: `fz-hero` 17=17, `fz-amt__v` 6=6,
`fz-mods` 5=5, `Befizetem` 5=5, `9670 Ft` 9=9.

Vagyis MA ártalmatlan. A következmény viszont nem az: ha a generátor a helyére írna,
akkor **minden jövőbeli stíluslap-változás némán átírná azt a képet, amin a tulaj
döntött** — pont az, amit a §2b kapu meg akar akadályozni.

Ezért a generátor külön fájlba (`*.regen.html`) ír. Használd **összehasonlításra**, ne
felülírásra. Ha az eltérés érdemi (nem csak a beágyazott CSS bővült), az **jelzés**:
a terv és a ház stílusa elcsúszott egymástól — az tulaj-kérdés, nem takarítási feladat.

## Miért van itt egyáltalán ez a generátor

A `scripts/land.sh` (ADR-0077) minden landoláskor kitakarítja az
`assets/design-refs/_drafts/` mappát — a jóváhagyásra VÁRÓ vázlat eldobható, mert egy
paranccsal újragyártható. A generátorom viszont a munkafa gyökerében, **követetlenül**
élt, a munkafát pedig a watchdog GC-je el tudja vinni. Így a jóváhagyott terv forrása
egy gépi takarítással megszűnhetett volna, miközben a DÖNTÉS érvényes marad.

⚠️ **A `_drafts/` alatti példány eltűnése NEM adatvesztés** — ez a mappa a tartós hely.
