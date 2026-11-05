/* One lockup, one grouped menu, on every atlas page.

   The atlas used to paste a ten-link navbar into each document, in the order the
   pages were built. The lab groups its ten pages into five named groups, and the
   grouping is an argument about what belongs with what: the map, the reference,
   the study path, the domains, and the lab. This file makes the same argument
   for the atlas and builds it in one place, so a new page is one line here and
   no page can drift out of order.

   It rewrites the existing #logo and #menu in place rather than replacing the
   navbar, because each page positions its own right-hand furniture (the
   Chronicle drawer button, the clock readout) inside that bar. */
(function () {
  var GROUPS = [
    { name: "Atlas", pages: [
      { href: "universe-timeline.html", label: "Kosmographica" },
      { href: "kosmopedia.html", label: "Kosmopedia" }
    ] },
    { name: "Study", pages: [
      { href: "university.html", label: "University" }
    ] },
    /* The ids are load-bearing: domain.html's own module marks its tab by
       looking up navMath / navPhysics / navPhil / navModels and adding .here.
       Keep them, or that script throws before it renders a single row. */
    { name: "Domains", pages: [
      { href: "domain.html?d=math", label: "Math", id: "navMath" },
      { href: "domain.html?d=physics", label: "Physics", id: "navPhysics" },
      { href: "biology.html", label: "Biology" },
      { href: "domain.html?d=philosophy", label: "Philosophy", id: "navPhil" },
      { href: "domain.html?d=models", label: "Models", id: "navModels" }
    ] },
    { name: "Tools", pages: [
      { href: "chemistry.html", label: "Chemistry" },
      { href: "spacecraft.html", label: "Spacecraft" },
      { href: "contraption-sim.html", label: "Simulator" },
      { href: "graph.html", label: "Graph" }
    ] },
    { name: "Lab", pages: [
      { href: "shipyard.html", label: "Shipyard" },
      { href: "oracle/index.html", label: "Oracle" }
    ] }
  ];

  var file = (location.pathname.split("/").pop() || "universe-timeline.html").toLowerCase();
  var domain = (location.search.match(/[?&]d=([^&]+)/) || [])[1] || "";

  /* What "here" means per page: the domain table is one document wearing four
     hats, so it is current only for the domain in its query string. */
  function isCurrent(href) {
    var path = href.split("?")[0];
    if (path !== file) return false;
    var q = (href.split("?")[1] || "").match(/d=([^&]+)/);
    if (!q) return true;
    return q[1] === domain;
  }

  var logo = document.getElementById("logo");
  if (logo) {
    logo.innerHTML =
      '<a class="lockup" href="universe-timeline.html" aria-label="Kosmographica — a map of everything, to scale">' +
      '<span class="logo-orb" aria-hidden="true"></span>' +
      '<span class="names">' +
      '<span class="word">Kosmographica</span>' +
      '<span class="sub">a map of everything, to scale</span>' +
      "</span></a>";
  }

  var menu = document.getElementById("menu");
  if (!menu) return;
  menu.innerHTML = "";

  for (var g = 0; g < GROUPS.length; g++) {
    var group = GROUPS[g];
    var block = document.createElement("div");
    block.className = "navgroup";

    var label = document.createElement("span");
    label.className = "navgroup-label";
    label.textContent = group.name;
    block.appendChild(label);

    for (var i = 0; i < group.pages.length; i++) {
      var page = group.pages[i];
      var a = document.createElement("a");
      a.href = page.href;
      a.textContent = page.label;
      if (page.id) a.id = page.id;
      if (isCurrent(page.href)) {
        a.className = "here";
        a.setAttribute("aria-current", "page");
        block.classList.add("here");
      }
      block.appendChild(a);
    }
    menu.appendChild(block);
  }
})();
