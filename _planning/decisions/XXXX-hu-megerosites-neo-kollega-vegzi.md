## ADR-XXXX — A .hu Nyilvántartó megerősítését Neo kolléga végzi, nem a tulaj és nem egy vak szkript (2026-10-22)

**Kiváltó (tulaj, 2026-10-22 délután, a domain-szálban):** a kézi kattintásra: „ÉÉÉÉNNNNN???? EZ LeNNE A KURVA
NAGY AI FOLYAMAT????”; majd: „vagy már most mehet a gépi kattintás... de azt odaadnám valamelyik virtuális
kollégának!!!!!!!!!!!!!!!!!”; Neo javaslatára: „ok indulhat Neo”.

**Mi változik:** a 2026-09-09-i tulaj-döntés („a gép NEM kattint”, ADR-0400 ⑤) a vak, eredményt nem néző
szkriptre szólt — 2026-09-06-án egy Playwright-kattintás elhasználta a linket, siker-jel nélkül. Mostantól a
megerősítést **Neo** (digitális munkatárs, ADR-0325: saját session, saját Chrome) végzi, ahogy egy ember:
megnyitja, elolvassa, ellenőrzi, hogy a mi domainünkről és a mi regisztrálónkról (Olasz Ferenc) szól, beírja a
kódot, bepipálja a nyilatkozatot és az adat-egyezést, EGYSZER megnyomja a „Megerősítés” gombot, és CSAK a
kifejezett siker-szöveg láttán jelenti késznek, képernyőképpel (`~/neo/jelentesek/cfm-<domain>-*.png`).
⛔ „Elutasítás” soha; adat/jelszó/fizetés kérésénél megáll; nem sikerült → nem próbálja újra, jelent.
Neo a koordinátora jóváhagyásával dolgozik (a saját szabálya); a tulaj szava a koordinátor sessionjében is kell.

**Mért tény (2026-10-22, overseer.hu, Neo képernyőképe + a levél):** a `cfm.drr.hu` űrlap egy **e-mailben
küldött kódot** is kér (kötelező mező, „Újraküldés” gombbal), két checkboxot (nyilatkozatok; „Az összes adatot
ellenőriztem és helyesek az adatok.”), gombok: „Megerősítés” / „Elutasítás”; beküldési határidő 30 nap. A kód a
Nyilvántartó levelében áll („A megerősítéshez szükséges kód: XXXXX-XXXXX-XXXXX”), és a link `?code=<e-mail>,<KÓD>`
része előtölti. A figyelőnk ezt a részt **levágta** (javítva: `CONFIRM_LINK`, őr: `registry-confirm-check`) —
valószínűleg ugyanez volt a 09-06-i sikertelenség oka.

**Nyitott:** a link átadása Neónak ma kézi (a domain-szál küldi); a tartós kötés (a figyelő → Neo beérkező
mappája + 30 perces tulaj-tartalék SMS) a következő lépés.
