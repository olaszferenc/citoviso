# 2026-11-12 — Viselkedés-üzenet (A változat) megvalósítva (SUB cit3ea34be2)

**Mit:** a tulaj 2026-11-11-i döntése (A változat · hétköznap 8–20 · az eszkaláció marad · a „NEM” nem
iratkoztat le · GSM-7) alapján leadenként EGY automatikus üzenet, amikor a lead visszajön, árat néz vagy
megnyomja a próba-gombot. ADR-0439.

**Fájlok:**
- `migrations/0134_behavior_message.sql`, `src/db/schema.ts` (`BehaviorMessageTable`)
- `src/outreach/behaviorMessage.ts` (beállítás, kiváltók, személy-szintű leállítók, küldés), `src/outreach/behaviorMessageCopy.ts` (szöveg, tiszta)
- `src/sms/sendWindow.ts` (`behaviorWindowOpen/Blocks`: hétköznap 8–20)
- `src/outreach/trialCampaign.ts` (`artifactBlocks` exportálva — egy példány a levél-ág mock-kapujára)
- `scripts/behavior-message.mts`, `deploy/systemd/citoviso-behavior-message.{service,timer}`, `deploy/systemd/targets.json`
- `src/console/behaviorMessagePage.ts`, a konzol szerver-útvonala, `src/console/nav.ts` (menü)
- `kb/entries/console-behavior-message/`, `scripts/kb-check.mts` (felület-lista), `scripts/kb-shot.mts` (kép-fixture)
- `scripts/behavior-message-check.mts` + `hooks/pre-commit` (bekötés)
- `assets/design-refs/console/viselkedes-uzenet/` (befagyasztott terv + README)

**Őr-körök:** jog/provenance-őr FLAG → javítva (személy-szintű válasz/„ne keressük”, List-Unsubscribe,
jogalap-mondat „megnézte” nélkül, SMS-ben nincs „saját címén”); tudásbázis-őr FLAG → javítva („Mit tegyél”
valós lépés, 390 px-es reprodukálható kép a kb-shot-ból).

**Nyitott (koordinátornak):** a jog-őr szerint az „egy kattintással” és a „Nem kell semmit beállítania” a
próba-űrlap (név, e-mail, ÁSZF, fotó-nyilatkozat) mellett túlígérhet — a szöveg a jóváhagyott terv része,
és a kerdes-inditas egy kattintásos indító lapjára mutat; változtatás csak tulaj-döntéssel. Élesítés a nagy
deployjal; deploy után a tulaj kapcsolja be a főkapcsolót; a kerdes-inditas horgonyai nélkül a link a lap
tetejére visz (deploy-sorrend: előbb az, vagy együtt).
