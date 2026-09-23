## ADR-0077 — A terv-mock MŰKÖDŐ legyen, és a munkafán belül éljen (tulajdonosi rendelet)

**Dátum:** 2026-08-27 · **Státusz:** ELFOGADVA (tulajdonosi rendelet) · **Kapcsolódó:**
ADR-0065/0066 (terv-jóváhagyási kapu), ADR-0076 (a külső design-app kivezetve),
CLAUDE.md §2b (1. és 2. pont bővítve).

**Két rendelet egy körben.**

**① „Mindig legyen mock fájl, és a várt funkciókat tartalmaznia kell: input field viselkedés,
kattintások stb."** A terv nem lehet statikus kép: a tulaj a FUNKCIONALITÁST is megítéli. A mock
implementálja a beírt szöveg tényleges kezelését (normalizálás, validáció, hibaüzenet), a
kattintásokat, az állapotváltásokat és a folyamat-visszajelzést.
- ⭐ **A viselkedés a VALÓDI szabályokat tükrözze**, ne egy szebb hazugságot: a domain-mock
  normalizálása ugyanazt csinálja, mint a `domains.ts::normalizeCustomDomain` (`https://`, `www.`,
  záró perjel, nagybetű lecsupaszítva; végződés kötelező; csak `[a-z0-9-]`). Így a tulaj azt
  ítéli meg, ami élesben is lesz.
- A mock felirata sem állíthat valótlant magáról: amíg „TERV — nem működő felület" volt a fejléc,
  az hazudott, mert közben már működött (§B.17 magunkra is áll).
- **Az ellenőrzés is bővül:** a képnézés nem mutatja meg, mit csinál a beírt szöveg → a mock
  interaktív részeit Playwrighttal végig kell kattintani (input → normalizálás, hibás input →
  üzenet, gomb → állapotváltás, JS-hiba = 0). Mérve: mind az öt eset zöld, 0 JS-hiba.

**② A mock HELYE: a munkafán belül** (`assets/design-refs/_drafts/`, gitignore-olt).
- **A kiváltó hiba:** a `/tmp/domain-ui/`-ba írtam, és a tulaj a Remote-Control sessionben
  megnyitva ezt kapta: *„Can't read this file — This file lives on the machine running this
  Remote Control session… It may be outside the session's working directory."*
- **Ami szintén kívül esik:** az `assets/Temp` — az minden worktree-ben SYMLINK a fő fába
  (`/home/citoviso/citoviso/assets/Temp`), tehát a session munkakönyvtárán kívülre mutat. A
  ui-shot képei oda írnak (az rendben, azok küldve mennek), de a MEGNYITHATÓ mockok nem ott a
  helyük.
- Jóváhagyás után a terv továbbra is a `assets/design-refs/console/…` alá fagy be (commitolva);
  a `_drafts/` csak a jóváhagyás előtti állapot, ezért gitignore-olt.

**Visszafordíthatóság:** 🔄 — mindkettő munkarendi szabály, kód nem függ tőle.
