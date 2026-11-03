/* Internal look switch for the embedded Kosmographica pages. Loaded first, as a classic
   script, so the choice is known before any page script paints a background.

   Two modes:
     match     the default: scenes and page ground use NextWiki's graphite black (#0d0d0d)
     original  the atlas's own navy-black grounds (#05070d, #07090f)

   Flip it by opening any embedded page (or /kosmo/tools/<tool>) with ?kosmoBg=original or
   ?kosmoBg=match; the choice is kept in localStorage for this origin. Clear it with
   localStorage.removeItem("kosmoBg").

   What reads it:
     - CSS:    html[data-kosmo-bg="original"] overrides --bg/--bg2/--panel (kosmographica.css, oracle/styles.css)
     - canvas: window.KOSMO_BG.pick(originalHex) returns the colour a three.js scene should clear to
   Add new modes to MODES; per-scene "original" colours stay in each page's own code. */
(function () {
  var MODES = { match: 0x0d0d0d, original: null };
  var mode = "match";
  try {
    var q = location.search.match(/[?&]kosmoBg=(match|original)/);
    if (q) localStorage.setItem("kosmoBg", q[1]);
    var saved = localStorage.getItem("kosmoBg");
    if (saved && Object.prototype.hasOwnProperty.call(MODES, saved)) mode = saved;
  } catch (e) { /* storage blocked: stay on the default */ }
  window.KOSMO_BG = {
    mode: mode,
    /* the colour for a scene whose original background was `originalHex` */
    pick: function (originalHex) { return MODES[mode] == null ? originalHex : MODES[mode]; }
  };
  document.documentElement.setAttribute("data-kosmo-bg", mode);
})();
