## ADR-XXXX — Próba-kampány: egy lövés SZEMÉLYENKÉNT, újramérés küldéskor, csak a hideg levél címére

**Dátum:** 2026-10-10 · **Kontextus:** IT D (`~/wt/citf604e298/_it/parts/d.md`: D-1f, D-1g, D-1h, D-1i, D-1x, D-2h, D-3a, D-4h, D-4k, D-5l/m, D-8k). Kiegészíti: ADR-0348 (visszamenőleges próba-levél).

**A hiba**
- A lábléc ígérete („Erről a próbáról több levelet nem küldünk”) csatornánként élt: ugyanaz az ember (két szállás, közös mobil) levelet ÉS SMS-t kapott; az operátori kizárás és a már kiküldött lead ikre megkapta.
- A futó a listát egyszer olvasta, a futás órákig tart: közben próbát indító / rendelő lead is megkapta a „14 nap ingyen” levelet; a `disqualified` / `terminated` lead célpont volt.
- A levél az élő prospect ÚJ címére ment, ahova hideg levél sosem ment („Szeptember 24-én küldtünk Önnek…” valótlan).
- A foglalás és a küldés közt meghalt futás `claimed` sora örökre „már megkapta” maradt; a `--kapuk` száraz futás előnézeti aldomaint foglalt; `--go` `--limit` nélkül elbukott.

**Döntés**
1. **Személy-kulcsok:** egy lead minden itt ismert címe (a hideg levél címe, az élő prospect címe) és magyar mobilja. A már kapott, a futó/beragadt foglalású és az operátor által kizárt lead MIND a kulcsait foglalja; a célpont is. **Levél-célpontok előbb**, utána SMS — a közös emberből levél-célpont lesz (a teljesebb üzenet).
2. **Újramérés a foglalás előtt** (`rejudge`): ugyanazok a szabályok, mint a listán; ha a lead kiesett, vagy a csatorna/cím/link változott, kihagyás (a következő futás újraméri).
3. **`disqualified` / `terminated` lead kimarad** (`INACTIVE`, ugyanaz, mint a közös-kontakt kapué).
4. **Csak a hideg levél címére.** Ha az élő prospect címe azóta más, a lead kimarad („a cím a hideg levél óta változott”) — se a régire (lehet, hogy azért javították, mert rossz volt), se az újra (oda nem ment levél). Kézi döntés.
5. **Beragadt foglalás:** `claimed`, `sent_at IS NULL`, 30 percnél régebbi → a száraz futás külön listázza; feloldás csak kézzel: `--felold <sorId|leadId> --ok "<miért>"` (az operátor előbb az outboxot / modem-naplót nézi). A legfeljebb-egyszer szemantika marad (dupla küldésnél jobb a kimaradás). Feloldás után az eszkalációs follow-up csendje is megszűnik.
6. A száraz futás (`--kapuk`) nem ír: az előnézeti címkét csak kikukucskálja (`peekPreviewLabel`). `--limit` hiánya = nincs korlát; egy kapcsoló értéke sosem a következő kapcsoló (`--ok --go`); az azonosító szigorú UUID.

**Nem változott:** az SMS offline kapu-előrejelzése (D-8k első fele: allowlist / közös kontakt / kurátor a száraz futásban kimarad) és a gmail-pont összevonás (D-1c) — GYANÚ / APRÓ, külön kör.

**Őr:** `scripts/trial-campaign-check.mts` ⑦ (11 állítás, a régi kóddal mind piros).
