## ADR-XXXX — Mock-megkeresés csak hétköznap 9:00–16:00 (Budapest) között indul; a dev relay a sort áll, a szerver tilt (2026-10-06)

**Dátum:** 2026-10-06 · **Státusz:** elfogadva (SUB, koordinátor: cit671edbcb; brief: `~/rc-briefs/mock-kuldesi-ablak-hetkoznap-9-16.md`) ·
**Kapcsolódó:** ADR-0288 (minden kimenő ablak Budapest szerint — ennek a kiterjesztése), ADR-0282 (MMS-relay, 19:30-as vágás),
ADR-0112 (mobil-pár, pár-javítás), ADR-0332 (modem-sáv), `src/sms/sendWindow.ts`.

**Kontextus.** Tulaj, 2026-10-06 16:5x: „Mockot hétköznap 9-16 között küldjünk!” — 16:30-kor még indult egy 9 leades kör,
az MMS-sor 17 óra utánig futott volna. Kódszinten eddig csak a hideg mobil-ablak (8–20) és az MMS esti vágása (19:30) élt,
az e-mailre semmi; ráadásul élesen a `MOBILE_SEND_WINDOW_OFF` be van állítva (élő teszt-kapcsoló), vagyis élesen a mobil-ablak
sem hat.

**Döntés.**
1. **Egy szabály, egy helyen:** `src/sms/sendWindow.ts` → `MOCK_OUTREACH_WINDOW = { fromHour: 9, toHour: 16 }`,
   `mockOutreachWindowOpen(now)` / `mockOutreachWindowBlocks(now)` — hétfő–péntek, Budapest falióra (a hét napja is
   budapesti: `budapestWeekday`, `src/text/budapestTime.ts`). Ünnepnap-lista nincs (tulaj: csak a hétvége).
   A 8–20-as `SEND_WINDOW` fölé ül, nem váltja ki.
2. **A `MOBILE_SEND_WINDOW_OFF` NEM oldja fel.** Az élesen beállított kapcsoló mellett a tulaj szabálya különben élesen
   nem létezne. Allowlistes tesztszám sem kivétel (a dev relay a pull előtt dönt, a címzettet nem látja).
3. **Hol indul mock-megkeresés — ott kérdez:** e-mail (`sendOutreachMail`), mobil-pár indítása (`startOutreachPair`),
   önálló hideg SMS (`sendOutreachSms`), szerver MMS-pull (`mmsPullBlocks`, minden MMS mock-megkeresés), dev MMS-relay
   (`relayClient.ts`, a pull előtt).
4. **Hol NEM:** a pár SMS-fele (`sendPairSmsHalf`), a pár-javítás és a közös `mobileOutreachGates` — egy 15:59-kor indult pár
   kísérő SMS-e (és javítása) 16:00 után is menjen ki (a 8–20-as ablakon belül), különben kép marad link és leiratkozás
   nélkül. A dev relay ablakon kívül is kiüríti az SMS-sávot. Az eszkalációs emlékeztető levél sem mock-megkeresés
   (egy már megkeresett lead ajánlatának emlékeztetője) — marad a 8–20-on.
5. **Szerver: TILTÁS érthető üzenettel, nem ütemezés 9:00-ra.** Indok: a meglévő kapuk (pár-indítás `pairWindowBlocks`,
   hideg SMS) is visszautasítanak, nem ütemeznek; az e-mailnek nincs sora, egy 9:00-s ütemező új tábla + futtató lenne;
   a pár sorba tett MMS-e éjszakára a sorban várna, miközben az operátor „elindult”-at lát. Az ok kimondja a napot és
   az órát: „mock-megkeresés csak hétköznap 9:00–16:00 (Budapest) között megy ki (most szombat 10:00) — a következő
   hétköznap 9:00-tól indítható”.
6. **Dev relay: a sor ÁLL.** Ablakon kívül nem húz (`heldBack: "window"`, a sor `queued`, kísérlet nem fogy), a következő
   hétköznap 9:00-s tick indítja — ez a land után azonnal él (a timer a fő fából fut), bármit futtat is az éles szerver.
7. **Az e-mail kapu a dry-run sor ALATT** ül (a tartalmi kapuk fölötte): a „Mehet ki most?” próba és a dry-run őrök a
   LEVELET ítélik, nem az órát; a küldés maga mondja meg, ha rossz az idő. A pár/SMS kapu a gombnyomás után szól, mint a
   `pairWindowBlocks` — a kattintás előtti jelzés a lapon külön (felület-)feladat.
8. A 8–20-as hideg SMS-ok „— a levél-csatorna éjjel is használható” utótagja törölve: e döntés óta hamis.

**Őr:** `scripts/send-window-tz-check.mts` ⑧ (3 folyamat-zóna × nyár/tél: 08:59/09:00/15:59/16:00, szombat/vasárnap,
budapesti hétköznap éjfél körül, OFF-kapcsoló mellett is zárva) és ⑨ (szerkezet: a kapu ott van és vissza is fordul,
ahol mock indul; nincs a pár SMS-felén/közös kapun); `scripts/mms-relay-check.mts` ⑫ (szerver-pull az új ablakkal, a sorral
végig) és ⑲ (dev relay: 16:00/szombat/08:59 nem húz, a kísérő SMS közben kimegy, 15:59-kor húz). Szándékos rontással
mérve: hétvége-szabály ki 8, 16→20 11, OFF feloldja 1, dev relay kapu ki 4, pár/SMS/e-mail kapu ki 2–2 bukás.

**Élesítés:** a dev relay a land után él; a szerver-oldal (e-mail, pár, SMS, MMS-pull) a nagy deployjal. Migráció nincs.
**Visszafordíthatóság:** 🔄 egy commit.
