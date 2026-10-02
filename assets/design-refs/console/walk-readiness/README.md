# Séta-jelzés a konzolon — jóváhagyott terv (A változat, 2026-10-02)

Tulajdonosi jóváhagyás: **2026-10-02** (a koordinátoron át, a tulaj szava: „A”). A tulaj két változatot
látott asztali ÉS mobil képen, kattintható HTML-lel, és az **A — figyelmeztet, választható marad**
változatot választotta. Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.

> ⚠️ A `**„…”**` alak ebben a fájlban **felületi feliratot** jelöl — a `contract-drift-check`
> pontosan azokat keresi vissza a kódban.

**Hatókör:** `src/console/views.ts`

Referencia: `plan.html` (kattintható, a dev VALÓS adataival — Camping Carina, Nyugalom Vendégház,
Három Huszár; „Mobil 390px / Asztali” váltóval), `A-asztali-valaszto.png`, `A-mobil-valaszto.png`,
`A-kartya.png`. Az elvetett változat képe: `elvetett-B-asztali.png` (a kártya kiszürkítve, „Mégis kérem,
séta nélkül” gombbal — a tulaj nem ezt választotta).

## Miért van

Elek 2. élesi köre (S-1, KÖZEPES): a „Séta a kapun át” (ADR-0304) a Muschel 6 fotójából nem tudott sétát
építeni (a kollázs után nem maradt 3 különböző tárgy), és a kurátor egy sima, egyhasábos lapot kapott
ezen a néven — a konzol sem előtte, sem utána nem szólt. A tulaj döntése (2026-10-02): kevés tárgynál a
séta **elmarad**, ez nem változik; a hiba a **némaság**.

## Mit KÖT a terv

1. **Egy forrás.** A jelzés ugyanabból a `walkReadiness`-ből jön, amiből a sablon rajzol (közös
   `walkCollage`); a „rendben” pontosan akkor áll, amikor a lap sétál. A hiányzó tárgyakat a lap SAJÁT
   lépés-címeivel nevezi meg (`walkSubjectLabel`).
2. **① Kinézet-választó — kártya.** Ha a séta nem áll össze: sárga címke a „Séta a kapun át” kártyán,
   **„Séta: nem áll össze”** + „(N/3)”. Ha a fotóknak nincs tárgy-ítélete (vagy nincs pillanatkép):
   szürke címke, **„Séta: előre nem tudható”**. Rendben esetén NINCS címke. A kártya MINDIG
   választható (A változat).
3. **① Kinézet-választó — magyarázat.** A kártya bejelölésekor a választó alatt nyílik (alapból rejtve):
   **„Ennél a leadnél a séta nem áll össze”** — a küszöb (legalább 3), a megmaradt tárgyak száma, az öt
   tárgy listája (zöld = van rá fotó, áthúzott = csak a kollázsban, halvány = nincs), és mit kap a kurátor,
   ha mégis ezt választja. Ismeretlennél: **„Előre nem tudható, összeáll-e a séta”**.
4. **② Előnézet.** Ha az előnézet a „Séta a kapun át”-ot mutatja és a séta nem áll össze, a felirat alatt
   sárga sor mondja, hogy ez az előnézet **séta nélkül** áll össze (N fotó-tárgy, 3 kell).
5. **③ Mock-kártya.** Minden „Séta a kapun át” mock kártyáján **„Séta”** sor: rendben = zöld „N lépés” a
   lépések nevével; különben sárga **„elmaradt”** + „N fotó-tárgy, 3 kell”.

## Őr

`scripts/walk-readiness-check.mts` (pre-commit): a három adat-eset, a jelzés és a render egyezése, a négy
felület szövege, és a bekötés (szerver → választó, magyarázat, előnézet, kliens-szkript, kártya).
