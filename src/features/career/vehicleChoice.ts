import { VEHICLE_KINDS, type VehicleKind } from '../../core/career/careers';

/**
 * B1-01 F2 (AC-03): one-time choice of the career's own vehicle. Resolves with the kind the player
 * tapped; the caller persists it (careerBoot.chooseCareerVehicle) before the world is built.
 */
export function askVehicle(doc: Document, characterName: string): Promise<VehicleKind> {
  const box = doc.querySelector<HTMLElement>('#vehicle-choice');
  const name = doc.querySelector<HTMLElement>('#vehicle-choice-name');
  if (!box) return Promise.reject(new Error('Tela de escolha de veículo ausente'));
  if (name) name.textContent = characterName;
  box.hidden = false;
  return new Promise((resolve) => {
    const buttons = [...box.querySelectorAll<HTMLButtonElement>('[data-vehicle]')];
    for (const button of buttons) {
      const kind = button.dataset.vehicle as VehicleKind;
      if (!(VEHICLE_KINDS as readonly string[]).includes(kind)) continue;
      button.addEventListener('click', () => {
        if (box.hidden) return;
        box.hidden = true;
        resolve(kind);
      });
    }
  });
}
