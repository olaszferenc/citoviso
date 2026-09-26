# Saját program a heti programajánlóban — a tenant maga vesz fel programot

**Jóváhagyva:** 2026-09-26 (tulajdonosi döntés: „A”, „a többi ok, csak a sorrend a dátumok
alapján menjen” → pontosítva: „alapértelmezés: dátum, fel/le override”), §2b terv-kapu.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A „KÖT” pontok elvárt viselkedés; eltérés
esetén a kód a hibás. Kiegészíti — és a ③ pontban MÓDOSÍTJA — a
`../programajanlo/README.md` kontraktust (ADR-XXXX).

| fájl | mi ez |
|---|---|
| `sajat-program.html` | a működő vázlat. A fejléc A/B, Mobil/Asztali, Sötét/Világos sávja a bemutatás eszköze; a jóváhagyott változat az **A** |
| `urlap-mobile.png` / `urlap-desktop.png` | a kitöltés alatt álló üres kártya, 390 px / asztali |
| `felveve-mobile.png` | a felvett saját program sora, 390 px |
| `sajat-sorrend-desktop.png` | kézi átrendezés után: „saját sorrend · dátum szerint rendezem” |

---

## Amit a terv KÖT

### ① Belépés — mindkét hasábban / fülön
- Az **„Az Ön oldalán”** lista tetején szaggatott keretes sor: **„Saját program hozzáadása”**.
- A **„Javasolt programok”** lista ALJÁN is: **„Nincs a listán? Saját program”**.
  ⛔ Mobilon a „Javasolt” fül nyílik először — enélkül a belépő ott NEM látszik (a vázlat
  első körének MÉRT hibája).
- Rákattintva az „Az Ön oldalán” lista tetején, **helyben** nyílik egy üres kártya a mezőkkel
  (mobilon a fül átvált). Egyszerre egy kártya szerkeszthető.
- Betelt 10 helynél mindkét belépő **tiltott** (`disabled`).

### ② A mezők és a szabályaik (a szerver UGYANEZT kényszeríti)
| mező | szabály |
|---|---|
| Cím | kötelező, szóközök összevonva, legfeljebb 120 karakter |
| Kezdete | kötelező; nem múlt nap; legfeljebb 90 nappal előre |
| Vége | nem kötelező; nem lehet a kezdet előtt; legfeljebb 31 napos program |
| Hol lesz? | „Helyben (<saját település>)” (alap) vagy „Máshol” + település neve |
| Webcím | nem kötelező; `https://` pótlódik, ha hiányzik („Így mentjük: …”); csak http(s), pontos domain |

- Hibás kitöltésnél a hibaüzenet a MEZŐ ALATT jelenik meg, és a kártya nem záródik be.
- Ha a program a kéthetes ablakon túl kezdődik: „Megjelenik a honlapon: <nap>” — mert a
  honlap-blokk mindig a következő két hetet mutatja.

### ③ Sorrend: alapból DÁTUM, a nyíl felülír (a korábbi ③ pont MÓDOSÍTÁSA)
- Alapállapotban az „Az Ön oldalán” lista **dátum szerint** rendezett, és minden felvett
  program (javasolt ÉS saját) a dátuma szerinti helyére kerül. A hasáb fejlécében: „dátum szerint”.
- A ▲▼ nyíl megmarad: az első kattintás **saját sorrendre** vált („saját sorrend ·
  dátum szerint rendezem”). Saját sorrendben az új tétel a lista végére kerül.
- A „dátum szerint rendezem” link visszaállítja a dátum-sorrendet.
- A honlapon: dátum-módban a kiválasztottak ÉS az automatikusan kitöltött helyek EGYÜTT,
  dátum szerint; saját sorrendben a tenant sorrendje, utána az automatika (a régi viselkedés).

### ④ A saját program sora
- Ugyanolyan sor, mint a többi, **„Saját ajánlás”** jelvénnyel; a forrás-link helyén a
  megadott webcím (ha van). „átírom” helyett **„szerkesztem”**: ugyanaz a kártya nyílik vissza,
  benne **„Törlöm”**.
- A saját program is a 10 hely egyike.
- A honlapon a „Forrás: …” helyett **„A szállás ajánlja”** áll (webcímmel: utána a link).
  ⛔ A §B.17 forrás-kapu a GYŰJTÖTT programokra él tovább változatlanul; a saját program
  forrása maga a szállás, és ezt a sor ki is mondja.

### ⑤ Lejárat
- A saját program is magától lekerül a vége (ennek hiányában a kezdő napja) után —
  a lábazat mondata ezt kimondja („a sajátjai is”).

---

## Amit a terv NEM köt
- A vázlat B változata (űrlap-ablak előnézettel) — elvetve.
- Pontos méretek/paddingek — `--citui-*` tokenekből; nyers hex/rgb tilos.
- A szövegek szóhasználata, amíg igazak; minden felirat `T()`-n át születik.
- Leírás mező NINCS (a honlap-blokk sora nem visel leírást).

## Mért állapot a jóváhagyáskor (Playwright, a vázlaton)
```
üres beküldés: „Adjon címet a programnak.” + „Adja meg, mikor lesz.”
múlt nap + rossz webcím: „Ez a nap már elmúlt.” + „Ez nem webcím. …”
facebook.com/events/123 → „Így mentjük: https://facebook.com/events/123”
felvétel után 9/10, a sor: „Balatongyörök · Helyben · Saját ajánlás · facebook.com · szerkesztem”
szept. 30-i saját program a szept. 27. és okt. 1. közé sorolódott (dátum-mód)
▲ után: „saját sorrend · dátum szerint rendezem”; a link után vissza „dátum szerint”
10/10-nél mindkét belépő tiltott, „Betelt” látható
390 px: scrollWidth = 390 · JS-hiba: 0 (mobil és asztali)
```
