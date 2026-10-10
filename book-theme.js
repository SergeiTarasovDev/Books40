/* Общая тема для страниц книг: beige (бежевая) / dark (графит).
   Источник темы: URL-параметр ?theme=  ->  localStorage  ->  beige.
   Внутри оболочки (books.html) страница НЕ рисует свой переключатель —
   он один, в меню оболочки, а тема приходит через postMessage. */
(function () {
  var KEY = "book-theme";
  var VALID = { beige: 1, dark: 1 };
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function valid(t) { return VALID[t] ? t : null; }
  function stored() {
    try { return valid(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function save(t) {
    try { localStorage.setItem(KEY, t); } catch (e) { /* файловый протокол может блокировать */ }
  }
  function fromUrl() {
    try {
      var m = /[?&]theme=(beige|dark)/.exec(location.search);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  var theme = valid(fromUrl()) || stored() || "beige";
  document.documentElement.setAttribute("data-theme", theme);

  function apply(t) {
    t = valid(t) || "beige";
    theme = t;
    document.documentElement.setAttribute("data-theme", t);
  }

  var embedded = (window.parent && window.parent !== window);

  function onReady(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  onReady(function () {
    if (embedded) {
      // Внутри оболочки переключатель не создаём — только принимаем тему из меню.
      window.addEventListener("message", function (e) {
        var d = e.data;
        if (d && d.type === "book-theme" && valid(d.theme)) {
          apply(d.theme);
          save(d.theme);
        }
      });
      return;
    }

    // Отдельная страница: свой переключатель солнце/луна.
    var wrap = document.createElement("div");
    wrap.className = "theme-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Тема оформления");
    wrap.innerHTML =
      '<button type="button" data-value="beige" title="Светлая тема" aria-label="Светлая тема">' + SUN + '</button>' +
      '<button type="button" data-value="dark" title="Тёмная тема" aria-label="Тёмная тема">' + MOON + '</button>';

    function refresh() {
      var t = document.documentElement.getAttribute("data-theme");
      var bs = wrap.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) {
        bs[i].classList.toggle("active", bs[i].getAttribute("data-value") === t);
      }
    }

    wrap.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      var t = b.getAttribute("data-value");
      apply(t);
      save(t);
      refresh();
    });

    refresh();
    document.body.appendChild(wrap);
  });
})();
