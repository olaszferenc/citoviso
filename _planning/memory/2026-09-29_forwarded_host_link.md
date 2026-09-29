# 2026-09-29 — A levél-link hostja a Host fejlécből (X-Forwarded-Host kizárva)

SUB a „Deploy-készenlét felderítés” (cit92d2a67e) alatt, brief: `~/rc-briefs/dk-forwarded-host.md`.

## Elvégzett munka
- `src/server/public.ts` `publicBaseUrl(req)`: a host a `Host` fejlécből jön, az X-Forwarded-Host-ot nem olvassa
  (az éles nginx nem írja felül → kliens-hamisítható volt; a tulaj levelének action_token-es linkje idegen domainre
  mutathatott). ADR-0278.
- `scripts/guest-link-host-check.mts` ⑤: negatív kontroll hamis X-Forwarded-Host-tal (vélemény-POST consent
  nélkül, DB-írás nincs) + pozitív kontroll. Régi kódon piros, javítva zöld.
- Élesi nginx olvasva: sehol nincs X-Forwarded-Host, minden location `Host $host`; cloudflared nem fut.
- Grep: más link-építő nem használja a kérés-hostot (konzol/outreach: config; naptár-feed: DB).

## Nyitott
- `throttled()` az X-Forwarded-For első elemére kulcsol, a kliens kijátszhatja (nginx hozzáfűz). Külön döntés.

## Módosított fájlok
- src/server/public.ts
- scripts/guest-link-host-check.mts
- _planning/decisions/XXXX-a-level-link-hostja-a-host-fejlecbol-jon.md
- _planning/memory/2026-09-29_forwarded_host_link.md
