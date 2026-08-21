# 2026-08-20/21 — Kontakt-NAPLÓ, portál-jelenlét, duplikátum-ellenőrzés (a Brave-szál folytatása)

Előzmény: `2026-08-20_brave_live_and_backfill.md` (Brave élesítés + backfill). Ez a szál a tulaj
ÉLES TESZTJEIBŐL nőtt ki — minden pont alatt egy konkrét lead, amin a rendszer megbukott.

## A tulaj tesztjei és amit kibuktattak

### 1. „Ferenc Ház" — a Brave megtalálta, mi nem kérdeztük meg
A tulaj kézzel + LLM-mel másodpercek alatt megtalálta a címet; a pipeline nem. **Mérés:** a Brave
1. találata a `kali.hu/szallas/ferenc` volt, a helyes cím pedig a 4–5. találat SNIPPETJÉBEN.
Két saját hibánk fedte el:
- a leadnek „már volt" e-mailje (`info@keszthelyinfo.hu`, egy PORTÁL címe, régi scrape-ből) →
  az `enrichWebSearch` csak e-mail NÉLKÜLI leadre futott → **rá sem néztünk**;
- csak a ~160 karakteres snippetet olvastuk, az oldalt nem.

**Javítás:** (a) a tárolt cím is átmegy a korroboráción, a gyenge cím nem blokkol, a korroborált
találat felülírja; (b) **PASS 2 — oldal-beolvasás**: ha a snippet nem zárja le, letöltjük a top 3
találatot és kiolvassuk a kontakt-blokkot (`mailto:`/`tel:` elsőbbséggel). A portál-adatlap
LEGITIM kontakt-forrás (nem saját honlap, de a vállalkozás MAGA tette ki oda az adatait).

### 2. „Bánó Porta" — döglött honlap = elérhetetlen lead
Van saját honlapja, de 404 → nem adott e-mailt, ÉS a kontakt-keresés el sem indult, mert a szűrő a
`none/portal_only` szegmensre szólt. Közben egy portál-adatlapon ott az élő cím.
**Javítás: a KIVÁLTÓ a hiányzó cím, nem a honlap-státusz.** Egy döglött honlap birtoklása nem ok
arra, hogy elérhetetlen maradjon a lead.

### 3. „Bánó Gábor" — üres napló, mert takarékoskodtunk
Újragyűjtés után csak a `places` forrás látszott. Ok: volt elfogadható címe (gmail → korroborált),
így a keresés kimaradt. **Javítás:** a KÉZI újragyűjtés (`reenrichOne`, a konzol gombja)
`force=true`-val hív — az operátor a BIZONYÍTÉKOT akarja látni; a takarékosság a tömeges scrape-é.

## ⭐ A KONTAKT-NAPLÓ (tulaj-kérés, a szál legfontosabb eredménye)
> „Ha elmentünk mindent, akkor lehet dönteni, hogy későbbiekben hogyan rangsoroljuk… ezt empirikus
> úton fogjuk megtapasztalni."

Eddig a pipeline EGY címet választott és a többit némán eldobta. Két kára volt: (1) az operátor nem
tudta megkülönböztetni a „nem találtunk semmit"-et a „találtunk hármat és a jót dobtuk el"-től —
és aznap pontosan ez történt többször; (2) a „melyik forrás válaszol jobban?" csak MÉRÉSSEL
dönthető el, ahhoz pedig az elvetett sorok is kellenek.

`ContactCandidate` + `src/scraper/contactLedger.ts`: érték + forrás (`places`/`osm`/`own_site`/
`web_snippet`/a beolvasott oldal hosztja) + nyitható forrás-URL + elfogadva/elvetve + **az elvetés
INDOKA magyarul** + `firstSeen`. Összefésül: a `firstSeen` sosem íródik felül; egy későbbi elfogadás
felülírja a korábbi elvetést, de egy szigorúbb szűrő **nem törli némán** a már használt kontaktot.
A konzolon táblázat: típus · érték (kattintható) · forrás · **használt/rendben/elvetve** · indok.

**A rangsorolás szabályai KÉSŐBB jönnek, a valós kiküldés-eredményekből** — nem mai találgatásból.

## DIGITÁLIS LÁBNYOM (portál-jelenlét a kártyán)
A portál-találatot eddig csak elutasítottuk („nem saját honlap") és eldobtuk. Pedig háromszorosan
értékes: a kurátor egy kattintással ellenőrzi, hogy a JÓ üzletet találtuk; ezek a leggazdagabb
ingyenes adatforrások; és maga az outreach-érv („mások oldalain szerepelsz, nem a sajátodon").
Gyűjtés INGYEN a meglévő találatokból; a social IS számít (a platformot nem ő birtokolja); amit
ténylegesen beolvastunk és átment a brand+város verify()-on, az „ellenőrizve" jelet kap.

## DUPLIKÁTUM-ELLENŐRZÉS (0022 `lead_link`)
Kiváltó: „Bánó Gábor" és „Bánó Porta Köveskál" ugyanaz az üzlet. Az élő állomány átvizsgálása
viszont megmutatta, hogy **UGYANAZ a jel NÉGY különböző valóságot takar**: egy üzlet két néven ·
egy szálloda több épülete (Abbázia ×6) · egy tulaj több üzlete (Eldorádó) · lánc közös honlappal
(Ensana/Danubius). Automatikus összevonás két külön hotelt olvasztana egybe; a jel ignorálása
duplán keresi meg a tulajt. → **a gép JAVASOL, az ember DÖNT**, a döntést megjegyezzük.
Csoportonként EGY döntés (az Abbázia 6 rekordja 15 párt szülne), a tárolás páronkénti.
Három verdikt: `duplicate` (a megtartott ELNYELI a másik naplóját+listingjeit, a vesztes
disqualified = VISSZAVONHATÓ) · `same_owner` (mind marad, egy megkeresés) · `unrelated`.

⚠️ **Tranzitivitás-csapda:** egy GYENGE él mindent megfertőz — élesben egy közös ügynökségi honlap
hat, egymástól **34 km-re** lévő faluban működő apartmant láncolt egy „csoportba". Ezért csak ERŐS
él fűz össze (2+ jel VAGY egy helyrajzi pont VAGY <300 m), és a szétszórt csoport piros
figyelmeztetést kap. Élesen: 20 csoport a keszthelyi állományon.

## Adat-takarítás (élesen lefuttatva)
- `scripts/scrub-contacts.mts` — 9 sablon-/intézményi cím törölve (`your@email.com`,
  `info@domainem.hu`, `heviz@tourinform.hu`, `postmaster@…`). Ok: az `enrichContact` 2026-08-20-ig
  SZŰRETLENÜL vette az `assessment.emails[0]`-t.
- `scripts/requalify-websites.mts` — **9 lead visszakerült a célzásba** (élesen; lokálban 10):
  akiknek egyetlen „honlapja" egy `apartman.hu`/`hungaryhotel.net` adatlap volt, `modern`-ként
  ültek a DB-ben = „nem célpont". Ez a §F hitelesség-bug FALS NEGATÍV iránya: **némán ejtünk egy
  valódi vevőt.** Offline, API-költség nélkül.

## Konzol-UI javítások (tulaj-leletek)
- **Galéria** a fotókra ÉS a sablon-mintákra: nyilakkal lépkedés, számláló, ESC, GÖRGETHETŐ színpad
  (a sablon-minta egy egész oldal; az `object-fit:contain` olvashatatlan csíkká zsugorítaná).
  Új lapon megnyitva elveszett a halmaz.
- ⭐ **CSS-SPECIFICITÁS csapda:** az „össze van csúszva" újragyűjtés-sor oka nem a CSS hiánya volt —
  a konzol minden formot inline-ol (`.con form`), és az a szelektor ERŐSEBB egy önálló osztálynál,
  így a `.con-reenrich{display:flex}` NÉMÁN vesztett. Csak méréssel derült ki (fejetlen Chromium:
  végigfuttatva, melyik szabályok illeszkednek). Javítás: `.con .con-reenrich`.
- Honlap-megnyitó ikon MINDIG ott van, és a mezőbe ÉPPEN BEÍRT címet nyitja (mentés előtti ellenőrzés).
- **Források őszintesége:** az `enrichPlaces` költség-okból kihagyja azt, akinek már van telefonja ÉS
  fotója → a „Források" a felfedezés-kori értéken ragadt. A fotó-útvonal úgyis lekéri a Places-t,
  így most ingyen bejelöli (csak nem-low konfidenciánál, A4).

## ⭐ A SZÁL ÁTFOGÓ TANULSÁGA
Minden hibát **a tulaj éles tesztje vagy utólagos emberi mintavétel** fogott meg — a beépített őrök
(verify, portál-katalógus, sekély-útvonal, korroboráció, takarékossági szűrők) **ZÖLDET adtak a
rossz kimenetre**. A visszatérő minta: **a szűrőim némán zárták le a keresést**, és ez kívülről
„a rendszer nem talál semmit"-nek látszott. A kontakt-napló pontosan ezt teszi láthatóvá és
felülbírálhatóvá — a védelem nem a szigorúbb szabály, hanem a LÁTHATÓSÁG.

## Nyitott / következő
- **ADR-0037 platform-registry** — a portál-lista DB-be, kurátori bővítéssel (a lista ma is nőtt:
  `kali.hu`, `hungaryhotel.net`, `com-hotel.website`, `apartman.hu`, …).
- A `reenrich.ts` generikus-név őre a scrape-útra (`enrichSiteSearch`) is átvihető.
- A duplikátum-döntések MÉRÉSE: a `lead_link.signal` mező azért van, hogy a detektor pontossága
  utólag a valós verdiktekhez mérhető legyen.
- A `same_owner` csoportokra EGY outreach — a küldő-pipeline-nak ezt még tiszteletben kell vennie.
