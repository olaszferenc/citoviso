# 2026-09-14 — A süti-sáv stílusa nem ért el a sávig (Elek FK-005b/006b/007)

## A bejelentés

Elek három külön körben, három külön felületen ugyanazt írta le:
- **FK-005b H-1:** „a süti-sáv stílus nélkül, a képernyő bal szélére tapadva, MINDEN admin-lapon"
- **FK-006b HIBA-2:** „a gombjai stílus nélküli, natív böngésző-gombok, a sáv a lap aljához vágva"
- **FK-007 H2:** „a süti-sáv stílus nélkül renderel — a vendég-oldalon is"

## A gyökér-ok (MÉRVE, nem feltételezve)

A `#cit-consent` szabályok a `public/assets/home/home.css`-ben éltek. Azt a fájlt
**MÉRTEN egyedül a `public/index.html` tölti be** — a sávot viszont a szerver
**KÖZÖS kimenete** (`send()` → `consentSnippet()`) teszi ki MINDEN saját lapunkra.

A 14 felület végigmérve (`.tmp` mérő-script, nyers HTTP + Host fejléc):

| | sáv megjelenik | ebből stílusos |
|---|---|---|
| mérés ELŐTT | 12 | **1** (`/` landing) |
| javítás UTÁN | 11 | **11** |

Csupasz volt: `/adatvedelem`, `/impresszum`, `/aszf`, `/elallas`, `/adatfeldolgozas`,
`/login`, `/login/help`, `/admin` (3 fül), és a tenant vendég-oldal a `/t/` dev-úton.
A `/` landing volt az EGYETLEN jó — **és pont azt nyitja meg a meglévő
`consent-check.mts`.** Ezért maradt a hiba láthatatlan egy zöld kapu mögött.

## Amit szállítottam

1. **A stílus a sáv MELLÉ került:** új `public/assets/runtime/cit-consent.css`, amit a
   `consentSnippet()` hivatkozik **tartalom-ujjlenyomattal** (`?v=<sha1>`, mint a
   `cit-consent.js`-t). ⚠️ A `withAssetVersions` MÉRTEN csak a honlapra fut — a
   jogi/belépés/admin lapok `citui.css`-e verzió NÉLKÜL hivatkozódik, tehát a
   dizájn-magba tett szabály a CDN 4 órás cache-e mögött ragadt volna. Új URL-nek
   nincs cache-bejegyzése → a javítás azonnal kiér. A `home.css`-ből a szabályok
   KIKERÜLTEK (egy szabály két példányban két igazság).
   A stíluslap a `</head>`-be megy, ha van — így a sáv nem villan fel csupaszon.
2. **Hatókör-rés zárva:** az `OWN_PAGE` jelölő a `/t/<slug>` dev-ág **ELŐTT** került ki,
   ezért a vendég-oldal azon az úton megkapta a sávot ÉS a Pixelt — amit a befagyasztott
   terv kizár. A jelölő a dev-ág UTÁN került. A `consent-check` ④ szabálya csak a
   host-utat mérte; most **mindkét utat** méri.
3. **Specificitás-csapda javítva:** a jogi lapok betöltik a `citui-console.css`-t, amiben
   a `.con button{background:var(--citui-white)}` (0,1,1) **VERTE** a
   `.cit-consent__yes` (0,1,0)-ét → az „Elfogadom" `/adatvedelem`-en és `/aszf`-en
   **FEHÉR** volt a cián helyett, a „Csak a szükségeseket" felirata fehér-fehéren
   **1,12-es kontraszttal**. Minden szabály `#cit-consent`-horgonyt kapott: injektált
   réteg nem veszíthet a gazdalap CSS-e ellen. (Ugyanez a csapda vitte el korábban a
   `.con a`-val a fizetés-gomb színét.)
4. **Tulaj-döntés — a sáv a gazdalap alsó bútorzata FÖLÉ ül.** A helyes (fixed) sáv
   MÉRTEN eltakarta a tenant-admin navigációját: mobilon a fül-sáv alsó sorát,
   **11 fülből 6-ot** (Webcím, Forgalom, Dokumentumok, Üzenetek, Fiók, Súgó), asztalin
   az oldalsáv **„Kilépés"** gombját. ⚠️ **Ezt a javításom hozta be**, mert javítás előtt
   a csupasz sáv `position: static` volt, tehát nem takart semmit. Két kép + három
   opció után a tulaj döntése: a hozzájárulás-kérdés NEM teheti elérhetetlenné a
   navigációt. Megvalósítás **két irányban, egyik sem kitalált konstans a sávban**:
   - a gazdalap deklarálja a fenntartott helyet (`--citui-consent-bottom`; a mobil
     admin a fül-sáv MÉRT magasságát — ezt ŐR tartja igazként);
   - a sáv publikálja a saját MÉRT magasságát (`--citui-consent-h`, a döntés után
     törli), amiből az admin oldalsáv a „Kilépés"-nek tart helyet — itt nincs konstans.

## Az őr

`scripts/consent-style-check.mts` — a RENDERELT lapon mér, 390px **és** asztali:
- a sáv háttere a `--citui-navy-950` token **PROBE-hoz** hasonlítva (egyszerre
  bizonyítja, hogy a szabály hatályos ÉS hogy a token feloldódott azon a lapon);
- `elementFromPoint` a sáv közepén (tényleg oda van festve), **görgetés nélkül**;
- a gomb nem natív (cián token + radius + nincs natív keret), **kontraszt ≥ 4,5**
  mindhárom feliraton (alfa-kompozitálva);
- `@container` hatályos (szűk sávban a próza a gombok fölé kerül, egyenlő gombok);
- **a sáv EGYETLEN fület sem takar el** (minden sáv-elemre elementFromPoint);
- a vendég-oldal MINDKÉT úton sáv/Pixel nélkül.

Pirosan is látva: `--self-test` (CSS eldobva + sáv injektálva a vendég-oldalra) →
**115 piros**; a helyfoglalás visszarontva → megnevezi a 6 mobil fült és az asztali
„Kilépés"-t. Bekötve: `hooks/pre-commit`. A `design-token-lint` lánca is megkapta az új
CSS-t (szándékos nyers hexszel pirosra próbálva).

## Három SAJÁT hiba, amit a mérés fogott meg

1. **A kontraszt-számolóm rossz volt:** a `color-mix()` eredményét a Chromium
   `color(srgb 1 1 1 / 0.82)` alakban adja (0..1), az `rgb()` 0..255 — összemostam,
   és a tökéletesen olvasható prózát 1,22-tel „bukónak" mondtam MINDEN felületen.
2. **A README prózájából mértem, nem a jóváhagyott képből:** a doksi „a gombok egymás
   alá kerülnek"-et írt, a jóváhagyott `mobile.png` + `approved.html` viszont fél-fél
   szélességű gombpárt mutat EGY sorban. A kód mindig a KÉPET követte. A README-t
   igazítottam a képhez, és kimondtam: **a kép a mérce.**
3. **A ui-shotot a rossz szerverre lőttem:** `--public` nélkül a KONZOL `/adatvedelem`-jét
   fényképeztem, és azon nincs is sáv — egy hajszál választott el attól, hogy a
   javítást egy másik szerver képén „ítéljem meg".

## ⛔ Landolási körülmény (fontos a következő szálnak)

Ez a munka a `~/wt/cit2167c7de` fában készült, ahol mérve **HÉT Claude-session
dolgozott egyszerre** (`C-kapu`, `Kilogo`, `Datum-ig`, `Regio`, `Ures blo`, `Felulet-`
és ez a szál), és a KÖZÖS git-indexben **26 fájl volt idegen szálak által stage-elve**
(köztük a `MEMORY.md`, a `_planning/DECISIONS.md` két idegen ADR-rel, és a
`hooks/pre-commit`, amibe az én blokkom is bele lett söpörve). Ezért:
- **nem** nyúltam a `MEMORY.md`-hez / `DECISIONS.md`-hez / `INDEX.md`-hez (idegen
  félkész tartalom van bennük stage-elve — a commitom ellopta volna);
- a landolás **külön, tiszta worktree-ből** (`~/wt/sutisavstil`) történt, fájlonként
  átvitt, hunk-szinten ellenőrzött saját munkával (a `hooks/pre-commit`-ba csak a SAJÁT
  blokkom került).

## Nyitott

- **ADR nem készült**, pedig a 4. pont tulajdonosi DÖNTÉS (a sáv a bútorzat fölé ül,
  a gazdalap deklarálja a helyét). A `DECISIONS.md` a közös fában idegen szál
  stage-elt ADR-jeit tartalmazta, ezért nem írtam bele — **a döntés ADR-be kívánkozik**,
  amint a doksi szabad.
- A `--citui-consent-bottom` mobil admin értéke MÉRT konstans (a fül-sáv tartalom-
  vezérelt magasságú). Ma őr védi; szebb volna a fül-sáv magasságát is publikálni.
- A konzol (`:4600`) betölti a `citui.css`-t, de sávot sosem kap (külön szerver,
  nincs `OWN_PAGE`) — ha ott is lesz fizetés, a sáv kérdése ott is felmerül.
