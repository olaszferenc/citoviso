## ADR-0216 — Az éles időzítőket a DEPLOY telepíti és visszaméri — kézzel nem, kihagyhatatlanul (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, negatív kontrollokkal; a telepítő ág
első éles futása a következő deploy) · **Kapcsolódó:** ADR-0053 (verzió megy ki), ADR-0214
(programajánló — két új időzítő), ADR-0207 (a deploy-kapuk mintája).

**Kontextus — mérve.** Az éles VPS 4 időzítője (billing, booking-maintenance, domain-resume,
traffic-mail) KÉZZEL volt telepítve, kézzel átírt egységfájlokkal: a repóbeliek dev útvonalat
hordoznak (`/home/citoviso/citoviso`, fájl-napló), az élesek `/opt/citoviso/app`-ot, `npx tsx`-et,
`journal`-t. Egy új időzítő így csak egy README-jegyzet volt, amit a deploy nem olvasott. A heti
programajánló (ADR-0214) két időzítő nélkül élesen **semmit nem gyűjt**, miközben a választó, a
honlap és a heti levél mind azt állítja, hogy igen. Tulaj (2026-09-23): „valami olyan módon kéne
rögzíteni élesítéskor mindkét időzítőnek a telepítését, amit nem tudunk kikerülni".

**Döntés.**
1. **Nyilvántartás:** `deploy/systemd/targets.json` — minden `*.timer` `prod` vagy `dev` célt kap,
   a `dev` kötelező indoklással. A pre-commit (`scripts/systemd-units.mts check`) nyilvántartás
   nélküli időzítőt nem enged a repóba.
2. **Egy forrás, két alak:** a repó egységei maradnak (a dev gépen így futnak); az éles alakot a
   `renderProd()` állítja elő (három sor: WorkingDirectory, ExecStart, StandardOutput). Mérve: a
   renderelt alak a kézzel telepített 8 éles egységgel **bájtra egyezik**.
3. **Deploy GATE 6** (`scripts/deploy-prod.sh`): a CÉL-commitból renderel; dry-runban kiírja a
   tervet (új / módosul / egyezik); `--go`-val a migrációk UTÁN, a restart ELŐTT telepít,
   `daemon-reload` + `enable --now`, majd **GATE 6b** független visszamérés (fájl-sha + `is-enabled`
   + `is-active`). Bármi eltér → a deploy elbukik, a szolgáltatások NEM indulnak újra.
4. **Rejtett futás is bukás:** élesen engedélyezett, de nem-`prod`-ként deklarált citoviso-időzítő.
5. **Nincs átugró kapcsoló.** Ami kihagyható, azt ki is fogják hagyni.

**Besorolás (tulaj, 2026-09-23):** prod = billing, booking-maintenance, domain-resume, traffic-mail,
events, events-pending. dev = backup-dev (a dev DB-t menti), sms-relay (a GSM-modem a dev gépen),
multilang-resume és pair-repair (**nincs eldöntve**, hogy élesen kellenek-e — külön vizsgálandó;
addig marad, ahogy ma van).

**Mérve (negatív kontrollok, élesen csak olvasva):** ① egy élesen engedélyezett, de a listából
kivett időzítő → GATE 6 piros; ② nyilvántartás nélküli cél-commit → piros; ③ nyilvántartásból
hiányzó időzítő → pre-commit piros; a renderelő öntesztje minden szabályt pirosra is visz. A terv a
mai élesre: 4 időzítő „egyezik", a programajánló 2 időzítője + szolgáltatásai „új".
⚠️ A telepítő és a GATE 6b ág élesen még NEM futott (éles írás = külön engedély) — az első valódi
deploy az első futása.
