/* ============================================================================
   lineage-model.js — the arithmetic of transmission.

   Three things are computed here, and only the first is a measurement:

     1. effective branching  from a register's own counts: how many names the
        line had, how many generations it took, and therefore how fast it grew
     2. survival             a Galton-Watson process with the measured mean:
        even a line that grows in expectation dies out by chance at a rate that
        depends only on that mean
     3. reach                how many people a recognised teacher could have
        trained, and what share of the population that is

   The reach multiplier is the page's assumption, not a measurement. It is
   exposed as a lever so the reader can see how much of the answer is theirs.
   ============================================================================ */
(function (root) {
  "use strict";

  var POP = [
    { year: 600, pop: 200e6 },
    { year: 1000, pop: 310e6 },
    { year: 1500, pop: 500e6 },
    { year: 1800, pop: 1.0e9 },
    { year: 1900, pop: 1.65e9 },
    { year: 2025, pop: 8.2e9 }
  ];

  function populationAt(year) {
    for (var i = 1; i < POP.length; i++) {
      if (year <= POP[i].year) {
        var a = POP[i - 1], b = POP[i];
        var t = (year - a.year) / (b.year - a.year);
        return a.pop + t * (b.pop - a.pop);
      }
    }
    return POP[POP.length - 1].pop;
  }

  /* Effective branching: the geometric rate that turns one founder into N names
     over g generations. For a single-succession line the rate is exactly 1 and
     the count is the generation count, which is a different object. */
  function branching(reg) {
    var span = reg.recorded - reg.founded;
    if (!reg.branch) {
      return { R: 1, generations: reg.generations, generationLength: +(span / (reg.generations - 1)).toFixed(1) };
    }
    var generations = reg.generations - 28;   /* the register's Indian generations
                                                 are traditional; Chinese Chan
                                                 begins at Bodhidharma, the 28th */
    var R = Math.pow(reg.total, 1 / generations);
    return {
      R: +R.toFixed(3),
      generations: generations,
      generationLength: +(span / generations).toFixed(1)
    };
  }

  /* Galton-Watson extinction with Poisson offspring: the smallest s in [0,1]
     solving s = exp(R(s - 1)). At R <= 1 the answer is 1: the line dies with
     certainty, however slowly. */
  function extinction(R) {
    if (R <= 1) return 1;
    var s = 0.5;
    for (var i = 0; i < 400; i++) s = Math.exp(R * (s - 1));
    return s;
  }

  /* Cumulative names after g generations, starting from one founder. */
  function size(R, g, n0) {
    return (n0 == null ? 1 : n0) * Math.pow(R, g);
  }

  function reach(teachers, students) {
    return teachers * students;
  }

  /* The modern band. weeklyShare is the share of adults who practise weekly or
     more; rate is the share of those who report persistent nondual awareness —
     the number nobody has measured. */
  function band(adults, weeklyShare, rate) {
    var weekly = adults * weeklyShare;
    return { weekly: weekly, aware: weekly * rate };
  }

  var API = {
    POP: POP,
    populationAt: populationAt,
    branching: branching,
    extinction: extinction,
    size: size,
    reach: reach,
    band: band
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.LINEAGE_MODEL = API;
})(typeof self !== "undefined" ? self : this);
