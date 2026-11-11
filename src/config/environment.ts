/** This is a build-time UI/environment marker, never a secret or runtime production authority. */
export type LabEnvironment = 'development' | 'staging' | 'production';
const configured = import.meta.env.VITE_GAME_ENV;
const fallback:LabEnvironment=import.meta.env.PROD?'production':'development';
const name:LabEnvironment = configured === 'development' || configured === 'staging' || configured === 'production' ? configured : fallback;
export const currentEnvironment = Object.freeze({
  name,
  isProduction:name==='production',
  showPrototypeWarning:true,
  // Do not confuse this with a multiplayer feature flag.
  singlePlayerOnly:true,
});
