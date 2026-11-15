import type { Box2D } from '../../core/collision.ts';
import { CURB_H } from '../layout.ts';
import { DEPOT, depotPoly, subtractBoxes } from './cityPlan.ts';

export const DEPOT_FLOOR_Y=CURB_H;
export const depotTerrainHole=()=>depotPoly(DEPOT.lot).pts;
export type DepotFloorSurface=Box2D&{kind:'concrete'|'asphalt'|'interior'};
/** Adjacent surfaces at the physical ground height. No slab continues below another main floor. */
export function depotFloorSurfaces():DepotFloorSurface[]{
 const asphalt:Box2D={minX:96,maxX:139.5,minZ:-117.8,maxZ:-92.5};
 const interior:Box2D={minX:92.3,maxX:135.7,minZ:-141.7,maxZ:-118.3};
 return [...subtractBoxes(DEPOT.lot,[asphalt,interior]).map(b=>({...b,kind:'concrete' as const})),{...asphalt,kind:'asphalt'},{...interior,kind:'interior'}];
}
export const FLOOR_PAINT_LAYERS={repair:1,joint:2,lane:3,marking:4} as const;
