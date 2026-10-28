# 2026-10-27 — Terjeszkedés Bulgária + Horvátország: rendszer-szintű feltételek és roadmap

**Brief:** `~/rc-briefs/terjeszked-s-20261027-165047.md`: mérd fel, mi kell a BG és HR terjeszkedéshez, legyen roadmap.

## Tulaj-keret (menet közben pontosítva)
- Magellan külföldön folytatja a szállás-felderítést.
- A cél a külföldi vásárlási hajlandóság mérése.
- Jog és számlázás egyelőre zöld: EV-ként EU-s cégnek és magánszemélynek is mehet.
- Rendszer-szintű feltételek kellenek, nem jogi/számviteli elemzés.
- Az első változat jogi alapon érvelt („HR-ben tilos a hideg e-mail, ezért BG először”). A tulaj ezt alaptévedésnek nevezte és leállította; az a változat nem landolt.

## Elvégzett munka
- Kód-leltár: a felderítéstől a fizetésig minden HU-hoz kötött pont, fájl:sor hivatkozással.
- Roadmap: `_planning/ROADMAP-2026-10-terjeszkedes-bulgaria-horvatorszag.md`, 26 tétel, 6 fázis, 5 döntési pont.
- Kód nem változott.

## Fő megállapítások
- `SCOUT_KEYWORDS` fix magyar (`src/scout/rules.ts:15`).
- A konzolban rajzolt régió csendben HU-t kap, a mock nyelve a régió országából jön.
- A BG hiányzik a COUNTRY_LANG-ból.
- A fizetési út HUF-ot ír; a lead-lap nem HU országnál a `global` EUR-régióból olvas.
- A sablon-fontok nem cirillek.
- A kritikusok, valamint Neo és Poe normája magyar.
- SMS csak HU-mobilra megy, ezért külföldön csak e-mail.
- Csak `.hu` TLD van.
- Javaslat: Magellan mindkét országban gyűjt; mock és kiküldés HR-ben előbb (nincs cirill munka), BG utána.

## Nyitott (tulaj)
- Sorrend.
- EUR-ár HR-ben és BG-ben.
- Domain nélküli külföldi alapcsomag.
- Mintaméret (javaslat: 300 mock/ország).
- Induló régiók.
