import { pointInPoly, type Box2D, type Poly2D } from './collision.ts';

/** A raised area (pavement, block, square): an axis box, optionally refined by a convex polygon. */
export type RaisedArea = Readonly<{ box: Box2D; height: number; poly?: Poly2D }>;

/** Ground height at (x, z): the roadway is 0, pavements and squares are raised by the kerb height. */
export function heightAt(x: number, z: number, areas: readonly RaisedArea[]): number {
  let height = 0;
  for (const area of areas) {
    const b = area.box;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && area.height > height && (!area.poly || pointInPoly(area.poly.pts, x, z))) height = area.height;
  }
  return height;
}
