/*
 * Citoviso console document table — PROGRESSIVE ENHANCEMENT only.
 * The filtering itself is server-side (ADR-0064 GET-form): every input has a
 * name and submits to the server, which returns the filtered rows via SQL. This
 * script never hides rows client-side (that would only filter the loaded page).
 * What it adds: typing in a text filter auto-submits after a short pause (no
 * Enter needed), and the field lights up as "active" the moment it has a value.
 * With JS off the form still submits on Enter / on select-change — nothing lost.
 */
(function () {
  var forms = document.querySelectorAll("form[data-ctbl-filter]");
  forms.forEach(function (form) {
    var timer = null;
    // Inputs sit in the sticky header, associated to the form via the `form=`
    // attribute — so they live in form.elements, NOT among the form's DOM
    // descendants. Iterate the association collection.
    Array.prototype.forEach.call(form.elements, function (input) {
      if (input.type !== "text") return;
      var field = input.closest(".ctbl-f");
      input.addEventListener("input", function () {
        if (field) field.classList.toggle("on", !!input.value.trim());
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { form.submit(); }, 450);
      });
    });
  });
})();
