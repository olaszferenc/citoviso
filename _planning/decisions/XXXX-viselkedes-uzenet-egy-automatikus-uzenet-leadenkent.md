## ADR-XXXX — Viselkedés-üzenet: egy automatikus üzenet leadenként, amikor a lead lép (A változat)

**Dátum:** 2026-11-12 · **Döntött:** tulaj (2026-11-11, a koordinálón át: A változat, hétköznap 8–20,
az eszkaláció marad, a „NEM” nem iratkoztat le, GSM-7), a megvalósítás részleteit a session rögzítette

**Kontextus.** Az elemzés (7/C, `~/rc-briefs/konverzio-terv/viselkedes-uzenet-jelentes.md`) élesen mérte:
92 elérhető visszatérő lead, 17 árnéző próba nélkül, 5 megnyomott, de el nem küldött próba-gomb, a
„Mi tartotta vissza?” kérdésre 0 válasz. A visszatérő látogatások 78%-a hétköznap 8–20 közé esik, de csak
41%-a 9–16 közé (2026-11-11-i újramérés 114 visszatérőn: 8–20 → 75%). A 2026-10-26-i tömeges 2. levél
6 leiratkozást és 0 próbát hozott, tehát nem tömeges kör kell, hanem a lead saját lépésére adott válasz.

**Döntés.**
1. Leadenként EGYETLEN automatikus SMS vagy e-mail, örökre (`behavior_message`, egyedi a leadre és a
   (csatorna, cím) párra — személyenként egy). Kiváltó: 2. látogatás · árnézés (`panel_open`) · próba-gomb
   (`trial_open`, a saját `#inditas` linkünk nyitása nem), el nem küldve; a legerősebbre válaszol.
2. Az utolsó aktivitás után 20 perccel, hétköznap 8–20 Budapest (`behaviorWindowBlocks`, a
   `MOBILE_SEND_WINDOW_OFF` nem oldja); 4 napnál régebbi kiváltóra nem megy.
3. Szöveg csak tényekből (név, link, „-tól” ár, a lap által kínált próba-napok), LLM-hívás nincs; egy link a
   kerdes-inditas horgonyára (`#kerdes` · `?k=ar#ar` · `#inditas`). Kedvezményt nem említ (az eszkalációs
   −30% a lapon marad, a kettő nem mondhat mást); nincs „írja vissza: NEM” sor (a válasz a tulaj
   jóváhagyó sorába megy, a leiratkozás a linkelt lapon van). SMS GSM-7, ≤ 2 szelet.
4. Csatorna: a hideg megkeresés csatornája — mobil (SMS/MMS-pár) → SMS, különben e-mail a helyi segítő
   nevében (ADR-0425). Az SMS a hideg SMS kapu-láncán megy (`mobileOutreachGates`), a levél a §C kapun.
5. Leállít: leiratkozás (link / cím / szám), „ne keressük” (ADR-0421), bármilyen válasz, próba, vásárlás,
   rendelési szándék, kizárt/megszűnt, teszt, archivált link, közös cím/szám (ADR-0353); küldés előtt újramérve.
   A válasz és a „ne keressük” SZEMÉLY-szintű: ugyanazzal a mobillal / címmel egy másik (same_owner) lead sem
   kap üzenetet (jog/provenance-őr, 2026-11-12).
4b. A levél feladója a helyi segítő-név (ADR-0425) — ez a perszóna eddig csak próbázóknak írt; itt a még nem
   ügyfél leadre is kiterjed (az aláírás „Citoviso ügyfélsegítő”, a cégazonosítás ott van). A jogalap-mondat a
   próba-kampányé (a küldött tervre hivatkozik, nem arra, hogy „megnézte”), `List-Unsubscribe` a hideg levél
   kapcsolója szerint.
6. Konzol: CRM → „Viselkedés-üzenetek” (`/viselkedes-uzenetek`) — főkapcsoló (alapból KI; bekapcsoláskor
   `since` = most, csak az azutáni események számítanak) + ki mit kapott és mi lett belőle 24 órán belül.
   Futtató: `scripts/behavior-message.mts`, `citoviso-behavior-message.timer` (10 percenként, prod).

**Következmény.** A deploy telepíti az időzítőt, de üzenet csak a főkapcsoló bekapcsolása után megy (a tulaj
lépése). A kérdés-indítás terv horgonyai nélkül a link a lap tetejére visz — a deploy-sorrend: előbb a
kerdes-inditas, utána ez (vagy együtt).

**Visszafordíthatóság:** 🔄 a főkapcsoló egy kattintással leállítja; a tábla és az időzítő törölhető.

**Elvetett alternatívák:** B (háromlépcsős, szezon-lépéssel — a 3. lépés dátumra, nem viselkedésre megy),
C (eseményenként, max. 3 — több érintés, nagyobb leiratkozási kockázat); 9–16-os ablak (a visszatérők
fele kimaradna); az eszkaláció kivezetése (a tulaj: „úgy néz ki, ez hoz most egy megrendelést”).

**Terv:** `assets/design-refs/console/viselkedes-uzenet/` (README = ami köt). **Őr:** `scripts/behavior-message-check.mts`.
