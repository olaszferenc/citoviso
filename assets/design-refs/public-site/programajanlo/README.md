# Heti programajánló — a vendég-oldali blokk (A: napirend-lista)

**Jóváhagyva:** 2026-09-23 (tulajdonosi döntés: „Az A változat nagyon jó!", két módosítással), §2b terv-kapu.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** Amit alább „KÖT" jelöl, az elvárt viselkedés;
eltérés esetén a kód a hibás, nem a terv.

| fájl | mi ez |
|---|---|
| `programajanlo-honlap.html` | a jóváhagyott, működő vázlat a Rozé Fogadó arculatában (a fejléc Mobil/Asztali váltója és a „Érkezés és távozás" kontextus-szakasz csak a vázlat kerete) |
| `programajanlo-honlap-mobile.png` | 390 px — ehhez mérjük a mobil megvalósítást |
| `programajanlo-honlap-desktop.png` | asztali — ehhez mérjük az asztali megvalósítást |

A vázlatban **valós, mért adat** van: a Révfülöp 30 km-es körzetére 2026-09-23-án lefuttatott gyűjtés.

A tenant-admin választó külön kontraktus: `assets/design-refs/console/programajanlo/`.

---

## Amit a terv KÖT

### ① Napirend-sor
- Minden program egy sor: **dátum-oszlop** (nagy napszám + hónap-rövidítés), mellette a **cím**,
  alatta a **település**, a **távolság-címke** és a **hét napja** (többnapos programnál a dátum-tartomány).
- A távolság **számítás** a tenant koordinátájából: a saját település **„Helyben"** (kiemelt címke),
  a többi a kerekített kilométer-szám (pl. 11 km). ⛔ Nem kerül mellé „légvonalban" (tulajdonosi döntés, 2026-09-23: „marad a cca 11 km").

### ② Forrás minden sorban
- Minden sorban **„Forrás:"** felirat, mellette a forrás domainje kattintható linkként, új lapra nyílik. ⛔ Aminek nincs forrása, az meg sem
  jelenhet (§B.17 felületi fele).

### ③ Mobilon 5, gombbal a többi (tulajdonosi módosítás)
- **Mobil:** az első **5** program látszik, alatta egy „még ennyi program" gomb (a felirat a hátralévők számát mondja); megnyomva a többi is kinyílik,
  a gomb eltűnik. Indok (tulaj): „túl sok vertikális görgetést elvisz".
- **Asztali (≥720 px konténer):** **két hasáb**, mind (max. 10) látszik, gomb nincs.
- A váltás **konténer-szélességre** (`@container`) kötött, nem ablakra.
- A kinyitás **JS nélkül is működik** (no-JS üres-sáv tilalom): a kódban CSS-kapcsoló, nem szkript.

### ④ Nincs lábszöveg (tulajdonosi módosítás)
- A vázlat első változatának „Nyilvános forrásokból gyűjtjük, hetente frissül… Indulás előtt nézze meg a
  forrást" mondata **KIKERÜLT** („ez a szöveg nem kell"). A forrás-link minden sorban marad — az állítás
  utóda az ②, nem egy magyarázó mondat.

### ⑤ Sorrend és kitöltés
- A sorrend a **tenanté** (a választó kontraktusa ③): amit felülre tett, az jön elsőnek.
- Ha a tenant 10-nél kevesebbet választott (vagy a választása lejárt), a szabad helyeket **automatikusan
  a legközelebbi közelgő programok** töltik ki, a választottak UTÁN (tulajdonosi döntés, 2026-09-23).
- Lejárt program nem jelenik meg (a feloldás az élő készletből történik).

### ⑥ Fejléc
- Cím: **„Programok a környéken"**; alatta egy sor a körzetről (pl. „A következő két hét, Révfülöp 30 km-es
  körzetéből.").

---

## Amit a terv NEM köt
- A pontos betűméretek/paddingek — a sablon `--cit-*` tokenjeiből és a `cit-modsec` ritmusból dolgozik.
- A szövegek szóhasználata, amíg igaz marad; minden felirat `T(d, "…")` burkolással születik (§B.18).
- A B (kártyák) és C (hetekre bontva) változat nem nyert — a vázlatból kikerültek.
