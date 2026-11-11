/** Rendering budgets. "mobile" is the lighter profile; 30 FPS on a phone is a target to MEASURE, not a result. */
export type GraphicsProfile = Readonly<{
  name: 'desktop' | 'mobile';
  /** Upper bound for the device-pixel-ratio actually rendered. */
  maxPixelRatio: number;
  shadowMapSize: number;
  /** Half-size in metres of the area around the player that receives real-time shadows. */
  shadowRange: number;
  softShadows: boolean;
  anisotropy: number;
  /** Fraction of unreachable backdrop trees that is built. */
  backdropDensity: number;
  textureScale: number;
}>;

const PROFILES: Record<GraphicsProfile['name'], GraphicsProfile> = {
  desktop: { name: 'desktop', maxPixelRatio: 2, shadowMapSize: 2048, shadowRange: 46, softShadows: true, anisotropy: 8, backdropDensity: 1, textureScale: 1 },
  mobile: { name: 'mobile', maxPixelRatio: 1.5, shadowMapSize: 1024, shadowRange: 34, softShadows: false, anisotropy: 2, backdropDensity: 0.5, textureScale: 0.5 },
};

const STORAGE_KEY = 'brejo-weblab-gfx';

function stored(): string | null {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/** Order: ?gfx=mobile|desktop in the URL, then the saved choice, then automatic detection by pointer type. */
export function resolveGraphicsProfile(): GraphicsProfile {
  const requested = new URLSearchParams(window.location.search).get('gfx') ?? stored();
  if (requested === 'mobile' || requested === 'desktop') return PROFILES[requested];
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const mobileAgent = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return PROFILES[coarse || mobileAgent ? 'mobile' : 'desktop'];
}

/** Saves the other profile and reloads: budgets such as shadow maps are fixed at start-up. */
export function switchGraphicsProfile(current: GraphicsProfile): void {
  const next = current.name === 'desktop' ? 'mobile' : 'desktop';
  try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: fall through to the URL */ }
  const url = new URL(window.location.href);
  url.searchParams.set('gfx', next);
  window.location.replace(url.toString());
}
