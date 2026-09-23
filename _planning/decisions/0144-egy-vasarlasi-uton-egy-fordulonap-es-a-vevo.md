## ADR-0144 — Egy vásárlási úton EGY fordulónap, és a vevő dátuma sosem gépi alakú (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA ·
**Kapcsolódó:** ADR-0080 ①/② (tenant-anchor, B-opció), ADR-0036/§B.18 (i18n), ADR-0130.

**Kiváltó (mérve, Elek FK-005a H-1 / FK-001 H1 / FK-006a HIBA-2, 2026-09-13).** Egyetlen
futáson a fizetőoldal „a mai fizetéstől számítva **2027. 09. 13.**"-át ígért, a visszaigazolás
„AZ ELŐFIZETÉSE" doboza **2027. 09. 10.**-et írt: **három nap eltérés egy automatikus
kártyaterhelésen** — a vevő egy dátumot fogad el és mást kap írásban. Külön leletként a
megújulás-értesítő „Honlap-előfizetése **2035-09-10** napon újul meg" alakban ment ki.

**A gyökér-ok (mérve, nem tippelve).** Nem kerekítés: a két képernyő **más forrásból** felelt.
A böngésző `today + 12 hó`-t számolt abból a feltevésből, hogy a fizetés hozza létre a horgonyt;
a szerver a tenant **meglévő** fordulónapját olvasta, mert az `ensureSubscriptionForOrder`
`onConflict doNothing`-gal szúr be — akinek már fut ciklusa, megtartja az eredeti fordulónapját,
és a vásárlás abba olvad (ADR-0080 ②). A kliens tippje **csak a legelső vásárlásra** volt igaz,
és pont az az egyetlen eset, amit valaha teszteltünk. A parkban a tenant horgonya 3 nappal
korábbi volt (`anchor_date=2026-09-10`, futás 09-13) — a **3 nap park-adat, a MECHANIZMUS nem az.**

**A döntés.**
① **A fordulónapnak EGY definíciója van:** `payment/subscription.ts › nextChargeDate()`. A
fizetés ELŐTTI ígéret és az UTÁNI visszaigazolás is ebből olvas; a kliens nem számol dátumot,
a szerver adja a manifestben (`renewalAnchor`). Ha nincs még előfizetés, a mező `null`, és a
fizetőoldal — igazat mondva — a mai naptól számol, **és ezt ki is mondja**.
② **A vevőnek szóló naptári nap MINDIG emberi alakú** (`2027. 09. 10.`), sosem `YYYY-MM-DD`.
Egy közös formázó: `src/text/day.ts` (`formatDay` / `formatDayStem` — az utóbbi a ragot kapó
mondatoknak, mert magyarul „10-ig" és nem „10.-ig"). A tárolt alak marad ISO; a **megjelenítés**
formázza, a hívó nem — így egy új levél-építő nem tud megfeledkezni róla.
③ **⛔ Naptári nap SOHA nem megy át `Date`-en.** A `new Date("2027-09-10")` UTC-éjfél, és negatív
eltolású zónában az előző napot írja ki. Ugyanez a hiba már elért vendég-levelet (db/client.ts
DATE-parser). A magyar alak ezért tiszta string-transzformáció, az Intl-ág UTC-re szögezve.

**Hatókör (mérve).** A bejelentés EGY mondatot nevezett meg; a mérés a bérlői Előfizetés lapon
további **13 mondatot** talált ugyanabból az egy nyers `renewDate` változóból, plusz a
hátralék-, fagyasztás- és dunning-szövegeket. Az osztály szélesebb volt, mint a lelet.

**Kapu:** `scripts/renewal-date-coherence-check.mts` — a fizetés ELŐTTI mondatot valódi
böngészőből, az UTÁNIT a valódi visszaigazolás-HTML-ből olvassa **egy futásban, egy DB-sorból**,
és eltérésnél piros. Saját eldobható DB (a park közös és időutazott). Negatívan futtatva
reprodukálja a bejelentett 3 napos rést, miközben az „első vásárlás" ág zöld marad — tehát
megkülönböztet, nem vakon tör.

**④ Az ÖSSZEG ugyanaz a hiba volt, és ugyanígy zárult (tulaj-döntés, ugyanaz a kör).** A
fizetőoldal csak a KIPIPÁLT modulokat árazta, a visszaigazolás a tenant ÖSSZES megújuló
modulját — mérve **10 800 Ft/év** eltérés. A szerver most a dátum mellé a hiányzó darabokat is
átadja (`payment/renewalQuote.ts`): a birtokolt-és-kínált modulok listáját, a NEM kínáltak havi
összegét, és a meglévő domain díját. ⭐ A kliens ezekre **ugyanazt a `countsToward()` szabályt**
futtatja, amit a kosárra — egy predikátum, nem második példány. A domain külön mezőben marad:
az éves kedvezmény a MI szolgáltatásunkra szól, az átfolyó registrar-költségre sosem.
A kapu fixture-je a termék saját útján ad jogosultságot (fizetett rendelés →
`syncEntitlementsToPaid`), és MINDKÉT vakfoltot kiélezi: egy birtokolt modul, amit a
konfigurátor nem is listáz, és egy másik, amit a vevő kipipál magából.

**Visszafordíthatóság:** 🔄 felirat- és számítás-szintű, adatmigráció nincs.
