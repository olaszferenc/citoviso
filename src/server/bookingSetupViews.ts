// "Foglalás beállítása" — the guided booking setup page (ADR-XXXX).
//
// Approved plan (the CONTRACT): assets/design-refs/tenant-admin/foglalas-kerdezz-felelek/
// (variant B, owner 2026-10-13): one page, six sections with a status pill each, one open
// at a time, "Mentés, tovább: <next>"; the Segítő chat in a sticky right column on a wide
// screen, behind a sticky bottom "Kérdezzen a Segítőtől" bar as a bottom sheet on a narrow
// one. The existing screens (Szobák · Árak · Online foglalás) stay, behind "Haladó beállítások".
//
// Server side renders the shell and every word (T(), ADR-0036); the client
// (assets/runtime/cit-booking-setup.js) draws the sections from the state JSON.

import { readFileSync } from "node:fs";
import { T } from "../i18n/mail.js";
import { jsonForScript } from "../text/jsonForScript.js";
import { icAdmin as ic } from "../ui/icons.js";
import { HELPER_MAX_QUESTION } from "../ai/bookingHelper.js";
import type { SetupMode, SetupState } from "../tenant/bookingSetup.js";

const BOOKING_SETUP_JS = readFileSync(new URL("../../assets/runtime/cit-booking-setup.js", import.meta.url), "utf8");
/** The one money rule the browser formats with (money-format-check ⑤: no second formatter). */
const MONEY_JS = readFileSync(new URL("../../assets/runtime/cit-money.js", import.meta.url), "utf8");

/** Where "Haladó beállítások" leads: the pre-existing screens, one per module. */
export interface SetupLinks {
  readonly rooms: string;
  readonly pricing: string;
  readonly booking: string;
}

/** The page's questions with the title the owner reads — the Segítő may only point at these. */
export function bookingSetupQuestions(lang: string, mode: SetupMode): { id: string; title: string }[] {
  return [
    { id: "mode", title: T(lang, "Hogyan adja ki a szállását?") },
    { id: "rooms", title: mode === "single" ? T(lang, "Hány vendég fér el?") : T(lang, "Melyek a kiadó szobái?") },
    { id: "unit", title: T(lang, "Mire szól az ára?") },
    { id: "base", title: T(lang, "Mennyi az ára egy átlagos éjszakára?") },
    { id: "seasons", title: T(lang, "Van olyan időszak, amikor más az ár?") },
    { id: "seasonal", title: T(lang, "Az időszakokon kívül is kiadja?") },
    { id: "stay", title: T(lang, "Hány éjszakára lehet foglalni?") },
    { id: "ahead", title: T(lang, "Mennyivel előre lehet foglalni?") },
    { id: "tax", title: T(lang, "Kér idegenforgalmi adót?") },
    { id: "includes", title: T(lang, "Mi van benne az árban?") },
    { id: "notify", title: T(lang, "Hová küldjük a foglalási kéréseket?") },
    { id: "check", title: T(lang, "Próbáljuk ki: így foglalna egy vendég") },
  ];
}

function strings(lang: string): Record<string, string> {
  const qs = Object.fromEntries(
    bookingSetupQuestions(lang, "rooms").map((q) => [`q_${q.id}`, q.title]),
  );
  return {
    ...qs,
    q_rooms_single: T(lang, "Hány vendég fér el?"),
    secRooms: T(lang, "Szállás és szobák"),
    secPrices: T(lang, "Árak"),
    secRules: T(lang, "Foglalás szabályai"),
    secGuest: T(lang, "Amit a vendég lát"),
    secNotify: T(lang, "Értesítés"),
    secCheck: T(lang, "Kipróbálás"),
    lead_mode: T(lang, "Ebből tudjuk, mit foglalhat le a vendég: az egész házat, egy-egy szobát, vagy mindkettőt."),
    lead_rooms: T(lang, "Írja be a szobák (apartmanok, házak) nevét, ahogy a vendég látni fogja."),
    lead_rooms_single: T(lang, "A férőhely a honlapon jelenik meg."),
    lead_unit: T(lang, "A honlap és a foglalási kérés ebből számolja a végösszeget."),
    lead_base: T(lang, "Ez az ár érvényes minden olyan napon, amelyre nem ad meg külön időszakot."),
    lead_seasons: T(lang, "Például főszezon nyáron, vagy ünnepek. Minden évben ugyanazokon a napokon érvényes."),
    lead_seasonal: T(lang, "Ha csak nyáron adja ki, a többi napra nem lehet foglalni."),
    lead_stay: T(lang, "A vendég ennél rövidebb vagy hosszabb foglalást nem tud elküldeni."),
    lead_ahead: T(lang, "Meddig nyúlik előre a foglalási naptár, és foglalhatnak-e akár mára is."),
    lead_tax: T(lang, "Az adót a vendég a helyszínen fizeti; a foglalásnál külön soron látja."),
    lead_includes: T(lang, "Egy rövid sor a végösszeg alatt. Ha nincs mit írni, hagyja üresen."),
    lead_notify: T(lang, "Ide érkezik minden foglalási kérés. A kérést a levélből fogadja el vagy utasítja el."),
    lead_check: T(lang, "Adjon meg egy kitalált foglalást — megmutatjuk, mit lát a vendég, és mi akadályozná. Semmit nem küldünk el."),
    modeSingle: T(lang, "Egyben, egy egységként"),
    modeSingleSub: T(lang, "Egy ház vagy apartman, egyszerre egy vendégkör."),
    modeRooms: T(lang, "Szobánként"),
    modeRoomsSub: T(lang, "Több szoba vagy apartman, külön-külön foglalható."),
    modeBoth: T(lang, "Szobánként és egyben is"),
    modeBothLong: T(lang, "Szobánként, és egyben is"),
    modeBothSub: T(lang, "A szobák külön is, a ház egyben is foglalható. Ha egy szoba foglalt, az egész ház arra a napra nem foglalható — és fordítva."),
    modeHint: T(lang, "Csak egyben adja ki, de a szobákat szeretné bemutatni? Válassza az elsőt — a szobákat a Szobák menüben bemutathatja."),
    wholeName: T(lang, "A szállás egésze"),
    roomName: T(lang, "{n}. szoba neve"),
    roomNamePh: T(lang, "Pl. Kertre néző apartman"),
    capLabel: T(lang, "Férőhely (fő)"),
    cancelRoom: T(lang, "Mégse"),
    addRoom: T(lang, "+ Újabb szoba"),
    deleteRoomHint: T(lang, "Szobát törölni a Szobák képernyőn lehet — ott látja, mi tűnik el vele."),
    advRooms: T(lang, "Szobák"),
    advPricing: T(lang, "Árak és időszakok"),
    adv_rooms: T(lang, "Haladó beállítások › Szobák"),
    adv_pricing: T(lang, "Haladó beállítások › Árak és időszakok"),
    adv_booking: T(lang, "Haladó beállítások › Online foglalás"),
    nPersons: T(lang, "{n} fő"),
    capMissing: T(lang, "férőhely nincs megadva"),
    unnamed: T(lang, "Névtelen szoba"),
    unitNight: T(lang, "éjszakánként"),
    unitPerson: T(lang, "fő / éjszaka"),
    unitStay: T(lang, "a teljes tartózkodásra"),
    unitNightOpt: T(lang, "Éjszakánként"),
    unitNightSub: T(lang, "Pl. 19 000 Ft egy éjszakára, akárhányan vannak."),
    unitPersonOpt: T(lang, "Fejenként, éjszakánként"),
    unitPersonSub: T(lang, "Pl. 6 000 Ft / fő / éj — 2 fő 3 éjre 36 000 Ft."),
    unitStayOpt: T(lang, "A teljes tartózkodásra"),
    unitStaySub: T(lang, "Egy összeg, akárhány éjszaka. Az érkezés napjának ára számít."),
    currency: T(lang, "Pénznem"),
    curHuf: T(lang, "forint"),
    curEur: T(lang, "euró"),
    curHufOpt: T(lang, "forint (Ft)"),
    curEurOpt: T(lang, "euró (€)"),
    priceLabel: T(lang, "Ár ({unit})"),
    pricePh: T(lang, "Pl. 19 000"),
    porLabel: T(lang, "Nem adok meg árat — a vendég ajánlatot kér, és én küldök árat"),
    porShort: T(lang, "ajánlatot küld"),
    errBase: T(lang, "Minden szobánál adjon meg árat, vagy jelölje, hogy ajánlatot küld."),
    errUnit: T(lang, "Válassza ki, mire szól az ára."),
    noSeasonUnit: T(lang, "Nincs külön időszak — egész évben az alapár: {price}."),
    nSeasons: T(lang, "{n} időszak"),
    noSeasons: T(lang, "nincs, egész évben az alapár"),
    wraps: T(lang, "(átnyúlik az újévre)"),
    minN: T(lang, "legalább {n} éj"),
    del: T(lang, "törlés"),
    delSeasonConfirm: T(lang, "Biztosan törli ezt az időszakot? Az ára is törlődik."),
    otherRows: T(lang, "+ {n} évhez kötött vagy dátumos ár — ezeket az Árak képernyőn látja és szerkeszti:"),
    newSeason: T(lang, "+ Új időszak"),
    seasonName: T(lang, "Neve"),
    seasonNamePh: T(lang, "Pl. Főszezon"),
    from: T(lang, "Mettől"),
    to: T(lang, "Meddig"),
    price: T(lang, "Ár"),
    minLabel: T(lang, "Legalább (éj)"),
    optional: T(lang, "nem kötelező"),
    mdHint: T(lang, "Hónap-nap, például 06-15. Évet nem kell írni: minden évben ismétlődik."),
    add: T(lang, "Hozzáadom"),
    addAll: T(lang, "Minden szobához hozzáadom"),
    saveRoomsFirst: T(lang, "Előbb mentse a szobákat — utána adhat meg időszakot."),
    seasonAdded: T(lang, "Az időszak elmentve."),
    seasonDeleted: T(lang, "Az időszak törölve."),
    allYear: T(lang, "Igen, egész évben"),
    allYearSub: T(lang, "Az időszakokon kívül az alapár érvényes."),
    seasonalOnly: T(lang, "Nem, csak a felsorolt időszakokban"),
    seasonalOnlySub: T(lang, "A többi napra nem lehet foglalni."),
    allYearShort: T(lang, "Egész évben"),
    seasonalOnlyShort: T(lang, "Csak az időszakokban"),
    seasonalMixed: T(lang, "szobánként eltér"),
    seasonalMixedHint: T(lang, "Most szobánként eltér. Ha itt választ, minden szobára ugyanaz lesz."),
    minNights: T(lang, "Legalább (éjszaka)"),
    maxNights: T(lang, "Legfeljebb (éjszaka)"),
    stayHint: T(lang, "Ahol egy időszakhoz külön „legalább” értéket adott, ott az érvényes."),
    errMin: T(lang, "A legrövidebb foglalás 1 és 30 éj között lehet."),
    errMax: T(lang, "A leghosszabb foglalás 1 és 365 éj között lehet."),
    errMinMax: T(lang, "A legrövidebb foglalás nem lehet hosszabb, mint a leghosszabb."),
    stayLine: T(lang, "{min}–{max} éj"),
    horizon: T(lang, "Legfeljebb ennyi hónappal előre"),
    lead: T(lang, "Legkorábban ennyi nap múlva érkezhet"),
    leadHint: T(lang, "0 nap = akár mára is foglalhatnak."),
    aheadLine: T(lang, "legfeljebb {h} hónappal előre"),
    leadLine: T(lang, "legkorábban {n} nap múlva"),
    leadToday: T(lang, "akár mára is"),
    taxYes: T(lang, "Igen"),
    taxYesSub: T(lang, "Megadom, mennyi fejenként, éjszakánként."),
    taxNone: T(lang, "Nincs idegenforgalmi adó"),
    taxNoneSub: T(lang, "A vendég nem lát adó-sort."),
    taxUnknown: T(lang, "Még nem tudom"),
    taxUnknownSub: T(lang, "Később pótolhatja; addig csak annyit írunk, hogy a helyszínen fizetendő — összeget nem."),
    taxAmount: T(lang, "Összeg (Ft / fő / éj)"),
    taxHint: T(lang, "Az önkormányzat honlapján, vagy a helyi adóügyön tudják."),
    taxNoneShort: T(lang, "Nincs"),
    taxUnknownShort: T(lang, "Még nem tudja"),
    taxLine: T(lang, "{amount} / fő / éj, a helyszínen"),
    includesPh: T(lang, "Pl. Az ár tartalmazza a reggelit."),
    includesEmpty: T(lang, "nem írt semmit"),
    notifyLabel: T(lang, "E-mail cím (több is lehet, vesszővel)"),
    notifyHint: T(lang, "Ha üresen hagyja, a fiókja címére küldjük: {email}"),
    errEmail: T(lang, "Ez nem tűnik e-mail címnek: {list}"),
    expiryLabel: T(lang, "Ha nem válaszol, ennyi óra után magától lejár a kérés"),
    expiryHint: T(lang, "0 = soha nem jár le. A vendég ekkor értesítést kap."),
    expiryLine: T(lang, "{n} óra után lejár"),
    expiryNever: T(lang, "nem jár le"),
    fix: T(lang, "Javítom"),
    noBlockers: T(lang, "Nem találtunk akadályt: a vendégek foglalhatnak."),
    nTodo: T(lang, "{n} teendő"),
    allGood: T(lang, "rendben"),
    trialUnit: T(lang, "Szoba"),
    arrive: T(lang, "Érkezés"),
    nights: T(lang, "Éjszaka"),
    guests: T(lang, "Vendég"),
    trialNoUnit: T(lang, "Előbb mentse a szobákat — utána kipróbálhatja."),
    trialBlocked: T(lang, "A vendég ezt látja, és nem tudja elküldeni:"),
    trialNoTotal: T(lang, "Elküldhető, de végösszeg nélkül."),
    trialNoTotalSub: T(lang, "Nem minden éjszakának van ára, ezért a vendég ajánlatot kér; Ön a levélből küld árat."),
    trialOk: T(lang, "Elküldhető."),
    trialSees: T(lang, "A vendég ezt látja:"),
    stayCost: T(lang, "Szállás:"),
    trialMail: T(lang, "A kérésről e-mailt kap ({email}), és a levélből elfogadja vagy elutasítja."),
    nBlockers: T(lang, "{n} akadály"),
    nMissing: T(lang, "{n} kérdés hiányzik"),
    notFilled: T(lang, "Még nincs kitöltve"),
    done: T(lang, "Kész"),
    progress: T(lang, "{done} / {all} rész kész"),
    progressBlocked: T(lang, "{n} dolog miatt a vendég nem, vagy nem jól tud foglalni"),
    progressOk: T(lang, "a vendégek foglalhatnak"),
    saveNext: T(lang, "Mentés, tovább: {next}"),
    finish: T(lang, "Kész — a vendégek foglalhatnak"),
    saved: T(lang, "Elmentve."),
    errSave: T(lang, "A mentés nem sikerült, semmi nem változott. Próbálja újra, vagy írjon nekünk."),
    thinking: T(lang, "Gondolkodom…"),
    chatHello: T(lang, "Jó napot! Kérdezzen bármit a foglalás beállításáról — elmagyarázom, és megmutatom, hol adhatja meg. Az adatokat Ön írja be, én nem módosítok semmit."),
    chatError: T(lang, "Most nem tudok válaszolni. Próbálja újra kicsit később, vagy nézze meg a Súgót."),
    showWhere: T(lang, "Mutasd, hol adom meg: {q}"),
  };
}

/** The suggested questions under the chat, per question in focus (the plan's chips). */
function chips(lang: string): Record<string, string[]> {
  return {
    mode: [T(lang, "Mi a különbség?"), T(lang, "Booking-naptár?")],
    rooms: [T(lang, "Ellenőrzi a férőhelyet?"), T(lang, "Gyerekár?")],
    unit: [T(lang, "Mire szól az ár?"), T(lang, "Mi a teljes tartózkodás?")],
    base: [T(lang, "Mi az alapár?"), T(lang, "Mi van, ha nem adok árat?")],
    seasons: [T(lang, "Mi az időszak?"), T(lang, "Átnyúlhat újévre?")],
    seasonal: [T(lang, "Mi van az időszakon kívül?")],
    stay: [T(lang, "Mi a minimum éjszaka?")],
    ahead: [T(lang, "Foglalhatnak mára is?")],
    tax: [T(lang, "Mennyi az IFA?"), T(lang, "Benne van az árban?")],
    includes: [T(lang, "Mit írjak ide?")],
    notify: [T(lang, "Mi van, ha nem válaszolok?")],
    check: [T(lang, "Kérnek előleget?"), T(lang, "Lemondás?")],
  };
}

const BS_STYLE = `<style>
.bs{container-type:inline-size;--bs-sticky-bottom:calc(var(--citui-admin-bottomnav-h,0px) + var(--citui-consent-h,0px))}
.bs-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.bs-top .bs-sp{flex:1}
.bs-adv{position:relative}
.bs-adv summary{cursor:pointer;color:var(--citui-link-ink);text-decoration:underline;font-size:.95em;list-style:none}
.bs-adv summary::-webkit-details-marker{display:none}
.bs-adv__menu{position:absolute;right:0;top:calc(100% + 6px);z-index:40;min-width:240px;background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:8px;box-shadow:var(--citui-shadow-md);padding:6px;display:grid}
.bs-adv__menu a{padding:9px 10px;border-radius:6px;text-decoration:none;color:var(--citui-ink)}
.bs-adv__menu a:hover{background:var(--citui-hover)}
.bs-adv__menu small{display:block;color:var(--citui-muted);font-size:.82em}
.bs-h1{font-family:var(--citui-font-display);font-size:24px;line-height:1.2;margin:0 0 2px}
.bs-progress{color:var(--citui-muted);margin:0}
.bs-head{margin-bottom:12px}
.bs-head .mcfg-help{margin:6px 0 0}
.bs-sec{border:1px solid var(--citui-line);border-radius:8px;background:var(--citui-panel);margin-bottom:10px;scroll-margin-top:72px}
.bs-sec.is-open{border-color:var(--citui-line-strong);box-shadow:var(--citui-shadow-sm)}
.bs-sh{display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:none;border:0;padding:14px;cursor:pointer;color:inherit;font:inherit;min-height:44px}
.bs-num{width:28px;height:28px;border-radius:50%;background:var(--citui-surface-2);display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex:none}
.bs-sec.is-open .bs-num{background:var(--citui-cyan-500);color:var(--citui-accent-ink)}
.bs-st{flex:1;min-width:0}
.bs-st b{display:block;font-family:var(--citui-font-display);font-size:16px}
.bs-st small{display:block;color:var(--citui-muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-body{padding:0 14px 14px}
.bs-q{padding:14px 0;border-top:1px solid var(--citui-line);border-radius:6px}
.bs-qt{font-family:var(--citui-font-display);font-size:18px;line-height:1.25;margin:0 0 6px}
.bs-lead{color:var(--citui-muted);margin:0 0 12px}
.bs-foot{padding-top:12px;border-top:1px solid var(--citui-line);display:flex;justify-content:flex-end}
.bs-opts{display:grid;gap:8px}
.bs-opt{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1px solid var(--citui-line-strong);border-radius:8px;background:var(--citui-panel);cursor:pointer;text-align:left;width:100%;color:inherit;font:inherit}
.bs-opt:hover{background:var(--citui-hover)}
.bs-opt[aria-checked=true]{border-color:var(--citui-cyan-500);background:var(--citui-accent-soft)}
.bs-dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--citui-line-strong);margin-top:2px;flex:none}
.bs-opt[aria-checked=true] .bs-dot{border-color:var(--citui-cyan-500);box-shadow:inset 0 0 0 4px var(--citui-panel);background:var(--citui-cyan-500)}
.bs-opt small{display:block;color:var(--citui-muted)}
.bs-f{display:block;margin:10px 0 4px;font-weight:600;font-size:14px}
.bs-inp{width:100%;padding:10px 12px;border:1px solid var(--citui-line-strong);border-radius:8px;background:var(--citui-field);color:inherit;font:inherit}
.bs-inp:focus{outline:2px solid var(--citui-cyan-500);outline-offset:1px}
.bs-inp.is-bad{border-color:var(--citui-bad)}
.bs-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.bs-row>*{flex:1 1 110px}
.bs-row>.bs-row__tight{flex:0 0 auto}
.bs-row--acts{margin-top:8px}
.bs-hint{color:var(--citui-muted);font-size:13px;margin:6px 0 0}
.bs-err{color:var(--citui-bad-ink);font-size:13px;margin:6px 0 0}
.bs-check{display:flex;gap:8px;align-items:flex-start;margin-top:8px;color:var(--citui-muted);font-size:13px}
.bs-warnbox,.bs-okbox,.bs-infobox{border-radius:8px;padding:10px 12px;margin:10px 0 0;font-size:14px}
.bs-warnbox{background:color-mix(in srgb,var(--citui-warn) 14%,var(--citui-panel));color:var(--citui-warn-ink)}
.bs-okbox{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.bs-infobox{background:var(--citui-surface-2)}
.bs-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;min-height:44px;border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line-strong);background:var(--citui-panel);color:var(--citui-ink);cursor:pointer;font:inherit;font-weight:600;text-decoration:none}
.bs-btn--pri{background:var(--citui-cyan-500);border-color:var(--citui-cyan-500);color:var(--citui-accent-ink)}
.bs-btn--sm{padding:6px 12px;min-height:36px;font-size:13px}
.bs-btn:disabled{opacity:.45;cursor:not-allowed}
.bs-link{background:none;border:0;padding:0;color:var(--citui-link-ink);text-decoration:underline;cursor:pointer;font:inherit;font-size:14px}
.bs-unit{border:1px solid var(--citui-line);border-radius:8px;padding:10px 12px;margin:8px 0;background:var(--citui-panel)}
.bs-uh{margin:0 0 4px;font-size:15px}
.bs-unit details summary{margin-top:6px;list-style:none;display:inline-block}
.bs-season{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px dashed var(--citui-line);font-size:14px}
.bs-season:first-of-type{border-top:0}
.bs-pill{display:inline-block;padding:2px 9px;border-radius:var(--citui-radius-pill);font-size:12px;font-weight:600;background:var(--citui-surface-2);color:var(--citui-muted);flex:none}
.bs-pill--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.bs-pill--warn{background:color-mix(in srgb,var(--citui-warn) 16%,var(--citui-panel));color:var(--citui-warn-ink)}
.bs-pill--bad{background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-panel));color:var(--citui-bad-ink)}
.bs-flash{animation:bs-flash 1.6s ease}
@keyframes bs-flash{0%,40%{box-shadow:0 0 0 4px color-mix(in srgb,var(--citui-cyan-500) 45%,transparent)}100%{box-shadow:0 0 0 0 transparent}}
.bs-trial{margin-top:12px}
.bs-res{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--citui-surface-2);font-size:14px}
.bs-res.is-bad{background:color-mix(in srgb,var(--citui-bad) 10%,var(--citui-panel));color:var(--citui-bad-ink)}
.bs-toast{position:fixed;left:50%;bottom:calc(18px + var(--citui-admin-bottomnav-h,0px) + var(--citui-consent-h,0px));transform:translateX(-50%);z-index:90;background:var(--citui-ink);color:var(--citui-bg);padding:10px 16px;border-radius:8px;font-size:14px;max-width:90%;box-shadow:var(--citui-shadow-md)}
.bs-chat{display:none;flex-direction:column;background:var(--citui-panel);min-height:0}
.bs-chat__head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--citui-line)}
.bs-chat__head b{font-family:var(--citui-font-display)}
.bs-chat__head small{color:var(--citui-muted);display:block;font-size:12px;line-height:1.3}
.bs-chat__head .bs-sp{flex:1}
.bs-chat__close{display:none}
.bs-chat__log{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-height:120px}
.bs-msg{max-width:88%;padding:9px 12px;border-radius:14px;font-size:14px;white-space:pre-wrap}
.bs-msg--me{align-self:flex-end;background:var(--citui-navy-800);color:var(--citui-ink-inverse);border-bottom-right-radius:4px}
.bs-msg--ai{align-self:flex-start;background:var(--citui-surface-2);border-bottom-left-radius:4px}
.bs-typing{opacity:.6;font-style:italic}
.bs-go{margin-top:8px;display:flex;white-space:normal;text-align:left}
.bs-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}
.bs-chip{border:1px solid var(--citui-line-strong);background:var(--citui-panel);color:inherit;border-radius:var(--citui-radius-pill);padding:5px 11px;font:inherit;font-size:13px;cursor:pointer}
.bs-chip:hover{background:var(--citui-hover)}
.bs-chat__form{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--citui-line)}
.bs-chat__form .bs-inp{flex:1}
.bs-chat__foot{padding:0 14px 10px;color:var(--citui-muted);font-size:12px;margin:0}
.bs-chat.is-sheet{position:fixed;bottom:var(--bs-sticky-bottom);left:50%;transform:translateX(-50%);width:min(560px,100vw);height:min(78vh,calc(100vh - var(--bs-sticky-bottom) - 48px));z-index:95;border-radius:18px 18px 0 0;box-shadow:var(--citui-shadow-md)}
.bs-chat.is-sheet.is-open{display:flex}
.bs-chat.is-sheet .bs-chat__close{display:inline-flex}
.bs-scrim{position:fixed;inset:0;background:color-mix(in srgb,var(--citui-navy-950) 40%,transparent);z-index:92;display:none}
.bs-scrim.is-open{display:block}
.bs-askbar{position:sticky;bottom:var(--bs-sticky-bottom);z-index:30;padding:10px 0;background:var(--citui-bg);border-top:1px solid var(--citui-line)}
.bs-askbar .bs-btn{width:100%}
@container (min-width: 900px){
  .bs-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start}
  .bs-main{grid-column:1;grid-row:1;min-width:0}
  .bs-chat{grid-column:2;grid-row:1;display:flex;border:1px solid var(--citui-line);border-radius:8px;position:sticky;top:64px;height:calc(100vh - 88px - var(--citui-consent-h,0px));max-height:760px}
  .bs-askbar{display:none}
  .bs-st small{white-space:normal}
}
</style>`;

export function bookingSetupPage(o: {
  readonly lang: string;
  readonly state: SetupState;
  readonly links: SetupLinks;
  readonly backUrl: string;
  readonly today: string;
}): string {
  const { lang } = o;
  const data = {
    lang,
    L: strings(lang),
    state: o.state,
    adv: o.links,
    chips: chips(lang),
    today: o.today,
    doneUrl: o.backUrl,
    maxQuestion: HELPER_MAX_QUESTION,
  };
  return (
    BS_STYLE +
    `<div class="bs" data-bs>` +
    `<div class="bs-top"><a class="mcfg-back" href="${o.backUrl}">${ic("back", 16)} ${T(lang, "Online foglalás")}</a><span class="bs-sp"></span>` +
    `<details class="bs-adv"><summary>${T(lang, "Haladó beállítások")}</summary><div class="bs-adv__menu">` +
    `<a href="${o.links.rooms}">${T(lang, "Szobák")}<small>${T(lang, "fotók, leírás, felszereltség, szoba törlése")}</small></a>` +
    `<a href="${o.links.pricing}">${T(lang, "Árak és időszakok")}<small>${T(lang, "évhez kötött ár, időszakok sorrendje")}</small></a>` +
    `<a href="${o.links.booking}">${T(lang, "Online foglalás")}<small>${T(lang, "naptár, más oldalak naptára, a mai űrlap")}</small></a>` +
    `</div></details></div>` +
    `<div class="bs-grid"><main class="bs-main"><div class="bs-head"><h1 class="bs-h1">${T(lang, "Foglalás beállítása")}</h1>` +
    `<p class="bs-progress"></p>` +
    `<p class="mcfg-help"><a data-kb-anchor="admin.booking.setup" href="/admin?tab=sugo&amp;topic=admin.booking.setup">${ic("help", 16)}<span>${T(lang, "Útmutató ehhez a képernyőhöz")}</span></a></p>` +
    `</div><div class="bs-list"></div></main>` +
    `<div class="bs-askbar"><button type="button" class="bs-btn" data-ask>${ic("sms", 18)}${T(lang, "Kérdezzen a Segítőtől")}</button></div>` +
    `<aside class="bs-chat" aria-label="${T(lang, "Segítő")}"><div class="bs-chat__head">${ic("sms", 20)}` +
    `<div><b>${T(lang, "Segítő")}</b><small>${T(lang, "Csak a foglalás beállításáról · nem ír be semmit")}</small></div><span class="bs-sp"></span>` +
    `<button type="button" class="bs-link bs-chat__close" aria-label="${T(lang, "Bezárás")}">${ic("close", 20)}</button></div>` +
    `<div class="bs-chat__log" aria-live="polite"></div><div class="bs-chips"></div>` +
    `<form class="bs-chat__form"><input class="bs-inp" maxlength="${HELPER_MAX_QUESTION}" placeholder="${T(lang, "Kérdezzen…")}" aria-label="${T(lang, "Kérdés")}">` +
    `<button class="bs-btn bs-btn--pri bs-btn--sm" type="submit">${T(lang, "Küld")}</button></form>` +
    `<p class="bs-chat__foot">${T(lang, "A válaszokat mesterséges intelligencia írja. Az adatokat Ön adja meg — a Segítő nem módosít semmit.")}</p>` +
    `</aside></div><div class="bs-scrim"></div></div>` +
    `<script type="application/json" data-bs-data>${jsonForScript(data)}</script>` +
    `<script>${MONEY_JS}</script><script>${BOOKING_SETUP_JS}</script>`
  );
}
