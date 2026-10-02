# 2026-10-02 — „Kapunyitás” (`gate-opening`): a tulaj által választott Kimi-mockból generálható sablon

**Szál:** SUB a CIT koordinátor alatt; brief `~/rc-briefs/kapunyitas-sablon.md`. Döntés: ADR-0311.
Kontraktus: `assets/design-refs/tenant-site/gate-opening/` (az elfogadott `plan.html`, `img/`, `terv.md`, első képernyők, README).

## Elvégezve
- Új sablon `src/engine/templates/gateOpening.ts` (+ regisztráció `templates.ts`, a 21.), új skin `lantern-charcoal` (`skins.ts`),
  i18n-katalógus (3 új felirat), előnézeti képek `public/assets/ui/tpl-gate-opening{,-prev,-full}.jpg`.
- Teljes képernyős hős, kapunyitás (`ko-anim` osztály a `<head>`-ben, első festés előtt), maszkból emelkedő név-sorok,
  görgetésre elhalványuló hős; számsáv, ragadós „A ház” bevezető, váltakozó 7/5 szobasorok, 6 oszlopos zárt mozaik, hajszálvonalas
  értékelés, plusz-ikonos GYIK, akcenttel melegített lábléc. Funkciók a közös modulokból; telefonos fejléc az ADR-0253 szerint.
- A kapu a hős fotó maga, tompítva: vision-tárgyként nincs „kapu/bejárat” (mérve: a Három Huszár 24 fotóján sincs).
- Javítva a mock két lelete (egyedül lógó „éj”; „Ft-tól” kötőjel-törés) és a saját dupla „Foglalás” címem; a runtime MINTA-burkolója
  a lusta fotónál a keret alatt maradt (Lidó: 150/268 px) → a sablon a kép-keretben megadja a magasságot.

## Mérve
- Végiggörgetve 390/1440: Három Huszár, Lidó, Kemencés, Nyugalom (mock + élő), gazdag teszt-eset — JS-hiba 0, túlcsordulás 0.
- Eszközök (gitignore-olt): `assets/design-refs/_drafts/kapunyitas/tools/` (render, scroll-shot, gateshot, variants, demo, probe).
- Képekhez a portál-UA kell: a lake-balaton.com a HeadlessChrome UA-ra 429-et ad, és a hős „törött” lesz.

## Őrök
- jog/provenance PASS · tényhűség FLAG (a sablon maga tiszta; a leletek a sablon előtti rétegből: Lidó 0,605-ös párosítás
  értékelése, teszt-adat a Huszár elérhetőségében, túlfordított copy) · dizájn-doktrína FLAG → javítva (tükrözött szobasor,
  egycellás számsáv, MINTA-burkoló magassága); a Google-címke a link hosztjára kötve.
- Gépies őrök zöldek (module-slot, module-render, cover-photo, hero-fit, hero-contrast, rating-scale, star-size,
  room-card-overflow, rooms-all-shown, template-copy, prospect-framing, photo-caption, native-content, modsec-align,
  live-sample-room, template-pick, empty-tagline, photo-srcset, mobile-sticky, …).

## Nyitott (koordinátornak, döntési anyaggal a `_drafts/kapunyitas/` alatt)
1. Kapu forrása: A hős maga (ma) · B másik kültéri fotó · C új `entrance` vision-tárgy + újrapontozás.
2. A hős fölötti nagybetűs felirat: marad / normál.
3. Kiküldött mockon fusson-e a kapu (`data-cit-no-intro`).
4. Lead-adat: a Három Huszár címe ma is „Ráckevei út 083/2 hrsz., 24393470213” (a portál szerint Fő u. 24.) — nem sablon-tétel.
