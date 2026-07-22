/*
 * Shared physics engine for the bent class-3 lever shock-absorber tools.
 * Loaded as a plain (non-module) script so it works over file:// as well as
 * https:// — used by both index.html (single-point calculator) and
 * optimizer.html (parameter sweep / optimizer). Keeping the formulas in one
 * place means the two tools can never drift out of sync with each other.
 */
(function (global) {
  "use strict";

  // ---------- unit conversion constants ----------
  const IN_TO_M = 0.0254;
  const LBF_TO_N = 4.4482216153;
  const LBM_TO_KG = 0.45359237;
  const DEG_TO_RAD = Math.PI / 180;
  const G = 9.80665;
  const INERTIA_US_TO_SI = LBM_TO_KG * IN_TO_M * IN_TO_M; // lbm·in² -> kg·m²

  const UNITS = {
    us: { length: "in", force: "lbf", mass: "lb", velocity: "in/s", rate: "lbf/in", time: "s", inertia: "lbm·in²" },
    si: { length: "mm", force: "N", mass: "kg", velocity: "m/s", rate: "N/mm", time: "s", inertia: "kg·m²" }
  };

  function toSI(kind, v, sys) {
    if (v === "" || v === null || v === undefined || isNaN(v)) return 0;
    v = parseFloat(v);
    if (sys === "us") {
      switch (kind) {
        case "length": return v * IN_TO_M;
        case "force": return v * LBF_TO_N;
        case "mass": return v * LBM_TO_KG;
        case "velocity": return v * IN_TO_M;
        case "rate": return v * LBF_TO_N / IN_TO_M;
        case "inertia": return v * INERTIA_US_TO_SI;
      }
    } else {
      switch (kind) {
        case "length": return v / 1000;
        case "force": return v;
        case "mass": return v;
        case "velocity": return v;
        case "rate": return v * 1000;
        case "inertia": return v;
      }
    }
    return v;
  }

  function fromSI(kind, v, sys) {
    if (sys === "us") {
      switch (kind) {
        case "length": return v / IN_TO_M;
        case "force": return v / LBF_TO_N;
        case "mass": return v / LBM_TO_KG;
        case "velocity": return v / IN_TO_M;
        case "rate": return v * IN_TO_M / LBF_TO_N;
        case "inertia": return v / INERTIA_US_TO_SI;
      }
    } else {
      switch (kind) {
        case "length": return v * 1000;
        case "force": return v;
        case "mass": return v;
        case "velocity": return v;
        case "rate": return v / 1000;
        case "inertia": return v;
      }
    }
    return v;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /**
   * Pure function: all inputs and outputs in SI (m, N, kg, rad, s) except
   * betaDeg/alphaEffortDeg/alphaLoadDeg which are degrees for readability at
   * the call site. No DOM, no globals — safe to call thousands of times in
   * a sweep.
   */
  function computeAll(input) {
    const {
      L1, L2, beta: betaDeg, Fe, me, ve, ml, k, xBudget, eta, springMode,
      alphaEffort: alphaEffortDeg, alphaLoad: alphaLoadDeg, ILever
    } = input;

    const beta = betaDeg * DEG_TO_RAD;
    const R = Math.sqrt(Math.max(0, L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(beta)));
    const MA = R > 1e-9 ? L1 / R : NaN;
    const Fl = Fe * MA;

    const KEin = 0.5 * me * ve * ve;
    const sE = Fe > 1e-9 ? KEin / Fe : 0;
    const dTheta = L1 > 1e-9 ? sE / L1 : 0; // rad
    const sL = R * dTheta;
    const tE = ve > 1e-9 ? 2 * sE / ve : 0;

    const energyToLoad = eta * KEin;
    const vL = ml > 1e-9 ? Math.sqrt(2 * energyToLoad / ml) : 0;
    const tL = vL > 1e-9 ? 2 * sL / vL : 0;

    let kUsed, xMax;
    if (springMode === "givenX") {
      xMax = xBudget;
      kUsed = xMax > 1e-9 ? ml * vL * vL / (xMax * xMax) : 0;
    } else {
      kUsed = k;
      xMax = kUsed > 1e-9 ? vL * Math.sqrt(ml / kUsed) : 0;
    }
    const FspringMax = kUsed * xMax;
    const tSpring = kUsed > 1e-9 ? (Math.PI / 2) * Math.sqrt(ml / kUsed) : 0;
    const aMaxG = ml > 1e-9 ? (FspringMax / ml) / G : 0;
    const totalTravel = sL + xMax;
    const totalTime = tE + tL + tSpring;

    let gamma = NaN;
    if (L1 > 1e-9 && R > 1e-9) {
      gamma = Math.acos(clamp((L1 * L1 + R * R - L2 * L2) / (2 * L1 * R), -1, 1));
    }
    const dThetaDeg = dTheta / DEG_TO_RAD;
    const gammaDeg = gamma / DEG_TO_RAD;

    // ---------- return stroke / home-stop impact ----------
    const alphaEffort = alphaEffortDeg * DEG_TO_RAD;
    const alphaLoad = alphaLoadDeg * DEG_TO_RAD;
    const Ereturn = eta * eta * KEin;
    const Ieff = ILever + me * L1 * L1 * Math.sin(alphaEffort) * Math.sin(alphaEffort)
                        + ml * R * R * Math.sin(alphaLoad) * Math.sin(alphaLoad);
    const omegaHome = Ieff > 1e-12 ? Math.sqrt(2 * Ereturn / Ieff) : NaN;
    const vEffortHome = isFinite(omegaHome) ? L1 * omegaHome * Math.sin(alphaEffort) : NaN;
    const vLoadHome = isFinite(omegaHome) ? R * omegaHome * Math.sin(alphaLoad) : NaN;
    const omegaHomeRpm = isFinite(omegaHome) ? omegaHome * 60 / (2 * Math.PI) : NaN;
    const deadCenter = alphaEffortDeg < 0.01 && alphaLoadDeg < 0.01;

    const warnings = [];
    if (L1 <= 0 || L2 <= 0) warnings.push("Arm length must be positive.");
    if (!(betaDeg > 0 && betaDeg <= 180)) warnings.push("Bend angle must be between 0° and 180°.");
    if (isFinite(MA) && MA >= 1) warnings.push("L₁/R ≥ 1 — this is no longer force-reducing like a typical class-3 ratio. Check L₁, L₂, β.");
    if (dThetaDeg > 150) warnings.push("Required rotation exceeds 150° — verify this is mechanically achievable.");
    if (R < 1e-6) warnings.push("Arm segments collapse onto each other at this bend angle — increase β.");

    const returnWarnings = [];
    if (Ieff <= 1e-12) {
      returnWarnings.push("Enter a nonzero lever inertia — a massless lever with any dead-center offset gives an undefined spin rate.");
    } else if (deadCenter) {
      returnWarnings.push("DEAD CENTER — both masses return at 0 velocity; all return energy is lever spin.");
    } else {
      returnWarnings.push("Offset from dead center — residual return velocity present on the axis with α>0.");
    }

    const feasible = warnings.length === 0 && Ieff > 1e-12 &&
      isFinite(Fl) && isFinite(sE) && isFinite(xMax) && isFinite(vEffortHome) && isFinite(vLoadHome);

    return {
      R, MA, Fl, KEin, sE, dTheta, dThetaDeg, sL, tE, vL, tL, kUsed, xMax, FspringMax, tSpring,
      aMaxG, totalTravel, totalTime, gamma, gammaDeg, warnings,
      Ereturn, Ieff, omegaHome, omegaHomeRpm, vEffortHome, vLoadHome, deadCenter, returnWarnings,
      feasible,
      geom: { L1, L2, beta, alphaEffort, alphaLoad }
    };
  }

  global.LeverPhysics = {
    IN_TO_M, LBF_TO_N, LBM_TO_KG, DEG_TO_RAD, G, INERTIA_US_TO_SI,
    UNITS, toSI, fromSI, clamp, computeAll
  };
})(typeof window !== "undefined" ? window : globalThis);
