/* Disclosure panels open like a drawer instead of snapping.

   Every collapsible thing on the site is a <details>: the lab's lever groups,
   the university's programmes and modules, the timeline's folders, the
   simulator's notes. (The domain tree is the one exception — its branches are
   grid rows, so domain.html animates them itself, the same way.) Native <details> has no
   transition — the content appears at full height in one frame — and the CSS
   route (::details-content + interpolate-size) only exists from Chrome 131.

   So the click on a <summary> is intercepted, the real toggle is driven here,
   and the element's height is animated between its collapsed height and its
   measured scroll height. On open the height is cleared again at the end, so
   nothing downstream is ever locked into a fixed pixel height: a lever that
   re-renders, a tree that grows, a window that resizes all behave exactly as
   they did before.

   Things this deliberately does not do: it does not close siblings (the lab's
   lever groups are meant to be open together), it does not touch programmatic
   `details.open = …` (a page setting its own initial state must not animate),
   and it leaves links inside a summary alone. */

(function () {
  var DUR = 210;
  var EASE = "cubic-bezier(.4,0,.2,1)";
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var busy = new WeakSet();

  /* The summary belongs to the details directly above it; a click on a nested
     summary must animate that nested panel, not its ancestor. */
  function owner(target) {
    var summary = target.closest ? target.closest("summary") : null;
    if (!summary) return null;
    var box = summary.parentElement;
    return box && box.tagName === "DETAILS" ? box : null;
  }

  function settle(el, opened) {
    busy.delete(el);
    el.style.transition = "";
    el.style.height = "";
    el.style.overflow = "";
    if (!opened) el.open = false;
  }

  function open(el) {
    if (reduce.matches) { el.open = true; return; }
    busy.add(el);
    var from = el.getBoundingClientRect().height;
    el.open = true;
    el.style.overflow = "hidden";
    el.style.height = from + "px";
    void el.offsetHeight;
    var to = el.scrollHeight;
    el.style.transition = "height " + DUR + "ms " + EASE;
    el.style.height = to + "px";
    setTimeout(function () { settle(el, true); }, DUR + 40);
  }

  function close(el) {
    if (reduce.matches) { el.open = false; return; }
    busy.add(el);
    var from = el.getBoundingClientRect().height;
    el.style.overflow = "hidden";
    el.style.height = from + "px";
    void el.offsetHeight;
    el.style.transition = "height " + DUR + "ms " + EASE;
    el.style.height = "0px";
    setTimeout(function () { settle(el, false); }, DUR + 40);
  }

  document.addEventListener("click", function (e) {
    var el = owner(e.target);
    if (!el) return;
    /* A summary that contains a link: the link wins, the panel stays as it is. */
    if (e.target.closest("a")) return;
    e.preventDefault();
    if (busy.has(el)) return;
    if (el.open) close(el); else open(el);
  }, true);

  /* Space and Enter on a focused summary fire a click in every current browser,
     so the handler above already covers the keyboard. A toggle that arrives
     from anything else (script, form reset) is left to the browser. */
})();
