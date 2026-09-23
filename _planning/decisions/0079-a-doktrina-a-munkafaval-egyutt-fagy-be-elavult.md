## ADR-0079 — A doktrína a munkafával EGYÜTT fagy be: elavult-doktrína őr a repón KÍVÜL

**Dátum:** 2026-08-28 · **Státusz:** elfogadva (tulajdonosi elkapás) · **Kapcsolódó:**
ADR-0066/0076/0077 (terv-kapu), ADR-0052 (munkafánkénti fejlesztés), 03-INVARIANTS §B.18.

### A kár

Egy session a §2b-t követve a KIVEZETETT külső design-appba akart tervet tölteni,
ahelyett hogy a tulajnak küldte volna. Nem hanyagságból: a munkafája **12 committal
le volt maradva**, és abban a `CLAUDE.md` még az egy nappal korábbi szabályt írta.
A repóban élő §2b-hook sem szólt — **az is csak a main-en létezett**. A hook, amit
kapott, a régi szöveget mondta, vagyis az őr maga terelte rossz irányba.

### A felismerés

**A munkafa a szabályok BEFAGYOTT PILLANATKÉPE.** Ugyanaz a hibaosztály, ami ezen a
napon már kétszer előjött (i18n-fájllisták, majd a levél-lánc): egy szabály több
kézi példányban él, és a példányok elcsúsznak. Itt a példányok: ~10 munkafa
`CLAUDE.md`-je + a hook-üzenet prózája.

⛔ Ebből következik, hogy **repóbeli őr nem tudja megvédeni a lemaradt fát** — hiszen
a lemaradt fa nem tartalmazza az őrt.

### Döntés

1. **Az elavultság-őr a repón KÍVÜL él:** `~/.claude/hooks/block_stale_doctrine.sh`,
   a GLOBÁLIS `settings.json`-ból (`Edit|Write|MultiEdit`) — így minden session, minden
   munkafa alá bekapcsol, a checkout korától függetlenül.
2. **Amit mér:** a fa `HEAD:CLAUDE.md`-je egyezik-e az `origin/main:CLAUDE.md`-vel.
   Eltérés → BLOKK, a teendővel. A MUNKAMÁSOLAT eltérése nem blokkol (doktrína-írás
   közben nem béníthatja meg a saját munkáját).
3. **A hook-üzenet nem hordoz szabály-másolatot:** a `ui-shot-nudge.mjs` a
   CLAUDE.md ÉLŐ §2b szakaszából idéz. Nincs mit szinkronban tartani.
4. **Piros önteszt kötelező** — és itt egy tanulság a sajátomból: az első verzióm a
   repót ÚTVONAL alapján ismerte fel, ezért a `/tmp`-ben álló teszt-fát némán
   átengedte. Egy őr, ami csak a megszokott helyen fog, nem őr; a felismerés a
   remote URL-ből megy.

### Visszafordíthatóság

🔄 Egy sor a globális settings.json-ban. Az őr fetch-e 10 percenként fut, hálózati
hiba SOSEM blokkol (a régi origin/main-nel mér tovább).
