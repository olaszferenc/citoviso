## ADR-0185 — ÁSZF 1.2: a bérelt honlapba fizetés-beépítés TILOS — kimondva, nem csak gyakorolva (2026-09-16)

**Dátum:** 2026-09-16 · **Státusz:** ELFOGADVA (tulaj jóváhagyta a három betoldás szövegét) ·
**Kapcsolódó:** ADR-0056 (ÁSZF-doktrína, verzió-bump), ADR-0088 ⑨ (ismétlődő mandátum),
támogatási cím: tulaj-döntés 2026-09-15 (`support-email-check` ①).

**Kiváltó.** A Barion elfogadóhely-bírálata (Remark -001, -003, 2026-09-16) három ponton
kérte az ÁSZF kiegészítését: ① a kártyatársasági szabályok miatt ki kell mondani, hogy az
általunk kínált feltételekkel készülő honlapokba online fizetési szolgáltató nem köthető be
(max. külső linkre irányítás, pl. Booking.com); ② a felmondás PONTOS módja (hová kattint,
milyen címre ír); ③ a bankszámlakivonaton elfogadóhelyként a Barion Payment Zrt. jelenik meg
+ Apple Pay csak egyszeri fizetésre.

**Döntés.** ÁSZF 1.2 (hatályos 2026-09-16), három betoldás a `src/legal.ts`-ben:
- **§1 (szerződés tárgya):** a honlapot a Szolgáltató üzemelteti, a Megrendelő BÉRLI; a
  bérelt honlapba fizetési kapu nem építhető, közvetlen online értékesítés nem folytatható;
  külső foglalási/értékesítési linkre irányítás megengedett; az űrlapok érdeklődés-továbbítók.
  ⭐ **Ez TERMÉK-KORLÁT, nem csak jogi mondat:** jövőbeli modul-ötlet, ami a tenant-oldalon
  vendég-fizetést venne fel, az ÁSZF-be ÉS a kártyatársasági szabályba ütközik. A Barion-
  elfogadóhely kizárólag a SAJÁT előfizetési díjaink beszedésére szolgál a citoviso.com-on.
- **§4 (felmondás):** a MÉRT, valódi út — belépés → „Modulok" fül → „Előfizetés lemondása"
  gomb (`adminViews.ts`, él), VAGY e-mail az ügyfélszolgálati címre. A cím `{SUPPORT_EMAIL}`
  tokenként áll a szövegben, és rendereléskor a `config.supportEmail`-ből helyettesítődik —
  vevő-oldali lapon beégetett cím tilos (tulaj-döntés 2026-09-15). A névelő fix szóra esik
  („ügyfélszolgálati e-mail-címére (…)"), hogy a cím cseréje ne törjön nyelvtant.
- **§2 (díjak):** kivonat-mondat + Apple Pay-korlát az ismétlődő-fizetés bekezdésben.

**Miért nem a modell változott.** A Barion olvasata („partnernek fejlesztett honlap") volt
téves; a domain-konstrukció (Szolgáltató nevére vett, bérelt domain, ÁSZF §9) VÁLTOZATLAN.
A -001-es válasz ezt magyarázza el, nem a modellt írja át.

**Visszafordíthatóság:** 🔄 szöveg + verzió-bump; elfogadott régi rendelésre az akkori verzió
irányadó (ADR-0056 🚪). **Élesítés:** külön engedéllyel jár (§0.3) — a Remark-válaszok CSAK a
kint lévő ÁSZF után küldhetők be.
