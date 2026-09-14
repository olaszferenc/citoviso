# Megkeresés-piszkozat — „B” változat: ragadós küldés-sáv (KONTRAKTUS)

**Felület:** `/prospect/<id>/draft` (operátor-konzol) · **Tulajdonosi döntés:** 2026-09-14
**Terv:** `plan-B.html` (kattintható, méret-váltóval) · **Képek:** `shot-*.png`
**Forrás:** Elek FK-004 (B6 köteg), 10 lelet · **Őr:** `scripts/outreach-send-bar-check.mts`

> ⚠️ Ez **nem stílus-javaslat, hanem a megvalósítás KONTRAKTUSA.** Az alábbi pontok
> **elvárt viselkedések**; a kész felületet ezekhez mérjük, és őr kényszeríti ki őket.
> Ami itt nem szerepel, azt ez a terv nem dönti el.

---

## Amit a döntés eldöntött

A mai **sorrend marad** — a csatorna-kártyák (E-mail, Mobil) a lap tetején —, de a
**visszafordíthatatlan küldés kikerül a folyamból egy ragadós alsó sávba**: mindig
elérhető, de **soha nem áll a levél ELŐTT**.

**Amit ez javít (mérve, 2026-09-14, valós leaden):** a küldés-gomb **670 px** (asztali)
és **1 641 px ≈ két telefon-képernyő** (390 px) távolságra állt a levél kezdete előtt —
a kezelő azelőtt nyomta meg, hogy elolvasta volna, amit kiküld.

---

## KÖTÖTT VISELKEDÉS

### ① A levél szöveges változata TELJES — szerkezetileg nem tud csonkulni

A `rows="22"` doboz helyén **nem görgethető blokk** áll (`<pre>`, `white-space: pre-wrap`).
Nem „nagyobb doboz”: **nincs görgető doboz**, tehát nincs mit levágni — JS-sel és JS nélkül
egyaránt. A leiratkozó-link, a jogalap-sor és a **hirdető-azonosítás** (§C.2) **pixelben
látszik** mindkét méreten.

**Mért kiindulás (a régi doboz, látható 445 px):** 390 px-en a tartalom **61 %-a
(702/1147 px) rejtve** — az aláírás, a leiratkozó-mondat, a leiratkozó URL és a
hirdető-azonosítás mind. **1280 px-en is kiesett** a „A megkeresés küldője: …” sor.

### ② A visszafordíthatatlan küldés a levél UTÁN áll — és ragad

Minden állapot-átíró küldés-gomb (`/send`, `/send-pair`, `/send-pair-sms`, `/send-all`)
a **sávban** él, nem a csatorna-kártyákon. A sáv `position: sticky; bottom: 0`.

⛔ **A sáv a `.panel`-en KÍVÜL áll.** A konzolban `.con .panel { overflow-x: hidden }`,
ami a panelt **scroll-konténerré** teszi: egy azon belül ülő `sticky` a panel dobozához
tapadna, nem a képernyőhöz — néma díszlet lenne. A sáv a `.con-main` közvetlen gyereke.

### ③ A sáv ZÁRVA indul, és a levél VÉGE nyitja

Amíg a levél vége (a jogi rész) nem járt a képernyőn, a küldés-gombok tiltottak, és a sáv
**kimondja, miért**. Utána nyílik, és kimondja, hogy **nem vonható vissza**.

⛔ **Fail-safe irány:** a kiszolgáló a gombokat **ENGEDÉLYEZVE** rendereli, és a **JS zárja**
be őket. Ha a szkript elhal, a kezelő tud küldeni (a valódi garancia a §C szerver-oldali
kapuja) — egy halott szkript nem zárhatja ki a munkából. Fordítva a néma hiba **letiltott
gomb** lenne, ami tévesen „nem küldhető”-t állít.

⛔ **A tiltott gomb NÉZZEN KI tiltottnak** (`.con button:disabled` — opacity), és a sáv
szövege a **kattintás ELŐTT** mondja meg az okot, ne visszautasító sávból.

### ④ A számozott MMS/SMS idővonal nem ékelődik a Tárgy elé

Az „1 MMS · 2 Kísérő SMS · ✓” idővonal a **levél után** áll (a mobil-kártya „a lépések
lent” mondata így igaz marad), nem a csatorna-blokk és a Tárgy közé.

### ⑤ A lap alján van visszaút

`← Vissza a leadhez` a lap alján is, nem csak a tetején.

---

## AMIT A TERV NEM DÖNT EL (ne vidd tovább)

- **A Megkeresés-panel** (`/lead/<id>#prospects`) változat-döntése **külön jön** — az élő/archív
  jelölés, az archiválás és a címzett-mező NEM ebben a körben valósul meg.
- **A levél nyers tokenes URL-je** (`outreachEmail.ts` „a csupasz URL BIZALMI elem”) és az
  **ár-doboz „-tól” vége / a szándékos HTML↔text ajánlat-eltérés** (`p3`) **KÓDOLT DÖNTÉS** —
  a tulaj külön kérdezi meg, ebben a körben **nem írjuk át**.

---

## Az őr, amit ez a kontraktus megkövetel

`scripts/outreach-send-bar-check.mts` — a VALÓDI konzol-szerveren, valódi prospect-soron,
**390 és 1280 px-en**:

1. **Tapadás VALÓDI görgetéssel.** Nem geometriai tipp: a lapot végiggörgetjük, és több
   pozícióban mérjük, hogy a sáv alja a képernyő alján van-e. (Teljes-lapos screenshot itt
   **nem bizonyíték** — a sticky elemet a végleges helyére festi.)
2. **Láthatóság KÉT kérdésre** (ADR-0147): **kifestve** (`opacity === 1`) **ÉS nem takart**
   (`elementFromPoint` a gombot vagy a leszármazottját találja el). Az `elementFromPoint`
   az átlátszó elemet is eltalálja — önmagában sosem láthatósági verdikt.
3. **A jogi vég pixelben látszik** a szöveges változatban, mindkét méreten.
4. **Sorrend:** egyetlen POST-küldés-gomb sem előzi meg a levél kezdetét.
5. **Piros önteszt:** a sávot a panelbe visszatéve (a `overflow` csapda) az őrnek **buknia**
   kell; és egy `opacity:0`-ra állított sávra a geometriai próba zöld marad, a láthatósági
   pirosra megy.
