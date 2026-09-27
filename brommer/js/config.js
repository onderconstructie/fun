// Brommer & the Finish – shared constants for engine and renderer.
// World units: the road is 2 * ROAD wide, the track is a list of SEG-long
// segments. Speeds are world units per second; KMH converts to km/u for display.

export const STEP = 1 / 60; // fixed simulation step (s)
export const SEG = 200; // segment length
export const ROAD = 2000; // road half-width; racer x is in these units (-1..1 = on the road)
export const KMH = 100; // world units per second for 1 km/u
export const RUMBLE = 3; // segments per colour band

export const BIKE_W = 0.24; // moped width in road half-widths (collision)
export const BIKE_LEN = 170; // moped length for collisions
export const EDGE = 1.55; // soft wall: racers never go further off the road than this

// Physics.
export const STEER = 1.55; // lateral speed (road half-widths / s) at full lock and reference speed
export const CF = 0.19; // centrifugal drift per unit of curve
export const REF_SPEED = 50 * KMH; // speed at which steering and drift are "1"
export const OFFROAD_TOP = 0.55; // share of base top speed on the grass
export const BOOST_HALF = 8; // stolen speed halves every BOOST_HALF seconds
export const MAX_BOOST = 70 * KMH;
export const TOP_CAP = 170 * KMH;

// Stealing speed.
export const STEAL_FRAC = 0.42; // share of the victim's speed you take
export const STEAL_MIN = 9; // km/u, a steal always feels worth it
export const STEAL_MAX = 45; // km/u per steal
export const PERM_SHARE = 0.4; // this part of a steal stays for the rest of the race (the victim loses it)
export const PERM_FLOOR = 0.7; // a rider never drops below 70% of their own top speed
export const REGEN = 0.8; // km/u per second: speed you lost grows back slowly (no hopeless races)
export const ROOM = 95; // km/u of stolen speed after which steals give less and less
export const SURGE = 0.8; // share of the stolen speed you get immediately
export const WOBBLE_T = 0.6; // victim wobbles (little steering) this long
export const IMMUNE_T = 2; // victim cannot be robbed again this long
export const PAIR_COOLDOWN = 2.2; // same attacker cannot rob the same victim again this long
export const START_GRACE = 3.5; // no stealing in the first seconds after GO

// Slipstream.
export const DRAFT_DIST = 1500; // behind someone closer than this ...
export const DRAFT_W = 0.3; // ... and this well lined up
export const DRAFT_TOP = 0.16; // +16% top speed at full slipstream
export const DRAFT_ACC = 0.8; // +80% acceleration at full slipstream
