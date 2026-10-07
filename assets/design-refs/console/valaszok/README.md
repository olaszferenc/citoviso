# Irányítópult — Válaszok a megkeresésekre (JÓVÁHAGYOTT: B, 2026-10-07)

Tulaj-kérés (2026-10-07): „nyitó oldalán jelenjen meg: melyik lead küldte mikor mit,
megvan-e válaszolva. ugrás a lead oldalára”. Előzmény: aznap 3 valódi válasz (2 SMS,
1 e-mail) érkezett a megkeresésekre, és egyikről sem tudott a rendszer — az SMS-ek a
gammu `inbox` táblájában, az e-mail a Zoho INBOX-ban ültek.

Jóváhagyva: **B — beszélgetés-nézet** (`plan.html`, a változat-váltón az A elvetett
alternatíva, csak összehasonlításnak maradt bent). Képek: `B-asztali.png`,
`B-mobil.png`, `B-mobil-beszelgetes.png`.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Helye:** az irányítópult (`/`) tetején, a címsor alatt, a widget-rács FÖLÖTT.
2. **Fejléc:** cím „Válaszok a megkeresésekre”, jelvény „N megválaszolatlan” (piros;
   0-nál zöld „mind megválaszolva”), szűrő-chipek „Megválaszolatlan N” / „Mind N”
   (alapértelmezés: Megválaszolatlan), és a frissesség sora (mikor nézte utoljára
   a gép az SMS-eket és a postafiókot).
3. **Asztali:** két oszlop. Bal: lista, legújabb elöl; soronként piros pötty (nyitott)
   vagy zöld karika (megválaszolt), lead-név, csatorna-címke (SMS / E-mail), idő, a
   válasz első sora. Jobb: a kiválasztott beszélgetés — fent a MI kiküldött
   üzenetünk buborékban (csatorna + időpont + levélnél tárgy), alatta a beérkezett
   válasz TELJES szövege; fejlécben lead-név, település, feladó (név · szám/cím),
   állapot-pirula.
4. **Mobil:** csak a lista; sorra koppintva a beszélgetés nyílik helyette, „← Vissza”
   gomb hozza vissza a listát. A lista alatt nincs üres sáv.
5. **Gombok:** „Megválaszoltam” → az állapot „Megválaszolva”, mellette ki és mikor
   jelölte + „Visszavonás”. „Lead lapja →” → `/lead/<id>`.
6. **Számlálók együtt mozognak:** az oldalmenü Irányítópult-során a megválaszolatlanok
   száma, a „Figyelmet kér” listában „N megválaszolatlan válasz a megkeresésekre”
   sor (a blokkra ugrik); 0-nál mindkettő eltűnik. A Megkeresések widgetben „Válaszolt” sor.
7. **Üres állapot:** „Nincs megválaszolatlan válasz.” — a korábbiak a „Mind” szűrőn.
8. **Valódi szöveg:** a többrészes SMS összefűzve, a gammu `TextDecoded` üres
   részét a `Text` (UCS-2 hex) mezőből dekódolva (2026-10-07: a 2. rész csak ott volt).
   E-mailnél a válasz idézett része (a mi levelünk) NEM a válasz része.

## Adat-elvárások (a megvalósítás kontraktusa)

- Csak olyan feladó kerül a listára, akinek Citoviso-megkeresés ment (telefon / e-mail
  egyezés a leaddel). A modem MineREAL-lel közös: más feladó NEM jelenhet meg.
- A gammu `inbox` és a postafiók CSAK OLVASVA (EXAMINE / `Processed` mezőt nem írjuk).
- E-mail „Megválaszolva” automatikusan is beállhat, ha az Elküldött mappában a
  válasz után levél ment ugyanarra a címre; SMS-nél csak kézi jelölés.

⚠️ Megvalósításkor a fenti feliratokat **„…”** formára kell emelni (contract-drift-check
② kötő literálok), amint a kód tartalmazza őket — előbb nem, mert a kapu bukna.
