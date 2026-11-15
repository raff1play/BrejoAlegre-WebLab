/**
 * B1-01 F3.5 E2E fixture: prints a VALID sealed save of Norte (Rosa) with an open shift
 * (`activeShiftId`), as F5/F6 will write it, so the browser test can check the AC-17 lock in the
 * menu. Built with the real domain functions (checksum, schema v2); nothing is hand-written.
 */
import { CareerStore, MemoryStorage, saveKey, ACTIVE_CAREER_KEY } from '../../../src/core/career/careerStore.ts';
import { chooseStartingVehicle, defaultProfile, emptyShift, shiftIdOf } from '../../../src/core/career/snapshot.ts';

const storage = new MemoryStorage();
const store = new CareerStore(storage);
const profile = { ...chooseStartingVehicle(defaultProfile('personagem-norte', 3), 'moto-antiga'), activeShiftId: shiftIdOf('personagem-norte', 3) };
store.commit('personagem-norte', profile, { ...emptyShift('personagem-norte', 3), elapsedVirtualMinutes: 200 }, -1);
store.setActiveCareer('personagem-norte');
process.stdout.write(JSON.stringify({ [saveKey('personagem-norte')]: storage.getItem(saveKey('personagem-norte')), [ACTIVE_CAREER_KEY]: storage.getItem(ACTIVE_CAREER_KEY) }));
