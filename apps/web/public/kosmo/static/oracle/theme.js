/* One header, one nav, on every page.

   The nav is built from this list rather than pasted into six documents, so the
   set can never drift or list a page in a different order. The header is sticky
   and its height changes with the title, the nav wrapping and the font, so the
   levers column that sticks beneath it reads the real number from here. */
(function () {
  /* Five groups, not one row of twelve. The grouping is the lab's argument
     about what belongs with what: the machine that produces, the planet it
     runs on, the conflicts it generates, the minds that govern it, and the
     long clock all of it sits against. Every link stays one click away — a
     menu would hide eleven pages behind eleven clicks. */
  var GROUPS = [
    { name: "Machine", pages: [
      { href: "index.html", label: "Dark Factory" },
      { href: "robots.html", label: "Robots" },
      { href: "abundance.html", label: "Abundance" },
      { href: "markets.html", label: "Markets" }
    ] },
    { name: "Earth", pages: [
      { href: "fuels.html", label: "Fuels" },
      { href: "world.html", label: "World" },
      { href: "freight.html", label: "Freight" },
      { href: "metabolism.html", label: "Metabolism" }
    ] },
    { name: "Conflict", pages: [
      { href: "war.html", label: "War" },
      { href: "war-future.html", label: "War 10k" },
      { href: "cyber.html", label: "Cyber" }
    ] },
    { name: "Minds", pages: [
      { href: "development.html", label: "Development" },
      { href: "religion.html", label: "Awakening" },
      { href: "lineage.html", label: "Transmission" },
      { href: "attractor.html", label: "Metacrisis" },
      { href: "capacity.html", label: "Capacity" },
      { href: "information.html", label: "Information" }
    ] },
    { name: "Time", pages: [
      { href: "century.html", label: "Century" },
      { href: "timeline.html", label: "Timeline" }
    ] }
  ];
  var PAGES = GROUPS.reduce(function (a, g) { return a.concat(g.pages); }, []);

  var here = (location.pathname.split("/").pop() || "").toLowerCase();
  if (!here) here = "index.html";

  var host = document.querySelector("[data-nav]");
  if (host) {
    for (var g = 0; g < GROUPS.length; g++) {
      var group = GROUPS[g];
      var block = document.createElement("div");
      block.className = "navgroup";
      /* The label is not a link and not a heading: it is a divider that says
         what the next three links have in common. It carries the group's name
         for screen readers even where the layout hides it. */
      var lab = document.createElement("span");
      lab.className = "navgroup-label";
      lab.textContent = group.name;
      block.appendChild(lab);
      for (var i = 0; i < group.pages.length; i++) {
        var p = group.pages[i];
        var a = document.createElement("a");
        a.href = p.href;
        a.textContent = p.label;
        if (p.href === here) {
          a.className = "on";
          a.setAttribute("aria-current", "page");
          block.classList.add("here");
        }
        block.appendChild(a);
      }
      host.appendChild(block);
    }
  }

  var bar = document.querySelector(".topbar");
  if (!bar) return;

  /* The atlas band. The lab is a section of Kosmographica, so the parent's
     wordmark and its ten sections get the top 34px of every page here, and the
     atlas lists this lab as its last tab — the same link, both ways. Built here
     rather than pasted into nineteen documents, for the same reason as the nav.

     The paths climb one level: oracle/index.html is the lab's home, and the
     atlas lives at the repo root. */
  var ATLAS = [
    { href: "../universe-timeline.html", label: "Kosmographica" },
    { href: "../kosmopedia.html", label: "Kosmopedia" },
    { href: "../university.html", label: "University" },
    { href: "../domain.html?d=math", label: "Math" },
    { href: "../domain.html?d=physics", label: "Physics" },
    { href: "../domain.html?d=philosophy", label: "Philosophy" },
    { href: "../domain.html?d=models", label: "Models" },
    { href: "../chemistry.html", label: "Chemistry" },
    { href: "../contraption-sim.html", label: "Simulator" },
    { href: "index.html", label: "Oracle", here: true }
  ];

  var band = document.createElement("div");
  band.className = "atlasbar";
  /* Embedded in NextWiki the site header replaces this band; display:none keeps
     --atlas-h at 0 so the sticky offsets below stay right. */
  if (window.top !== window.self) band.style.display = "none";

  var mark = document.createElement("a");
  mark.className = "atlas-mark";
  mark.href = "../universe-timeline.html";
  var word = document.createElement("b");
  word.textContent = "Kosmographica";
  var strap = document.createElement("span");
  strap.textContent = "a map of everything, to scale";
  mark.appendChild(word);
  mark.appendChild(strap);
  band.appendChild(mark);

  var atlasnav = document.createElement("nav");
  atlasnav.className = "atlasnav";
  atlasnav.setAttribute("aria-label", "Kosmographica sections");
  for (var q = 0; q < ATLAS.length; q++) {
    var link = document.createElement("a");
    link.href = ATLAS[q].href;
    link.textContent = ATLAS[q].label;
    if (ATLAS[q].here) {
      link.className = "on";
      link.setAttribute("aria-current", "page");
    }
    atlasnav.appendChild(link);
  }
  band.appendChild(atlasnav);
  bar.parentNode.insertBefore(band, bar);

  function sync() {
    /* Two pinned rows now. The lab's bar can only pin at zero once the band
       above it has a height the page knows, so the number goes back out as
       --atlas-h before the bar's own height is measured. */
    var bandH = band.offsetHeight;
    document.documentElement.style.setProperty("--atlas-h", bandH + "px");
    var h = bandH + bar.offsetHeight;
    document.documentElement.style.setProperty("--topbar-h", h + "px");
    /* The sidebar can only stick below a header that itself sticks. On narrow
       screens the header scrolls away, so the levers column must not reserve
       that space or it opens below the fold. */
    var sticky = getComputedStyle(bar).position === "sticky";
    /* Below the breakpoint the lab's own bar stops pinning, but the band does
       not — so anchored sections still need to clear the band's height. */
    document.documentElement.style.setProperty("--stick-h", (sticky ? h : bandH) + "px");
  }

  sync();
  window.addEventListener("resize", sync);
  window.addEventListener("load", sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
})();
