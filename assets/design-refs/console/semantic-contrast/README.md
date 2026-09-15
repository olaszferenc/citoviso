# A konzol jelentés-vivő színei — jóváhagyott terv („A — sötétebb felirat", 2026-09-15)

Tulajdonosi jóváhagyás: 2026-09-15 — a **gomb-stílus: A változat (sötétebb felirat)**, a
**hatókör: a jelentés-vivő színek mind** (szemantikus gombok + státusz-feliratok + linkek),
a **`--citui-muted` másodlagos szürke pedig SZÁNDÉKOSAN marad**. A tulaj 4 állapotot
(MA · A · B · C) látott mobil és asztali képen, és a kattintható `plan.html`-t, amiben a
váltó **élőben méri** a kontrasztot a böngészőben, minden gomb alá kiírva.
Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.

**Hatókör:** `public/assets/ui/citui.css` · `public/assets/ui/citui-console.css`

Referencia: `plan.html` · `ma-mobil.png` / `ma-asztali.png` (a MAI, bukó állapot) ·
`A-mobil.png` / `A-asztali.png` (a jóváhagyott változat) ·
`elotte-utana-asztali-1-elotte.png` / `…-2-utana.png` (ugyanaz a RENDERELT `/leads` lap,
kétszeres nagyításban, a nyers és a javított színnel).

## Miért van

⛔⛔ **Mérve a renderelt konzolon:** a jelzés-színeket FELIRATNAK is használtuk, és világos
háttéren egyik sem éri el a 4,5-ös küszöböt:

| token | érték | kontraszt | hol |
|---|---|---|---|
| `--citui-ok` | `#2fa96b` | **3,00** | **„Fizetek ▸"** és **„Jóváhagyás"** gomb, `.q-good` |
| `--citui-bad` | `#e5484d` | **3,91** | `.con button.bad`, `.pg-head`, `.q-bad` |
| `--citui-warn` | `#d29922` | **2,52** | `.q-mid`, „elavult" jelvény |
| `--citui-cyan-500` | `#1fb6d6` | **2,41** | **minden link** a konzolon |
| `--citui-info` (= cián) | | **2,15** | `.pill.generated` / `.sent` a saját tintjén |

A döntő gomb feliratát nehéz elolvasni — miközben a gépi „látható-e" próba IGAZAT mondott,
mert az a DOM-ot kérdezi, nem a szemet.

## Mit KÖT a terv

1. **A HUE NEM VÁLTOZIK.** A jelzés-színek maradnak, ahol JELZÉSKÉNT állnak: keret,
   háttér, pötty, ikon. Csak a **FELIRAT** kap sötétebb változatot — így a „színhang"
   megmarad, és a destruktív gomb **nem lesz hangsúlyosabb**, mint ma. (Ez a különbség
   a „B — tömör gomb" változattól, amit a tulaj épp ezért nem választott.)
2. **Négy szöveg-token**, a dizájn-magban: `--citui-ok-ink` · `--citui-bad-ink` ·
   `--citui-warn-ink` · `--citui-link-ink`. A színt egy helyen lehet megváltoztatni.
3. **Az értékek nem tippeltek.** Minden TÉNYLEGES háttérre megoldva (fehér · felület ·
   felület-2 · `ok-soft` · a pill/pg-box színkeverékei), és a legrosszabb eset is
   **tartalékkal** megy át (≥5,3) — egy „épphogy átment" érték a következő érme-feldobás.
4. **A `--citui-muted` NEM változik** (tulajdonosi döntés). 4,37–4,81 között van, a küszöb
   határán, és a token átütne a tenant-adminra és a vendég-oldalra is.
5. **A maradékot KI KELL MONDANI.** Az őr megszámolja és megnevezi, mi maradt a küszöb
   alatt — a kivétel sosem néma elnyelés.
6. **Az ikonok nem feliratok.** A cián akcent-pötty (`button.con-ib svg`, `.cp-hl svg`) a
   ház kézjegye, és nem szöveg — marad a márka-ciánon.
7. **A tiltott/kikapcsolt elem tompítása MEGMARAD** (`opacity`), mert az ÁLLAPOT-jelzés:
   a ház saját szabálya, hogy a tiltott gomb nézzen ki tiltottnak. Az őr ezt külön
   kategóriaként mutatja — de ⛔ csak akkor engedi, ha a felirat **tompítás nélkül**
   átmenne; egy rossz alapszínt nem lehet `opacity`-vel „szándékosnak" álcázni.

## Amit a terv NEM köt

A pontos hex-értékek: implementációs részlet, amíg a fenti szabályok teljesülnek (a mért
minimumokat a `citui.css` tokenjeinek kommentje tartja nyilván). A `--citui-muted`
jövőbeli sorsa: külön kör, külön döntés.

## Ami a mérésből jött (és amit a terv NEM oldott meg)

⚠️ A `[data-citui-theme="dark"]` hatókör ezeket a tokeneket **nem írja felül**. Ma ez
ártalmatlan — mérve: a sötét hatókörnek **0 használata** van a repóban —, de aki
bekapcsolja, annak ezt a négy értéket ki kell mérnie a sötét felületre.
