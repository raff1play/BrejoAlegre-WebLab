import { NODE_DEGREE, type StreetRoute, type XZ } from './streetRoute.ts';

/**
 * MAP-001 navigation helpers for the minimap: pure, cheap (one pass over a route of a few hundred
 * points at most) and independent of the canvas. Nothing here invents data: manoeuvres are only
 * reported at real network junctions the route already goes through, and there is no ETA.
 */
export type TurnKind = 'left' | 'right' | 'straight';
export type Maneuver = Readonly<{ s: number; x: number; z: number; kind: Exclude<TurnKind, 'straight'>; angle: number; node: string }>;
export type Instruction = Readonly<{ kind: TurnKind; distance: number }>;

export const NAV = Object.freeze({
  /** Direction is measured this far before/after the junction, so kerb wiggles do not count. */
  probe: 10,
  /** Below this heading change a junction is "straight on" (not announced). */
  turnMinDeg: 30,
  /** Off-route: further than this from the route line… */
  offRouteM: 18,
  /** …for this long (ms) triggers a new route… */
  offRouteMs: 1200,
  /** …but never more often than this (ms). */
  rerouteCooldownMs: 3000,
  /** Close to the objective the straight distance is shown instead of a street route (hysteresis). */
  nearEnterM: 50,
  nearLeaveM: 70,
  /** Speed zoom: view radius (m) from slow manoeuvres to fast riding, and the speed range (km/h). */
  zoomNear: 55, zoomFar: 115, zoomSlowKmh: 10, zoomFastKmh: 45,
  /** A new zoom target is taken only when it differs this much (m): no shimmer at steady speed. */
  zoomStep: 6,
  /** Zoom follows its target with this rate (1/s): ≈ 0.7 s time constant. */
  zoomRate: 1.5,
});

/** Cumulative arc length at each route point. */
export function arcLengths(points: readonly XZ[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
  return out;
}

/** Point at arc length `s` (clamped to the route). */
export function pointAt(points: readonly XZ[], arcs: readonly number[], s: number): XZ {
  if (points.length === 0) return [0, 0];
  if (s <= 0) return points[0]!;
  for (let i = 1; i < points.length; i++) {
    if (arcs[i]! >= s) {
      const L = arcs[i]! - arcs[i - 1]!;
      const t = L > 0 ? (s - arcs[i - 1]!) / L : 0;
      const a = points[i - 1]!; const b = points[i]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return points[points.length - 1]!;
}

/**
 * Signed heading change between two directions, radians: positive = left, negative = right
 * (x east, z north seen from above; the bike's yaw grows when it turns right).
 */
export function turnAngle(inX: number, inZ: number, outX: number, outZ: number): number {
  return Math.atan2(inX * outZ - inZ * outX, inX * outX + inZ * outZ);
}

/** Left/right manoeuvres at real junctions (≥ 3 streets) along the route, in route order. */
export function routeManeuvers(route: StreetRoute, degree: ReadonlyMap<string, number> = NODE_DEGREE): Maneuver[] {
  const arcs = arcLengths(route.points);
  const out: Maneuver[] = [];
  const min = (NAV.turnMinDeg * Math.PI) / 180;
  for (const j of route.junctions) {
    if ((degree.get(j.node) ?? 0) < 3) continue;
    const s = arcs[j.index];
    if (s === undefined || s < 1 || s > route.length - 1) continue;
    const at = route.points[j.index]!;
    const before = pointAt(route.points, arcs, s - NAV.probe);
    const after = pointAt(route.points, arcs, s + NAV.probe);
    const angle = turnAngle(at[0] - before[0], at[1] - before[1], after[0] - at[0], after[1] - at[1]);
    if (!Number.isFinite(angle) || Math.abs(angle) < min) continue;
    out.push({ s, x: at[0], z: at[1], kind: angle > 0 ? 'left' : 'right', angle, node: j.node });
  }
  return out;
}

/** Nearest point of the route to (x, z): its arc length and the distance from the route line. */
export function projectOnRoute(points: readonly XZ[], arcs: readonly number[], x: number, z: number): { s: number; d: number; index: number } {
  let best = { s: 0, d: Infinity, index: 0 };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!; const b = points[i]!;
    const dx = b[0] - a[0]; const dz = b[1] - a[1];
    const L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)) : 0;
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
    if (d < best.d) best = { s: arcs[i - 1]! + t * Math.sqrt(L2), d, index: i - 1 };
  }
  return best;
}

/** Next announced manoeuvre ahead of arc length `s`, or "straight on" to the end of the route. */
export function nextInstruction(maneuvers: readonly Maneuver[], s: number, length: number): Instruction {
  for (const m of maneuvers) if (m.s > s + 2) return { kind: m.kind, distance: m.s - s };
  return { kind: 'straight', distance: Math.max(0, length - s) };
}

/**
 * Rerouting gate: a new route only when the target changed, or after riding clearly away from
 * the line for a while, with a cooldown — no recalculation storms, no flip-flopping routes.
 */
export type RerouteState = { offSince: number | null; lastRoute: number };
export function shouldReroute(state: RerouteState, offDistance: number, now: number): boolean {
  if (!(offDistance > NAV.offRouteM)) { state.offSince = null; return false; }
  if (state.offSince === null) state.offSince = now;
  return now - state.offSince >= NAV.offRouteMs && now - state.lastRoute >= NAV.rerouteCooldownMs;
}

/** Speed zoom: view radius (m) for a speed, with an eased transition between the limits. */
export function zoomForSpeed(kmh: number): number {
  const v = Number.isFinite(kmh) ? Math.abs(kmh) : 0;
  const t = Math.max(0, Math.min(1, (v - NAV.zoomSlowKmh) / (NAV.zoomFastKmh - NAV.zoomSlowKmh)));
  const e = t * t * (3 - 2 * t);
  return NAV.zoomNear + (NAV.zoomFar - NAV.zoomNear) * e;
}

/** Zoom target with a dead band: small speed changes keep the current target. */
export function nextZoomTarget(current: number, kmh: number): number {
  const raw = zoomForSpeed(kmh);
  return Math.abs(raw - current) >= NAV.zoomStep || raw === NAV.zoomNear || raw === NAV.zoomFar ? raw : current;
}
