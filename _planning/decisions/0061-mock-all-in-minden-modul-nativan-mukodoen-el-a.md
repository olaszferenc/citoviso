## ADR-0061 — Mock ALL-IN: minden modul NATÍVAN, működően él a mockban — a generikus minta-kártya réteg kivezetve

**Dátum:** 2026-08-23 · **Státusz:** elfogadva (tulajdonosi rendelet) · **Kiegészíti:**
ADR-0059 (integrációs doktrína — ez annak a konfigurátor/minta-rétegre való kiterjesztése),
ADR-0015 (modult csak láthatóan adunk el). **Nem írja felül:** ADR-0048 / §B.17.

### Probléma (tulaj, 2026-08-23, az ADR-0059 ①–⑤ szelet tesztje után)

A szerver-oldali beszövés után a konfigurátor MÉG MINDIG generikus MINTA-kártyákat
injektált azokra a modulokra, amiknek a mockban nincs adata (ártábla „— Ft" sorok,
nyitvatartás-sorok, vélemény-idézet kártya, hírlevél-mező, térkép-csempe). A tulaj
rendelete: „Nem mintakártyát akarunk mutatni, hanem a wow hatást maximalizálni…
teljes, fullos, all-in, minden modult tartalmazó, teljes funkcionalitásában
kattintható verziókkal, adott stílusba illeszkedően."

### Döntés

1. **A mock ALL-IN és NATÍV:** minden modul a szerver-oldali, token-témázott, az adott
   template stílusára öltöztetett VALÓDI szekciójaként renderel a mockban — pontosan
   úgy és ott, ahogy vásárlás után élne. A kliens-oldali generikus minta-kártya
   (cit-configurator SAMPLES) új artifactra NEM injektálódik; régi artifactokra
   fallbackként megmarad.
2. **Minta-adat jelölt, tény nem fabrikált (§B.17 áll):** ahol a leadnek nincs valós
   adata, a modul JELÖLT minta-adattal él („Minta" szalag a szekción): nyitvatartás
   reprezentatív időpontokkal, ártábla szezon-sorokkal és „—" összeggel (kitalált
   ár SOHA), környék-lista tétel-típusokkal távolság-szám nélkül. Ami valósból
   megy: térkép a lead VALÓS címére/koordinátájára (kattintásra tölt), vélemény-
   szekció a VALÓS Google-átlaggal + működő gyűjtő-űrlappal.
3. **Kitalált vendégvélemény-idézet TOVÁBBRA IS TILOS** (ADR-0048; a
   module-render-check kapuja őrzi). A vélemény-modul mockbeli teljessége = valós
   Google-szám + kipróbálható „Írjon véleményt" űrlap.
4. **Minden interakció kipróbálható, semmi nem küld:** a mock űrlapjai
   (booking-demó után most hírlevél, vélemény-űrlap is) demo-módban kattinthatók
   végig — beküldés helyett becsületes minta-visszajelzés.
5. **A jelenlét-pecsét a teljes oldalt méri:** a `data-cit-native` pecsét a natív
   szekciókon túl a beszőtt modul-blokkokat is felsorolja; a konfigurátor ebből
   tudja, hogy MINDEN már az oldalon van — minta-injektálásra nincs ok.

### Kikényszerítés

`native-content-check` bővítve: a mock renderben minden all-in modul jelen van és
minta-jelölt; az élő renderbe a demo-kitöltés SEMMILYEN formában nem szivárog.

### Visszafordíthatóság

🔄 A demo-kitöltés render-idejű és fázis-kapuzott (a persistált inputs érintetlen);
a SAMPLES-fallback él, a kliens-skip egyetlen feltétel visszavételével eltűnik.
