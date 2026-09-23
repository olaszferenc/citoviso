## ADR-0006 — Mock-motor: BŐVÍTHETŐ blokk-könyvtár + komponáló (nem reskin, hanem szerkezet)

- **Dátum:** 2026-07-09
- **Kontextus:** az ADR-0005 első PoC-ja a *bőrt* variálta (szín/font/hero-variáns), de a *csontok*
  (szekció-készlet, sorrend, komponensek) azonosak maradtak → a tulaj még mindig „egy kaptafának" érzékelte.
- **Döntés:** A variáció a **SZERKEZETBŐL** jöjjön. A motor egy **nyitott, folyamatosan bővíthető
  blokk-könyvtár + komponáló:** (1) sok, tényleg más **blokk-variáns** + **opcionális szekció-típusok**
  (nem minden mockban ugyanazok) · (2) globális **„dizájn-személyiség" tengelyek** (rács, tipó-skála,
  sűrűség, kép- vs. szöveg-vezérelt) · (3) **komponáló** (seed és/vagy AI art-director), ami eldönti MELYIK
  blokkok, MILYEN sorrendben, MELYIK variánsban, MILYEN személyiséggel. Új blokk = regisztráció, **nincs
  átírás** → az expresszivitás monoton nő; régió-szintű ütközés-kerülő.
- **Miért:** a szerkezeti + kompozíciós variáció változtat az ÉRZETEN (nem a paletta); halmozódó dizájn-vagyon,
  a „kaptafa"-kockázat idővel csökken; A4-konform (csak valós/nem-fabrikált tartalmú blokkok).
- **Visszafordíthatóság:** 🔄 · **Elvetett:** egy paraméteres sablon skinelése (a PoC — kevés) · nyers AI-HTML (törik).
- **Státusz:** ELFOGADVA. Építés: bővíthető regiszter + komponáló, induló blokk-készlettel.
