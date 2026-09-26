# Automata heti programajánló — a tenant-admin választó felülete

**Jóváhagyva:** 2026-09-22 (tulajdonosi döntés: „B tetszik"), §2b terv-kapu.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** Amit alább „KÖT" jelöl, az elvárt
viselkedés; a megvalósítást ehhez mérjük, és eltérés esetén a kód a hibás, nem a terv.

| fájl | mi ez |
|---|---|
| `programajanlo.html` | a jóváhagyott, működő vázlat (fejlécében Mobil/Asztali váltó — az csak a vázlat kerete, nem a termék része) |
| `programajanlo-mobile.png` | 390 px, ehhez mérjük a mobil megvalósítást |
| `programajanlo-desktop.png` | asztali, ehhez mérjük az asztali megvalósítást |

A vázlatban **valós, mért adat** szerepel: a Balatonfüred 30 km-es körzetére
2026-09-22-én lefuttatott gyűjtés eredménye. Nem kitalált minta.

---

## Amit a terv KÖT

### ① Két hasáb asztalin, fülek mobilon — ez KÉT külön tervezői döntés
- **Asztali (≥720 px konténer-szélesség):** a javasolt programok és a kiválasztottak
  EGYSZERRE láthatók, két egyenlő hasábban. A tenant lássa, mit vesz el és mit kap.
- **Mobil (390 px):** két hasáb nem fér el → **fülek** („Javasolt (N)" / „Az Ön oldalán (N)").
  A fül-feliratban a **darabszám KÖT**: enélkül a másik fülön történtek láthatatlanok.
- ⛔ A bevezető szöveg **nem hivatkozhat bal/jobb oldalra** — mobilon az hamis. A
  jóváhagyott mondat mindkét méreten igaz. (Ez a vázlat első változatának MÉRT hibája volt.)

### ② A 10-es korlát
- Legfeljebb **10** program választható ki.
- Betelt állapotban a fel-nem-vett tételek gombja **tiltott** (`disabled`), nem csak
  hatástalan — a tenant lássa, hogy nem lehet, ne kattintgasson.
- Betelt állapotban **látható** figyelmeztetés jelenik meg („Betelt a 10 hely…").
  ⛔ A DOM-ban való jelenlét nem elég: `isVisible()`-lel kell igazolni.
- A számláló formátuma `N / 10`, és betelt állapotban kiemelt.

### ③ A sorrend a tenanté — ez a változat LÉTOKA
> ⚠️ **MÓDOSÍTVA 2026-09-26 (ADR-0238):** alapból DÁTUM szerint rendez, a fel/le nyíl
> kézi felülírás — lásd `../programajanlo-sajat/README.md` ③. A nyilak és a mentett sorrend maradnak.
- A kiválasztott programok **fel/le mozgathatók**, és ez a sorrend megy ki a honlapra.
- A legfelső kerül legelőre. A szélső elemeken a megfelelő nyíl **tiltott**.
- ⛔ Ha a sorrend-vezérlés kikerül, a B változat elveszti az értelmét — akkor A vagy C
  kellett volna. Ezt ne „egyszerűsítsük el" implementáció közben.

### ④ Minden tételnél forrás-link
- Minden programnál ott a **forrás domainje, kattintható linkként**, új lapra nyitva.
- ⛔ Ez a tényhűségi kapu (§B.17) felületi fele: aminek nincs forrása, az meg sem
  jelenhet. A séma `source_url` mezője kötelező.

### ⑤ Cím átírható
- A kiválasztott tételek címe **helyben szerkeszthető** („átírom" → „kész").
- A tenant átírása felülírja a gyűjtött címet a honlapon.

### ⑥ Üres állapot
- Asztalin a kiválasztott-hasáb üresen is **végigér** a másik mellett, középre igazított
  üzenettel. ⛔ Nem hagyhat fél képernyőnyi ürességet — a kezdőképernyő félkésznek néz ki.
  (Ez is a vázlat első változatának MÉRT hibája volt.)

### ⑦ A heti automatizmus kimondva
- A lábazat megmondja, **mikor jön a következő frissítés**, hogy a választás és a sorrend
  megmarad, és hogy a **lejárt programok maguktól lekerülnek**.

---

## Amit a terv NEM köt

- A vázlat fejlécének „Mobil 390px / Asztali" sávja — az a bemutatás eszköze, nem termék.
- A konkrét betűméretek/paddingek — a `--citui-*` tokenekből kell dolgozni, nem a
  vázlat px-eiből. Nyers hex/rgb **tilos** (ADR-0021 ①).
- A szövegek pontos szóhasználata, amíg az állításuk igaz marad. ⛔ De minden
  felirat `T(d,"…")` / `tr("…")` burkolással születik (§B.18) — beégetett vevő-oldali
  felirat tilos.

---

## Mért állapot a jóváhagyáskor

A vázlaton lefuttatott viselkedés-ellenőrzés (Playwright, nem képnézés):

```
kivalasztva: 10 | szamlalo: "10 / 10"
11. tetel tiltva: IGEN
"betelt" uzenet LATHATO: IGEN
mentes gomb aktiv: IGEN | visszajelzes: IGEN
cim atirhato: IGEN
asztali stage szelesseg: 1000 px
JS-hiba: 0
```

Ugyanezeket az állításokat a megvalósításon is le kell tudni futtatni — a felület
őrének ezt a listát kell lefednie, nem kevesebbet.
