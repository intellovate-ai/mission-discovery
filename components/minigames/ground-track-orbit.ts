// GROUND TRACK physics: a week of ground track and how much of Africa it photographs.
// Standard two-body orbit plus the J2 nodal drift (the bulge of the Earth turns the orbit
// plane; a sun-synchronous orbit is tilted so that drift matches the Sun, 0.9856 deg a day).
// The camera swath and the "needs daylight" rule are Game simplifications, noted below.
// Pure: no React, no imports, so it runs anywhere (and in a plain node test).

export const RE_KM = 6378.137;
const MU = 398600.4418; // km^3/s^2
const J2 = 1.08263e-3;
const SIDEREAL_DAY_S = 86164.0905;
const DEG = Math.PI / 180;
export const WEEK_S = 7 * 86400;
const SUN_RATE = (2 * Math.PI) / (365.2422 * 86400); // rad/s, the Sun's yearly circuit

/** Camera field of view across track [Game]: about 40 degrees, so the swath grows with height. */
export const FOV_DEG = 40;

export interface OrbitLike {
  altitudeKm: number;
  sunSync: boolean;
  dawnDusk?: boolean;
}

export function meanMotion(altitudeKm: number) {
  const a = RE_KM + altitudeKm;
  return Math.sqrt(MU / (a * a * a)); // rad/s
}

/** Tilt in degrees: 51.6 for the station orbit, or the sun-synchronous tilt for this height. */
export function tiltDeg(o: OrbitLike) {
  if (!o.sunSync) return 51.6;
  const a = RE_KM + o.altitudeKm;
  const n = meanMotion(o.altitudeKm);
  const cosI = -SUN_RATE / (1.5 * n * J2 * (RE_KM / a) ** 2);
  return Math.acos(cosI) / DEG;
}

export function swathKm(o: OrbitLike) {
  return 2 * o.altitudeKm * Math.tan((FOV_DEG / 2) * DEG);
}

export interface TrackPoint {
  t: number; // seconds from the start of the week
  lat: number;
  lon: number;
  lit: boolean; // Sun above the horizon under the spacecraft
}

/**
 * A week of subsatellite points. t = 0 is local noon at Greenwich on an equinox.
 * Sun-synchronous orbits cross the equator going south at 10:30 local time (the usual
 * imaging choice); dawn-dusk rides the line between day and night (06:00 / 18:00).
 */
export function weekTrack(o: OrbitLike, stepS = 20): TrackPoint[] {
  const a = RE_KM + o.altitudeKm;
  const n = meanMotion(o.altitudeKm);
  const inc = tiltDeg(o) * DEG;
  const raanRate = -1.5 * n * J2 * (RE_KM / a) ** 2 * Math.cos(inc);
  const wE = (2 * Math.PI) / SIDEREAL_DAY_S;
  // Ascending node local time: 22:30 for a 10:30 descending node, 18:00 for dawn-dusk.
  const ltan = o.dawnDusk ? 18 : o.sunSync ? 22.5 : 15;
  const raan0 = (ltan - 12) * 15 * DEG; // Sun sits on the inertial x axis at t = 0
  const pts: TrackPoint[] = [];
  for (let t = 0; t <= WEEK_S; t += stepS) {
    const u = n * t;
    const raan = raan0 + raanRate * t;
    const cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(inc), si = Math.sin(inc);
    const x = cO * cu - sO * su * ci;
    const y = sO * cu + cO * su * ci;
    const z = su * si;
    const sunA = SUN_RATE * t;
    const lit = x * Math.cos(sunA) + y * Math.sin(sunA) > 0; // equinox: Sun in the equator plane
    let lon = (Math.atan2(y, x) - wE * t) / DEG;
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    pts.push({ t, lat: Math.asin(z) / DEG, lon, lit });
  }
  return pts;
}

/** Parse the generated "lat:lonStart+count,...;" cell list. */
export function parseCells(enc: string): [number, number][] {
  const cells: [number, number][] = [];
  for (const row of enc.split(";")) {
    const [lat, runs] = row.split(":");
    for (const run of runs.split(",")) {
      const [s, c] = run.split("+").map(Number);
      for (let k = 0; k < c; k++) cells.push([Number(lat), s + k]);
    }
  }
  return cells;
}

export interface Coverage {
  /** Seconds into the week each cell was first photographed (Infinity = never). */
  firstSeen: Float64Array;
  /** Average days between looks for cells that were seen. */
  revisitDays: number;
  /** Share of cells photographed during the week, 0..1. */
  week: number;
}

/** Which target cells fall inside the daylight swath during the week. */
export function coverage(o: OrbitLike, cells: [number, number][], track = weekTrack(o)): Coverage {
  const rho = swathKm(o) / 2 / RE_KM; // angular half width, radians
  const rhoDeg = rho / DEG;
  const index = new Map<number, number>();
  cells.forEach(([la, lo], i) => index.set(la * 1000 + lo, i));
  const firstSeen = new Float64Array(cells.length).fill(Infinity);
  const days = cells.map(() => new Set<number>());
  const cosRho = Math.cos(rho);
  for (const p of track) {
    if (!p.lit) continue;
    if (p.lat < -42 || p.lat > 42 || p.lon < -25 || p.lon > 60) continue;
    const sLat = Math.sin(p.lat * DEG), cLat = Math.cos(p.lat * DEG);
    const dLon = rhoDeg / Math.max(0.2, cLat);
    for (let la = Math.floor(p.lat - rhoDeg); la <= Math.floor(p.lat + rhoDeg); la++)
      for (let lo = Math.floor(p.lon - dLon); lo <= Math.floor(p.lon + dLon); lo++) {
        const i = index.get(la * 1000 + lo);
        if (i === undefined) continue;
        const cla = (la + 0.5) * DEG, clo = (lo + 0.5) * DEG;
        const cosD = sLat * Math.sin(cla) + cLat * Math.cos(cla) * Math.cos(clo - p.lon * DEG);
        if (cosD < cosRho) continue;
        if (p.t < firstSeen[i]) firstSeen[i] = p.t;
        days[i].add(Math.floor(p.t / 86400));
      }
  }
  let seen = 0, dsum = 0;
  for (let i = 0; i < cells.length; i++) if (days[i].size) { seen++; dsum += days[i].size; }
  return { firstSeen, week: seen / cells.length, revisitDays: seen ? 7 / (dsum / seen) : Infinity };
}

/** Share of cells first seen by time t (seconds into the week). */
export function coveredBy(c: Coverage, t: number) {
  let k = 0;
  for (const s of c.firstSeen) if (s <= t) k++;
  return k / c.firstSeen.length;
}
