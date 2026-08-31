# Mock szöveg-panel — JÓVÁHAGYOTT TERV (2026-08-31)

`copy-panel.html` — a lead-oldal „Mock és generálás" fülén álló panel terve.
Tulajdonosi jóváhagyás: 2026-08-31 („jó lesz haladjunk"), a B — „Tény-mérleg" változat,
javított feliratokkal.

**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A megvalósult felületet ehhez mérjük;
ami itt viselkedés, azt a kódnak produkálnia kell.

## Miért létezik ez a panel

A generált szöveget eddig **sehol nem lehetett elolvasni** a konzolban — a tulajnak meg
kellett nyitnia a mock HTML-t ahhoz, hogy lássa, mit írt a motor. Emiatt mehetett ki
hónapokig olyan szöveg, mint „Fenyőillatú csend a tető alatt" egy játszótérrel, kerttel
és saját parkolóval hirdetett szállásra: **nem volt hol észrevenni.**

A panel ezért nem csak megjeleníti a szöveget, hanem **szembeállítja azzal, amit a szállás
saját hirdetéséről tudunk** — mert a mai baj nem az volt, ami a szövegben BENNE volt,
hanem amitől üres maradt.

## Amit a terv KÖT

1. **A teljes eladó szöveg olvasható** a konzolban, a lap megnyitása nélkül:
   hero-kicker, hero-főcím (a dőlt akcenttel együtt), alcím, bemutatkozó, kiemelések.
2. **Mérleg-sáv legfelül**, sima magyarul — ⛔ a „erős pont" típusú belső zsargon TILOS:
   „N szolgáltatást használ fel a hirdetés M-ből" / „K dolgot a hirdetéséből nem említ".
   (A tulaj a `4 erős pontot kihagy` feliratot nem értette; ez az őr belső súlyozásának
   a szava volt, nem a felhasználóé.)
3. **Két csoport, láthatóan elkülönítve:** amit a szöveg elad (zöld), és amit nem
   említ (sárga). Mindkettő a szállás SAJÁT, hitelesített hirdetéséből.
4. **A nem említett tételek KOPPINTHATÓK**, és a koppintás beírja őket az
   újragenerálási utasításba. Kötelező viselkedés:
   - a kézzel beírt szöveg **megmarad**,
   - több kiválasztott tétel **EGY** utasítás-sorba fűződik,
   - az újra-koppintás **csak azt az egy tételt** veszi ki,
   - a koppintás **nem** írja át magától a szöveget — csak előkészíti a kérést.
5. **Szabad szöveges prompt**, 600 karakteres korláttal és látható számlálóval
   (a korlát a `console/server.ts` `curatorPrompt` mezőjéé — a kettő nem térhet el).
6. **Az őr-verdiktek láthatók**, és az indoklásuk elolvasható.
7. **Az újragenerálás visszajelez:** a gomb folyamat-állapotba megy (a generálás ~1 perc),
   utána látható visszajelzés jelzi, hogy új szöveg érkezett.

## Amit a terv NEM köt

- A pontos szín-árnyalatok: minden szín a dizájn-magból (`--citui-*`) jön, a terv csak
  a szerepüket rögzíti (zöld = felhasznált, sárga = nem említett).
- A tétel-csoportok nevei („Babafelszerelés", „Konyhagépek") — ezek a tervben KÉZZEL
  készültek. Lásd lent.

## Ismert megvalósítási teher (a tervben nincs megoldva)

A nyers `marketMissed` lista **duplikátumokat** hordoz: `WIFI`, `Wifi a közösségi
terekben`, `Vezetékes internet a közösségi terekben`, `Internetkapcsolat` ugyanaz az egy
dolog. A tervben ezeket kézzel csoportosítottam négy csempévé. **A megvalósításban ezt
kódnak kell csinálnia** — különben a panel „9 nem említett dolgot" ír ki, amiből négy
ugyanaz a wifi, és a mérleg-szám hazudik.

## Méretek

Mindkét méret KÖTÖTT, két külön tervezői döntés:

- **390px (mobil):** egy oszlop, a sorrend: mérleg → a szöveg → felhasznált → nem
  említett → utasítás + gomb.
- **Asztali (≥720px konténer-szélesség):** két oszlop — balra a szöveg és a felhasznált
  tételek, jobbra a nem említettek és az újragenerálás, hogy a koppintás és a beíródó
  utasítás EGY képernyőn legyen.

A váltás `@container` query-vel történik (a panel a konzol tartalom-sávjában él, nem az
ablakhoz kötve) — `@media` itt hibás lenne.

## Ellenőrzés

A terv Playwrighttal végig van kattintva (23/23, 0 JS-hiba, minden gomb ≥30px mobilon).
A megvalósult felületre ugyanez jár: `npx tsx scripts/ui-shot.mts /lead/<id>` mindkét
méretben, és az interakciók tényleges végigkattintása.
