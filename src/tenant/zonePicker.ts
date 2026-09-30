// ADR-0290 — the accommodation time-zone picker, ONE renderer for both surfaces that set
// it (tenant admin „Fiók" tab, console lead page). Frozen plan:
// assets/design-refs/tenant-admin/szallas-idozona/ (variant A).
//
// Works without JS: a native <select> of every IANA zone posts `time_zone`; the server
// validates it (isValidTimeZone) and never stores free text. The script only ADDS the
// search box, the live "most itt" clock, the country-default warning and the reset link.

import { T } from "../i18n/mail.js";
import { COUNTRY_DEFAULT_TIME_ZONE, offsetLabelIn } from "../text/zoneTime.js";

export interface ZonePickerData {
  /** The stored zone (tenant.time_zone). */
  readonly timeZone: string;
  /** The accommodation's country (ISO alpha-2), when known. */
  readonly country: string | null;
  /** The zone a new accommodation in that country starts with. */
  readonly countryDefault: string;
}

/** Hungarian names for the zones an owner is likely to search by (the rest: the IANA city). */
function aliases(lang: string): Record<string, string> {
  return {
    "Europe/Budapest": T(lang, "Budapest"),
    "Europe/Vienna": T(lang, "Bécs"),
    "Europe/Bratislava": T(lang, "Pozsony"),
    "Europe/Prague": T(lang, "Prága"),
    "Europe/Warsaw": T(lang, "Varsó"),
    "Europe/Bucharest": T(lang, "Bukarest"),
    "Europe/Zagreb": T(lang, "Zágráb"),
    "Europe/Belgrade": T(lang, "Belgrád"),
    "Europe/Ljubljana": T(lang, "Ljubljana"),
    "Europe/Berlin": T(lang, "Berlin"),
    "Europe/Rome": T(lang, "Róma"),
    "Europe/Paris": T(lang, "Párizs"),
    "Europe/Madrid": T(lang, "Madrid"),
    "Europe/Lisbon": T(lang, "Lisszabon"),
    "Europe/London": T(lang, "London"),
    "Europe/Athens": T(lang, "Athén"),
    "Atlantic/Canary": T(lang, "Kanári-szigetek"),
    "Atlantic/Madeira": T(lang, "Madeira"),
    "Atlantic/Azores": T(lang, "Azori-szigetek"),
  };
}

let zoneList: string[] | null = null;
/** Every IANA zone the runtime knows, region/city form only (no "Etc/…", no bare "UTC"). */
export function allTimeZones(): string[] {
  if (!zoneList) {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const all = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : Object.values(COUNTRY_DEFAULT_TIME_ZONE);
    zoneList = [...new Set([...all, ...Object.values(COUNTRY_DEFAULT_TIME_ZONE)])]
      .filter((z) => z.includes("/") && !z.startsWith("Etc/"))
      .sort();
  }
  return zoneList;
}

const escAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "Bécs (Europe/Vienna)" — the label everywhere the zone is named. */
export function zoneLabel(tz: string, lang: string): string {
  const city = aliases(lang)[tz] ?? tz.split("/").pop()!.replace(/_/g, " ");
  return `${city} (${tz})`;
}

/** "szeptember 30., szerda 20:23" in `tz` — the "most itt" line. */
export function nowInLabel(tz: string, lang: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : lang, {
      timeZone: tz,
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
  } catch {
    return "";
  }
}

/**
 * The picker fields (no <form>: each surface wraps it in its own POST form and button
 * row). `id` must be unique on the page.
 */
export function zonePickerHtml(id: string, d: ZonePickerData, lang: string): string {
  const al = aliases(lang);
  const options = allTimeZones()
    .map((z) => `<option value="${escAttr(z)}"${z === d.timeZone ? " selected" : ""}>${escAttr(zoneLabel(z, lang))}</option>`)
    .join("");
  const msgs = {
    now: T(lang, "Most itt: {now} · {off} · a „ma” ennél a szállásnál: {day}", { now: "{now}", off: "{off}", day: "{day}" }),
    warn: T(lang, "Ez eltér az ország alapértékétől ({def}) — ellenőrizd, hogy a szállás tényleg ott van.", { def: "{def}" }),
    none: T(lang, "Nincs ilyen időzóna. Próbáld a legközelebbi nagyvárossal (pl. „Lisszabon”)."),
  };
  const data = { saved: d.timeZone, def: d.countryDefault, al, msgs };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: d.timeZone }).format(new Date());
  return (
    `<div class="tzp" id="${id}" data-tzp>` +
    `<label class="tzp__l" for="${id}_q" hidden data-tzp-js>${T(lang, "Keresés")}</label>` +
    `<input class="tzp__q" id="${id}_q" type="search" autocomplete="off" hidden data-tzp-js ` +
    `placeholder="${escAttr(T(lang, "Keress várost vagy országot, pl. Bécs, Lisszabon, Kanári"))}">` +
    `<label class="tzp__l" for="${id}_s">${T(lang, "Időzóna")}</label>` +
    `<select class="tzp__s" id="${id}_s" name="time_zone">${options}</select>` +
    `<div class="tzp__none" role="status" hidden>${escAttr(msgs.none)}</div>` +
    `<div class="tzp__hint">${T(lang, "Az ország ({c}) alapértéke: {def}.", {
      c: escAttr(d.country ?? "—"),
      def: escAttr(zoneLabel(d.countryDefault, lang)),
    })}</div>` +
    `<div class="tzp__now" data-tzp-now>${escAttr(
      msgs.now
        .replace("{now}", nowInLabel(d.timeZone, lang))
        .replace("{off}", offsetLabelIn(d.timeZone))
        .replace("{day}", today),
    )}</div>` +
    `<div class="tzp__warn" data-tzp-warn>${
      d.timeZone !== d.countryDefault ? escAttr(msgs.warn.replace("{def}", zoneLabel(d.countryDefault, lang))) : ""
    }</div>` +
    `<button class="tzp__reset" type="button" hidden data-tzp-js data-tzp-reset>${T(lang, "Vissza az ország alapértékére")}</button>` +
    `<script type="application/json" data-tzp-data>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>` +
    `<script>${ZONE_PICKER_JS.replace("__ID__", id)}</script>` +
    `</div>`
  );
}

/** The enhancement: search filter, live clock, warning, reset, save-only-on-change. */
const ZONE_PICKER_JS = `(function(){
  var root = document.getElementById("__ID__"); if (!root) return;
  var D = JSON.parse(root.querySelector("[data-tzp-data]").textContent);
  var q = root.querySelector(".tzp__q"), sel = root.querySelector(".tzp__s"), none = root.querySelector(".tzp__none");
  var now = root.querySelector("[data-tzp-now]"), warn = root.querySelector("[data-tzp-warn]");
  var reset = root.querySelector("[data-tzp-reset]"), form = root.closest("form");
  // The submit button comes AFTER the picker in the form: look it up at render time.
  function saveBtn(){ return form ? form.querySelector("button[type=submit]") : null; }
  root.querySelectorAll("[data-tzp-js]").forEach(function(el){ el.hidden = false; });
  var opts = Array.prototype.slice.call(sel.options).map(function(o){ return {v: o.value, t: o.text}; });
  function fold(s){ return String(s).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); }
  function label(z){ var o = opts.find(function(x){ return x.v === z; }); return o ? o.t : z; }
  function off(z){ try { var p = new Intl.DateTimeFormat("en-GB", {timeZone: z, timeZoneName: "shortOffset"}).formatToParts(new Date());
    var x = p.find(function(y){ return y.type === "timeZoneName"; }); return x ? x.value : ""; } catch (e) { return ""; } }
  function fill(t, v){ return t.replace(/\\{(\\w+)\\}/g, function(_, k){ return v[k] != null ? v[k] : "{" + k + "}"; }); }
  function render(){
    var z = sel.value;
    var btn = saveBtn();
    if (!z) { now.textContent = ""; warn.textContent = ""; if (btn) btn.disabled = true; return; }
    var lang = document.documentElement.lang || "hu";
    var nowTxt = new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : lang, {timeZone: z, month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit"}).format(new Date());
    var day = new Intl.DateTimeFormat("en-CA", {timeZone: z}).format(new Date());
    now.textContent = fill(D.msgs.now, {now: nowTxt, off: off(z), day: day});
    warn.textContent = z !== D.def ? fill(D.msgs.warn, {def: label(D.def)}) : "";
    if (btn) btn.disabled = z === D.saved;
  }
  function filter(){
    var t = fold(q.value.trim()), keep = sel.value, first = null, n = 0;
    sel.innerHTML = "";
    opts.forEach(function(o){
      if (t && fold(o.t).indexOf(t) < 0) return;
      var el = document.createElement("option"); el.value = o.v; el.textContent = o.t;
      if (o.v === keep) el.selected = true; sel.appendChild(el); n++; if (!first) first = o.v;
    });
    none.hidden = n > 0;
    if (n && !opts.some(function(o){ return o.v === keep && (!t || fold(o.t).indexOf(t) >= 0); })) sel.value = first;
    sel.size = t ? Math.min(8, Math.max(2, n)) : 0;
    render();
  }
  q.addEventListener("input", filter);
  sel.addEventListener("change", render);
  reset.addEventListener("click", function(){ q.value = ""; filter(); sel.value = D.def; render(); });
  render();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
})();`;
