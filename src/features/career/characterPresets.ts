import type { CharacterLook } from '../shared/character';
import type { AppearancePreset, EquipmentPresetId } from '../../core/career/careers';

/**
 * B1-01 F3.5 (decision 1, AC-02): the career's saved presets → the look of the character the
 * player actually controls in the world (on foot, on the motorcycle and at the wheel of the car).
 * One shared mapping, so the menu preview, the rider, the walker and the driver never disagree.
 * Colours are provisional (out of the frozen scope); the preset IDs are not.
 */
export type EquipmentLook = Readonly<{ jacket: string; vest?: string; trim: string; helmet: string; helmetStripe: string }>;
export const EQUIPMENT_LOOK: Readonly<Record<EquipmentPresetId, EquipmentLook>> = Object.freeze({
  // Black riding jacket with yellow bands, dark full-face helmet.
  'kit-jaqueta': Object.freeze({ jacket: '#202226', trim: '#f2c12e', helmet: '#26282c', helmetStripe: '#f2c12e' }),
  // Fluorescent reflective vest over a grey jacket, white helmet.
  'kit-refletivo': Object.freeze({ jacket: '#3a4048', vest: '#cfee3a', trim: '#e6e6df', helmet: '#efefea', helmetStripe: '#cfee3a' }),
});

/** Everything but the kit: the CORE-010 rider's trousers, boots, gloves and skin (same values as RIDER_LOOK). */
const BASE = Object.freeze({ jeans: '#23272d', boots: '#1d1a17', gloves: '#141516', skin: '#c69874' });

export function careerLook(appearance: AppearancePreset, equipment: EquipmentPresetId): CharacterLook {
  const kit = EQUIPMENT_LOOK[equipment];
  const look: CharacterLook = { ...BASE, jacket: kit.jacket, trim: kit.trim, helmet: kit.helmet, helmetStripe: kit.helmetStripe, figure: appearance };
  if (kit.vest) look.vest = kit.vest;
  return look;
}
