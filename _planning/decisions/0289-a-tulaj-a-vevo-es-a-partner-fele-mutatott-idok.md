## ADR-0289 — A tulaj, a vevő és a partner felé mutatott idők Budapest szerint; egy közös zóna-segéd (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; brief: `~/rc-briefs/helyi-oras-maradek.md`) ·
**Kapcsolódó:** ADR-0288 (a kimenő ablakok; ez az ott felsorolt négy maradékot és a rokonaikat zárja), ADR-0287.

**Kontextus.** Az éles VPS UTC-ben fut. Minden nem-UTC `Date`-getter (`getHours`, `getDate`, `getFullYear`…) és minden zóna
nélküli `Intl`/`toLocale…` a folyamat zónáját olvassa, ezért élesen 1–2 órával eltolva mutatta a vevő fizetési időbélyegét,
a naptár „utoljára frissült” idejét, a forgalmi jelentés napjait és hónapját, a tulaj üzeneteinek „ma/tegnap” jelzőjét, a
dokumentumok évét, és rossz évhatárral számolta az AAM-keretet (adóév) és a foglalási év-csempét. A dev gépen (Budapest)
ebből semmi nem látszott.

**Döntés.**
1. **Egy közös zóna-segéd:** `src/text/budapestTime.ts` — `APP_TZ`, `budapestParts`, `budapestMinutes`, `budapestHhmm`,
   `budapestIsoDay`, `budapestYear`, `budapestMidnight` (DST-napon 23/25 órás nap helyesen), `budapestDayStart`,
   `addIsoDays`, `isoDayDiff`. A `sendWindow.ts` (ADR-0288) innen veszi a zónát és az óra-olvasókat (re-export, nincs
   második példány).
2. **Javítva (a formátum változatlan, csak a zóna):**
   - vevő: `multilangCard.ts` `fmtStamp` (fizetési bélyeg), `wallet.ts` (kártya mentése, fizetések, kártya-történet napja —
     a `current_period_end` Postgres `date`, az marad);
   - tulaj: `moduleConfigViews.ts` „Utoljára frissült”, `adminViews.ts` `relDay` („ma/tegnap”), `fmtDate`/`fmtDateTime`,
     az éves díj „k. hónap a 12-ből” mérője, `availability.ts` az alapértelmezett (aktuális) hónap, `documents.ts` az év,
     `bookingViews.ts` + `public.ts` az „idén” év-csempe (a két oldal ugyanazzal az évhatárral);
   - forgalom: `trafficReport.ts` az időszak kezdete (budapesti éjfél) és a 7 napos sparkline napjai (SQL:
     `occurred_at AT TIME ZONE 'Europe/Budapest'`), `trafficMail.ts` a hónapnév és az „ebben a hónapban ment-e már” határ
     (SQL `date_trunc` Budapest szerint);
   - partner/operátor: `aamAlert.ts` + `partnerData.ts` az AAM-adóév, `partnerViews.ts` a havi grafikon éve.
3. **Szándékosan NEM változott:**
   - Postgres `date` ÉRTÉKEK naptár-matekja (`billing.ts`, `subscription.ts`, `subscriptionAdmin.ts`, `domainCommitment.ts`,
     `moduleUpsell.ts`, `availability.ts` hónap-rács, `wallet.ts` `isoDate`): nem pillanatok, hanem naptári napok; a helyi
     getter ezekre minden zónában konzisztens (a `billing.ts` ezt kommentben ki is mondja).
   - **A foglalási/árazási „ma” (UTC-nap) — NYITOTT, külön döntés.** ~20 hely egységesen `new Date().toISOString().slice(0, 10)`-zel
     számolja a mai napot (`booking/requests.ts`, `booking/sync.ts`, `tenant/prices.ts`, `priceGap.ts`, `priceExpiry.ts`,
     `seasonNudge.ts`, `units.ts`, `editor.ts`, `availability.ts`, `bookingViews.ts`, `adminViews.ts daysUntil`,
     `moduleConfigViews.ts`, `engine/moduleSections.ts`, `public.ts`, `payment/service.ts`, `analytics/siteVisit.ts`,
     `scraper/contactLedger.ts`). Ez NEM a szerver zónájától függ (minden gépen UTC), de 00:00–02:00 (Budapest) között
     a tegnapot adja. Részleges átírás két „ma”-t csinálna egy tartományban, ezért egy söpréssel, egy `todayIso()`-val
     javasolt — a foglalási logikát érinti, tulaj-döntés.
   - `domains/registrar/*` lejárat (+1 év, regisztrátori dátum), `scraper/website.ts` copyright-év (heurisztika).

**Őr:** `scripts/send-window-tz-check.mts` bővítve: ⑥ Budapest / UTC / New York folyamat-zónában, nyáron és télen, 00:30-kor
(ahol UTC és Budapest napja eltér): a nap és a vevő fizetési bélyege; a jelentés éjfele; DST-napok 23/25 órája; 7 napos ablak
DST-váltáson át; szilveszter/újév éve; a havi levél hónapneve hónapfordulón. ⑦ szerkezeti: a tulaj/vevő-felé néző
idő-olvasó fájlokban nincs helyi getter, minden dátum-formázó kimondja a zónát, minden SQL nap/hónap-határ `AT TIME ZONE`-nal
számol. Szándékos rontással mérve: fizetési bélyeg helyi getterrel 5, jelentés-kezdet `setHours`-szal 5, hónapnév zóna nélkül
3, „Utoljára frissült” zóna nélkül 1, `relDay` zóna nélkül 1, SQL napkulcs `AT TIME ZONE` nélkül 1 piros. A két SQL élesen
(dev-DB) lefutott: a hónap-határ 2026-10-01 00:30 Budapestnél 2026-09-30T22:00Z.

**Élesítés:** az ADR-0287/0288-cal együtt; migráció nincs. **Visszafordíthatóság:** 🔄 egy commit.
