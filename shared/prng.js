/*
 * Seeded pseudo-random number generator (mulberry32), shared across
 * calculators that need reproducible random sampling (Monte Carlo sweeps,
 * etc.). Deterministic: the same seed always produces the same sequence,
 * so a sweep run can be reproduced exactly by recording its seed.
 */
(function (global) {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function uniform(rand, min, max) {
    if (max < min) { const t = min; min = max; max = t; }
    return min + rand() * (max - min);
  }

  global.SharedPRNG = { mulberry32, uniform };
})(typeof window !== "undefined" ? window : globalThis);
