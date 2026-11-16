## ADR-XXXX — Portál-feltöltés a tenant helyett: digitális kollégával, a fiókot mi hozzuk létre; első kör csak felderítés

**Dátum:** 2026-11-16 · **Státusz:** IRÁNY ELFOGADVA (tulaj, 2026-11-16, `cit5926a648`) ·
**Alap:** `_planning/RESEARCH-2026-11-13-portal-feltoltes.md` · **Kapcsolódik:** ADR-0361 (portál-iCal), ADR-0416 (jutalék-kiváltás)

### Kiváltó

Tenantok kérdezték: fel tudjuk-e tenni a szállásukat a portálokra, hogy nekik ne kelljen regisztrálniuk. A felmérés
(2026-11-13) szerint API-út nincs: a Booking Connectivity API új szolgáltatót nem vesz fel, az Airbnb API meghívásos,
a Szállás.hu csak channel manageren át köthető be.

### Döntés (tulaj, 2026-11-16)

1. **Az ÁSZF-kockázatot vállaljuk.** A Booking és az Airbnb tiltja az automatizált használatot; a digitális kolléga
   böngészőben, emberi tempóban dolgozik a szállásadó fiókján. (A felmérés javaslata: a kolléga csak regisztrál és
   feltölt, a napi naptárszinkront az iCal végzi.)
2. **Ha a szállásadónak nincs fiókja, mi hozzuk létre neki, az ő adataival.** A szerződő fél továbbra is ő (NTAK-szám,
   bankszámla, személyazonosság); mi a nevében, az adataival regisztrálunk.
3. **Árazás: most nem téma** („kurva messze vagyunk az árazástól”).
4. **Első kör: felderítés.** Megmérjük, a megkeresett (elsőként a linket megnyitó) szállások hol szerepelnek már; a
   feltöltő kolléga és a tenant-admin űrlap később jön, külön tulaj-döntésre.

### Visszafordíthatóság

🔄 Kód nem született; az irány olcsón visszavonható.
