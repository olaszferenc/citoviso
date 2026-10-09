## ADR-XXXX — „Mi tartja vissza?”: kulcsonként egy sor, a későbbi válasz felülírja az elsőt

**Dátum:** 2026-10-10 · **Kontextus:** IT A-07 + Elek lelete — a próba-levél „mi tartja vissza?” válaszai közül csak az első maradt meg; párhuzamos POST-nál két sor született.

**Döntés**
1. A kulcs változatlan: prospect + forrás + nézet (nézet nélkül — leiratkozás, emlékeztető-link, próba-levél — prospect + forrás). Kulcsonként EGY sor.
2. Ugyanarra a kulcsra jövő későbbi válasz **FELÜLÍRJA** a tároltat (`reason`, `text`, `updated_at`); a `created_at` az első válasz ideje marad. Indok: a meggondolt vagy javított válasz a pontosabb, és a lap eddig ezt is megköszönte, miközben eldobta (§B.17).
3. Az egyediség az ADATBÁZISBAN él (`0102`: `UNIQUE NULLS NOT DISTINCT (prospect_id, source, mock_view_id)`, `ON CONFLICT … DO UPDATE`), nem check-then-insert — így a párhuzamos POST sem hagy két sort, és a riport nem számol duplán. A migráció a meglévő duplikátumokból kulcsonként a LEGUTÓBBIT tartja meg.
4. A riport (`reportData.ts` `loadFeedback`) változatlanul prospectenként a legkorábbi `created_at`-ű forrás válaszát számolja — forráson belül ez most már a legutóbbi válasz.

**Nem része:** a `skip=1` („Inkább nem”) továbbra sem rögzül (IT A-07 APRÓ mellékszál).

**Őr:** `scripts/trial-campaign-check.mts` ③ — második, más válasz → egy sor az új válasszal; 12 párhuzamos POST → egy sor (a régi kóddal futtatva az első állítás piros).
