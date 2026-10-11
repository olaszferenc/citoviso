// Árazás és értékesítés — the page script (ADR-0360 ⑦, frozen plan
// assets/design-refs/console/pricing-redesign/). Inlined by src/console/views.ts.
//
// It keeps the overview, the packages, the module table, the per-ending table, the
// "Így fut" lines and the unsaved marks live, and serialises the packages (pkg_json) and
// the endings (tld_json) into the form. ⛔ It mirrors the server, it never decides: the
// POST re-validates both and writes nothing when either is wrong.
(function () {
  "use strict";
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); return; }
  init();

  function init() {
    var D = JSON.parse(document.getElementById("pr2_data").textContent);
    var M = D.msgs;
    var form = document.getElementById("pr2-form");
    var TIERS = D.tiers.map(function (t) { return t.id; });
    var tierLabel = {}, tierArt = {}; D.tiers.forEach(function (t) { tierLabel[t.id] = t.label; tierArt[t.id] = t.withArt; });
    var MODS = {}; D.modules.forEach(function (m) { MODS[m.id] = m; });
    var DOM_ID = D.domainId;
    var assign = {}; Object.keys(D.assign).forEach(function (k) { assign[k] = D.assign[k]; });
    var tlds = D.tlds.map(function (t) { return Object.assign({}, t); });
    var selected = null;

    // ── helpers ─────────────────────────────────────────────────────────────
    function fill(t, v) { return String(t).replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : "{" + k + "}"; }); }
    // ADR-0162: one amount, one spelling — CitMoney (cit-money.js, inlined before this file).
    function grp(n) { return CitMoney.formatNumber(Math.round(n)); }
    function money(n) { return CitMoney.formatMoney(Math.round(n), D.currency); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function idx(t) { return TIERS.indexOf(t); }
    function $(id) { return document.getElementById(id); }
    function num(name, fallback) {
      var el = form.querySelector('[name="' + name + '"]');
      if (!el || el.disabled) return fallback;
      var v = Number(String(el.value).replace(/\s+/g, ""));
      return isFinite(v) ? v : fallback;
    }
    function checked(name) { var el = form.querySelector('[name="' + name + '"]'); return !!(el && el.checked); }
    function label(id) { return id === DOM_ID ? M.dom : (MODS[id] ? MODS[id].label : id); }
    // ADR-0192 ②: off sale takes down what hard-requires it (sellableModuleIds, mirrored) —
    // the price and the „nem eladó” mark read this ONE closure.
    function unsellableSet() {
      var out = {};
      D.modules.forEach(function (m) { if (!m.spine && !checkedSell(m.id)) out[m.id] = true; });
      for (var guard = 0; guard <= D.modules.length; guard++) {
        var grew = false;
        D.modules.forEach(function (m) {
          if (out[m.id]) return;
          if (m.requires.some(function (r) { return out[r]; })) { out[m.id] = true; grew = true; }
        });
        if (!grew) break;
      }
      return out;
    }
    var OFF = {};
    function sellable(id) { var m = MODS[id]; return !m || m.spine || !OFF[id]; }
    function priceOf(id) {
      var el = form.querySelector('[name="m_' + id + '"]');
      if (el) { var v = Number(el.value); if (isFinite(v) && v >= 0) return v; }
      return MODS[id] ? MODS[id].price : 0;
    }
    function full(t) { return Object.keys(assign).filter(function (id) { return idx(assign[id]) <= idx(t); }); }
    function own(t) { return Object.keys(assign).filter(function (id) { return assign[id] === t; }); }
    function packagePrice(t) {
      var base = num("base_monthly", D.base);
      return full(t).reduce(function (a, id) {
        var m = MODS[id];
        return a + (m && !m.spine && !m.once && sellable(id) ? priceOf(id) : 0);
      }, base);
    }
    function domFree() { return checked("domain_free_in_package"); }
    function domIn(t) { return domFree() && assign[DOM_ID] !== undefined && idx(assign[DOM_ID]) <= idx(t); }
    function freeTlds() { return tlds.filter(function (x) { return x.offered && x.freeInPackage; }).map(function (x) { return x.tld; }); }
    function firstOn() { return tlds.filter(function (x) { return x.offered; })[0] || null; }
    function minPkg() { return num("domain_min_package_monthly", D.minPkg); }

    // ── packages: dependency-aware moves (ADR-0192 — mirrors packageAssignmentErrors) ──
    function dependantsOf(id) {
      return Object.keys(assign).filter(function (y) { return MODS[y] && MODS[y].requires.indexOf(id) >= 0; });
    }
    function moveTo(id, tier) {
      var m = MODS[id];
      if (id !== DOM_ID && (!m || m.spine || !m.packageable)) return;
      if (id === DOM_ID && tier && !domFree()) { toast(M.domOffPkg, "bad"); return; }
      var pulled = [], dropped = [], raised = [];
      if (tier) {
        assign[id] = tier;
        // its hard requirements come along into the same tier (or lower, if already there)
        var q = (m ? m.requires : []).slice();
        while (q.length) {
          var r = q.shift();
          if (!MODS[r] || !MODS[r].packageable) continue;
          if (assign[r] === undefined || idx(assign[r]) > idx(tier)) {
            assign[r] = tier; pulled.push(label(r));
            q = q.concat(MODS[r].requires);
          }
        }
        // what builds on it may not sit below it any more
        var up = dependantsOf(id);
        while (up.length) {
          var y = up.shift();
          if (assign[y] !== undefined && idx(assign[y]) < idx(tier)) {
            assign[y] = tier; raised.push(label(y)); up = up.concat(dependantsOf(y));
          }
        }
        toast(fill(M.movedTo, { m: label(id), t: tierLabel[tier] }) + (idx(tier) < TIERS.length - 1 ? M.movedUp : "") +
          (pulled.length ? " " + fill(M.pulled, { list: pulled.join(", ") }) : "") +
          (raised.length ? " " + fill(M.raised, { list: raised.join(", ") }) : ""));
      } else {
        delete assign[id];
        var down = dependantsOf(id);
        while (down.length) {
          var z = down.shift();
          if (assign[z] === undefined) continue;
          delete assign[z]; dropped.push(label(z)); down = down.concat(dependantsOf(z));
        }
        toast(fill(M.removed, { m: label(id) }) + (dropped.length ? " " + fill(M.dropped, { list: dropped.join(", ") }) : ""));
      }
      selected = null;
      render();
    }

    function pill(id, o) {
      o = o || {};
      var m = MODS[id], isDom = id === DOM_ID;
      var cls = "pr2-pl" + (isDom ? " is-dom" : "") + (m && m.spine ? " is-spine" : "") + (o.inh ? " is-inh" : "") +
        (!isDom && m && !m.spine && !sellable(id) && assign[id] !== undefined ? " is-stop" : "") + (selected === id && !o.inh ? " is-sel" : "") + (isDom && !domFree() && o.pool ? " is-off" : "");
      var stop = !isDom && !m.spine && !sellable(id) && assign[id] !== undefined;
      var p = isDom ? (domFree() ? "" : M.domFee) : m.spine ? M.gerinc : stop ? M.notForSale : m.once ? fill(M.onceFee, { p: money(priceOf(id)) }) : "+" + grp(priceOf(id));
      var fixed = o.inh || (m && m.spine) || (m && !m.packageable);
      var x = !o.inh && !o.pool && !(m && m.spine)
        ? '<button class="pr2-x" type="button" data-rm="' + esc(id) + '" aria-label="' + esc(fill(M.remove, { m: label(id) })) + '">×</button>' : "";
      return '<span class="' + cls + '" data-id="' + esc(id) + '"' + (fixed ? ' data-fixed="1"' : "") +
        (o.inh ? ' title="' + esc(M.inhTitle) + '"' : !sellable(id) ? ' title="' + esc(M.stopTitle) + '"' : "") + ">" +
        "<b>" + esc(label(id)) + "</b>" + (p ? " <small>" + esc(p) + "</small>" : "") + x + "</span>";
    }
    function domLine(t) {
      if (domIn(t)) return '<div class="pr2-pkdom is-in">' + esc(fill(M.domainLineIn, { t: freeTlds().join(", ") || M.domainLineNoFree })) + "</div>";
      if (minPkg() > 0 && packagePrice(t) < minPkg()) return '<div class="pr2-pkdom">' + esc(fill(M.domainLineMin, { p: money(minPkg()) })) + "</div>";
      // Elek A1: every offered ending with its own fee, not the first one alone.
      var on = tlds.filter(function (x) { return x.offered; });
      return '<div class="pr2-pkdom">' + esc(on.length ? on.map(function (x) { return fill(M.domainLineFee, { p: money(x.monthlyFee), t: x.tld }); }).join(" · ") : M.domainLineNone) + "</div>";
    }
    function renderPackages() {
      var outside = D.modules.filter(function (m) { return m.packageable && assign[m.id] === undefined; }).map(function (m) { return m.id; });
      if (assign[DOM_ID] === undefined) outside.push(DOM_ID);
      $("pr2-pool-chips").innerHTML = outside.length ? outside.map(function (id) { return pill(id, { pool: true }); }).join("") : '<span class="mut small">' + esc(M.allIn) + "</span>";
      $("pr2-cols").innerHTML = TIERS.map(function (t, i) {
        var mine = own(t), inh = i ? full(TIERS[i - 1]) : [];
        var n = full(t).filter(function (id) { return id !== DOM_ID; }).length;
        var price = packagePrice(t);
        return '<div class="pr2-pk' + (selected ? " is-armed" : "") + '" data-tier="' + t + '">' +
          '<div class="pr2-pk__h"><span class="pr2-pk__n">' + esc(tierLabel[t]) + '</span><span class="pr2-pk__p">' + esc(money(price)) + "<small> " + esc(M.perMonth) + "</small></span></div>" +
          '<div class="pr2-pk__sub">' + esc(fill(M.modN, { n: n })) + " · " + esc(fill(M.yearly, { p: money(price * (12 - num("annual_free_months", D.freeM))) })) + "</div>" +
          (inh.length ? '<div class="pr2-pk__lbl">' + esc(i === 1 ? M.inhFromAlap : M.inhFromAjanlott) + '</div><div class="pr2-chips">' + inh.map(function (id) { return pill(id, { inh: true }); }).join("") + "</div>" : "") +
          '<div class="pr2-pk__lbl">' + esc(i ? M.ownN : M.own0) + '</div><div class="pr2-chips">' + (mine.length ? mine.map(function (id) { return pill(id); }).join("") : '<span class="mut small">—</span>') + "</div>" +
          domLine(t) +
          '<div class="pr2-pk__drop">' + esc(selected ? fill(M.dropSel, { m: label(selected), t: tierLabel[t] }) : M.drop) + "</div></div>";
      }).join("");
      $("pkg_json").value = JSON.stringify(assign);
      document.querySelectorAll("[data-tier-of]").forEach(function (el) {
        var t = assign[el.getAttribute("data-tier-of")];
        el.textContent = t ? (idx(t) < TIERS.length - 1 ? fill(M.tierFrom, { t: tierLabel[t] }) : tierLabel[t]) : M.outside;
      });
    }

    // ── endings table ───────────────────────────────────────────────────────
    function badOf(x, k) { return x.bad && x.bad[k] != null ? x.bad[k] : null; }
    function renderTlds() {
      var tb = $("pr2-tld").querySelector("tbody");
      tb.innerHTML = tlds.map(function (x, i) {
        var over = x.costNet != null && x.costNet > x.maxCost;
        var blocks = over && x.offered;
        var at = x.costMeasuredAt ? String(x.costMeasuredAt).slice(0, 10) : "";
        return '<tr data-i="' + i + '"><td class="pr2-full"><b class="pr2-end">' + esc(x.tld) + "</b></td>" +
          '<td><span class="pr2-lm">' + esc(M.lmOffered) + '</span><label class="con-sell"><input type="checkbox" data-k="offered"' + (x.offered ? " checked" : "") + ' aria-label="' + esc(x.tld + " " + M.lmOffered) + '"><span class="con-sell__track"></span></label></td>' +
          '<td><span class="pr2-lm">' + esc(M.lmCost) + "</span>" + (x.costNet != null ? esc(CitMoney.formatMoney(x.costNet, x.costCurrency)) : '<span class="mut">' + esc(M.notMeasured) + "</span>") +
          '<span class="pr2-meas">' + esc(at) + ' <button class="pr2-btn pr2-btn--sm" type="button" data-q="' + i + '">' + esc(M.measure) + "</button></span></td>" +
          '<td class="' + (blocks || badOf(x, "maxCost") !== null ? "err" : "") + '"><span class="pr2-lm">' + esc(M.lmCap) + '</span><input class="pr2-tin" data-k="maxCost" inputmode="numeric" value="' + esc(badOf(x, "maxCost") !== null ? badOf(x, "maxCost") : x.maxCost) + '"><span class="pr2-u">' + esc(CitMoney.currencySign(x.costCurrency)) + "</span>" + (over ? '<div class="pr2-ferr">' + esc(M.overCap) + "</div>" : "") + "</td>" +
          '<td class="' + (badOf(x, "monthlyFee") !== null ? "err" : "") + '"><span class="pr2-lm">' + esc(M.lmFee) + '</span><input class="pr2-tin" data-k="monthlyFee" inputmode="numeric" value="' + esc(badOf(x, "monthlyFee") !== null ? badOf(x, "monthlyFee") : x.monthlyFee) + '"><span class="pr2-u">' + esc(D.unit + M.perMonth) + "</span></td>" +
          '<td><span class="pr2-lm">' + esc(M.lmFree) + '</span><label class="con-sell"><input type="checkbox" data-k="freeInPackage"' + (x.freeInPackage ? " checked" : "") + (domFree() ? "" : " disabled") + ' aria-label="' + esc(x.tld + " " + M.lmFree) + '"><span class="con-sell__track"></span></label></td>' +
          '<td><button class="pr2-btn pr2-btn--sm" type="button" data-del="' + i + '">' + esc(M.del) + "</button></td></tr>";
      }).join("");
      // The typed-but-invalid values stay on screen (x.bad), never in the posted rows.
      $("tld_json").value = JSON.stringify(tlds.map(function (x) { var c = Object.assign({}, x); delete c.bad; return c; }));
    }

    // ── overview ────────────────────────────────────────────────────────────
    function renderOverview() {
      var sold = D.modules.filter(function (m) { return !m.spine; });
      var on = sold.filter(function (m) { return checkedSell(m.id); });
      var outside = D.modules.filter(function (m) { return m.packageable && !m.spine && assign[m.id] === undefined; }).length;
      var intro = num("out_percent", 0), escOn = checked("esc_on"), escP = num("esc_percent", 0), nth = num("esc_threshold", 0);
      var trOn = checked("trial_on"), days = num("trial_days", 0), cp = num("coupon_percent", 0), cd = num("coupon_days", 0);
      var freeM = num("annual_free_months", D.freeM);
      function card(title, big, cap, rows) {
        return '<div class="pr2-w"><div class="pr2-w__h">' + esc(title) + '</div><div class="pr2-w__big">' + esc(big) + '</div><div class="pr2-w__cap">' + esc(cap) + '</div><div class="pr2-w__rows">' +
          rows.map(function (r) { return "<span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b>"; }).join("") + "</div></div>";
      }
      $("pr2-wg").innerHTML =
        card(M.pkgTitle, money(packagePrice("ajanlott")), fill(M.monthly, { tier: tierLabel.ajanlott }) + (domIn("ajanlott") ? M.domIn : ""),
          [[tierLabel.alap, money(packagePrice("alap"))], [tierLabel.teljes, money(packagePrice("teljes"))], [M.annual, fill(M.annualV, { n: freeM })]]) +
        card(M.modTitle, on.length + " / " + sold.length, M.sellable,
          [[M.outside, String(outside)], [M.stopped, String(sold.length - on.length)], [M.dom, domFree() && assign[DOM_ID] !== undefined ? M.domPkg : M.domFee]]) +
        card(M.offTitle, "−" + intro + "%", M.intro,
          [[M.esc, escOn ? fill(M.escV, { p: escP, n: nth }) : M.off], [M.trial, trOn ? fill(M.trialV, { d: days }) : M.off], [M.coupon, fill(M.couponV, { p: cp, d: cd })]]);

      var a = [];
      D.modules.forEach(function (m) {
        if (m.spine || assign[m.id] === undefined || sellable(m.id)) return;
        var cause = checkedSell(m.id) ? m.requires.filter(function (r) { return OFF[r]; }).map(label)[0] : null;
        a.push(["warn", fill(cause ? M.attKnocked : M.attStopped, { m: m.label, dep: cause || "" }), fill(M.attStoppedWhy, { tierArt: tierArt[assign[m.id]] }), "pr2-s-mod", M.modTitle]);
      });
      if (domFree() && assign[DOM_ID] !== undefined && !freeTlds().length) a.push(["bad", M.attNoFree, M.attNoFreeWhy, "pr2-s-dom", M.dom]);
      if (!firstOn()) a.push(["bad", M.attNoTld, M.attNoTldWhy, "pr2-s-dom", M.dom]);
      tlds.forEach(function (x) { if (x.costNet == null) a.push(["info", fill(M.attUnmeasured, { t: x.tld }), M.attUnmeasuredWhy, "pr2-s-dom", M.dom]); });
      if (!checked("pricing_confirmed")) a.push(["warn", M.attConf, M.attConfWhy, "pr2-s-fin", M.confOff.split(" — ")[0]]);
      $("pr2-att-n").textContent = String(a.length);
      $("pr2-att-list").innerHTML = a.length
        ? a.map(function (x) { return '<a href="#' + x[3] + '" class="pr2-att__row"><i class="is-' + x[0] + '"></i><span><b>' + esc(x[1]) + "</b>" + esc(x[2]) + "</span><em>" + esc(x[4]) + "</em></a>"; }).join("")
        : '<div class="pr2-att__none">' + esc(M.attNone) + "</div>";
      var c = $("pr2-conf");
      if (c) { var ok = checked("pricing_confirmed"); c.className = "pill pr2-conf " + (ok ? "approved" : "warn"); c.textContent = ok ? M.confOn : M.confOff; }
    }
    function checkedSell(id) {
      var el = form.querySelector('[name="sell_' + id + '"]');
      return el ? el.checked : sellable(id);
    }

    // ── "Így fut" lines ─────────────────────────────────────────────────────
    function renderRuns() {
      var aj = packagePrice("ajanlott"), freeM = num("annual_free_months", D.freeM);
      $("pr2-run-base").textContent = fill(M.runBase, { m: money(aj), k: 12 - freeM, y: money(aj * (12 - freeM)), n: freeM });
      // Elek A1: the fee is PER ENDING (ADR-0360 ③) — with endings at different fees the
      // line names the range, not the first ending's fee alone (.eu 1 200 read "+1 000").
      var fees = tlds.filter(function (x) { return x.offered; }).map(function (x) { return x.monthlyFee; });
      var lo = fees.length ? Math.min.apply(null, fees) : null, hi = fees.length ? Math.max.apply(null, fees) : null;
      var feeTxt = lo === null ? "—" : lo === hi ? money(lo) : money(lo) + "–" + money(hi);
      var lines = TIERS.map(function (t) {
        if (domIn(t)) return fill(M.runDomIn, { t: tierLabel[t], e: freeTlds()[0] || "" });
        if (minPkg() > 0 && packagePrice(t) < minPkg()) return fill(M.runDomMin, { t: tierLabel[t] });
        return fill(M.runDomFee, { t: tierLabel[t], p: feeTxt });
      }).join(" · ");
      $("pr2-run-dom").textContent = fill(M.runDom, { lines: lines, c: num("domain_min_commitment_months", D.commit), b: money(num("domain_buyout_price", D.buyout)) });
    }

    // ── unsaved marks (per section: the form values inside it at load vs now) ─
    var sections = Array.prototype.slice.call(document.querySelectorAll("#pr2-snav [data-sec]")).map(function (a) { return a.getAttribute("data-sec"); });
    function snapshotOf(id) {
      var el = $(id); if (!el) return "";
      return Array.prototype.map.call(el.querySelectorAll("input,select"), function (i) {
        return (i.name || i.id) + "=" + (i.type === "checkbox" ? i.checked : i.value);
      }).join("&");
    }
    var initial = {};
    function renderDirty() {
      var n = 0;
      sections.forEach(function (id) {
        var chip = document.querySelector('#pr2-snav [data-sec="' + id + '"]');
        var d = snapshotOf(id) !== initial[id];
        if (d) n++;
        if (chip) chip.classList.toggle("is-dirty", d);
      });
      $("pr2-dirty").textContent = n ? fill(M.dirty, { n: n }) : "";
      form.dataset.pr2Dirty = String(n);
    }

    // ── validity of the two JSON blocks (the server re-checks) ─────────────
    // Counted from the CURRENT table (not a per-row flag): a fix in one row must not
    // re-enable the save while another row is still wrong.
    function renderErrors() {
      var bad = $("pr2-tld").querySelectorAll("td.err").length;
      form.dataset.errPr2 = String(bad);
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = Object.keys(form.dataset).some(function (k) { return /^err/.test(k) && form.dataset[k] !== "0"; });
      var sum = $("pr2-err-sum"); if (sum) sum.textContent = bad ? M.errSum : "";
    }

    function render() {
      OFF = unsellableSet();
      if (!domFree() && assign[DOM_ID] !== undefined) { delete assign[DOM_ID]; toast(M.domOffMoved); }
      renderPackages(); renderTlds(); renderOverview(); renderRuns(); renderErrors(); renderDirty();
    }
    function renderLight() { OFF = unsellableSet(); renderPackages(); renderOverview(); renderRuns(); renderErrors(); renderDirty(); }

    var tmo;
    function toast(t, kind) {
      var e = $("pr2-pk-msg"); if (!e) return;
      e.textContent = t; e.className = "pr2-toast" + (kind === "bad" ? " is-bad" : "");
      clearTimeout(tmo); tmo = setTimeout(function () { e.textContent = ""; }, 6000);
    }

    // ── drag: pointer events (mouse + touch), edge auto-scroll; tap = select ──
    var drag = null;
    function zoneAt(x, y) { var n = document.elementFromPoint(x, y); return n ? n.closest(".pr2-pk[data-tier], #pr2-pool") : null; }
    function hot() {
      if (!drag) return;
      document.querySelectorAll(".pr2-pk.is-hot, #pr2-pool.is-hot").forEach(function (x) { x.classList.remove("is-hot"); });
      var t = zoneAt(drag.cx, drag.cy); if (t) t.classList.add("is-hot");
    }
    document.addEventListener("pointerdown", function (e) {
      if (e.target.closest("[data-rm]")) return;
      var p = e.target.closest(".pr2-pl"); if (!p || p.getAttribute("data-fixed") || p.classList.contains("is-off")) return;
      drag = { id: p.getAttribute("data-id"), src: p, x: e.clientX, y: e.clientY };
    });
    document.addEventListener("pointermove", function (e) {
      if (!drag) return;
      if (!drag.ghost) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
        drag.ghost = drag.src.cloneNode(true); drag.ghost.classList.add("pr2-ghost"); document.body.appendChild(drag.ghost);
      }
      drag.ghost.style.left = (e.clientX - 20) + "px"; drag.ghost.style.top = (e.clientY - 14) + "px";
      drag.cx = e.clientX; drag.cy = e.clientY; hot();
      var v = e.clientY < 70 ? -1 : e.clientY > innerHeight - 70 ? 1 : 0;
      clearInterval(drag.as); if (v) drag.as = setInterval(function () { scrollBy(0, v * 14); hot(); }, 16);
      e.preventDefault();
    }, { passive: false });
    document.addEventListener("pointerup", function (e) {
      if (!drag) return;
      var d = drag; drag = null; clearInterval(d.as);
      document.querySelectorAll(".is-hot").forEach(function (x) { x.classList.remove("is-hot"); });
      if (d.ghost) { d.ghost.remove(); var z = zoneAt(e.clientX, e.clientY); if (z) moveTo(d.id, z.id === "pr2-pool" ? null : z.getAttribute("data-tier")); return; }
      selected = selected === d.id ? null : d.id; renderPackages();
      if (selected) toast(fill(M.selected, { m: label(selected) }));
    });
    document.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-rm]"); if (rm) { moveTo(rm.getAttribute("data-rm"), null); return; }
      if (selected && !e.target.closest(".pr2-pl")) {
        var z = e.target.closest(".pr2-pk[data-tier], #pr2-pool");
        if (z) { moveTo(selected, z.id === "pr2-pool" ? null : z.getAttribute("data-tier")); return; }
      }
      var q = e.target.closest("[data-q]"); if (q) { measure(+q.getAttribute("data-q"), q); return; }
      var del = e.target.closest("[data-del]"); if (del) { tlds.splice(+del.getAttribute("data-del"), 1); render(); return; }
    });

    // ── endings: edits, measure, add ────────────────────────────────────────
    $("pr2-tld").addEventListener("change", function (e) {
      var tr = e.target.closest("tr"); if (!tr) return;
      var x = tlds[+tr.getAttribute("data-i")], k = e.target.getAttribute("data-k");
      if (k === "offered") {
        if (e.target.checked && x.costNet == null) { e.target.checked = false; toast(M.needMeasure, "bad"); return; }
        if (e.target.checked && x.costNet > x.maxCost) { e.target.checked = false; toast(M.overCap, "bad"); return; }
        x.offered = e.target.checked;
      }
      if (k === "freeInPackage") x.freeInPackage = e.target.checked;
      if (k === "maxCost" || k === "monthlyFee") {
        var v = String(e.target.value).replace(/\s+/g, "");
        x.bad = x.bad || {};
        if (!/^\d+$/.test(v)) { x.bad[k] = e.target.value; toast(M.needInt, "bad"); render(); return; }
        delete x.bad[k];
        x[k] = +v; if (k === "maxCost" && x.costNet != null && x.costNet > x.maxCost) x.offered = false;
      }
      render();
    });
    function measure(i, btn) {
      var x = tlds[i]; btn.disabled = true; btn.textContent = M.measuring;
      fetch(D.measureUrl + "?tld=" + encodeURIComponent(x.tld), { method: "POST", credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) {
            x.costNet = j.amount; x.costCurrency = j.currency; x.costMeasuredAt = j.measuredAt;
            if (x.costNet > x.maxCost) x.offered = false;
            toast(fill(M.measureOk, { t: x.tld, p: CitMoney.formatMoney(j.amount, j.currency) }));
          } else {
            x.costNet = null; x.costMeasuredAt = null; x.offered = false;
            toast(fill(M.measureFail, { t: x.tld }), "bad");
          }
          render();
        })
        .catch(function () { toast(fill(M.measureFail, { t: x.tld }), "bad"); btn.disabled = false; btn.textContent = M.measure; });
    }
    $("pr2-add-tld").addEventListener("click", function () {
      var inp = $("pr2-new-tld"), box = $("f_pr2-new"), er = $("pr2-new-err");
      var v = "." + String(inp.value).trim().toLowerCase().replace(/^\.+/, "");
      var bad = !/^\.[a-z]{2,24}$/.test(v) ? M.tldBad : tlds.some(function (x) { return x.tld === v; }) ? fill(M.tldDup, { t: v }) : "";
      box.classList.toggle("err", !!bad); er.textContent = bad; if (bad) return;
      tlds.push({ tld: v, offered: false, costNet: null, costCurrency: "HUF", costMeasuredAt: null, maxCost: 5000, monthlyFee: firstOn() ? firstOn().monthlyFee : 0, freeInPackage: false });
      inp.value = ""; render(); toast(fill(M.tldAdded, { t: v }));
    });

    // ── the rest of the form drives the live parts ─────────────────────────
    form.addEventListener("input", function (e) {
      if (e.target.closest("#pr2-tld")) return;
      var tr = e.target.closest("#pr2-mods tr");
      renderLight();
      if (tr) tr.classList.toggle("is-off", !checkedSell(tr.getAttribute("data-m")));
    });
    form.addEventListener("change", function (e) {
      if (e.target.closest("#pr2-tld")) return;
      if (e.target.name === "domain_free_in_package") { render(); return; }
      var tr = e.target.closest("#pr2-mods tr");
      if (tr) tr.classList.toggle("is-off", !checkedSell(tr.getAttribute("data-m")));
      renderLight();
    });
    $("pr2-reset").addEventListener("click", function () { location.href = location.pathname + location.search.replace(/([?&])saved=[^&]*/, "$1").replace(/[?&]$/, ""); });
    form.addEventListener("submit", function () { form.dataset.pr2Submitting = "1"; });
    window.addEventListener("beforeunload", function (e) {
      if (form.dataset.pr2Submitting === "1" || form.dataset.pr2Dirty === "0" || !form.dataset.pr2Dirty) return;
      e.preventDefault(); e.returnValue = M.unsavedLeave; return M.unsavedLeave;
    });

    render();
    // The baseline is taken AFTER the first render: the JSON fields are filled by it.
    sections.forEach(function (id) { initial[id] = snapshotOf(id); });
    renderDirty();
  }
})();
