# 2026-10-04 — Lead-lista MOCK oszlop: a legerősebb mock-állapot + „✓ kiküldve” szűrő

SUB a „mock-összehasonlító / Kapunyitás” koordinátor alatt (brief: `~/rc-briefs/leadlista-mock-oszlop-kikuldve-szuro.md`).

## A hiba (tulaj: „azt írja, hogy elutasítva pedig jóvá van hagyva”)
- A MOCK oszlop a LEGKÉSŐBB GENERÁLT mock állapotát írta (`data.ts` `latestByLead`).
- Éles „The Boys apartman house”: 4 változat 09:49–09:50 között; a 09:50:07-es JÓVÁHAGYVA és kiküldve,
  a 09:50:44-es (legkésőbbi) elutasítva → a lista „elutasítva” + „✓ kiküldve”.
- Élesen mérve (csak olvasás): 13 mockos leadből **2**-nél hazudott (1× „elutasítva”, 1× „legenerálva” a jóváhagyott mellett);
  5 kiküldött leadből 2-nél nem a kiküldött mock volt a legutóbbi.

## A javítás
- `pickShownMock` + `MOCK_STATE_PRECEDENCE` (`src/console/leadFilters.ts`): jóváhagyva > (sent) > legenerálva > elutasítva,
  azonos állapoton belül a legújabb. Mezőnév: `LeadListRow.mockArtifact` (+ `byStatus`); a pirula elemleírása több mocknál
  „N mockból: 1 jóváhagyva, 3 elutasítva”.
- „✓ kiküldve” szűrő a MOCK oszlopon: `MOCK_SENT_CODE = "sent_out"`, a oszlop `tags()` = minden jel, amit a cella kiír;
  a multi-szűrő bármelyik kiírt jelre illeszt (állapottal együtt „vagy”).
- Mellék-javítás, amit az új fixture hozott elő: a MOCK oszlop a nyers enum szerint rendezett (`sortBy` = kiírt szó), és a mock-pirulák
  1280 px-en (rail) 2 px-szel kitolták a táblát (pirula oldal-padding 8 px a MOCK cellában).
- Jelmagyarázat + KB (`kb/entries/console-leads/entry.hu.md`) átírva.

## Őr
`scripts/lead-filter-label-check.mts`: „Mock = kiküldve” szűrő pontosan a kiküldötteket hagyja; a szűrő-mondat a cellák jeleit méri
(`data-tags`); MOCK-cella szabálya 5 esettel; önteszt: a régi „legutóbbi mock” szabály külön-külön pirosra fut.

## Nyitott
- A lead-LAP „mock: …” pirulája (views.ts `latestMock`) továbbra is a legutóbbi mockot mutatja — ott a mock-lista is látszik, nem érintettem.
- A „✓ kiküldve” a `prospect.sent_at`-ből jön (BÁRMELY csatorna első érintése), a jelmagyarázat viszont „e-mail”-t mond — SMS-only leadnél pontatlan.
