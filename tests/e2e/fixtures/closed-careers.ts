/**
 * B1-01 F6 E2E fixture: closed (no open shift) VALID saves of the given careers, built with the real
 * domain functions, with the presets and vehicle the four-careers test expects for them.
 * argv[2]: JSON [{id, appearance, equipment, vehicle}]. Prints { key: value } for localStorage.
 */
import { CareerStore, MemoryStorage, saveKey } from '../../../src/core/career/careerStore.ts';
import { chooseStartingVehicle, customize, defaultProfile } from '../../../src/core/career/snapshot.ts';
import type { CareerId } from '../../../src/core/career/careers.ts';

const plan = JSON.parse(process.argv[2] ?? '[]') as { id: CareerId; appearance: 'masculino' | 'feminino'; equipment: 'kit-jaqueta' | 'kit-refletivo'; vehicle: 'moto-antiga' | 'carro-antigo' }[];
const storage = new MemoryStorage();
const store = new CareerStore(storage);
for (const c of plan) store.commit(c.id, chooseStartingVehicle(customize(defaultProfile(c.id), { appearance: c.appearance, equipment: c.equipment }), c.vehicle), null, -1);
process.stdout.write(JSON.stringify(Object.fromEntries(plan.map((c) => [saveKey(c.id), storage.getItem(saveKey(c.id))]))));
