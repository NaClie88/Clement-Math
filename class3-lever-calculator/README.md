# Bent Class-3 Lever — Impact-to-Spring Shock Absorber Calculator

Interactive hand-calculation tool for a class-3 lever mechanism, bent at the
effort point, that converts an incoming impact into a load mass traveling
down a linear bearing into a spring — including the return stroke, where the
same spring sends both masses back to a home hard stop. Open `index.html` in
any browser — no build step, no server, no external dependencies.

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

## Repo convention

This repository holds one calculator per subfolder — each addressing a
specific design problem, with its own `index.html` and `README.md`. See the
top-level `README.md` for the current list.
