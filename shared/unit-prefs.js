/*
 * Reads/writes the shared unit-preference set used across all calculators
 * in this repo, backed by localStorage so a choice made once (in
 * settings.html) applies everywhere without re-picking it per tool.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "clement-math-unit-prefs-v1";

  const DEFAULTS_US = { length: "in", force: "lbf", mass: "lb", velocity: "in/s", angle: "deg", rate: "lbf/in", energy: "in-lbf", inertia: "lbm-in2" };
  const DEFAULTS_SI = { length: "mm", force: "N", mass: "kg", velocity: "m/s", angle: "deg", rate: "N/mm", energy: "J", inertia: "kg-mm2" };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS_US);
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULTS_US, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULTS_US);
    }
  }

  function save(prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable (e.g. private mode) — prefs just won't persist */ }
  }

  global.SharedUnitPrefs = { STORAGE_KEY, DEFAULTS_US, DEFAULTS_SI, load, save };
})(typeof window !== "undefined" ? window : globalThis);
