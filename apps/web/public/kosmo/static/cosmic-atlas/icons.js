/* Line icons for the atlas chrome. Marks up as <span data-icon="play"></span> in the page's own
   HTML, and exposes window.icon(name) for the nav and panels that script builds. Stroke follows
   the current text colour, so the icons take the Kosmographica palette with everything else. */
(function () {
  var PATHS = {
    play: '<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M9.5 5v14"/><path d="M15 5v14"/>',
    download: '<path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 20h15"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    terminal: '<path d="M4.5 7.5 9.5 12l-5 4.5"/><path d="M12 17h7.5"/>',
    "arrow-up-right": '<path d="M7 17 17 7"/><path d="M9 7h8v8"/>',
    "arrow-right": '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
    dot: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>',
    sliders:
      '<path d="M4 7h8"/><path d="M17 7h3"/><path d="M4 17h3"/><path d="M12 17h8"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    check: '<path d="M5 12.6 9.8 17.4 19 6.8"/>',
  };

  function svg(name) {
    var p = PATHS[name];
    return p ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + p + "</svg>" : "";
  }

  window.icon = function (name) {
    return '<span class="ico">' + svg(name) + "</span>";
  };

  function hydrate(root) {
    var marks = root.querySelectorAll("[data-icon]");
    for (var i = 0; i < marks.length; i++) {
      var el = marks[i];
      var host = document.createElement("span");
      host.className = (el.className + " ico").trim();
      host.innerHTML = svg(el.getAttribute("data-icon"));
      if (el.parentNode) el.parentNode.replaceChild(host, el);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    hydrate(document);
  });
  window.addEventListener("load", function () {
    hydrate(document);
  });
})();
