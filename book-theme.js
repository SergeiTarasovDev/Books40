/* Общая логика страниц книг:
   1) тема (beige/dark) — синхронизируется с оболочкой через postMessage;
   2) отметка «прочитано» — кнопка сверху (десктоп) и в нижней панели (смартфон) + блок в конце;
   3) прогресс чтения — полоса сверху + постоянная плашка «% · глава N/M»;
   4) кнопка «Наверх».
   Внутри оболочки книга не рисует свой переключатель темы (он один, в меню). */
(function () {
  var KEY_THEME = "book-theme";
  var KEY_READ  = "books-read";
  var KEY_BOOKMARKS = "book-bookmarks";
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
  function applyTheme(t) { t = valid(t) || "beige"; theme = t; document.documentElement.setAttribute("data-theme", t); }

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY_READ)) || {}; } catch (e) { return {}; }
  }
  function writeAll(o) { try { localStorage.setItem(KEY_READ, JSON.stringify(o)); } catch (e) {} }

  // ---- закладки: запоминаем последнюю позицию каждой книги ----
  function readBookmarks() {
    try { return JSON.parse(localStorage.getItem(KEY_BOOKMARKS)) || {}; } catch (e) { return {}; }
  }
  function writeBookmarks(o) {
    try { localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(o)); } catch (e) {}
  }

  function scrollToPct(pct) {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var y = max > 0 ? Math.round(max * (Math.max(0, Math.min(100, pct)) / 100)) : 0;
    window.scrollTo({ top: y, behavior: "auto" });
  }

  function fileName() {
    try {
      var p = decodeURIComponent(location.pathname);
      return p.substring(p.lastIndexOf("/") + 1);
    } catch (e) { return ""; }
  }
  var FILE = fileName();
  var isBookPage = FILE && FILE !== "catalog.html" && FILE !== "index.html"
    && FILE.indexOf(".html") >= 0
    && document.documentElement.getAttribute("data-kind") !== "page";

  var embedded = (window.parent && window.parent !== window);

  function onReady(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  onReady(function () {
    if (embedded) { document.body.classList.add("embedded"); }
    var readBtn = null, readBar = null, finishBtn = null;
    var chip = null, barProgress = null;
    var toTop = null, toTopBar = null;

    // ---- панель инструментов (десктоп, верх-право) ----
    var tools = document.createElement("div");
    tools.className = "page-tools";

    if (isBookPage) {
      chip = document.createElement("span");
      chip.className = "progress-chip";
      chip.textContent = "0%";
      tools.appendChild(chip);

      readBtn = document.createElement("button");
      readBtn.type = "button";
      readBtn.className = "read-toggle";
      readBtn.innerHTML = '<span class="mark">✓</span><span class="lbl">Прочитано</span>';
      readBtn.addEventListener("click", function () { toggleRead(); });
      tools.appendChild(readBtn);
    }

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

    // ---- нижняя панель (смартфон) ----
    if (isBookPage) {
      var bar = document.createElement("div");
      bar.className = "page-bar";

      readBar = document.createElement("button");
      readBar.type = "button";
      readBar.className = "read-toggle";
      readBar.innerHTML = '<span class="mark">✓</span><span class="lbl">Прочитано</span>';
      readBar.addEventListener("click", function () { toggleRead(); });

      barProgress = document.createElement("span");
      barProgress.className = "bar-progress";
      barProgress.textContent = "0%";

      toTopBar = document.createElement("button");
      toTopBar.type = "button";
      toTopBar.className = "to-top-bar";
      toTopBar.textContent = "Наверх";
      toTopBar.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

      bar.appendChild(readBar);
      bar.appendChild(barProgress);
      bar.appendChild(toTopBar);
      document.body.appendChild(bar);

      // ---- кнопка «Наверх» (десктоп) ----
      toTop = document.createElement("button");
      toTop.type = "button";
      toTop.className = "to-top";
      toTop.textContent = "Наверх";
      toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
      document.body.appendChild(toTop);

      // ---- блок «дочитали?» в конце книги ----
      var host = document.querySelector(".wrap") || document.body;
      var fin = document.createElement("section");
      fin.className = "finish";
      fin.innerHTML = '<p class="finish-q">Дочитали книгу?</p><button class="finish-btn" type="button"></button>';
      var footerEl = host.querySelector("footer");
      if (footerEl && footerEl.parentNode === host) { host.insertBefore(fin, footerEl); }
      else { host.appendChild(fin); }
      finishBtn = fin.querySelector(".finish-btn");
      finishBtn.addEventListener("click", function () { toggleRead(); });

      // ---- полоса и плашка прогресса ----
      var barEl = document.createElement("div");
      barEl.className = "read-progress";
      var fill = document.createElement("div");
      fill.className = "read-progress-fill";
      barEl.appendChild(fill);
      document.body.appendChild(barEl);

      var chapters = Array.prototype.slice.call(document.querySelectorAll("article.chapter"));

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
        return { pct: pct, idx: idx, total: chapters.length, top: doc.scrollTop };
      }
      function onScroll() {
        var r = compute();
        fill.style.width = r.pct + "%";
        var label = chapters.length ? (r.pct + "% · глава " + r.idx + "/" + r.total) : (r.pct + "%");
        chip.textContent = label;
        barProgress.textContent = label;
        toTop.classList.toggle("show", r.top > 300);
        if (embedded) {
          try { window.parent.postMessage({ type: "book-progress", file: FILE, pct: r.pct, idx: r.idx, total: r.total }, "*"); } catch (e) {}
        }
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      onScroll();

      // ---- закладка у названия главы ----
      var chapterBtns = [];

      function chapterTitle(el) {
        var h = el.querySelector(".ch-title h3") || el.querySelector(".part-head h2") || el.querySelector("h3") || el.querySelector("h2");
        return h ? h.textContent.replace(/\s+/g, " ").trim() : "Глава";
      }

      function refreshChapterMarks() {
        var bm = readBookmarks()[FILE];
        chapterBtns.forEach(function (btn, i) {
          var on = !!(bm && bm.idx === i + 1);
          btn.classList.toggle("bookmarked", on);
          btn.title = on ? "Снять закладку" : "Поставить закладку";
          btn.setAttribute("aria-pressed", on ? "true" : "false");
          var lbl = btn.querySelector(".cb-text");
          if (lbl) lbl.textContent = on ? "В закладке" : "В закладки";
        });
        renderBookmarkBanner();
      }

      function removeLocalBookmark() {
        var all = readBookmarks();
        delete all[FILE];
        writeBookmarks(all);
        if (embedded) {
          try { window.parent.postMessage({ type: "book-bookmark", file: FILE, bookmark: null }, "*"); } catch (e) {}
        }
        refreshChapterMarks();
      }

      function renderBookmarkBanner() {
        var bm = readBookmarks()[FILE];
        var host = document.querySelector(".wrap") || document.body;
        var el = document.getElementById("bookmarkBanner");
        if (!bm) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
        if (!el) {
          el = document.createElement("div");
          el.id = "bookmarkBanner";
          el.className = "bookmark-banner";
          var hero = host.querySelector("header.hero");
          if (hero && hero.parentNode) hero.parentNode.insertBefore(el, hero.nextSibling);
          else host.insertBefore(el, host.firstChild);
        }
        el.innerHTML = "";
        var txt = document.createElement("span");
        txt.className = "bookmark-banner-txt";
        txt.textContent = "Закладка: " + (bm.chapter || ("глава " + bm.idx)) + " · " + bm.pct + "%";
        var go = document.createElement("button");
        go.type = "button";
        go.className = "bookmark-banner-go";
        go.textContent = "Перейти";
        go.addEventListener("click", function () { scrollToPct(bm.pct); });
        var del = document.createElement("button");
        del.type = "button";
        del.className = "bookmark-banner-del";
        del.innerHTML = "&times;";
        del.title = "Снять закладку";
        del.setAttribute("aria-label", "Снять закладку");
        del.addEventListener("click", removeLocalBookmark);
        el.appendChild(txt);
        el.appendChild(go);
        el.appendChild(del);
      }

      function toggleChapterBookmark(el, i) {
        var all = readBookmarks();
        var cur = all[FILE];
        if (cur && cur.idx === i + 1) {
          delete all[FILE];
          writeBookmarks(all);
          showToast("Закладка снята");
        } else {
          var doc = document.documentElement;
          var max = doc.scrollHeight - doc.clientHeight;
          var y = el.getBoundingClientRect().top + window.scrollY - 70;
          var pct = max > 0 ? Math.round((y / max) * 100) : 0;
          pct = Math.max(0, Math.min(100, pct));
          all[FILE] = { pct: pct, idx: i + 1, total: chapters.length, chapter: chapterTitle(el), ts: Date.now() };
          writeBookmarks(all);
          showToast("Закладка: " + chapterTitle(el));
        }
        if (embedded) {
          try { window.parent.postMessage({ type: "book-bookmark", file: FILE, bookmark: all[FILE] || null }, "*"); } catch (e) {}
        }
        refreshChapterMarks();
      }

      chapters.forEach(function (el, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chapter-bookmark";
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"></path></svg><span class="cb-text">В закладки</span>';
        btn.setAttribute("aria-label", "Поставить закладку");
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleChapterBookmark(el, i);
        });
        var head = el.querySelector(".ch-head");
        var partHead = el.parentElement ? el.parentElement.querySelector(".part-head") : null;
        if (head) {
          head.appendChild(btn);
        } else if (partHead) {
          partHead.appendChild(btn);
        } else {
          var h = el.querySelector("h3, h2");
          if (h && h.parentNode) { h.parentNode.insertBefore(btn, h.nextSibling); }
          else { el.insertBefore(btn, el.firstChild); }
        }
        chapterBtns.push(btn);
      });
      refreshChapterMarks();
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
      [readBtn, readBar].forEach(function (b) {
        if (!b) return;
        b.classList.toggle("read", on);
        b.title = on ? "Снять отметку «прочитано»" : "Отметить прочитанной";
      });
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

    if (embedded) {
      window.addEventListener("message", function (e) {
        var d = e.data;
        if (!d) return;
        if (d.type === "book-theme" && valid(d.theme)) { applyTheme(d.theme); saveTheme(d.theme); refreshTheme(); }
        else if (d.type === "books-read" && Array.isArray(d.list)) { setReadList(d.list); }
        else if (d.type === "book-scroll-top") { window.scrollTo({ top: 0, behavior: "smooth" }); }
        else if (d.type === "book-goto" && typeof d.pct === "number") { scrollToPct(d.pct); }
      });
    }

    refreshTheme();
    refreshRead();

    // ---- продолжить с закладки (по ?resume=1 или #resume) ----
    function showToast(text) {
      var el = document.createElement("div");
      el.className = "bookmark-toast";
      el.textContent = text;
      document.body.appendChild(el);
      requestAnimationFrame(function () { el.classList.add("show"); });
      setTimeout(function () {
        el.classList.remove("show");
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
      }, 2200);
    }
    var wantResume = /[?&]resume=1/.test(location.search) || location.hash === "#resume";
    if (isBookPage && wantResume) {
      var bm = readBookmarks()[FILE];
      if (bm && typeof bm.pct === "number") {
        setTimeout(function () {
          scrollToPct(bm.pct);
          showToast("Продолжаем с " + bm.pct + "%");
        }, 150);
      }
    }
  });
})();
