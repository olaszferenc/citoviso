# Foglalások fül + a foglaló levelei — JÓVÁHAGYOTT TERV (kontraktus)

Tulaj-jóváhagyás: 2026-09-06 („mehet fasza így"). A terv KÖT — elvárt viselkedés, nem
stílus-javaslat. Fájlok: `foglalasok-b.html` (fül), `foglalas-levelek-c.html` (levelek),
mellettük a jóváhagyáskori képek.

## Amit a fül-terv KÖT (foglalasok-b.html)

1. **Önálló „Foglalások" fül** a tenant-admin navigációban, **badge** = a tulaj által még
   nem látott kérések száma; a fül megnyitása láttnak jelöl (`seen_at`).
2. **Összecsukható naptár** felül: csukva egysoros összegzés („N éj vendég-foglalás · N nap
   kézi blokk · N nap <portál>-blokk"), kibontva a hónap. Szabad napra koppintás = kézi
   blokk/felold; **vendég-foglalás napjára koppintás = nap-panel** (vendég, dátumok, üzenet)
   **„Foglalás lemondása" gombbal**; portál-blokk koppintásra elmagyarázza, hogy a portálon
   kell törölni.
3. **Kattintható összegző-csempék**: Döntésre vár (kérés-lista határidővel, sorra koppintva
   a kártyához ugrik) · Következő érkezés (közelgő vendégek, koppintásra a naptár a
   foglalásra nyílik) · Idén visszaigazolt (élők tételesen + korábbiak összesítve). Élő számok.
4. **Kérések IDŐRENDBEN**: érkezés-dátum szerint, azonos időszakon belül a korábban beadott elöl.
5. **Verdikt KOMMENTTEL** (elfogadásnál és elutasításnál is, nem kötelező) — a komment a
   vendég e-mailjébe kerül kiemelt idézetként.
6. **Fedés-választó popup**: fedő kérés visszaigazolásakor naptár mutatja színnel, melyik
   kérés melyik éjszakát kéri (osztott szín = többen); a versengő kérések időrendben,
   sorszámmal, átválaszthatóan. Piros figyelmeztetés sorolja, ki esik ki; **megerősítés után**
   a választott elfogadva, a többi fedő kérés **automatikusan elutasítva** (vendég-e-mail:
   az időszak betelt), a történet-jegyzet: „Az időszakra a szállásadó másik kérést igazolt
   vissza — automatikus elutasítás."
7. **Lemondás** visszaigazolt foglalásról: naptár nap-paneljéből ÉS a történet-listából,
   megerősítés + opcionális indoklás → napok felszabadulnak, vendég e-mailt kap.
8. 48 órás válasz-határidő kiírva a kérés-kártyán; a fül tetején magyarázó note.
   A beállítások (értesítési címek, portál-naptárkapcsolat) a Modulok → Foglalás alatt maradnak.

## Amit a levél-terv KÖT (foglalas-levelek-c.html)

- **Feladó**: név = a szállás neve („<Szállás> — Citoviso"), cím = hitelesített
  foglalas@citoviso.com; **Reply-To = a szállásadó értesítési címe** (a „Válasz" gomb hozzá visz).
- **5 esemény, mindről levél a foglalónak** (a site nyelvén): ① kérés rögzítve („még nem
  végleges", 48h ígéret) · ② visszaigazolva (**.ics naptár-melléklet** + szállásadó-üzenet
  idézve + **lemondó-link**) · ③ elutasítva (indoklás idézve) · ④ lejárt (48h, nem jött válasz)
  · ⑤ lemondva (indoklás + .ics lemondó-frissítés, METHOD:CANCEL).
- **Vendég-lemondó képernyő** a levél linkjéről: megerősítő oldal (nem mond le kattintásra),
  opcionális üzenet a szállásadónak; egyszer használható token, lejárt/felhasznált linkre
  hangos hibaüzenet.
- Tulaj-döntések (AskUserQuestion, 2026-09-06): feladó-modell fent · vendég-lemondó link IGEN ·
  lejárat 48 óra (modul-beállításban módosítható).

## Kapcsolódó, jóváhagyott javítás-köteg (nem felület)

- `scripts/booking-maintenance.mts` beütemezése (óránként): portál-iCal-szinkron + lejáratás.
- Lejáratás vendég-értesítővel (a docstring-ígéret teljesítése).
- Több értesítési cím (vesszővel elválasztva) a booking `notifyEmail`-ben.
