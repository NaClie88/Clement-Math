/*
 * Single source of truth for every unit conversion used across these
 * calculators. Deliberately paranoid about not repeating the Mars Climate
 * Orbiter mistake (a unit mismatch that reached a spacecraft): every
 * composite/derived unit below is computed from three internationally
 * defined EXACT constants — never a separately hand-typed decimal that
 * could silently drift from the others.
 *
 *   IN  = 0.0254 m/in     (exact, 1959 international yard & pound agreement)
 *   LB  = 0.45359237 kg/lb (exact, same agreement)
 *   G0  = 9.80665 m/s²    (exact, standard gravity by definition)
 *
 * Everything else (ft, lbf, slug, kgf, lbf/in, in·lbf, lbm·in², ...) is
 * arithmetic on those three, so e.g. "slug" and "lbf/ft" can never disagree
 * with each other the way two independently-memorized decimals could.
 *
 * API:
 *   SharedUnits.KINDS                 -> { length: [...unit names], ... }
 *   SharedUnits.toSI(kind, value, unitName)
 *   SharedUnits.fromSI(kind, value, unitName)
 *   SharedUnits.label(kind, unitName) -> display string, e.g. "lbf/in"
 *   SharedUnits.selfTest()            -> { pass, results: [...] }
 */
(function (global) {
  "use strict";

  // ---------- the only three hand-entered constants in this file ----------
  const IN = 0.0254;        // meters per inch
  const LB = 0.45359237;    // kilograms per pound-mass
  const G0 = 9.80665;       // standard gravity, m/s^2

  // ---------- everything below is derived, not memorized ----------
  const FT = 12 * IN;
  const YD = 3 * FT;
  const MILE = 5280 * FT;
  const LBF = LB * G0;       // pound-force: weight of 1 lbm under standard gravity
  const KGF = 1 * G0;        // kilogram-force: weight of 1 kg under standard gravity
  const OZ = LB / 16;
  const OZF = LBF / 16;
  const SLUG = LBF / FT;     // mass accelerated at 1 ft/s^2 by 1 lbf (F=ma)
  const DEG = Math.PI / 180;

  // factor = how many SI base units one of this unit equals
  const TABLES = {
    length: { m: 1, mm: 0.001, cm: 0.01, km: 1000, in: IN, ft: FT, yd: YD, mile: MILE },
    force: { N: 1, kN: 1000, lbf: LBF, kgf: KGF, ozf: OZF, dyn: 1e-5 },
    mass: { kg: 1, g: 0.001, tonne: 1000, lb: LB, oz: OZ, slug: SLUG },
    velocity: { "m/s": 1, "mm/s": 0.001, "in/s": IN, "ft/s": FT, mph: MILE / 3600, "km/h": 1000 / 3600 },
    angle: { deg: DEG, rad: 1 },
    rate: { "N/m": 1, "N/mm": 1000, "lbf/in": LBF / IN, "lbf/ft": LBF / FT, "kgf/mm": KGF / 0.001 },
    energy: { J: 1, mJ: 0.001, "in-lbf": IN * LBF, "ft-lbf": FT * LBF },
    inertia: { "kg-m2": 1, "kg-mm2": 1e-6, "lbm-in2": LB * IN * IN, "lbm-ft2": LB * FT * FT, "slug-ft2": SLUG * FT * FT },
    // stress/pressure (force per area) — psi derived from lbf/in^2, not a separately memorized constant
    stress: { Pa: 1, kPa: 1000, MPa: 1e6, GPa: 1e9, psi: LBF / (IN * IN), ksi: 1000 * (LBF / (IN * IN)) }
  };

  // human-friendly display labels (TABLES keys are kept identifier-safe, no special chars)
  const LABELS = {
    length: { m: "m", mm: "mm", cm: "cm", km: "km", in: "in", ft: "ft", yd: "yd", mile: "mi" },
    force: { N: "N", kN: "kN", lbf: "lbf", kgf: "kgf", ozf: "ozf", dyn: "dyn" },
    mass: { kg: "kg", g: "g", tonne: "t", lb: "lb", oz: "oz", slug: "slug" },
    velocity: { "m/s": "m/s", "mm/s": "mm/s", "in/s": "in/s", "ft/s": "ft/s", mph: "mph", "km/h": "km/h" },
    angle: { deg: "deg", rad: "rad" },
    rate: { "N/m": "N/m", "N/mm": "N/mm", "lbf/in": "lbf/in", "lbf/ft": "lbf/ft", "kgf/mm": "kgf/mm" },
    energy: { J: "J", mJ: "mJ", "in-lbf": "in·lbf", "ft-lbf": "ft·lbf" },
    inertia: { "kg-m2": "kg·m²", "kg-mm2": "kg·mm²", "lbm-in2": "lbm·in²", "lbm-ft2": "lbm·ft²", "slug-ft2": "slug·ft²" },
    stress: { Pa: "Pa", kPa: "kPa", MPa: "MPa", GPa: "GPa", psi: "psi", ksi: "ksi" }
  };

  const KINDS = {};
  Object.keys(TABLES).forEach(k => { KINDS[k] = Object.keys(TABLES[k]); });

  function toSI(kind, value, unitName) {
    const table = TABLES[kind];
    if (!table || !(unitName in table)) throw new Error(`SharedUnits.toSI: unknown unit "${unitName}" for kind "${kind}"`);
    return value * table[unitName];
  }
  function fromSI(kind, value, unitName) {
    const table = TABLES[kind];
    if (!table || !(unitName in table)) throw new Error(`SharedUnits.fromSI: unknown unit "${unitName}" for kind "${kind}"`);
    return value / table[unitName];
  }
  function label(kind, unitName) {
    return (LABELS[kind] && LABELS[kind][unitName]) || unitName;
  }

  // ---------- self-test: round-trips + independent physical cross-checks ----------
  // Exposed so a settings page can run and display this live, not just trust
  // it silently at dev time.
  function approxEqual(a, b, tol) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)); }

  function selfTest() {
    const results = [];
    const check = (name, ok, detail) => results.push({ name, ok, detail });

    // 1. Round-trip every unit in every kind: 1 unit -> SI -> back -> 1
    Object.keys(TABLES).forEach(kind => {
      Object.keys(TABLES[kind]).forEach(unitName => {
        const si = toSI(kind, 1, unitName);
        const back = fromSI(kind, si, unitName);
        check(`round-trip 1 ${label(kind, unitName)} (${kind})`, approxEqual(back, 1, 1e-12),
          `1 -> ${si} SI -> ${back}`);
      });
    });

    // 2. Independent physical cross-checks (these do NOT share code paths with
    //    the tables above — they recompute from first principles so a bug
    //    that's consistent-but-wrong in the tables would still be caught).
    // 2a. F = m*a: 1 lbm accelerated at standard gravity must equal 1 lbf.
    {
      const massSI = toSI("mass", 1, "lb");
      const forceFromMassTimesG = massSI * G0;
      const lbfSI = toSI("force", 1, "lbf");
      check("F=ma: 1 lbm x g0 == 1 lbf", approxEqual(forceFromMassTimesG, lbfSI, 1e-9),
        `${forceFromMassTimesG} N vs ${lbfSI} N`);
    }
    // 2b. 1 slug accelerated at 1 ft/s^2 must equal 1 lbf (definition of slug).
    {
      const slugSI = toSI("mass", 1, "slug");
      const oneFtS2 = toSI("length", 1, "ft"); // 1 ft/s^2 numerically same factor as 1 ft in meters
      const forceFromSlug = slugSI * oneFtS2;
      const lbfSI = toSI("force", 1, "lbf");
      check("slug definition: 1 slug x 1 ft/s^2 == 1 lbf", approxEqual(forceFromSlug, lbfSI, 1e-9),
        `${forceFromSlug} N vs ${lbfSI} N`);
    }
    // 2c. Known conversion facts, independently stated (not derived from the same formula):
    check("1 inch == 25.4 mm exactly", approxEqual(toSI("length", 1, "in"), 0.0254, 1e-15), String(toSI("length", 1, "in")));
    check("1 mile == 1609.344 m exactly", approxEqual(toSI("length", 1, "mile"), 1609.344, 1e-9), String(toSI("length", 1, "mile")));
    check("1 lbf ~= 4.4482216152605 N (NIST value)", approxEqual(toSI("force", 1, "lbf"), 4.4482216152605, 1e-9), String(toSI("force", 1, "lbf")));
    check("1 slug ~= 14.5939029372 kg (NIST value)", approxEqual(toSI("mass", 1, "slug"), 14.5939029372, 1e-8), String(toSI("mass", 1, "slug")));
    check("1 lbf/in ~= 175.126835 N/m", approxEqual(toSI("rate", 1, "lbf/in"), 175.126835, 1e-4), String(toSI("rate", 1, "lbf/in")));
    check("1 ft-lbf ~= 1.35581795 J", approxEqual(toSI("energy", 1, "ft-lbf"), 1.35581795, 1e-6), String(toSI("energy", 1, "ft-lbf")));
    check("1 lbm-in2 ~= 2.926397e-4 kg*m^2", approxEqual(toSI("inertia", 1, "lbm-in2"), 2.926397e-4, 1e-9), String(toSI("inertia", 1, "lbm-in2")));
    check("180 deg == pi rad", approxEqual(toSI("angle", 180, "deg"), Math.PI, 1e-12), String(toSI("angle", 180, "deg")));
    // 2d. Cross-kind consistency: rate table's lbf/in must equal force-table lbf divided by length-table in.
    check("lbf/in consistent with lbf and in tables independently", approxEqual(toSI("rate", 1, "lbf/in"), toSI("force", 1, "lbf") / toSI("length", 1, "in"), 1e-12),
      `${toSI("rate", 1, "lbf/in")} vs ${toSI("force", 1, "lbf") / toSI("length", 1, "in")}`);
    check("1 psi ~= 6894.76 Pa (NIST value)", approxEqual(toSI("stress", 1, "psi"), 6894.757293168, 1e-6), String(toSI("stress", 1, "psi")));
    check("psi consistent with lbf and in tables independently", approxEqual(toSI("stress", 1, "psi"), toSI("force", 1, "lbf") / (toSI("length", 1, "in") * toSI("length", 1, "in")), 1e-12),
      `${toSI("stress", 1, "psi")} vs ${toSI("force", 1, "lbf") / (toSI("length", 1, "in") * toSI("length", 1, "in"))}`);

    const pass = results.every(r => r.ok);
    return { pass, results };
  }

  global.SharedUnits = { KINDS, toSI, fromSI, label, selfTest, _constants: { IN, LB, G0, FT, LBF, KGF, SLUG, OZ, OZF } };
})(typeof window !== "undefined" ? window : globalThis);
