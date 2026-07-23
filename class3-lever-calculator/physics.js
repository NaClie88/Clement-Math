/*
 * Shared physics engine for the bent class-3 lever shock-absorber tools.
 * Loaded as a plain (non-module) script so it works over file:// as well as
 * https:// — used by both index.html (single-point calculator) and
 * optimizer.html (parameter sweep / optimizer). Keeping the formulas in one
 * place means the two tools can never drift out of sync with each other.
 *
 * Requires shared/units.js to be loaded first — all unit conversion is
 * delegated there (single source of truth; see units.js's own header for
 * why that matters). This file's own contract stays unit-fixed internally:
 * every input/output here is SI (m, N, kg, s) except the angle fields
 * (beta, alphaEffort, alphaLoad, maxDTheta), which are plain degrees for
 * readability at the call site — pages convert to/from the user's chosen
 * angle unit (degrees or radians) before/after calling in here.
 */
(function (global) {
  "use strict";

  if (!global.SharedUnits) {
    throw new Error("physics.js requires shared/units.js to be loaded first.");
  }
  const SU = global.SharedUnits;

  const DEG_TO_RAD = Math.PI / 180;
  const G = SU._constants.G0; // standard gravity — same single constant units.js derives everything else from

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Wraps any degree value onto (-180, 180] — e.g. 350 and -10 normalize to
  // the same -10, since they describe the same bend orientation. Used for
  // beta (an absolute orientation on a circle), not for angles like alpha
  // or maxDTheta that represent a bounded physical quantity rather than a
  // position around a circle.
  function normalizeAngle180(deg) {
    let a = deg % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
  }

  /**
   * Pure function: all inputs and outputs in SI (m, N, kg, rad, s) except
   * betaDeg/alphaEffortDeg/alphaLoadDeg/maxDThetaDeg which are degrees for
   * readability at the call site. No DOM, no globals — safe to call
   * thousands of times in a sweep.
   */
  function computeAll(input) {
    const {
      L1, L2, beta: betaDegRaw, Fe, me, ve, ml, k, xBudget, eta, springMode,
      alphaEffort: alphaEffortDeg, alphaLoad: alphaLoadDeg, ILever,
      maxDThetaDeg = 150, xPreload = 0
    } = input;
    // Normalize defensively here too, not just at the UI boundary, so any
    // caller (a permalink, a sweep, a future page) that hands in e.g. 350
    // instead of -10 still gets a numerically identical, feasible result.
    const betaDeg = normalizeAngle180(betaDegRaw);

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

    // With preload compression x0, the spring already pushes back with
    // k*x0 at first contact, so the energy balance is a quadratic in the
    // *additional* travel Δx_max rather than a direct square root. Every
    // formula below collapses exactly to the original (x0=0) form when
    // xPreload is 0 — see README for the full derivation.
    let kUsed, xMax;
    if (springMode === "givenX") {
      xMax = xBudget;
      kUsed = xMax > 1e-9 ? ml * vL * vL / (xMax * (xMax + 2 * xPreload)) : 0;
    } else {
      kUsed = k;
      xMax = kUsed > 1e-9
        ? Math.sqrt(xPreload * xPreload + ml * vL * vL / kUsed) - xPreload
        : 0;
    }
    const F0 = kUsed * xPreload;
    const FspringMax = kUsed * (xPreload + xMax);
    const tSpring = kUsed > 1e-9 && (xPreload + xMax) > 1e-12
      ? Math.acos(clamp(xPreload / (xPreload + xMax), -1, 1)) * Math.sqrt(ml / kUsed)
      : 0;
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
    if (isFinite(MA) && MA >= 1) warnings.push("L₁/R ≥ 1 — this is no longer force-reducing like a typical class-3 ratio. Check L₁, L₂, β.");
    if (dThetaDeg > maxDThetaDeg) warnings.push(`Required rotation (${dThetaDeg.toFixed(1)}°) exceeds your max lever rotation constraint (${maxDThetaDeg}°).`);
    if (R < 1e-6) warnings.push("Arm segments collapse onto each other at this bend angle — increase β.");
    if (Fe <= 0) warnings.push("Design effort force must be positive.");
    if (me <= 0) warnings.push("Effort mass must be positive.");
    if (ml <= 0) warnings.push("Load mass must be positive.");
    if (ve < 0) warnings.push("Effort velocity must be zero or positive — a negative value would silently square away its own sign.");
    if (springMode === "givenX" ? xBudget <= 0 : k <= 0) warnings.push("Spring rate / travel budget must be positive.");
    if (ILever < 0) warnings.push("Lever inertia cannot be negative.");
    if (eta <= 0 || eta > 1) warnings.push("Efficiency (η) must be greater than 0 and no more than 100%.");
    if (xPreload < 0) warnings.push("Preload compression cannot be negative.");

    // returnStatusLevel distinguishes a genuine problem ("error") from the
    // expected default state ("info": nonzero offset is often deliberate,
    // not a mistake) so callers don't have to re-derive which is which.
    const returnWarnings = [];
    let returnStatusLevel;
    if (Ieff <= 1e-12) {
      returnWarnings.push("Enter a nonzero lever inertia — a massless lever with any dead-center offset gives an undefined spin rate.");
      returnStatusLevel = "error";
    } else if (deadCenter) {
      returnWarnings.push("DEAD CENTER — both masses return at 0 velocity; all return energy is lever spin.");
      returnStatusLevel = "ok";
    } else {
      returnWarnings.push("Offset from dead center — residual return velocity present on the axis with α>0.");
      returnStatusLevel = "info";
    }

    const feasible = warnings.length === 0 && Ieff > 1e-12 &&
      isFinite(Fl) && isFinite(sE) && isFinite(xMax) && isFinite(vEffortHome) && isFinite(vLoadHome);

    return {
      R, MA, Fl, KEin, sE, dTheta, dThetaDeg, sL, tE, vL, tL, kUsed, xMax, FspringMax, tSpring,
      xPreload, F0,
      aMaxG, totalTravel, totalTime, gamma, gammaDeg, warnings, maxDThetaDeg, betaDeg,
      Ereturn, Ieff, omegaHome, omegaHomeRpm, vEffortHome, vLoadHome, deadCenter, returnWarnings, returnStatusLevel,
      feasible,
      geom: { L1, L2, beta, alphaEffort, alphaLoad }
    };
  }

  /**
   * Optional spring wire check, independent of computeAll — pass it the
   * physical wire geometry plus the peak spring force already computed by
   * computeAll (r.FspringMax). All inputs SI (m, N, Pa, kg/m^3). Returns
   * null if the geometry inputs aren't filled in (this check is opt-in).
   *
   * References: spring index preferred 4-12 and slenderness ratio (free
   * length / mean coil diameter) buckling limit ~4 are standard spring
   * design guidance (Associated Spring / Newcomb Spring / Acxess Spring).
   * Wahl factor and shear stress formula, and the "yield shear ~= 0.35-0.52
   * of Sut" range, follow Shigley's Mechanical Engineering Design. Surge
   * frequency formula (first longitudinal mode) follows standard spring
   * vibration references (RoyMech, MISUMI).
   */
  function computeSpringCheck(input) {
    const { wireDiameter: d, coilDiameter: D, activeCoils: Na, freeLength: Lfree,
      shearModulus: Gw, density: rho, Sut, FspringMax, kEntered, xMax, xPreload = 0 } = input;

    if (!(d > 0 && D > 0 && Na > 0 && Lfree > 0 && Gw > 0)) return null;

    const C = D / d; // spring index
    const Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C; // Wahl correction factor
    const kFromGeometry = Gw * Math.pow(d, 4) / (8 * Math.pow(D, 3) * Na);
    const tauMax = isFinite(FspringMax) && FspringMax > 0 ? 8 * FspringMax * D * Kw / (Math.PI * Math.pow(d, 3)) : 0;

    const allowStatic = 0.45 * Sut;   // ~static yield-based allowable, Shigley Ssy ~ 0.35-0.52 Sut
    const allowCyclic = 0.30 * Sut;   // conservative fatigue-derated allowable

    const slenderness = Lfree / D;
    const needsGuideRod = slenderness > 4; // Associated Spring / Acxess Spring guidance

    const solidHeight = (Na + 2) * d; // approx, squared-and-ground ends
    // A preloaded spring is already sitting compressed by xPreload at rest,
    // so that much of its travel-to-solid is spent before impact even begins.
    const availableTravel = Lfree - solidHeight - xPreload;

    const fSurge = (d / (2 * Math.PI * D * D * Na)) * Math.sqrt(Gw / rho); // Hz, first surge mode

    const kDeviationPct = isFinite(kEntered) && kEntered > 0 ? (kFromGeometry - kEntered) / kEntered * 100 : null;

    const warnings = [];
    if (C < 4) warnings.push(`Spring index C=${C.toFixed(1)} is below the preferred 4–12 range — this wire will be difficult to coil.`);
    if (C > 12) warnings.push(`Spring index C=${C.toFixed(1)} is above the preferred 4–12 range — more prone to buckling and coil-to-coil contact.`);
    if (needsGuideRod) warnings.push(`Slenderness ratio ${slenderness.toFixed(1)} (free length / mean coil dia.) exceeds 4 — this spring needs a guide rod or sleeve or it will buckle sideways instead of compressing straight.`);
    if (tauMax > 0 && tauMax > allowStatic) warnings.push("Peak wire shear stress exceeds the static allowable — this spring will likely take a permanent set or fail.");
    else if (tauMax > 0 && tauMax > allowCyclic) warnings.push("Peak wire shear stress is within the static allowable but above the conservative cyclic/fatigue allowable — fine for a one-shot event, risky for repeated cycling.");
    if (availableTravel <= 0) warnings.push("Free length minus estimated solid height is zero or negative — check active coil count and free length.");
    else if (isFinite(xMax) && xMax > availableTravel) warnings.push("Computed spring travel (x_max) exceeds the available travel before coil bind — this spring will bottom out solid before absorbing the full energy.");

    return {
      C, Kw, kFromGeometry, kDeviationPct, tauMax, allowStatic, allowCyclic,
      safetyFactorStatic: tauMax > 0 ? allowStatic / tauMax : NaN,
      safetyFactorCyclic: tauMax > 0 ? allowCyclic / tauMax : NaN,
      slenderness, needsGuideRod, solidHeight, availableTravel, fSurge, warnings
    };
  }

  global.LeverPhysics = { DEG_TO_RAD, G, clamp, normalizeAngle180, computeAll, computeSpringCheck };
})(typeof window !== "undefined" ? window : globalThis);
