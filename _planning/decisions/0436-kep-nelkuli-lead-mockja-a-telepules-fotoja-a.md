## ADR-0436 — Kép nélküli lead mockja: a település fotója a hősben, tiszta mintaképek egy felirattal

**Dátum:** 2026-11-09 · **Döntött:** tulaj (brief `k-pek-n-lk-l-20261109-193407.md`: „Képek nélküli leadet nem küldhetünk ki, nagyon gagyi… Hero városról kép. Minta képek ingyenes, de azért látszódjanak most így is”; a terv-körből: „C”) · **Terv (kontraktus):** `assets/design-refs/tenant-site/varos-hero/README.md` · **Felülírja:** ADR-0431 1. pont (vízjel a pixelekben) és 3. pont (nulla képnél betűs hős, ha van településfotó) · **Kapcsolódik:** ADR-0150 (kép nélküli lap nem megy ki), ADR-0413 (a generálás nem hív fizetős szolgáltatást), ADR-0419 (Vera képátnézése), §A (fotó-jogállás), §B.17

**Kontextus.** A 0 saját képes lead mockja (ADR-0431) betűs hőst kapott halványított, általános tájjal, galéria nélkül, a mintaképeken nagy „MINTA” bélyeggel — a tulaj szerint „nagyon gagyi”, így nem küldhető. Dev-DB 2026-11-09: 7371 aktív leadből 6919-nek nincs se Places-, se portálfotója.

**Döntés.**
1. **Hős = a település fotója**, ha a leadnek nincs saját képe. Forrás (ingyenes, kulcs nélkül): a település Wikipédia-szócikkének vezérképe (az ország nyelvén, aztán angolul), különben a Wikimedia Commons keresés első alkalmas képe. Alkalmas: fekvő JPEG, ≥ 1200 px, szabad licenc (CC BY / BY-SA / CC0 / közkincs), nem címer/térkép/zászló/kollázs/temető. Hot-link a Wikimedia CDN-ről, nálunk nincs tárolva. `src/generator/townPhoto.ts`, eredménye a `siteData.townPhoto`-ban marad (újrarenderelés nem kérdez újra).
2. **Forrásmegjelölés** a mock alján (a licenc kéri): „Borítókép: <település> · Fotó: <szerző>, Wikimedia Commons, <licenc>”.
3. A településfotó **nem a szállás képe:** nincs a tárolt `photos`-ban, csak a mock renderelésekor lesz hős (`render.ts withTownHero`); élesre nem kerül.
4. **Tiszta mintaképek:** a könyvtár vízjel nélkül újraépítve (`scripts/stock-build.mts`); jelölés = **egy felirat a galéria alatt** minden mockon, amelynek galériájában mintakép van: „Néhány kép minta: a helyükre a szállás saját fotói kerülnek.” A régi vízjeles fájlok ujjlenyomata a manifest `retired` listájában marad, a feltöltő azokat is elutasítja.
5. **Kiküldhető:** a településfotó valódi kép-hivatkozás, így a mock nem `nophoto` (ADR-0150 kapuja átengedi). Vera képszabálya: ≥ 1 saját kép VAGY településfotó a hősben; betűs hős → TARTVA (az ADR-0431 „Következmény” pontjának elmaradt átvezetése is itt történik).
6. Nincs településfotó (nincs szócikk / szabad kép / hálózati hiba) → marad a betűs hős, és a `nophoto` kapu is.

**Következmény.** Őr: `scripts/stock-fill-check.mts` ⑨ (településfotós hős három sablonon, forrás-sor, egy felirat, élőben semmi) és ⑩ (a lecserélt vízjeles készlet tiltva). A meglévő, kép nélküli mockok csak újrageneráláskor kapnak településfotót (az újrarenderelés a tárolt adatból dolgozik). Kapunyitás saját második kép nélkül kapu-animáció nélkül renderel.
