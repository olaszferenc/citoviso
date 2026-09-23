## ADR-0109 — A saját cím HAVI díjas: 1 000 Ft/hó, 7 000 Ft/hó feletti csomag mellé, 12 hó hűséggel (2026-09-07)

**Státusz:** ELFOGADVA (tulaj, 2026-09-07: „saját cím havi díja 1.000 Ft / hónap. minimum 12
hónap hűség." + „Minimum csomag mellé lehet választani. Minimum 7000 felett" + „Hűség kötbér
es minimum tarifa sincs csak havidíj") · **Felülírja:** ADR-0093 ② (küszöbtől ingyen),
ADR-0100 ①–② (éves díj a fordulónapos tételben) · **Érintetlen:** ADR-0094 (kötbér-modell),
ADR-0100 ③ (kedvezmény a díjra sosem megy), ADR-0103 (registrar).

### Kiváltó — és a tanulság, ami fontosabb a számnál

A tulaj a Haus Elisabeth mock konfigurátorán nézte meg a saját-domain panelt, és kimondta:
„lejelentetted, hogy az éves domain ár és annak kalkuláció logikailag meg mindenhogy fasza…
HÁT KURVÁRA NEM". A session-átiratok visszaolvasása igazolta:

- **A 6 000 Ft/év összeget a tulaj SOHA nem mondta ki.** Az `CUSTOM_DOMAIN_YEARLY` egy
  2026-07-27-i **placeholder** volt („owner sets it"), és onnan sétált be a felületre, a
  rendelésbe és a számlába.
- A 2026-09-06-i kör (`ae6d75c`) a tulaj hibajelzésére („nem adja a valós feltételeket")
  megépítette az élő díj-feloldást, és **önmagát jelentette zöldre** — a konkrét összeget és
  a kalkulációs modellt jóvá senki nem hagyta. A „hatezer" a tulajnál az átiratban a
  **VÉTELI ÁR-PLAFON** kontextusában hangzott el, nem eladási árként. ⛔ Ez a
  `feedback_check_the_prompt_before_the_guard` mintája pénzügyi rétegben: mielőtt egy
  paramétert helyesnek nyilvánítunk, meg kell nézni, KI mondta ki.

### Döntés

**① A saját cím díja HAVI: 1 000 Ft/hó** (nem 6 000 Ft/év). Minden számlázási ciklus
tétele, amíg a vevőnek saját címe van. Ezzel az ADR-0100 évforduló-ablaka
(`renewal_period_start ≤ évforduló < renewal_period_end`) **tárgytalanná válik**: nincs
külön „melyik ciklus szedi" kérdés, mert minden ciklus szedi.

**② A küszöb BELÉPÉSI FELTÉTEL lett, nem ingyen-kapu.** Saját cím **CSAK 7 000 Ft/hó
feletti csomag mellé választható**. Alatta nem drágább — **egyáltalán nem kínáljuk**.
⛔ Ez §I-kérdés is: a küszöb alatti vevőnek a felület nem mutathat megrendelhetőként olyat,
amit nem adunk el neki; ha megjelenik, akkor magyarázattal és a feltétel kimondásával.

**③ NINCS ingyen-ág.** A nagy csomag sem teszi ingyenessé a címet — a
`resolveDomainYearly` küszöb-logikája (ADR-0093 ②) kivezet. A horog nem az ingyenesség,
hanem a belépési feltétel: a saját cím a nagyobb csomag JÁRULÉKA, nem az ajándéka.

**④ Hűségidő 12 hó, a kötbér-modell VÁLTOZATLAN** (ADR-0094, tulaj-döntés): a hűség alatt a
csomag nem csúszhat a belépési küszöb alá (**padló = 7 000 Ft/hó**, a korábbi 8 000 helyett),
és korai kilépés = **hátralévő hónapok × padló + a domain vételára, ha VISZI a nevet**.
A domain a zálog; átszállás csak maradéktalan rendezés után.

**⑤ A hűségidő letelte után NINCS semmi kötés — csak a havidíj.** Nincs kötbér, nincs
csomag-padló; a vevő szabadon csökkenthet vagy felmondhat. Az 1 000 Ft/hó viszont **fut
tovább**, amíg a cím nála van (a registrar minket évente terhel). A kitöltött hűségidő után
a név díjmentesen az övé — ez a ⑤ és a ④ közti különbség lényege: a hűség a NÉVÉRT jár,
a havidíj a FENNTARTÁSÉRT.

**⑥ Kedvezmény a domain-díjra továbbra sem megy** (ADR-0100 ③): a kupon/ajánlat a mi
szolgáltatásunkat árazza, a domain átfolyó registrar-költség.

**⑦ A paraméterek operátor-szerkeszthetők maradnak** a CRM → „Árazás és értékesítés"
lapon (ADR-0102): havi díj, belépési küszöb, hűség-hónapok, domain-vételár, ár-plafon.
A kódban álló szám mindig csak seed, soha nem igazság — ezt a kör tanulsága kényszeríti ki.

### Ami ezzel elavul

- `customDomainYearly` / `resolveDomainYearly` / `domainFreeMinMonthly` — a mező NEVE is
  hazudni fog az új modellben („free min" → belépési küszöb), ezért átnevezendő, nem csak
  átértékelendő (§B.17 magunkra is áll).
- `order_intent.domain_fee` (0053) egyszeri éves tételként — havi tétellé válik.
- A konfigurátor panel-szövege és az ÁSZF domain-bekezdése (`legal.ts`).

**Visszafordíthatóság:** 🔄 — árparaméter + számlatétel-forma; a már futó hűségidős
rendelések a rendeléskor BEFAGYASZTOTT feltételeikkel futnak ki (ADR-0094
`committed_min_monthly`), visszamenőleg nem áraznak át.

**⑧ A jogosultságot a LISTAÁR dönti el, a kedvezmény SOHA** (tulaj, 2026-09-07:
„minimum hétezer forintnyi havidíjas előfizetést kell választani, kedvezmények nélkül").
Egy időszakos kedvezmény nem vehet meg egy tartós jogosultságot: a 7 000 Ft/hó-t a csomag
listaárán mérjük. Mérve a kontraktus-fájlban: listaár 7 250 Ft → jár, miközben a −25%-kal
fizetendő 6 437 Ft a küszöb ALATT van, és a jogosultság megmarad.

**⑨ A felület: a küszöb alatt LÁTHATÓ meghívó-kártya, nem néma tiltás** (tulaj-választás:
„C2"). A saját cím rádiógombos sora a küszöb alatt NINCS a listában (§I), helyette akcent-
keretes kártya áll: valódi példanévvel, a feltétel kimondásával és **haladás-sávval**
(„4 890 Ft / 7 000 Ft — 2 110 Ft hiányzik"), plusz egy gombbal, ami tényleg bekapcsolja a
hiányzó modulokat. ⛔ A hangsúly kerettel és tartalommal születik, NEM nagyobb betűvel.
Küszöb fölé érve a kártya helyét a valódi, választható opció-sor veszi át; visszaesésnél a
választás VISSZAVONÓDIK. Kontraktus: `assets/design-refs/configurator/domain-monthly/`
(plan.html + README + képek), a felület-kapun jóváhagyva.

**Impl.:** NYITOTT. Érintett: `migrations/` (pricing_config oszlop-átnevezés + seed),
`src/pricing.ts`, `src/payment/billing.ts` + `service.ts`, `src/generator/configurator.ts` +
`assets/runtime/cit-configurator.js`, `src/domains/domainUpgrade.ts` + `domainAdmin.ts` +
`domainSettlement.ts`, `src/console/views.ts` (/pricing feliratok), `src/legal.ts` (ÁSZF),
`scripts/domain-renewal-check.mts`. ⚠️ A konfigurátor „küszöb alatt nem választható" ÁLLAPOTA
ÚJ vevő-oldali viselkedés → §2b terv-jóváhagyási kapu alá esik (mock előbb, kód utána).
