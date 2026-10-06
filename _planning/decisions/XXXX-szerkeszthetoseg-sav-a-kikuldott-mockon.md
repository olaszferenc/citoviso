## ADR-XXXX — Szerkeszthetőség-sáv a kiküldött mockon (görgetés után, bezárható)

**Dátum:** 2026-10-06 · **Döntött:** tulaj (terv-kör, `assets/design-refs/prospect-page/edit-strip/`)

**Kontextus.** A lead a mockon nem a saját szobabeosztását, férőhelyeit látja, és nem egyértelmű
neki, hogy megrendelés után mindent átírhat. Mérve (dev, 170 mock): 164-ben minta-szobák vannak
(a sablon apró „Minta —” sorával), csak 6-ban begyűjtött szoba.

**Döntés.** A `/p/<token>` lapra kiszolgáláskor (konfigurátor-futtató) egy felső, egyszer becsúszó,
bezárható sáv kerül: „Ez egy terv mintaadatokkal. Megrendelés után mindent Ön szerkeszt: képeket,
szobákat, szövegeket, árakat.” Indul: a szobák szakaszánál vagy egy képernyőnyi görgetés után,
amelyik előbb; × után leadenként nem jön vissza. Villogó/folyamatos fejléc ELVETVE (spam-jel,
akadálymentesség, a hős-képet takarná). Szoba-melletti jegyzet és levél-mondat ELVETVE (tulaj:
„nem kell litániát írni arról, amit úgyis tud”).

**Következmény.** A mockfájlhoz nem nyúlunk → nincs újragenerálás/újrarajzolás; a már kiküldött
mockok is megkapják. A kollégák (Neo/Poe/Vera) munkáját nem kell leállítani.
