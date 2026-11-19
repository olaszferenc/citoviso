# 2026-11-18 — Hideg e-mail leállítás, Gmail spam-teszt, csatornánkénti messenger-fék (cit5980e14c)

## Elvégzett munka
- Messenger-fék csatornánként ítél (`channelBrakeVerdict`, `src/mms/messenger.ts`; őr ⑧b `scripts/messenger-relay-check.mts`). Éles: c5d0b592.
- Megnyitás-összeomlás vizsgálata: 24 h nézés 11-16 reggel 17% → 11-18 1%; Gmail ~25% → ~0.
- Rejtett preheader helyett látható első sor (`src/email/outreachEmail.ts`), őr a `scripts/outlook-lint.mts`-ben. Éles: 77a1121f.
- Gmail seed-teszt: ismert címzettnél Primary, friss fiókoknál (irodavezeto.minerallog@, khertvez@) a tiszta és a csak-szöveges levél is spam → a citoviso.com domain hírneve sérült, nem a levél tartalma.
- Postmaster Tools: citoviso.com TXT felvéve (Cloudflare), igazolva, még „nincs elég adat”.
- Kutatási prompt napi több ezer e-mailhez: `assets/design-refs/_drafts/kutatasi-prompt-tomeges-email.md` (a tulajnak elküldve).
- Hideg e-mail teljes leállítása, négy kapcsoló: `outreach_auto` enabled=false · `behavior_message` enabled=false · `escalation_followup` enabled=false (új kapcsoló, `src/outreach/escalationFollowup.ts`, őr ⑨b, éles e7410c55) · `nonopener_followup_daily_cap`=0 (14:06 UTC, mentés `/opt/citoviso/backups/nonopener-stop-20261118-140634/`).
- A `cit73105eb0` 3511c1a4 (getcitoviso.com sáv) deployjából kimaradt a `getAutoDispatchSettings` import → a dispatch-tick 16:22 UTC-tól 2 percenként elhasalt (riasztó levelek). Tulaj „2 utána 1”: timer stop, majd hotfix b1a7109a élesítve (prod/20261118-1815), tick 17:14 UTC sikeres. Az `outreach_auto`-t a `cit73105eb0` közben visszakapcsolta (getcitoviso.com, ramp 11-19-től 100/nap).

## Módosított fájlok
- `src/mms/messenger.ts`, `scripts/messenger-relay-check.mts`
- `src/email/outreachEmail.ts`, `scripts/outlook-lint.mts`
- `src/outreach/escalationFollowup.ts`, `scripts/escalation-config-check.mts`
- `scripts/outreach-dispatch.mts` (csak a hotfix-ágon, a mainen megvolt)
- `MEMORY.md`

## Nyitott kérdések
1. Postmaster Tools: a citoviso.com hírnevének megnézése (11-19 délelőttre ígérve, nem történt meg).
2. Az első getcitoviso.com-os küldések ellenőrzése 11-19 8:30-kor (ígérve, nem történt meg).
3. Zoho-postafiók: jött-e késés/visszapattanás-értesítés az olasz.panna2016@gmail.com címről (11-18 15:00-ig ígért figyelés, nem ellenőrizve).
4. A citoviso.com-os e-mailek újraindítása: a tulaj kutatási eredményére és az arra épülő tervre vár.
5. A 538 ellenőrzésen fennakadt és a 317 sorba nem került honlap nélküli lead kivizsgálása.
