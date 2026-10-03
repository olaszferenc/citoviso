## ADR-0313 — A döntés-segítő ajánlat küszöbe alapból a különböző NAPOKAT számolja, kapcsolható (2026-10-03)

**Dátum:** 2026-10-03 · **Státusz:** elfogadva (tulaj-döntés „C”, koordinátoron át; SUB, brief
`~/rc-briefs/javitas-elek-0930/k3-elek3-leletek.md` 3. pont) · **Forrás:** Elek 3. élesi köre, L3-1 (KÖZEPES; L2-1 óta nyitott) ·
**Kapcsolódó:** ADR-0088 §4, ADR-0285 (a küszöb a /pricing-on állítható), ADR-0286, ADR-0312 (ugyanennek a körnek a többi lelete).
Kontraktus: `assets/design-refs/console/escalation-offer-admin/` README ④ (kiegészítve).

**Lelet.** A −50%-os döntés-segítő ajánlat a 3. megnyitásra kb. 2 perccel a kiküldés után megjelent. A küszöb a `mock_view` sorokat
számolta, és egy valódi tulaj telefonon és gépen is gyorsan megnyitja a levelet, tehát a „döntés-segítés” a döntés ELŐTT ment ki.

**Döntés (C változat a három közül).**
1. A „Hányadik megnyitásnál kapja” felirat marad; alatta jelölőnégyzet: **„Csak a különböző napokon történt megnyitások
   számítanak”**, alapból bepipálva. Bepipálva a küszöb a lead azon Europe/Budapest naptári NAPJAIT számolja, amelyeken
   megnyitotta a tervet (`count(distinct (started_at at time zone 'Europe/Budapest')::date)`); kivéve minden megnyitás számít.
2. Tárolás: az `escalation_offer` `app_setting` JSON `distinctDays` kulcsa; a hiányzó kulcs (2026-10-03 előtt mentett sor) = be.
   Migráció nincs; élesen a sor hiánya = alapérték = be.
3. A POST saját jelölővel (`esc_days_present`) különbözteti meg a kivett pipát egy régi, kapcsoló nélküli fültől (ADR-0128);
   kikapcsolt döntés-segítőnél a tiltott jelölőnégyzet nem jön, a tárolt érték marad.
4. A mező alatti sor és az előnézet kimondja, melyik szabály él („… (különböző napon történt) megnyitáskor”); a kapcsoló
   változása a „futó ajánlatok” sort is kiváltja.

**Elvetve:** A — „Hányadik napon kapja” átnevezés (a tulaj a megszokott feliratot tartotta meg); B — csak magyarázó sor
kapcsoló nélkül (nem hagy választást).

**Őr:** `scripts/escalation-config-check.mts` ⑩ — 5 megnyitás egy napon nem ad ajánlatot (küszöb 3), a 3. különböző napon igen,
kikapcsolva 3 azonos napi megnyitás igen; a tárolás oda-vissza; az űrlap négy esete; a render (alapból pipálva, tiltva a
szekcióval). A napok éjfél-biztos rögzített időpontokon. 7 mutáció, mind piros. Súgó: `kb/entries/console-pricing`
(+ kép), `kb/entries/console-outreach-draft`.

**Élesítés:** a nagy deployjal. **Visszafordíthatóság:** 🔄 — a pipa kivétele a régi viselkedést adja, deploy nélkül.
