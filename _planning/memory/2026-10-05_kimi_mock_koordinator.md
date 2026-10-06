# 2026-10-05 — Kimi-mock koordinátor: folyamatos Kimi-csővezeték, m001–m003, leállítva

**Szál:** `cit1e4fd2ba` (az előd „CIT ➕ 🟨3 Kimi code CLI vezérlése” utódja, kontextus-plafon miatti átadás). Kód nem változott.

## Elvégzett munka
- A Kimi 2026-10-04 16:26-tól 403-on állt. A 10 percenkénti próbálkozást órásra lassítottam (`~/kimi-sandbox/run-folyamatos.sh`, 403 → `sleep 3600`).
- A referencia-katalógust (díjazott szállás-oldalak, 2023-10→2026-10) a tulaj döntésére Claude-agent gyűjtötte: 20 tétel, 5 díjprogram (Awwwards 16, CSSDA 5, FWA 4, Red Dot 1, German Design Award 1). 4 díjlapot + a Kimi által hozzáadott Vander Hotelt kézzel visszaellenőriztem. A Kimi még 2-t adott hozzá (22).
- Kimi-mockok, mindegyik tesztelve (`tools/formtest.mjs`, `tools/shot.mjs`), tényhűségre átnézve, beágyazott képekkel elküldve:
  - **m001 „Foglalási lap”** — zöld; küldés után „rögzítettük” felirat demóban.
  - **m002 „A fotó térképpé éled”** — mobilon 619 px layout-szélesség: a `.map-box` `aspect-ratio:16/8` + `min-height:300px` 600 px szélességet kényszerít egy `1fr` rácsban. Kitalált: „Köveskál szívében”, „nagy, fás kert veszi körül”, fotó→szobatípus.
  - **m003 „Boltívek és karikázott jelek”** — zöld; ugyanaz a „nagy, fás kert” és fotó→szobatípus (fordított párosítással!).
- 2026-10-05 12:13: a Kimi a **HAVI** keretét érte el → a tulaj döntése: leállítás (`~/kimi-sandbox/folyamatos/STOP`).

## Fájlok (mind a repón kívül)
- `~/kimi-sandbox/run-folyamatos.sh` (403-várakozás 3600 mp)
- `~/kimi-sandbox/folyamatos/referenciak.md`, `referenciak-claude.md`, `foglalt.md` (m001–m003 felvéve), `STOP`

## Nyitott kérdések
1. Kimi-újraindítás az új számlázási ciklusban (`rm STOP` + setsid; az m004-gyel folytatja).
2. A visszatérő csúsztatások tiltása a futtató promptjában (nagy kert, falu szíve, fotó→szoba) — tulaj-döntés.
3. `~/kimi-sandbox/inline-img.py` nem kezeli a `../img/` útvonalat.
4. Sablon-választás a k1–k6 / m001–m003 közül — a tulajnál.
