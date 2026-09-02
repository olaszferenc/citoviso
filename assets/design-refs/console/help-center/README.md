# Konzol Súgó — jóváhagyott terv: B) Súgóközpont (2026-09-02)

**Tulaj-döntés:** a 3 változat (A tükör / B súgóközpont / C akkordeon) közül a **B**.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Kétpaneles desktop (~≥720px):** a témalista MINDIG látszik a cikk mellett (bal ~300px,
   sticky), a cikk jobbra nyílik; témaváltásnál nincs oldal-újranavigálás érzete.
   **Mobil:** egyoszlopos — lista felül, a megnyitott cikk alatta.
2. **KÉTSZINTŰ TUDÁSBÁZIS (tulaj-rendelet, 2026-09-01):** a konzol-Súgó MINDKÉT csoportot
   listázza, csoport-fejléccel: „Konzol-útmutatók (N)" + „Tenant-súgó — amit az ügyfél a
   saját adminján lát (M)", utóbbin „ügyfél is látja" címke. A belső felhasználó MINDENT lát.
   A tenant-admin Súgó fül VÁLTOZATLANUL csak tenant-entryket ad; a tenant-oldali KB-kép-út
   audience-kerítést kap (operátor-entry képe tenantnak SOHA nem szolgálható ki).
3. **Kereső:** mindkét csoportban keres (cím+kivonat); a csoport-fejlécek szűréskor is
   megmaradnak (üres csoport fejléce eltűnik). Éles megvalósítás: no-JS GET-keresés
   (?q=), a telefonos flow doktrínája szerint.
4. **Aktív téma jelölve** a listában (kiemelt háttér/keret).
5. Dizájn-mag tokenekből (--citui-*); a cikk-tipográfia a meglévő .con-kb-article réteg.

Referencia: `help-center.html` (kattintható, méret-váltós) + a jóváhagyáskor küldött
ui-help-b-center-{mobile,desktop}.png.
