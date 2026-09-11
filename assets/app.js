(function () {
  "use strict";

  var ENDPOINT = (window.GW_CONFIG && window.GW_CONFIG.commentsEndpoint || "").trim();
  var showId = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) {
    if (!u) return "";
    try {
      var p = new URL(u, location.href);
      return (p.protocol === "http:" || p.protocol === "https:") ? p.href : "";
    } catch (e) { return ""; }
  }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key) || "";
      localStorage.setItem(key, val);
    } catch (e) { return ""; }
  }
  function when(ts) {
    var d = new Date(ts);
    if (isNaN(d)) return "";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function status(msg) {
    var s = $("#comments-status");
    s.textContent = msg;
    s.hidden = !msg;
  }

  // ---------- Run sheet rendering ----------
  function renderItem(it) {
    var li = el("li");
    var url = safeUrl(it.url);
    var hl;
    if (url) {
      hl = el("a", "hl", it.h);
      hl.href = url; hl.target = "_blank"; hl.rel = "noopener";
    } else {
      hl = el("span", "hl", it.h);
    }
    li.appendChild(hl);
    if (url && it.src) li.appendChild(el("span", "src", it.src + " ↗"));
    if (it.t) li.appendChild(el("span", "detail", it.t));
    return li;
  }

  function renderSegment(seg) {
    var box = el("section", "segment");
    box.id = "seg-" + seg.id;
    box.dataset.segment = seg.id;
    var head = el("div", "seg-head");
    head.appendChild(el("h3", null, seg.title));
    if (seg.time) head.appendChild(el("span", "time", seg.time));
    box.appendChild(head);
    var ul = el("ul", "items");
    (seg.items || []).forEach(function (it) { ul.appendChild(renderItem(it)); });
    box.appendChild(ul);
    box.appendChild(el("ul", "additions"));
    box.appendChild(el("div", "thread"));
    box.appendChild(el("div", "seg-actions"));
    return box;
  }

  function renderShow(show) {
    document.title = show.show + " Run Sheet – " + show.date;
    $("#show-date").textContent = show.date;
    $("#show-airtime").textContent = show.airtime || "";
    $("#show-lineup").textContent = show.lineup || "";

    if (show.verify && show.verify.length) {
      var vl = $("#verify-list"); vl.textContent = "";
      show.verify.forEach(function (v) { vl.appendChild(el("li", null, v)); });
      $("#lines-note").textContent = show.lines_note || "";
      $("#verify").hidden = false;
    }

    var sheet = $("#sheet"); sheet.textContent = "";
    var toc = $("#toc"); toc.textContent = "";
    (show.hours || []).forEach(function (hour) {
      var h = el("section", "hour");
      h.appendChild(el("h2", null, hour.title));
      if (hour.subtitle) h.appendChild(el("p", "hour-sub", hour.subtitle));
      (hour.blocks || []).forEach(function (block) {
        var b = el("div", "block");
        var bt = el("h3", "block-title");
        bt.appendChild(el("span", null, block.title));
        if (block.time) bt.appendChild(el("span", "time", block.time));
        b.appendChild(bt);
        (block.segments || []).forEach(function (seg) {
          b.appendChild(renderSegment(seg));
          var a = el("a", null, seg.title.replace(/^Segment:\s*/i, ""));
          a.href = "#seg-" + seg.id;
          toc.appendChild(a);
        });
        h.appendChild(b);
      });
      sheet.appendChild(h);
    });

    document.querySelectorAll(".segment").forEach(addActions);
  }

  // ---------- Comments ----------
  function addActions(box) {
    var actions = $(".seg-actions", box);
    actions.textContent = "";
    if (!ENDPOINT) return;
    var c = el("button", null, "Comment"); c.type = "button";
    var a = el("button", null, "Add a story"); a.type = "button";
    c.addEventListener("click", function () { openForm(box, "comment"); });
    a.addEventListener("click", function () { openForm(box, "addition"); });
    actions.appendChild(c); actions.appendChild(a);
  }

  function openForm(box, kind) {
    var old = $(".post-form", box);
    if (old) old.remove();
    var form = $("#form-tpl").content.firstElementChild.cloneNode(true);
    var isAdd = kind === "addition";
    $(".text-label-text", form).textContent = isAdd ? "What should we add?" : "Comment";
    $(".link-label", form).hidden = !isAdd;
    form.elements.name.value = store("gw-name");
    $(".cancel", form).addEventListener("click", function () { form.remove(); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      submit(form, box.dataset.segment, kind);
    });
    $(".seg-actions", box).after(form);
    (form.elements.name.value ? form.elements.text : form.elements.name).focus();
  }

  function submit(form, segment, kind) {
    var msg = $(".form-msg", form);
    var btn = $("button[type=submit]", form);
    var name = form.elements.name.value.trim();
    var text = form.elements.text.value.trim();
    var link = kind === "addition" ? safeUrl(form.elements.link.value.trim()) : "";
    if (!name || !text) { msg.textContent = "Name and text are required."; return; }
    if (kind === "addition" && form.elements.link.value.trim() && !link) {
      msg.textContent = "That link doesn't look right (needs http:// or https://)."; return;
    }
    store("gw-name", name);
    btn.disabled = true; msg.textContent = "Posting...";
    var payload = { show: showId, segment: segment, kind: kind, name: name, text: text, link: link, website: form.elements.website.value };
    fetch(ENDPOINT, { method: "POST", body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || "Could not post");
        form.remove();
        placeEntry(res.entry || { segment: segment, kind: kind, name: name, text: text, link: link, ts: new Date().toISOString() });
      })
      .catch(function (err) {
        btn.disabled = false;
        msg.textContent = "Didn't post: " + err.message + ". Try again in a minute.";
      });
  }

  function placeEntry(c) {
    var box = document.querySelector('.segment[data-segment="' + CSS.escape(c.segment) + '"]') || $("#seg-general");
    if (c.kind === "addition") {
      var li = el("li");
      var url = safeUrl(c.link);
      var hl;
      if (url) { hl = el("a", "hl", c.text); hl.href = url; hl.target = "_blank"; hl.rel = "noopener"; }
      else { hl = el("span", "hl", c.text); }
      li.appendChild(hl);
      li.appendChild(el("span", "added-by", "Added by " + c.name + (c.ts ? " · " + when(c.ts) : "")));
      $(".additions", box).appendChild(li);
    } else {
      var d = el("div", "comment");
      d.appendChild(el("span", "who", c.name));
      if (c.ts) d.appendChild(el("span", "when", when(c.ts)));
      d.appendChild(el("p", null, c.text));
      $(".thread", box).appendChild(d);
    }
  }

  function loadComments() {
    if (!ENDPOINT) {
      status("Comments aren't switched on yet.");
      return;
    }
    fetch(ENDPOINT + "?show=" + encodeURIComponent(showId))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || "load failed");
        (res.comments || []).forEach(placeEntry);
        status("");
      })
      .catch(function () { status("Couldn't load comments right now. The run sheet is still current."); });
  }

  // ---------- Boot ----------
  function load(id) {
    showId = id;
    return fetch("data/shows/" + encodeURIComponent(id) + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (show) {
        renderShow(show);
        addActions($("#seg-general"));
        $("#seg-general .additions").textContent = "";
        $("#seg-general .thread").textContent = "";
        loadComments();
      });
  }

  fetch("data/shows/index.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (list) {
      var wanted = new URLSearchParams(location.search).get("show");
      var ids = list.map(function (s) { return s.id; });
      var id = ids.indexOf(wanted) >= 0 ? wanted : ids[0];
      if (list.length > 1) {
        var pick = $("#show-picker");
        list.forEach(function (s) {
          var o = el("option", null, s.label); o.value = s.id; pick.appendChild(o);
        });
        pick.value = id;
        pick.addEventListener("change", function () {
          history.replaceState(null, "", "?show=" + encodeURIComponent(pick.value));
          load(pick.value);
        });
        pick.parentElement.hidden = false;
      }
      return load(id);
    })
    .catch(function () {
      $("#show-date").textContent = "Couldn't load the run sheet. Refresh to try again.";
    });
})();
