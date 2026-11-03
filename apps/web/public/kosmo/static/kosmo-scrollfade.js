/* Top and bottom fade for scrollable side panels in the embedded pages. Adds .scroll-fade to each container
   (CSS in kosmographica.css / oracle/styles.css) and toggles .fade-t / .fade-b from its scroll position. */
(function () {
  var SELECTORS = ["#panel", "aside", "#examList", "#vlist", "#folders", "#results", ".levers"];
  function wire(el) {
    if (el._kosmoFade) return;
    el._kosmoFade = true;
    el.classList.add("scroll-fade");
    function update() {
      var max = el.scrollHeight - el.clientHeight;
      el.classList.toggle("fade-t", el.scrollTop > 2);
      el.classList.toggle("fade-b", max > 2 && el.scrollTop < max - 2);
    }
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(update);
      ro.observe(el);
      for (var i = 0; i < el.children.length; i++) ro.observe(el.children[i]);
    }
    update();
    setTimeout(update, 600);   // content that fills in after load (catalogue lists, charts)
    setTimeout(update, 2500);
  }
  function init() {
    SELECTORS.forEach(function (s) { document.querySelectorAll(s).forEach(wire); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.addEventListener("load", init);
})();
