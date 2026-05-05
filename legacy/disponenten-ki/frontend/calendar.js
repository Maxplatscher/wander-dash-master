/**
 * Block 14: Dispatcher-Kalender (ohne externe Bibliothek).
 * Initialisierung über initCalendarBlock(deps) aus index.html.
 */
(function (global) {
  "use strict";

  var deps = null;

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toYMD(d) {
    if (!d) return "";
    var x = d instanceof Date ? d : new Date(d);
    if (isNaN(x.getTime())) return "";
    return x.getFullYear() + "-" + pad2(x.getMonth() + 1) + "-" + pad2(x.getDate());
  }

  function parseYMD(s) {
    if (!s) return null;
    var p = String(s).split("-");
    if (p.length !== 3) return null;
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    var dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function startOfWeekMon(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
  }

  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function addMonths(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return x;
  }

  function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }

  function germanWeekdayShort(i) {
    return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][i];
  }

  function hhmmToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== "string") return null;
    var p = hhmm.split(":");
    if (p.length < 2) return null;
    var h = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  function getViewRange(view, anchor) {
    var a = anchor ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()) : new Date();
    if (view === "day") {
      return { start: a, end: a };
    }
    if (view === "week") {
      var mon = startOfWeekMon(a);
      return { start: mon, end: addDays(mon, 6) };
    }
    var first = new Date(a.getFullYear(), a.getMonth(), 1);
    var lastD = daysInMonth(a.getFullYear(), a.getMonth());
    var last = new Date(a.getFullYear(), a.getMonth(), lastD);
    return { start: first, end: last };
  }

  function cacheKey(cid, start, end) {
    return String(cid) + "|" + toYMD(start) + "|" + toYMD(end);
  }

  async function loadCalendarEntries(force) {
    var st = deps.getState();
    var cid = st.activeCompanyId;
    if (!cid) {
      st.calendarEntries = [];
      return;
    }
    var view = st.calendarView || "week";
    var anchor = st.calendarAnchor ? parseYMD(st.calendarAnchor) : new Date();
    if (!anchor) anchor = new Date();
    var range = getViewRange(view, anchor);
    var start = range.start;
    var end = range.end;
    var key = cacheKey(cid, start, end);
    if (!force && st.calendarCache && st.calendarCache[key]) {
      st.calendarEntries = st.calendarCache[key].entries;
      st.calendarMaxToursPerDay = st.calendarCache[key].max_tours_per_day || 5;
      return;
    }
    st.calendarLoading = true;
    if (deps.syncCalendarToolbar) deps.syncCalendarToolbar();
    try {
      var path =
        "/companies/" +
        cid +
        "/calendar?start=" +
        toYMD(start) +
        "&end=" +
        toYMD(end);
      var data = await deps.api(path);
      st.calendarEntries = Array.isArray(data.entries) ? data.entries : [];
      st.calendarMaxToursPerDay = data.max_tours_per_day || 5;
      if (!st.calendarCache) st.calendarCache = {};
      st.calendarCache[key] = {
        entries: st.calendarEntries,
        max_tours_per_day: st.calendarMaxToursPerDay,
      };
    } catch (e) {
      st.calendarEntries = [];
      deps.showError(deps.normalizeApiError(e));
    } finally {
      st.calendarLoading = false;
      if (deps.syncCalendarToolbar) deps.syncCalendarToolbar();
    }
  }

  function entriesForDate(entries, ymd) {
    return (entries || []).filter(function (e) {
      return e.date === ymd;
    });
  }

  function tourCountForDate(entries, ymd) {
    return entriesForDate(entries, ymd).filter(function (e) {
      return e.type === "tour";
    }).length;
  }

  function loadBarPercent(entries, ymd, maxT) {
    var n = tourCountForDate(entries, ymd);
    var cap = maxT > 0 ? maxT : 5;
    return Math.min(100, Math.round((n / cap) * 100));
  }

  function loadBarClass(pct) {
    if (pct < 70) return "ep-cal-load-green";
    if (pct <= 90) return "ep-cal-load-yellow";
    return "ep-cal-load-red";
  }

  function esc(s) {
    return deps.escHtml(String(s == null ? "" : s));
  }

  function renderMonthView() {
    var st = deps.getState();
    var anchor = st.calendarAnchor ? parseYMD(st.calendarAnchor) : new Date();
    if (!anchor) anchor = new Date();
    var y = anchor.getFullYear();
    var m = anchor.getMonth();
    var firstWd = new Date(y, m, 1).getDay();
    var dim = daysInMonth(y, m);
    var lead = firstWd === 0 ? 6 : firstWd - 1;
    var cells = [];
    var i;
    for (i = 0; i < lead; i++) {
      cells.push({ empty: true });
    }
    for (i = 1; i <= dim; i++) {
      cells.push({ empty: false, day: i, ymd: toYMD(new Date(y, m, i)) });
    }
    while (cells.length % 7 !== 0) cells.push({ empty: true });
    while (cells.length < 42) cells.push({ empty: true });

    var entries = st.calendarEntries || [];
    var maxT = st.calendarMaxToursPerDay || 5;

    var html =
      '<div class="ep-cal-month-grid"><div class="ep-cal-month-weekdays">' +
      ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
        .map(function (d) {
          return '<div class="ep-cal-m-wd">' + esc(d) + "</div>";
        })
        .join("") +
      "</div><div class=\"ep-cal-month-cells\">";

    cells.forEach(function (cell) {
      if (cell.empty) {
        html += '<div class="ep-cal-month-cell ep-cal-month-cell-empty"></div>';
        return;
      }
      var ymd = cell.ymd;
      var dayEntries = entriesForDate(entries, ymd);
      var tours = dayEntries.filter(function (e) {
        return e.type === "tour";
      }).length;
      var open = dayEntries.filter(function (e) {
        return e.type === "unassigned" || e.type === "incomplete_shipment";
      }).length;
      var pct = loadBarPercent(entries, ymd, maxT);
      var lb = loadBarClass(pct);
      html +=
        '<div class="ep-cal-month-cell" data-ep-cal-day="' +
        esc(ymd) +
        '">' +
        '<div class="ep-cal-month-daynum">' +
        cell.day +
        "</div>" +
        '<div class="ep-cal-loadbar ' +
        lb +
        '" title="Auslastung ca. ' +
        pct +
        '%"><span style="width:' +
        pct +
        '%"></span></div>' +
        '<div class="ep-cal-month-badges">' +
        esc(tours) +
        " Touren · " +
        esc(open) +
        " offen" +
        "</div>" +
        "</div>";
    });

    html += "</div></div>";
    return html;
  }

  function renderWeekView() {
    var st = deps.getState();
    var anchor = st.calendarAnchor ? parseYMD(st.calendarAnchor) : new Date();
    if (!anchor) anchor = new Date();
    var mon = startOfWeekMon(anchor);
    var entries = st.calendarEntries || [];
    var maxT = st.calendarMaxToursPerDay || 5;
    var startH = 6;
    var endH = 20;
    var rowMin = 40;

    var days = [];
    var d;
    for (d = 0; d < 7; d++) {
      var dt = addDays(mon, d);
      days.push({ date: dt, ymd: toYMD(dt) });
    }

    var head =
      '<div class="ep-cal-week-head"><div class="ep-cal-week-corner"></div>' +
      days
        .map(function (day) {
          var pct = loadBarPercent(entries, day.ymd, maxT);
          var lb = loadBarClass(pct);
          return (
            '<div class="ep-cal-week-dayhead" data-ymd="' +
            esc(day.ymd) +
            '">' +
            "<div>" +
            esc(germanWeekdayShort(day.date.getDay())) +
            " " +
            day.date.getDate() +
            "." +
            (day.date.getMonth() + 1) +
            "</div>" +
            '<div class="ep-cal-loadbar ' +
            lb +
            '"><span style="width:' +
            pct +
            '%"></span></div>' +
            "</div>"
          );
        })
        .join("") +
      "</div>";

    var body = '<div class="ep-cal-week-body">';
    body += '<div class="ep-cal-week-hours">';
    var h;
    for (h = startH; h <= endH; h++) {
      body +=
        '<div class="ep-cal-hour-label" style="height:' +
        rowMin +
        'px">' +
        pad2(h) +
        ":00</div>";
    }
    body += "</div>";

    body += '<div class="ep-cal-week-days">';
    days.forEach(function (day) {
      var dayEntries = entriesForDate(entries, day.ymd);
      var strip = dayEntries.filter(function (e) {
        if (e.type === "unassigned" || e.type === "incomplete_shipment") {
          return true;
        }
        if (e.type === "tour" && !e.time_start) {
          return true;
        }
        return false;
      });
      var timed = dayEntries.filter(function (e) {
        return e.type === "tour" && e.time_start;
      });

      body += '<div class="ep-cal-week-col" data-ymd="' + esc(day.ymd) + '">';
      body += '<div class="ep-cal-day-strip">';
      strip.forEach(function (e) {
        var dim = e.type === "incomplete_shipment" ? " ep-cal-ev-dim" : "";
        var col = "ep-cal-ev-blue";
        if (e.type === "unassigned") col = "ep-cal-ev-orange";
        else if (e.type === "incomplete_shipment") col = "ep-cal-ev-gray";
        else if (e.type === "tour" && e.color === "red") col = "ep-cal-ev-red";
        body +=
          '<button type="button" class="ep-cal-ev ep-cal-ev-strip ' +
          col +
          dim +
          '" data-entry-id="' +
          esc(e.id) +
          '" data-entry-type="' +
          esc(e.type) +
          '">' +
          esc(e.title) +
          "</button>";
      });
      body += "</div>";
      body +=
        '<div class="ep-cal-week-grid" style="height:' +
        (endH - startH + 1) * rowMin +
        'px">';
      timed.forEach(function (e) {
        var t0 = hhmmToMinutes(e.time_start || "12:00");
        var t1 = hhmmToMinutes(e.time_end || e.time_start || "12:00");
        if (t0 == null) t0 = 8 * 60;
        if (t1 == null || t1 < t0) t1 = t0 + 60;
        var top = ((t0 / 60 - startH) * rowMin) / 1;
        var hgt = Math.max(18, ((t1 - t0) / 60) * rowMin);
        var cls = e.color === "red" ? "ep-cal-ev-red" : "ep-cal-ev-blue";
        body +=
          '<button type="button" class="ep-cal-ev ep-cal-ev-block ' +
          cls +
          '" style="top:' +
          top +
          "px;height:" +
          hgt +
          'px" data-entry-id="' +
          esc(e.id) +
          '" data-entry-type="' +
          esc(e.type) +
          '">' +
          esc(e.title) +
          "</button>";
      });
      body += "</div></div>";
    });
    body += "</div></div>";

    return head + body;
  }

  function renderDayView() {
    var st = deps.getState();
    var anchor = st.calendarAnchor ? parseYMD(st.calendarAnchor) : new Date();
    if (!anchor) anchor = new Date();
    var ymd = toYMD(anchor);
    var entries = st.calendarEntries || [];
    var dayEntries = entriesForDate(entries, ymd);
    var unassigned = dayEntries.filter(function (e) {
      return e.type === "unassigned" || e.type === "incomplete_shipment";
    });
    var tours = dayEntries.filter(function (e) {
      return e.type === "tour";
    });
    var toursTimed = tours.filter(function (e) {
      return !!e.time_start;
    });
    var toursNoTime = tours.filter(function (e) {
      return !e.time_start;
    });

    var startH = 6;
    var endH = 20;
    var rowMin = 40;

    var html =
      '<div class="ep-cal-day-wrap"><div class="ep-cal-day-main"><div class="ep-cal-week-hours">';
    var h;
    for (h = startH; h <= endH; h++) {
      html +=
        '<div class="ep-cal-hour-label" style="height:' +
        rowMin +
        'px">' +
        pad2(h) +
        ":00</div>";
    }
    html +=
      '</div><div class="ep-cal-day-col" data-ymd="' +
      esc(ymd) +
      '">';
    if (toursNoTime.length) {
      html += '<div class="ep-cal-day-strip">';
      toursNoTime.forEach(function (e) {
        var cls = e.color === "red" ? "ep-cal-ev-red" : "ep-cal-ev-blue";
        html +=
          '<button type="button" class="ep-cal-ev ep-cal-ev-strip ' +
          cls +
          '" data-entry-id="' +
          esc(e.id) +
          '" data-entry-type="tour">' +
          esc(e.title) +
          "</button>";
      });
      html += "</div>";
    }
    html +=
      '<div class="ep-cal-week-grid" style="height:' +
      (endH - startH + 1) * rowMin +
      'px">';
    toursTimed.forEach(function (e) {
      var t0 = hhmmToMinutes(e.time_start || "07:00");
      var t1 = hhmmToMinutes(e.time_end || e.time_start || "15:00");
      if (t0 == null) t0 = 7 * 60;
      if (t1 == null || t1 < t0) t1 = t0 + 120;
      var top = ((t0 / 60 - startH) * rowMin) / 1;
      var hgt = Math.max(22, ((t1 - t0) / 60) * rowMin);
      var cls = e.color === "red" ? "ep-cal-ev-red" : "ep-cal-ev-blue";
      html +=
        '<button type="button" class="ep-cal-ev ep-cal-ev-block ' +
        cls +
        '" style="top:' +
        top +
        "px;height:" +
        hgt +
        'px" data-entry-id="' +
        esc(e.id) +
        '" data-entry-type="tour">' +
        esc(e.title) +
        "</button>";
    });
    html += "</div></div></div>";

    html +=
      '<div class="ep-cal-day-unassigned"><div class="ep-cal-day-unassigned-title">Nicht zugewiesen</div><div class="ep-cal-day-unassigned-list">';
    unassigned.forEach(function (e) {
      var dim = e.type === "incomplete_shipment" ? " ep-cal-ev-dim" : "";
      html +=
        '<button type="button" class="ep-cal-ev ep-cal-ev-list ' +
        (e.type === "incomplete_shipment" ? "ep-cal-ev-gray" : "ep-cal-ev-orange") +
        dim +
        '" data-entry-id="' +
        esc(e.id) +
        '" data-entry-type="' +
        esc(e.type) +
        '">' +
        esc(e.title) +
        "</button>";
    });
    if (unassigned.length === 0) {
      html += '<span class="ep-cal-empty-hint">Keine offenen Sendungen für diesen Tag.</span>';
    }
    html += "</div></div></div>";
    return html;
  }

  function renderCalendar() {
    var st = deps.getState();
    var el = document.getElementById("ep-cal-body");
    if (!el) return;
    if (!st.activeCompanyId) {
      el.innerHTML =
        '<div class="ep-cal-empty-hint">Bitte einen Mandanten wählen.</div>';
      return;
    }
    if (st.calendarLoading) {
      el.innerHTML = "<div class=\"ep-cal-loading\">Lade Kalender…</div>";
      return;
    }
    var view = st.calendarView || "week";
    var html = "";
    if (view === "month") html = renderMonthView();
    else if (view === "day") html = renderDayView();
    else html = renderWeekView();
    el.innerHTML = html;
  }

  function handleCalendarContainerClick(ev) {
    if (!deps) return;
    if (ev.target.closest("#ep-cal-prev")) {
      navigateCalendar(-1);
      loadCalendarEntries(false).then(function () {
        renderCalendar();
        deps.syncCalendarToolbar();
      });
      return;
    }
    if (ev.target.closest("#ep-cal-next")) {
      navigateCalendar(1);
      loadCalendarEntries(false).then(function () {
        renderCalendar();
        deps.syncCalendarToolbar();
      });
      return;
    }
    if (ev.target.closest("#ep-cal-today")) {
      goToday();
      loadCalendarEntries(false).then(function () {
        renderCalendar();
        deps.syncCalendarToolbar();
      });
      return;
    }
    var viewBtn = ev.target.closest("[data-ep-cal-view]");
    if (viewBtn) {
      var v = viewBtn.getAttribute("data-ep-cal-view");
      setView(v);
      document.querySelectorAll("[data-ep-cal-view]").forEach(function (x) {
        x.classList.toggle("is-active", x.getAttribute("data-ep-cal-view") === v);
      });
      loadCalendarEntries(false).then(function () {
        renderCalendar();
        deps.syncCalendarToolbar();
      });
      return;
    }
    var entryBtn = ev.target.closest("[data-entry-id]");
    if (entryBtn && deps.onEntryClick) {
      deps.onEntryClick(entryBtn.getAttribute("data-entry-type"), entryBtn.getAttribute("data-entry-id"));
      return;
    }
    var dayCell = ev.target.closest("[data-ep-cal-day]");
    if (dayCell && deps.onMonthDayClick) {
      deps.onMonthDayClick(dayCell.getAttribute("data-ep-cal-day"));
      return;
    }
    var hd = ev.target.closest(".ep-cal-week-dayhead[data-ymd]");
    if (hd && deps.onWeekDayHeadClick) {
      deps.onWeekDayHeadClick(hd.getAttribute("data-ymd"));
      return;
    }
  }

  function navigateCalendar(dir) {
    var st = deps.getState();
    var view = st.calendarView || "week";
    var anchor = st.calendarAnchor ? parseYMD(st.calendarAnchor) : new Date();
    if (!anchor) anchor = new Date();
    if (view === "day") {
      anchor = addDays(anchor, dir > 0 ? 1 : -1);
    } else if (view === "week") {
      anchor = addDays(anchor, dir > 0 ? 7 : -7);
    } else {
      anchor = addMonths(anchor, dir > 0 ? 1 : -1);
    }
    st.calendarAnchor = toYMD(anchor);
  }

  function goToday() {
    var st = deps.getState();
    st.calendarAnchor = toYMD(new Date());
  }

  function setView(view) {
    var st = deps.getState();
    st.calendarView = view;
    var a = st.calendarAnchor ? parseYMD(st.calendarAnchor) : new Date();
    if (!a) a = new Date();
    if (view === "week") {
      a = startOfWeekMon(a);
    } else if (view === "month") {
      a = new Date(a.getFullYear(), a.getMonth(), 1);
    }
    st.calendarAnchor = toYMD(a);
  }

  function initCalendarBlock(d) {
    if (document.body.dataset.epCalendarInit) {
      return;
    }
    document.body.dataset.epCalendarInit = "1";
    deps = d;
    deps.syncCalendarToolbar = deps.syncCalendarToolbar || function () {};
    var st = deps.getState();
    if (!st.calendarAnchor) st.calendarAnchor = toYMD(startOfWeekMon(new Date()));
    if (!st.calendarView) st.calendarView = "week";

    var container = document.getElementById("calendar-container");
    if (container && !container.dataset.epCalClickBound) {
      container.dataset.epCalClickBound = "1";
      container.addEventListener("click", handleCalendarContainerClick);
    }

    deps.syncCalendarToolbar = function () {
      var s = deps.getState();
      var el = document.getElementById("ep-cal-range-label");
      if (!el) return;
      var view = s.calendarView || "week";
      var anchor = s.calendarAnchor ? parseYMD(s.calendarAnchor) : new Date();
      if (!anchor) anchor = new Date();
      var r = getViewRange(view, anchor);
      if (view === "month") {
        el.textContent =
          anchor.toLocaleString("de-DE", { month: "long", year: "numeric" });
      } else if (view === "day") {
        el.textContent = anchor.toLocaleDateString("de-DE");
      } else {
        el.textContent =
          toYMD(r.start) === toYMD(r.end)
            ? toYMD(r.start)
            : toYMD(r.start) + " – " + toYMD(r.end);
      }
    };

    global.__epCalendarEnter = function () {
      if (!deps) return;
      loadCalendarEntries(false).then(function () {
        renderCalendar();
        deps.syncCalendarToolbar();
      });
    };

    global.__epCalendarRefresh = function () {
      var sec = document.getElementById("section-kalender");
      if (!sec || !sec.classList.contains("is-active")) return;
      loadCalendarEntries(true).then(function () {
        renderCalendar();
        deps.syncCalendarToolbar();
      });
    };
  }

  global.initCalendarBlock = initCalendarBlock;
  global.__epCalendarNavigateToDay = function (ymd) {
    var st = deps && deps.getState();
    if (!st || !ymd) return;
    st.calendarView = "day";
    st.calendarAnchor = ymd;
    document.querySelectorAll("[data-ep-cal-view]").forEach(function (x) {
      x.classList.toggle("is-active", x.getAttribute("data-ep-cal-view") === "day");
    });
    if (typeof global.navigateTo === "function") {
      global.navigateTo("kalender");
      return;
    }
    loadCalendarEntries(false).then(function () {
      renderCalendar();
      if (deps.syncCalendarToolbar) deps.syncCalendarToolbar();
    });
  };

})(typeof window !== "undefined" ? window : this);
