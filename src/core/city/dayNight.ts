/**
 * CORE-013 day/night lighting as pure numbers (tested), applied to the scene by world/environment.
 * Sunrise ~6:00, sunset ~18:30 (spring in São Paulo state, simplified, no real ephemeris).
 */
export type Rgb = readonly [number, number, number];
export type Lighting = {
  /** Unit vector the sunlight travels along (Babylon DirectionalLight.direction). */
  sunDirection: [number, number, number];
  sunColor: Rgb; sunIntensity: number;
  skyColor: Rgb; groundColor: Rgb; skyIntensity: number;
  fogColor: Rgb; skyTint: Rgb;
  /** 0 = full day, 1 = full night; drives street lights, windows, headlights and shadow strength. */
  night: number;
  shadows: boolean;
};

const SUNRISE = 6;
const SUNSET = 18.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function lightingAt(hour: number): Lighting {
  const h = ((hour % 24) + 24) % 24;
  // Sun angle along an east→west arc tilted to the north (southern hemisphere).
  const dayT = (h - SUNRISE) / (SUNSET - SUNRISE);
  const elevation = Math.sin(Math.PI * Math.min(1, Math.max(0, dayT))) * 0.95;
  const azimuth = Math.PI * dayT;
  const sx = Math.cos(azimuth);
  const sy = Math.max(0.12, Math.sin(elevation));
  const sz = 0.45;
  const len = Math.hypot(sx, sy, sz);
  const sunDirection: [number, number, number] = [-sx / len, -sy / len, -sz / len];
  const dawn = smooth(SUNRISE - 0.8, SUNRISE + 0.7, h);
  const dusk = 1 - smooth(SUNSET - 0.4, SUNSET + 0.9, h);
  const daylight = Math.min(dawn, dusk);
  const night = 1 - daylight;
  const golden = Math.max(1 - Math.abs(h - (SUNSET - 0.6)) / 1.6, 1 - Math.abs(h - (SUNRISE + 0.6)) / 1.4, 0);
  // Day colours keep the approved CORE-010 warm grade (sun #ffd9a4, sky #c4d8f0, ground #a08665).
  // GFX-001: whiter noon sun against a bluer sky light (more colour contrast between lit and
  // shaded sides), and a deeper orange at golden hour.
  const noon: Rgb = [1.0, 0.92, 0.78];
  const gold: Rgb = [1.0, 0.66, 0.34];
  const moon: Rgb = [0.55, 0.65, 0.95];
  const sunColor = night > 0.6 ? moon : mix(noon, gold, Math.min(1, golden));
  const sunIntensity = lerp(0.5, 2.45, daylight) * (1 - 0.12 * golden);
  const skyDay: Rgb = [0.66, 0.8, 1.0];
  const skyNight: Rgb = [0.45, 0.52, 0.78];
  const skyColor = mix(skyDay, skyNight, night);
  const groundColor = mix([0.66, 0.56, 0.42], [0.24, 0.24, 0.3], night);
  const skyIntensity = lerp(0.6, 0.86, daylight);
  const fogDay: Rgb = [0.84, 0.9, 0.95];
  const fogDusk: Rgb = [0.97, 0.74, 0.56];
  const fogNight: Rgb = [0.11, 0.14, 0.23];
  const fogColor = mix(mix(fogDay, fogDusk, Math.min(1, golden)), fogNight, night);
  const skyTint = mix(mix([1, 1, 1], [1.08, 0.82, 0.66], Math.min(1, golden)), [0.24, 0.29, 0.48], night);
  return { sunDirection, sunColor, sunIntensity, skyColor, groundColor, skyIntensity, fogColor, skyTint, night, shadows: daylight > 0.2 };
}
