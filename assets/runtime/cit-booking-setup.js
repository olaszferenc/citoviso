/* The guided booking setup ("Foglalás beállítása") with the Segítő chat.
 *
 * Approved plan (the CONTRACT): assets/design-refs/tenant-admin/foglalas-kerdezz-felelek/
 * — variant B, one page, six sections, one open at a time, a status pill on each; on a
 * narrow screen a sticky "ask" bar opens the chat as a bottom sheet, on a wide one the
 * chat sits in a sticky right column (owner, 2026-10-13).
 *
 * The page is a second front door to the SAME data: every "Mentés, tovább" posts the
 * section to /admin/booking-setup/save, which writes through the existing write
 * functions and answers with the fresh state read back from the database. Seasons are
 * added and deleted at once (/season), the trial booking asks the guest path's own rule
 * (/trial), and the chat asks the AI (/ask) — which explains and points, never writes.
 *
 * Every visible word comes from the server (L, wrapped in T() there — ADR-0036); month
 * names come from Intl in the page's language. Plain ES5, like the other admin scripts.
 */
(function () {
  var cfg = document.querySelector("[data-bs-data]");
  var ROOT = document.querySelector("[data-bs]");
  if (!cfg || !ROOT) return;
  var D = JSON.parse(cfg.textContent);
  var L = D.L;
  var S = D.state;
  var local = { answered: {}, dirty: {}, newRooms: 0, openSeason: {} };
  var open = null;
  var ctx = "mode";
  var busy = false;

  /* ── small helpers ─────────────────────────────────────────── */
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(s, v) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; });
  }
  /* The ONE money rule (cit-money.js, inlined before this script) — no sixth formatter. */
  function group(n) { return CitMoney.formatNumber(Math.round(Number(n)), D.lang); }
  function money(n) {
    if (n == null || n === "") return "—";
    return CitMoney.formatMoney(Math.round(Number(n)), S.currency, D.lang);
  }
  var mdFmt = (function () {
    try { return new Intl.DateTimeFormat(D.lang, { month: "short", day: "numeric", timeZone: "UTC" }); }
    catch (e) { return new Intl.DateTimeFormat("hu", { month: "short", day: "numeric", timeZone: "UTC" }); }
  })();
  function md(mmdd) {
    var p = String(mmdd).split("-");
    return mdFmt.format(new Date(Date.UTC(2000, Number(p[0]) - 1, Number(p[1]))));
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(isoD, n) { var d = new Date(isoD + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function num(v) { var n = Number(String(v).replace(/[\s.]/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n) : NaN; }
  function post(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 401) { location.href = "/login"; throw new Error("auth"); }
      return r.json();
    });
  }
  function toast(t) {
    var d = document.createElement("div");
    d.className = "bs-toast";
    d.setAttribute("role", "status");
    d.textContent = t;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2800);
  }

  /* ── the model, mirrored from the server's state ───────────── */
  function bookable() {
    return S.units.filter(function (u) { return S.mode === "single" ? u.whole : S.mode === "rooms" ? !u.whole : true; });
  }
  function setMode(m) {
    S.mode = m;
    var hasWhole = S.units.some(function (u) { return u.whole; });
    var rooms = S.units.filter(function (u) { return !u.whole; });
    if (m !== "single" && !rooms.length) S.units.push(newRoom());
    if ((m === "single" || m === "both") && !hasWhole) {
      S.units.unshift({ id: null, key: "w", name: L.wholeName, whole: true, cap: null, base: null, por: false, seasonalOnly: false, seasons: [], otherRows: 0 });
    }
  }
  function newRoom() {
    local.newRooms += 1;
    return { id: null, key: "n" + local.newRooms, name: "", whole: false, cap: null, base: null, por: false, seasonalOnly: false, seasons: [], otherRows: 0 };
  }
  function ukey(u) { return u.id || u.key; }
  function answered(id) { return !!(local.answered[id] || S.answered[id]); }
  function stayErrors() {
    var e = [];
    if (!(S.minNights >= 1 && S.minNights <= 30)) e.push(L.errMin);
    if (!(S.maxNights >= 1 && S.maxNights <= 365)) e.push(L.errMax);
    if (S.minNights > S.maxNights) e.push(L.errMinMax);
    return e;
  }
  function emailErrors() {
    if (!String(S.notify).trim()) return [];
    var bad = String(S.notify).split(/[,;]/).map(function (x) { return x.trim(); }).filter(function (x) {
      return x && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
    });
    return bad.length ? [fmt(L.errEmail, { list: bad.join(", ") })] : [];
  }

  /* ── sections and questions (the approved plan's order) ────── */
  var SECS = [
    { id: "rooms", t: L.secRooms }, { id: "prices", t: L.secPrices }, { id: "rules", t: L.secRules },
    { id: "guest", t: L.secGuest }, { id: "notify", t: L.secNotify }, { id: "check", t: L.secCheck }
  ];
  var QS = [
    { id: "mode", sec: "rooms" },
    { id: "rooms", sec: "rooms" },
    { id: "unit", sec: "prices" },
    { id: "base", sec: "prices" },
    { id: "seasons", sec: "prices" },
    { id: "seasonal", sec: "prices", skip: function () { return !bookable().some(function (u) { return u.seasons.length; }); } },
    { id: "stay", sec: "rules" },
    { id: "ahead", sec: "rules" },
    { id: "tax", sec: "guest" },
    { id: "includes", sec: "guest", optional: true },
    { id: "notify", sec: "notify" },
    { id: "check", sec: "check" }
  ];
  function qById(id) { return QS.filter(function (q) { return q.id === id; })[0]; }
  function title(id) {
    if (id === "rooms") return S.mode === "single" ? L.q_rooms_single : L.q_rooms;
    return L["q_" + id];
  }
  function visibleQs() { return QS.filter(function (q) { return !(q.skip && q.skip()); }); }
  function isDone(id) {
    switch (id) {
      case "mode": return !!S.mode;
      case "rooms":
        if (S.mode === "single") { var w = bookable()[0]; return !!(w && w.cap); }
        return bookable().length > 0 && bookable().every(function (u) { return u.whole || String(u.name).trim(); });
      case "unit": return answered("unit");
      case "base": return bookable().every(function (u) { return u.base > 0 || u.por; });
      case "seasons": return isDone("base") || bookable().some(function (u) { return u.seasons.length; });
      case "seasonal": return S.seasonalOnly !== null;
      case "stay": return answered("stay") && !stayErrors().length;
      case "ahead": return answered("ahead");
      case "tax": return S.taxState !== null && (S.taxState !== "amount" || Number(S.tax) > 0);
      case "includes": return answered("includes");
      case "notify": return answered("notify") && !emailErrors().length;
      case "check":
        return !S.blockers.some(function (b) { return b.sev === "bad"; }) &&
          visibleQs().every(function (q) { return q.id === "check" || q.optional || isDone(q.id); });
    }
    return false;
  }
  var UNIT_TXT = { per_night: L.unitNight, per_person_night: L.unitPerson, per_stay: L.unitStay };
  function answerLine(id) {
    switch (id) {
      case "mode": return { single: L.modeSingle, rooms: L.modeRooms, both: L.modeBoth }[S.mode] || "—";
      case "rooms":
        if (S.mode === "single") { var w = bookable()[0]; return w && w.cap ? fmt(L.nPersons, { n: w.cap }) : L.capMissing; }
        return bookable().map(function (u) { return (u.name || L.unnamed) + (u.cap ? " (" + fmt(L.nPersons, { n: u.cap }) + ")" : ""); }).join(", ");
      case "unit": return answered("unit") ? UNIT_TXT[S.priceUnit] + " · " + (S.currency === "EUR" ? L.curEur : L.curHuf) : "—";
      case "base": return bookable().map(function (u) { return (u.name || L.unnamed) + ": " + (u.por ? L.porShort : money(u.base)); }).join(" · ");
      case "seasons":
        var n = 0; bookable().forEach(function (u) { n += u.seasons.length; });
        return n ? fmt(L.nSeasons, { n: n }) : L.noSeasons;
      case "seasonal": return S.seasonalOnly === null ? L.seasonalMixed : S.seasonalOnly ? L.seasonalOnlyShort : L.allYearShort;
      case "stay": return fmt(L.stayLine, { min: S.minNights, max: S.maxNights });
      case "ahead": return fmt(L.aheadLine, { h: S.horizon }) + " · " + (Number(S.lead) ? fmt(L.leadLine, { n: S.lead }) : L.leadToday);
      case "tax": return S.taxState === "none" ? L.taxNoneShort : S.taxState === "amount" ? fmt(L.taxLine, { amount: money(S.tax) }) : S.taxState === "unknown" ? L.taxUnknownShort : "—";
      case "includes": return S.includes || (answered("includes") ? L.includesEmpty : "—");
      case "notify": return (S.notify || S.accountEmail) + " · " + (Number(S.expiry) ? fmt(L.expiryLine, { n: S.expiry }) : L.expiryNever);
      case "check": return S.blockers.length ? fmt(L.nTodo, { n: S.blockers.length }) : L.allGood;
    }
    return "";
  }

  /* ── one question's controls ───────────────────────────────── */
  function opt(key, val, label, sub, cur) {
    return '<button type="button" class="bs-opt" role="radio" data-opt="' + key + '" data-val="' + val + '" aria-checked="' +
      (String(cur) === val) + '"><span class="bs-dot"></span><span>' + esc(label) + "<small>" + esc(sub) + "</small></span></button>";
  }
  function unitName(u) { return u.name || L.unnamed; }
  function render(id, el) {
    var h = '<div class="bs-qi" data-q="' + id + '"><h3 class="bs-qt">' + esc(title(id)) + "</h3>";
    var lead = id === "rooms" ? (S.mode === "single" ? L.lead_rooms_single : L.lead_rooms) : L["lead_" + id];
    h += '<p class="bs-lead">' + esc(lead) + "</p>";
    if (id === "mode") {
      h += '<div class="bs-opts" role="radiogroup">' +
        opt("mode", "single", L.modeSingle, L.modeSingleSub, S.mode) +
        opt("mode", "rooms", L.modeRooms, L.modeRoomsSub, S.mode) +
        opt("mode", "both", L.modeBothLong, L.modeBothSub, S.mode) +
        '</div><p class="bs-hint">' + esc(L.modeHint) + "</p>";
    }
    if (id === "rooms") {
      bookable().forEach(function (u, i) {
        h += '<div class="bs-unit" data-u="' + esc(ukey(u)) + '">' + (u.whole
          ? '<h4 class="bs-uh">' + esc(u.name) + "</h4>"
          : '<label class="bs-f" for="bs-n-' + esc(ukey(u)) + '">' + esc(fmt(L.roomName, { n: i + 1 })) + '</label><input class="bs-inp" id="bs-n-' + esc(ukey(u)) +
            '" data-k="name" maxlength="120" placeholder="' + esc(L.roomNamePh) + '" value="' + esc(u.name) + '">') +
          '<div class="bs-row"><div><label class="bs-f">' + esc(L.capLabel) + '</label><input class="bs-inp" data-k="cap" type="number" min="1" max="50" inputmode="numeric" value="' + (u.cap || "") + '"></div>' +
          (!u.whole && !u.id ? '<div class="bs-row__tight"><button type="button" class="bs-btn bs-btn--sm" data-act="delroom">' + esc(L.cancelRoom) + "</button></div>" : "") +
          "</div></div>";
      });
      if (S.mode !== "single") {
        h += '<button type="button" class="bs-btn bs-btn--sm" data-act="addroom">' + esc(L.addRoom) + "</button>";
        if (bookable().filter(function (u) { return !u.whole && u.id; }).length > 1) {
          h += '<p class="bs-hint">' + esc(L.deleteRoomHint) + ' <a href="' + esc(D.adv.rooms) + '">' + esc(L.advRooms) + "</a></p>";
        }
      }
    }
    if (id === "unit") {
      h += '<div class="bs-opts" role="radiogroup">' +
        opt("priceUnit", "per_night", L.unitNightOpt, L.unitNightSub, answered("unit") ? S.priceUnit : "") +
        opt("priceUnit", "per_person_night", L.unitPersonOpt, L.unitPersonSub, answered("unit") ? S.priceUnit : "") +
        opt("priceUnit", "per_stay", L.unitStayOpt, L.unitStaySub, answered("unit") ? S.priceUnit : "") +
        '</div><label class="bs-f" for="bs-cur">' + esc(L.currency) + '</label><select class="bs-inp" id="bs-cur" data-g="currency"><option value="HUF"' +
        (S.currency === "HUF" ? " selected" : "") + ">" + esc(L.curHufOpt) + '</option><option value="EUR"' + (S.currency === "EUR" ? " selected" : "") + ">" + esc(L.curEurOpt) + "</option></select>";
    }
    if (id === "base") {
      var ut = UNIT_TXT[S.priceUnit] || L.unitNight;
      bookable().forEach(function (u) {
        h += '<div class="bs-unit" data-u="' + esc(ukey(u)) + '"><h4 class="bs-uh">' + esc(unitName(u)) + "</h4>" +
          '<div class="bs-row"><div><label class="bs-f">' + esc(fmt(L.priceLabel, { unit: ut })) + '</label><input class="bs-inp" data-k="base" inputmode="numeric" placeholder="' + esc(L.pricePh) + '" value="' +
          (u.base ? group(u.base) : "") + '"' + (u.por ? " disabled" : "") + "></div></div>" +
          '<label class="bs-check"><input type="checkbox" data-k="por"' + (u.por ? " checked" : "") + "> " + esc(L.porLabel) + "</label></div>";
      });
      if (local.answered.base && !isDone("base")) h += '<p class="bs-err">' + esc(L.errBase) + "</p>";
    }
    if (id === "seasons") {
      bookable().forEach(function (u) {
        h += '<div class="bs-unit" data-u="' + esc(ukey(u)) + '"><h4 class="bs-uh">' + esc(unitName(u)) + "</h4>";
        if (!u.seasons.length) h += '<p class="bs-hint">' + esc(fmt(L.noSeasonUnit, { price: u.por ? L.porShort : money(u.base) })) + "</p>";
        u.seasons.forEach(function (sz) {
          h += '<div class="bs-season"><span><b>' + esc(sz.label) + "</b> · " + esc(md(sz.from)) + " – " + esc(md(sz.to)) +
            (sz.from > sz.to ? " " + esc(L.wraps) : "") + (sz.min ? " · " + esc(fmt(L.minN, { n: sz.min })) : "") + "</span><span>" + esc(money(sz.amount)) +
            ' <button type="button" class="bs-link" data-act="delseason" data-id="' + esc(sz.id) + '">' + esc(L.del) + "</button></span></div>";
        });
        if (u.otherRows) h += '<p class="bs-hint">' + esc(fmt(L.otherRows, { n: u.otherRows })) + ' <a href="' + esc(D.adv.pricing) + '">' + esc(L.advPricing) + "</a></p>";
        if (u.id) {
          h += "<details" + (local.openSeason[u.id] ? " open" : "") + '><summary class="bs-link">' + esc(L.newSeason) + "</summary>" +
            '<div class="bs-row"><div><label class="bs-f">' + esc(L.seasonName) + '</label><input class="bs-inp" data-n="label" maxlength="80" placeholder="' + esc(L.seasonNamePh) + '"></div></div>' +
            '<div class="bs-row"><div><label class="bs-f">' + esc(L.from) + '</label><input class="bs-inp" data-n="from" placeholder="06-15"></div><div><label class="bs-f">' + esc(L.to) +
            '</label><input class="bs-inp" data-n="to" placeholder="08-31"></div></div>' +
            '<div class="bs-row"><div><label class="bs-f">' + esc(L.price) + '</label><input class="bs-inp" data-n="amount" inputmode="numeric" placeholder="28 000"></div><div><label class="bs-f">' +
            esc(L.minLabel) + '</label><input class="bs-inp" data-n="min" type="number" min="1" max="60" placeholder="' + esc(L.optional) + '"></div></div>' +
            '<p class="bs-hint">' + esc(L.mdHint) + '</p><div class="bs-errs"></div><div class="bs-row bs-row--acts"><div class="bs-row__tight"><button type="button" class="bs-btn bs-btn--sm bs-btn--pri" data-act="addseason">' +
            esc(L.add) + "</button></div>" +
            (bookable().filter(function (x) { return x.id; }).length > 1 ? '<div class="bs-row__tight"><button type="button" class="bs-btn bs-btn--sm" data-act="addseasonall">' + esc(L.addAll) + "</button></div>" : "") +
            "</div></details>";
        } else {
          h += '<p class="bs-hint">' + esc(L.saveRoomsFirst) + "</p>";
        }
        h += "</div>";
      });
    }
    if (id === "seasonal") {
      h += '<div class="bs-opts" role="radiogroup">' +
        opt("seasonalOnly", "false", L.allYear, L.allYearSub, String(S.seasonalOnly)) +
        opt("seasonalOnly", "true", L.seasonalOnly, L.seasonalOnlySub, String(S.seasonalOnly)) + "</div>" +
        (S.seasonalOnly === null ? '<p class="bs-hint">' + esc(L.seasonalMixedHint) + "</p>" : "");
    }
    if (id === "stay") {
      h += '<div class="bs-row"><div><label class="bs-f">' + esc(L.minNights) + '</label><input class="bs-inp" data-g="minNights" type="number" min="1" max="30" value="' + S.minNights + '"></div>' +
        '<div><label class="bs-f">' + esc(L.maxNights) + '</label><input class="bs-inp" data-g="maxNights" type="number" min="1" max="365" value="' + S.maxNights + '"></div></div>' +
        '<p class="bs-hint">' + esc(L.stayHint) + '</p><div class="bs-errs"></div>';
    }
    if (id === "ahead") {
      h += '<div class="bs-row"><div><label class="bs-f">' + esc(L.horizon) + '</label><input class="bs-inp" data-g="horizon" type="number" min="1" max="24" value="' + S.horizon + '"></div>' +
        '<div><label class="bs-f">' + esc(L.lead) + '</label><input class="bs-inp" data-g="lead" type="number" min="0" max="60" value="' + S.lead + '"></div></div>' +
        '<p class="bs-hint">' + esc(L.leadHint) + "</p>";
    }
    if (id === "tax") {
      h += '<div class="bs-opts" role="radiogroup">' +
        opt("taxState", "amount", L.taxYes, L.taxYesSub, S.taxState) +
        opt("taxState", "none", L.taxNone, L.taxNoneSub, S.taxState) +
        opt("taxState", "unknown", L.taxUnknown, L.taxUnknownSub, S.taxState) + "</div>" +
        (S.taxState === "amount" ? '<label class="bs-f" for="bs-tax">' + esc(L.taxAmount) + '</label><input class="bs-inp" id="bs-tax" data-g="tax" type="number" min="1" max="100000" value="' + esc(S.tax) +
          '"><p class="bs-hint">' + esc(L.taxHint) + "</p>" : "");
    }
    if (id === "includes") {
      h += '<input class="bs-inp" data-g="includes" maxlength="200" aria-label="' + esc(title(id)) + '" placeholder="' + esc(L.includesPh) + '" value="' + esc(S.includes) + '">';
    }
    if (id === "notify") {
      h += '<label class="bs-f" for="bs-notify">' + esc(L.notifyLabel) + '</label><input class="bs-inp" id="bs-notify" data-g="notify" inputmode="email" placeholder="' + esc(S.accountEmail) + '" value="' + esc(S.notify) + '">' +
        '<p class="bs-hint">' + esc(fmt(L.notifyHint, { email: S.accountEmail })) + '</p><div class="bs-errs"></div>' +
        '<label class="bs-f" for="bs-exp">' + esc(L.expiryLabel) + '</label><input class="bs-inp" id="bs-exp" data-g="expiry" type="number" min="0" max="336" value="' + S.expiry + '"><p class="bs-hint">' + esc(L.expiryHint) + "</p>";
    }
    if (id === "check") {
      if (S.blockers.length) {
        S.blockers.forEach(function (x) {
          h += '<div class="' + (x.sev === "bad" ? "bs-warnbox" : "bs-infobox") + '"><span>' + esc(x.t) + ' <button type="button" class="bs-link" data-go="' + esc(x.q) + '">' + esc(L.fix) + "</button></span></div>";
        });
      } else {
        h += '<div class="bs-okbox">' + esc(L.noBlockers) + "</div>";
      }
      var bu = bookable().filter(function (u) { return u.id; });
      h += '<div class="bs-trial"><div class="bs-row"><div><label class="bs-f" for="bs-t-unit">' + esc(L.trialUnit) + '</label><select class="bs-inp" id="bs-t-unit" data-t="unit">' +
        bu.map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(unitName(u)) + "</option>"; }).join("") + "</select></div></div>" +
        '<div class="bs-row"><div><label class="bs-f" for="bs-t-arr">' + esc(L.arrive) + '</label><input class="bs-inp" id="bs-t-arr" data-t="arrive" type="date" value="' + addDays(D.today, 30) + '"></div>' +
        '<div><label class="bs-f" for="bs-t-n">' + esc(L.nights) + '</label><input class="bs-inp" id="bs-t-n" data-t="nights" type="number" min="1" max="365" value="2"></div>' +
        '<div><label class="bs-f" for="bs-t-g">' + esc(L.guests) + '</label><input class="bs-inp" id="bs-t-g" data-t="guests" type="number" min="1" max="50" value="2"></div></div>' +
        trialMealRow() +
        '<div class="bs-res" aria-live="polite"></div></div>';
    }
    h += "</div>";
    el.innerHTML = h;
    bind(id, el);
    if (id === "check") runTrial(el);
    if (id === "stay") showErrs(el, stayErrors());
    if (id === "notify") showErrs(el, emailErrors());
  }
  function showErrs(el, errs) {
    var box = el.querySelector(".bs-errs");
    if (box) box.innerHTML = errs.map(function (e) { return '<p class="bs-err">' + esc(e) + "</p>"; }).join("");
  }

  /* ── what a control changes ────────────────────────────────── */
  function touch(id) { local.answered[id] = true; local.dirty[qById(id).sec] = true; }
  function bind(id, el) {
    el.querySelectorAll("[data-opt]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-opt"), v = b.getAttribute("data-val");
        if (k === "mode") setMode(v);
        else if (k === "seasonalOnly") S.seasonalOnly = v === "true";
        else S[k] = v;
        touch(id);
        draw();
      });
    });
    el.querySelectorAll("[data-g]").forEach(function (inp) {
      var k = inp.getAttribute("data-g");
      inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", function () {
        var numeric = ["minNights", "maxNights", "horizon", "lead", "expiry"].indexOf(k) >= 0;
        S[k] = numeric ? (inp.value === "" ? 0 : Number(inp.value)) : inp.value;
        touch(id);
        if (id === "stay") { showErrs(el, stayErrors()); inp.classList.toggle("is-bad", stayErrors().length > 0); }
        if (id === "notify") { showErrs(el, emailErrors()); inp.classList.toggle("is-bad", k === "notify" && emailErrors().length > 0); }
        if (k === "currency") draw(); else head();
      });
    });
    el.querySelectorAll("[data-u]").forEach(function (card) {
      var key = card.getAttribute("data-u");
      var u = S.units.filter(function (x) { return ukey(x) === key; })[0];
      if (!u) return;
      card.querySelectorAll("[data-k]").forEach(function (inp) {
        var k = inp.getAttribute("data-k");
        inp.addEventListener(inp.type === "checkbox" ? "change" : "input", function () {
          if (k === "name") u.name = inp.value.slice(0, 120);
          if (k === "cap") { var c = Number(inp.value); u.cap = c >= 1 ? Math.min(50, Math.round(c)) : null; }
          if (k === "base") { var n = num(inp.value); u.base = n > 0 ? n : null; inp.classList.toggle("is-bad", inp.value.trim() !== "" && !(n > 0)); }
          if (k === "por") u.por = inp.checked;
          touch(id);
          if (k === "por") draw(); else head();
        });
        if (k === "base") inp.addEventListener("blur", function () { if (u.base) inp.value = group(u.base); });
      });
      var act = function (sel, fn) { var b = card.querySelector(sel); if (b) b.addEventListener("click", fn); };
      act('[data-act="delroom"]', function () { S.units = S.units.filter(function (x) { return x !== u; }); touch(id); draw(); });
      card.querySelectorAll('[data-act="delseason"]').forEach(function (b) {
        b.addEventListener("click", function () {
          if (!window.confirm(L.delSeasonConfirm)) return;
          seasonCall({ op: "delete", priceId: b.getAttribute("data-id") }, card);
        });
      });
      var addFn = function (all) {
        return function () {
          var g = function (n) { return card.querySelector('[data-n="' + n + '"]').value; };
          local.openSeason[u.id] = true;
          seasonCall({
            op: "add",
            unitIds: all ? bookable().filter(function (x) { return x.id; }).map(function (x) { return x.id; }) : [u.id],
            label: g("label"), from: g("from"), to: g("to"), amount: g("amount"), min: g("min")
          }, card, function () { local.openSeason[u.id] = false; });
        };
      };
      act('[data-act="addseason"]', addFn(false));
      act('[data-act="addseasonall"]', addFn(true));
      var det = card.querySelector("details");
      if (det) det.addEventListener("toggle", function () { local.openSeason[u.id] = det.open; });
    });
    var add = el.querySelector('[data-act="addroom"]');
    if (add) add.addEventListener("click", function () { S.units.push(newRoom()); touch(id); draw(); });
    el.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { goTo(b.getAttribute("data-go")); }); });
    var tt;
    el.querySelectorAll("[data-t]").forEach(function (inp) {
      inp.addEventListener("input", function () { clearTimeout(tt); tt = setTimeout(function () { runTrial(el); }, 300); });
    });
  }

  /* Seasons are written at once; only the seasons and the blockers are taken back, so a
   * base price typed but not yet saved in the same section survives the round trip. */
  function seasonCall(body, card, onOk) {
    if (busy) return;
    busy = true;
    post("/admin/booking-setup/season", body).then(function (r) {
      busy = false;
      if (r.state) {
        r.state.units.forEach(function (fresh) {
          var mine = S.units.filter(function (x) { return x.id === fresh.id; })[0];
          if (mine) { mine.seasons = fresh.seasons; mine.otherRows = fresh.otherRows; }
        });
        S.blockers = r.state.blockers;
      }
      if (r.ok) {
        local.answered.seasons = true;
        if (onOk) onOk();
        draw();
        toast(body.op === "add" ? L.seasonAdded : L.seasonDeleted);
      } else {
        draw();
        var again = ROOT.querySelector('[data-qbox="seasons"] [data-u="' + card.getAttribute("data-u") + '"]');
        if (again) {
          var det = again.querySelector("details");
          if (det) det.open = true;
          var g = function (n) { return again.querySelector('[data-n="' + n + '"]'); };
          if (body.op === "add" && g("label")) {
            g("label").value = body.label; g("from").value = body.from; g("to").value = body.to; g("amount").value = body.amount; g("min").value = body.min;
          }
          showErrs(again, r.errors && r.errors.length ? r.errors : [L.errSave]);
        }
      }
    }).catch(function () { busy = false; toast(L.errSave); });
  }

  /* Elek 10-13 T-4: the meal plan and the children, as the guest's form asks them — the owner
   * can try the surcharge too. The server decides what applies to the chosen room. */
  function trialMealRow() {
    var M = D.meals;
    if (!M || !M.plans || M.plans.length < 2) return "";
    return '<div class="bs-row"><div><label class="bs-f" for="bs-t-meal">' + esc(L.trialMeal) + '</label><select class="bs-inp" id="bs-t-meal" data-t="meal">' +
      M.plans.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === M.base ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      (M.askKids && M.childAge
        ? '<div><label class="bs-f" for="bs-t-k">' + esc(fmt(L.trialKids, { n: M.childAge })) + '</label><input class="bs-inp" id="bs-t-k" data-t="kids" type="number" min="0" max="49" value="0"></div>'
        : "") +
      "</div>";
  }
  /* ── trial booking: the guest path's own rule, on the server ── */
  function runTrial(el) {
    var res = el.querySelector(".bs-res");
    if (!res) return;
    var g = function (k) { var x = el.querySelector('[data-t="' + k + '"]'); return x ? x.value : ""; };
    if (!g("unit")) { res.className = "bs-res"; res.textContent = L.trialNoUnit; return; }
    post("/admin/booking-setup/trial", { unitId: g("unit"), dateFrom: g("arrive"), nights: g("nights"), guests: g("guests"), meal: g("meal"), children: g("kids") }).then(function (r) {
      local.tried = true;
      head();
      if (r.errors && r.errors.length) {
        res.className = "bs-res is-bad";
        res.innerHTML = "<b>" + esc(L.trialBlocked) + "</b><br>" + r.errors.map(esc).join("<br>");
      } else if (!r.quote) {
        res.className = "bs-res";
        res.innerHTML = "<b>" + esc(L.trialNoTotal) + "</b><br>" + esc(L.trialNoTotalSub);
      } else {
        res.className = "bs-res";
        res.innerHTML = "<b>" + esc(L.trialOk) + "</b> " + esc(L.trialSees) + "<br>" + esc(L.stayCost) + " <b>" + esc(r.quote.totalText) + "</b>" +
          (r.quote.mealLines || []).map(function (t) { return "<br>" + esc(t); }).join("") +
          (r.quote.grandText ? "<br>" + esc(L.grandTotal) + " <b>" + esc(r.quote.grandText) + "</b>" : "") +
          (r.taxText ? "<br>" + esc(r.taxText) : "") +
          (S.includes ? '<br><span class="bs-hint">' + esc(S.includes) + "</span>" : "") +
          '<br><span class="bs-hint">' + esc(fmt(L.trialMail, { email: S.notify || S.accountEmail })) + "</span>";
      }
      if (r.notes && r.notes.length) res.innerHTML += '<br><span class="bs-hint">' + r.notes.map(esc).join("<br>") + "</span>";
    }).catch(function () { res.className = "bs-res is-bad"; res.textContent = L.errSave; });
  }

  /* ── sections ──────────────────────────────────────────────── */
  function secQs(sid) { return visibleQs().filter(function (q) { return q.sec === sid; }); }
  function secState(sid) {
    var qs = secQs(sid);
    var bad = S.blockers.filter(function (b) {
      return b.sev === "bad" && qs.some(function (q) { return q.id === b.q || (b.q === "seasonal" && q.id === "seasons"); });
    }).length;
    var missing = qs.filter(function (q) { return !q.optional && !isDone(q.id); }).length;
    if (bad) return { cls: "bad", t: fmt(L.nBlockers, { n: bad }) };
    // Elek 10-13 T-4: the try-out part is not "Kész" until a trial booking ran on this page.
    if (sid === "check" && !local.tried) return { cls: "warn", t: L.notTried };
    if (missing) return { cls: "warn", t: missing === qs.length ? L.notFilled : fmt(L.nMissing, { n: missing }) };
    return { cls: "ok", t: L.done };
  }
  function head() {
    var done = SECS.filter(function (s) { return secState(s.id).cls === "ok"; }).length;
    var bl = S.blockers;
    ROOT.querySelector(".bs-progress").textContent = fmt(L.progress, { done: done, all: SECS.length }) +
      (bl.length ? " · " + fmt(L.progressBlocked, { n: bl.length }) : done === SECS.length ? " · " + L.progressOk : "");
    ROOT.querySelectorAll(".bs-sec").forEach(function (sec) {
      var st = secState(sec.getAttribute("data-s"));
      var pill = sec.querySelector(".bs-pill");
      if (pill) { pill.className = "bs-pill bs-pill--" + st.cls; pill.textContent = st.t; }
    });
  }
  function draw() {
    var h = "";
    SECS.forEach(function (s, i) {
      var st = secState(s.id), isOpen = open === s.id;
      h += '<section class="bs-sec' + (isOpen ? " is-open" : "") + '" data-s="' + s.id + '"><button type="button" class="bs-sh" aria-expanded="' + isOpen + '"><span class="bs-num">' + (i + 1) +
        '</span><span class="bs-st"><b>' + esc(s.t) + "</b>";
      if (!isOpen && s.id !== "check") {
        h += "<small>" + secQs(s.id).filter(function (q) { return isDone(q.id) || answered(q.id); }).map(function (q) { return esc(answerLine(q.id)); }).join(" · ") + "</small>";
      }
      h += '</span><span class="bs-pill bs-pill--' + st.cls + '">' + esc(st.t) + "</span></button>";
      if (isOpen) {
        h += '<div class="bs-body">';
        secQs(s.id).forEach(function (q) { h += '<div class="bs-q" data-qbox="' + q.id + '"></div>'; });
        var nxt = SECS[i + 1];
        h += '<div class="bs-saveerr" role="alert"></div><div class="bs-foot">' + (nxt
          ? '<button type="button" class="bs-btn bs-btn--pri" data-next="' + nxt.id + '">' + esc(fmt(L.saveNext, { next: nxt.t })) + "</button>"
          : '<button type="button" class="bs-btn bs-btn--pri" data-fin="1"' + (isDone("check") ? "" : " disabled") + ">" + esc(L.finish) + "</button>") + "</div></div>";
      }
      h += "</section>";
    });
    var list = ROOT.querySelector(".bs-list");
    list.innerHTML = h;
    head();
    list.querySelectorAll(".bs-sh").forEach(function (b) {
      b.addEventListener("click", function () { var sid = b.parentNode.getAttribute("data-s"); leaveThen(open === sid ? null : sid); });
    });
    list.querySelectorAll("[data-qbox]").forEach(function (box) {
      var id = box.getAttribute("data-qbox");
      render(id, box);
      box.addEventListener("focusin", function () { if (ctx !== id) { ctx = id; refreshChips(); } });
    });
    list.querySelectorAll("[data-next]").forEach(function (b) {
      b.addEventListener("click", function () { save(open, function () { openSec(b.getAttribute("data-next")); }, true); });
    });
    list.querySelectorAll("[data-fin]").forEach(function (b) {
      b.addEventListener("click", function () { location.href = D.doneUrl; });
    });
  }

  /* ── saving ────────────────────────────────────────────────── */
  function payload(sid) {
    if (sid === "rooms") {
      return {
        mode: S.mode,
        units: bookable().map(function (u) { return { id: u.id, whole: !!u.whole, name: u.name, cap: u.cap }; })
      };
    }
    if (sid === "prices") {
      return {
        currency: S.currency, priceUnit: S.priceUnit, seasonalOnly: S.seasonalOnly,
        units: bookable().filter(function (u) { return u.id; }).map(function (u) { return { id: u.id, base: u.base, por: !!u.por }; })
      };
    }
    if (sid === "rules") return { minNights: S.minNights, maxNights: S.maxNights, horizon: S.horizon, lead: S.lead };
    if (sid === "guest") return { taxState: S.taxState, tax: S.tax, includes: S.includes };
    if (sid === "notify") return { notify: S.notify, expiry: S.expiry };
    return null;
  }
  /* `force`: "Mentés, tovább" saves even an untouched section — that is the owner saying
   * "these are my answers" (the defaults become answers). Leaving by a header saves only
   * what was changed. */
  function save(sid, then, force) {
    var body = payload(sid);
    if (!body || (!force && !local.dirty[sid])) { then(); return; }
    if (busy) return;
    if (sid === "prices" && !answered("unit")) {
      var box0 = ROOT.querySelector('[data-s="prices"] .bs-saveerr');
      if (box0) box0.innerHTML = '<p class="bs-err">' + esc(L.errUnit) + "</p>";
      return;
    }
    busy = true;
    body.section = sid;
    post("/admin/booking-setup/save", body).then(function (r) {
      busy = false;
      if (r.ok) {
        var keepOpen = local.openSeason;
        S = r.state;
        local.dirty[sid] = false;
        local.openSeason = keepOpen;
        toast(L.saved);
        then();
      } else {
        var box = ROOT.querySelector('[data-s="' + sid + '"] .bs-saveerr');
        if (box) box.innerHTML = (r.errors && r.errors.length ? r.errors : [L.errSave]).map(function (e) { return '<p class="bs-err">' + esc(e) + "</p>"; }).join("");
      }
    }).catch(function () { busy = false; toast(L.errSave); });
  }
  function leaveThen(sid) {
    if (open && local.dirty[open]) save(open, function () { openSec(sid); }, false);
    else openSec(sid);
  }
  function openSec(sid) {
    open = sid;
    draw();
    if (sid) {
      var q = secQs(sid)[0];
      ctx = q ? q.id : ctx;
      refreshChips();
      var el = ROOT.querySelector('[data-s="' + sid + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }
  function goTo(qid) {
    sheet(false);
    var q = qById(qid);
    if (!q) return;
    var go = function () {
      open = q.sec; ctx = qid; draw(); refreshChips();
      var box = ROOT.querySelector('[data-qbox="' + qid + '"]');
      if (box) {
        if (box.scrollIntoView) box.scrollIntoView({ block: "center", behavior: "smooth" });
        box.classList.remove("bs-flash"); void box.offsetWidth; box.classList.add("bs-flash");
      }
    };
    if (open && open !== q.sec && local.dirty[open]) save(open, go, false); else go();
  }
  window.addEventListener("beforeunload", function (e) {
    for (var k in local.dirty) if (local.dirty[k]) { e.preventDefault(); e.returnValue = ""; return ""; }
  });

  /* ── the Segítő ────────────────────────────────────────────── */
  var chatEl = ROOT.querySelector(".bs-chat");
  var scrim = ROOT.querySelector(".bs-scrim");
  var log = chatEl.querySelector(".bs-chat__log");
  var chips = chatEl.querySelector(".bs-chips");
  var form = chatEl.querySelector("form");
  var inp = form.querySelector("input");
  var history = [];
  function isNarrow() { return ROOT.clientWidth < 900; }
  function sheet(o) {
    var narrow = isNarrow();
    chatEl.classList.toggle("is-sheet", narrow);
    chatEl.classList.toggle("is-open", o);
    scrim.classList.toggle("is-open", o && narrow);
    if (o && narrow) inp.focus();
  }
  ROOT.querySelector("[data-ask]").addEventListener("click", function () { sheet(true); });
  scrim.addEventListener("click", function () { sheet(false); });
  chatEl.querySelector(".bs-chat__close").addEventListener("click", function () { sheet(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && chatEl.classList.contains("is-open") && isNarrow()) sheet(false); });
  function push(cls, html) {
    var d = document.createElement("div");
    d.className = "bs-msg " + cls;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function ask(text) {
    if (busyChat) return;
    busyChat = true;
    push("bs-msg--me", esc(text));
    var typing = push("bs-msg--ai bs-typing", esc(L.thinking));
    post("/admin/booking-setup/ask", { question: text, ctx: ctx, history: history.slice(-4) }).then(function (r) {
      busyChat = false;
      typing.remove();
      if (!r.ok) { push("bs-msg--ai", esc(r.message || L.chatError)); return; }
      history.push({ q: text, a: r.answer });
      var d = push("bs-msg--ai", esc(r.answer));
      if (r.go && qById(r.go)) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "bs-btn bs-btn--sm bs-go";
        b.textContent = fmt(L.showWhere, { q: title(r.go) });
        b.addEventListener("click", function () { goTo(r.go); });
        d.appendChild(b);
      }
      if (r.advanced && D.adv[r.advanced]) {
        var a = document.createElement("a");
        a.className = "bs-btn bs-btn--sm bs-go";
        a.href = D.adv[r.advanced];
        a.textContent = L["adv_" + r.advanced];
        d.appendChild(a);
      }
    }).catch(function () { busyChat = false; typing.remove(); push("bs-msg--ai", esc(L.chatError)); });
  }
  var busyChat = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = inp.value.trim();
    if (!t) return;
    inp.value = "";
    ask(t.slice(0, D.maxQuestion));
  });
  function refreshChips() {
    var c = D.chips[ctx] || D.chips.check;
    chips.innerHTML = c.map(function (x) { return '<button type="button" class="bs-chip">' + esc(x) + "</button>"; }).join("");
    chips.querySelectorAll(".bs-chip").forEach(function (b) { b.addEventListener("click", function () { ask(b.textContent); }); });
  }
  push("bs-msg--ai", esc(L.chatHello));
  refreshChips();
  new ResizeObserver(function () { sheet(chatEl.classList.contains("is-open") && isNarrow()); }).observe(ROOT);

  /* First visit: the first section with something missing opens; later visits start closed. */
  var firstOpen = null;
  if (!SECS.every(function (s) { return secState(s.id).cls === "ok"; })) {
    SECS.some(function (s) { if (secState(s.id).cls !== "ok") { firstOpen = s.id; return true; } return false; });
  }
  var want = (location.hash.match(/^#q=(\w+)$/) || [])[1];
  if (want && qById(want)) { open = qById(want).sec; ctx = want; } else open = S.answered.stay || S.answered.unit ? null : firstOpen;
  draw();
  refreshChips();
})();
