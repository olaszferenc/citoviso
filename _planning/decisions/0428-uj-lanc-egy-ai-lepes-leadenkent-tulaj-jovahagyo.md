## ADR-0428 — Új lánc: egy AI-lépés leadenként + tulaj-jóváhagyó lap a kiküldés előtt

**Dátum:** 2026-11-06 · **Döntött:** tulaj

**Kontextus.** A munkatárs-lánc (Magellan → Neo → Poe → Vera → -bb) ≈ $5,5/lead előfizetői keretet vitt (11-01..05, mérve), mert minden szereplő hosszan futó sessionben, ~210k tokenes kontextussal dolgozott, és ugyanazt a fotót négyen nézték meg. Az egylépéses átnéző (leadenként egy friss `claude -p`, minden fotó teljes méretben + forráscsomag + mock-szöveg) 102 leaden $0,45/lead, a -bb képlevételeinek 97,5%-át elkapja.

**Döntés.**
1. A láncban EGY AI-lépés marad leadenként (az átnéző); minden más szkript (2. terv a fő terv kurátori szövegéből, másik engedett sablonnal, AI-hívás nélkül; képlevétel; sor). Felderítés és kontaktgyűjtés szkriptje épül.
2. Az átnéző MEHET-je NEM kerül azonnal a kiküldési sorba: `held` + `JÓVÁHAGYÁSRA VÁR (egylépéses átnéző: MEHET)` jegyzettel vár, amíg a tulaj a konzol `/jovahagyas` lapján (balra a lista, jobbra a teljes oldal kicsinyítve, 1./2. terv, asztali/mobil) „Mehet” → `queued` vagy „Nem mehet ki” → `cancelled`; utána a következő lead nyílik.
3. A mock-megkeresés ablakának vége `MOCK_OUTREACH_TO_HOUR`-ral 17–20 órára tolható (alap 16; tulaj 11-06: „ma 5-ig”).
4. Az API-kulcsos költés a lánchoz 0: `HERO_SCORE_DAILY_CAP_USD=0`, `AI_DAILY_CAP_USD=0` (élesen beállítva 11-06).

**Következmény.** Cél ≈ $0,5/lead teljes lánc; a jóváhagyó lap az átállás elején a minőség emberi mintavétele, később kivezethető.
