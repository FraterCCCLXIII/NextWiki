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
