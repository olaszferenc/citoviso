# Próba-javítások Elek 10-11 tenant-köréből (B1/B2/K1/A1–A3/A5/A7 + IT A3 időzóna)

**Dátum:** 2026-10-11 · **Szál:** SUB a „Elek-teszt koordinátor” alatt · **Döntés:** ADR-0364 (a land osztja ki)

## Elvégezve
- **B1:** a próba ígérete a beállított próba-csomagból: `src/trial/package.ts` (egy forrás, `trialModuleIds` ide költözött).
  Próba-űrlap, belépő-levél (HTML + szöveg), admin Modulok fül „minden …” helyett csomag-név + adott modulok; „minden”
  csak `everything` esetén. **A7:** Foglalások fül próbában foglalás nélkül → kimondja + Üzenetek + „Folytatom”.
- **B2:** régi HTML-másolat mockon nincs próba (claim előtt `not_available`, a lap nem kínálja); minden más bukás
  `abandonTrialStart` — claim + saját tenant + sites/ törlés, lifecycle vissza, pénzt nem érint; árva claim nem „tulajdon”;
  ház-riasztás „Citoviso: a próba NEM indult el”. Élesen (olvasva) 191 linkes leadből **0** régi mockos, 0 árva claim.
- **K1:** /folytatas a próba csomagját alkalmazza (applyPreset — csak a kijelölés nem elég, az összeg is kövesse).
- **A1** SMS „N nap mulva”; **A2** „Próba-kedvezmény (−X%)”; **A3** dupla fizetés 2. fülén tovább-linkek;
  **A5** jelszó-lap kimondja és meta refresh-sel is továbblép. **IT A3:** `trialUntilFrom` — naptári nap, DST-biztos.
- Őr: `scripts/trial-promise-check.mts` (régi kóddal 27 piros); frissítve: free-trial-check, free-trial-expiry-check,
  proba-c-checkout-check, optout-offer-price-check. KB: console-free-trial, console-pricing, admin-modules, admin-bookings.

## Nyitott
- A4 (karácsonyi 90 napos levél) tulaj-kérdés, A6 marad. A levelek adat-táblája „Próba-kedvezmény | −25%” címke/érték marad.
- Utána-képek: `_fix/shots/` (a SUB fájában, gitből kizárva).
