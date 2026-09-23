## ADR-0010 — Modul-tudatos archetípusok: a FUNKCIÓ-tengely (vékony definíció, szállás)

- **Dátum:** 2026-07-10
- **Kontextus:** a modulok (szállásfoglalás, asztalfoglalás, érdeklődés, vélemények…) iparág-specifikus
  FUNKCIÓK. Kérdés: mennyire kell most definiálni, és hogyan viszonyul a korpuszhoz (ADR-0009 4. tengely).
- **Döntés:**
  1. **A modul a FUNKCIÓ-tengely, és ADAT — NEM korpusz-tengely.** Az archetípus egy modul-BEFOGADÓ
     elrendezés-nyelvtan; a modulok jelenlét/hiány-tűrő blokkok (CLAUDE.md §7 „mag + adat-objektum").
     → nincs archetípus × modul kombinatorikus robbanás.
  2. **Vékony definíció most (Szint 0–1):** modul-katalógus (név + cél + 3-interfész besorolás) + megjelenési
     jel (milyen valós adat hozza; gerinc/adat-kapuzott/upsell). Ennyit fogyaszt a korpusz- + grounding-prompt.
     **Elhalasztva:** Szint 2 adat-séma · Szint 3 entitlement-kapuzás · Szint 4 működő widget (data-plane/konverzió).
  3. **Egyelőre CSAK szállás.** Az iparág-interfész absztrakciót akkor húzzuk rá, ha tényleg jön a 2. iparág
     (ugyanaz a bizonyíték-vezérelt elv, mint a környezetnél — ne absztraháljunk empíria előtt).
- **Hely:** `_planning/DOMAIN/05-MODULES.md` (katalógus) + a két prompt (`corpus.ts`, `mockFromCorpus.ts`)
  modul-tudatos: agent-1 modul-blokkokat rendez el (bármely részhalmaz renderel), agent-2 csak a valós
  adatú modulokat tölti (a „ismeretlen → kihagy" explicitté téve).
- **Visszafordíthatóság:** 🔄 · ADR-0007/0009 tényhűségére + moduláris-platform architektúrára épül.
- **Státusz:** ELFOGADVA.
