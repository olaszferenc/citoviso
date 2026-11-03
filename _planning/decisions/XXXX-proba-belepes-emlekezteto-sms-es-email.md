## ADR-XXXX — Próbázó belépés-emlékeztető: induló SMS + 2./4./6./8. napi e-mail és SMS

**Dátum:** 2026-11-03 · **Döntött:** a tulaj („mehet”, a szöveggel és az ütemezéssel együtt) · **Kapcsolódik:** ADR-0344 (próba-levelek), ADR-0303 (jelszó-link, nincs jelszó a levélben), ADR-0334 (hétköznap 9–16 ablak)

### Mi a helyzet
Élesen mérve 2026-11-03: a két futó próbázó (Sáma 10-28, Marilyn 11-02) megkapta a belépő levelet, de
egyikük sem kattintott a jelszó-linkre (`login_token.used_at` üres, nginx-ben nincs `/login/jelszo` hívásuk),
egyikük sem lépett be. Mindkettőt MMS+SMS-sel értük el (telefon-első szállásadók), a belépés viszont CSAK
e-mailben ment, emlékeztető nem volt, és az első link 7 nap után lejár.

### Döntés
Amíg a próbázó nem állít be jelszót (`tenant_user.password_set_at` / `last_login_at` üres):
- **l0 — induló SMS** a belépő levél mellé, azonnal (a saját űrlap-beküldésére válasz, nem ablakhoz kötött):
  „Citoviso: elindult a {site} ingyenes probaja. Jelszo beallitasa es belepes: {link} Felhasznalonev: {user}”
- **l2/l4/l6/l8 — e-mail + SMS** a próba 2., 4., 6., 8. napján (1. nap = az indulás napja), hétköznap 9–16;
  hétvége után csak a legmagasabb esedékes megy, a kimaradt kihagyva; a T−3 napjára vagy utána eső nem megy
  (onnan a T−3/T−1 beszél).
  - SMS: „Citoviso: meg nem lepett be a {site} honlapjaba, a probabol meg {n} nap van. Jelszo beallitasa egy kattintassal: {link}”
  - E-mail, tárgy „Még nem lépett be – {site}”: „{Art} {site} honlapja már él, de még nem lépett be a
    szerkesztőbe. A próbából még {n} nap van, {dátum}-ig.” · [Jelszó beállítása] (új link, 7 napig érvényes) ·
    felhasználónév + belépési cím · „Ha elakadt, hívjon minket: {LEGAL_ENTITY_PHONE}.”
- **Minden üzenet FRISS egyszer használható linket visz** — a lejárt első link nem hagyhatja el a próbázót.
- Napló: `free_trial_notice` (lépcső `l0`/`l2`/`l4`/`l6`/`l8`, csatornánként egy sor, küldés ELŐTT foglalva),
  a tenant postafiókjába token nélkül.

### Megvalósítás
`src/trial/loginReminders.ts` · `src/email/loginEmail.ts` (`buildLoginReminderEmail`, `buildLoginStartSmsText`,
`buildLoginReminderSmsText`) · `src/trial/start.ts` (induló SMS) · `scripts/offer-followup.mts` (óránkénti tick) ·
`migrations/0121_free_trial_login_reminder.sql` · őr: `scripts/trial-login-reminder-check.mts`.
