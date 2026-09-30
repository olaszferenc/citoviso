## ADR-0287 — Az eszkalációs emlékeztető óránként megy, 8–20 óra között (Budapest), ajánlatonként egyszer (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; brief:
`~/rc-briefs/eszkalacio-emlekezteto-orankent.md`; tulaj-döntés 17:45) · **Kapcsolódó:** ADR-0286 §5 (ezt írja felül),
ADR-0088 §4b (a follow-up), ADR-0080 (a napi billing-tick), ADR-0276 (OnFailure-riasztás), `src/sms/sendWindow.ts`.

**Kontextus.** Az emlékeztetőt a napi 07:00-s `citoviso-billing` tick küldte. ADR-0286 óta a késleltetés 1 órától
állítható, így a levél akár egy napot késett, és 24 óránál rövidebb maradék-ablaknál ki is maradt. A tulaj: fusson
óránként. Az éles VPS **UTC**-ben fut (mérve: `timedatectl` → Etc/UTC), a dev gép Europe/Budapest-ben.

**Döntés.**
1. **Külön időzítő:** `citoviso-offer-followup.timer` (`OnCalendar=hourly`, `Persistent=true`) →
   `scripts/offer-followup.mts`, `target: prod` a `targets.json`-ban (a deploy GATE 6 telepíti). A `billing-cycle.ts`-ből
   a lépés kikerült; a billing többi lépésének (megújulás, AAM-riasztás, számla-újrapróba) üteme változatlan, napi 07:00.
2. **Küldési ablak: 8:00–20:00 Europe/Budapest.** A meglévő hideg-megkeresési ablak óráit (`SEND_WINDOW`, 8–20) használja,
   de a budapesti falióra szerint (`budapestMinutes`, nyári/téli idő helyes), nem a folyamat helyi órája szerint. Az
   ablakot a KÓD tartja (`followupWindowBlocks`), nem az `OnCalendar`: az UTC-s gépen egy óra-szűrt naptár 1–2 órát
   csúszna. Ablakon kívül a futás semmit nem kérdez le és nem küld; az éjjel esedékes emlékeztető a reggel 8 utáni első
   futással megy.
3. **Idempotencia: atomi foglalás a küldés ELŐTT** (`claimFollowup`): a `followup_sent_at` csak akkor íródik, ha még üres,
   az ajánlat él (`expires_at > now`) és nincs felhasználva. Két átfedő futásból csak az egyik küld; lejárt ajánlat
   nem foglalható. Elbukott küldés után a foglalás feloldódik (`releaseFollowup`, csak a saját bélyeg), a következő óra
   újrapróbálja. (Korábban a bélyeg a küldés UTÁN íródott: napi egy ticknél ez elég volt, óránkéntinél nem.)
4. **Szövegek:** a felület, a KB, a kontraktus és a GLOSSARY az óránkénti, 8–20 órás küldést mondja ki. A kimaradás-
   figyelmeztetés feltétele a 24 órás maradékról az éjszakai szünetre (≤ 12 óra) szűkült.

**Őr:** `scripts/escalation-config-check.mts` ⑨: ablak nyári és téli időben (07:59 / 08:00 / 19:59 / 20:00); éjjel semmi
nem megy ki és nincs bélyeg; két egyszerre induló futás pontosan 1 levelet küld; a következő óra sem küld újra; a
foglalás kétszer nem sikerül, feloldás után igen; lejárt ajánlat nem foglalható. A teszt-futás a saját prospectjeire
szűkül (`onlyProspects`), a közös dev-DB idegen ajánlatát nem foglalja. Szándékos rontással mérve: foglalás nélkül
3, ablak nélkül 1, lejárat-feltétel nélkül 1 ellenőrzés bukik.

**Élesítés:** a deploy GATE 6 telepíti az új időzítőt (`citoviso-offer-followup.{timer,service}`); migráció nincs.

**Visszafordíthatóság:** 🔄 az időzítő letiltása leállítja az emlékeztetőt; a napi tickbe visszatenni egy commit.

**Mellékesen észlelt, nem javítva:** a hideg SMS-kapu (`smsWindowOpen`) a folyamat helyi óráját olvassa. Ha élesen
(UTC) futna SMS-küldés, az ablak 10–22 óra (Budapest) lenne. Ma az SMS a dev gép modemén megy (Budapest-idő), ezért
ez most nem hat. Külön döntés.
