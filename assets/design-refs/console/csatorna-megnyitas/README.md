# Irányítópult — „Megnyitás csatornánként” kártya („B” — csatorna-csempék)

Tulajdonosi jóváhagyás: 2026-11-13 („B mehet”). A vázlat `plan.html` (A/B/C változat + méret-váltó
egy fájlban; a **B köt**, az A és a C elvetve), képek: `shot-B-d.png`, `shot-B-m.png`. A számok a
vázlatban az élesből 2026-11-13 07:20-kor mért valós adatok. **Ez a terv KÖT** — elvárt viselkedés,
nem stílus-javaslat.

**Hatókör:** `src/console/openChannels.ts` · `src/console/openChannelsViews.ts` · `src/console/views.ts` · `src/console/server.ts` · `src/console/reportViews.ts` · `public/assets/ui/citui-console.css`

## Miért létezik

A tulaj kérése (2026-11-13, brief `report-20261113-071126.md`): „Az irányító pultba helyezzünk el
egy olyan kimutatáskártyát, ami megmutatja, hogy a különböző csatornáknak mi a megnyitási
hatékonysága: email · Viber · WhatsApp · SMS/MMS — Ma, 7 nap és összes.”

## Amit a terv KÖT

1. **Helye:** az Irányítópulton a Messenger-út blokk ALATT, az időszak-gomb és a widget-rács
   FÖLÖTT, teljes szélességben. Cím: „Megnyitás csatornánként”, jobbra „Riport ▸ Honnan nyitották” link.
2. **Négy csempe**, sorrendben: E-mail · SMS / MMS · Viber · WhatsApp. Asztalon egy sorban négy,
   telefonon 2 × 2.
3. **Egy csempe:** a csatorna neve színjellel; NAGY szám = a 7 napos arány („7 nap” felirattal);
   alatta „N megnyitotta a M kapottból” (ha nem ment ki: „nem ment ki”); sáv, ami 50%-nál telik meg;
   alul három kis doboz: Ma · 7 nap · Összes aránya, a 7 nap kiemelve. Nincs kiküldés → „—”.
4. **Időszak:** a kártya MINDIG a saját hármasát mutatja; a pult fölötti időszak-gomb
   (Lead-állomány) NEM hat rá. A három időszak a Riport szabálya (`reportPeriod`): „Ma” = ma éjfél
   óta (Budapest), „7 nap” = az utolsó 7 × 24 óra, „Összes” = minden.
5. **Fogalmak:** *Kapta* = az időszakban ezen a csatornán ment ki neki a link (a csatorna első
   küldése, a második érintés előtt — `touchesOf`). *Megnyitotta* = ebből a csatornából kattintott a
   linkre, bármikor azóta (bot nélkül, `attributeOpen`). A levél puszta megnyitását nem mérjük.
   Egy lead több csatornán is kaphatta. Az SMS / MMS egy csatorna (a link az SMS-ben vagy az MMS
   kísérő SMS-ében megy).
6. **Lábléc:** egy mondat a fogalmakról + „Nem eldönthető: N megnyitó lead (7 nap)” — a 7 napban
   kiküldött leadek közül, akiknek van csatornához nem rendelhető megnyitása.
7. **Kattintás:** egy csempére kattintva a Riport Tölcsér lap „Honnan nyitották” panelje nyílik
   (`/report?days=7#os-<csatorna>`), a csatorna sora lenyitva (a megnyitók névsora). A Riport
   kohorsza a kiküldés napja, ezért a „Kapta” ott eltérhet a kártyáétól — a kártya az időszakban
   ezen a csatornán kiküldötteket számolja.
8. **Színek:** a Riport „Honnan nyitották” jelmagyarázatáé (`rp-os-*`), hogy a kettő egyezzen.

## Kötő horgony

- `open-channels`
- `oc-tile`
- `#os-`

KÖTŐ feliratok: **„Megnyitás csatornánként”** · **„SMS / MMS”** · **„nem ment ki”** · **„Riport ▸ Honnan nyitották”**
