# 2026-09-21 — A márkajel, ami két példányban élt (E4 jóváhagyva)

**Kiinduló kérés (tulaj):** „egy számlázz.hu-ra feltölthető cito logót png".

## Amit a kérés kibontott

A logó legyártásához meg kellett keresni a forrást — és kiderült, hogy **két külön márkajel él
a repóban, egymásról nem tudva**:

| hol | rajz | mióta |
|---|---|---|
| `src/console/views.ts:117` + `src/server/adminViews.ts:101` | cián C-ív, **navy pötty**, cián play (viewBox 48) | ez fut élesben a fejlécben |
| `assets/brand/{mark,lockup}-{gradient,mono}.svg` + `public/assets/ui/` | **navy** C-ív, gradiens szemgolyó fehér csillanással, Poppins, a szó csak „**itoviso**" (a jel MAGA a C) | commitolva `94680b4`, 2026-07-07 |

A favikont (`adminViews.ts:93`) a **második** készlet szolgálja ki, a fejlécet az **első** — vagyis
a lap teteje és a böngésző-fül két különböző logót mutatott.

## A tulajdonosi bejelentés és a VALÓDI ok

Képernyőkép az éles `/pay/done`-ról: *„itt a bal felső sarokban nem látszik jól a logo…
olyan logó verziót tudsz csinálni ahol a Citoviso-ban a C körvonala is kék, azt kéne berakni
fehér halo-val nem?"*

⛔ **A bal felső sarokban nem a logó volt.** A fizetés-lap a `.pd-brand__mark`-ot rajzolja
(`views.ts:2069`): egy 22 px-es CSS-kör, `border-right-color:transparent` — **se szem, se
play-háromszög**. A jel fele nem volt ott. A közepe mérve **1,06 kontraszt**, azaz üres.

⛔ **A javasolt halo mérve semmit nem old meg.** A navy pupilla kontrasztja a navy fejlécen
**1,44**, és halóval **ugyanúgy 1,44** — a glória a KONTÚRT emeli, a jel közepét nem. A tünetről
a bejelentés igazat mondott, a mechanizmusról nem; ezt mérni kellett, nem elhinni.

Mért kontrasztok (valódi renderből, 22 px-es jelen, a `/pay/done` gradiensén):
`A (mai) 1,06` · `B igazi jel 1,44` · `D +halo 1,44` · `E gradiens szem 5,85` · `C/F/G fehér 10,46`.

⭐ A „fehér karakterekkel" ötlet **már létezett**: `assets/brand/mark-mono.svg`, `currentColor` —
hónapok óta a repóban, használat nélkül.

## §2b — két kör

**1. kör (A–G):** hét változat a VALÓDI `/pay/done` gradiensén, mindegyik a **tényleges méretében**
(22 px fizetés-lap · 38 px konzol · 96 px), méret-váltóval, világos-hátterű ikerrel.
→ Tulaj: **„az E a jó irány, csak a play beljebb került a szemben, mint az eredeti logóban."**

**2. kör (E1–E4):** a play pozíciója. Mérve, 120-as rajz-egységben:

| | rés a szemtől | play a C szájához képest |
|---|---|---|
| mai jel (views.ts) | 17,5 | −1,2 |
| E1 (mark-gradient) | **5,0** | **−14,6** |
| E4 (jóváhagyva) | 21,5 | −2,6 |

→ A tulajnak igaza volt, és a mérték is megvan: a play 14,6 egységgel beljebb ült.
**Választott: E4** — kisebb szem (`r=12.5`, `cx=48`), a play a száj vonalánál (`x=82`).

## Szállítva

- `assets/brand/mark-e4-dark.svg` · `mark-e4-light.svg` — **bitre azonos geometria**, csak a szem
  gradiense és a play színe tér el. A C-ív **mindkettőn cián** (tulajdonosi döntés: „a C körvonala
  is kék") — a 2026-07-07-es navy ív ezzel felülírva.
- `assets/brand/citoviso-logo-szamla.png` (1806×560, 44 kB) — **ez megy a Számlázz.hu-ra**;
  továbbá sötét-hátterű, átlátszó és csak-jel változat.
- `assets/design-refs/console/brand-mark/` — a befagyasztott terv (§2b 5): README a KÖTELEZŐ
  geometriával és a mért kontrasztokkal, a választólap és az összehasonlító kép.

## Saját hibák (mind a saját mérésem fogta meg)

1. ⛔ **Az „átlátszó" PNG nem volt átlátszó.** A generátorban a `html,body{background:#fff}` ágam
   megölte az `omitBackground`-ot → a fájl neve alfát állított, a tartalma fehér hátterű volt
   (a két fájl **md5-azonos** lett — ez árulta el). Javítva, és a generátor most **utó-feltétellel**
   méri kiírás UTÁN, hogy minden fájl háttere megfelel-e a nevének.
2. ⛔ **Álbukás a saját ellenőrzőmben:** a méret-váltót a kattintás után **0 ms-nál** mértem,
   miközben `transition: max-width .2s` fut (mérve: 390 px @0ms → 1180 px @250ms). A mock hibátlan
   volt; előbb bizonyítottam a mechanizmust, és csak utána igazítottam az ŐRT, nem a terméket.
3. ⛔ **Hamis állítást írtam a saját mockomba:** az E-ről azt jegyeztem fel, hogy 22 px-en
   „a gradiens és a csillanás egyetlen folttá esik össze" — a kép és a mérés (5,85) cáfolta.
   Javítva, mielőtt a tulaj elé került.
4. ⚠️ Vak pixel-koordinátákból mértem kontrasztot (a „pupilla" mindig a hátteret találta el) →
   átálltam DOM-ból vett elem-screenshotra.
5. ⚠️ A `clip`-es screenshot **a LAPHOZ koordinál** — `fullPage: true` nélkül a viewporton kívüli
   kártyák kivágása elszállt (ez a `reference_fullpage_shot_hides_dead_sticky` ismert csapdája).

## NYITOTT — a bejelentett hiba ÉLESBEN MÉG OTT VAN

A terv jóvá van hagyva, az assetek megvannak, de **egyetlen kódsor sem változott**. A javítás
három helyet érint:

1. `src/console/views.ts:2069` — `.pd-brand__mark` CSS-karika → az igazi jel (**a fizetés-lap**)
2. `src/console/views.ts:117` és `src/server/adminViews.ts:101` — a fejléc-jel az E4-re
3. `public/assets/ui/mark-gradient.svg` — a favikon ma a régi rajzot szolgálja ki

⚠️ A felirat/asset-csere fogyasztói (KB-screenshotok, `design-token-lint` ALLOW-lista, Elek-fixture-ök)
a csere ELŐTT grepelendők — a jel három helyen van beégetve inline SVG-ként.
