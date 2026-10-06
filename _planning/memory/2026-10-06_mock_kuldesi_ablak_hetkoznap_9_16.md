# 2026-10-06 — Mock-megkeresés csak hétköznap 9–16 (Budapest) — ADR-XXXX

**Kérés:** tulaj 16:5x „Mockot hétköznap 9-16 között küldjünk!” (SUB, koordinátor cit671edbcb, brief `~/rc-briefs/mock-kuldesi-ablak-hetkoznap-9-16.md`).

**Elvégezve:**
- `src/sms/sendWindow.ts`: `MOCK_OUTREACH_WINDOW` (9–16, H–P), `mockOutreachWindowOpen/Blocks`; `mmsPullBlocks` először ezt kérdezi, a `MOBILE_SEND_WINDOW_OFF` nem oldja fel.
- `src/text/budapestTime.ts`: `budapestWeekday`.
- Szerver-kapuk (tiltás, üzenettel): `sendBatch.ts` `sendOutreachMail` (dry-run sor alatt), `sendOutreachPair.ts` `startOutreachPair`, `sendOutreachSms.ts` `sendOutreachSms`. A pár SMS-fele / javítás NEM.
- Dev relay: `src/mms/relayClient.ts` a pull előtt áll (`heldBack: "window"`), az SMS-sáv közben ürül; `windowAt` varrat az őrnek.
- Őrök: `send-window-tz-check` ⑧⑨, `mms-relay-check` ⑫ (átírva) ⑲; `hooks/pre-commit` trigger + `relayClient.ts`.

**Felfedezés:** élesen `MOBILE_SEND_WINDOW_OFF` be van állítva → élesen a 8–20-as mobil-ablak sem hat; az új ablak ettől független.

**Nyitott:** a kattintás ELŐTTI jelzés a konzol draft-lapján (most a gomb után jön a banner) — felület-munka, terv-kapuval; a 8–20 / OFF-kapcsoló sorsa a tulajé; allowlistes tesztszámra este sem megy MMS.
**Élesítés:** dev relay a land után él; szerver-oldal a nagy deployjal.
