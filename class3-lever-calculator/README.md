# Bent Class-3 Lever — Impact-to-Spring Shock Absorber Calculator

Interactive hand-calculation tool for a class-3 lever mechanism, bent at the
effort point, that converts an incoming impact into a load mass traveling
down a linear bearing into a spring — including the return stroke, where the
same spring sends both masses back to a home hard stop. Open `index.html` in
any browser — no build step, no server, no external dependencies.

Three pages, one physics engine:

- **`index.html`** — single-point calculator: one set of inputs, full
  breakdown of the outputs, live schematic, plus per-parameter testing
  bounds with a one-at-a-time sensitivity view.
- **`optimizer.html`** — Design Space Explorer: Monte Carlo sweep over the
  same model. Lock the parameters you've already fixed, give the rest a
  range, weight the objectives that matter for your build, and get back a
  ranked list plus a Pareto-front view of the trade-offs. Tag results by
  which effort-force ranges they hold up across. Results save locally
  (IndexedDB) and export to CSV or a real `.xlsx`.
- **`settings.html`** — one shared unit-preference set for every quantity
  (length, force, mass, velocity, angle, spring rate, energy, moment of
  inertia), applied instantly across both tools, plus a live self-test of
  the conversion math itself.

All three load `physics.js` (same formulas, one source of truth),
`../shared/units.js` (unit conversion, one source of truth), and
`../shared/theme.css` (shared visual language across calculators in this
repo).

## Units are fully configurable, not just US/Metric

Open **Settings** (the ⚙ Units link in either tool's header) to pick a unit
independently for each quantity — mix and match freely (e.g. millimeters
with pounds-force). Preferences are stored in the browser (`localStorage`)
and apply immediately to both `index.html` and `optimizer.html`.

Every composite unit (lbf, slug, lbf/in, in·lbf, lbm·in², ...) is *derived at
runtime* from three internationally-defined exact constants — 1 in = 0.0254 m,
1 lb = 0.45359237 kg, standard gravity = 9.80665 m/s² — never a second,
independently hand-typed decimal that could quietly drift from the others.
Settings' self-test panel round-trips every supported unit and independently
cross-checks the physics (F=ma, the literal definition of a slug) live in the
browser, so the conversion table's correctness is shown, not just asserted.

## What it's for

You're designing a linear shock absorber: an effort mass impacts the lever,
the lever (fulcrum – effort – load, with the effort arm bent relative to the
load arm) accelerates a load mass, which continues down a linear bearing and
is arrested by a spring. The spring then sends both masses back to the home
hard stop. This tool turns your geometry and impact conditions into the
numbers you need to spec and bench-test real hardware:

- Load force produced for a given effort force
- Minimum effort-side travel for a given allowable effort force
- Required lever rotation, load-side travel, and handoff velocity
- Spring rate and/or stroke (solves either direction)
- Peak spring force, timing, and total linear-bearing length to budget
- Residual impact velocity/energy at the home stop on the return stroke,
  and how to design it toward zero mechanically (no bumper material)

## Parameter glossary

| Symbol | Meaning |
|---|---|
| L₁ | Fulcrum → effort-point length |
| L₂ | Effort-point → load-point length |
| β | Interior bend angle at the effort point (180° = straight lever) |
| R | Effective fulcrum → load-point distance (derived, not measured directly) |
| γ | Layout angle at the fulcrum between the effort and load arms (derived) |
| F_effort | Design/allowable force at the effort point |
| m_effort, v_effort | Mass and incoming velocity of the impacting effort mass |
| m_load | Mass carried into the spring |
| k | Spring rate |
| η | Lumped efficiency (pivot friction + lever inertia + bearing drag), one-way |
| α_effort, α_load | Effort/load bearing-axis offset from dead center at the home stop |
| I_lever | Lever moment of inertia about the fulcrum |

## Formulas — power stroke

**Geometry** — rigid body, so R is fixed regardless of rotation (law of cosines):

```
R = √( L1² + L2² − 2·L1·L2·cos β )
```

A straight lever is the limiting case β = 180°, where R = L1 + L2. Bending the
arm shortens R relative to a straight lever of the same segment lengths —
this is why L2 is measured from the effort point, not assumed to add
straight onto L1.

**Static force ratio** — idealized perpendicular-force torque balance:

```
F_load = F_effort · (L1 / R)
```

**Effort-side stroke** (work-energy theorem) — given the incoming effort
mass and velocity, holding the effort force at its design value sets the
*minimum* possible effort-side travel:

```
KE_in = ½ · m_effort · v_effort²
s_effort(min) = KE_in / F_effort
Δθ = s_effort / L1                     (required lever rotation)
```

Raising the allowable design force is the only way to shrink the effort-side
travel for a given impact energy.

**Load handoff & spring sizing** — η lumps pivot friction, lever inertia, and
bearing drag:

```
v_load = √( 2 · η · KE_in / m_load )
x_max = v_load · √( m_load / k )        (spring stroke to spec)
F_spring,max = k · x_max
t_spring = (π/2) · √( m_load / k )
```

The calculator can also solve the inverse direction: given a stroke budget
(packaging limit), it back-solves the required spring rate `k`.

## Formulas — return stroke & the dead-center technique

The same spring pushes both masses back toward the home hard stop — without
help, they arrive with roughly the energy they left with, which is the
"hammer on anvil" ringing. The calculator models both masses on their own
linear bearing, each pinned to the lever through a slotted (Scotch-yoke)
coupling. A crank pin at radius `r` moving through angle `φ` (measured from
where the arm is parallel to the slide axis) has slide-axis velocity
`v = r·ω·sin(φ)` — zero at φ = 0, the mechanical "dead center." Mount each
bearing axis parallel to its arm *at the home position* (α = 0) and that
mass's return velocity vanishes right at contact, no matter the leftover
energy:

```
E_return = η² · KE_in     (round trip: through the lever, spring, and back)
I_eff = I_lever + m_effort·L1²·sin²(α_effort) + m_load·R²·sin²(α_load)
ω_home = √( 2·E_return / I_eff )
v_effort,home = L1·ω_home·sin(α_effort)
v_load,home   = R·ω_home·sin(α_load)
```

At α_effort = α_load = 0, both return velocities are exactly zero — all of
`E_return` converts into spinning the (ideally light) lever itself, a far
smaller thing to arrest than two heavy translating masses hitting metal on
metal. This is a purely geometric fix, not a damping one — no buffer
material required.

The catch: exact dead center also means zero torque at that same point (the
classic dead-center problem), so the forward stroke needs a small deliberate
offset — or an off-axis component in the incoming impact — to break away
reliably. `α_effort` and `α_load` let you dial in exactly how much residual
return velocity that reliability margin costs. A lever inertia of zero
combined with any nonzero offset is flagged as undefined (0/0) rather than
silently shown as infinite.

## Max lever rotation (angle constraint)

Card 01 includes a **max lever rotation** field — the actual angular room
your hard stop and full-extension stop leave available, a real mechanical
ceiling rather than the model's generic 150° sanity threshold. `physics.js`
flags any design that needs more rotation than that as infeasible, and the
optimizer's own "Max lever rotation" constraint is the same field, so a
sweep and a single-point check agree on what's achievable. Set it in degrees
or radians — whichever you picked for angle units in Settings.

## Diagram layout

The schematic draws the effort mass on a slider arriving from the **right**
and the load mass + spring + linear rail on the **left**, both riding one
common horizontal axis — so the effort force is always drawn in line with
the axis the spring acts along, matching a straight-through packaging
layout. The fulcrum sits above, with the bent lever's two arms dropping to
each slider through a dashed link (representing the Scotch-yoke slot
coupling). Both masses are drawn as labeled blocks sized to their actual
value, so a heavier effort or load mass visibly reads as a bigger block.

One geometric note: perfectly aligning *both* sliders to one truly common,
single straight rail while also holding both dead-center offsets (α_e, α_l)
at exactly 0° simultaneously is only exact for a straight lever (β=180°) —
for a genuinely bent lever there's a small minimum combined offset baked in
by β. The diagram is the packaging concept; confirm the exact dead-center
geometry for your specific rail arrangement in CAD.

## Testing bounds & sensitivity (`index.html`)

Card 05 lets you fill in a lower/upper bound for any input you're still
unsure of. For each one with a bound set, the panel below re-runs the
physics with just that parameter swapped to its bound value — everything
else held at its primary value — and shows the resulting range for load
force, effort travel, max load travel, and load return velocity. This is a
one-at-a-time ("tornado") sensitivity check: which uncertain input actually
moves the result, not a worst-case combination of all of them together. For
that, use the full Monte Carlo sweep in `optimizer.html`.

## Assumptions & limitations

This is a lumped-parameter hand calculation for scoping bench-test hardware
(spring rate, stroke, arm lengths) — not a certified dynamic simulation.

- Both the effort and load forces are assumed to act perpendicular to their
  respective arms during the power stroke (the idealized lever assumption).
- The effort force is treated as constant (average/design value) over the
  effort-side stroke.
- Load-side travel during the lever's powered stroke is approximated by arc
  length (`R · Δθ`), a first-order stand-in for the true slider/
  connecting-link path. Verify against a CAD motion study or prototype once
  β and the rotation range are large.
- Lever mass/inertia and bearing friction during the power stroke are folded
  into the single efficiency factor η rather than modeled individually; the
  return-stroke section additionally needs an explicit lever inertia
  (I_lever) since that's exactly what's left spinning once both masses are
  dead-centered.
- The return-stroke model assumes a slotted/Scotch-yoke coupling
  specifically. A simple connecting-rod link behaves similarly near dead
  center but not identically — re-check with CAD if the offset angles are
  large.
- The spring is assumed near-lossless (its own hysteresis isn't modeled
  separately; fold it into η if it's significant for your spring).

## Design Space Explorer (`optimizer.html`)

For each input parameter you choose either **Lock** (a fixed value) or
**Range** (min/max, uniform random draw per sample). Samples are generated
with a seeded `mulberry32` PRNG (`shared/prng.js`) — the same seed and
configuration always reproduce the same run.

Every sample runs through `physics.js`, the identical engine behind
`index.html`. A sample is **feasible** if its geometry is valid, it stays a
genuine class-3 ratio, its required rotation is within your cap, the
dead-center return math is defined, and any optional peak-deceleration /
total-travel constraints are met.

**Scoring**: pick which objectives matter (effort travel, return velocities,
return energy, total travel, peak deceleration, or deviation from a target
load force) and a weight for each — everything is "smaller is better." Each
active objective is min–max normalized across the feasible set for this run,
inverted, and combined into a weighted composite score. The ranked list is
produced with the JS engine's native `Array.prototype.sort` (an O(n log n)
comparison sort), not a hand-rolled quadratic one.

**Pareto front**: for whichever two objectives you plot, the non-dominated
frontier is found with the standard 2D skyline algorithm — sort by X
ascending (O(n log n)), sweep once tracking the best Y seen so far, and a
point joins the frontier the instant it beats that running minimum. Total
cost is O(n log n), dominated by the sort, versus O(n²) for naive pairwise
dominance checking.

**Effort force range tags**: define named force bands (e.g. "Light Duty
100–250 lbf", "Heavy Duty 450–650 lbf") in the Tags card — they persist
across sessions (their own IndexedDB store, independent of saved runs). Every
feasible row is checked against each tag by holding that row's other
parameters fixed and re-running the physics engine at the tag's low, mid, and
high effort force — a tag applies only if all three points still pass every
constraint. This deliberately ignores whatever Fe the row itself sampled, so
it answers "would this hardware configuration hold up anywhere in this force
band," not just "did this one draw happen to land in it" — and a
configuration robust enough can and often will carry several tags at once.
Tags show as a column in the results table (sortable, like everything else)
and are included in CSV/.xlsx exports and saved runs.

**Persistence & export**: "Save run" keeps the top 500 samples by score in
this browser's IndexedDB (`shared/idb-store.js`), so it survives closing the
tab — most reliable when used via a hosted URL (see the top-level README's
GitHub Pages section) rather than `file://`, since browsers treat local-file
storage inconsistently. "Export CSV" / "Export .xlsx" (`shared/
spreadsheet-export.js`, a dependency-free zip/OOXML writer — a real
spreadsheet file, not a renamed CSV) always operate on the complete,
un-trimmed feasible set from the current run, so run those first if you want
everything from a very large sweep.

## Repo convention

This repository holds one calculator per subfolder — each addressing a
specific design problem, with its own `index.html` and `README.md`. See the
top-level `README.md` for the current list.
