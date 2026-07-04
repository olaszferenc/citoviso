# Alapmodell-megértés — a vállalkozás koncepciója (jóváhagyott)

Dátum: 2026-07-04
Típus: üzleti alapmodell (a tervezés kiindulópontja)

> Ez a session a *megértés* fázisa volt: a tulaj (Olasz Ferenc) elmondta az alapmodellt,
> közösen tisztáztuk üzleti-folyamati kérdésekkel. Az alábbi vázat a tulaj szó szerint
> jóváhagyta ("ez így egész pontos"). Ez a következő fázis (tervezés) kiindulópontja.

## A modell egy mondatban
Iparág-agnosztikus, AI-üzemeltetett, **volumen-alapú disztribúciós gép**, amely
standard-folyamatú iparágak digitálisan gyenge szereplőit teszi **láthatóvá** — a horog
egy előre elkészített, személyre szabott, **kézzelfogható mock** (kattintható jövőkép).

## Kulcs-paradigma: a motor IPARÁG-AGNOSZTIKUS
- Az iparág nem beégetett kód, hanem **paraméter**. Két dolog példányosítja:
  1. a **generáló folyamatok** (hogyan áll össze az adott iparág honlapja),
  2. a **definiált ügyvitel** (az iparág standard üzleti/ügyfél-folyamata).
- Nem "szállás-motort" + "étterem-motort" építünk, hanem **egy iparág-független magot +
  egy egységes „iparág-leíró" keretet**, amivel BÁRMELY standard iparág ügyfélútja és
  ügyvitele leírható. Új iparág = új definíció a keretben, nem új motor.
- Iparág-kiválasztás kritériumával MOST nem foglalkozunk — ha a motor jól van felépítve,
  iparágtól függetlenül működik. Jelenleg 2 beazonosított: **vendéglátás + szállás**
  (globálisan standard digitális jelenlét-folyamat). A modell más standard iparágra ráhúzható.

## Az ügyfél-életciklus (a tölcsér)
1. **Iparág-definíció** — ügyfélút + ügyvitel + modulkészlet (a motor paramétere).
2. **Lead-felkutatás** — scraper (Google Maps, portálok): *elavult* VAGY *hiányzó* honlap.
3. **Mock-gyártás** — ELŐRE, teljesen kész, személyre szabott (scraped adat, hotlinkelt kép).
   → opcionális **emberi kuráció** a "nulladik pont" védelmére (később automatizálható).
4. **Megkeresés** — MULTI-CSATORNA (e-mail/SMS/egyéb elérhetőség), a mock linkje + alapszöveg.
5. **„Puff-varázslat"** — a lead kattint → kész jövőképet lát → NULLA vacakolás, nulla magyarázkodás.
6. **Élesítés = ELSŐ FIZETŐS KAPU** — ingyen: megnézi/cserélgeti a képeket, online teszteli.
   Élesedni CSAK fizetés után élesedik. Feltétel: szerzői jogi nyilatkozat elfogadása.
7. **Skálázás / upsell** — modulok bármikor hozzáadhatók (fizetéskor ÉS később is).
8. **Megszűnés** — előfizetés vége → honlap / adott funkciók inaktiválása.

## Elhelyezés (domain) — 2 irány
- (1) **Saját domain**, amit MI regisztrálunk **az ügyfél nevében, meghatalmazással**
  (ha a mi tulajdonunkban maradna cég-/névhasonlóság esetén → névbitorlás — jogász állásfoglalás).
- (2) **Meta-domain aldomain** — pl. `balatoniszallas.citoviso.com`, az ő nevével, éves díjért
  (alacsony súrlódású, olcsó belépő).

## Jogi álláspont (jogásszal egyeztetve, jelenlegi állás)
- A képeket **NEM letöltjük, hanem URL alapján ágyazzuk** (hotlink) — más jogi kategória.
- A szerzői jog tiszteletben tartása a **honlap igénybevevőjét (a tulajt)** terheli
  (nagy eséllyel amúgy is az ő saját képei vannak fent).
- Élesítés feltétele: a tulaj **jóváhagyja/ellenőrzi a képeket + nyilatkozik**, hogy a
  szerzői jog felett rendelkezik.
- **Google Maps = kivétel** (ott más a helyzet, külön kezelendő).
- ⚠️ Üzemeltetési kockázat (nem jogi, későbbre): hotlinkelt kép idegen szerverről jön →
  ha a forrás leszedi/tiltja, a kép ELTŰNHET → a "puff-varázslat" megbízhatóságát érinti.

## Kereszt-metsző VASSZABÁLYOK (invariánsok)
- Csak a **100%-ban automatizálhatót** ígérjük. **TÖMEG > EGYEDI.** Nincs egyedi fejlesztés,
  csak standardizált, AI-adta megoldások.
- Elsődleges ígéret: **LÁTHATÓSÁG** ("nem látszol jól → láthatóvá teszünk": honlap + Google +
  Facebook). A booking-jutalék kiváltása NEM az elsődleges horog — az feljebb az upsell-létrán van.
- A differenciátor a **BIZONYÍTÉK** (kész, személyre szabott mock), nem az ígéret.
  "Ígérni bárki tud" — mi kézzelfogható jövőképet adunk.
- Háttér: **majdhogynem kizárólag AI-agentek.**
- Ember a hurokban: **pénzügyi kontroll = KÖTELEZŐ emberi kéz**; **mock-kuráció = egyelőre ember**.
  A teljes humán-térkép (hol kell ember) a folyamat-modell lefektetése UTÁN rajzolódik ki.

## Szándékosan ELHALASZTOTT kérdések (a folyamat-modellek után)
- Pénzügyi/értékesítési konstrukció: előfizetés vs. egyösszeg, árazás, upsell-időzítés — KÉPLÉKENY.
- Visszatérő érték / churn-mechanika.
- Kiküldés-előtti belső jóváhagyási folyamat részletei.

## ⚠️ A RÉGI KÓD/MODELL ELDOBVA
- A `src/` (config, scrape, generate/types Property-központú modell) + a DOMAIN
  `02-ENTITY-MAP.md` Property-alapú, SZŰK szállás-modellje **béklyó, eldobjuk**.
  Csak extrém rövid teszt-visszaigazolásra volt jó (badacsonyi validáció).
- A tényleges `git rm` az ÚJ struktúra scaffoldjakor jön (nem tervezünk üres lyukba).

## Következő lépés
- Az **iparág-agnosztikus váz + az első iparági PÉLDÁNY teljes folyamat-modellje**
  (valószínűleg szállás): a vendég teljes ügyfélútja + a tulaj ügyvitele + a modulkészlet
  a minimum-jelenléttől a szofisztikáltig. Ebből esnek ki a mérföldkövek és a modulok.
