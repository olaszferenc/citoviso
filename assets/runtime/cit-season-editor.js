/* The tenant admin's season editor: date pickers, the season-name list and the
 * one-year calendar on the Árak, szezonok screen.
 *
 * Approved plan (the CONTRACT): assets/design-refs/tenant-admin/season-datepicker/.
 * Owner, 2026-09-26: "nagy segítség lenne a dátumválasztó, ráadásul a javasolt
 * segítőszöveg sem egyértelmű" — typing "11-01" into a text field was the only way
 * to name a season's days, and the free-text season name produced "Főszezon",
 * "főszezon" and "Föszezon" side by side.
 *
 * Progressive enhancement: the server renders plain month-day text fields that work
 * without this script; here they become hidden inputs behind two picker buttons, so
 * the POST the server reads is exactly what it was ("MM-DD", normalised by the same
 * CitSeason.normMonthDay the server stores with).
 *
 * ⚠️ The RECURRING calendar has no year and no weekday header on purpose: the season
 * repeats every year, and a weekday would change from year to year. The YEAR calendar
 * (one year of a season, the year strip) is the opposite: a real year, Monday-first,
 * weekend marked — there "start on a Saturday" is exactly what the owner decides.
 *
 * Every visible word comes from the server (L, wrapped in T() there — ADR-0036);
 * month and weekday names come from Intl in the page's language.
 * Plain ES5, like the other admin scripts. Loaded after cit-season.cjs.
 */
(function () {
  var S = window.CitSeason;
  var cfg = document.querySelector("[data-season-l]");
  if (!S || !cfg) return;
  var D = JSON.parse(cfg.textContent);
  var L = D.L;
  var TODAY = D.today;
  var namesEl = document.querySelector("[data-season-names]");
  var NAMES = namesEl ? JSON.parse(namesEl.textContent) : [];
  var DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function fmt(o) {
    o.timeZone = "UTC";
    try {
      return new Intl.DateTimeFormat(D.lang, o);
    } catch (_) {
      return new Intl.DateTimeFormat("hu", o);
    }
  }
  var fMD = fmt({ month: "long", day: "numeric" });
  var fSH = fmt({ month: "short", day: "numeric" });
  var fMon = fmt({ month: "long" });
  var fMonS = fmt({ month: "short" });
  var fYM = fmt({ year: "numeric", month: "long" });
  var fLong = fmt({ year: "numeric", month: "long", day: "numeric", weekday: "long" });
  var fWd = fmt({ weekday: "short" });

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function key(m, d) {
    return pad(m) + "-" + pad(d);
  }
  function at(iso) {
    return new Date(iso + "T12:00:00Z");
  }
  // 2000 is a leap year, so 02-29 formats like every other recurring day.
  function md(k) {
    return fMD.format(at("2000-" + k));
  }
  function sh(k) {
    return fSH.format(at("2000-" + k));
  }
  function nice(i) {
    return i.slice(0, 4) + ". " + i.slice(5, 7) + ". " + i.slice(8, 10) + ".";
  }
  function esc(x) {
    return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function sub(t, o) {
    return t.replace(/\{(\w+)\}/g, function (m, k) {
      return o[k] != null ? o[k] : m;
    });
  }
  function fold(x) {
    return String(x).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }
  function lev(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++)
      for (j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  var IC_CAL =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var IC_L =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  var IC_R =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  var WD = (function () {
    var out = [];
    // 2024-01-01 was a Monday: the week starts on Monday.
    for (var i = 0; i < 7; i++) out.push(fWd.format(at("2024-01-" + pad(1 + i))));
    return out;
  })();

  /* The phone layout is a question of the form's OWN width (the admin sidebar eats
   * the viewport), so it is measured, not read from a media query. */
  function narrow(el) {
    var w = el.closest(".pn-wrap") || el;
    return w.clientWidth < 620;
  }
  /* The admin's sticky top bar: a popover opening upwards must not slide under it. */
  function stickyBottom() {
    var t = document.querySelector(".adm-top");
    if (!t) return 0;
    var r = t.getBoundingClientRect();
    return r.top <= 0 && r.bottom > 0 ? r.bottom : Math.max(0, r.bottom);
  }

  /* ── The recurring picker: one per add / edit form ─────────────────────── */
  var open = null; // the picker whose calendar is open (one at a time)

  function Picker(form) {
    var dates = form.querySelector("[data-sdates]");
    var cal = form.querySelector("[data-scal]");
    var fi = form.querySelector('input[name="from"]');
    var ti = form.querySelector('input[name="to"]');
    if (!dates || !cal || !fi || !ti) return null;
    var self = form.getAttribute("data-sedit");
    var card = form.closest("[data-seasons]");
    var st = { from: S.normMonthDay(fi.value), to: S.normMonthDay(ti.value), pick: "from", view: 0, open: false };
    // an empty form opens on the editor's day (the server's `today`, which tests pin)
    st.view = st.from ? +st.from.slice(0, 2) : +String(TODAY).slice(5, 7) || 1;
    fi.type = "hidden";
    ti.type = "hidden";
    var listeners = [];

    function others() {
      var all = card ? JSON.parse(card.getAttribute("data-seasons")) : [];
      return all.filter(function (x) {
        return x.id !== self;
      });
    }
    function btns() {
      var b = function (k, ph) {
        var v = st[k];
        var lab = k === "from" ? L.start : L.end;
        return (
          '<button type="button" class="sdp-btn' + (v ? "" : " is-ph") + (st.open && st.pick === k ? " is-on" : "") +
          '" data-sdp="' + k + '" aria-haspopup="dialog" aria-expanded="' + (st.open && st.pick === k) +
          '" aria-label="' + esc(lab + (v ? ": " + md(v) : "")) + '">' + IC_CAL + "<span>" + esc(v ? sh(v) : ph) + "</span></button>"
        );
      };
      var keep = [fi, ti];
      dates.innerHTML = b("from", L.start) + '<span class="sdp-dash">–</span>' + b("to", L.end);
      keep.forEach(function (i) {
        dates.appendChild(i);
      });
      dates.querySelectorAll("[data-sdp]").forEach(function (x) {
        x.addEventListener("click", function () {
          st.pick = x.getAttribute("data-sdp");
          var v = st[st.pick] || st.from;
          if (v) st.view = +v.slice(0, 2);
          show(true);
        });
      });
    }
    function calHtml() {
      var ot = others();
      var one = narrow(form);
      var months = one ? [st.view] : [st.view, (st.view % 12) + 1];
      var h = "";
      months.forEach(function (m) {
        h += '<div class="sdp-mon"><h5>' + esc(fMon.format(at("2000-" + pad(m) + "-01"))) + '</h5><div class="sdp-grid">';
        for (var d = 1; d <= DIM[m - 1]; d++) {
          var k = key(m, d), c = [];
          if (st.from && st.to && S.covers(st.from, st.to, k)) c.push("in");
          if (k === st.from || k === st.to) c.push("end");
          if (ot.some(function (x) { return S.covers(x.from, x.to, k); })) c.push("oth");
          h += '<button type="button" class="' + c.join(" ") + '" data-d="' + k + '" aria-label="' + esc(md(k)) + '"' +
            (k === st.from || k === st.to ? ' aria-pressed="true"' : "") + ">" + d + "</button>";
        }
        h += "</div></div>";
      });
      var step = st.pick === "from" ? L.pickStart : st.from ? sub(L.pickEndAfter, { from: md(st.from) }) : L.pickEnd;
      return (
        '<div class="sdp-top"><span class="sdp-step">' + esc(step) + '</span><span class="sdp-nav">' +
        '<button type="button" data-nav="-1" aria-label="' + esc(L.prevMonth) + '">' + IC_L + "</button>" +
        '<button type="button" data-nav="1" aria-label="' + esc(L.nextMonth) + '">' + IC_R + "</button></span></div>" +
        '<div class="sdp-months">' + h + '</div><div class="sdp-foot"><span>' +
        (ot.length ? '<i class="sdp-key"></i>' + esc(sub(L.othersKey, { names: ot.map(function (x) { return x.label; }).join(", ") })) : "") +
        '</span><button type="button" class="citui-btn citui-btn--ghost citui-btn--sm" data-done>' + esc(L.done) + "</button></div>"
      );
    }
    function place() {
      cal.style.top = cal.style.left = cal.style.width = "";
      cal.classList.remove("is-below");
      if (narrow(form)) {
        cal.classList.add("is-inline");
        return;
      }
      cal.classList.remove("is-inline");
      // Fixed, measured from the date buttons: the card clips (overflow:hidden), and the
      // owner asked for the calendar ABOVE the button (2026-09-27) — below only when the
      // visible room above it is too small.
      var r = dates.getBoundingClientRect();
      var h = cal.offsetHeight;
      var above = r.top - stickyBottom() - 8 >= h;
      var left = Math.max(8, Math.min(r.left, window.innerWidth - cal.offsetWidth - 8));
      cal.style.left = left + "px";
      cal.style.top = (above ? r.top - h - 8 : r.bottom + 8) + "px";
      if (!above) cal.classList.add("is-below");
    }
    function draw() {
      btns();
      cal.hidden = !st.open;
      if (!st.open) return;
      cal.innerHTML = calHtml();
      cal.querySelectorAll("[data-nav]").forEach(function (x) {
        x.addEventListener("click", function () {
          st.view = ((st.view - 1 + +x.getAttribute("data-nav") + 12) % 12) + 1;
          draw();
        });
      });
      cal.querySelectorAll("[data-d]").forEach(function (x) {
        x.addEventListener("click", function () {
          var k = x.getAttribute("data-d");
          if (st.pick === "from") {
            st.from = k;
            st.to = null;
            st.pick = "to";
          } else {
            st.to = k;
            st.pick = "from";
            st.open = false;
          }
          commit();
          draw();
          if (!st.open) focusBtn("to");
        });
      });
      cal.querySelector("[data-done]").addEventListener("click", function () {
        show(false);
        focusBtn(st.pick);
      });
      place();
    }
    function focusBtn(k) {
      var b = dates.querySelector('[data-sdp="' + k + '"]');
      if (b) b.focus();
    }
    function show(on) {
      if (on && open && open !== api) open.close();
      st.open = on;
      open = on ? api : open === api ? null : open;
      draw();
    }
    function commit() {
      fi.value = st.from || "";
      ti.value = st.to || "";
      listeners.forEach(function (f) {
        f();
      });
    }
    var api = {
      st: st,
      form: form,
      cal: cal,
      dates: dates,
      set: function (f, t) {
        st.from = f;
        st.to = t;
        st.pick = "from";
        if (f) st.view = +f.slice(0, 2);
        st.open = false;
        if (open === api) open = null;
        commit();
        draw();
      },
      jump: function (m) {
        st.view = m;
        if (!st.open) st.pick = st.from && !st.to ? "to" : "from";
        show(true);
      },
      close: function () {
        st.open = false;
        draw();
      },
      place: function () {
        if (st.open) place();
      },
      onChange: function (f) {
        listeners.push(f);
      },
    };
    draw();
    return api;
  }

  /* What the chosen days MEAN, and which other season shares them. */
  function meaning(p) {
    var f = p.st.from, t = p.st.to;
    if (!f && !t) return "";
    if (!f || !t) return '<p class="s-prev">' + esc(L.endMissing) + "</p>";
    var w = f > t;
    var o = S.occurrence(f, t, S.firstOpenYear(f, t, TODAY));
    var range = w ? sub(L.wrapRange, { from: md(f), to: md(t) }) : md(f) + " – " + md(t);
    var h = '<p class="s-prev">' + sub(esc(L.every), { range: "<b>" + esc(range) + "</b>" }) +
      (w ? '<span class="wrap-tag">' + esc(L.wraps) + "</span>" : "") +
      '<br><span class="s-prev__next">' + esc(sub(L.nextEx, { example: nice(o.start) + " – " + nice(o.end) })) + "</span></p>";
    var card = p.form.closest("[data-seasons]");
    var all = card ? JSON.parse(card.getAttribute("data-seasons")) : [];
    var self = p.form.getAttribute("data-sedit");
    var isNew = !self;
    var idx = self ? all.map(function (x) { return x.id; }).indexOf(self) : all.length;
    all.forEach(function (x, i) {
      if (x.id === self) return;
      var hit = false;
      for (var m = 1; m <= 12 && !hit; m++)
        for (var d = 1; d <= DIM[m - 1]; d++) {
          var k = key(m, d);
          if (S.covers(f, t, k) && S.covers(x.from, x.to, k)) {
            hit = true;
            break;
          }
        }
      if (hit)
        h += '<p class="s-warn">' + sub(esc(L.overlap), {
          name: "<b>" + esc(x.label) + "</b>",
          range: '<span style="white-space:nowrap">' + esc(md(x.from) + " – " + md(x.to)) + "</span>",
          winner: "<b>" + esc(i < idx ? x.label : isNew ? L.thisNew : L.thisOne) + "</b>",
        }) + "</p>";
    });
    return h;
  }

  /* The year at a glance, under the add form: this unit's seasons + the new one. */
  function yearStrip(p, box) {
    var card = p.form.closest("[data-seasons]");
    var all = card ? JSON.parse(card.getAttribute("data-seasons")) : [];
    function pct(k, end) {
      var m = +k.slice(0, 2), d = +k.slice(3);
      return (((m - 1) + (d - (end ? 0 : 1)) / DIM[m - 1]) / 12) * 100;
    }
    function segs(f, t, cls, title) {
      if (!f || !t) return "";
      var one = function (a, b) {
        return '<span class="sdp-seg ' + cls + '" title="' + esc(title) + '" style="left:calc(' + a + '% + 2px);width:calc(' + (b - a) + '% - 4px)"></span>';
      };
      return f <= t ? one(pct(f), pct(t, 1)) : one(pct(f), 100) + one(0, pct(t, 1));
    }
    var h = '<div class="sdp-year__lbl">' + esc(L.yearLbl) + '</div><div class="sdp-year__bar">';
    for (var i = 1; i <= 12; i++)
      h += '<button type="button" data-m="' + i + '" aria-label="' + esc(fMon.format(at("2000-" + pad(i) + "-01"))) + '">' +
        esc(fMonS.format(at("2000-" + pad(i) + "-01")).replace(/\.$/, "")) + "</button>";
    all.forEach(function (x) {
      h += segs(x.from, x.to, "is-other", x.label);
    });
    h += segs(p.st.from, p.st.to, "is-new", L.newOne) + '</div><div class="sdp-year__key"><span><i class="is-new"></i>' + esc(L.newOne) + "</span>";
    all.forEach(function (x) {
      h += '<span><i class="is-other"></i>' + esc(x.label) + " (" + esc(sh(x.from) + " – " + sh(x.to)) + ")</span>";
    });
    box.innerHTML = h + "</div>";
    box.hidden = false;
    box.querySelectorAll("[data-m]").forEach(function (b) {
      b.addEventListener("click", function () {
        p.jump(+b.getAttribute("data-m"));
      });
    });
  }

  /* ── Season names: every recurring season at this place ────────────────── */
  function nameList(p, unitId) {
    var input = p.form.querySelector('input[name="label"]');
    if (!input) return;
    var lbId = "sdp-lb-" + unitId;
    var lb = document.createElement("ul");
    lb.className = "sdp-lb";
    lb.id = lbId;
    lb.setAttribute("role", "listbox");
    lb.hidden = true;
    input.parentNode.appendChild(lb);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", lbId);
    input.setAttribute("autocomplete", "off");
    var near = document.createElement("p");
    near.className = "sdp-near pn-full";
    near.hidden = true;
    var took = document.createElement("p");
    took.className = "sdp-took pn-full";
    took.hidden = true;
    var nameField = input.closest(".pn-f");
    nameField.parentNode.insertBefore(took, nameField.nextSibling);
    nameField.parentNode.insertBefore(near, nameField.nextSibling);
    var opts = [];
    var act = -1;

    function names() {
      var m = {}, out = [];
      NAMES.forEach(function (n) {
        var k = fold(n.label);
        var here = n.unit === unitId;
        if (!m[k]) m[k] = { label: n.label, from: n.from, to: n.to, here: here, on: [] };
        if (here) {
          m[k].here = true;
          m[k].label = n.label;
          m[k].from = n.from;
          m[k].to = n.to;
        } else if (m[k].on.indexOf(n.unitName) < 0) m[k].on.push(n.unitName);
      });
      for (var k in m) out.push(m[k]);
      return out.sort(function (a, b) {
        return a.here - b.here || a.label.localeCompare(b.label, D.lang);
      });
    }
    function hl(label, q) {
      if (!q) return esc(label);
      var i = fold(label).indexOf(q);
      // fold() keeps one char per char for these scripts, so the index maps back.
      return i < 0 ? esc(label) : esc(label.slice(0, i)) + "<mark>" + esc(label.slice(i, i + q.length)) + "</mark>" + esc(label.slice(i + q.length));
    }
    function openLb() {
      var q = fold(input.value);
      opts = names().filter(function (n) {
        return !q || fold(n.label).indexOf(q) >= 0;
      });
      if (!opts.length) return closeLb();
      var free = opts.filter(function (n) { return !n.here; });
      var here = opts.filter(function (n) { return n.here; });
      var h = "";
      if (free.length)
        h += '<li class="sdp-lb__h" role="presentation">' + esc(L.usedNames) + "</li>" +
          free.map(function (n) {
            var i = opts.indexOf(n);
            return '<li role="option" id="' + lbId + "-" + i + '" data-i="' + i + '" aria-selected="false"><span>' + hl(n.label, q) +
              "</span><small>" + esc(sh(n.from) + " – " + sh(n.to)) + "<br>" + esc(n.on.join(", ")) + "</small></li>";
          }).join("");
      if (here.length)
        h += '<li class="sdp-lb__h" role="presentation">' + esc(L.hereNames) + "</li>" +
          here.map(function (n) {
            var i = opts.indexOf(n);
            return '<li role="option" id="' + lbId + "-" + i + '" data-i="' + i + '" aria-disabled="true" aria-selected="false"><span>' +
              hl(n.label, q) + "</span><small>" + esc(sh(n.from) + " – " + sh(n.to)) + "<br>" + esc(L.editAbove) + "</small></li>";
          }).join("");
      lb.innerHTML = h;
      lb.hidden = false;
      input.setAttribute("aria-expanded", "true");
      act = -1;
      lb.querySelectorAll("li[data-i]").forEach(function (li) {
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(+li.getAttribute("data-i"));
        });
      });
    }
    function closeLb() {
      lb.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    function goTo(label) {
      var card = p.form.closest("[data-seasons]");
      var all = card ? JSON.parse(card.getAttribute("data-seasons")) : [];
      var hit = all.filter(function (x) { return fold(x.label) === fold(label); })[0];
      var el = hit && document.getElementById("s-" + hit.id);
      if (el) {
        el.scrollIntoView({ block: "center" });
        var ed = el.querySelector("[data-sedit-link]");
        if (ed) ed.focus({ preventScroll: true });
      }
    }
    function takeDays(n) {
      p.set(n.from, n.to);
      took.hidden = false;
      took.textContent = sub(L.took, { unit: n.on.join(", "), range: md(n.from) + " – " + md(n.to) }) + " " + L.tookHint;
    }
    function choose(i) {
      var n = opts[i];
      if (!n) return;
      closeLb();
      if (n.here) return goTo(n.label);
      input.value = n.label;
      takeDays(n);
      checkNear();
    }
    function checkNear() {
      var v = input.value, fv = fold(v);
      var all = names();
      var exact = all.filter(function (n) { return fold(n.label) === fv; })[0];
      var sim = !exact && fv.length >= 4 ? all.filter(function (n) { return lev(fold(n.label), fv) <= 2; })[0] : null;
      var t = exact && exact.label !== v.trim() ? exact : exact && exact.here ? exact : sim;
      if (!t || !fv) {
        near.hidden = true;
        return;
      }
      near.hidden = false;
      if (t.here) {
        near.innerHTML = sub(esc(L.nearHere), { name: "<b>" + esc(t.label) + "</b>" }) +
          '<button type="button" class="sdp-chip" data-go>' + esc(L.goThere) + "</button>";
        near.querySelector("[data-go]").addEventListener("click", function () {
          goTo(t.label);
        });
        return;
      }
      near.innerHTML = sub(esc(exact ? L.nearExact : L.nearSimilar), { name: "<b>" + esc(t.label) + "</b>" }) +
        '<button type="button" class="sdp-chip" data-fix>' + esc(t.label) + "</button>";
      near.querySelector("[data-fix]").addEventListener("click", function () {
        input.value = t.label;
        near.hidden = true;
        if (!p.st.from && !p.st.to) takeDays(t);
      });
    }
    input.addEventListener("focus", openLb);
    input.addEventListener("click", openLb);
    input.addEventListener("input", function () {
      took.hidden = true;
      openLb();
      checkNear();
    });
    input.addEventListener("blur", function () {
      setTimeout(closeLb, 120);
      checkNear();
    });
    input.addEventListener("keydown", function (e) {
      if (lb.hidden) {
        if (e.key === "ArrowDown") openLb();
        return;
      }
      var items = [].slice.call(lb.querySelectorAll("li[data-i]"));
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        act = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, i) {
          li.setAttribute("aria-selected", String(i === act));
        });
        input.setAttribute("aria-activedescendant", items[act].id);
        items[act].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && act >= 0) {
        e.preventDefault();
        choose(+items[act].getAttribute("data-i"));
      } else if (e.key === "Escape") closeLb();
    });
  }

  /* ── Wire the add and edit forms ───────────────────────────────────────── */
  var pickers = [];
  document.querySelectorAll("[data-sadd],[data-sedit]").forEach(function (form) {
    var p = Picker(form);
    if (!p) return;
    pickers.push(p);
    var out = form.querySelector("[data-sprev]");
    var year = form.querySelector("[data-syear]");
    var render = function () {
      if (out) out.innerHTML = meaning(p);
      if (year) yearStrip(p, year);
    };
    p.onChange(render);
    render();
    if (form.hasAttribute("data-sadd")) {
      var unit = form.querySelector('input[name="unit"]');
      nameList(p, unit ? unit.value : "");
    }
    form.addEventListener("submit", function (e) {
      if (!p.st.from || !p.st.to) {
        e.preventDefault();
        if (out) out.innerHTML = '<p class="s-prev s-prev--bad" role="alert">' + esc(L.needDays) + "</p>";
        p.jump(p.st.from ? +p.st.from.slice(0, 2) : p.st.view);
      }
    });
  });
  document.querySelectorAll("[data-sdp-nojs]").forEach(function (el) {
    el.hidden = true;
  });

  /* ── One YEAR of a season: a real calendar under the strip ──────────────── */
  function dimY(y, m) {
    return m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : DIM[m - 1];
  }
  function iso(y, m, d) {
    return y + "-" + key(m, d);
  }
  function addYear(i) {
    var y = +i.slice(0, 4) + 1, m = +i.slice(5, 7), d = +i.slice(8, 10);
    if (d > dimY(y, m)) d = dimY(y, m);
    return iso(y, m, d);
  }
  function openYear(cell) {
    var block = cell.closest(".season-block");
    var strip = cell.closest("[data-strip]");
    var box = block && block.querySelector("[data-ycal]");
    if (!box || !strip) return;
    var y = +cell.getAttribute("data-y");
    var fi = cell.querySelector('input[name="from"]');
    var ti = cell.querySelector('input[name="to"]');
    var f = S.normMonthDay(fi.value) || strip.getAttribute("data-from");
    var t = S.normMonthDay(ti.value) || strip.getAttribute("data-to");
    var o = S.occurrence(f, t, y);
    var rec = S.occurrence(strip.getAttribute("data-from"), strip.getAttribute("data-to"), y);
    var st = { from: o.start, to: o.end, pick: "from", vy: +o.start.slice(0, 4), vm: +o.start.slice(5, 7) };
    block.querySelectorAll(".ys-cell").forEach(function (c) {
      c.classList.toggle("is-act", c === cell);
    });
    // The first day falls in THIS year; the last at most one year later (a season that
    // runs over the year end) — exactly what occurrence() can store as MM-DD + year.
    function allowed(k) {
      var inYear = k.slice(0, 4) === String(y);
      if (st.pick === "from") return inYear;
      return (k >= st.from && k < addYear(st.from)) || (k < st.from && inYear);
    }
    function draw() {
      var one = narrow(block);
      box.classList.toggle("is-one", one);
      var ms = [[st.vy, st.vm]];
      if (!one) ms.push(st.vm === 12 ? [st.vy + 1, 1] : [st.vy, st.vm + 1]);
      var h = "";
      ms.forEach(function (p) {
        var Y = p[0], M = p[1];
        var off = (at(iso(Y, M, 1)).getUTCDay() + 6) % 7;
        h += '<div class="sdp-mon"><h5>' + esc(fYM.format(at(iso(Y, M, 1)))) + '</h5><div class="sdp-wk">' +
          WD.map(function (w, i) { return "<span" + (i > 4 ? ' class="we"' : "") + ">" + esc(w) + "</span>"; }).join("") +
          '</div><div class="sdp-grid">';
        for (var i = 0; i < off; i++) h += '<span class="sdp-pad"></span>';
        for (var d = 1; d <= dimY(Y, M); d++) {
          var k = iso(Y, M, d), c = [], wd = at(k).getUTCDay();
          if (st.from && st.to && k >= st.from && k <= st.to) c.push("in");
          if (k === st.from || k === st.to) c.push("end");
          if (wd === 0 || wd === 6) c.push("we");
          h += '<button type="button" class="' + c.join(" ") + '" data-k="' + k + '" aria-label="' + esc(fLong.format(at(k))) + '"' +
            (allowed(k) ? "" : " disabled") + ">" + d + "</button>";
        }
        h += "</div></div>";
      });
      var n = st.to ? Math.round((Date.parse(st.to) - Date.parse(st.from)) / 864e5) + 1 : 0;
      box.innerHTML =
        '<div class="sdp-top"><div><h4>' + esc(sub(L.yearTitle, { season: strip.getAttribute("data-label"), year: o.label })) + "</h4>" +
        '<span class="sdp-step">' + esc(st.pick === "from" ? L.pickStart : L.pickEnd) + '</span></div><span class="sdp-nav">' +
        '<button type="button" data-n="-1" aria-label="' + esc(L.prevMonth) + '">' + IC_L + "</button>" +
        '<button type="button" data-n="1" aria-label="' + esc(L.nextMonth) + '">' + IC_R + "</button></span></div>" +
        '<div class="sdp-months">' + h + "</div>" +
        '<div class="sdp-foot"><span class="sdp-sum">' +
        (st.to
          ? "<b>" + esc(fLong.format(at(st.from))) + "</b> – <b>" + esc(fLong.format(at(st.to))) + "</b> · " + esc(sub(L.days, { n: n }))
          : esc(L.endMissing)) +
        '<br><span class="sdp-muted">' + esc(sub(L.recDays, { range: nice(rec.start) + " – " + nice(rec.end) })) + " " + esc(L.onlyThisYear) +
        '</span></span><span class="sdp-acts"><button type="button" class="citui-btn citui-btn--ghost citui-btn--sm" data-x>' + esc(L.cancel) +
        '</button><button type="button" class="citui-btn citui-btn--primary citui-btn--sm" data-ok' + (st.to ? "" : " disabled") + ">" +
        esc(L.saveDays) + "</button></span></div>";
      box.querySelectorAll("[data-n]").forEach(function (b) {
        b.addEventListener("click", function () {
          st.vm += +b.getAttribute("data-n");
          if (st.vm > 12) {
            st.vm = 1;
            st.vy++;
          }
          if (st.vm < 1) {
            st.vm = 12;
            st.vy--;
          }
          draw();
        });
      });
      box.querySelectorAll("[data-k]").forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.getAttribute("data-k");
          if (st.pick === "from" || k < st.from) {
            if (k.slice(0, 4) !== String(y)) return;
            st.from = k;
            st.to = null;
            st.pick = "to";
          } else {
            st.to = k;
            st.pick = "from";
          }
          draw();
        });
      });
      box.querySelector("[data-x]").addEventListener("click", function () {
        box.hidden = true;
        cell.classList.remove("is-act");
      });
      box.querySelector("[data-ok]").addEventListener("click", function () {
        fi.value = st.from.slice(5);
        ti.value = st.to.slice(5);
        if (cell.requestSubmit) cell.requestSubmit();
        else cell.submit();
      });
    }
    box.hidden = false;
    draw();
    box.scrollIntoView({ block: "nearest" });
  }
  document.addEventListener("click", function (e) {
    var sm = e.target.closest && e.target.closest(".ys-days > summary");
    if (!sm) return;
    e.preventDefault();
    openYear(sm.closest(".ys-cell"));
  });

  /* A fixed popover follows its button on scroll / resize, and closes on outside click. */
  function follow() {
    if (open) open.place();
  }
  window.addEventListener("scroll", follow, { passive: true });
  window.addEventListener("resize", function () {
    if (open) open.close();
    open = null;
  });
  document.addEventListener("mousedown", function (e) {
    if (!open) return;
    if (open.cal.contains(e.target) || open.dates.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".sdp-year__bar")) return;
    open.close();
    open = null;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) {
      var p = open;
      p.close();
      open = null;
      var b = p.dates.querySelector('[data-sdp="' + p.st.pick + '"]');
      if (b) b.focus();
    }
  });
  window.CitSeasonEditor = { pickers: pickers, openYear: openYear };
})();
