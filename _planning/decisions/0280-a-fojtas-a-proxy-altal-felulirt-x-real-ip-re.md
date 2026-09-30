## ADR-0280 — A fojtás a proxy által felülírt X-Real-IP-re kulcsol (Cloudflare mögött a CF-Connecting-IP-re) (2026-09-30)

- **Kiváltó:** a deploy-készenlét felderítés (koordinátor: `cit92d2a67e`, brief: `~/rc-briefs/dk2-arazas-igeret-ip-kbpaths.md`,
  tulaj: „javaslatot elfogadom”). A foglalási/érdeklődési/vélemény-fék (`src/server/public.ts` `throttled`) és a belépési
  fék (`src/auth/loginGuard.ts`, ADR-0277) az `X-Forwarded-For` ELSŐ elemére kulcsolt. Az éles nginx ezt
  `$proxy_add_x_forwarded_for`-ral építi, azaz a kliens által küldött értékhez FŰZ → a kliens kérésenként új „IP”-t
  mondhat, és a fék sosem zár (mérve a guardon a régi kulccsal: 11 hibás belépés kérésenként új XFF-fel → egyik sem 429, egyik birodalomban sem).
- **Mérés közben előkerült (2026-09-30, élesi olvasás):** az éles forgalom Cloudflare-en át jön (a nyilvános DNS
  `2606:4700::/32`; az access-logban CF-él címek, pl. `162.159.114.119`, `104.23.248.217`), az nginx-ben NINCS
  `set_real_ip_from`. Így az nginx `$remote_addr`-ja — és vele az `X-Real-IP` — a CF-ÉL címe, amin egy PoP összes vendége
  osztozik. A brief szerinti puszta „X-Real-IP” élesen egy budapesti él mögötti ÖSSZES vendéget egy számlálóra
  vonta volna (5 foglalási kérés / 10 perc / él) — rosszabb, mint a javítandó hiba.

**Döntés**

1. **Egy szabály, egy példány:** `src/server/clientIp.ts` `clientIp(req)`; mindkét fék ezt hívja (a `loginGuard`
   korábbi saját másolata törölve).
2. **A kulcs:** ① a társ = `X-Real-IP` (az nginx `$remote_addr`-ból FELÜLÍRJA), proxy nélkül (dev) a socket-cím;
   ② ha a társ Cloudflare-él (a hivatalos `ips-v4`/`ips-v6` lista, 2026-09-30, a fájlban), akkor a kliens a
   `CF-Connecting-IP` — ezt a Cloudflare szintén felülírja, és CSAK élről fogadjuk el, így a közvetlenül az originre
   küldött kérés nem választhat magának kulcsot; ③ az `X-Forwarded-For`-t SEHOL nem olvassuk.
3. **Elavult CF-lista kára:** egy új él egy kliensnek számít (a Cloudflare előtti viselkedés) — kulcs-választás
   sosem lesz belőle. A lista kézi frissítése tudatos lépés.

**Elvetett út:** nginx `real_ip` modul (`set_real_ip_from <CF-tartományok>` + `real_ip_header CF-Connecting-IP`) — ez
élesi konfig-írás, a deploy verzió-doktrínáján (ADR-0053) kívül esik, és külön engedélyt kérne; a kódbeli szabály a
deployjal megy, és devben is tesztelhető. Ha később az nginx is átáll, a kód változatlanul helyes (a társ akkor már
nem CF-él, a `X-Real-IP` maga a kliens).

**Őr:** `scripts/login-hardening-check.mts` ③ (pre-commit, diff-scope bővítve a `src/server/clientIp.ts`-szel) — a
valódi szervereken: kérésenként új XFF mellett a login-fék mindkét birodalomban és a foglalási fék (`/t/<slug>/api/erdeklodes`,
üres űrlap: 400 DB-írás nélkül) MÉGIS zár; `X-Real-IP`-vel külön kliens = külön számláló; nem-CF társtól kérésenként új
`CF-Connecting-IP` mellett is zár; ugyanazon CF-él mögötti MÁSIK vendég szabad marad. Negatív kontroll (ideiglenes
rontás, visszaállítva): a régi XFF-kulccsal 5, a CF-et nem ismerő X-Real-IP-kulccsal 6 ellenőrzés PIROS.

**Nem érintett (tudatosan):** `src/analytics/siteVisit.ts` a látogató-hash-hez még az XFF első elemét olvassa — nem
fék, hanem statisztika (hamisítással az egyedi-látogató számot torzíthatja, fékezni nem fékez); átállítása külön döntés.
