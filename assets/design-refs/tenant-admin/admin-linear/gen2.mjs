// Round 2 — FOUR radically different admin languages. Nothing of today's admin survives
// except the logo mark. Shared: real data + the photo engine (same rules as /admin/photos).
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = "/home/citoviso/wt/citd2e5a7ba/assets/design-refs/_drafts";
mkdirSync(OUT, { recursive: true });

const PHOTOS = [
  ["https://lh3.googleusercontent.com/place-photos/AG9NLjC-fAbiXFwyrM1R-AqgVvUYlmct9kzww_TyDMBOw_KaGuJLQAtzy50V8WJY7BU0IDf5ZtWsCO0P_TjYkcCxEnecc9ztLcLFiQ3CAixQffk3R6VtWRuVYiD6SbMfvz0u4nX1zAcE7xXqSOLgkA=s4800-w1200", "Boróka ház — 1. kép"],
  ["https://lh3.googleusercontent.com/place-photos/AG9NLjDUkLaZ-HNelolfgknRcvlasVWyfvVdhDpSn1N93u0nlvdo4BwpANqCXIK0vkYkKCe0PePKTNrKWLv9hZnyV3UJO2WPmcRu967OQnoCtWB46g-LgPoNpdUw8BNqdzOqXy5VVpvUm10nTVIKkDs=s4800-w1200", "Boróka ház — 2. kép"],
  ["https://hovamenjek.hu/upload/places/25890_fbba25691bea73e74b93b6f510b74033/main/siofok-2.jpg", "Boróka ház — 3. kép"],
  ["https://hovamenjek.hu/upload/places/25890_fbba25691bea73e74b93b6f510b74033/galleryMiddle/siofok-6.jpg", "Boróka Vendégház – Siófok fotó 4"],
  ["https://lh3.googleusercontent.com/place-photos/AG9NLjBjJzNrRdYmnnOBnP3fS-LQzd6BzTHbMs3i020nogMvObRTeMKiWH23E1Zu2b-GXofjbQ90OHBzTjv5EP7v3fPQ2QrI-0OFibUiyUS2Wb-d-K9NH1bKh-JkwQxcJf22XdUKTBVm_VthaGXwng=s4800-w1200", "Boróka ház — 5. kép"],
  ["https://hovamenjek.hu/upload/places/25890_fbba25691bea73e74b93b6f510b74033/galleryMiddle/siofok-5.jpg", "Boróka Vendégház – Siófok fotó 3"],
  ["https://hovamenjek.hu/upload/places/25890_fbba25691bea73e74b93b6f510b74033/galleryMiddle/siofok-7.jpg", "Boróka Vendégház – Siófok fotó 5"],
  ["https://lh3.googleusercontent.com/place-photos/AG9NLjAY5nDMNGqWJq611E2t0F8ZDCrtyFgc6YOgfwiwPd5UeegbKffpXhP0X_CEHErrAJqFcqGxVBQdXXupmZ37tG6OXBr8P9tkrhPRZfQn8IXtI4aYcd8A5_ALqoA_HZTH1xk_nVWFCtWsHzEq_R8=s4800-w1200", "Boróka ház — 8. kép"],
  ["https://pic.szallaskeres.hu/sz%C3%A1ll%C3%A1s-bor%C3%B3ka-h%C3%A1z--190487.jpg", "Boróka ház — 9. kép"],
  ["https://apartman.hu/wp-content/uploads/2023/02/37904203.jpg", "Boróka ház — 10. kép"],
  ["https://apartman.hu/wp-content/uploads/2023/02/37867513.jpg", "Boróka ház — 11. kép"],
  ["https://apartman.hu/wp-content/uploads/2023/02/37867511.jpg", "Boróka ház — 12. kép"],
  ["https://apartman.hu/wp-content/uploads/2023/02/36713092.jpg", "Boróka ház — 13. kép"],
  ["https://lh3.googleusercontent.com/place-photos/AG9NLjANM4LHAnS9uu6XXtaV-_0K4dijives8WF8ydCRhfEo-zgnDwLRmV2wuBaFNzbxTVaSHd4X4sHCusr-1kraesYsWG-8IqEOzaOLmabeVr67pfrcZ0h4QWmSrIBPYgCTYfezEwp5hPTSkmgX=s4800-w1200", "Boróka ház — 14. kép"],
  ["https://lh3.googleusercontent.com/place-photos/AG9NLjDKz3k01iHKcbh8A7Qm_72EOrft_wjsPqPqO8hj__m-mYo8JgFQT-MfTOjcB-eWt7C4v_CTcOL6rFUbxKzkpLDUOWtFTZ1T61VsMBFNkQknqYSj2BdYL1XBga0Hf35M-xxx6dsTPYXRFpC3kw=s4800-w1200", "Boróka ház — 15. kép"],
  ["https://apartman.hu/wp-content/uploads/2023/02/37867514.jpg", "Boróka ház — 16. kép"],
];

// Lucide-style thin icons (1.6 stroke, 24 box) — the industry's current default language.
const ICON = {
  home: `<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>`,
  texts: `<path d="M4 6h16M4 12h10M4 18h14"/>`,
  photos: `<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-4.5L8 19"/>`,
  modules: `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
  bookings: `<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3 8 9 6 9-6"/>`,
  domain: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>`,
  report: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  docs: `<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>`,
  account: `<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>`,
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`,
  check: `<path d="m5 12 4.5 4.5L19 7"/>`,
  checkc: `<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/>`,
  alert: `<path d="M12 3 2.5 20h19z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>`,
  star: `<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,
  starf: `<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  back: `<path d="M15 5l-7 7 7 7"/>`, fwd: `<path d="m9 5 7 7-7 7"/>`, left: `<path d="M15 5l-7 7 7 7"/>`, right: `<path d="m9 5 7 7-7 7"/>`,
  chev: `<path d="m6 9 6 6 6-6"/>`,
  trash: `<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>`,
  upload: `<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>`,
  camera: `<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  more: `<circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>`,
  moreh: `<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>`,
  grip: `<circle cx="9" cy="6" r="1.1" fill="currentColor"/><circle cx="15" cy="6" r="1.1" fill="currentColor"/><circle cx="9" cy="12" r="1.1" fill="currentColor"/><circle cx="15" cy="12" r="1.1" fill="currentColor"/><circle cx="9" cy="18" r="1.1" fill="currentColor"/><circle cx="15" cy="18" r="1.1" fill="currentColor"/>`,
  select: `<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>`,
  external: `<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>`,
  bell: `<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>`,
  logout: `<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M9 12h10"/>`,
  collapse: `<path d="M15 6l-6 6 6 6M4 4v16"/>`, expand: `<path d="m9 6 6 6-6 6M20 4v16"/>`,
  grid: `<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>`,
  list: `<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>`,
  spark: `<path d="M5 3l1.5 3.5L10 8l-3.5 1.5L5 13l-1.5-3.5L0 8l3.5-1.5zM17 11l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/>`,
  filter: `<path d="M4 6h16l-6 7v5l-4 2v-7z"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  card: `<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/>`,
  dot: `<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>`,
  arrowup: `<path d="M12 19V5M5 12l7-7 7 7"/>`,
};
const TABS = [
  ["attekintes", "Áttekintés", "home", "home"], ["szovegek", "Szövegek", "texts", "site"], ["fotok", "Fotók", "photos", "site"], ["modulok", "Modulok", "modules", "site"],
  ["foglalasok", "Foglalások", "bookings", "guests"], ["uzenetek", "Üzenetek", "mail", "guests"],
  ["webcim", "Webcím", "domain", "biz"], ["forgalom", "Forgalom", "report", "biz"], ["dokumentumok", "Dokumentumok", "docs", "biz"],
  ["fiok", "Fiók", "account", "acct"], ["sugo", "Súgó", "help", "acct"],
];
const GROUPS = { home: "", site: "Az oldalam", guests: "Vendégek", biz: "Üzlet", acct: "Fiók" };
const LOGO = (dot) => `<svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true"><path d="M34.5 10.5A17 17 0 1 0 34.5 37.5" fill="none" stroke="#1fb6d6" stroke-width="6" stroke-linecap="round"/><circle cx="22.5" cy="24" r="4.5" fill="${dot}"/><path d="M34 18.5 42 24l-8 5.5z" fill="#1fb6d6"/></svg>`;

// ── shared engine CSS: themed through variables every variant sets on .frame ──
const ENGINE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#d9dee5;font-family:Inter,system-ui,sans-serif;color:#1a2230;-webkit-font-smoothing:antialiased}
button,input{font-family:inherit}
svg{flex:0 0 auto}
.pl{padding:14px 12px 0;max-width:1240px;margin:0 auto}
.pl h1{font-size:1.05rem;margin:0 0 3px}
.pl p{margin:0 0 10px;font-size:.83rem;color:#3c5064;line-height:1.5}
.szw{display:inline-flex;background:#fff;border:1px solid #b9c3cf;border-radius:999px;padding:3px;gap:3px;margin-bottom:12px}
.szw button{border:0;background:transparent;font:700 .8rem/1 Inter,sans-serif;color:#60748b;padding:9px 15px;border-radius:999px;cursor:pointer}
.szw button.on{background:#0e2a47;color:#fff}
.stage{padding:0 12px 26px;max-width:1240px;margin:0 auto;overflow-x:auto}
.frame{container-type:inline-size;position:relative;width:390px;height:800px;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(14,42,71,.18);transition:width .2s;font-family:var(--font);color:var(--ink);background:var(--bg);font-size:var(--fs,14px)}
body[data-size="desktop"] .frame{width:1180px;height:860px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:600 .86em/1 var(--font);padding:9px 13px;border-radius:var(--rb);cursor:pointer;white-space:nowrap;transition:background .15s,transform .1s}
.btn:hover{background:var(--hover)}.btn:active{transform:scale(.98)}
.btn--p{background:var(--accent);border-color:transparent;color:var(--accent-ink);box-shadow:var(--accent-glow,none)}
.btn--p:hover{filter:brightness(1.06)}
.btn--danger{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 35%,transparent)}
.btn--danger:hover{background:color-mix(in srgb,var(--bad) 10%,var(--panel))}
.btn--sm{padding:6px 10px;font-size:.8em}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.ib{width:32px;height:32px;border-radius:var(--rb);border:1px solid var(--line);background:var(--panel);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink)}
.ib:hover{background:var(--hover)}.ib[disabled]{opacity:.35;cursor:not-allowed}
.ib--ghost{border-color:transparent;background:transparent}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:.76em;font-weight:600;border:1px solid var(--line);background:var(--panel);white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block}
.chip--ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,var(--panel));border-color:transparent}
.chip--warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 14%,var(--panel));border-color:transparent}
.chip--info{color:var(--info);background:color-mix(in srgb,var(--info) 14%,var(--panel));border-color:transparent}
.chip--mute{color:var(--muted)}
.bdg{display:inline-flex;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font-size:.7em;font-weight:700;align-items:center;justify-content:center}
.muted{color:var(--muted)}
.in{width:100%;border:1px solid var(--line);border-radius:var(--rb);padding:8px 10px;font:500 .9em var(--font);color:var(--ink);background:var(--field)}
.in:focus{outline:2px solid color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:1px;border-color:var(--accent)}
/* photo engine */
.notice{display:flex;gap:10px;align-items:flex-start;border-radius:var(--rc);padding:11px 14px;font-size:.9em;line-height:1.45;margin-bottom:14px;border:1px solid transparent}
.notice--demo{background:color-mix(in srgb,var(--warn) 12%,var(--panel));color:var(--warn);border-color:color-mix(in srgb,var(--warn) 25%,transparent)}
.notice--own{background:color-mix(in srgb,var(--ok) 12%,var(--panel));color:var(--ok);border-color:color-mix(in srgb,var(--ok) 25%,transparent)}
.notice b{color:inherit}
.drop{position:relative;border:1.5px dashed color-mix(in srgb,var(--accent) 60%,var(--line));background:color-mix(in srgb,var(--accent) 5%,var(--panel));border-radius:var(--rc);padding:16px;text-align:center;transition:.15s}
.drop.is-over{background:color-mix(in srgb,var(--accent) 16%,var(--panel));border-color:var(--accent);border-style:solid}
.drop b{display:block;font-size:.95em}
.drop p{margin:4px 0 10px;font-size:.78em;color:var(--muted);line-height:1.45}
.drop__acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.drop__cam{display:inline-flex}
@container (min-width:900px){.drop__cam{display:none}}
.prog{margin-top:10px;text-align:left}
.prog__row{display:flex;align-items:center;gap:10px;font-size:.8em;padding:6px 0;border-top:1px solid var(--line)}
.prog__row img{width:34px;height:34px;object-fit:cover;border-radius:6px}
.prog__bar{flex:1;height:5px;border-radius:99px;background:var(--line);overflow:hidden}
.prog__bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .4s}
.prog__row.is-bad{color:var(--bad)}.prog__row.is-ok .prog__bar i{background:var(--ok)}
.t{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:var(--rc);overflow:hidden;transition:box-shadow .15s}
.t.is-drag{opacity:.4}.t.is-over{outline:2px solid var(--accent);outline-offset:-2px}
.t.is-cover{box-shadow:0 0 0 2px var(--accent)}
.t.is-sel{outline:3px solid var(--ink);outline-offset:-3px}
.t img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--hover);cursor:zoom-in}
.t__cover{position:absolute;top:8px;left:8px;background:var(--ink);color:var(--bg);font-size:.68em;font-weight:700;padding:3px 8px;border-radius:999px;display:inline-flex;align-items:center;gap:4px}
.t__cover svg{color:#1fb6d6}
.t__n{position:absolute;top:8px;right:8px;background:color-mix(in srgb,#000 55%,transparent);color:#fff;font-size:.68em;font-weight:600;padding:2px 7px;border-radius:999px}
.t__chk{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:7px;background:var(--panel);border:2px solid var(--ink);display:none;align-items:center;justify-content:center;cursor:pointer}
.t__chk svg{opacity:0}.t.is-sel .t__chk{background:var(--ink);color:var(--bg)}.t.is-sel .t__chk svg{opacity:1}
.selmode .t__chk{display:inline-flex}.selmode .t__n{display:none}
.t__acts{display:flex;gap:3px;padding:6px 6px 0}
.t__acts .ib{width:28px;height:28px}
.t__acts .ib--del{margin-left:auto;color:var(--bad)}
.t__cap{padding:6px}
.t__cap input{width:100%;border:1px solid transparent;border-radius:calc(var(--rb) - 2px);padding:6px 8px;font:500 .8em var(--font);background:var(--field);color:var(--ink)}
.t__cap input:focus{outline:0;border-color:var(--accent);background:var(--panel)}
.saved{position:absolute;bottom:8px;right:8px;background:color-mix(in srgb,var(--ok) 15%,var(--panel));color:var(--ok);font-size:.68em;font-weight:700;padding:2px 7px;border-radius:99px;opacity:0;transition:opacity .2s;pointer-events:none}
.saved.on{opacity:1}
.r{display:grid;grid-template-columns:auto 72px 1fr;grid-template-areas:"g img cap" "g img acts";gap:4px 10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:var(--rc);padding:8px 10px;position:relative}
.r.is-cover{box-shadow:0 0 0 2px var(--accent)}.r.is-drag{opacity:.4}.r.is-over{outline:2px solid var(--accent);outline-offset:-2px}.r.is-sel{outline:3px solid var(--ink);outline-offset:-3px}
.r__g{grid-area:g;color:var(--muted);cursor:grab;display:flex;flex-direction:column;align-items:center;font-size:.7em;font-weight:700}
.r__img{grid-area:img;position:relative}.r__img img{width:72px;height:54px;object-fit:cover;border-radius:6px;display:block;cursor:zoom-in;background:var(--hover)}
.r__cap{grid-area:cap;display:flex;gap:6px;align-items:center}
.r__cap input{flex:1;min-width:0;border:1px solid transparent;border-radius:var(--rb);padding:6px 8px;font:500 .85em var(--font);background:var(--field);color:var(--ink)}
.r__cap input:focus{outline:0;border-color:var(--accent);background:var(--panel)}
.r__acts{grid-area:acts;display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.r__acts .ib{width:28px;height:28px}
.r__chk{width:24px;height:24px;border-radius:7px;border:2px solid var(--ink);background:var(--panel);display:none;align-items:center;justify-content:center;cursor:pointer}
.r__chk svg{opacity:0}.r.is-sel .r__chk{background:var(--ink);color:var(--bg)}.r.is-sel .r__chk svg{opacity:1}
.selmode .r__chk{display:inline-flex}.selmode .r__g{display:none}
.r .saved{top:6px;bottom:auto}
.covb{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:var(--rb);border:1px solid var(--line);background:var(--panel);font:600 .74em var(--font);cursor:pointer;color:var(--ink)}
.covb.is-on{background:var(--ink);color:var(--bg);border-color:var(--ink);cursor:default}.covb.is-on svg{color:#1fb6d6}
.bulk{position:sticky;bottom:8px;z-index:5;display:none;align-items:center;gap:10px;background:var(--ink);color:var(--bg);padding:9px 12px;border-radius:var(--rc);margin-top:12px;box-shadow:0 12px 30px rgba(0,0,0,.25);font-size:.86em;font-weight:600}
.selmode .bulk{display:flex}.bulk .sp{flex:1}
.bulk .btn{border-color:color-mix(in srgb,var(--bg) 30%,transparent);background:transparent;color:var(--bg)}
.bulk .btn--danger{background:var(--bad);border-color:var(--bad);color:#fff}
.tb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 10px}.tb .sp{flex:1}.tb .cnt{font-size:.8em;color:var(--muted)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--rb);overflow:hidden;background:var(--panel)}
.seg button{border:0;background:transparent;padding:6px 10px;font:600 .78em var(--font);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.seg button.on{background:var(--hover);color:var(--ink)}
.lb{position:absolute;inset:0;z-index:60;background:rgba(6,10,18,.94);display:none;flex-direction:column;color:#fff;font-family:var(--font)}
.lb.on{display:flex}.lb__top{display:flex;align-items:center;gap:8px;padding:12px 14px}.lb__top b{font-size:.95em}.lb__top .sp{flex:1}
.lb__img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 14px;position:relative}
.lb__img img{max-width:100%;max-height:100%;border-radius:10px;object-fit:contain}
.lb__nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.14);border:0;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.lb__nav:hover{background:rgba(255,255,255,.26)}.lb__nav--l{left:16px}.lb__nav--r{right:16px}
.lb__foot{padding:12px 14px 16px;display:flex;flex-direction:column;gap:10px}
.lb__foot input{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:10px;padding:10px 12px;font:500 .9em var(--font);width:100%}
.lb__acts{display:flex;gap:8px;flex-wrap:wrap}
.lb .btn{background:transparent;color:#fff;border-color:rgba(255,255,255,.35)}.lb .btn--p{background:#1fb6d6;color:#06131b;border-color:transparent}.lb .btn--danger{color:#ffb4b6;border-color:rgba(255,180,182,.5)}
.lb .ib{background:transparent;border-color:rgba(255,255,255,.3);color:#fff}
.lb .chip{background:rgba(255,255,255,.12);border-color:transparent;color:#fff}
.dlg{position:absolute;inset:0;z-index:70;background:rgba(6,10,18,.5);display:none;align-items:center;justify-content:center;padding:20px}
.dlg.on{display:flex}.dlg__box{background:var(--panel);color:var(--ink);border-radius:var(--rc);padding:20px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);border:1px solid var(--line)}
.dlg__box h3{margin:0 0 6px;font-size:1.05em}.dlg__box p{margin:0 0 16px;font-size:.88em;color:var(--muted);line-height:1.5}.dlg__acts{display:flex;gap:8px;justify-content:flex-end}
.toast{position:absolute;left:50%;bottom:18px;transform:translate(-50%,20px);z-index:80;background:var(--ink);color:var(--bg);padding:10px 14px;border-radius:12px;font-size:.86em;font-weight:600;box-shadow:0 16px 40px rgba(0,0,0,.3);opacity:0;transition:all .25s;display:flex;gap:8px;align-items:center;max-width:calc(100% - 32px);pointer-events:none}
.toast.on{opacity:1;transform:translate(-50%,0)}.toast.bad{background:var(--bad);color:#fff}.toast svg{color:#1fb6d6}.toast.bad svg{color:#fff}
.sheet{position:absolute;inset:0;z-index:55;display:none;background:rgba(6,10,18,.45)}
.sheet.on{display:block}
.sheet__box{position:absolute;left:0;right:0;bottom:0;background:var(--panel);color:var(--ink);border-radius:20px 20px 0 0;padding:10px 14px 18px;max-height:88%;overflow:auto;border-top:1px solid var(--line)}
.sheet__grab{width:36px;height:4px;border-radius:99px;background:var(--line);margin:0 auto 12px}
.sheet__h{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sheet__h b{font-size:1em}.sheet__h .sp{flex:1}
.drawer__box{position:absolute;top:0;bottom:0;left:0;width:290px;max-width:86%;background:var(--panel);color:var(--ink);padding:14px;overflow:auto;box-shadow:0 0 60px rgba(0,0,0,.35);border-right:1px solid var(--line)}
.menu a{display:flex;align-items:center;gap:11px;padding:10px 10px;border-radius:var(--rb);text-decoration:none;color:var(--ink);font-weight:500;font-size:.95em;cursor:pointer}
.menu a:hover{background:var(--hover)}.menu a.is-active{background:var(--hover);font-weight:600}.menu a .bdg{margin-left:auto}
.menu .g{font-size:.68em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:12px 10px 4px}
@container (min-width:900px){.sheet__box{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:520px;border-radius:var(--rc);border:1px solid var(--line)}}
.pageover{position:absolute;inset:0;z-index:50;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,var(--accent) 20%,rgba(255,255,255,.85));border:3px dashed var(--accent);font:700 1.1em var(--font);color:var(--ink);pointer-events:none}
.pageover.on{display:flex}
.spark{display:flex;align-items:flex-end;gap:2px;height:28px}
.spark i{flex:1;background:var(--accent);border-radius:2px 2px 0 0;min-height:2px;opacity:.85}
.spark i.z{background:var(--line)}
.stub{border:1px dashed var(--line);border-radius:var(--rc);padding:20px;color:var(--muted);font-size:.9em;line-height:1.5;background:var(--panel)}
.stub b{color:var(--ink)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:8px 12px;font-size:.88em}
.kv span{color:var(--muted)}.kv b{font-weight:600;text-align:right;min-width:0;overflow-wrap:anywhere}
`;

// ── shared engine JS ──
const ENGINE_JS = `
const ICON=${JSON.stringify(ICON)};
function ic(n,s=18){return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON[n]||'')+'</svg>'}
const TABS=${JSON.stringify(TABS)};const GROUPS=${JSON.stringify(GROUPS)};
// REAL data — dev DB, 2026-09-24 (site 62aa0d8d / tenant 31b40ba0)
const SITE={name:'Boróka ház',town:'Siófok',slug:'boroka-haz',url:'100.97.188.105:4800/t/boroka-haz',status:'Élő',modules:7,billed:6,unread:2,bookings:0,
  sub:{plan:'Éves előfizetés',renews:'2027. szept. 24.',status:'aktív'},visits7:[0,0,0,0,0,0,1],visitors7:1,
  msgs:[{s:'Számla OV-2026-55 – Modul-bővítés — időarányos első díj',d:'ma',u:true,k:'Számla'},{s:'Számla OV-2026-54 – Honlap-előfizetés (éves)',d:'ma',u:true,k:'Számla'},{s:'Belépési adatai – Citoviso admin',d:'ma',u:false,k:'Belépés'}]};
let P=${JSON.stringify(PHOTOS.map(([url, alt]) => ({ url, alt })))};
let own=false;const LIMIT_LIB=24,LIMIT_BATCH=12,LIMIT_BYTES=6000000;
let selMode=false,sel=new Set(),lbIdx=-1,view='grid';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function tabOf(id){return TABS.find(t=>t[0]===id)}
function setSize(s){document.body.dataset.size=s;$('#bM').classList.toggle('on',s==='mobile');$('#bD').classList.toggle('on',s==='desktop')}
setSize(window.innerWidth<900?'mobile':'desktop');
function isMobile(){return $('#frame').clientWidth<900}
let cur=(tabOf(location.hash.slice(1))?location.hash.slice(1):'attekintes');const stack=[];
function go(id,opts={}){if(id===cur&&!opts.force)return;if(!opts.pop)stack.push(cur);cur=id;if(!opts.pop){try{history.pushState({tab:id},'','#'+id)}catch(e){}}selMode=false;sel.clear();render();const m=$('#main');if(m)m.scrollTop=0}
function back(){if(!stack.length){go('attekintes');return}const id=stack.pop();go(id,{pop:true});try{history.back()}catch(e){}}
window.addEventListener('popstate',e=>{const id=(e.state&&e.state.tab)||location.hash.slice(1)||'attekintes';if(tabOf(id)){cur=id;selMode=false;sel.clear();render()}});
function canBack(){return stack.length>0}
let toastT;function toast(msg,bad){const t=$('#toast');t.className='toast'+(bad?' bad':'');t.innerHTML=ic(bad?'alert':'checkc',18)+'<span>'+esc(msg)+'</span>';requestAnimationFrame(()=>t.classList.add('on'));clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}
function confirmDlg(title,text,okLabel,cb){const d=$('#dlg');d.innerHTML='<div class="dlg__box"><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p><div class="dlg__acts"><button class="btn" id="dlgNo">Mégsem</button><button class="btn btn--danger" id="dlgOk">'+esc(okLabel)+'</button></div></div>';d.classList.add('on');$('#dlgNo').onclick=()=>d.classList.remove('on');$('#dlgOk').onclick=()=>{d.classList.remove('on');cb()}}
function closeSheet(){$('#sheet').classList.remove('on')}
function move(i,to){const p=P.splice(i,1)[0];if(to==='cover')P.unshift(p);else if(to==='up')P.splice(Math.max(0,i-1),0,p);else if(to==='down')P.splice(Math.min(P.length,i+1),0,p);else P.splice(to,0,p);render();toast(to==='cover'?'Ez lett a nyitókép':'Sorrend mentve')}
function setCaption(i,v){P[i].alt=v.slice(0,160);const s=$('[data-saved="'+i+'"]');if(s){s.classList.add('on');setTimeout(()=>s.classList.remove('on'),1400)}}
function del(idxs){if(!own){toast('A bemutató képeket nem kell törölnie — az első saját feltöltés lecseréli őket.',true);return}
  const n=idxs.length;confirmDlg(n>1?n+' fotó törlése':'Fotó törlése',n>1?'A kijelölt '+n+' fotó lekerül az oldaláról. Ez nem vonható vissza.':'A fotó lekerül az oldaláról. Ez nem vonható vissza.','Törlés',()=>{P=P.filter((_,i)=>!idxs.includes(i));selMode=false;sel.clear();if(lbIdx>=0)closeLb();render();toast(n>1?n+' fotó törölve':'Fotó törölve')})}
function toggleSel(i){if(sel.has(i))sel.delete(i);else sel.add(i);render()}
function setSelMode(v){selMode=v;sel.clear();render()}
function setView(v){view=v;render()}
function pickFiles(cam){const inp=$('#fileInp');if(cam)inp.setAttribute('capture','environment');else inp.removeAttribute('capture');inp.value='';inp.click()}
function fmtMB(b){return (b/1e6).toFixed(1).replace('.',',')+' MB'}
async function ingest(files){files=[...files];if(!files.length)return;let prog=$('#prog');if(!prog){openUploadUi();prog=$('#prog')}if(!prog)return;prog.innerHTML='';
  const errors=[];if(files.length>LIMIT_BATCH){errors.push('Egyszerre legfeljebb '+LIMIT_BATCH+' képet tölthet fel; '+(files.length-LIMIT_BATCH)+' kimaradt.');files=files.slice(0,LIMIT_BATCH)}
  let room=own?Math.max(0,LIMIT_LIB-P.length):LIMIT_LIB;const rows=[];
  for(const f of files){const okType=/^image\\/(jpeg|png|webp)$/.test(f.type);const okSize=f.size<=LIMIT_BYTES;
    let reason='';if(!okType)reason='nem kép (JPEG, PNG vagy WEBP kell)';else if(!okSize)reason='túl nagy ('+fmtMB(f.size)+', a határ 6 MB)';else if(room<=0)reason='a könyvtár tele van ('+LIMIT_LIB+' kép)';
    const url=okType?URL.createObjectURL(f):'';const row=document.createElement('div');row.className='prog__row'+(reason?' is-bad':'');
    row.innerHTML=(url?'<img src="'+url+'" alt="">':'<span style="width:34px;display:inline-flex;justify-content:center">'+ic('alert',16)+'</span>')+'<span style="flex:0 0 120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.name)+'</span>'+(reason?'<span>'+esc(reason)+'</span>':'<span class="prog__bar"><i></i></span><span class="st">0%</span>');
    prog.appendChild(row);if(reason)continue;room--;rows.push({f,url,row})}
  for(const r of rows){for(let p=0;p<=100;p+=25){await new Promise(res=>setTimeout(res,90));r.row.querySelector('i').style.width=p+'%';r.row.querySelector('.st').textContent=p+'%'}r.row.classList.add('is-ok');r.row.querySelector('.st').textContent='kész'}
  if(rows.length){const fresh=rows.map(r=>({url:r.url,alt:'',own:true}));if(!own){P=fresh;own=true}else P=P.concat(fresh)}
  await new Promise(res=>setTimeout(res,500));closeSheet();render();
  if(rows.length)toast(rows.length+' fotó feltöltve'+(rows.length<files.length?' — '+(files.length-rows.length)+' elutasítva':''),false);
  else if(files.length)toast('Egy kép sem került fel: '+(errors[0]||'minden fájl elutasítva'),true);
  if(errors.length&&rows.length)setTimeout(()=>toast(errors[0],true),2800)}
function bindDrop(el){if(!el)return;['dragenter','dragover'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.add('is-over')}));['dragleave','drop'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.remove('is-over')}));el.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length)ingest(e.dataTransfer.files)})}
function dropHtml(){return '<div class="drop" id="drop"><b>Húzza ide a fotóit</b><p>JPEG, PNG vagy WEBP · max. 6 MB képenként · max. 12 egyszerre · könyvtár: '+(own?P.length:0)+' / 24</p><div class="drop__acts"><button class="btn btn--p" onclick="pickFiles(false)">'+ic('upload',16)+'Fotók választása</button><button class="btn drop__cam" onclick="pickFiles(true)">'+ic('camera',16)+'Fényképezés</button></div><div class="prog" id="prog"></div></div>'}
function openUploadUi(){$('#sheet').innerHTML='<div class="sheet__box"><div class="sheet__grab"></div><div class="sheet__h"><b>Fotók hozzáadása</b><span class="sp"></span><button class="ib ib--ghost" onclick="closeSheet()">'+ic('close',18)+'</button></div>'+(own?'':'<p class="muted" style="font-size:.85em;margin:0 0 10px">Az első feltöltés <b>lecseréli</b> a 16 bemutató képet.</p>')+dropHtml()+'</div>';$('#sheet').classList.add('on');bindDrop($('#drop'))}
let dragI=-1;
function bindDnd(root){$$('[data-i]',root).forEach(el=>{el.draggable=!selMode;el.addEventListener('dragstart',e=>{dragI=+el.dataset.i;el.classList.add('is-drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(dragI))}catch(x){}});
  el.addEventListener('dragend',()=>{el.classList.remove('is-drag');$$('.is-over',root).forEach(x=>x.classList.remove('is-over'))});
  el.addEventListener('dragover',e=>{if(dragI<0)return;e.preventDefault();el.classList.add('is-over')});el.addEventListener('dragleave',()=>el.classList.remove('is-over'));
  el.addEventListener('drop',e=>{if(dragI<0)return;e.preventDefault();e.stopPropagation();const to=+el.dataset.i;if(to!==dragI)move(dragI,to);dragI=-1})})}
function openLb(i){lbIdx=i;renderLb();$('#lb').classList.add('on')}
function closeLb(){lbIdx=-1;$('#lb').classList.remove('on')}
function lbStep(d){lbIdx=(lbIdx+d+P.length)%P.length;renderLb()}
function renderLb(){const p=P[lbIdx];if(!p)return closeLb();$('#lb').innerHTML='<div class="lb__top"><button class="ib" onclick="closeLb()" aria-label="Bezárás">'+ic('close',18)+'</button><b>'+(lbIdx+1)+' / '+P.length+(lbIdx===0?' · Nyitókép':'')+'</b><span class="sp"></span>'+(own?'<span class="chip">saját fotó</span>':'<span class="chip">bemutató kép</span>')+'</div><div class="lb__img"><button class="lb__nav lb__nav--l" onclick="lbStep(-1)" aria-label="Előző">'+ic('left',20)+'</button><img src="'+esc(p.url)+'" alt="'+esc(p.alt)+'"><button class="lb__nav lb__nav--r" onclick="lbStep(1)" aria-label="Következő">'+ic('right',20)+'</button></div><div class="lb__foot"><input maxlength="160" value="'+esc(p.alt)+'" placeholder="Mi látszik a képen?" onchange="setCaption('+lbIdx+',this.value);toast(\\'Képaláírás mentve\\')"><div class="lb__acts">'+(lbIdx>0?'<button class="btn btn--p" onclick="move('+lbIdx+',\\'cover\\');lbIdx=0;renderLb()">'+ic('star',16)+'Legyen ez a nyitókép</button>':'<button class="btn" disabled>'+ic('starf',16)+'Ez a nyitókép</button>')+(own?'<button class="btn btn--danger" onclick="del(['+lbIdx+'])">'+ic('trash',16)+'Törlés</button>':'')+'</div></div>'}
document.addEventListener('keydown',e=>{if(lbIdx<0)return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')lbStep(-1);if(e.key==='ArrowRight')lbStep(1)});
function badge(id){if(id==='uzenetek'&&SITE.unread)return '<span class="bdg">'+SITE.unread+'</span>';return ''}
function sparkHtml(a){const m=Math.max(1,...a);return '<div class="spark">'+a.map(v=>'<i class="'+(v?'':'z')+'" style="height:'+Math.max(6,Math.round(v/m*100))+'%"></i>').join('')+'</div>'}
function tile(p,i,opts={}){const cover=i===0;return '<figure class="t'+(cover?' is-cover':'')+(sel.has(i)?' is-sel':'')+'" data-i="'+i+'" style="margin:0"><img src="'+esc(p.url)+'" alt="'+esc(p.alt)+'" loading="lazy" onclick="'+(selMode?'toggleSel('+i+')':'openLb('+i+')')+'">'+(cover?'<span class="t__cover">'+ic('starf',11)+'Nyitókép</span>':'')+'<span class="t__n">'+(i+1)+'</span><span class="t__chk" onclick="toggleSel('+i+')">'+ic('check',14)+'</span>'+
  (opts.bare?'':'<div class="t__acts"><button class="ib" title="Legyen ez a nyitókép" '+(cover?'disabled':'')+' onclick="move('+i+',\\'cover\\')">'+ic('star',15)+'</button><button class="ib" title="Előrébb" '+(i===0?'disabled':'')+' onclick="move('+i+',\\'up\\')">'+ic('left',15)+'</button><button class="ib" title="Hátrébb" '+(i===P.length-1?'disabled':'')+' onclick="move('+i+',\\'down\\')">'+ic('right',15)+'</button>'+(own?'<button class="ib ib--del" title="Törlés" onclick="del(['+i+'])">'+ic('trash',15)+'</button>':'')+'</div><div class="t__cap"><input maxlength="160" value="'+esc(p.alt)+'" placeholder="Mi látszik a képen?" aria-label="Képaláírás" onchange="setCaption('+i+',this.value)"></div><span class="saved" data-saved="'+i+'">Mentve</span>')+'</figure>'}
function row(p,i){return '<div class="r'+(i===0?' is-cover':'')+(sel.has(i)?' is-sel':'')+'" data-i="'+i+'"><span class="r__g" title="Húzza a rendezéshez">'+ic('grip',16)+(i+1)+'</span><span class="r__chk" onclick="toggleSel('+i+')">'+ic('check',14)+'</span><span class="r__img"><img src="'+esc(p.url)+'" alt="'+esc(p.alt)+'" loading="lazy" onclick="'+(selMode?'toggleSel('+i+')':'openLb('+i+')')+'"></span>'+
  '<span class="r__cap"><input maxlength="160" value="'+esc(p.alt)+'" placeholder="Mi látszik a képen?" aria-label="Képaláírás" onchange="setCaption('+i+',this.value)"></span>'+
  '<span class="r__acts">'+(i===0?'<button class="covb is-on">'+ic('starf',12)+'Nyitókép</button>':'<button class="covb" onclick="move('+i+',\\'cover\\')">'+ic('star',12)+'Legyen nyitókép</button>')+'<span class="chip chip--mute">'+(own?'saját':'bemutató')+'</span><button class="ib" title="Előrébb" '+(i===0?'disabled':'')+' onclick="move('+i+',\\'up\\')">'+ic('left',15)+'</button><button class="ib" title="Hátrébb" '+(i===P.length-1?'disabled':'')+' onclick="move('+i+',\\'down\\')">'+ic('right',15)+'</button>'+(own?'<button class="ib ib--del" style="color:var(--bad)" title="Törlés" onclick="del(['+i+'])">'+ic('trash',15)+'</button>':'')+'</span><span class="saved" data-saved="'+i+'">Mentve</span></div>'}
function stubHtml(id){const t=tabOf(id);return '<div class="stub"><b>'+esc(t[1])+'</b> — ez a fül nem része ennek a tervnek: a tartalma marad, csak a keret (navigáció, fejléc, vissza-út) cserélődik körülötte. A terv a navigációról, az Áttekintésről és a Fotókról dönt.</div>'}
function selBtn(){return own?(selMode?'<button class="btn btn--sm" onclick="setSelMode(false)">Kész</button>':'<button class="btn btn--sm" onclick="setSelMode(true)">'+ic('select',15)+'Kijelölés</button>'):''}
function bulkHtml(){return '<div class="bulk"><span>'+sel.size+' kijelölve</span><span class="sp"></span><button class="btn btn--sm" onclick="setSelMode(false)">Mégse</button><button class="btn btn--sm btn--danger" '+(sel.size?'':'disabled')+' onclick="del([...sel])">'+ic('trash',15)+'Törlés</button></div>'}
function noticeHtml(){return own?'<div class="notice notice--own">'+ic('checkc',18)+'<span>A saját fotói láthatók az oldalán. '+P.length+' / 24 kép a könyvtárban.</span></div>':'<div class="notice notice--demo">'+ic('alert',18)+'<span><b>Bemutató képek láthatók.</b> Az élesítéshez a saját, jogtiszta fotói kellenek — az első feltöltés <b>lecseréli</b> a 16 bemutató képet.</span></div>'}
function bindPhoto(root){bindDnd(root);bindDrop($('#drop',root));$('#fileInp').onchange=()=>ingest($('#fileInp').files)}
function pageDrop(){const f=$('#frame');if(f.dataset.pd)return;f.dataset.pd='1';['dragenter','dragover'].forEach(ev=>f.addEventListener(ev,e=>{if(cur!=='fotok'||dragI>=0)return;e.preventDefault();$('#pageover').classList.add('on')}));['dragleave','drop'].forEach(ev=>f.addEventListener(ev,e=>{if(ev==='drop'||!f.contains(e.relatedTarget))$('#pageover').classList.remove('on')}));f.addEventListener('drop',e=>{if(cur!=='fotok'||dragI>=0)return;e.preventDefault();if(e.dataTransfer&&e.dataTransfer.files.length)ingest(e.dataTransfer.files)})}
`;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LINEAR — monokróm műszer. Refs: Linear, Relatel CRM (Dribbble 25322023)
// ═══════════════════════════════════════════════════════════════════════════
const V1 = {
  file: "admin2-1-linear.html",
  title: "1 · „Linear” — monokróm műszer",
  refs: "Linear · Attio · a Relatel CRM „Tasks report” lap (Dribbble)",
  decides: `Szín <b>csak jelentésre</b> (zöld/borostyán/piros), minden más fekete-fehér-szürke; 13 px-es sűrű tipográfia, hajszálvékony vonalak, <b>nincs kártya-árnyék</b>. Bal oldalt <b>fa-navigáció</b> számlálókkal (Fotók 16, Üzenetek 2), összecsukható; fent <b>← + útvonal + ⌘K kereső</b>, a lap elsődleges gombja fekete. Az Áttekintés <b>widget-sor</b> (állapot, látogatók 7 nap, üzenetek) + „teendő-lista” sorokkal. A Fotók <b>nézet-váltóval</b>: Rács / Lista, sűrű 6-oszlopos rács, a műveletek a csempén, a feltöltés vékony sávban.`,
  css: `
.frame{--font:Inter,system-ui,sans-serif;--fs:13px;--bg:#fff;--panel:#fff;--field:#f6f7f8;--hover:#f2f3f5;--line:#e6e8eb;--ink:#17191c;--muted:#6f7680;--accent:#17191c;--accent-ink:#fff;--ok:#1a7f4b;--warn:#a1620a;--bad:#c2323a;--info:#1275a0;--rb:6px;--rc:8px}
.shell{display:grid;grid-template-rows:auto 1fr;height:100%}
.side{display:none}
.top{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);background:#fff;min-height:48px}
.crumb{display:flex;align-items:center;gap:4px;font-size:.92em;min-width:0;flex:1}
.crumb a{color:var(--muted);text-decoration:none;cursor:pointer;padding:3px 6px;border-radius:5px;white-space:nowrap}.crumb a:hover{background:var(--hover);color:var(--ink)}
.crumb b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.crumb svg{color:#c3c8cf}
.srch{display:none}
.main{overflow:auto;position:relative}
.main__in{padding:14px 14px 28px}
.ph{margin-bottom:14px}
.ph h1{font-size:1.45em;margin:0 0 2px;font-weight:600;letter-spacing:-.01em}
.ph p{margin:0;color:var(--muted);font-size:.92em;line-height:1.5}
.ph__row{display:flex;align-items:flex-start;gap:10px}.ph__row>div{flex:1}
.ph__acts{display:none;gap:6px}
.w{display:grid;grid-template-columns:1fr;gap:10px}
.wc{border:1px solid var(--line);border-radius:var(--rc);padding:12px 14px}
.wc__h{display:flex;align-items:center;gap:8px;font-size:.85em;color:var(--muted);margin-bottom:8px}
.wc__h .sp{flex:1}.wc__h .ib{width:24px;height:24px;border:0}
.wc__v{font-size:1.5em;font-weight:600;letter-spacing:-.01em}
.wc__s{font-size:.82em;color:var(--muted);margin-top:2px}
.wc .spark{margin-top:8px}
.issues{border:1px solid var(--line);border-radius:var(--rc);margin-top:16px}
.issues__h{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line);font-size:.85em;font-weight:600}
.issues__h .cnt{color:var(--muted);font-weight:500}.issues__h .sp{flex:1}
.iss{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--line);font-size:.95em;cursor:pointer}
.iss:last-child{border-bottom:0}.iss:hover{background:var(--hover)}
.iss__st{width:14px;height:14px;border-radius:50%;border:1.5px solid #c3c8cf;flex:0 0 auto}
.iss.is-open .iss__st{border-color:var(--warn);border-style:dashed}
.iss.is-done .iss__st{background:var(--ok);border-color:var(--ok)}
.iss.is-done span{color:var(--muted);text-decoration:line-through}
.iss .m{margin-left:auto;color:var(--muted);font-size:.85em;white-space:nowrap}
.iss .m .chip{margin-right:6px}
.mrow{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:.9em}
.mrow:first-of-type{border-top:0}.mrow .d{margin-left:auto;color:var(--muted);font-size:.85em;white-space:nowrap}
.mrow i{width:6px;height:6px;border-radius:50%;background:var(--info);flex:0 0 auto}.mrow.is-read i{background:transparent}
.mrow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dropbar .drop{padding:10px 12px;display:flex;align-items:center;gap:12px;text-align:left;flex-wrap:wrap}
.dropbar .drop b{font-size:.9em}.dropbar .drop p{margin:0;flex:1;min-width:140px}.dropbar .drop .drop__acts{justify-content:flex-start}
.dropbar .drop .prog{flex-basis:100%}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.t{border-radius:6px}.t img{aspect-ratio:1}
.t__acts{display:none}.t__cap{display:none}
.t:hover .t__acts{display:flex;position:absolute;left:4px;right:4px;bottom:4px;padding:0;background:rgba(255,255,255,.92);border-radius:6px;padding:3px}
.rows{display:flex;flex-direction:column;gap:6px}
.r{border-radius:6px}
.bnav{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--line);background:#fff;padding:6px 6px calc(6px + env(safe-area-inset-bottom))}
.bnav a{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;color:var(--muted);font-size:.72em;font-weight:500;text-decoration:none;cursor:pointer;border-radius:6px;position:relative}
.bnav a.is-active{color:var(--ink);font-weight:600}.bnav a .bdg{position:absolute;top:2px;right:calc(50% - 20px)}
.shell{grid-template-rows:auto 1fr auto}
@container (min-width:900px){
  .shell{grid-template-columns:232px 1fr;grid-template-rows:auto 1fr}
  .side{grid-row:1/3}
  .shell.is-rail{grid-template-columns:56px 1fr}
  .side{display:flex;flex-direction:column;background:#fafafa;border-right:1px solid var(--line);padding:10px 8px;overflow:hidden}
  .side__top{display:flex;align-items:center;gap:8px;padding:4px 6px 12px}
  .side__top b{font-size:.95em;flex:1;white-space:nowrap}.side__top small{display:block;color:var(--muted);font-weight:400;font-size:.8em}
  .side__top .ib{width:24px;height:24px;border:0;background:transparent;color:var(--muted)}
  .nav{display:flex;flex-direction:column;gap:1px;flex:1}
  .nav .g{font-size:.72em;font-weight:600;color:var(--muted);padding:12px 8px 4px;white-space:nowrap}
  .nav a{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;color:var(--ink);font-size:.95em;text-decoration:none;cursor:pointer;white-space:nowrap}
  .nav a:hover{background:#eeeff1}.nav a.is-active{background:#e9eaed;font-weight:600}
  .nav a svg{color:var(--muted)}.nav a.is-active svg{color:var(--ink)}
  .nav a .n{margin-left:auto;color:var(--muted);font-size:.85em}.nav a .bdg{margin-left:auto}
  .is-rail .side__top b,.is-rail .nav a span,.is-rail .nav .g,.is-rail .nav a .n,.is-rail .user span{display:none}
  .is-rail .nav a{justify-content:center;padding:8px 0}.is-rail .side__top{justify-content:center}
  .user{display:flex;align-items:center;gap:8px;padding:8px;border-top:1px solid var(--line);margin-top:8px;font-size:.9em;white-space:nowrap}
  .user .av{width:26px;height:26px;border-radius:50%;background:#17191c;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.7em;font-weight:700;flex:0 0 auto}
  .user span small{display:block;color:var(--muted);font-size:.8em}
  .top{padding:8px 16px}
  .srch{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:6px;padding:5px 9px;width:230px;color:var(--muted);font-size:.9em;background:#fff}
  .srch kbd{margin-left:auto;font:600 .8em var(--font);border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--muted)}
  .main__in{padding:24px 32px 32px;max-width:1040px}
  .ph h1{font-size:1.7em}.ph__acts{display:flex}
  .w{grid-template-columns:repeat(3,1fr)}
  .grid{grid-template-columns:repeat(6,1fr)}
  .bnav{display:none}
  #topBack,#topMenu{display:none}
}`,
  body: `
<div class="shell" id="shell">
  <aside class="side"><div class="side__top">${LOGO('#17191c')}<b>Boróka ház<small>boroka-haz · Élő</small></b><button class="ib" onclick="toggleRail()" id="railBtn" title="Összecsuk"></button></div><nav class="nav" id="nav"></nav><div class="user"><span class="av">BH</span><span>Boróka ház<small>tulajdonos</small></span></div></aside>
  <div class="top"><button class="ib ib--ghost" id="topMenu" onclick="openDrawer()"></button><button class="ib ib--ghost" id="topBack" onclick="back()"></button><div class="crumb" id="crumb"></div><div class="srch" id="srch"></div><button class="btn btn--sm" onclick="toast('Megnyílik az oldala új lapon')" id="extBtn"></button><button class="btn btn--sm btn--p" id="priBtn"></button></div>
  <main class="main" id="main"><div class="main__in" id="view"></div></main>
  <nav class="bnav" id="bnav"></nav>
</div>`,
  js: `
let rail=false;function toggleRail(){rail=!rail;$('#shell').classList.toggle('is-rail',rail);render()}
const COUNT={fotok:()=>P.length,modulok:()=>SITE.modules,foglalasok:()=>SITE.bookings||''};
function navHtml(){let h='',g='';for(const t of TABS){if(t[3]!==g){g=t[3];if(GROUPS[g])h+='<div class="g">'+GROUPS[g]+'</div>'}h+='<a class="'+(t[0]===cur?'is-active':'')+'" title="'+t[1]+'" onclick="go(\\''+t[0]+'\\')">'+ic(t[2],16)+'<span>'+t[1]+'</span>'+(badge(t[0])||(COUNT[t[0]]?'<span class="n">'+COUNT[t[0]]()+'</span>':''))+'</a>'}return h}
const BOTTOM=['attekintes','fotok','foglalasok','uzenetek'];
function bnavHtml(){return BOTTOM.map(id=>{const t=tabOf(id);return '<a class="'+(cur===id?'is-active':'')+'" onclick="go(\\''+id+'\\')">'+ic(t[2],20)+t[1]+badge(id)+'</a>'}).join('')+'<a class="'+(!BOTTOM.includes(cur)?'is-active':'')+'" onclick="openDrawer()">'+ic('menu',20)+'Menü</a>'}
function openDrawer(){let h='',g='';for(const t of TABS){if(t[3]!==g){g=t[3];if(GROUPS[g])h+='<div class="g">'+GROUPS[g]+'</div>'}h+='<a class="'+(t[0]===cur?'is-active':'')+'" onclick="closeSheet();go(\\''+t[0]+'\\')">'+ic(t[2],16)+t[1]+badge(t[0])+'</a>'}
  $('#sheet').innerHTML='<div class="drawer__box"><div class="sheet__h">'+${JSON.stringify(LOGO('#17191c'))}+'<b>Boróka ház</b><span class="sp"></span><button class="ib ib--ghost" onclick="closeSheet()">'+ic('close',18)+'</button></div><div class="menu">'+h+'<div class="g">boroka-haz</div><a onclick="closeSheet();toast(\\'Kilépés\\')">'+ic('logout',16)+'Kilépés</a></div></div>';$('#sheet').classList.add('on')}
function overview(){return '<div class="ph"><h1>Áttekintés</h1><p>Az oldala állapota egy képernyőn — ami teendő, az itt sorban áll.</p></div>'+
 '<div class="w"><div class="wc"><div class="wc__h">'+ic('dot',12)+'Állapot<span class="sp"></span><button class="ib ib--ghost" onclick="go(\\'webcim\\')">'+ic('moreh',14)+'</button></div><div class="wc__v" style="display:flex;align-items:center;gap:8px"><span class="chip chip--ok"><i></i>Élő</span></div><div class="wc__s">'+SITE.url+'</div></div>'+
 '<div class="wc"><div class="wc__h">'+ic('report',14)+'Látogatók · 7 nap<span class="sp"></span><button class="ib ib--ghost" onclick="go(\\'forgalom\\')">'+ic('moreh',14)+'</button></div><div class="wc__v">'+SITE.visitors7+'</div><div class="wc__s">egyedi látogató, robotok nélkül</div>'+sparkHtml(SITE.visits7)+'</div>'+
 '<div class="wc"><div class="wc__h">'+ic('mail',14)+'Üzenetek<span class="sp"></span><button class="ib ib--ghost" onclick="go(\\'uzenetek\\')">'+ic('moreh',14)+'</button></div>'+SITE.msgs.map(m=>'<div class="mrow'+(m.u?'':' is-read')+'"><i></i><span>'+m.s+'</span><em class="d" style="font-style:normal">'+m.d+'</em></div>').join('')+'</div></div>'+
 '<div class="issues"><div class="issues__h">Teendők <span class="cnt">'+(own?0:1)+' nyitott</span><span class="sp"></span><span class="cnt">'+SITE.modules+' modul · '+SITE.billed+' számlázott · '+SITE.sub.plan+', megújul '+SITE.sub.renews+'</span></div>'+
 (own?'<div class="iss is-done" onclick="go(\\'fotok\\')"><i class="iss__st"></i><span>Saját fotók feltöltése</span><em class="m">Fotók</em></div>':'<div class="iss is-open" onclick="go(\\'fotok\\')"><i class="iss__st"></i><span>Töltsön fel saját fotókat — bemutató képek láthatók</span><em class="m"><span class="chip chip--warn">Élesítés előtt</span>Fotók</em></div>')+
 '<div class="iss is-done" onclick="go(\\'szovegek\\')"><i class="iss__st"></i><span>Bemutatkozó szöveg</span><em class="m">Szövegek</em></div><div class="iss is-done"><i class="iss__st"></i><span>Az oldal élő és nyilvános</span><em class="m">Webcím</em></div></div>'}
function photos(){return '<div class="ph"><div class="ph__row"><div><h1>Fotók</h1><p>'+P.length+' kép · az első a nyitókép · húzással rendezhető</p></div><div class="ph__acts"><span class="seg"><button class="'+(view==='grid'?'on':'')+'" onclick="setView(\\'grid\\')">'+ic('grid',14)+'Rács</button><button class="'+(view==='list'?'on':'')+'" onclick="setView(\\'list\\')">'+ic('list',14)+'Lista</button></span>'+selBtn()+'</div></div></div>'+noticeHtml()+
 '<div class="'+(selMode?'selmode':'')+'"><div class="dropbar">'+dropHtml()+'</div><div class="tb"><span class="seg" style="display:inline-flex"><button class="'+(view==='grid'?'on':'')+'" onclick="setView(\\'grid\\')">'+ic('grid',14)+'Rács</button><button class="'+(view==='list'?'on':'')+'" onclick="setView(\\'list\\')">'+ic('list',14)+'Lista</button></span><span class="sp"></span>'+selBtn()+'</div>'+
 (view==='grid'?'<div class="grid">'+P.map((p,i)=>tile(p,i)).join('')+'</div>':'<div class="rows">'+P.map((p,i)=>row(p,i)).join('')+'</div>')+bulkHtml()+'</div>'}
function render(){const t=tabOf(cur);$('#nav').innerHTML=navHtml();$('#bnav').innerHTML=bnavHtml();$('#railBtn').innerHTML=ic(rail?'expand':'collapse',14);
  $('#topMenu').innerHTML=ic('menu',18);$('#topBack').innerHTML=ic('back',18);$('#topBack').style.visibility=cur==='attekintes'?'hidden':'visible';
  $('#crumb').innerHTML=(cur==='attekintes'?'<b>Boróka ház</b>':'<a onclick="go(\\'attekintes\\')">Boróka ház</a>'+ic('fwd',13)+'<b>'+t[1]+'</b>');
  $('#srch').innerHTML=ic('search',14)+'Keresés…<kbd>⌘K</kbd>';$('#extBtn').innerHTML=ic('external',14)+'<span>Oldal</span>';
  $('#priBtn').innerHTML=cur==='fotok'?ic('upload',14)+'Feltöltés':ic('plus',14)+'Új';$('#priBtn').onclick=()=>cur==='fotok'?pickFiles(false):toast('Új: szöveg, fotó vagy modul');
  const v=$('#view');v.innerHTML=cur==='attekintes'?overview():cur==='fotok'?photos():'<div class="ph"><h1>'+t[1]+'</h1></div>'+stubHtml(cur);
  if(cur==='fotok'){bindPhoto(v);$('.ph__acts').innerHTML='';}}
render();pageDrop();`
};

// ═══════════════════════════════════════════════════════════════════════════
// 2 · BENTO — puha mozaik-műszerfal. Refs: Masjidhero (Dribbble 26906857), bento-rács trend
// ═══════════════════════════════════════════════════════════════════════════
const V2 = {
  file: "admin2-2-bento.html",
  title: "2 · „Bento” — puha mozaik-műszerfal",
  refs: "Masjidhero dashboard (Dribbble) · bento-rács trend · Plus Jakarta Sans",
  decides: `Szürke vászon, <b>fehér, kerek (20 px) kártyák árnyék nélkül</b>, egy telített akcent (a logó ciánja) a fő gombokon és az aktív menüponton. Az Áttekintés <b>bento-rács</b>: KPI-csempék (állapot, látogatók szikra-diagrammal, üzenetek, előfizetés), egy <b>nagy nyitókép-csempe</b> „Cserélje sajátra” hívással, teendő-lista, üzenet-táblázat. A Fotók is bento: a nyitókép 2×2-es csempe, mellette a feltöltő csempe és a számláló, alatta kerek kép-kártyák aláírással. Mobilon <b>lebegő pirula-menü</b> alul, egy-oszlopos bento.`,
  css: `
.frame{--font:"Plus Jakarta Sans",Inter,system-ui,sans-serif;--fs:14px;--bg:#f3f4f7;--panel:#fff;--field:#f3f4f7;--hover:#eef0f4;--line:#e7e9ee;--ink:#151a24;--muted:#6b7280;--accent:#1fb6d6;--accent-ink:#06131b;--ok:#1a8f5a;--warn:#b26a08;--bad:#d1353c;--info:#1a6ab3;--rb:12px;--rc:20px}
.shell{display:grid;grid-template-rows:auto 1fr;height:100%}
.side{display:none}
.top{display:flex;align-items:center;gap:8px;padding:12px 16px 4px}
.top h1{font-size:1.35em;margin:0;flex:1;font-weight:700;letter-spacing:-.01em;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top h1 small{display:block;font-size:.62em;color:var(--muted);font-weight:500}
.top .ib{border-radius:50%;width:38px;height:38px}
.av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1fb6d6,#5081ff);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.75em;font-weight:800}
.main{overflow:auto;position:relative}
.main__in{padding:10px 16px 96px}
.card{background:var(--panel);border-radius:var(--rc);padding:16px}
.card h3{margin:0 0 2px;font-size:.95em;font-weight:700}
.card .sub{font-size:.8em;color:var(--muted)}
.bento{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kpi{background:var(--panel);border-radius:var(--rc);padding:14px 16px;min-height:104px;display:flex;flex-direction:column}
.kpi__l{font-size:.78em;color:var(--muted);font-weight:600}
.kpi__v{font-size:1.7em;font-weight:800;letter-spacing:-.02em;margin-top:auto;line-height:1.1}
.kpi__s{font-size:.74em;color:var(--muted);margin-top:4px}
.kpi .spark{height:22px;margin-top:6px}
.kpi .spark i{background:linear-gradient(180deg,#1fb6d6,#5081ff);opacity:1}
.cov{grid-column:1/-1;position:relative;border-radius:var(--rc);overflow:hidden;background:#101828;min-height:210px;display:flex;flex-direction:column;justify-content:flex-end}
.cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.85}
.cov__b{position:relative;padding:18px;background:linear-gradient(transparent,rgba(16,24,40,.9));color:#fff}
.cov__b b{display:block;font-size:1.15em;font-weight:800}
.cov__b span{font-size:.8em;opacity:.85;display:block;margin-bottom:10px}
.cov__b .btn{background:#fff;border-color:#fff;color:#151a24}
.cov__tag{position:absolute;top:12px;left:12px;background:rgba(255,255,255,.9);color:#151a24;font-size:.72em;font-weight:700;padding:4px 10px;border-radius:999px;display:inline-flex;gap:5px;align-items:center}
.todo{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:.92em;cursor:pointer}
.todo:first-of-type{border-top:0}
.todo .ck{width:22px;height:22px;border-radius:50%;border:2px solid #d5d9e0;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:#fff}
.todo.is-done .ck{background:var(--ok);border-color:var(--ok)}
.todo.is-done span{color:var(--muted)}
.todo .go{margin-left:auto;color:var(--muted)}
.tbl{width:100%;border-collapse:collapse;font-size:.86em}
.tbl th{text-align:left;font-weight:600;color:var(--muted);font-size:.82em;padding:6px 0;border-bottom:1px solid var(--line)}
.tbl td{padding:10px 0;border-bottom:1px solid var(--line);vertical-align:middle}
.tbl tr:last-child td{border-bottom:0}
.tbl .s{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pill-nav{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:45;display:flex;gap:2px;background:rgba(21,26,36,.94);backdrop-filter:blur(10px);border-radius:999px;padding:6px;box-shadow:0 14px 34px rgba(16,24,40,.35)}
.pill-nav a{width:52px;height:46px;border-radius:999px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:rgba(255,255,255,.65);font-size:.6em;font-weight:600;cursor:pointer;position:relative}
.pill-nav a.is-active{background:var(--accent);color:#06131b}
.pill-nav a .bdg{position:absolute;top:3px;right:6px;background:#fff;color:#151a24}
.pbento{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.pbento .cov{grid-column:1/-1;min-height:200px}
.pbento .drop{border-radius:var(--rc);display:flex;flex-direction:column;justify-content:center}
.pbento .kpi{min-height:0}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.t{border:0;border-radius:16px}
.t__acts{padding:8px 8px 0}.t__cap{padding:8px}
.t .ib{border-color:transparent;background:var(--field)}
.fh{display:flex;align-items:center;gap:8px;margin:14px 0 10px}
.fh h3{margin:0;font-size:1em;font-weight:700;flex:1}
.fh .sub{font-size:.8em;color:var(--muted)}
@container (min-width:900px){
  .shell{grid-template-columns:236px 1fr;grid-template-rows:auto 1fr}
  .side{grid-row:1/3}
  .side{display:flex;flex-direction:column;background:#fff;padding:20px 14px;border-right:1px solid var(--line)}
  .side__brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05em;padding:0 8px 22px}
  .nav{display:flex;flex-direction:column;gap:3px;flex:1}
  .nav a{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:12px;color:#3b4250;font-size:.92em;font-weight:600;text-decoration:none;cursor:pointer}
  .nav a:hover{background:var(--hover)}
  .nav a.is-active{background:var(--accent);color:#06131b}
  .nav a .bdg{margin-left:auto}.nav a.is-active .bdg{background:#06131b;color:#fff}
  .side__foot{border-top:1px solid var(--line);padding-top:12px;display:flex;align-items:center;gap:10px;font-size:.86em}
  .side__foot b{display:block}.side__foot small{color:var(--muted)}
  .side__foot .ib{margin-left:auto;border:0}
  .top{padding:22px 32px 6px}.top h1{font-size:1.7em}
  .main__in{padding:12px 32px 32px;max-width:1080px}
  .bento{grid-template-columns:repeat(4,1fr)}
  .cov{grid-column:span 2;grid-row:span 2;min-height:0}
  .card--todo{grid-column:span 2}.card--msg{grid-column:span 2}
  .pill-nav,#topMenu{display:none}
  .pbento{grid-template-columns:repeat(4,1fr)}
  .pbento .cov{grid-column:span 2;grid-row:span 2}
  .grid{grid-template-columns:repeat(4,1fr);gap:12px}
}`,
  body: `
<div class="shell">
  <aside class="side"><div class="side__brand">${LOGO('#151a24')}Citoviso</div><nav class="nav" id="nav"></nav><div class="side__foot"><span class="av">BH</span><span><b>Boróka ház</b><small>boroka-haz</small></span><button class="ib" title="Kilépés" onclick="toast('Kilépés')" id="outBtn"></button></div></aside>
  <div class="top"><button class="ib" id="topMenu" onclick="openDrawer()"></button><button class="ib" id="topBack" onclick="back()"></button><h1 id="ttl"></h1><button class="ib" title="Oldal megtekintése" onclick="toast('Megnyílik az oldala új lapon')" id="extBtn"></button><span class="av">BH</span></div>
  <main class="main" id="main"><div class="main__in" id="view"></div></main>
  <nav class="pill-nav" id="pnav"></nav>
</div>`,
  js: `
function navHtml(){return TABS.map(t=>'<a class="'+(t[0]===cur?'is-active':'')+'" onclick="go(\\''+t[0]+'\\')">'+ic(t[2],18)+t[1]+badge(t[0])+'</a>').join('')}
const BOTTOM=['attekintes','fotok','foglalasok','uzenetek'];
function pnavHtml(){return BOTTOM.map(id=>{const t=tabOf(id);return '<a class="'+(cur===id?'is-active':'')+'" onclick="go(\\''+id+'\\')">'+ic(t[2],18)+t[1]+badge(id)+'</a>'}).join('')+'<a class="'+(!BOTTOM.includes(cur)?'is-active':'')+'" onclick="openDrawer()">'+ic('menu',18)+'Több</a>'}
function openDrawer(){$('#sheet').innerHTML='<div class="sheet__box"><div class="sheet__grab"></div><div class="sheet__h"><b>Menü</b><span class="sp"></span><button class="ib ib--ghost" onclick="closeSheet()">'+ic('close',18)+'</button></div><div class="menu">'+TABS.map(t=>'<a class="'+(t[0]===cur?'is-active':'')+'" onclick="closeSheet();go(\\''+t[0]+'\\')">'+ic(t[2],18)+t[1]+badge(t[0])+'</a>').join('')+'<a onclick="closeSheet();toast(\\'Kilépés\\')">'+ic('logout',18)+'Kilépés</a></div></div>';$('#sheet').classList.add('on')}
function overview(){const c=P[0];return '<div class="bento">'+
 '<div class="kpi"><span class="kpi__l">Állapot</span><span class="kpi__v" style="font-size:1.1em"><span class="chip chip--ok"><i></i>Élő és nyilvános</span></span><span class="kpi__s">'+SITE.url+'</span></div>'+
 '<div class="kpi"><span class="kpi__l">Látogatók · 7 nap</span><span class="kpi__v">'+SITE.visitors7+'</span>'+sparkHtml(SITE.visits7)+'</div>'+
 '<div class="cov"><img src="'+esc(c.url)+'" alt="'+esc(c.alt)+'"><span class="cov__tag">'+ic('starf',12)+(own?'Saját nyitókép':'Bemutató nyitókép')+'</span><div class="cov__b"><b>'+SITE.name+'</b><span>'+(own?'A saját fotói láthatók az oldalán.':'Jelenleg bemutató képek — az élesítéshez a saját fotói kellenek.')+'</span><button class="btn btn--sm" onclick="go(\\'fotok\\')">'+ic('photos',15)+(own?'Fotók kezelése':'Cserélje sajátra')+'</button></div></div>'+
 '<div class="kpi"><span class="kpi__l">Üzenetek</span><span class="kpi__v">'+SITE.unread+'</span><span class="kpi__s">olvasatlan · <a style="color:var(--info);cursor:pointer;font-weight:600" onclick="go(\\'uzenetek\\')">megnyitom</a></span></div>'+
 '<div class="kpi"><span class="kpi__l">Előfizetés</span><span class="kpi__v" style="font-size:1.05em">'+SITE.sub.plan+'</span><span class="kpi__s">megújul: '+SITE.sub.renews+' · '+SITE.modules+' modul</span></div>'+
 '<div class="card card--todo"><h3>Teendők</h3><span class="sub">'+(own?'minden kész':'1 nyitott')+'</span><div style="margin-top:8px">'+(own?'<div class="todo is-done"><span class="ck">'+ic('check',12)+'</span><span>Saját fotók feltöltve</span></div>':'<div class="todo" onclick="go(\\'fotok\\')"><span class="ck"></span><span><b>Töltsön fel saját fotókat</b> — bemutató képek láthatók</span><span class="go">'+ic('fwd',16)+'</span></div>')+'<div class="todo is-done"><span class="ck">'+ic('check',12)+'</span><span>A bemutatkozó szövege kész</span></div><div class="todo is-done"><span class="ck">'+ic('check',12)+'</span><span>Az oldala élő és nyilvános</span></div></div></div>'+
 '<div class="card card--msg"><h3>Üzenetek</h3><span class="sub">a legutóbbi 3</span><table class="tbl" style="margin-top:8px"><tr><th>Tárgy</th><th>Fajta</th><th>Mikor</th></tr>'+SITE.msgs.map(m=>'<tr><td class="s" style="font-weight:'+(m.u?700:500)+'">'+m.s+'</td><td><span class="chip '+(m.k==='Számla'?'chip--info':'')+'">'+m.k+'</span></td><td class="muted">'+m.d+'</td></tr>').join('')+'</table></div></div>'}
function photos(){const c=P[0];return noticeHtml()+'<div class="'+(selMode?'selmode':'')+'"><div class="pbento"><div class="cov"><img src="'+esc(c.url)+'" alt="'+esc(c.alt)+'"><span class="cov__tag">'+ic('starf',12)+'Nyitókép — így látja a vendég</span><div class="cov__b"><b>'+SITE.name+'</b><span>'+esc(c.alt||'Az első kép az oldal tetején')+'</span><button class="btn btn--sm" onclick="openLb(0)">'+ic('eye',15)+'Nagyítás</button></div></div>'+dropHtml()+'<div class="kpi"><span class="kpi__l">Könyvtár</span><span class="kpi__v">'+P.length+'</span><span class="kpi__s">'+(own?'saját fotó · 24-ből':'bemutató kép')+'</span></div></div>'+
 '<div class="fh"><h3>Minden kép</h3><span class="sub">húzással rendezhető · ★ = nyitókép</span>'+selBtn()+'</div><div class="grid">'+P.map((p,i)=>tile(p,i)).join('')+'</div>'+bulkHtml()+'</div>'}
function render(){const t=tabOf(cur);$('#nav').innerHTML=navHtml();$('#pnav').innerHTML=pnavHtml();$('#topMenu').innerHTML=ic('menu',18);$('#topBack').innerHTML=ic('back',18);$('#topBack').style.display=cur==='attekintes'?'none':'';$('#extBtn').innerHTML=ic('external',17);$('#outBtn').innerHTML=ic('logout',17);
  $('#ttl').innerHTML=(cur==='attekintes'?'Jó napot, Boróka ház!<small>'+new Date().toLocaleDateString('hu-HU',{weekday:'long',month:'long',day:'numeric'})+'</small>':t[1]+'<small>Boróka ház</small>');
  const v=$('#view');v.innerHTML=cur==='attekintes'?overview():cur==='fotok'?photos():stubHtml(cur);if(cur==='fotok')bindPhoto(v)}
render();pageDrop();`
};

// ═══════════════════════════════════════════════════════════════════════════
// 3 · MIDNIGHT — sötét mód, ragyogó akcent. Refs: ZusGPT (Dribbble 27394164), "dark mode by default"
// ═══════════════════════════════════════════════════════════════════════════
const V3 = {
  file: "admin2-3-midnight.html",
  title: "3 · „Midnight” — sötét mód, ragyogó akcent",
  refs: "ZusGPT report dashboard (Dribbble) · dark-mode-by-default trend · Sora + Inter",
  decides: `<b>Sötét alapból</b> (nem opció): mély kék-fekete vászon, egy fokkal világosabb panelek hajszál-kerettel, a logó ciánja <b>ragyogó gradiens</b> gombként és jelvényként. Bal sáv: menü + alul <b>előfizetés-kártya</b> (éves, megújul 2027. 09. 24., 7 modul) és a fiók. Fent <b>„← Vissza a műszerfalra”</b> pirula + állapot-jelvények. Az Áttekintés <b>műszerfal</b>: KPI-csempék + teendő- és üzenet-<b>táblázat</b> állapot-chipekkel. A Fotók alapból <b>táblázat</b> (bélyegkép · aláírás · forrás · nyitókép · sorrend · törlés) rács-váltóval; a feltöltés a fejléc gradiens gombjából nyílik.`,
  css: `
.frame{--font:Inter,system-ui,sans-serif;--fs:13.5px;--bg:#0b0f19;--panel:#121826;--field:#0f1420;--hover:#1a2133;--line:#1f2637;--ink:#e8ecf4;--muted:#8a93a6;--accent:linear-gradient(135deg,#1fb6d6,#5081ff);--accent-ink:#fff;--accent-glow:0 8px 24px rgba(31,182,214,.35);--ok:#3ddc97;--warn:#f5b453;--bad:#ff6b6b;--info:#6fb8ff;--rb:10px;--rc:14px}
.frame .btn--p{background:linear-gradient(135deg,#1fb6d6,#5081ff)}
.frame .bdg{background:linear-gradient(135deg,#1fb6d6,#5081ff)}
.frame .t__cover{background:linear-gradient(135deg,#1fb6d6,#5081ff);color:#fff}.frame .t__cover svg{color:#fff}
.frame .covb.is-on{background:linear-gradient(135deg,#1fb6d6,#5081ff);border-color:transparent;color:#fff}.frame .covb.is-on svg{color:#fff}
.frame .spark i{background:linear-gradient(180deg,#1fb6d6,#5081ff);opacity:1}
.shell{display:grid;grid-template-rows:auto 1fr auto;height:100%}
.side{display:none}
.top{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);background:#0e1320}
.backp{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:6px 12px 6px 8px;font-size:.88em;font-weight:600;cursor:pointer;background:var(--panel);white-space:nowrap}
.backp:hover{background:var(--hover)}
.top .sp{flex:1}
.top .stat{display:none;gap:6px}
.h{font-family:Sora,Inter,sans-serif;font-weight:600;letter-spacing:-.01em}
.main{overflow:auto;position:relative}
.main__in{padding:16px 14px 28px}
.ph{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.ph h1{font-size:1.4em;margin:0;flex:1}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.k{background:var(--panel);border:1px solid var(--line);border-radius:var(--rc);padding:14px}
.k__l{font-size:.78em;color:var(--muted);display:flex;align-items:center;gap:6px}
.k__v{font-family:Sora,Inter,sans-serif;font-size:1.6em;font-weight:600;margin-top:6px;letter-spacing:-.01em}
.k__s{font-size:.76em;color:var(--muted);margin-top:4px}
.k .spark{margin-top:8px;height:24px}
.k--glow{background:radial-gradient(120% 120% at 100% 0%,rgba(80,129,255,.25),transparent 55%),var(--panel)}
.tblw{background:var(--panel);border:1px solid var(--line);border-radius:var(--rc);overflow:hidden;margin-bottom:14px}
.tblw__h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.tblw__h b{font-family:Sora,Inter,sans-serif;font-size:.95em}.tblw__h .sp{flex:1}
.tbl{width:100%;border-collapse:collapse;font-size:.9em}
.tbl th{text-align:left;font-weight:500;color:var(--muted);font-size:.8em;padding:8px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
.tbl td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.tbl tr:last-child td{border-bottom:0}.tbl tr[onclick]{cursor:pointer}.tbl tr[onclick]:hover td{background:var(--hover)}
.tbl .s{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tbl .sm{display:none}
.ptbl td{padding:8px 10px}
.ptbl img{width:64px;height:48px;object-fit:cover;border-radius:6px;display:block;cursor:zoom-in;background:var(--hover)}
.ptbl .cap input{width:100%;min-width:120px;border:1px solid transparent;border-radius:8px;padding:6px 8px;font:500 .95em var(--font);background:var(--field);color:var(--ink)}
.ptbl .cap input:focus{outline:0;border-color:#1fb6d6}
.ptbl .ord{display:inline-flex;gap:3px}
.ptbl tr.is-cover td:first-child{box-shadow:inset 3px 0 0 #1fb6d6}
.ptbl tr.is-sel td{background:rgba(31,182,214,.12)}
.ptbl .g{color:var(--muted);cursor:grab;display:inline-flex;align-items:center;gap:4px;font-size:.85em}
.ptbl .r__chk{display:none}.selmode .ptbl .r__chk{display:inline-flex}.selmode .ptbl .g{display:none}
.ptbl tr.is-drag td{opacity:.4}.ptbl tr.is-over td{box-shadow:inset 0 -2px 0 #1fb6d6}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.t{border-radius:10px}.t__acts{display:none}.t__cap{display:none}
.t:hover .t__acts{display:flex;position:absolute;left:4px;right:4px;bottom:4px;padding:3px;background:rgba(11,15,25,.85);border-radius:8px}
.bnav{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--line);background:#0e1320;padding:6px 6px calc(6px + env(safe-area-inset-bottom))}
.bnav a{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;color:var(--muted);font-size:.7em;font-weight:600;text-decoration:none;cursor:pointer;border-radius:10px;position:relative}
.bnav a.is-active{color:#fff}.bnav a.is-active svg{color:#1fb6d6;filter:drop-shadow(0 0 6px rgba(31,182,214,.8))}
.bnav a .bdg{position:absolute;top:2px;right:calc(50% - 20px)}
@container (min-width:900px){
  .shell{grid-template-columns:250px 1fr;grid-template-rows:auto 1fr}
  .side{grid-row:1/3}
  .side{display:flex;flex-direction:column;background:#0e1320;border-right:1px solid var(--line);padding:16px 12px}
  .side__brand{display:flex;align-items:center;gap:10px;font-family:Sora,Inter,sans-serif;font-weight:600;font-size:1.05em;padding:2px 8px 18px;color:#fff}
  .nav{display:flex;flex-direction:column;gap:2px;flex:1}
  .nav a{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--muted);font-size:.95em;font-weight:500;text-decoration:none;cursor:pointer;position:relative}
  .nav a:hover{background:var(--hover);color:#fff}
  .nav a.is-active{background:linear-gradient(90deg,rgba(31,182,214,.18),rgba(80,129,255,.08));color:#fff}
  .nav a.is-active::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:linear-gradient(#1fb6d6,#5081ff)}
  .nav a .bdg{margin-left:auto}.nav a .tag{margin-left:auto;font-size:.68em;font-weight:700;padding:2px 7px;border-radius:999px;background:linear-gradient(135deg,#1fb6d6,#5081ff);color:#fff}
  .plan{background:radial-gradient(120% 100% at 100% 0%,rgba(80,129,255,.35),transparent 60%),var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;font-size:.85em}
  .plan b{display:flex;align-items:center;gap:6px;font-family:Sora,Inter,sans-serif;font-size:1em}
  .plan small{display:block;color:var(--muted);margin:3px 0 8px}
  .plan .bars{display:flex;gap:2px;height:14px;margin-bottom:8px}.plan .bars i{flex:1;border-radius:2px;background:linear-gradient(180deg,#1fb6d6,#5081ff)}.plan .bars i.z{background:var(--line)}
  .user{display:flex;align-items:center;gap:9px;padding:12px 8px 2px;font-size:.88em}
  .user .av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1fb6d6,#5081ff);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:.72em;color:#fff}
  .user small{display:block;color:var(--muted)}.user .ib{margin-left:auto;border:0;background:transparent;color:var(--muted)}
  .top{padding:12px 28px}.top .stat{display:inline-flex}
  #topMenu{display:none}
  .main__in{padding:22px 32px 32px;max-width:1080px}
  .ph h1{font-size:1.7em}
  .kpis{grid-template-columns:repeat(4,1fr)}
  .tbl .sm{display:table-cell}
  .grid{grid-template-columns:repeat(6,1fr)}
  .bnav{display:none}
}`,
  body: `
<div class="shell">
  <aside class="side"><div class="side__brand">${LOGO('#fff')}Citoviso</div><nav class="nav" id="nav"></nav><div class="plan" id="plan"></div><div class="user"><span class="av">BH</span><span>Boróka ház<small>boroka-haz</small></span><button class="ib" title="Kilépés" onclick="toast('Kilépés')" id="outBtn"></button></div></aside>
  <div class="top"><button class="ib ib--ghost" id="topMenu" onclick="openDrawer()"></button><span class="backp" id="backp" onclick="back()"></span><span class="sp"></span><span class="stat" id="stat"></span><button class="btn btn--sm btn--p" id="priBtn"></button></div>
  <main class="main" id="main"><div class="main__in" id="view"></div></main>
  <nav class="bnav" id="bnav"></nav>
</div>`,
  js: `
function navHtml(){return TABS.map(t=>'<a class="'+(t[0]===cur?'is-active':'')+'" onclick="go(\\''+t[0]+'\\')">'+ic(t[2],17)+t[1]+badge(t[0])+(t[0]==='fotok'&&!own?'<span class="tag">Teendő</span>':'')+'</a>').join('')}
const BOTTOM=['attekintes','fotok','foglalasok','uzenetek'];
function bnavHtml(){return BOTTOM.map(id=>{const t=tabOf(id);return '<a class="'+(cur===id?'is-active':'')+'" onclick="go(\\''+id+'\\')">'+ic(t[2],20)+t[1]+badge(id)+'</a>'}).join('')+'<a class="'+(!BOTTOM.includes(cur)?'is-active':'')+'" onclick="openDrawer()">'+ic('menu',20)+'Menü</a>'}
function openDrawer(){$('#sheet').innerHTML='<div class="drawer__box"><div class="sheet__h">'+${JSON.stringify(LOGO('#fff'))}+'<b>Citoviso</b><span class="sp"></span><button class="ib ib--ghost" onclick="closeSheet()">'+ic('close',18)+'</button></div><div class="menu">'+TABS.map(t=>'<a class="'+(t[0]===cur?'is-active':'')+'" onclick="closeSheet();go(\\''+t[0]+'\\')">'+ic(t[2],17)+t[1]+badge(t[0])+'</a>').join('')+'<div class="g">'+SITE.sub.plan+' · megújul '+SITE.sub.renews+'</div><a onclick="closeSheet();toast(\\'Kilépés\\')">'+ic('logout',17)+'Kilépés</a></div></div>';$('#sheet').classList.add('on')}
function overview(){return '<div class="ph"><h1 class="h">Műszerfal</h1><span class="chip chip--ok"><i></i>Élő</span></div>'+
 '<div class="kpis"><div class="k k--glow"><span class="k__l">'+ic('report',14)+'Látogatók · 7 nap</span><div class="k__v">'+SITE.visitors7+'</div><div class="k__s">egyedi, robotok nélkül</div>'+sparkHtml(SITE.visits7)+'</div>'+
 '<div class="k"><span class="k__l">'+ic('photos',14)+'Fotók</span><div class="k__v">'+P.length+'</div><div class="k__s">'+(own?'saját fotó':'bemutató kép — cserélje')+'</div></div>'+
 '<div class="k"><span class="k__l">'+ic('mail',14)+'Üzenetek</span><div class="k__v">'+SITE.unread+'</div><div class="k__s">olvasatlan</div></div>'+
 '<div class="k"><span class="k__l">'+ic('card',14)+'Előfizetés</span><div class="k__v" style="font-size:1.05em">'+SITE.sub.plan+'</div><div class="k__s">megújul '+SITE.sub.renews+' · '+SITE.modules+' modul</div></div></div>'+
 '<div class="tblw"><div class="tblw__h"><b>Teendők</b><span class="sp"></span><span class="muted" style="font-size:.8em">'+(own?'0':'1')+' nyitott</span></div><table class="tbl"><tr><th>Feladat</th><th class="sm">Hol</th><th>Állapot</th></tr>'+
 (own?'<tr onclick="go(\\'fotok\\')"><td class="s">Saját fotók feltöltése</td><td class="sm muted">Fotók</td><td><span class="chip chip--ok"><i></i>Kész</span></td></tr>':'<tr onclick="go(\\'fotok\\')"><td class="s"><b>Töltsön fel saját fotókat</b> — bemutató képek láthatók</td><td class="sm muted">Fotók</td><td><span class="chip chip--warn"><i></i>Függő</span></td></tr>')+
 '<tr onclick="go(\\'szovegek\\')"><td class="s">Bemutatkozó szöveg</td><td class="sm muted">Szövegek</td><td><span class="chip chip--ok"><i></i>Kész</span></td></tr><tr><td class="s">Az oldal élő és nyilvános</td><td class="sm muted">Webcím</td><td><span class="chip chip--ok"><i></i>Kész</span></td></tr></table></div>'+
 '<div class="tblw"><div class="tblw__h"><b>Üzenetek</b><span class="sp"></span><button class="btn btn--sm" onclick="go(\\'uzenetek\\')">Mind</button></div><table class="tbl"><tr><th>Tárgy</th><th class="sm">Fajta</th><th>Mikor</th></tr>'+SITE.msgs.map(m=>'<tr onclick="go(\\'uzenetek\\')"><td class="s" style="font-weight:'+(m.u?600:400)+'">'+(m.u?'<span style="color:#1fb6d6">● </span>':'')+m.s+'</td><td class="sm"><span class="chip chip--info">'+m.k+'</span></td><td class="muted">'+m.d+'</td></tr>').join('')+'</table></div>'}
function ptable(){return '<div class="tblw"><table class="tbl ptbl"><tr><th>#</th><th>Kép</th><th>Képaláírás</th><th class="sm">Forrás</th><th>Nyitókép</th><th class="sm">Sorrend</th><th></th></tr>'+P.map((p,i)=>'<tr class="'+(i===0?'is-cover':'')+(sel.has(i)?' is-sel':'')+'" data-i="'+i+'"><td><span class="g">'+ic('grip',14)+(i+1)+'</span><span class="r__chk" onclick="toggleSel('+i+')">'+ic('check',14)+'</span></td><td><img src="'+esc(p.url)+'" alt="'+esc(p.alt)+'" loading="lazy" onclick="'+(selMode?'toggleSel('+i+')':'openLb('+i+')')+'"></td><td class="cap"><input maxlength="160" value="'+esc(p.alt)+'" placeholder="Mi látszik a képen?" onchange="setCaption('+i+',this.value);toast(\\'Képaláírás mentve\\')"></td><td class="sm"><span class="chip chip--mute">'+(own?'saját':'bemutató')+'</span></td><td>'+(i===0?'<button class="covb is-on">'+ic('starf',12)+'Nyitókép</button>':'<button class="covb" onclick="move('+i+',\\'cover\\')">'+ic('star',12)+'Legyen</button>')+'</td><td class="sm"><span class="ord"><button class="ib" '+(i===0?'disabled':'')+' onclick="move('+i+',\\'up\\')">'+ic('arrowup',14)+'</button><button class="ib" '+(i===P.length-1?'disabled':'')+' onclick="move('+i+',\\'down\\')" style="transform:rotate(180deg)">'+ic('arrowup',14)+'</button></span></td><td>'+(own?'<button class="ib ib--ghost" style="color:var(--bad)" onclick="del(['+i+'])">'+ic('trash',15)+'</button>':'')+'</td></tr>').join('')+'</table></div>'}
function photos(){return '<div class="ph"><h1 class="h">Fotók</h1><span class="seg"><button class="'+(view==='grid'?'':'on')+'" onclick="setView(\\'list\\')">'+ic('list',14)+'Táblázat</button><button class="'+(view==='grid'?'on':'')+'" onclick="setView(\\'grid\\')">'+ic('grid',14)+'Rács</button></span>'+selBtn()+'</div>'+noticeHtml()+'<div class="'+(selMode?'selmode':'')+'">'+(view==='grid'?'<div class="grid">'+P.map((p,i)=>tile(p,i)).join('')+'</div>':ptable())+bulkHtml()+'</div>'}
function render(){const t=tabOf(cur);$('#nav').innerHTML=navHtml();$('#bnav').innerHTML=bnavHtml();$('#topMenu').innerHTML=ic('menu',18);$('#outBtn').innerHTML=ic('logout',16);
  $('#plan').innerHTML='<b>'+ic('card',14)+SITE.sub.plan+'</b><small>megújul '+SITE.sub.renews+' · '+SITE.modules+' modul aktív</small><div class="bars">'+Array.from({length:12},(_,i)=>'<i class="'+(i<1?'':'z')+'"></i>').join('')+'</div><button class="btn btn--sm" style="width:100%" onclick="go(\\'modulok\\')">Modulok kezelése</button>';
  $('#backp').innerHTML=ic('back',15)+(cur==='attekintes'?'Boróka ház':'Vissza a műszerfalra');$('#backp').onclick=()=>cur==='attekintes'?null:go('attekintes');
  $('#stat').innerHTML='<span class="chip chip--ok"><i></i>Élő</span><span class="chip">'+(own?'saját fotók':'bemutató fotók')+'</span>';
  $('#priBtn').innerHTML=cur==='fotok'?ic('upload',14)+'Fotók feltöltése':ic('external',14)+'Oldal megtekintése';$('#priBtn').onclick=()=>cur==='fotok'?openUploadUi():toast('Megnyílik az oldala új lapon');
  const v=$('#view');v.innerHTML=cur==='attekintes'?overview():cur==='fotok'?photos():'<div class="ph"><h1 class="h">'+t[1]+'</h1></div>'+stubHtml(cur);
  if(cur==='fotok'){bindDnd(v);$('#fileInp').onchange=()=>ingest($('#fileInp').files)}}
view='list';render();pageDrop();`
};

// ═══════════════════════════════════════════════════════════════════════════
// 4 · ENTERPRISE — kék oldalsáv fa-menüvel, kontextus-sáv, adattáblák. Refs: BowlsLink (Dribbble 27190129)
// ═══════════════════════════════════════════════════════════════════════════
const V4 = {
  file: "admin2-4-enterprise.html",
  title: "4 · „Enterprise” — fa-menü, kontextus-sáv, adattáblák",
  refs: "BowlsLink sports dashboard (Dribbble) · klasszikus SaaS-admin (Stripe/HubSpot-szerű) · DM Sans",
  decides: `<b>Kék oldalsáv nyitható fa-menüvel</b> (Fotók ▸ Galéria / Nyitókép / Feltöltés; Foglalások ▸ Kérések / Naptár / Árak — a mai lapos 11 gomb helyett hierarchia), a tetején <b>oldal-választó</b>. Fent <b>kontextus-sáv</b> útvonallal (Oldalam / Fotók) és nyelv-/fiók-választóval; a lapfejlécben <b>‹ cím</b>, alcím, jobbra a műveletek (Oldal megtekintése · Feltöltés · ⋮). Az Áttekintés <b>kulcs–érték áttekintő kártya</b> + üzenet-lista avatárral + állapot-számlálók + „Legutóbbi foglalási kérések” tábla (üres állapottal, mert nincs kérés). A Fotók: áttekintő kártya + <b>adattábla</b> fejléccel és soronkénti ⋮ menüvel (Nyitókép / Előrébb / Hátrébb / Törlés), rács-váltóval.`,
  css: `
.frame{--font:"DM Sans",Inter,system-ui,sans-serif;--fs:14px;--bg:#f5f7fa;--panel:#fff;--field:#f5f7fa;--hover:#eef2f7;--line:#e3e8ef;--ink:#1c2430;--muted:#66717f;--accent:#1d6fe0;--accent-ink:#fff;--ok:#1b8a4c;--warn:#b26a08;--bad:#c93a41;--info:#1d6fe0;--rb:8px;--rc:12px}
.shell{display:grid;grid-template-rows:auto 1fr;height:100%}
.side{display:none}
.ctx{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border-bottom:1px solid var(--line);font-size:.9em}
.ctx .crumb{flex:1;min-width:0;display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden}
.ctx .crumb a{color:var(--muted);cursor:pointer}.ctx .crumb b{font-weight:600}.ctx .crumb svg{color:#b9c2ce}
.ctx .sel{display:none;align-items:center;gap:6px;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-weight:500;background:#fff;cursor:pointer}
.main{overflow:auto;position:relative}
.main__in{padding:14px 14px 28px}
.ph{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-bottom:12px}
.ph__t{flex:1;min-width:0}
.ph h1{font-size:1.35em;margin:0;font-weight:700;display:flex;align-items:center;gap:6px}
.ph h1 .ib{width:28px;height:28px;border:0;background:transparent}
.ph .sub{color:var(--muted);font-size:.86em;margin:2px 0 0 34px}
.ph__acts{display:flex;gap:6px;flex-wrap:wrap}
.meta{display:flex;gap:14px;flex-wrap:wrap;font-size:.86em;color:var(--muted);margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.meta b{color:var(--ink);font-weight:600}
.cards{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px}
.cards>.card{min-width:0}
.msg span{flex:1}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--rc)}
.card__h{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);font-weight:600;font-size:.95em}
.card__h .sp{flex:1}.card__h .ib{width:26px;height:26px;border:0}
.card__b{padding:12px 14px}
.kv{gap:9px 12px}
.msg{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:.88em;cursor:pointer}
.msg:first-child{border-top:0}
.msg .av{width:30px;height:30px;border-radius:50%;background:#e3e8ef;color:#1c2430;display:inline-flex;align-items:center;justify-content:center;font-size:.72em;font-weight:700;flex:0 0 auto}
.msg .av.is-u{background:#1d6fe0;color:#fff}
.msg span{min-width:0}.msg span b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.msg span small{color:var(--muted)}
.stat2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.st{border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px}
.st .ic{width:36px;height:36px;border-radius:9px;background:#eaf2fd;color:#1d6fe0;display:inline-flex;align-items:center;justify-content:center}
.st b{font-size:1.3em;display:block;line-height:1}.st small{color:var(--muted)}
.tbl{width:100%;border-collapse:collapse;font-size:.88em}
.tbl th{text-align:left;font-size:.74em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:9px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
.tbl td{padding:9px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.tbl tr:last-child td{border-bottom:0}
.tbl .sm{display:none}
.empty{padding:26px 14px;text-align:center;color:var(--muted);font-size:.9em}
.empty svg{color:#b9c2ce;margin-bottom:6px}
.tbar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.tbar .srch{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:8px;padding:6px 10px;color:var(--muted);font-size:.86em;flex:1;min-width:140px}
.progline{height:4px;background:var(--line)}.progline i{display:block;height:100%;background:var(--accent);transition:width .3s}
.ptbl img{width:60px;height:45px;object-fit:cover;border-radius:6px;display:block;cursor:zoom-in;background:var(--hover)}
.ptbl .cap input{width:100%;min-width:110px;border:1px solid transparent;border-radius:8px;padding:6px 8px;font:500 .95em var(--font);background:var(--field);color:var(--ink)}
.ptbl .cap input:focus{outline:0;border-color:var(--accent);background:#fff}
.ptbl tr.is-cover td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
.ptbl tr.is-sel td{background:#eaf2fd}
.ptbl .g{color:var(--muted);cursor:grab;display:inline-flex;align-items:center;gap:4px;font-size:.85em}
.ptbl .r__chk{display:none}.selmode .ptbl .r__chk{display:inline-flex}.selmode .ptbl .g{display:none}
.ptbl tr.is-drag td{opacity:.4}.ptbl tr.is-over td{box-shadow:inset 0 -2px 0 var(--accent)}
.kmenu{position:absolute;z-index:65;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 16px 40px rgba(16,24,40,.18);padding:6px;min-width:190px;display:none}
.kmenu.on{display:block}
.kmenu a{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;font-size:.9em;cursor:pointer;text-decoration:none;color:var(--ink)}
.kmenu a:hover{background:var(--hover)}.kmenu a.is-d{color:var(--bad)}.kmenu a[aria-disabled]{opacity:.4;pointer-events:none}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px}
.t{border-radius:8px}
@container (min-width:900px){
  .shell{grid-template-columns:256px 1fr;grid-template-rows:auto 1fr}
  .side{grid-row:1/3}
  .side{display:flex;flex-direction:column;background:#0e2a47;color:#d6e2f0;padding:16px 12px;overflow:auto}
  .side__brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:1.05em;color:#fff;padding:0 8px 14px}
  .side__site{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;font-size:.9em;font-weight:600;color:#fff;margin-bottom:12px;cursor:pointer}
  .side__site .sp{flex:1}
  .nav{display:flex;flex-direction:column;gap:1px;flex:1}
  .nav a{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;color:#c4d3e4;font-size:.95em;font-weight:500;text-decoration:none;cursor:pointer}
  .nav a:hover{background:rgba(255,255,255,.07);color:#fff}
  .nav a.is-active{color:#fff;font-weight:600}
  .nav a.is-active svg{color:#1fb6d6}
  .nav a .chev{margin-left:auto;transition:transform .15s}.nav a.is-open .chev{transform:rotate(180deg)}
  .nav a .bdg{margin-left:auto;background:#1fb6d6;color:#06131b}
  .nav .sub{display:none;flex-direction:column;margin:0 0 4px 21px;border-left:1px solid rgba(255,255,255,.14);padding-left:6px}
  .nav .sub.is-open{display:flex}
  .nav .sub a{padding:7px 10px;font-size:.88em;color:#a9bbd0}.nav .sub a.is-active{color:#fff;background:rgba(255,255,255,.08)}
  .side__foot{border-top:1px solid rgba(255,255,255,.14);padding-top:10px;font-size:.82em;color:#a9bbd0;display:flex;justify-content:space-between;align-items:center}
  .side__foot a{color:#fff;cursor:pointer;font-weight:600}
  .ctx{padding:10px 28px}.ctx .sel{display:inline-flex}
  #ctxMenu{display:none}
  .main__in{padding:20px 28px 32px;max-width:1100px}
  .ph{flex-direction:row;align-items:flex-start}
  .ph h1{font-size:1.6em}
  .cards{grid-template-columns:1.3fr 1.4fr 1fr}
  .tbl .sm{display:table-cell}
  .grid{grid-template-columns:repeat(6,1fr)}
}`,
  body: `
<div class="shell">
  <aside class="side"><div class="side__brand">${LOGO('#fff')}Citoviso</div><div class="side__site">${LOGO('#0e2a47').replace('width="26" height="26"','width="18" height="18"')}<span class="sp">Boróka ház</span>${''}<span id="siteChev"></span></div><nav class="nav" id="nav"></nav><div class="side__foot"><span>boroka-haz</span><a onclick="toast('Kilépés')">Kilépés</a></div></aside>
  <div class="ctx"><button class="ib ib--ghost" id="ctxMenu" onclick="openDrawer()"></button><div class="crumb" id="crumb"></div><span class="sel">HU ${''}<span id="c1"></span></span><span class="sel">boroka-haz <span id="c2"></span></span></div>
  <main class="main" id="main"><div class="main__in" id="view"></div></main>
  <div class="kmenu" id="kmenu"></div>
</div>`,
  js: `
const TREE={fotok:['Galéria','Nyitókép','Feltöltés'],foglalasok:['Kérések','Naptár','Árak'],modulok:['Aktív modulok','Bővítés','Számlázás']};
let openT=new Set(['fotok']);
function navHtml(){return TABS.map(t=>{const kids=TREE[t[0]];const op=openT.has(t[0])||cur===t[0];return '<a class="'+(t[0]===cur?'is-active':'')+(op&&kids?' is-open':'')+'" onclick="'+(kids?'toggleT(\\''+t[0]+'\\');':'')+'go(\\''+t[0]+'\\')">'+ic(t[2],17)+t[1]+(kids?'<span class="chev">'+ic('chev',14)+'</span>':badge(t[0]))+'</a>'+(kids?'<div class="sub'+(op?' is-open':'')+'">'+kids.map((k,i)=>'<a class="'+(t[0]===cur&&i===0?'is-active':'')+'" onclick="go(\\''+t[0]+'\\');toast(\\''+k+'\\')">'+k+'</a>').join('')+'</div>':'')}).join('')}
function toggleT(id){if(openT.has(id))openT.delete(id);else openT.add(id)}
function openDrawer(){$('#sheet').innerHTML='<div class="drawer__box" style="background:#0e2a47;color:#fff;border:0"><div class="sheet__h">'+${JSON.stringify(LOGO('#fff'))}+'<b>Boróka ház</b><span class="sp"></span><button class="ib ib--ghost" style="color:#fff" onclick="closeSheet()">'+ic('close',18)+'</button></div><div class="menu">'+TABS.map(t=>'<a style="color:#fff" class="'+(t[0]===cur?'is-active':'')+'" onclick="closeSheet();go(\\''+t[0]+'\\')">'+ic(t[2],17)+t[1]+badge(t[0])+(TREE[t[0]]?'<small style="margin-left:auto;opacity:.6">'+TREE[t[0]].join(' · ')+'</small>':'')+'</a>').join('')+'<a style="color:#fff" onclick="closeSheet();toast(\\'Kilépés\\')">'+ic('logout',17)+'Kilépés</a></div></div>';$('#sheet').classList.add('on');$$('.menu a.is-active',$('#sheet')).forEach(a=>a.style.background='rgba(255,255,255,.12)')}
function kmenu(ev,i){ev.stopPropagation();const m=$('#kmenu');const r=ev.currentTarget.getBoundingClientRect(),f=$('#frame').getBoundingClientRect();
  m.innerHTML='<a onclick="closeK();move('+i+',\\'cover\\')" '+(i===0?'aria-disabled="true"':'')+'>'+ic('star',15)+'Legyen ez a nyitókép</a><a onclick="closeK();openLb('+i+')">'+ic('eye',15)+'Nagyítás</a><a onclick="closeK();move('+i+',\\'up\\')" '+(i===0?'aria-disabled="true"':'')+'>'+ic('arrowup',15)+'Előrébb</a><a onclick="closeK();move('+i+',\\'down\\')" '+(i===P.length-1?'aria-disabled="true"':'')+'><span style="transform:rotate(180deg);display:inline-flex">'+ic('arrowup',15)+'</span>Hátrébb</a>'+(own?'<a class="is-d" onclick="closeK();del(['+i+'])">'+ic('trash',15)+'Törlés</a>':'<a aria-disabled="true">'+ic('trash',15)+'Bemutató kép — nem törölhető</a>');
  m.classList.add('on');const w=m.offsetWidth;m.style.left=Math.min(r.right-f.left-w,f.width-w-8)+'px';m.style.top=(r.bottom-f.top+4)+'px'}
function closeK(){$('#kmenu').classList.remove('on')}
document.addEventListener('click',e=>{if(!e.target.closest('#kmenu'))closeK()});
function overview(){return '<div class="ph"><div class="ph__t"><h1>Áttekintés</h1><div class="sub">'+SITE.name+' · '+SITE.town+'</div></div><div class="ph__acts"><button class="btn btn--sm" onclick="toast(\\'Megnyílik az oldala új lapon\\')">'+ic('external',14)+'Oldal megtekintése</button><button class="btn btn--sm btn--p" onclick="go(\\'fotok\\')">'+ic('upload',14)+'Fotók feltöltése</button></div></div>'+
 '<div class="meta"><span>Állapot: <span class="chip chip--ok"><i></i>Élő</span></span><span>Cím: <b>'+SITE.url+'</b></span><span>Előfizetés: <b>'+SITE.sub.plan+'</b> · megújul '+SITE.sub.renews+'</span></div>'+
 '<div class="cards"><div class="card"><div class="card__h">'+ic('home',16)+'Az oldal áttekintése<span class="sp"></span></div><div class="card__b kv"><span>Típus</span><b>Szállás · Siófok</b><span>Állapot</span><b><span class="chip chip--ok"><i></i>Élő</span></b><span>Fotók</span><b>'+P.length+' '+(own?'saját':'bemutató')+'</b><span>Bemutatkozó</span><b>kész</b><span>Modulok</span><b>'+SITE.modules+' aktív · '+SITE.billed+' számlázott</b><span>Előfizetés</span><b>éves · '+SITE.sub.renews+'</b><span>Látogatók (7 nap)</span><b>'+SITE.visitors7+'</b></div></div>'+
 '<div class="card"><div class="card__h">'+ic('mail',16)+'Üzenetek<span class="sp"></span><span class="bdg">'+SITE.unread+'</span></div><div class="card__b">'+SITE.msgs.map(m=>'<div class="msg" onclick="go(\\'uzenetek\\')"><span class="av'+(m.u?' is-u':'')+'">'+(m.k==='Számla'?'SZ':'BE')+'</span><span><b>'+m.s+'</b><small>'+m.k+' · '+m.d+'</small></span></div>').join('')+'</div></div>'+
 '<div class="card"><div class="card__h">'+ic('checkc',16)+'Teendők<span class="sp"></span></div><div class="card__b"><div class="stat2"><div class="st"><span class="ic">'+ic('alert',18)+'</span><span><b>'+(own?0:1)+'</b><small>nyitott teendő</small></span></div><div class="st"><span class="ic">'+ic('checkc',18)+'</span><span><b>'+(own?3:2)+'</b><small>kész</small></span></div></div>'+(own?'':'<div class="msg" style="margin-top:10px" onclick="go(\\'fotok\\')"><span class="av is-u">!</span><span><b>Töltsön fel saját fotókat</b><small>bemutató képek láthatók — élesítés előtt</small></span></div>')+'</div></div></div>'+
 '<div class="card"><div class="tbar"><b style="font-size:.95em">Legutóbbi foglalási kérések</b><span class="sp"></span><button class="btn btn--sm" onclick="go(\\'foglalasok\\')">Mind</button></div><table class="tbl"><tr><th>Érkezett</th><th>Vendég</th><th class="sm">Időszak</th><th>Fő</th><th>Állapot</th></tr></table><div class="empty">'+ic('bookings',24)+'<br>Még nem érkezett foglalási kérés.</div></div>'}
function photos(){return '<div class="ph"><div class="ph__t"><h1><button class="ib" onclick="back()">'+ic('back',18)+'</button>Fotók</h1><div class="sub">'+P.length+' kép · az első a nyitókép</div></div><div class="ph__acts"><button class="btn btn--sm" onclick="toast(\\'Megnyílik az oldala új lapon\\')">'+ic('external',14)+'Oldal</button><button class="btn btn--sm btn--p" onclick="openUploadUi()">'+ic('upload',14)+'Feltöltés</button>'+selBtn()+'</div></div>'+
 '<div class="meta"><span>Forrás: <b>'+(own?'saját fotók':'bemutató (portál/Maps)')+'</b></span><span>Nyitókép: <b>1. kép</b></span><span>Könyvtár: <b>'+(own?P.length:0)+' / 24</b></span></div>'+noticeHtml()+
 '<div class="'+(selMode?'selmode':'')+'"><div class="card"><div class="tbar"><span class="srch">'+ic('search',14)+'Keresés az aláírásokban…</span><span class="seg"><button class="'+(view==='grid'?'':'on')+'" onclick="setView(\\'list\\')">'+ic('list',14)+'Tábla</button><button class="'+(view==='grid'?'on':'')+'" onclick="setView(\\'grid\\')">'+ic('grid',14)+'Rács</button></span></div>'+
 (view==='grid'?'<div class="grid">'+P.map((p,i)=>tile(p,i)).join('')+'</div>':'<table class="tbl ptbl"><tr><th>Sorrend</th><th>Kép</th><th>Képaláírás</th><th class="sm">Forrás</th><th>Nyitókép</th><th></th></tr>'+P.map((p,i)=>'<tr class="'+(i===0?'is-cover':'')+(sel.has(i)?' is-sel':'')+'" data-i="'+i+'"><td><span class="g">'+ic('grip',14)+(i+1)+'</span><span class="r__chk" onclick="toggleSel('+i+')">'+ic('check',14)+'</span></td><td><img src="'+esc(p.url)+'" alt="'+esc(p.alt)+'" loading="lazy" onclick="'+(selMode?'toggleSel('+i+')':'openLb('+i+')')+'"></td><td class="cap"><input maxlength="160" value="'+esc(p.alt)+'" placeholder="Mi látszik a képen?" onchange="setCaption('+i+',this.value);toast(\\'Képaláírás mentve\\')"></td><td class="sm"><span class="chip chip--mute">'+(own?'saját':'bemutató')+'</span></td><td>'+(i===0?'<span class="chip chip--info">'+ic('starf',11)+'Nyitókép</span>':'<span class="muted">—</span>')+'</td><td><button class="ib ib--ghost" onclick="kmenu(event,'+i+')">'+ic('more',16)+'</button></td></tr>').join('')+'</table>')+'</div>'+bulkHtml()+'</div>'}
function render(){const t=tabOf(cur);$('#nav').innerHTML=navHtml();$('#ctxMenu').innerHTML=ic('menu',18);$('#c1').innerHTML=ic('chev',13);$('#c2').innerHTML=ic('chev',13);$('#siteChev').innerHTML=ic('chev',14);
  $('#crumb').innerHTML='<a onclick="go(\\'attekintes\\')">Oldalam</a>'+(cur==='attekintes'?'':ic('fwd',13)+'<b>'+t[1]+'</b>');
  const v=$('#view');v.innerHTML=cur==='attekintes'?overview():cur==='fotok'?photos():'<div class="ph"><div class="ph__t"><h1><button class="ib" onclick="back()">'+ic('back',18)+'</button>'+t[1]+'</h1></div></div>'+stubHtml(cur);
  if(cur==='fotok'){bindDnd(v);$('#fileInp').onchange=()=>ingest($('#fileInp').files)}}
view='list';render();pageDrop();`
};

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Sora:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`;
function page(v) {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TERV — ${v.title}</title>${FONTS}<style>${ENGINE_CSS}${v.css}</style></head>
<body data-size="mobile">
<div class="pl"><h1>${v.title}</h1>
<p><b>Referencia:</b> ${v.refs}<br><b>Amit eldönt:</b> ${v.decides}<br><span style="color:#7a5a12">Minta-adat (dev-DB, 2026-09-24): a Boróka ház 16 VALÓS fotója (bemutató = portál/Maps), 3 e-mail (2 olvasatlan), 0 foglalási kérés, 1 látogató az elmúlt 7 napban, éves előfizetés (megújul 2027. 09. 24.), 7 modul. A feltöltés a valódi szabályokkal: JPEG/PNG/WEBP · ≤ 6 MB · max. 12 egyszerre · 24 a könyvtárban · az első feltöltés LECSERÉLI a bemutató képeket · bemutató kép nem törölhető. Sorrend, nyitókép, aláírás, kijelölés+törlés, nagyítás, vissza-navigáció (böngésző Vissza is) működik.</span></p>
<div class="szw"><button id="bM" class="on" onclick="setSize('mobile')">Mobil 390px</button><button id="bD" onclick="setSize('desktop')">Asztali</button></div></div>
<div class="stage"><div class="frame" id="frame">${v.body}
<div class="lb" id="lb"></div><div class="dlg" id="dlg"></div><div class="sheet" id="sheet" onclick="if(event.target===this)this.classList.remove('on')"></div><div class="pageover" id="pageover">Engedje el — feltöltjük</div><div class="toast" id="toast"></div>
<input type="file" id="fileInp" accept="image/jpeg,image/png,image/webp" multiple hidden>
</div></div>
<script>${ENGINE_JS}${v.js}</script></body></html>`;
}
export { PHOTOS, ICON, TABS, GROUPS, LOGO, ENGINE_CSS, ENGINE_JS, FONTS, page, V1 };
if (process.argv[1] && process.argv[1].endsWith("gen2.mjs")) for (const v of [V1, V2, V3, V4]) { writeFileSync(`${OUT}/${v.file}`, page(v)); console.log("wrote", v.file); }
