# 2026-09-19 — A kurátor kiküldési szándékát semmi nem gátolja (ADR-0187)

## A bejelentés

A tulaj a piszkozat-lapon (Aranykagyló 36) ezt látta, dühösen:

```
E-mail: most NEM küldhető — a jogszerűségi kapu tiltja (az okok lent)
Jogszerűségi kapu: PASS
```

Szó szerint: *„Megtiltom, hogy a kurátor kiküldeni szándékát bármi meggátolja.”*

## Mit mértem

A `describeMailSendability` a FŐ FÁBÓL (a worktree-ben a renderelt mock hiányzott, ezért ott
más — hamis — okot adott volna; a mock-fájlokat symlinkeltem be a méréshez):

```
flagged → "Dizájn-kapu: a generáláskori őr SÉRTÉST talált — az indok nincs eltárolva
           ehhez az artifacthoz (régi generálás)"
          "Kiút: nyomd meg újra a küldés gombot — a felugróban látod a leletet,
           és a megerősítéssel kimegy."
```

Vagyis **három hazugság egy sorban**: (1) nem a jogszerűségi kapu szólt, (2) „az okok” nem
voltak lent (a §C-nek nem volt mondanivalója → üres lista), (3) nem is tiltás volt — a
felugró + megerősítés kiküldi. A kurátor emiatt **meg sem nyomta a gombot**.

## A tanulság, amit érdemes megjegyezni

**Egy TILTÁS és egy KÉRDÉS nem ugyanaz az állítás.** Az `outreach-sendability-check` őr
ZÖLDEN védte a hibát, mert azt mérte, hogy „a lap állítása = a küldő-út verdiktje” — és
egyezett: a küldő-út tényleg nem küldött EGY kattintásra. Az őrnek **két** állapota volt
(mehet / nem mehet) ott, ahol **háromnak** kell lennie (mehet / megkérdezi / nem megy).
Amíg a modell kétértékű, a „második kattintásra kimegy” állapot a tiltás dobozába esik —
és a felületen tiltásként is olvasódik.

## Mit csináltam

- `SendOutcome.flagged` megnevezi a kaput (`gate: legal|photo|verdict`) és a
  vállalhatóságot (`confirmable`) — a képernyő nem következtet, hanem idéz.
- A sáv **három** állapota (zöld / sárga „a megerősítéssel kimegy” + a lelet saját sorai /
  piros valódi okkal).
- A **kép-lelet** is a küldés felugrójába került (eddig másik lapra terelt, kötelező
  indoklásért). Az ADR-0150 kötelező indoklása a **lead-lapi** úton változatlan.
- Kemény maradt: **§C jog** (Grt./Eker.tv.) és a **„nincs mit kiküldeni”** (nincs renderelt
  lap / felülírt fájl) — utóbbi nem a döntés felülbírálása, hanem hiányzó termék.
- Őr: ⑤ (megerősíthető ≠ „NEM küldhető”) és ⑥ (a „jogszerűségi kapu tiltja” csak §C-FLAG
  mellett), **önteszttel a kiment sáv szövegén** — pirosra megy rajta.

## Mellék-lelet (390px-en mérve)

A `.pill { white-space: nowrap }` egy SZÓKÉP-címkére való („✓ kiküldve”), nem egy mondatra:
a sáv mobilon „…a küldés gomb előbb megmut…”-nál elvágódott — **pont a fél mondat veszett
el, ami megmondja, hogy ki lehet küldeni**. A mondat-vivő pirulák (`pill--claim`) tördelnek.
A levágás mindig a VÉGÉT viszi el.

## Módosított fájlok

- `src/outreach/sendBatch.ts` — `FlagGate`, `confirmable`, `MailSendability` (3 állapot)
- `src/console/server.ts` — `verdictsNeedingConfirm` + kép-lelet, `heldForVerdictConfirm` ack
- `src/console/views.ts` — a sáv három állapota, a felugró kép-lelet-sora, `pill--claim`
- `public/assets/ui/citui-console.css` — `.pill.warn`, `.pill--claim`
- `scripts/outreach-sendability-check.mts` — ⑤/⑥ szabály + önteszt
- `kb/entries/console-outreach-draft/entry.hu.md` — három állapot + a felugró leírása
- `elek/scenarios/FK-004-outreach-send.md` — a „kiküldhető” szóra mér, Elek nyomja a felugrót
- `_planning/DECISIONS.md` — ADR-0187

## Nyitott

- A kiküldés maga NEM lett végigkattintva élesben (a `.env` valódi Zoho SMTP-t használ, és a
  csatorna egy-lövéses — egy próba elégette volna az Aranykagyló 36 e-mail-csatornáját).
  A tulaj a :4600-on tudja megnyomni; az Elek FK-004 köre mock-küldővel bizonyítja a láncot.
- A „Nyugalom Vendégház” prospect `no` állapotban van — nem néztem meg, mi tartja vissza.
