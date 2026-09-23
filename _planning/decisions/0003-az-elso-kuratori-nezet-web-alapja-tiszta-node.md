## ADR-0003 — Az első kurátori nézet web-alapja: tiszta Node `http` + saját `render.ts`

- **Dátum:** 2026-07-08
- **Döntés:** A belső operátor-konzol első szelete a beépített `node:http` szerverre + a meglévő
  szerver-oldali HTML-render mintára épül (`src/console/`), **0 új függőséggel**. Nincs router-lib.
- **Miért:** ADR-0001-konzisztens (saját/vékony, teljes átláthatóság, MineREAL-etosz); a kurátori
  nézet kicsi (lista + részlet + 2 gomb) → nem indokol router-keretet. A választás cserélhető.
- **Visszafordíthatóság:** 🔄 (később Hono/keret behúzható, ha a routing elnehezül)
- **Elvetett alternatíva:** Hono (pici router-helper) — ergonomikusabb, de +1 dep, most nem indokolt.
- **Státusz:** ELFOGADVA.
