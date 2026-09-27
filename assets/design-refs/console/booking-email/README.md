# Foglalási levelek — jóváhagyott terv (vendég C · tulaj B)

**Jóváhagyva:** 2026-09-27, tulajdonosi döntés (§2b terv-kapu). A kiváltó ok a tulaj szavával:
„ez is legyen már professzionális vállalati kinézetű! meg legyen benne a szállás elérhetőségei a
honlappal együtt” (vendég „rögzítettük” levele), illetve „itt is legyen professzionális kinézetű,
meg lehessen megnyitni az admin felületet a foglalások résszel” (tulaj „Foglalási kérés” levele).
**Vázlat:** `booking-emails.html` (a felső sávon: Vendég A/B/C, Tulaj A/B; a **Vendég C** és a
**Tulaj B** a jóváhagyott, a többi elvetve). A tulaj kiegészítése a jóváhagyáskor: a vendég üzenete
elé felirat kell („nem egyértelmű a foglaló üzenete rész... írjuk ki”) — a vázlatban már benne van.
**Megvalósítás:** `src/email/bookingLayout.ts` (keret + blokkok), `src/booking/requests.ts`
(`sendGuestAck`, `notifyOwner`).

## Mit KÖT ez a terv (nem stílus-javaslat)

### Vendég-levél („Foglalási kérését rögzítettük” / „Árajánlat-kérését rögzítettük”)
1. **A fejlécben a SZÁLLÁS neve áll**, nem a Citoviso — a vendég a szállással foglalt (a feladó neve
   is „<szállás> — Citoviso”). Alatta kis felirat: „Foglalási kérés visszaigazolása”. Cián alsó vonal.
2. **Lépés-jelző** (Kérés elküldve ✓ → A szállásadó dönt → Végleges foglalás): egy pillantásra
   megmondja, hogy ez MÉG NEM visszaigazolás. Árajánlat-kérésnél a középső lépés
   „Árajánlatot küld”.
3. **Adat-panel:** hivatkozás (monospace), szállás-egység, érkezés, távozás (éjszakák száma
   halványan), létszám; elválasztó vonal alatt a befagyasztott ár-sorok és a kiemelt „Összesen”.
   Ár nélküli (árajánlat-)kérésnél nincs ár-rész.
4. **„A szállás elérhetősége” kártya:** név, cím, kattintható telefon (`tel:`), e-mail (`mailto:`),
   honlap, és „A szállás honlapja” másodlagos gomb. CSAK a kitöltött mező jelenik meg; a forrás a
   honlapon is látható elérhetőség (ADR-0241: tulaj-javítás > begyűjtés), a honlap a saját domain
   (ha él) vagy a platform-aldomain. Semmit nem találunk ki (§B.17).
5. **Lábléc:** „Ezt a levelet azért kapta, mert foglalási kérést küldött a(z) X honlapján. A
   foglalási rendszert a Citoviso működteti.”

### Tulaj-levél („Foglalási kérés: …” / „Árajánlat-kérés: …”)
6. **A jóváhagyott platform-keret** (`../platform-email/`, Citoviso logó, cégadatos lábléc).
7. **Címke** „Új foglalási kérés · döntésre vár” (árajánlatnál „Új árajánlat-kérés · ajánlatra vár”),
   H1 „Új foglalási kérés — <egység>”.
8. **Egy adat-panel:** vendég, telefon, e-mail (kattinthatók) | hivatkozás, szállás, érkezés,
   távozás, létszám | ár.
9. **A vendég üzenete FELIRATTAL** („A vendég üzenete:”), alatta az idézet — felirat nélkül nem
   derült ki, kinek a szövege.
10. **A fő gomb „Foglalások megnyitása”** → `/admin?tab=foglalasok` (a belépés a `next`-tel
    megőrzi a célt). A gyors döntés másodlagos linkként marad: „Elfogadom · Nem szabad”
    (árajánlatnál „Ajánlatot küldök · Nem szabad” — ⛔ koppintásos elfogadás ott sincs, ADR-0208).
11. **Mobil (≤520 px):** keskenyebb margó, a címke/érték sorok (adat-panel, elérhetőség) egymás alá kerülnek.

## Hatókör (2026-09-27, második kör)

Ugyanez a két keret viszi a TÖBBI foglalási levelet is (a jóváhagyott minta követése, §2b kivétel):

- **Vendég (C-keret: szállás-fejléc, címke, adat-panel, elérhetőség-kártya, „Kérdése van?” sor):**
  visszaigazolás (zöld „Végleges foglalás”, ár, a szállásadó üzenete feliratosan, lemondás-link),
  „nem szabad”, „betelt”, a szállásadó lemondta, lemondás megerősítve, „nem érkezett válasz”,
  árajánlat (lépés-jelző: elküldve ✓ → ajánlat megérkezett ✓ → Ön elfogadja; fő gomb
  „Megnézem és elfogadom”), az ajánlat lejárt.
- **Tulaj (B-keret: Citoviso-keret, címke, vendég + tartózkodás panel, „Foglalások megnyitása”):**
  a vendég lemondta, lejárt kérés, az ajánlat kimenetele (elfogadta / nem kérte / lejárt / ütközés).
- Ajánlatból lett foglalásnál az ár-csoport felirata „Az ajánlott ár:” (booking-offer ⑧) — a
  „rögzítettük” levélnél (mindig árlistás) nincs felirat, az ott jóváhagyott kép változatlan.
- A régi `bookingHtml` (nyers szöveg `<br>`-rel) megszűnt.
