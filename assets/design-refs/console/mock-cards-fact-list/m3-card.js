// M3 plan-round · H-2: what did the fact gate flag? ?k=0 (today) | 1 (the chip opens the list) | 2 (list always on the card)
(function () {
  var k = new URLSearchParams(location.search).get("k") || "1";
  // "Részletek ▾" works as on the console (its script was stripped from the snapshot)
  document.querySelectorAll(".con-mk__more").forEach(function (b) {
    b.addEventListener("click", function () {
      var det = document.getElementById(b.getAttribute("aria-controls"));
      var open = det.hasAttribute("hidden");
      if (open) det.removeAttribute("hidden"); else det.setAttribute("hidden", "");
      b.setAttribute("aria-expanded", String(open));
      b.textContent = open ? "Bezárom ▴" : "Részletek ▾";
    });
  });
  if (k === "0") return;
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  document.querySelectorAll("article.con-mk").forEach(function (card, ci) {
    var items = JSON.parse(card.getAttribute("data-items") || "[]");
    var chip = card.querySelector('.con-mk__gate[data-verdict="flag"]');
    if (!chip || !items.length) return;
    var label = "Tényhűség: " + items.length + " forrás nélküli";
    var box = document.createElement("div");
    box.className = "m3-fl";
    box.id = "m3-fl-" + ci;
    var foot = "<p>Küldés előtt: javítsd a szöveget, vagy indoklással vedd tudomásul (a küldés-megerősítőben).</p>";
    var shown = k === "2" ? items.slice(0, 3) : items;
    box.innerHTML = "<b>A tényhűség-őr ezekre nem talált forrást:</b><ul>" +
      shown.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      (k === "2" && items.length > 3 ? '<button type="button" class="m3-more">és még ' + (items.length - 3) + " ▾</button>" : "") + foot;
    var dl = card.querySelector(".con-mk__facts");
    dl.parentNode.insertBefore(box, dl.nextSibling);
    if (k === "1") {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = chip.className;
      btn.setAttribute("data-verdict", "flag");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", box.id);
      btn.textContent = label + " ▾";
      chip.replaceWith(btn);
      box.hidden = true;
      btn.addEventListener("click", function () {
        box.hidden = !box.hidden;
        btn.setAttribute("aria-expanded", String(!box.hidden));
        btn.textContent = label + (box.hidden ? " ▾" : " ▴");
      });
    } else {
      chip.textContent = label;
      var more = box.querySelector(".m3-more");
      if (more) more.addEventListener("click", function () {
        box.querySelector("ul").innerHTML = items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
        more.remove();
      });
    }
  });
})();
