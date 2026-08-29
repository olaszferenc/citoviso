# 2026-08-28/29 — ADR-0080 előfizetés-motor: teljes gerinc (①–⑥)

**Kiváltó (tulaj):** „ha a tenant fel- és leiratkozik egy modulról, instant kell fizetni —
nincs szinkronban a meglévő modulok ciklusával… nincs semmi beállítva a fizetési ciklusra…
leiratkozás sincs kezelve." Mérés igazolta: nem három hiba, hanem EGY hiányzó réteg — minden
fizetés egyszeri volt, a `runBillingCycle` order-szintű csontváz értesítés nélkül, a
`suspended` site néma 404.

## Döntések (ADR-0080, 3 kérdéses tulaj-kör + 1 later rendelet)

1. **Tenantonként EGY fordulónap** (anchor = első fizetés) — havi EGY közös számla.
2. **B-opció:** modul-felvétel azonnal él, első díj a köv. számlán (nincs fillérszámla);
   lemondás a fordulón érvényesül (ki van fizetve), addig visszakapcsolható.
3. **Auto-terhelés elsődleges** (Barion token) + díjbekérő fallback; dunning T−3…T+30,
   T+10 freeze (503, nem 404), fizetés = automata thaw.
4. **SMS igen, a gépi GSM-modulról** — később rendelet: a modul SOHA nem költözik a
   Hetznerre; hívható szolgáltatásként marad itt (queue → relay → gammu).

## Elkészült (minden landolva, fő fa frissítve)

- **0039/0040/0041:** subscription + dunning_event + renewal-kind + modul-flagek +
  recurrence_trace_id + sms_outbox. Backfill: anchor az első fizetett paymentből,
  visszamenőleges tartozás-termelés nélkül.
- **Motor:** `src/payment/billing.ts` teljes újraírás (tenant-anchor, létra, token-először);
  `subscription.ts` (születés/rendezés/lezárás — minden pénz-átmenet egy ajtón);
  webhook `renewal` ág; `citoviso-billing.timer` (napi 07:00, telepítve).
- **Levelek/SMS:** `billingEmail.ts` (6 lépcső, T()-vel; token-subnál az előértesítő
  auto-levonást ígér); `sms/sender.ts` (mock|gammu|queue) + `injectViaGammu` közös mag.
- **Tenant-admin (§2b kapun át, B terv jóváhagyva):** előfizetés-kártya + tervsáv
  azonnali díj-deltával + megerősítés; lemondás-jelvények; veszély-zóna; KB frissítve +
  új `admin-subscription` entry. Kontraktus: `assets/design-refs/console/modules-billing/`.
- **Barion token:** 3DS-alak sandboxon igazolva (UpgradeTo3DS → RecurrenceType+Challenge;
  MIT: TraceId + GuestCheckOut/RedirectUrl; InvalidRecurrenceId tisztán failed).
  Crash-önjavítás: fizetett ciklus nem terhelődik újra; elakadt pending MIT 24h után zárul.
- **SMS-relay:** pull/ack API (bearer, constant-time, secret nélkül 404) + percenkénti
  relay-timer; queue→telefon kör igazolva. SIM mérve: 0 üzenet (a smsd DB-be ment + töröl).

## Leletek, tanulságok

- ⛔ **A lemondott modult a paid-unió feltámasztotta volna** — az explicit lemondás
  (cancelled_at sírkő) erősebb kell legyen a történelmi fizetésnél.
- ⛔ **A B-opciós modult a paid-sync visszavonta volna** — a „jogosan aktív, még nem
  fizetett" állapotnak explicit flag kell (awaiting_first_charge), nem hallgatólagos tudás.
- ⛔ **A billingEmail lemaradt az I18N_SOURCES-ról** — a kézi forrás-lista hibaosztálya
  megint (ADR-0070 ② továbbra is nyitott: származtatott lista kell).
- ⛔ **Renewal-order vevő nélkül = kihagyott számla** — a vevő-blokk a partner-törzsből
  öröklődik; nyilatkozat nélkül hangos kézi-számla jelzés (vevőt nem fabrikálunk).
- **Iker-ADR:** két ADR-0079 született párhuzamos szálakon → rebase-konfliktusból derült
  ki; a miénk ADR-0080. A szabály (fetch+ellenőrzés írás előtt) élt, a párhuzamos szál
  ugyanabban az órában számozott.
- ⚠️ 4 valódi teszt-dunning-levél kiment a tulaj címeire (EMAIL_PROVIDER=smtp) — jelezve.

## Nyitott

- **Tulaj-teszt** (másik session fejlesztéseivel együtt): A) Modulok-fül kör; B) sandbox
  kártyás vásárlás (3DS!) → token → fordulónap-tekeréssel auto-terhelés; C) dunning-létra
  léptetéssel (SMS a telefonra, 503, thaw).
- Éves periódus élesben nem tesztelt; kártyás happy-path a teszt-körben zárul.
- ⚠️ A Tihany teszt-tenant 2026-09-25-én valódi előértesítőt küld, ha bent marad.
- Élesítéskor: prod .env → SMS_PROVIDER=queue + SMS_RELAY_URL/SECRET; a relay-timer itt fut.

## Fő fájlok

`migrations/0039..0041` · `src/payment/{billing,subscription,service,gateway,barion,mock}.ts` ·
`src/email/billingEmail.ts` · `src/sms/sender.ts` · `src/tenant/{moduleChange,subscriptionAdmin,modules,paidEntitlements}.ts` ·
`src/server/{public,adminViews}.ts` · `scripts/{billing-cycle.ts,sms-relay.mts,module-upsell-check.mts}` ·
`deploy/systemd/citoviso-{billing,sms-relay}.*` · `kb/entries/admin-subscription/` ·
`assets/design-refs/console/modules-billing/`
