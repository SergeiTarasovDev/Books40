/* Общая логика страниц книг:
   1) тема (beige/dark) — синхронизируется с оболочкой через postMessage;
   2) отметка «прочитано» — на странице книги (кнопка сверху и кнопка внизу);
   3) индикатор прогресса чтения — полоса сверху + плашка «% · глава N/M».
   Внутри оболочки книга не рисует свой переключатель темы (он один, в меню). */
(function () {
  var KEY_THEME = "book-theme";
  var KEY_READ  = "books-read";
  var VALID = { beige: 1, dark: 1 };
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function valid(t) { return VALID[t] ? t : null; }
  function storedTheme() {
    try { return valid(localStorage.getItem(KEY_THEME)); } catch (e) { return null; }
  }
  function saveTheme(t) { try { localStorage.setItem(KEY_THEME, t); } catch (e) {} }
  function fromUrl() {
    try { var m = /[?&]theme=(beige|dark)/.exec(location.search); return m ? m[1] : null; }
    catch (e) { return null; }
  }

  var theme = valid(fromUrl()) || storedTheme() || "beige";
  document.documentElement.setAttribute("data-theme", theme);
  function applyTheme(t) {
    t = valid(t) || "beige";
    theme = t;
    document.documentElement.setAttribute("data-theme", t);
  }

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY_READ)) || {}; } catch (e) { return {}; }
  }
  function writeAll(o) { try { localStorage.setItem(KEY_READ, JSON.stringify(o)); } catch (e) {} }

  function fileName() {
    try {
      var p = decodeURIComponent(location.pathname);
      return p.substring(p.lastIndexOf("/") + 1);
    } catch (e) { return ""; }
  }
  var FILE = fileName();
  var isBookPage = FILE && FILE !== "catalog.html" && FILE !== "index.html" && FILE.indexOf(".html") >= 0;

  var embedded = (window.parent && window.parent !== window);

  function onReady(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  onReady(function () {
    var tools = document.createElement("div");
    tools.className = "page-tools";

    // кнопка «прочитано» сверху — только на страницах книг
    var readBtn = null;
    if (isBookPage) {
      readBtn = document.createElement("button");
      readBtn.type = "button";
      readBtn.className = "read-toggle";
      readBtn.innerHTML = '<span class="mark">✓</span><span class="lbl">Прочитано</span>';
      readBtn.addEventListener("click", function () { toggleRead(); });
      tools.appendChild(readBtn);
    }

    // переключатель темы — только на отдельной странице
    var themeWrap = null;
    if (!embedded) {
      themeWrap = document.createElement("div");
      themeWrap.className = "theme-toggle";
      themeWrap.setAttribute("role", "group");
      themeWrap.setAttribute("aria-label", "Тема оформления");
      themeWrap.innerHTML =
        '<button type="button" data-value="beige" title="Светлая тема" aria-label="Светлая тема">' + SUN + '</button>' +
        '<button type="button" data-value="dark" title="Тёмная тема" aria-label="Тёмная тема">' + MOON + '</button>';
      themeWrap.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("button") : null;
        if (!b) return;
        var t = b.getAttribute("data-value");
        applyTheme(t); saveTheme(t); refreshTheme();
      });
      tools.appendChild(themeWrap);
    }

    if (tools.children.length) document.body.appendChild(tools);

    // ---- кнопка «отметить прочитанной» в конце страницы ----
    var finishBtn = null;
    if (isBookPage) {
      var host = document.querySelector(".wrap") || document.body;
      var fin = document.createElement("section");
      fin.className = "finish";
      fin.innerHTML =
        '<p class="finish-q">Дочитали книгу?</p>' +
        '<button class="finish-btn" type="button"></button>';
      var footerEl = host.querySelector("footer");
      if (footerEl && footerEl.parentNode === host) { host.insertBefore(fin, footerEl); }
      else { host.appendChild(fin); }
      finishBtn = fin.querySelector(".finish-btn");
      finishBtn.addEventListener("click", function () { toggleRead(); });
    }

    // ---- прогресс чтения ----
    if (isBookPage) {
      var bar = document.createElement("div");
      bar.className = "read-progress";
      var fill = document.createElement("div");
      fill.className = "read-progress-fill";
      bar.appendChild(fill);
      document.body.appendChild(bar);

      var chip = document.createElement("div");
      chip.className = "read-progress-chip";
      document.body.appendChild(chip);

      var chapters = Array.prototype.slice.call(document.querySelectorAll("article.chapter"));
      var hideTimer = null;

      function compute() {
        var doc = document.documentElement;
        var max = doc.scrollHeight - doc.clientHeight;
        var pct = max > 0 ? Math.round((doc.scrollTop / max) * 100) : 100;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        var idx = 0;
        if (chapters.length) {
          idx = 1;
          for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].getBoundingClientRect().top <= 140) { idx = i + 1; }
          }
        }
        return { pct: pct, idx: idx, total: chapters.length };
      }
      function setFill() {
        var r = compute();
        fill.style.width = r.pct + "%";
      }
      function onScroll() {
        var r = compute();
        fill.style.width = r.pct + "%";
        chip.textContent = chapters.length
          ? (r.pct + "% · глава " + r.idx + "/" + r.total)
          : (r.pct + "%");
        chip.classList.add("show");
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () { chip.classList.remove("show"); }, 1200);
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", setFill);
      setFill();
    }

    // ---- состояние «прочитано» ----
    function refreshTheme() {
      if (!themeWrap) return;
      var t = document.documentElement.getAttribute("data-theme");
      var bs = themeWrap.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) {
        bs[i].classList.toggle("active", bs[i].getAttribute("data-value") === t);
      }
    }
    function refreshRead() {
      var on = !!readAll()[FILE];
      if (readBtn) {
        readBtn.classList.toggle("read", on);
        readBtn.title = on ? "Снять отметку «прочитано»" : "Отметить прочитанной";
      }
      if (finishBtn) {
        finishBtn.classList.toggle("read", on);
        finishBtn.textContent = on ? "Прочитано ✓" : "Отметить прочитанной";
      }
    }
    function setReadList(list) {
      var o = {};
      (list || []).forEach(function (f) { o[f] = 1; });
      writeAll(o);
      refreshRead();
    }
    function toggleRead() {
      var all = readAll();
      if (all[FILE]) { delete all[FILE]; } else { all[FILE] = 1; }
      writeAll(all);
      refreshRead();
      if (embedded) {
        try { window.parent.postMessage({ type: "books-read", list: Object.keys(all) }, "*"); } catch (e) {}
      }
    }

    // синхронизация с оболочкой
    if (embedded) {
      window.addEventListener("message", function (e) {
        var d = e.data;
        if (!d) return;
        if (d.type === "book-theme" && valid(d.theme)) { applyTheme(d.theme); saveTheme(d.theme); refreshTheme(); }
        else if (d.type === "books-read" && Array.isArray(d.list)) { setReadList(d.list); }
      });
    }

    refreshTheme();
    refreshRead();
  });
})();
