# 03 — INVARIÁNSOK (Citoviso ontológia)

> Szabályok, amiknek MINDIG igaznak kell lenniük. Megsértésük bug vagy jogi/üzleti kockázat. Kód-review + generálás előtt ellenőrizd.

## §A — Kép & tartalom jogállás (provenance)
1. Élesre CSAK `owner` provenance-ú (vagy explicit engedélyű) kép mehet. `guest`/`portal` kép KIZÁRÓLAG demó-mockupban.
2. A portál-fotók (pl. zimmerinfo) gyakran vízjelesek → demóra jók, élesre a tulaj tiszta eredetije.
3. Minden `PropertyImage`-nek KÖTELEZŐ `source` mezője (owner|guest|portal|generated).

## §B — Dizájn
4. **NINCS emoji-ikon.** Csak saját SVG-sprite ikon (`currentColor`, stroke).
5. Minden generált oldalon KÖTELEZŐ a `Property.unique` szekció valós, megkülönböztető adattal — generikus töltelék TILOS.
6. A paletta a szállás SAJÁT fotóiból jön (analyze), nem fix sablon-szín.
7. `review` csak VALÓS, szó szerinti vendégvéleménnyel tölthető ki (kitalált nem).

## §C — Outreach (jog)
8. Hideg megkeresés = célzott, személyre szabott, **leiratkozható** (nem tömeg-spam). GDPR/Grt.-tudatos.
9. Külön küldő-domain + SPF/DKIM/DMARC (deliverability), a fő domain égetése tilos.

## §D — Deploy (a CLAUDE.md §0 tükre)
10. Lokál-először; élesre CSAK módosított fájlok, push-onként ÚJ scope-olt engedéllyel. Éles cél amúgy még TBD.

## §E — Üzleti pozicionálás
11. A kommunikáció horga a **booking-jutalék megtakarítása**, nem a honlap ára.
12. A skálázhatóság feltétele az **önkiszolgáló admin** (support ~0). Ha egy feature növeli a per-tenant supportot, az invariáns-sértés.

## §F — Saját-honlap detektálás (presence)
13. **A „nincs saját honlap" állítás bizonyítást igényel, nem a hiány feltételezését.** A Google Maps `websiteUri` hiánya NEM bizonyíték — csak azt jelenti, hogy a Maps-profilhoz nincs kötve honlap. A leadet aktívan verifikálni kell (domain-guess + HTTP-proba, kiegészítő web-search a farokra).
14. **Talált honlap CSAK geo/kontextus-egyezéssel érvényes.** Egy domain akkor számít az adott lead saját honlapjának, ha a lekért oldal a márka-magot ÉS a régiót (vagy egyéb egyértelmű azonosítót: cím/telefon) is korroborálja. **Brand-only egyezés = COLLISION, elvetendő** — a cégnév ütközhet másik településen működő, teljesen más vállalkozással (bizonyított: Rózsakő ház/Badacsony ↔ Rózsakő Étterem/Kisvárda). Ez az A4 konfidencia-kapu tükre a presence-rétegben.
15. **Parkolt / eladó / builder-placeholder oldal nem saját honlap** („ez a honlap eladó", domain-parking) → `none` marad.
16. **Geo-verifikáció nélküli presence-check TILOS élesíteni:** hamis pozitívja jó leadet dob el („van már honlapja"). A naiv guess ezen a mintán 4/4 hamis pozitívot adott.

> Új invariáns felbukkanásakor ide vedd fel, és linkeld a memóriában.
